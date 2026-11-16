# OGTB Donation Map — Phase 9 Full Frontend QA Report

**Date:** 2026-11-15 (Asia/Bangkok)
**Workspace:** `server-side` on `macmini`
**Active Plan:** OGTB Donation Map — Full Dark UI Redesign
**Scope:** QA and evidence capture ONLY; frontend/backend application code, DB schema, existing data, .env and API contracts were not changed in this phase.

## Executive result

**Mock-based browser and safe unit checks passed.** Thai-font screenshot verification and full database-connected integration E2E remain **unverified**, not passed.

| Verification | Executed | Result |
|---|---:|---|
| Cross-route responsive/browser sweep (14 route templates × Desktop 1440×900 / Tablet 820×1180 / Mobile 390×844) | 42 | **42 PASS** |
| Regression Phase 2 shell | 7 | **7 PASS** |
| Regression Phase 3 map | 8 | **8 PASS** |
| Regression Phase 4 auth | 13 | **13 PASS** |
| Regression Phase 5 donation editor | 15 | **15 PASS** |
| Regression Phase 6 detail/report | 21 | **21 PASS** |
| Regression Phase 7 navigation | 19 | **19 PASS** |
| Regression Phase 8 admin | 27 | **27 PASS** |
| Additional keyboard/focus/accessibility targeted checks | 9 | **9 PASS** |
| Frontend unit tests (`npm test`) | 17 | **17 PASS** |
| Backend safe no-database-write tests (`node --test tests/date.test.js tests/security-http.test.js`) | 9 | **9 PASS** |
| Frontend ESLint (`npm run lint`) | — | **PASS** |
| Frontend Next.js production build (`npm run build`) | — | **PASS** |

**Playwright CLI combined: 161/161 PASS** (42 route sweep + 110 previous regression cases + 9 keyboard/accessibility).

The plan mentions “15 routes”, but the current Next.js app has **14 actual page route templates plus the shared root layout**; all 14 page templates were swept at all three breakpoints.

## Cross-route matrix

All routes listed here passed at Desktop, Tablet and Mobile in the isolated mock browser:

1. `/` (home map)
2. `/login`
3. `/register`
4. `/donations/new`
5. `/donations/[id]`
6. `/donations/[id]/edit`
7. `/donations/[id]/navigate`
8. `/donations/[id]/report`
9. `/admin`
10. `/admin/users`
11. `/admin/donations`
12. `/admin/donations/[id]`
13. `/admin/reports`
14. `/admin/reports/[id]`

Each scenario checked rendered target content, `lang=th`, page-level horizontal overflow, uncaught JavaScript errors, unexpected mutations during read-only page entry, interactive controls without a computable label, viewport-horizontal clipping and visible actionable element centers obstructed by unrelated elements. All 42 scenarios passed these assertions. This is an automated heuristic scan, **not a complete WCAG audit**.

The mobile/tablet home map deliberately collapses results in a bottom sheet. The first test script incorrectly expected the hidden card to be visible on initial load (40/42); this was corrected to expand the sheet and confirm card visibility, and the rerun was **42/42**. No application code needed modification.

## Functional and interaction coverage

Previously built mock-only regression suites P2–P8 cover auth states/redirects, map GPS permission and failures, nearby category/radius and query restoration, donation create/edit ownership and image upload failure/retry without duplicate POST/PATCH, detail status restrictions, gallery/lightbox, report reason/submit/retry/session expiration, navigation GPS/OSRM errors/start-stop/off-route recovery, Admin role redirect, user suspend/reactivate, donation hide/delete, report resolution and related moderation actions.

New Phase 9 interaction checks passed:

- Public mobile menu Escape closes and returns focus to trigger; scroll lock is released.
- Login field keyboard `:focus-visible` and password reveal toggling through Space.
- Registration confirm-password mismatch is announced in an alert with `aria-invalid`.
- Donation location-picker Escape closes the dialog, restores focus and unlocks scrolling.
- Donation gallery responds to ArrowRight and Escape and restores focus.
- Report reason native radio buttons respond to Space and ArrowDown.
- Admin destructive confirmation Escape closes without sending a mutation.
- Navigation route sheet responds to keyboard Space/Enter and updates `aria-expanded`.
- Semantic dark-theme text/color pair contrast: all **9 tested combinations ≥ 4.5:1** (minimum tested ~**5.01:1**).

Existing tests also verified navigation ETA/distance, responsive sheets, error/retry, and moderator action states. Frontend/backend APIs were mocked: these browser results do **not** prove production database writes or live OSRM availability.

## Observations / limitations to carry into Phase 10

