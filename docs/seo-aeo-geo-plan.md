# SEO / AEO / GEO Improvement Plan — law.cksc.tw

> Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · tags: 🔵SEO 🟢AEO 🟣GEO ⚪shared

## Context

`law.cksc.tw` (建國中學班聯會法律與公文系統) is a Quasar v2 (Vue 3) **SSR** app on Google Cloud
Run behind Firebase Hosting. Only `/`, `/legislation/**`, `/document/**` and `/sitemap.xml`
are routed to the SSR server; every other path falls back to a static SPA shell
(`dist/spa/main.html`). Content is Traditional-Chinese (zh-Hant-TW) charters, laws, orders,
official documents (公文) and judicial documents. The site **is the canonical primary source**
for these documents — a strong intrinsic GEO/E-E-A-T advantage worth leaning into.

This plan was produced from a multi-agent research + codebase audit + adversarial critique pass.
Distinguishes **SEO** (classic ranking), **AEO** (answer engines / featured snippets / AI
Overviews) and **GEO** (generative engines / LLM citation).

### Key corrections baked in (avoid wasted/stale work)

- ❌ `SearchAction` sitelinks-searchbox — retired by Google 2024-11-21.
- ❌ `FAQPage` / `QAPage` markup — FAQ rich results deprecated; QAPage invalid for site-authored content.
- ❌ Artificial content "chunking" for AI — Google explicitly warns against it. Use clean semantic headings + answer-first summaries instead.
- ❌ `hreflang` — single language/region, unnecessary.
- `@type: Legislation` has near-zero Google rich-result support → treat as a **GEO/LLM extraction aid**; `Article`/`CreativeWork` properties carry the SEO weight.
- In SSR, canonical/`og:url` must be built from a **hardcoded absolute base** (`https://law.cksc.tw` + `route.path`), never `window.location` (undefined server-side) nor the request host (Cloud Run sees an internal host).

### Verification gates (test against the deployed edge, not localhost)

- `curl https://law.cksc.tw/document/<id>` (JS disabled) → document **body** present in HTML.
- `curl -I https://law.cksc.tw/document/<garbage>` → real **HTTP 404**.
- `curl https://law.cksc.tw/about` → server-rendered content, not the SPA shell.
- Rich Results Test / Schema Markup Validator on a live legislation + document URL.
- GSC URL Inspection → rendered HTML contains body + JSON-LD.

---

## Phase 0 — Rendering integrity (blockers; everything depends on these)

- [ ] **0.1 ⚪ Get document bodies into SSR HTML.** `SafeHtml.vue` sanitizes asynchronously
      (`ref('')` + `await customSanitize` inside a watch), so 公文 bodies are absent from the server
      render. Fix: pre-sanitize in the Pinia document store during `loadDocument()` and render
      synchronously. _(SafeHtml.vue, stores/document.ts, components/documents/\*)_
- [ ] **0.2 ⚪ Soft-404 → real 404.** Missing doc/legislation returns 200 + placeholder. Set
      `ssrContext.res.statusCode = 404` in `onServerPrefetch` and emit `noindex` on the not-found
      state. _(SingleDocumentPage.vue, SingleLegislationPage.vue, ErrorNotFound.vue)_
- [ ] **0.3 🟣 Route `/about` to SSR** in `firebase.json` (+ add to sitemap). _(firebase.json, functions/src/index.ts)_
- [ ] **0.4 🟣 SSR-prefetch judicial lawsuit pages** (or `noindex` them). _(JudicialSingleLawsuitPage.vue)_
- [ ] **0.5 🔵 `Cache-Control` on SSR responses** (`s-maxage` + `stale-while-revalidate`), found-content only. _(src-ssr/middlewares/render.ts)_

## Phase 1 — Foundational on-page tags (quick wins)

- [ ] **1.1 ⚪ `<html lang="zh-Hant-TW">`** via `htmlAttr` in App.vue useMeta + hardcoded in index.html.
- [ ] **1.2 ⚪ Self-referencing `rel=canonical` + `og:url`** from absolute base; strip `?c=`/`#`.
- [ ] **1.3 🔵 Unlock viewport** — drop `user-scalable=no, maximum-scale=1, minimum-scale=1`.
- [ ] **1.4 ⚪ `og:type` per page** (`website` default, `article` on detail) + `og:locale=zh_TW`.
- [ ] **1.5 ⚪ Unconditional `<title>`/`description`** in index.html (remove `SERVER===true` gate).
- [ ] **1.6 🟣 Fix `og:updated-time`** (`name=`→`property=`) + add `article:published_time`/`article:modified_time`.
- [ ] **1.7 🔵 `noindex` on `/manage`** pages.

## Phase 2 — Structured data (core GEO/AEO investment)

Inject via Quasar `useMeta` `script` channel (`{ type:'application/ld+json', innerHTML: JSON.stringify(obj) }`),
built inside the useMeta callback from prefetched store data. Centralize builders in `src/ts/structured-data.ts`.

- [ ] **2.1 🟣 `Organization` node** (臺北市立建國中學班聯會) with stable `@id`, reused as publisher/author.
- [ ] **2.2 🟣 `Legislation` JSON-LD** — name, identifier, datePublished/dateModified (history.amendedAt), inLanguage, hasPart per clause, legislationLegalForce.
- [ ] **2.3 🟣 `Article` JSON-LD** on documents — headline, datePublished, author/publisher, articleBody; `Event` for meeting notices.
- [ ] **2.4 🔵 `BreadcrumbList`** on detail/section pages.
- [ ] **2.5 🟢 `ItemList`/`CollectionPage`** on SSR listing pages.
- [ ] **2.6 🟣 Enrich homepage `WebSite` + `Organization`** (inLanguage, publisher).

