---
name: dependency-audit
description: Audit dependency updates for breaking changes, deprecations, and ecosystem compatibility. Use when reviewing dependency update PRs, verifying version bumps, or checking if a dependency upgrade requires codebase changes.
---

# Dependency Audit

> Throughout this skill, `<package-name>` refers to the npm package being audited (e.g., `tailwindcss`, `@tanstack/react-router`).

## Step 1: Version check

Compare three things in parallel:

```bash
# What's in the PR / on the branch (resolved version from lockfile)
pnpm list <package-name>

# What's the latest on npm
npm view <package-name> version

# What the PR was originally targeting (from PR description / linked issue)
```

**Semver range vs resolved version:** `package.json` may declare `^4.2.0` while the lockfile resolves to `4.2.1`. Always check the actual resolved version via `pnpm list`, not just the range in `package.json`.

If the latest version is newer than what the PR targets, update to the latest.

## Step 2: Changelog review

Check the release notes for every minor/major version between the old and new version. Use multiple sources:

1. **Web search** for "<package> <version> release notes" or "<package> changelog <year>"
2. **GitHub releases page**: `https://github.com/<org>/<repo>/releases/tag/v<version>`
3. **CHANGELOG.md** in the repo: `https://github.com/<org>/<repo>/blob/main/CHANGELOG.md`

Focus on:

- **Breaking changes** — API removals, behavior changes
- **Deprecations** — utilities, APIs, or patterns being phased out
- **New features** — anything the codebase could or should adopt

## Step 3: Codebase audit

Search the codebase for usage of anything deprecated or changed:

```bash
# Example: Tailwind 4.2 deprecated start-*/end-* positioning utilities
# App and config sources (respects .gitignore / default ignores)
rg '\bstart-\d|\bend-\d' --glob '*.{tsx,ts,css}'

# Third-party CSS in node_modules (ignored by default, needs -uuu)
rg '\bstart-\d|\bend-\d' node_modules/<package>/dist/ -uuu --glob '*.css'
```

Check all layers:

- Application code (`src/`)
- CSS files and theme configuration
- Third-party component CSS in `node_modules/` (requires `rg -uuu` to bypass default ignores)
- Test files

## Step 4: Ecosystem compatibility

Dependencies often form ecosystems. Verify compatibility across related packages:

| Ecosystem    | Check                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Tailwind CSS | `tailwindcss` ↔ `@tailwindcss/vite` ↔ `tailwind-merge` ↔ `tw-animate-css` ↔ `shadcn` CSS                 |
| TanStack     | `@tanstack/react-router` ↔ `react-start` ↔ `router-plugin` ↔ `devtools-vite` ↔ `react-router-with-query` |
| Playwright   | `@playwright/test` ↔ `playwright` ↔ Docker image tag in `docker-compose.test.yml`                        |
| TypeScript   | `typescript` ↔ `@types/node` (must match Node.js runtime version in `.nvmrc` / `engines`)                |

## Step 5: Security check

```bash
pnpm audit --prod
```

Flag any new vulnerabilities introduced by the update.

## Step 6: Build and test

Run the verification suite (see `pr-workflow.mdc`).

For visual regression tests:

- Docker uses the Playwright image specified in `docker-compose.test.yml`
- Tests that require authentication (dashboard, expense-form) need the Convex backend via `.env.e2e`
- Public page tests (landing, sign-in, sign-up, forgot-password) and auth-validation tests work without backend
- If screenshots need updating: `pnpm test:visual:docker:update`

## Step 7: Summarize findings

Present results as a verification table:

```markdown
| Check             | Result                                      |
| ----------------- | ------------------------------------------- |
| Latest version    | `package` X.Y.Z — already on base / updated |
| Deprecated APIs   | None found / Migrated `old` → `new`         |
| Security audit    | Clean / N vulnerabilities (details)         |
| Lint              | Clean — no errors                           |
| Build             | Clean — no warnings                         |
| Unit tests        | N/N passed                                  |
| Visual regression | N/N passed — no pixel differences           |
| Ecosystem compat  | `related-pkg` vX.Y — compatible             |
```
