# Darzi Agent Instructions

This project uses the shared Everything Claude Code (ECC) workflow toolkit from:

`C:\Users\qasim\Documents\skills and agents`

Do not copy the full ECC repository into this app. Use the project-local links instead:

- `.agents/skills` points to the shared ECC skills catalog.
- `.codex/agents` points to the shared Codex agent role configs.
- `.codex/config.toml` enables the project-local Codex multi-agent roles and MCP baseline.

## How To Use The Shared Skills

When a task matches an ECC skill, read the matching `SKILL.md` from `.agents/skills/<skill-name>/SKILL.md` before making changes. Prefer the most specific skill that applies.

High-value skills for this app:

- `frontend-patterns` for React/Vite UI work.
- `vite-patterns` for Vite configuration and build issues.
- `tdd-workflow` when adding or changing behavior.
- `verification-loop` before calling a feature complete.
- `security-review` before handling secrets, auth, API calls, or deployment.
- `browser-qa` / Playwright checks after meaningful UI changes.
- `documentation-lookup` when library behavior may have changed.

## Darzi Project Rules

This is currently a Vite + React + TypeScript app generated from AI Studio.

Use these commands from the project root:

- Install: `npm install`
- Dev server: `npm run dev`
- Type check: `npm run lint`
- Production build: `npm run build`

Environment:

- Put Gemini credentials in `.env.local`.
- Never commit API keys, tokens, passwords, or generated secret files.
- Keep `.env.example` as documentation only.

Implementation rules:

- Keep React components focused and readable.
- Prefer existing dependencies already in `package.json`.
- Use immutable state updates.
- Validate external data at the boundary.
- Keep errors user-friendly in the UI and detailed enough for local debugging.
- Run `npm run lint` and `npm run build` after substantive code changes.

## Android Boilerplate Context

`AI_PROJECT_CONTEXT.md` is the source of truth for the Android boilerplate product direction. If generating or modifying Android/Kotlin artifacts for Darzi, follow that file's architecture:

- 100% Kotlin.
- Jetpack Compose only, no XML layouts.
- MVVM plus Clean Architecture.
- Hilt for dependency injection.
- StateFlow in ViewModels.
- `collectAsStateWithLifecycle()` in Compose UI.
- DataStore instead of SharedPreferences.
- ConsentManager before AdsManager initialization.
- Play Billing, Play Core review/update, analytics, crash reporting, and policy compliance must remain first-class concerns.

## Review And Verification

Before considering work complete:

1. Check the relevant ECC skill instructions.
2. Review the changed files for accidental secrets or unrelated edits.
3. Run the narrowest meaningful checks, normally `npm run lint` and `npm run build`.
4. For visible UI changes, run the app and inspect it in a browser.

