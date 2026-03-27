#!/usr/bin/env bash
# generate-catalog.sh — builds catalog.json from skills/*/SKILL.md, agents/*/AGENT.md, commands/*/COMMAND.md
set -euo pipefail

# cd to repo root (parent of scripts/)
cd "$(dirname "$0")/.."

CATALOG="catalog.json"
TMPDIR_WORK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_WORK"' EXIT

# File to collect tag->extension mappings (one "tag\ttype:name" per line)
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
  raw="${raw#\[}"
  raw="${raw%\]}"
  raw="$(echo "$raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  if [ -z "$raw" ]; then
    printf '[]'
    return
  fi

  local result="["
  local first=true
  IFS=',' read -ra items <<< "$raw"
  for item in "${items[@]}"; do
    item="$(echo "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
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

# Collect all extension entries into a temp file
ENTRIES_FILE="$TMPDIR_WORK/entries.json"
: > "$ENTRIES_FILE"

# Backward-compat: skill-only entries
SKILL_ENTRIES_FILE="$TMPDIR_WORK/skill_entries.json"
: > "$SKILL_ENTRIES_FILE"

total_count=0
skill_count=0
agent_count=0
command_count=0

# parse_extensions TYPE GLOB_PATTERN DEFAULT_SCOPE
parse_extensions() {
  local ext_type="$1"
  local glob_pattern="$2"
  local default_scope="$3"

  local local_count=0
  local SEEN_NAMES=()

  for ext_file in $glob_pattern; do
    [ -f "$ext_file" ] || continue

    local dir_name
    dir_name="$(basename "$(dirname "$ext_file")")"

    # Skip _template
    [ "$dir_name" = "_template" ] && continue

    local frontmatter
    frontmatter=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$ext_file")

    if [ -z "$frontmatter" ]; then
      echo "Warning: no frontmatter in $ext_file, skipping" >&2
      continue
    fi

    local name="" description="" tags="[]" author="" version="1.0.0"
    local scope="$default_scope" platforms='["claude-code"]' dependencies="[]"
    local model="" color=""

    while IFS= read -r line; do
      [ -z "$line" ] && continue

      local key val stripped_val
      key="$(echo "$line" | sed -n 's/^\([a-z_]*\):[[:space:]]*\(.*\)$/\1/p')"
      val="$(echo "$line" | sed -n 's/^\([a-z_]*\):[[:space:]]*\(.*\)$/\2/p')"

      val="$(echo "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      stripped_val="${val#\"}"
      stripped_val="${stripped_val%\"}"
      stripped_val="${stripped_val#\'}"
      stripped_val="${stripped_val%\'}"

      case "$key" in
        name)         name="$stripped_val" ;;
        description)  description="$stripped_val" ;;
        tags)         tags="$(yaml_array_to_json "$val")" ;;
        author)       author="$stripped_val" ;;
        version)      version="$stripped_val" ;;
        scope)        scope="$stripped_val" ;;
        platforms)    platforms="$(yaml_array_to_json "$val")" ;;
        dependencies) dependencies="$(yaml_array_to_json "$val")" ;;
        model)        model="$stripped_val" ;;
        color)        color="$stripped_val" ;;
      esac
    done <<< "$frontmatter"

    [ -z "$name" ] && name="$dir_name"

    # Check uniqueness within type
    for seen in "${SEEN_NAMES[@]+"${SEEN_NAMES[@]}"}"; do
      if [ "$seen" = "$name" ]; then
        echo "Error: duplicate $ext_type name '$name' in $ext_file" >&2
        continue 2
      fi
    done
    SEEN_NAMES+=("$name")

    # Extension directory path
    local ext_dir
    case "$ext_type" in
      skill)   ext_dir="skills/$dir_name" ;;
      agent)   ext_dir="agents/$dir_name" ;;
      command) ext_dir="commands/$dir_name" ;;
    esac

    # Determine primary file name based on type
    local primary_file
    if [ "$ext_type" = "agent" ]; then
      primary_file="AGENT.md"
    elif [ "$ext_type" = "command" ]; then
      primary_file="COMMAND.md"
    else
      primary_file="SKILL.md"
    fi

    # Check for agent-specific files
    local cursor_file="null"
    local copilot_file="null"
    local files_list="\"$primary_file\""

    if [ -f "$ext_dir/CURSOR.md" ]; then
      cursor_file="\"CURSOR.md\""
      files_list="$files_list, \"CURSOR.md\""
    fi
    if [ -f "$ext_dir/COPILOT.md" ]; then
      copilot_file="\"COPILOT.md\""
      files_list="$files_list, \"COPILOT.md\""
    fi

    local files_json="[$files_list]"

    # Build platforms as object
    local platforms_json="{\"claude-code\": \"$primary_file\", \"cursor\": $cursor_file, \"copilot\": $copilot_file}"

    # Build JSON entry for extensions array
    local entry="    {
      \"type\": \"$(json_escape "$ext_type")\",
      \"name\": \"$(json_escape "$name")\",
      \"description\": \"$(json_escape "$description")\",
      \"tags\": $tags,
      \"author\": \"$(json_escape "$author")\",
      \"version\": \"$(json_escape "$version")\",
      \"scope\": \"$(json_escape "$scope")\",
      \"platforms\": $platforms_json,
      \"path\": \"$ext_dir\",
      \"files\": $files_json,
      \"dependencies\": $dependencies"

    # Add agent-specific fields
    if [ "$ext_type" = "agent" ]; then
      if [ -n "$model" ]; then
        entry+=",
      \"model\": \"$(json_escape "$model")\""
      fi
      if [ -n "$color" ]; then
        entry+=",
      \"color\": \"$(json_escape "$color")\""
      fi
    fi

    entry+="
    }"

    if [ $total_count -gt 0 ]; then
      printf ',\n%s' "$entry" >> "$ENTRIES_FILE"
    else
      printf '%s' "$entry" >> "$ENTRIES_FILE"
    fi
    total_count=$((total_count + 1))
    local_count=$((local_count + 1))

    # Build backward-compat skill entry (without "type" field)
    if [ "$ext_type" = "skill" ]; then
      local skill_entry="    {
      \"name\": \"$(json_escape "$name")\",
      \"description\": \"$(json_escape "$description")\",
      \"tags\": $tags,
      \"author\": \"$(json_escape "$author")\",
      \"version\": \"$(json_escape "$version")\",
      \"scope\": \"$(json_escape "$scope")\",
      \"platforms\": $platforms_json,
      \"path\": \"$ext_dir\",
      \"files\": $files_json,
      \"dependencies\": $dependencies
    }"

      local skill_idx=$((local_count - 1))
      if [ $skill_idx -gt 0 ]; then
        printf ',\n%s' "$skill_entry" >> "$SKILL_ENTRIES_FILE"
      else
        printf '%s' "$skill_entry" >> "$SKILL_ENTRIES_FILE"
      fi
    fi

    # Record tag->extension mappings
    local tag_list
    tag_list="$(echo "$tags" | sed 's/^\[//;s/\]$//;s/","/ /g;s/"//g')"
    for tag in $tag_list; do
      tag="$(echo "$tag" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [ -z "$tag" ] && continue
      printf '%s\t%s:%s\n' "$tag" "$ext_type" "$name" >> "$TAG_FILE"
    done
  done

  # Update global counts
  case "$ext_type" in
    skill)   skill_count=$local_count ;;
    agent)   agent_count=$local_count ;;
    command) command_count=$local_count ;;
  esac
}

