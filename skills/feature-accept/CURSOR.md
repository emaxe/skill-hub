---
description: Accept and merge a completed feature branch, clean up artifacts
alwaysApply: false
---

# Feature Accept

When the user wants to accept, finish, or merge a feature:

## Process

1. **Read feature context**: Check `docs/features/{slug}/README.md` for target branch info
2. **Validate**: Run tests to ensure everything passes
3. **Merge**: Merge feature branch into target branch
   ```bash
   git checkout {target-branch}
   git merge --no-ff feat/{slug} -m "feat: merge {slug}"
   ```
4. **Clean up**:
   - Delete feature branch: `git branch -d feat/{slug}`
   - Optionally remove `docs/features/{slug}/` if user confirms
5. **Close tickets**: If Jira/GitHub issues mentioned, close them

## Safety

- Always confirm the target branch before merging
- Run tests before merge
- Ask before deleting documentation artifacts
