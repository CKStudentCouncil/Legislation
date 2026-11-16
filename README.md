# CKSC Legislation

建國中學班聯會憲章、法律、命令與公文之中央資料庫 — the central database for the constitution, laws, orders and official documents (公文) of the Chien Kuo High School student council.

**Live site:** [law.cksc.tw](https://law.cksc.tw)

## What it does

- **Legislation (法律)** — browse and full-text search the constitution, laws and orders, view each clause's amendment history, and draft and submit amendment requests for review.
- **Documents (公文)** — publish official documents with confidentiality levels and per-role access, email them to a mailing list, and follow judicial cases (訴訟查詢) document by document.
- **Management (`/manage`)** — signed-in council officers edit legislation and documents, review amendments, and manage accounts, roles and the mailing list.

## Tech stack

- [Quasar v2](https://quasar.dev) + Vue 3 + TypeScript, server-side rendered
- Firebase: Firestore, Auth (Google sign-in), Cloud Functions, Hosting; SSR server on Cloud Run
- Algolia for legislation search
- Sentry for error reporting (optional — off when no DSN is set)

## Getting started

Requires Node.js 22 or 24 and [Yarn](https://yarnpkg.com).

```bash
yarn install   # also runs `quasar prepare`, which generates .quasar/ and the real tsconfig
yarn dev       # dev server with SSR and hot reload
```

Run `yarn install` before opening the project in an editor; TypeScript path aliases don't resolve until `.quasar/` exists.

The dev server runs in **SSR mode**, so code that touches `window` or other browser globals must be guarded (see [CLAUDE.md](CLAUDE.md)).

## Commands

| Task                               | Command                                   |
| ---------------------------------- | ----------------------------------------- |
| Dev server (SSR)                   | `yarn dev`                                |
| Production SSR build → `dist/ssr/` | `yarn build`                              |
| SPA build → `dist/spa/`            | `yarn spa-build`                          |
| Lint                               | `yarn lint`                               |
| Format                             | `yarn format`                             |
| Build / lint Cloud Functions       | `cd functions && yarn build && yarn lint` |

There is no test suite. `yarn build` typechecks (`vue-tsc`) and lints as part of the build, so a clean build is the check that CI runs on every pull request.

## Project layout

| Path                                         | Contents                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `src/`                                       | The app: pages, components, Pinia stores, router, boot files             |
| `src/ts/models.ts`                           | Data models and the "enum class" types — **shared with Cloud Functions** |
| `src/ts/model-converters.ts`                 | Firestore converters and data-access helpers                             |
| `src-ssr/`                                   | SSR server and middleware (its own `package.json`)                       |
| `functions/`                                 | Firebase Cloud Functions (its own `package.json`, CommonJS)              |
| `firestore.rules` / `firestore.indexes.json` | Access control and composite indexes                                     |
| `firebase.json`                              | Hosting rewrites that split traffic between Cloud Run and the SPA        |
| `scripts/`                                   | One-off tooling (e.g. the Kai webfont generator)                         |
| `docs/`                                      | Planning notes                                                           |

## Deployment

One Firebase Hosting site (`cksc-law`, serving `law.cksc.tw`) fronts two builds:

- **Public read pages** (`/`, `/legislation/**`, `/document/**`, `/sitemap.xml`) are server-rendered by Cloud Run.
- **Everything else**, including `/manage`, falls back to the static SPA.

| What                | How                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting + Cloud Run | Automatic on push to `main` (`firebase-hosting-merge.yml`)                                                                                          |
| Cloud Functions     | Manual: **Actions → Deploy Cloud Functions (manual) → Run workflow**                                                                                |
| Firestore indexes   | Manual: `firebase deploy --only firestore:indexes` — run it and wait for the indexes to finish building **before** merging a change that needs them |

The second Hosting site, `cksc-legislation`, is a legacy domain that 301-redirects everything to `law.cksc.tw`. Don't deploy to it.

## Further reading

- [CLAUDE.md](CLAUDE.md) — architecture, conventions and gotchas (the most complete reference)
- [AGENTS.md](AGENTS.md) — repository overview
- [src/pages/legislation/AGENTS.md](src/pages/legislation/AGENTS.md) — the legislation subsystem in depth

## License

[PolyForm Shield 1.0.0](LICENSE.md)
