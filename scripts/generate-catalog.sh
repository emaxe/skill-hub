#!/usr/bin/env bash
# generate-catalog.sh — builds catalog.json from skills/*/SKILL.md frontmatter
set -euo pipefail

# cd to repo root (parent of scripts/)
cd "$(dirname "$0")/.."

CATALOG="catalog.json"
TMPDIR_WORK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_WORK"' EXIT

# File to collect tag->skill mappings (one "tag\tskill" per line)
TAG_FILE="$TMPDIR_WORK/tags.tsv"
: > "$TAG_FILE"

# JSON-escape a string: escape backslashes, double quotes, and control chars
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# Parse a YAML array value like [tag1, tag2, "tag 3"] into JSON array string
yaml_array_to_json() {
  local raw="$1"
  # Strip surrounding brackets
  raw="${raw#\[}"
  raw="${raw%\]}"
  raw="$(echo "$raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  if [ -z "$raw" ]; then
    printf '[]'
    return
  fi

  local result="["
  local first=true
  # Split on comma
  IFS=',' read -ra items <<< "$raw"
  for item in "${items[@]}"; do
    # Trim whitespace
    item="$(echo "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    # Strip surrounding quotes if present
    item="${item#\"}"
    item="${item%\"}"
    item="${item#\'}"
    item="${item%\'}"
    if [ "$first" = true ]; then
      first=false
    else
      result+=","
    fi
    result+="\"$(json_escape "$item")\""
  done
  result+="]"
  printf '%s' "$result"
}

# Collect skill entries into a temp file (one JSON object per line, separated by newlines)
ENTRIES_FILE="$TMPDIR_WORK/entries.json"
: > "$ENTRIES_FILE"

skill_dirs=(skills/*/SKILL.md)

# Check if any SKILL.md files exist
has_skills=false
for skill_file in "${skill_dirs[@]}"; do
  [ -f "$skill_file" ] && has_skills=true && break
done

if [ "$has_skills" = false ]; then
  # No skills found — generate empty catalog
  cat > "$CATALOG" <<EOFCAT
{
  "version": 1,
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "skills_count": 0,
  "skills": [],
  "tags_index": {}
}
EOFCAT
  echo "Generated $CATALOG with 0 skills."
  exit 0
fi

count=0

for skill_file in skills/*/SKILL.md; do
  [ -f "$skill_file" ] || continue

  # Extract directory name
  dir_name="$(basename "$(dirname "$skill_file")")"

  # Skip _template
  [ "$dir_name" = "_template" ] && continue

  # Extract frontmatter (between first and second ---)
  frontmatter=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$skill_file")

  if [ -z "$frontmatter" ]; then
    echo "Warning: no frontmatter in $skill_file, skipping" >&2
    continue
  fi

  # Parse fields from frontmatter
  name=""
  description=""
  tags="[]"
  author=""
  version="1.0.0"
  scope="global"
  platforms='["claude-code"]'
  dependencies="[]"

  while IFS= read -r line; do
    # Skip empty lines
    [ -z "$line" ] && continue

    # Extract key: value
    key="$(echo "$line" | sed -n 's/^\([a-z_]*\):[[:space:]]*\(.*\)$/\1/p')"
    val="$(echo "$line" | sed -n 's/^\([a-z_]*\):[[:space:]]*\(.*\)$/\2/p')"

    # Strip surrounding quotes from val
    val="$(echo "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    stripped_val="${val#\"}"
    stripped_val="${stripped_val%\"}"
    stripped_val="${stripped_val#\'}"
    stripped_val="${stripped_val%\'}"

    case "$key" in
      name)
        name="$stripped_val"
        ;;
      description)
        description="$stripped_val"
        ;;
      tags)
        tags="$(yaml_array_to_json "$val")"
        ;;
      author)
        author="$stripped_val"
        ;;
      version)
        version="$stripped_val"
        ;;
      scope)
        scope="$stripped_val"
        ;;
      platforms)
        platforms="$(yaml_array_to_json "$val")"
        ;;
      dependencies)
        dependencies="$(yaml_array_to_json "$val")"
        ;;
    esac
  done <<< "$frontmatter"

  # Use directory name as fallback for name
  [ -z "$name" ] && name="$dir_name"

  # Collect list of files in the skill directory
  files_json="["
  first_file=true
  for f in "skills/$dir_name"/*; do
    [ -f "$f" ] || continue
    fname="$(basename "$f")"
    if [ "$first_file" = true ]; then
      first_file=false
    else
      files_json+=","
    fi
    files_json+="\"$(json_escape "$fname")\""
  done
  files_json+="]"

  # Build JSON entry
  entry="    {
      \"name\": \"$(json_escape "$name")\",
      \"description\": \"$(json_escape "$description")\",
      \"tags\": $tags,
      \"author\": \"$(json_escape "$author")\",
      \"version\": \"$(json_escape "$version")\",
      \"scope\": \"$(json_escape "$scope")\",
      \"platforms\": $platforms,
      \"path\": \"skills/$dir_name\",
      \"files\": $files_json,
      \"dependencies\": $dependencies
    }"

  # Append entry to file, with comma separator for non-first entries
  if [ $count -gt 0 ]; then
    printf ',\n%s' "$entry" >> "$ENTRIES_FILE"
  else
    printf '%s' "$entry" >> "$ENTRIES_FILE"
  fi
  count=$((count + 1))

  # Record tag->skill mappings
  tag_list="$(echo "$tags" | sed 's/^\[//;s/\]$//;s/","/ /g;s/"//g')"
  for tag in $tag_list; do
    tag="$(echo "$tag" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "$tag" ] && continue
    printf '%s\t%s\n' "$tag" "$name" >> "$TAG_FILE"
  done
done

# Build tags_index JSON from TAG_FILE
tags_index_json=""
first_tag=true

if [ -s "$TAG_FILE" ]; then
  # Get sorted unique tags
  sorted_tags="$(cut -f1 "$TAG_FILE" | sort -u)"

  while IFS= read -r tag; do
    [ -z "$tag" ] && continue

    if [ "$first_tag" = true ]; then
      first_tag=false
    else
      tags_index_json+=","$'\n'
    fi

    # Get all skill names for this tag
    names_json="["
    first_name=true
    while IFS= read -r skill_name; do
      if [ "$first_name" = true ]; then
        first_name=false
      else
        names_json+=","
      fi
      names_json+="\"$(json_escape "$skill_name")\""
    done < <(awk -F'\t' -v t="$tag" '$1==t{print $2}' "$TAG_FILE" | sort -u)
    names_json+="]"

    tags_index_json+="    \"$(json_escape "$tag")\": $names_json"
  done <<< "$sorted_tags"
fi

# Read entries
skills_json=""
if [ -s "$ENTRIES_FILE" ]; then
  skills_json="$(cat "$ENTRIES_FILE")"
fi

# Write catalog.json
cat > "$CATALOG" <<EOFCAT
{
  "version": 1,
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "skills_count": $count,
  "skills": [
$skills_json
  ],
  "tags_index": {
$tags_index_json
  }
}
EOFCAT

echo "Generated $CATALOG with $count skill(s)."
