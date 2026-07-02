# Smriti

The working agreement for editing this repo lives in **@AGENTS.md** — read it before changing anything.

Two rules there are mandatory on **every** change and easy to forget:

1. **Keep docs in sync** — after any file/structure/command/reference change, reconcile
   `AGENTS.md` / `CLAUDE.md` / `README.md` / `app.json` with the code via a `general-purpose`
   subagent scoped to what you touched. The change isn't done until the docs match.
2. **Prevent code rot** — spin up a second `general-purpose` subagent to remove what your change
   made redundant (orphaned files, dead exports, superseded logic, stale config). Gate on
   `npx tsc --noEmit` + `npx expo lint` + `npm test` — there is **no `npm run build`** in this project.

Skip either pass only when it genuinely doesn't apply (docs all still true / purely additive change).
Full architecture, invariants, the USDA seed pipeline, and both checklists are in AGENTS.md below.

@AGENTS.md
