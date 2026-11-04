---
name: fix-sentry-issues
description: Triage every unresolved Sentry issue for law.cksc.tw (org `cksc`, project `legislation`), fix the defects at their root, silence the non-actionable noise the way this codebase already does, verify with `yarn build`, commit and push to main, then resolve the issues in Sentry. Use when asked to "fix the Sentry issues", "clear Sentry", "resolve all Sentry errors" or similar.
---

# Fix and resolve all Sentry issues

End state: every unresolved issue in `cksc/legislation` is either fixed in a commit on `main` or deliberately silenced, the build passes, the commit is pushed, and each issue is marked resolved in Sentry with a note pointing at the commit.

## 0. Setup

- Sentry MCP tools are deferred — load them first with ToolSearch:
  `select:mcp__claude_ai_Sentry__search_issues,mcp__claude_ai_Sentry__get_sentry_resource,mcp__claude_ai_Sentry__update_issue,mcp__claude_ai_Sentry__search_events,mcp__claude_ai_Sentry__execute_sentry_tool`
- Org `cksc`, project `legislation`, regionUrl `https://us.sentry.io`. (The org's `platform` project is a different app — leave it alone.)
- Start from a clean, current `main`: `git status` must be clean, then `git pull --ff-only origin main`. If the tree is dirty, stop and ask; never stash or discard someone else's work.

## 1. Collect

`search_issues(organizationSlug='cksc', projectSlugOrId='legislation', query='is:unresolved', period='90d', limit=100, sort='freq')`.

If there are none, say so and stop — there is nothing to commit.

For each issue, `get_sentry_resource(resourceType='issue', resourceId='LEGISLATION-X')`. Note the **url tag** (which page), **release** (commit SHA — `git show <sha>` tells you what code was live), **browser/OS**, **mechanism** (`onunhandledrejection` = a promise nobody awaited; `captureError` with a `notification` tag = a `notifyError()` toast), **user** (present only if signed in — `setSentryUser` runs from `updateCustomClaims`), and the **runtime** tag (`browser`, SSR webserver, or Functions). If one event is ambiguous, look at more with `execute_sentry_tool` → `search_issue_events`.

Also check if a release after the issue's `lastSeen` already fixed it (`git log <release>..HEAD`); if so it only needs resolving.

## 2. Triage — defect or weather?

Classify each issue before touching code. Earlier fixes (`git log --grep LEGISLATION`) show both shapes:

- **Defect** — our code is wrong: a race with async work (`6a0ab32`), a query that can never succeed (`6cd418b`), an unguarded browser API, an unawaited promise from `setup`. Fix the root cause, not the symptom. Wrapping in try/catch alone is not a fix if the underlying call should never have failed.
- **Not our fault, but badly told** — the user's network, their browser's popup blocker, an account without access, a signed-out visitor on a `/manage` URL. The fix is a message they can act on plus `report: false`:
  - `src/ts/firebase-errors.ts` holds the `explain*Error()` helpers (`explainAuthError`, `explainQueryError`, `explainFunctionError`) that return `{ message, report }`; extend these rather than inventing per-page logic.
  - Call sites do `const { message, report } = explainXError(e, '預設訊息'); notifyError(message, e, { report });`.
- **Pure noise with no call site to fix** (extension chatter, third-party stack only) — add a pattern to `ignoreErrors` / `denyUrls` in `src/boot/sentry.ts` with a comment saying why. Use sparingly; a filter hides every future occurrence.
- **Cannot be fixed in code** (e.g. a bot, an outage that has passed) — ignore it in Sentry rather than resolve it (step 6), and explain why in the `reason`.

If a fix would need a product decision (changing access policy, firestore.rules, data migrations), stop and ask the user instead of guessing.

## 3. Fix

Follow `CLAUDE.md` — in particular the SSR-safety boundaries, the enum-class `VALUES` registration, and the shared contract (`src/ts/models.ts`, `src/ts/shared-utils.ts` are imported by `functions/`).

Conventions the previous Sentry fixes established:
- Leave a comment at the fix that explains the failure mode in plain prose and cites the issue ID, e.g. `(LEGISLATION-D)`. Comments explain *why*, as in the surrounding code.
- User-facing text is Traditional Chinese, phrased as what to do next.
- Look for the same bug shape elsewhere (other pages calling the same helper, sibling catch blocks missing `Loading.hide()`) and fix those too when it is the same root cause.
- Don't report caller-fault codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`) — mirror `functions/src/sentry.ts`.

## 4. Verify

- `yarn build` must succeed — it is the typecheck (vue-tsc) and lint gate; there are no tests. Run it in the background and wait for the notification; it takes a few minutes.
- If `functions/**`, `src/ts/models.ts` or `src/ts/shared-utils.ts` changed: `cd functions && yarn build && yarn lint` too.
- `yarn format` is whole-repo; run Prettier only on the files you touched (`npx prettier --write <files>`).
- Don't push on a failed build. Fix it or stop and report.

## 5. Commit and push to main

One commit for the batch (or one per unrelated root cause). Match the existing style — see `git show 6cd418b`:

```
fix: <what the user no longer suffers, in plain words>

<A paragraph per issue: what happened, why, and what changed.
Name the issue inline (LEGISLATION-X).>

Fixes LEGISLATION-X
Fixes LEGISLATION-Y

Co-Authored-By: <attribution line from the system prompt>
```

The `Fixes LEGISLATION-X` trailers let Sentry's GitHub integration link the commit. Then `git push origin main`. The push triggers `firebase-hosting-merge.yml`, which deploys and sets `SENTRY_RELEASE` to the commit SHA. If Functions changed, remind the user that the Functions deploy is manual (`firebase deploy --only functions`).

## 6. Resolve in Sentry

Only after the push succeeds. For each fixed issue:

`update_issue(organizationSlug='cksc', issueId='LEGISLATION-X', status='resolvedInNextRelease', reason='Fixed in <short sha>: <one line>')`

Use `resolvedInNextRelease` rather than `resolved`: releases are commit SHAs and tabs left open on the old release keep sending the old error until they reload, so plain `resolved` would flip straight back to regressed. For the ones in step 2's last bucket, use `status='ignored'` (default `untilEscalating`) with a reason.

Finish by re-running the step 1 search to confirm nothing unresolved is left, and report to the user: each issue ID, what it was, and whether it was fixed, silenced or ignored, plus the commit SHA.
