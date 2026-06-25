# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CKSC Legislation (`law.cksc.tw`) is the central database for the constitution, laws, orders, and official documents (公文) of the CKHS student council. It is a Quasar v2 / Vue 3 **SSR** app written in TypeScript, backed by Firebase (Firestore + Auth + Cloud Functions), with Algolia for legislation full-text search.

## Commands

Package manager is **Yarn** (`yarn.lock`, CI uses `yarn install --frozen-lockfile`), despite `npm` appearing in `engines`/predeploy.

| Task | Command |
| --- | --- |
| Dev server (SSR + HMR) | `yarn dev` (= `quasar dev -m ssr`) |
| Prod SSR build → `dist/ssr/` | `yarn build` (= `quasar build -m ssr`) |
| SPA build → `dist/spa/` | `yarn spa-build` (= `quasar build`) |
| Cloud Run build (SSR + nested install) | `yarn gcp-build` |
| Lint | `yarn lint` |
| Format (Prettier, whole repo) | `yarn format` |
| Cloud Functions build/lint | `cd functions && yarn build && yarn lint` |

- **Dev mode is SSR, not SPA** — server-side code paths run locally; do not assume browser globals are present.
- **There are no tests.** `yarn test` is a no-op (`echo "No test specified"`). The real CI gate is the build: `vite-plugin-checker` runs `vue-tsc` and `vite-plugin-eslint2` lints during `yarn build`, so a successful build *is* the typecheck + lint pass.
- Run `yarn install` (triggers `quasar prepare`) before opening in an editor — it generates `.quasar/`, including the real `tsconfig.json` and path aliases. Without it, TS is broken.

## Deployment (two artifacts, two targets — the key non-obvious thing)

A single Firebase Hosting site (`cksc-law`, domain `law.cksc.tw`) fronts **both** a static SPA and an SSR server. `firebase.json` rewrites split traffic:

- **SEO/public read routes** (`/`, `/legislation/**`, `/document/**`, `/sitemap.xml`) → Cloud Run services (`cksc-legislation` / `sitemap`, region `asia-east1`), server-rendered.
- **Everything else** → SPA fallback `dist/spa/main.html`. The merge workflow **renames `index.html` → `main.html`** specifically so the root is never served as a non-SSR page.
- The second hosting site, `cksc-legislation`, only 301-redirects to `law.cksc.tw` (legacy domain). `.firebaserc` default project is `cksc-legislation`.

CI (`.github/workflows/`):
- `firebase-hosting-merge.yml` — push to `main` (ignores `functions/**`): builds SPA + SSR, shuffles SSR assets into `dist/spa/ssr-assets`, deploys `dist/spa` to Hosting *and* builds/pushes the SSR Docker image (`Dockerfile`: `node:22-alpine`, runs `dist/ssr/index.js`) to Cloud Run.
- `firebase-hosting-pull-request.yml` — PRs: build-only smoke test, no preview deploy.
- `firebase-functions-pull-request.yml` — PRs touching `functions/**` **or `src/ts/models.ts` or `src/ts/shared-utils.ts`** (see shared contract below). Functions deploy is **manual** (`firebase deploy --only functions`).

## Architecture

Two parallel subsystems — **legislation** (法律) and **documents** (公文) — sit on a shared core data layer. For deep legislation-subsystem reference, see `src/pages/legislation/AGENTS.md` (but note its router-guard claim is stale — see Gotchas).

### The "enum class" idiom (most important convention)

Fixed enumerations are **not** TS enums or string unions. They are classes (`LegislationCategory`, `ContentType`, `DocumentType`, `DocumentGeneralIdentity`, `DocumentSpecificIdentity`, `DocumentConfidentiality`, `LegislationType`) in `src/ts/models.ts` where:
- Each member is a `static` **instance** carrying metadata (`firebase` string key, `translation` Chinese label, plus `prefix`/`code`/`icon`/`idPrefix`/`type`…).
- A `static VALUES: Record<string, Instance>` maps the `firebase` key back to the instance.