# Parse all extension types
parse_extensions "skill"   "skills/*/SKILL.md"     "global"
parse_extensions "agent"   "agents/*/AGENT.md"     "global"
parse_extensions "command" "commands/*/COMMAND.md"  "project"

# Build tags_index JSON from TAG_FILE
tags_index_json=""
first_tag=true

if [ -s "$TAG_FILE" ]; then
  sorted_tags="$(cut -f1 "$TAG_FILE" | sort -u)"

  while IFS= read -r tag; do
    [ -z "$tag" ] && continue

    if [ "$first_tag" = true ]; then
      first_tag=false
    else
      tags_index_json+=","$'\n'
    fi

    names_json="["
    first_name=true
    while IFS= read -r ext_ref; do
      if [ "$first_name" = true ]; then
        first_name=false
      else
        names_json+=","
      fi
      names_json+="\"$(json_escape "$ext_ref")\""
    done < <(awk -F'\t' -v t="$tag" '$1==t{print $2}' "$TAG_FILE" | sort -u)
    names_json+="]"

    tags_index_json+="    \"$(json_escape "$tag")\": $names_json"
  done <<< "$sorted_tags"
fi

# Read entries
extensions_json=""
if [ -s "$ENTRIES_FILE" ]; then
  extensions_json="$(cat "$ENTRIES_FILE")"
fi

skills_compat_json=""
if [ -s "$SKILL_ENTRIES_FILE" ]; then
  skills_compat_json="$(cat "$SKILL_ENTRIES_FILE")"
fi

# Write catalog.json (v3 format with backward compatibility)
cat > "$CATALOG" <<EOFCAT
{
  "version": 3,
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "counts": {
    "skill": $skill_count,
    "agent": $agent_count,
    "command": $command_count,
    "total": $total_count
  },
  "extensions": [
$extensions_json
  ],
  "tags_index": {
$tags_index_json
  },
  "skills": [
$skills_compat_json
  ],
  "skills_count": $skill_count
}
EOFCAT

echo "Generated $CATALOG with $total_count extension(s): $skill_count skill(s), $agent_count agent(s), $command_count command(s)."
