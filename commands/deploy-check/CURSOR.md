---
description: Check if the project is ready for deployment by running tests, lint, build, and environment validation
alwaysApply: false
---

# Deploy Check

When the user invokes `/deploy-check` or asks to check deployment readiness:

## Process

1. **Detect tech stack** from project files:
   - `package.json` → Node.js/npm
   - `requirements.txt` or `pyproject.toml` → Python
   - `go.mod` → Go
   - `Cargo.toml` → Rust

2. **Run checks** based on stack:
   | Check | Node.js | Python | Go | Rust |
   |-------|---------|--------|-----|------|
   | Tests | `npm test` | `pytest` | `go test ./...` | `cargo test` |
   | Lint | `npm run lint` | `flake8` | `golangci-lint` | `cargo clippy` |
   | Build | `npm run build` | — | `go build ./...` | `cargo build` |
   | Types | `tsc --noEmit` | `mypy` | — | — |

3. **Environment check**:
   - Compare `.env.example` with `.env` for missing variables
   - Warn about any obviously sensitive variables being exposed

4. **Git state check**:
   - Uncommitted changes?
   - Current branch (warn if not main/master for production deploy)
   - Synced with remote?

5. **Output deployment report**:
   ```
   ## Deployment Readiness Check

   | Check       | Status | Details          |
   |-------------|--------|------------------|
   | Tests       | ✅ PASS | 42 passed, 0 failed |
   | Lint        | ✅ PASS | No issues        |
   | Build       | ✅ PASS | Built in 12.3s   |
   | Environment | ⚠️ WARN | Missing: DATABASE_URL |
   | Git State   | ✅ PASS | Clean, on main   |

   **Verdict: ✅ Ready to deploy** / **❌ Not ready — fix N issue(s)**
   ```