## Phase 3 — Content semantics & answer-readiness

- [ ] **3.1 ⚪ One semantic `<h1>` = document subject** across `components/documents/*`; demote boilerplate lines.
- [ ] **3.2 ⚪ Real heading hierarchy** — legislation Volume/Chapter/Section/Clause → `<h2>`–`<h6>`.
- [ ] **3.3 ⚪ Semantic `<nav>` in SSR** (outside `q-no-ssr`) for internal links.
- [ ] **3.4 🟢 Answer-first lead passage** (40–80 words) on each law/document.
- [ ] **3.5 🟣 Crawlable internal links** for cross-references (history.link, resolutionUrls, frozenBy).
- [ ] **3.6 🔵 SSR `<a>` list on listing pages** (don't rely on Algolia JS for discovery).
- [ ] **3.7 🟢 Tighten 立法沿革 table** semantics (`thead`/`th scope`/`td`/`caption`).
- [ ] **3.8 🟣 Visible provenance block** (issuer / type / date / 字號 / last amended).

## Phase 4 — Performance, indexing & AI-crawler policy

- [ ] **4.1 ⚪ `preconnect`/`dns-prefetch`** to Firestore, Algolia, GTM, image host.
- [ ] **4.2 ⚪ Drop `roboto-font`** (CJK UI) + `font-display:swap`.
- [ ] **4.3 ⚪ Move `og:image` off raw.githubusercontent.com** to first-party host; explicit dimensions.
- [ ] **4.4 🟣 AI-crawler policy in robots.txt** (OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended).
- [ ] **4.5 🟢🟣 IndexNow** — POST changed URLs from the `updateIdCache` write path; verify in Bing Webmaster Tools.
- [ ] **4.6 🟣 `llms.txt`** — optional/low priority.

---

## Measurement (niche-appropriate)

- **GSC:** soft-404 → 0; "crawled – not indexed" trend; rendered HTML contains body + JSON-LD; Rich Results validity.
- **Bing Webmaster Tools:** IndexNow success; coverage (Bing feeds ChatGPT & Perplexity).
- **AI citation spot-checks:** query ChatGPT/Perplexity/Gemini about specific charters/articles → is law.cksc.tw cited?
- **CWV (CrUX/PageSpeed):** LCP / CLS / INP on `/document/:id` and `/legislation/:id`.

## Implementation status (branch `seo-aeo-geo-improvements`)

**Done in this branch:**

- Phase 0: 0.1 (SafeHtml synchronous sanitize → `src/ts/sanitize.ts`, `SafeHtml.vue`), 0.2 (soft-404 → real 404 + noindex on both detail pages), 0.3 (`/about` SSR rewrite + sitemap entry), 0.5 (Cache-Control on SSR responses).
- Phase 1: 1.1–1.7 all done (lang, canonical+og:url, viewport, og:type/og:locale, SPA-shell title/desc, article:\* + og:updated-time fix, noindex on `/manage` via MainLayout).
- Phase 2: 2.1 Organization, 2.2 Legislation JSON-LD, 2.3 Article/Report (+Event) JSON-LD, 2.4 BreadcrumbList (in each page graph), 2.6 homepage WebSite+Organization graph. Builders in `src/ts/structured-data.ts`.
- Phase 3: 3.1 single `<h1>` (page-level subject h1 + all 10 renderer mastheads demoted), 3.3 SSR `<nav>`, 3.7 history-table semantics. About-page `<h1>` added.
- Phase 4: 4.1 preconnect/dns-prefetch, 4.4 AI-crawler robots.txt, 4.6 llms.txt.

**Deferred (with reason):**

- 0.4 / 3.6 / 2.5 — Judicial lawsuit SSR prefetch and SSR `<a>` item lists on listing pages need an SSR data-fetch refactor of the Algolia/VueFire client-only flows (a real feature, not a config tweak). Higher risk; do as a focused follow-up.
- 3.2 (full Volume/Chapter→`<h2>`–`<h6>` hierarchy), 3.4 (answer-first lead passages), 3.5 (crawlable cross-reference links) — content/component work; 3.4 in particular wants human-authored summaries.
- 4.2 (drop `roboto-font`), 4.3 (move og:image to first-party host) — visual/product + asset-hosting decisions; left to the maintainer.
- 4.5 (IndexNow) — needs a key file provisioned at the domain root + Bing Webmaster verification before wiring into `updateIdCache`.

## Verification done

- `eslint` clean on all changed files.
- `vue-tsc --noEmit` clean for all changed files (4 remaining `TS2307 Cannot find module` errors are pre-existing in untouched files — `diff`/`v-code-diff`/`js-confetti` — and resolve under the Quasar build checker).
- `prettier --write` applied to changed files.
- Still to run by maintainer: full `quasar build -m ssr`, then the edge verification gates above.

## Sources (selected)

- Google Search Central: AI optimization guide, JS SEO, structured data, sitemaps, sitelinks-searchbox retirement (2024-10).
- Princeton/Georgia Tech "GEO: Generative Engine Optimization" (KDD 2024) — quotations/statistics/citations raise AI citation 28–41%.
- schema.org `Legislation` / `LegislationObject` (EU ELI-derived); Sparna ELI schema.org how-to.
- Vercel "The rise of the AI crawler" — AI crawlers do not execute JS.
- IndexNow / Bing Webmaster Tools for AI-search visibility.
