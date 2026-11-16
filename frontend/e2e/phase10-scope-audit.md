# OGTB Donation Map — Phase 10 Regression Fixes & Scope Audit

**Date:** 2026-11-16 (Asia/Bangkok)
**Workspace:** `server-side` on `macmini`
**Plan:** P10 — Regression Fixes & Scope Audit
**Contract:** Frontend/UI fixes only. Backend, Prisma/database, environment secrets, API contracts and production records are unchanged.

## Executive result

**P10 frontend fixes completed and browser regressions pass on a separately launched production-build QA server.**

### Frontend fixes

| Finding | Status | Implementation | Evidence |
|---|---|---|---|
| F1 Thai glyphs appear as tofu squares in Macmini Chromium | **FIXED** | Added official self-hosted **Noto Sans Thai variable** font and SIL OFL license under `frontend/public/fonts/`. Loaded in `design-system-dark.css` and prioritized before system fonts, including Navigation. | Chrome DevTools `CSS.getPlatformFontsForNode` verifies real Noto Sans Thai glyph selection on Login, Register, Donation, Navigation, Admin and Report (7/7). Screenshots show legible text. |
| F1b Leaflet tooltip uses its separate Helvetica/Arial fallback, causing Thai location labels to be boxes even after the general font fix | **FIXED** | Explicit Thai font stack on Leaflet map canvases, popups and tooltips; replaced incompatible `font` shorthand in `navigation-v2.css`. | Navigation screenshots show `จุดรับของ` and `ตำแหน่งฉัน`; CDP verifies actual Noto Sans Thai used for every rendered navigation tooltip. |
| F2 Map attribution links have tiny click areas | **FIXED** | Expanded visible Leaflet attribution link targets with minimum **36px × 28px** bounds while preserving attribution, destination links and keyboard focus. | Target checks in Reflow and Font QA passed. |
| F2b Small breadcrumb links in Donation Editor / Admin Report Detail | **FIXED** | Expanded breadcrumb hit areas to minimum **36px × 34px** with responsive layout preserved. | Reflow rerun: **zero undersized actionable targets** in 28 scenarios and 7/7 targeted checks. |

Self-hosted font source: Google Fonts `ofl/notosansthai/NotoSansThai[wdth,wght].ttf`, under the SIL Open Font License, with license at `frontend/public/fonts/OFL.txt`. Font file SHA-256 verified at download as `5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8`. The Thai language font is served by the frontend rather than requiring fonts installed on the host OS.

### Full post-fix test matrix

| Test | Result |
|---|---:|
| P2 Shell/Navigation regressions | 7 / 7 PASS |
| P3 Home Map regressions | 8 / 8 PASS |
| P4 Login/Register regressions | 13 / 13 PASS |
| P5 Donation Form/Picker regressions | 15 / 15 PASS |
| P6 Donation Detail/Report regressions | 21 / 21 PASS |
| P7 Navigation/GPS/OSRM-mock regressions | 19 / 19 PASS |
| P8 Admin regressions | 27 / 27 PASS |
| P9 Full route sweep (14 page templates × 1440, 820, 390px) | 42 / 42 PASS |
| P9 Keyboard/Focus targeted audit | 9 / 9 PASS |
| P10 font/reflow 14 templates × 320 and 640px | 28 / 28 PASS |
| P10 actual Chromium Thai glyph and touch target assertions | 7 / 7 PASS |
| **Total mocked browser tests** | **196 / 196 PASS** |
| Frontend node unit tests | 17 / 17 PASS |
| Frontend ESLint / Next.js production build | PASS / PASS |
| Previously executed safe backend date/security tests (P9) | 9 / 9 PASS |

The P10 reflow report measured **0** horizontally overflowing viewports, **0** unnamed actionable controls, **0** clipped actionable controls, **0** blocked centers and **0** undersized controls in the 28 checked scenarios. Thai font faces were loaded in **28/28** scenarios. Browser screenshots are in `frontend/playwright-report/phase10-fixes/`; per-test JSON reports are `reflow-route-audit.json` and `font-a11y.json`.

All browser workflows above use **Mock API** responses; these results do not establish full live-system E2E correctness.

## Source-of-truth project scope audit

