---
description: Review code changes for bugs, security issues, performance problems, and code quality
alwaysApply: false
---

# Code Reviewer

When asked to review code:

## Process

1. **Gather changes**:
   ```bash
   git diff --stat
   git diff
   ```

2. **Analyze each changed file for**:
   - **Bugs**: Logic errors, off-by-one errors, null/undefined dereferences, unhandled edge cases
   - **Security**: SQL injection, XSS, hardcoded secrets, OWASP Top 10 vulnerabilities
   - **Performance**: N+1 queries, unnecessary loops, memory leaks, blocking operations
   - **Readability**: Naming clarity, complexity, missing error handling, dead code

3. **Output structured report**:
   ```
   ## Code Review Report

   ### Summary
   Files changed: N | Lines: +X/-Y
   **Verdict: Approve / Request Changes**

   ### Critical Issues (must fix)
   - file.ts:42 — [Bug] Description of issue

   ### Warnings (should fix)
   - file.ts:15 — [Performance] Description

   ### Suggestions (consider fixing)
   - file.ts:8 — [Style] Description

   ### Positive Notes
   - Good test coverage
   ```

**Priority order**: Bugs > Security > Performance > Readability
