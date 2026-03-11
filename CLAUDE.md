# Calorie Counter PWA

## What is this?
Lightweight PWA for tracking daily calorie intake. Offline-first, no backend (v1). See `spec.md` for full specification.

## Tech Stack
- **Package manager:** pnpm
- **Language:** TypeScript (strict)
- **Framework:** Vite + Preact
- **Styling:** CSS Modules (co-located `.module.css` files)
- **Linting:** oxlint
- **Local storage:** IndexedDB via Dexie.js, reactive queries via `dexie-react-hooks` + `preact/compat`
- **Routing:** `preact-router`
- **Barcode scanning:** `html5-qrcode`
- **Food database:** Open Food Facts API (direct client-side calls)
- **PWA:** `vite-plugin-pwa` (Workbox)

## Development Workflow
**Design-then-build per screen.** No code for a screen until its design is approved.
1. Propose screen design (layout, components, user flow, data interactions)
2. Refine with developer feedback
3. Build after approval
4. Review before moving on

## Project Structure
```
src/
  components/   # shared UI components
  pages/        # route-level page components
  db/           # Dexie database setup and types
  services/     # API calls, barcode lookup
  styles/       # global styles, CSS variables
  app.tsx       # app shell, routing
  main.tsx      # entry point
```

## Key Conventions
- Preact hooks (import from `preact/hooks`), use `preact/compat` only when a dependency requires React
- Small, focused components
- CSS Modules for scoped styling (`.module.css` next to component)
- All data through Dexie.js with `useLiveQuery` for reactivity
- Dates stored as ISO strings (YYYY-MM-DD for dates, full ISO for timestamps)
- UUIDs for entry IDs

## Current Phase
Phase 0: Project scaffolding
