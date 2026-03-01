---
name: pr-triage
description: Systematic triage of GitHub Pull Requests — check out, rebase, assess whether superseded or stale, decide next steps, close with documentation or proceed with improvements. Use when reviewing, triaging, or assessing the current state of a PR.
---

# PR Triage

> Throughout this skill:
>
> - `<base>` refers to the PR's target branch (from `gh pr view --json baseRefName`). Do not assume `main`.
> - `<branch-name>` refers to the PR's head branch (from `gh pr view --json headRefName`).

## Step 1: Gather context

Before touching code, collect all relevant information in parallel:

```bash
# Current local state
git status && git branch --show-current

# PR metadata (title, body, files, commits, linked issues, CI status)
gh pr view <number> --json title,body,headRefName,baseRefName,state,reviews,comments,labels,files,commits,url,isDraft

# Review status and checks
gh pr view <number> --json reviewRequests,reviewDecision,statusCheckRollup

# Linked issue details
gh issue view <issue-number> --json title,body,labels,state
```

## Step 2: Check out and rebase

```bash
# Check out the PR branch (handles both same-repo and fork-based PRs)
gh pr checkout <number>

# Update base branch ref
git fetch origin <base>

# Check base branch history after fetch (to spot batch updates that may have superseded this PR)
git log --oneline -15 origin/<base>

# Rebase onto the updated base
git rebase origin/<base>
```

If the rebase conflicts, abort the rebase to return to the pre-rebase state:

```bash
git rebase --abort
```

If you need to start fresh on top of the base (e.g., the changes will be redone from scratch against a newer version), reset explicitly. This discards all local commits on the branch:

```bash
git reset --hard origin/<base>
```

After a successful rebase, force-push to update the remote branch:

```bash
git push --force-with-lease
```

## Step 3: Assess current state

Determine whether the PR's changes have already landed on the base branch (e.g., via a batch update PR). Check:

1. **Are the PR's target changes already on the base?** Compare versions, check git log for relevant commits. If `git diff origin/<base>..HEAD` is empty after rebase, the changes are fully on the base.
2. **Is there remaining work** beyond what's on the base? (e.g., the issue asks for visual regression verification, not just a version bump)
3. **Is the PR targeting the latest version?** Or has a newer version been released since?

## Step 4: Decide and act

### If superseded

The PR's changes are already on the base. Close it with a detailed comment:

1. **Explain what superseded it** — reference the PR/commit that landed the changes.
2. **Show a verification table** — compare PR targets vs actual state on base vs latest available.
3. **List verifications performed** — tests run, audits done, compatibility checked.
4. **Close the PR and linked issues** with clear context.
5. **Clean up locally** — switch back to the base branch and delete the local branch.

Comment template:

```markdown
## Superseded by #<other-pr>

This PR's scope (<summary>) was completed by <description> in #<other-pr>.

### Current state on `<base>`

| Item | PR target | On `<base>` | Latest available |
| ---- | --------- | ----------- | ---------------- |
| ...  | ...       | ...         | ...              |

### Verification performed

| Check | Result |
| ----- | ------ |
| ...   | ...    |

Closing in favor of #<other-pr>. Issue #<N> can be closed as resolved.
```

Issue closing comment template:

```markdown
Resolved via #<pr-number> (<brief description>).

<1-2 sentences summarizing what was verified.> See #<triage-pr> for the detailed audit.
```

Cleanup:

```bash
git checkout <base> && git branch -D <branch-name>
```

### If still needed

The PR has changes that aren't yet on the base branch.

1. Verify the PR targets the **latest available version** (not just what was current when it was opened).
2. Return to the orchestrator (`.cursor/rules/pr-workflow.mdc`) for the remaining steps: audit, self-review, feedback, and shipping.