**F1 — Thai glyphs missing in Macmini Chromium QA environment (environment blocker; medium).**
- `fc-list :lang=th family` returned no Thai-capable installed font; `fc-match "Noto Sans Thai"` fell back to `DejaVu Sans`.
- Browser screenshots display Thai prose as tofu glyphs (squares) despite DOM strings being correct and layout geometry tests passing.
- **Next action:** install an appropriate Thai font in the QA environment or provide a licensed, properly bundled Thai web font. Re-run Desktop/Tablet/Mobile screenshots to verify line breaks, wrapping, character widths and UI text legibility. Do not modify backend. Until then Thai typography is **NOT VERIFIED**.

**F2 — Leaflet map attribution links have very small measured clickable text bounds (low; manual review).**
- The 42-case sweep found **3** instances on navigation screens, around **30–34 px wide × 7–9 px high**.
- Attribution is required. Determine whether WCAG 2.5.8 inline-link/spacing exceptions apply; improve safe padding/spacing without obscuring copyright attribution or the map if necessary.
- Other audited actionable controls did not appear clipped, blocked or unnamed.

**F3 — Full database-connected backend/E2E suite was intentionally NOT executed (verification gap; medium).**
- `frontend/playwright.config.js` uses `global-setup.js` / `global-teardown.js`, which invokes fixture creation/cleanup inside a running Docker backend.
- Several backend tests directly create/change/delete Prisma records.
- No verified disposable isolated test database was provided. Running these against an unknown or live database could mutate real records.
- **Next action:** verify or provision a strictly isolated disposable DB, then run `npm run test:e2e` on a designated test stack and `backend/npm test`, with fixture-only data and cleanup. This is a QA-environment recommendation, not an approved backend/data change.

**F4 — Live third-party routing/GPS cannot be certified from mock cases alone (verification gap; medium).**
- OSRM, GPS, retry/off-route behavior was validated through controlled mocked routes/geolocation. Actual device GPS accuracy, browser permission prompts, real OSRM service reliability and network production endpoints still require isolated browser/device integration testing.
- A navigation screenshot captured immediately had temporarily blank background tiles; a delayed check found **12/12 OpenStreetMap tiles loaded** successfully and produced a complete map image (`navigation-mobile-delayed.png`). This is screenshot timing; not a reproduced navigation defect.

**F5 — Accessibility evidence scope (low; follow-up).**
- Keyboard/focus scenarios, labels and selected theme contrast combinations passed.
- An automated accessibility tree/axe audit, screen-reader session, 200%/400% zoom/reflow audit, and full rendered-color contrast scan across every state were not performed. Add these in a reproducible environment, particularly after Thai fonts are present.

## Evidence and commands

Run from `frontend/` against an isolated Next.js instance (the QA run used `127.0.0.1:3106`):

```bash
npm run lint
npm test
npm run build
node e2e/phase9-route-accessibility-audit.mjs http://127.0.0.1:3106
node e2e/phase9-keyboard-accessibility-qa.mjs http://127.0.0.1:3106
node e2e/phase2-shell-visual-qa.mjs http://127.0.0.1:3106
node e2e/phase3-map-visual-qa.mjs http://127.0.0.1:3106
node e2e/phase4-auth-visual-qa.mjs http://127.0.0.1:3106
node e2e/phase5-donation-editor-qa.mjs http://127.0.0.1:3106
node e2e/phase6-detail-report-qa.mjs http://127.0.0.1:3106
node e2e/phase7-navigation-visual-qa.mjs http://127.0.0.1:3106
node e2e/phase8-admin-visual-qa.mjs http://127.0.0.1:3106
```

Safe backend subset (no database fixture mutation):
```bash
cd backend
node --test tests/date.test.js tests/security-http.test.js
```

Artifacts:
- `frontend/playwright-report/phase9-full-audit/route-audit.json` — complete sweep per route/viewport
- `frontend/playwright-report/phase9-full-audit/keyboard-a11y.json`
- `frontend/playwright-report/phase9-full-audit/regressions.json`
- `frontend/playwright-report/phase9-full-audit/*.png` — screenshots of all route/viewport states and delayed navigation tiles
- `frontend/playwright-report/phase9-full-audit/*.log` — run logs
- Each existing Phase 2–8 `playwright-report/` directory contains additional screenshots.

## Scope and disposition

- **Phase 9:** QA execution and findings documented.
- **Phase 10:** resolve verified frontend/environment usability issues and close verification gaps where isolated test infrastructure exists. Keep backend proposals separate and unimplemented absent explicit approval.
- No app-side modifications, backend changes, Prisma migrations, fixture setup/cleanup, or production deploy were authorized or performed by Phase 9.