**In app code these fields hold rich instances; in Firestore only the `firebase` string is persisted.** Converters do the translation. If you add a new type/identity/category and forget to register it in the class's `VALUES`, reads rehydrate to `undefined` and rendering breaks. This is the single most common foot-gun in the codebase.

### Firestore <-> app boundary (`src/ts/model-converters.ts`)

Each collection has a `FirestoreDataConverter`. Prefer the exported helpers/composables (`legislationCollection()`, `legislationDocument(id)`, `useLegislation(id)`, `documentsCollection()`, `useSpecificDocument(id)`, `usePublicDocuments()`, `historyContentDocument(...)`, `mailingListDoc()`) over raw `collection()`/`doc()` — they apply the converter and run inside Vue setup scope.

- `toFirestore`: enum instance → `.firebase` string, `Date` → `Timestamp`, and **deletes empty/optional fields to save space** (deliberate). `convertDocumentToFirebase` **mutates its argument in place** — never pass a live reactive doc you still need.
- `fromFirestore`: `Timestamp` → `Date`, `VALUES[key]` → instance, and **re-attaches `Document.getFullId()`** (methods can't persist). Raw Firestore data built without the converter won't have `getFullId`.

Collections: `legislation/{id}` (nested `content[]`; subcollection `historyContent/{contentId}` holds clause snapshots, converter-less, keyed by `generateHistoryContentId`), `documents/{id}` (**flat; the doc ID is the full Chinese ID `建班…字第…號`**), `settings/mailingList`, `amendmentRequests/{id}` (created/deleted only by Cloud Functions via Admin SDK).

### Cloud Functions share app source (`functions/`)

Gen-2 Functions (Node 24, **CommonJS**, own ESLint/tsconfig/`yarn install` — excluded from the app build everywhere). They `import` from the app tree: **`../../src/ts/models.ts` and `../../src/ts/shared-utils.ts` are a shared contract** — editing them can break Functions (which is why the Functions PR check watches those files). Functions handle user/role admin, Drive attachment uploads, `publishDocument` (email + iCal), the amendment workflow, and the sitemap/ID cache (`settings/cache`).

### SSR-safety boundaries

- `src/ts/shared-utils.ts` — **SSR-safe and Function-shared**: pure functions only (`getReign`, `getCurrentReign`, `randomChars`, …), no browser/Quasar/Firebase imports.
- `src/ts/utils.ts` — **client-only**: touches `window`/`navigator.clipboard`/Quasar `Notify`/`vue-gtag`; lazy-`import()`s `sanitize-html`/`html-to-text` to keep them out of the SSR bundle.
- `src/ts/auth.ts` — client-only; Firebase Auth is never available during SSR prefetch.
- Guard browser globals with `if (!process.env.SERVER)`, `<q-no-ssr>`, or `onMounted`.

### Auth & roles

Roles are `DocumentSpecificIdentity.firebase` strings stored in the Firebase Auth **custom claims** (`roles: string[]`), not a Firestore collection. The same identity enum serves three roles: document sender/recipient, mailing-list entry, and access-control role. `src/ts/auth.ts` exposes module-level reactive singletons (`loggedInUser`, `loggedInUserClaims`) wired via `onAuthStateChanged`; login is Google popup only. Claims only refresh on auth-state change — a freshly granted role won't appear until token refresh.

**Authorization is enforced at the UI and data layers, NOT the route layer.** `firestore.rules` is authoritative (`documents` read access computed in `canReadDocument()` using `published`/`confidentiality`/`viewers` ∩ `request.auth.token.roles`); `DocumentsPageV2.vue` mirrors this in its `where(...)` clauses (unauthenticated branches query `authorEmail == '___NONE___'` to return nothing). `firestore.indexes.json` is ~40 composite indexes, **all on `documents`** — adding a new filter+sort combination to the document list needs a new index here.

### SSR rendering, layouts, search

- **Request lifecycle**: SSR `onServerPrefetch` → Pinia store → Quasar auto-serializes store into HTML → client `onBeforeMount` hydrates. (Auto store serialization is on; `manualStoreSerialization` is commented out in `quasar.config.ts`.)
- **Algolia**: only `LegislationPage.vue` uses it (`<ais-instant-search-ssr>`). The instance/`searchClient` are module singletons in `src/boot/algolia.ts`; `src/ts/vis-mixin.ts` is vendored vue-instantsearch SSR internals (treat as library code, not app logic). SSR results ride the serialized Pinia store via `useAlgoliaStore()` `setState`/`hydrate`/`clearState`. `DocumentsPageV2.vue` does **not** use Algolia — it queries Firestore directly with cursor pagination and bidirectional URL-query ↔ filter sync.
- **Layouts**: `SSRLayout.vue` (server-rendered) for public read pages; `MainLayout.vue` (wrapped in `<q-no-ssr>`, client-only) for all `/manage/*` and the draft-amendment pages — those touch auth/`window` and can't run server-side. `HeaderSidebar.vue` is itself `<q-no-ssr>`, so chrome appears only after hydration.
- **`manage` prop pattern**: admin pages are thin wrappers, not separate implementations. `ManageLegislationPage.vue` is literally `<LegislationPage manage />`; the boolean toggles edit buttons and (for documents) confidentiality scopes.
- **User HTML**: authored via `ProEditor.vue` (wraps Quasar `<q-editor>`), stored as raw HTML, rendered through `SafeHtml.vue` which sanitizes **synchronously** via `customSanitize` in `src/ts/sanitize.ts` (a dedicated module that *statically* imports `sanitize-html` so it runs during the SSR render pass; only imported by `SafeHtml`, so it stays code-split with the `/document` chunk). Content is therefore present and sanitized in the server-rendered HTML.

### Documents subsystem specifics

- `DocumentRenderer.vue` dispatches by `doc.type.firebase` using both exact match and `startsWith('Court')` / `startsWith('JudicialCommittee')` fallbacks — **branch order is load-bearing** (specific `CourtReviewReport1/2/3` must precede the `Court` catch-all). Unregistered types degrade to an error message, not a crash.
- `DocumentsPage.vue` is **dead code** — routes use `DocumentsPageV2.vue` everywhere.
- Judicial pages (`/document/judicial/*`) are a view layer over the same `documents` collection; `prosecutionId` is a **soft foreign key** threading a case's documents together. Editing a document's ID is a copy-to-new-doc-then-delete-old operation because the ID is the Firestore key.

## Gotchas

- **No router auth guard exists** (`src/router/index.ts` is the stock factory). `src/pages/legislation/AGENTS.md` claims `/manage/*` is protected by a guard — that is stale/aspirational. Typing a `/manage/...` URL is not blocked at the route level; rely on Firestore rules and UI gating for the real authorization model.
- TS: `allowImportingTsExtensions` is on (imports may carry `.ts` — don't "fix" them) and `exactOptionalPropertyTypes` is intentionally `false`. The real tsconfig is generated into `.quasar/`; use the generated path aliases (`stores/…`, `pages/…`, `components/…`, `boot/…`, `layouts/…`).
- ESLint (flat config, type-aware): enforces single quotes and `consistent-type-imports` (use `import type`); deliberately lax on `no-explicit-any`/`no-unused-vars`/`no-misused-promises`.
- `functions/src/credential.json` is a committed Google service-account key; Gmail creds come from `GMAIL_*` env. Firebase web config is hardcoded inline in `src/boot/vuefire.ts`.
- Both deploy artifacts (`dist/spa` to Hosting, `dist/ssr` Docker image to Cloud Run) must succeed for a coherent release; the merge workflow's asset shuffle + `index.html`→`main.html` rename is load-bearing.
