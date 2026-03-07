# Project Overview
**CKSC Legislation (cksc-legislation)** is the central repository and platform for organizing and securely displaying the constitution, laws, orders, and documents for the Student Council of Chien Kuo High School (CKHS). This Vue 3 + Quasar framework web application acts as the authoritative portal for the school's legislative documentation, connecting directly to a Firebase/Firestore backend and utilizing Server-Side Rendering (SSR) for SEO and performance alongside Firebase App Hosting/Cloud Run.


## Repository Structure
* **`.apphosting/`** - Firebase App Hosting templates and service configurations for deploying to Cloud Run.
* **`.github/`** - GitHub Actions CI/CD workflows for building, checking PRs, and deploying on merge.
* **`functions/`** - Firebase Cloud Functions backend logic (Node.js/TypeScript) for emails, sitemap generation, and API integrations.
* **`public/`** - Static assets like `favicon.ico` hosted at the root without compilation.
* **`src/`** - Main Vue 3 + Quasar application source code containing UI components, pages, routing, and pinia stores.
* **`src-ssr/`** - Specific custom middleware implementations for Quasar's Server-Side Rendering mechanism.
* **`firebase.json`** - Main Firebase configuration linking Hosting rewrites, Cloud Functions, and pointing to local Firestore rules and indexes.
* **`firestore.rules`** - Defines critical security access conditions, separating internal confidential documents from public archives based on User UID and assigned roles.
* **`firestore.indexes.json`** - Enforces required compound document queries efficiently for the database.


## Build & Development Commands
```bash
# Install all dependencies (requires Node.js 18-24)
yarn install

# Start local development server with Hot Module Replacement + SSR enabled
yarn dev

# Run ESLint to check for stylistic or logical errors
yarn lint

# Format code automatically using Prettier
yarn format

# Build a production-ready SSR application bundle
yarn build

# Build a purely client-side SPA (Single Page Application)
yarn spa-build

# Prepare SSR build specifically for GCP build environments
yarn gcp-build
```

*(Note: Test scripts are currently stubbed in `package.json` with no explicit test runner defined natively)*


## Code Style & Conventions
* **Framework:** Vue 3 using the `<script setup>` Composition API with TypeScript.
* **Styling & Components:** Utilize Quasar Framework components (`q-*`) combined with SCSS modules via `src/app.scss`.
* **Linting Customizations:** Standard TypeScript/Vue configurations with custom exceptions: `any` typing and `unused-vars` are explicitly allowed/disabled per `eslint.config.js`. Avoid explicitly writing `debugger` statements in production.
* **Formatting:** Entire codebase relies on Prettier for uniform consistent styling. Always run `yarn format` before commits.


## Architecture Notes
```mermaid
flowchart TD
    Client[Web Client (Vue 3 / Quasar SPA)]
    SSRServer[SSR Middleware (Cloud Run / Node.js)]
    Auth[Firebase Auth (Google OAuth)]
    DB[(Firestore)]
    CF[Cloud Functions]
    EmailAPI[Nodemailer / External Mails]

    Client <-->|Interacts| SSRServer
    SSRServer <-->|Reads Data / Queries| DB
    Client <-->|Logs in| Auth
    Auth -.->|Updates Custom Claims| CF
    CF -->|Emails & Backend Jobs| EmailAPI
    CF -->|Reads/Writes| DB
```

* **Data Flow**: The Vue UI leverages `vuefire` to synchronise real-time document collections. Static meta rendering is managed in SSR middleware prior to hitting the client browser.
* **Access Control**: Client identity maps through Firebase Auth -> Token Claims (Managed by custom Cloud Functions based on database assignments) -> enforced linearly at the `.rules` level before payload reaches the front-end.


## Testing Strategy
> TODO: Add testing strategy. No current testing frameworks (e.g. Vitest, Cypress, Jest) are presently configured in this application structure or CI pipelines.


## Security & Compliance
* **Database Rules**: Do **not** bypass existing logic inside `firestore.rules`. Confidential documents enforce strict read checks explicitly matching `viewers`, `authorUid`, and `declassifyAt` time checks against the user. Unauthenticated clients are rigidly blocked from non-public archives.
* **Auth Claims**: System privileges (`Chairman`, `Speaker`, etc.) are attached contextually via Custom Claims inside auth JSON tokens.
* **Deployment**: The GitHub workflow runs direct deployments. Access keys & Service Accounts must be securely loaded via `${{ secrets.FIREBASE_SERVICE_ACCOUNT_CKSC_LEGISLATION }}`.


## Agent Guardrails
* **DO NOT** edit code inside `node_modules` or `dist`.
* **DO NOT** commit untested or syntactically broken changes to `firestore.rules`; verify rules syntax offline when modifying `canReadDocument`.
* **DO NOT** introduce non-Quasar component libraries without explicit user request.


## Extensibility Hooks
* **Custom Roles:** Adding new specific roles requires adding them structurally within `src/ts/models.ts` definitions (e.g. `DocumentSpecificIdentity.VALUES`), alongside coordinating cloud functions that re-assign token identities.
* **Firebase Environments:** Currently `firebase.json` hardcodes the region `asia-east1`. Changes to host multiple clusters must rewrite this locally.


## Further Reading
> TODO: No additional documentation directories currently exist in this repository. Future architecture decision records should be deposited into `docs/`.
