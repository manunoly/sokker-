# Sokker++ working flow

This document defines how work moves from an idea to a verified change in this repository. `AGENTS.md` contains standing rules; feature facts belong in their own documents. The imported skills provide methods for individual phases, while this file defines when each phase applies to Sokker++.

## Choose the depth

| Work | Approach |
| --- | --- |
| Small, clear edit | Inspect the owning files, make the focused change, verify it directly. No new spec or plan is required. |
| Bug | Reproduce, find the cause, fix it, and verify the affected behavior. Use `debugging-and-error-recovery`. |
| Significant feature or new data contract | Clarify the behavior with `brainstorming`, record a concise spec, then use `writing-plans` for an implementation plan. |
| Approved multi-step implementation | Use the local `executing-plans` adaptation to work through the plan and keep progress evidence. |

## Significant feature sequence

1. **Research and brainstorm.** Read the relevant code and dedicated documentation. Confirm the user-visible goal, data available, edge cases, and trade-offs. Keep uncertain findings marked as uncertain. `brainstorming` guides this conversation.
2. **Spec.** Save settled product decisions in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Refer to the dedicated API guide; do not copy private responses into tracked files.
3. **Plan.** Use `writing-plans` to save `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Name exact files and interfaces, order small tasks, and give each task acceptance criteria and relevant verification. Existing incomplete plans are preserved. For a feature plan, this format takes precedence over the generic `tasks/plan.md` default in `planning-and-task-breakdown`.
4. **Review the plan.** Check the plan against the spec and current code. Resolve consequential gaps before implementation. A plan is not implementation authorization by itself.
5. **Implement when requested.** Work through the plan in order with `executing-plans`. Keep project conventions, privacy rules, and the actual repository commands authoritative. Add tests for meaningful behavior and regression risks, with verification proportional to the change.
6. **Verify and review.** Use `verification-before-completion` for evidence-backed completion claims and `code-review-and-quality` for material code changes. Report any limits and outstanding decisions.

Do not create a new permission gate from a skill example or routine checkpoint. Reuse authorization the owner has already given. Do not commit, push, open a PR, merge, or deploy unless the owner requests that action. Do not automatically delegate work; a skill's mention of subagents does not change the current task's authorization.

## Current feature documentation

Use the [documentation index](../documentation/README.md) to find the current juvenile and first-team guides. The dated [juvenile design](superpowers/specs/2026-10-16-junior-talent-hover-design.md), [juvenile plan](superpowers/plans/2026-10-16-junior-talent-hover.md), and [General Skills ++ design](superpowers/specs/2026-10-16-general-skills-talent-redesign-design.md) preserve the decisions at the time; verify present behavior against the guides and source code. The optional `docs/juniors/README.md` and observed API examples in `docs/documentacion-talent/API-SOKKER.md` stay local and Git-ignored. Update the current guide when feature behavior changes; avoid rewriting historical plans to imply they describe the live UI.

## Skill selection and provenance

See [`.agents/skills/README.md`](../.agents/skills/README.md) for the installed set and upstream sources. Select only the skill needed for the current phase. The local `executing-plans` skill adapts upstream guidance to this repository; its original text is preserved beside it.
