---
name: pr-feedback
description: Address PR review feedback with granular commits, push changes, and update the PR description. Use when a PR has review comments to address, or when finalizing a PR for merge.
---

# PR Feedback

> Throughout this skill, `<base>` refers to the PR's target branch (from `gh pr view --json baseRefName`). Do not assume `main`.

## Step 1: Understand the feedback

Gather all review comments and CI feedback:

```bash
# Review comments (inline on diffs)
gh api repos/{owner}/{repo}/pulls/{number}/comments

# PR review summaries
gh pr view <number> --json reviews

# General PR conversation comments
gh pr view <number> --json comments

# CI check details
gh pr view <number> --json statusCheckRollup
```

Categorize each piece of feedback:

- **Must fix** — blocking issues, bugs, CI failures
- **Should address** — valid suggestions that improve quality
- **Won't fix** — present the trade-off to the user and ask for their decision before pushing back on the reviewer

**Before acting on any comment, assess whether it is still valid:**

- Check if the issue was already fixed by a subsequent commit (e.g., from the self-review step).
- Re-read the comment against the current state of the code, not the state when it was written.
- Evaluate the suggestion on its merits — reviewers can be wrong. If a suggestion would degrade quality or introduce unnecessary complexity, **present the trade-off to the user and ask for their decision** before responding to the reviewer.

## Step 2: Make granular commits

Each logical change gets its own commit. Do not bundle unrelated fixes.

**Commit scoping guidelines:**

- One commit per review comment or closely related group of comments
- One commit per file-type when doing mechanical changes (e.g., "migrate deprecated utilities in all TSX files")
- Separate code changes from test updates from config changes

**Commit message format** (follow the repo's existing convention):

```
<type>(<scope>): <concise description>

<optional body explaining why, not what>
```

Common types: `fix`, `chore`, `refactor`, `test`, `docs`

Example granular commits for a dependency update PR:

```
chore(deps): update tailwindcss to 4.2.1
refactor(ui): migrate deprecated start-*/end-* utilities to inset-s-*/inset-e-*
test(visual): update baseline screenshots for Tailwind 4.2
```

## Step 3: Verify before pushing

Run the verification suite (see `pr-workflow.mdc`) to confirm nothing regressed.

```bash
git status
git log --oneline origin/<base>..HEAD
```

### Handling push failures

If `git push origin HEAD` is rejected (branch diverged):

1. Fetch and rebase: `git fetch origin <base> && git rebase origin/<base>`
2. Resolve any conflicts and continue: `git rebase --continue`
3. Re-run the verification suite after resolving.
4. Push with `--force-with-lease`: `git push --force-with-lease origin HEAD`

## Step 4: Push and update PR

```bash
git push origin HEAD
```

If the PR is a draft, mark it as ready for review:

```bash
gh pr ready <number>
```

Update the PR description if the scope changed. Use `gh pr edit`:

```bash
gh pr edit <number> --body "$(cat <<'EOF'
## Summary
- <bullet points describing what changed>

## Test plan
- [ ] `pnpm lint` — no lint errors
- [ ] `pnpm build` — clean build (includes `tsc --noEmit`)
- [ ] `pnpm test:unit` — all tests pass
- [ ] `pnpm test:visual:docker` — no visual regressions
- [ ] <other relevant checks>

Fixes #<issue-number>
EOF
)"
```

**When updating the description:**

- Reflect what the PR actually does now (not what it originally intended if scope changed)
- Keep the test plan as a checklist with concrete commands
- Reference the linked issue

## Step 5: Respond to reviewers

Reply to each addressed comment:

- If fixed: brief note on what was done (e.g., "Fixed in abc1234")
- If declined: clear explanation of why, with supporting evidence
- Do not resolve review conversations — leave that to the human reviewer or PR author.

## Step 6: Request reviews

After pushing all changes, request reviews to close the feedback loop:

```bash
# Re-request review from all previous reviewers
gh pr view <number> --json reviews --jq '[.reviews[].author.login] | unique | .[]' | while read -r reviewer; do
  gh pr edit <number> --add-reviewer "$reviewer"
done

# Request review from GitHub Copilot (if available on the repo)
gh pr edit <number> --add-reviewer "copilot" 2>/dev/null || true
```

This should be the final step of every PR iteration — not just the first pass, but also after addressing new feedback.
