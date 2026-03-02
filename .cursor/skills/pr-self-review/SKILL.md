---
name: pr-self-review
description: Independent self-review of PR changes delegated to a subagent for reduced bias. Produces a structured review report covering CI, correctness, consistency, completeness, risks, and suggestions. Use after triage and audits, before addressing external feedback.
---

# PR Self-Review

> Throughout this skill:
>
> - `<number>` refers to the PR number.
> - `<base>` refers to the PR's target branch (from `gh pr view --json baseRefName`). Do not assume `main`.
> - `<branch-name>` refers to the PR's head branch (from `gh pr view --json headRefName`).
> - `<repo-path>` refers to the absolute path of the local repository checkout.

## Purpose

Perform an independent review of all changes on the branch. This applies to every PR regardless of type (dependency, feature, refactor, bugfix). The review is delegated to a subagent to reduce confirmation bias.

## Step 1: Delegate the review

Launch a subagent that assesses the changes fresh. Do **not** set `readonly: true` — the subagent needs shell access for `git` and `gh` commands. The prompt itself constrains the subagent to read-only operations.

```
Launch a Task (subagent_type: "generalPurpose") with a prompt like:

"You are a code reviewer. Do NOT modify any files — only read files and run
read-only shell commands (git diff, git log, gh pr view, etc.).

Review the changes on branch <branch-name> compared to origin/<base> in <repo-path>.

Run these commands to understand the changes:
  git diff origin/<base>...HEAD
  git log --oneline origin/<base>..HEAD

Check CI status for the PR:
  gh pr view <number> --json statusCheckRollup
If any checks failed, investigate the failure details and include them in the report.

Produce a structured review report covering:
1. Summary of changes (what the PR does)
2. CI status — pass/fail for each check, with failure analysis if any
3. Correctness — any bugs, logic errors, or edge cases missed
4. Consistency — do the changes follow existing codebase patterns
5. Completeness — is anything missing (e.g., tests, docs, migration steps)
6. Risks — anything that could break in production
7. Suggestions — improvements that would elevate the quality

Format the report as markdown. Be specific: reference files, line numbers, and concrete examples."
```

## Step 2: Present the report

Show the subagent's review report to the user in full before making any changes.

## Step 3: Address every finding

Fix each issue identified in the report:

- One granular commit per fix (per `.cursor/skills/pr-feedback/SKILL.md` commit guidelines).
- Always opt for the best, most elegant solution. Avoid over-engineering — prefer the simplest change that fully solves the problem.
- Run the verification suite after fixes to confirm nothing regressed.
