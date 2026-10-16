# Repository skills

These skills were imported for Sokker++ on 2026-10-16 after reviewing the adoption guide in `abeduls4/docs/agent-skills-workflow.md`. Use only the skill relevant to the current task; `AGENTS.md` contains the project-specific rules.

- `context-engineering`, `code-review-and-quality`, `debugging-and-error-recovery`, `planning-and-task-breakdown`, `constraint-driven-development`, and `performance-optimization` are unchanged copies of the owner's installed Codex skills, including their MIT licenses and local reference files. The Abeduls adoption guide records upstream `addyosmani/agent-skills` revision `1401c8b8030e023baeebb31781a6653fe8e93026` and notes local reference-path and operating-profile adaptations. Preserve those adaptations when updating.
- `frontend-design` was copied from [Anthropic's official skill directory](https://github.com/anthropics/skills/tree/main/skills/frontend-design) with its Apache 2.0 `LICENSE.txt`. Its design guidance applies only within the project's existing visual language and native Canvas architecture.
- `brainstorming`, `writing-plans`, `executing-plans`, and `verification-before-completion` were imported from [obra/superpowers](https://github.com/obra/superpowers) at commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` on 2026-10-16. The upstream MIT license is preserved in `SUPERPOWERS-LICENSE.txt`.
- `brainstorming`, `writing-plans`, and `verification-before-completion` retain their upstream files. `executing-plans/SKILL.md` is adapted for this repository because upstream execution assumes other Superpowers skills and Bash helpers; its original text and scripts are preserved under `executing-plans/references/`.
- `writing-plans` is the feature-plan format used in `docs/superpowers/plans/`. Use `planning-and-task-breakdown` for general decomposition when a feature spec and detailed Superpowers plan are not called for. `docs/WORKFLOW.md` defines the phase sequence and repository-specific authorization boundaries.

Codex discovers repository skills in `.agents/skills/`. The six engineering copies were verified byte-for-byte against their installed source at import time.
