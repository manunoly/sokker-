---
name: executing-plans
description: Execute an approved, multi-step Sokker++ implementation plan in the current session, keeping task progress and verification evidence. Use only when the owner has asked to implement the plan.
---

# Executing Plans for Sokker++

This is the local Codex adaptation of [Superpowers executing-plans](references/upstream-SKILL.md). The upstream version assumes other Superpowers skills, Bash helpers, per-task commits, and subagent reviews. Those are not prerequisites here. Follow [the repository workflow](../../../docs/WORKFLOW.md) and `AGENTS.md` when they differ.

## Start

1. Confirm that the owner has asked for implementation. A request to research, brainstorm, write a spec, or write a plan does not authorize feature code.
2. Read the approved plan, its spec, `AGENTS.md`, and the relevant source. Check `git status` and preserve existing work.
3. Identify the first unfinished task and the checks it requires. For work spanning sessions, record the plan path, completed tasks, decisions, changed files, and verification results in the plan or a separate progress note beside it.

## Work through the plan

- Complete tasks in dependency order. Keep each task within its stated scope and acceptance criteria.
- Use the project's existing patterns. Add a focused test when it proves behavior or guards a real regression; observe failure before the fix when practical. Documentation-only and other low-impact edits need direct inspection and a diff check.
- Run the task's relevant commands and read their output before marking it complete. Diagnose unexpected failures at the root cause. Record any material departure from the plan and why it was necessary.
- Continue through authorized tasks without routine confirmation. Ask only when missing information materially changes the result or an action needs authorization under the repository rules.

## Finish

- Run the repository-required checks for the changed scope and use `verification-before-completion` before claiming success.
- Review material code changes with `code-review-and-quality`; resolve issues introduced by this work and report remaining limitations.
- Report the tasks completed, actual checks and results, decisions made, and unfinished work. Commit, push, open a PR, merge, publish, or deploy only when the owner asks.

The preserved upstream text and scripts under `references/` document provenance. Do not run those scripts: they require Superpowers components that are not installed in this repository.