Primary spec: `server-side-project-system.md`. There are **14 actual page route templates + shared root layout** (the plan's “15 routes” counts the root layout as a view), verified against Next.js build route inventory.

| Spec module | Present frontend/contract evidence | QA outcome |
|---|---|---|
| Authentication; Register, Login, Logout, session and USER/ADMIN roles | `/login`, `/register`, `components/common/SiteHeader.js`, `lib/useAuth.js`; backend `auth.routes.js` has register/login/logout/me | Frontend auth tests PASS; backend live DB flow not rerun |
| Fullscreen location Map; nearby markers, popup/detail, radius | `/`, `components/map/HomeMapClient.js`, `DonationMap.js`, `RadiusFilter.js`, `CategoryFilter.js`; `donation.routes.js` GET `/nearby` | P3 and reflow PASS |
| Donation details and owner CRUD, images and Bangkok date window | `/donations/new`, `/donations/[id]`, `/donations/[id]/edit`; `DonationForm.js`, `DonationGallery.js`, `lib/donationActions.js`, `lib/date.js` | P5/P6, unit image retry and date tests PASS |
| AVAILABLE vs OUT_OF_STOCK/EXPIRED, availability restrictions | `lib/donationAvailability.js` enforces status, hidden flag and start/end bounds; `DonationConfirmDialog.js` supports owner status transition | P6/P7/unit PASS |
| Nearby category and distance filter | `CategoryFilter.js`, `RadiusFilter.js` and `HomeMapClient.js`; backend GET `/nearby` contract exists | P3 PASS |
| Map route instructions, GPS, OSRM distance and ETA | `/donations/[id]/navigate`, `NavigationMap.js`, `NavigationStepList.js`; backend `route.routes.js` GET `/` mounted as `/api/routes` | P7 mock route/off-route/permission cases PASS; actual device/OSRM not certified |
| Report reasons, details and submission | `/donations/[id]/report`; backend `report.routes.js` POST `/:donationId/reports` | P6 mock report/session/error/retry PASS |
| Admin Dashboard; Users, Donations and Reports; hide, delete, suspend, resolve | `/admin`, `/admin/users`, `/admin/donations`, `/admin/donations/[id]`, `/admin/reports`, `/admin/reports/[id]`; `AdminNav.js`, `components/admin/AdminUI.js`; backend `admin.routes.js` protected by `requireAuth` + `requireAdmin` | P8 role, data, moderation action mocks PASS; backend contracts present |

No new Reservation, Claim, Chat, Pickup Confirmation, sales/checkout or other out-of-scope features were added.

## Remaining verification limits / backend recommendations

- **Disposable DB integration tests — NOT RUN.** Existing full Playwright E2E global setup and backend suite create/delete Prisma fixtures. A verified isolated database was not available. To safely verify the entire production-backed flow, use a **dedicated disposable test database**, distinct from production or user data, and explicitly configure fixtures and cleanup against that database only. **Do not run the destructive suite on the existing unknown database**.
- **Physical GPS and live OSRM end-to-end — NOT CERTIFIED.** Mocked geolocation and routing pass; real device accuracy, permission prompts and provider reliability require separate testing on an approved test deployment.
- **Comprehensive accessibility certification — NOT CLAIMED.** The targeted keyboard, focus, touch-target, semantic color contrast and reflow checks pass; manual screen reader checks, 200%/400% browser zoom and full WCAG audit remain recommended.
- **Backend code change proposal:** None required for the Dark UI fixes based on the current evidence. The isolated test database is a **test infrastructure precondition**, not a backend API change. Any future backend recommendation requires separate approval.

## Reproduction

From `frontend/`, start a local disposable Next.js production-build QA server on an unused port and run:

```bash
npm run lint
npm test
npm run build
node e2e/phase10-font-render-qa.mjs http://127.0.0.1:3107
node e2e/phase10-reflow-qa.mjs http://127.0.0.1:3107
node e2e/phase9-route-accessibility-audit.mjs http://127.0.0.1:3107
node e2e/phase9-keyboard-accessibility-qa.mjs http://127.0.0.1:3107
# Plus Phase2–Phase8 CLI suites for full 196-case regression coverage.
```

The QA server was launched on Macmini loopback port `3107`, not an application production port. No live user data or backend files were modified; the QA server is stopped after verification.

**Phase 10 disposition:** Completed frontend fixes, regression checks and project spec audit. Next phase: P11 — Review diff. Do not begin P11 implementation or final close without a new user request.
