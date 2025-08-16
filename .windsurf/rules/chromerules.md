---
trigger: always_on
---

# =========================
# SCOPE & COMMUNICATION
# =========================
1) Keep changes small and reviewable. Before editing >3 files or >80 LOC, propose a plan and outline risks.
2) Prefer minimalism: remove code/permissions/features that aren't strictly needed.

# =========================
# MANIFEST & PERMISSIONS (MV3)
# =========================
3) Target Manifest V3 only. Use service_worker (no persistent background pages).
4) Ask for the least privileges. Use "host_permissions" narrowly; avoid "<all_urls>" unless absolutely required.
5) Never ship "unsafe-eval" or remote code. No code fetched from the network and executed at runtime.
6) Keep "permissions" vs "optional_permissions" distinct; move rarely-used powers to optional and request at runtime.
7) Use the new APIs where possible: chrome.scripting, declarativeNetRequest, offscreen documents (only if justified).

# =========================
# ARCHITECTURE & FILES
# =========================
8) Structure:
   /src
     /background (service worker only)
     /content-scripts
     /ui (options, popup, pages)
     /lib (shared utils)
     /types
   /public (icons, static)
   manifest.json
9) Keep background logic stateless or event-driven. Long-running work: chunk with alarms/idle or offscreen docs.
10) Content scripts: isolate side effects; never assume page globals. Use strict mode and module wrappers.

# =========================
# MESSAGING & STATE
# =========================
11) Use one message bus: chrome.runtime.onMessage + typed payloads. Document every message type (request/response).
12) Prefer request/response over fire-and-forget. Always handle Promise rejections; include {ok:boolean, error?:string}.
13) Centralize storage access in /lib/storage.ts. Validate with zod/TypeScript types on read/write.

# =========================
# STORAGE & QUOTAS
# =========================
14) Default to chrome.storage.local; use chrome.storage.sync only for small prefs (<100KB, mindful of quotas).
15) Never store secrets/tokens in storage; acquire on demand and keep in memory where possible.
16) Add migrations: versioned schema with up-migration functions; run once in background on install/update.

# =========================
# INJECTION & UI SAFETY
# =========================
17) Use chrome.scripting.executeScript for page code; avoid inline <script> due to CSP.
18) Don’t pollute the page DOM: use Shadow DOM roots for injected UI; namespace all CSS classes with "ext-".
19) Never rely on private page internals (e.g., _hidden fields). Prefer selectors resilient to SPA changes.

# =========================
# SECURITY & PRIVACY
# =========================
20) No eval/Function constructor/innerHTML from untrusted data. Sanitize DOM mutations.
21) Don’t collect PII or browsing data without explicit user purpose and clear toggle. Provide a Privacy page.
22) Network: limit domains; document why each endpoint is needed. Handle timeouts/retries; back off on errors.

# =========================
# PERFORMANCE & RELIABILITY
# =========================
23) Keep service worker warm only when needed. Avoid busy loops; use events (tabs, webNavigation, alarms).
24) Debounce high-frequency events (scroll/mutation observers). Disconnect observers when not in use.
25) Use lazy loading for heavy modules (dynamic import) in UI pages.

# =========================
# TESTING & QA
# =========================
26) Add unit tests for lib/storage, message handlers, and critical business rules. E2E: Playwright+Chrome for flows.
27) Include a test matrix covering: fresh install, update with migration, permission grant/deny, offline, SPA navigation.
28) Add a manual QA checklist: install, permissions prompts, feature smoke, uninstall cleanup.

# =========================
# BUILD & TOOLING
# =========================
29) Use a single bundler config (Vite/Rollup/Webpack) with:
    - separate entries: background, content scripts, popup, options
    - asset hashing off for files referenced in manifest
    - source maps in dev only
30) TypeScript strict mode on. ESLint + Prettier (or Ruff-equivalent in JS world) with pre-commit hooks.
31) Output to /dist with stable file names referenced in manifest. Validate manifest on CI.

# =========================
# UX & ACCESSIBILITY
# =========================
32) Keyboard accessible UI (tab order, ARIA). Respect prefers-color-scheme. Keep popup <200ms TTI.
33) Provide i18n via _locales; no hardcoded user-facing strings in code.

# =========================
# CHROME WEB STORE COMPLIANCE
# =========================
34) Provide clear description, screenshots, and a public privacy policy URL. Explain why each permission is needed.
35) No misleading behavior, affiliate injection, or user data sale. Offer an obvious off switch and uninstall cleanup.
36) Version bump every release; changelog in RELEASE_NOTES and in Store listing.

# =========================
# LOGGING & DIAGNOSTICS
# =========================
37) Use a tiny logger with levels; strip debug logs in production builds. Never log PII or page content by default.
38) Surface fatal errors via chrome.notifications or a badge counter; provide a diagnostics page in options.

# =========================
# COMMON FAILURE MODES (GUARDRAILS)
# =========================
39) If something needs a new permission, propose scope + UX for requesting it at runtime (don’t add silently).
40) Don’t rely on synchronous assumptions: all Chrome APIs are async. Always await and handle errors.
41) SPA pages: re-attach content features on history/navigation events (listen to popstate or use MutationObserver).
42) After big changes, list exact steps for me to verify: load unpacked, grant permission X, visit site Y, expect Z.

# =========================
# DONE CHECKLIST
# =========================
43) ✅ Manifest valid (MV3), ✅ permissions minimized, ✅ messages typed, ✅ storage schema + migrations,
    ✅ tests/QA pass, ✅ i18n & a11y checked, ✅ build reproducible, ✅ release notes updated.
