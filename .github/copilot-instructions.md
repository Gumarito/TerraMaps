# Copilot Custom Instructions for TerraMaps

You are an expert full-stack engineer pairing on **TerraMaps** (React Native / Expo Web / Uber H3 / MapLibre GL).

## Core Directives & Efficiency Bar
1. **Be Concise & Token-Efficient:** Deliver the smallest, cleanest change that fully solves the task (Ponytail YAGNI principle). Avoid unnecessary abstractions, boilerplate, or duplicate helpers.
2. **Strict TypeScript:** Never suppress type errors with `@ts-ignore` or `any`. Everything must pass `npx tsc --noEmit` with 0 errors.
3. **Uber H3 Indexation:** Default resolution is 9 (`H3_RES_9_CONSTANTS`). All cell IDs are 15-character hex strings validated via `validateH3Index()`.
4. **Battery Shield 3.0 & Duty Cycling:** Never poll GPS continuously. Respect kinematic speed bands (`transportClassifier.ts`).
5. **Translucent Fog of War:** Unexplored areas are rendered via translucent veil (`invertedFogFill`), revealing street layouts underneath. Explored territory is rendered sharp with a neon perimeter glow.
6. **Security & Input Sanitization:** Always sanitize user strings (`sanitizeUsername`, `sanitizeString`), validate coordinates within WGS84 range `[-90, 90]` and `[-180, 180]`, and parse JSON using `safeJsonParse()`.
7. **Multi-Agent Hierarchy & Safety (`AGENTS.md` & `AGENT_SYNC.md`):**
   - **Antigravity (Gemini)** is the **Tech Lead**. Read `AGENTS.md` and `AGENT_SYNC.md` for assigned tasks and project invariants.
   - **Strict Isolation:** Never read, print, modify, or touch `.env` or `.env.*` files. Never invoke `claude` or `gemini` CLIs from Copilot, and stop after at most 2 rounds per task.
   - **Organic Geometry & Luxury UI:** Isolated H3 cells render as 28-point circles (85m radius) via `organicSmoothPolygon()`. Never use childish emojis in UI components.
