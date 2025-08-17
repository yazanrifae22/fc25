# EA FC Web App Automation — Logic Documentation

This document describes the automation architecture, message protocols, step-by-step flows, selectors, timings, and diagnostics for the Chrome MV3 extension.

Applies to:
- Background service worker: `src/background/service_worker.js`
- Content script (automation UI and orchestration): `src/content-scripts/automation-button.js`


## 1) Architecture Overview

- Service worker (MV3): stateless, event-driven. Handles DOM actions via `chrome.scripting.executeScript` in the MAIN world across frames.
- Content script: injects Shadow DOM UI, orchestrates runs, computes histograms, and calls background handlers using a unified request/response pattern with timeouts and retries.
- Message bus: `chrome.runtime.onMessage` (background) and `chrome.runtime.sendMessage` (content). All handlers respond with `{ ok: boolean, ... }` and avoid indefinite hangs via content-side `withTimeout()`.
- Network hook: background injects a fetch/XHR patch in page MAIN world to detect `.../purchased/items` and dispatches `CustomEvent("EA_AUTOMATION_PURCHASED_ITEMS")` in-frame and `window.top.postMessage` to top frame.


## 2) Message Type Catalog

All messages use request/response with `{ ok: boolean, error?: string, ... }`.

- PING
  - Request: `{ type: 'PING' }`
  - Response: `{ ok: true, data: 'PONG' }`
  - Handler: `service_worker.js` top-level.

- CLICK_RECYCLE
  - Request: `{ type: 'CLICK_RECYCLE' }` (from current tab/frame)
  - Background behavior: Clicks `#auto-sbc-recycle` once with realistic events; idempotent guard (5s) via `window.__ea_recycleClickedRecently`.
  - Response: `{ ok: true, clicked: boolean }`
  - Time window: up to 15s scan.

- QUICK_SELL_UNTRADEABLES
  - Request: `{ type: 'QUICK_SELL_UNTRADEABLES' }`
  - Response: `{ ok: true, takeMeThereClicked, ellipsisClicked, quickSellClicked, confirmClicked, dismissed }`
  - Behavior: Handles "Unassigned Items Remain" -> "Take Me There". Opens ellipsis, selects popup "Quick Sell untradeable items ...", confirms OK, waits for dialog dismissal.
  - Runs in all frames; aggregates any frame’s success.

- HOOK_PURCHASED_ITEMS
  - Request: `{ type: 'HOOK_PURCHASED_ITEMS' }`
  - Response: `{ ok: true }` on success.
  - Behavior: Injects MAIN-world patches to `fetch` and `XMLHttpRequest` to detect `/game/fc25/purchased/items` (GET/POST) and dispatch events.

- CLICK_SEND_ALL
  - Request: `{ type: 'CLICK_SEND_ALL' }`
  - Response: `{ ok: true, clicked: boolean }`
  - Behavior: Finds and clicks "Send All To Club" button.

- CLICK_OPEN
  - Request: `{ type: 'CLICK_OPEN' }`
  - Response: `{ ok: true, clicked: boolean }`
  - Behavior: Finds and clicks an "Open" button on pack screen.

- RECYCLE_WORKFLOW
  - Request: `{ type: 'RECYCLE_WORKFLOW', mode: 'OVR89' | 'X10_84' }`
  - Response: `{ ok: true, mode, opened, selected, submitClicked, dismissed, autosbcCancelClicked }`
  - Behavior: Opens recycle popup, selects SBC option per mode, clicks submit, waits for dismissal, cancels follow-up AutoSBC dialog if present; may fire-and-forget `QUICK_SELL_UNTRADEABLES` if a follow-up cancel occurred.
  - X10/TOTW alternation: when `mode === 'X10_84'`, background alternates preference between `84+ x10 upgrade` and `84+ TOTW upgrade` using an internal toggle (`__x10AltToggle`). The selected preference is tried first, but if not present the other is accepted as fallback.


## 3) Content-Script Call Wrappers

- `withTimeout(promise, label, timeoutMs)` ensures operations resolve or reject within `timeoutMs` (default 20s) with structured logs.
- `callBg(type, payload, { label, timeoutMs=60000, retries=2 })` sends a background message with timeout and up to 2 retries, each separated by sleep and logging.
- Usage examples in `automation-button.js`:
  - `injectNetworkHook()` -> `HOOK_PURCHASED_ITEMS` (10s timeout)
  - `doRecycle(mode)` -> `RECYCLE_WORKFLOW` (60s timeout, retries: 2)
  - `doQuickSell(passes=3)` -> loops `QUICK_SELL_UNTRADEABLES` (60s timeout per pass)
  - Pack open: `CLICK_OPEN` (20s timeout)
  - Send all: `CLICK_SEND_ALL` (15s timeout)


## 4) Step-by-Step Flows

- Open Pack Flow
  1. Try background `CLICK_OPEN`; fallback to local click (content script) if needed.
  2. Stabilize waits after open before further actions.

- Send All Flow
  1. Background `CLICK_SEND_ALL` to move items to club. Logs and retries internally.

- Recycle Workflow (mode: `OVR89` or `X10_84`)
  1. Click `#auto-sbc-recycle` to open dialog; wait 3s stabilization.
  2. If container not found, use global fallback: locate mode button by text; then find and click submit/confirm button globally.
  3. If container found, select SBC option per mode (see selectors), then submit via `#auto-sbc-recycle-submit` or by text.
  4. Wait for dialog dismissal (primary). If a follow-up AutoSBC dialog appears, click Cancel and wait for dismissal. If `autosbcCancelClicked=true`, background triggers `QUICK_SELL_UNTRADEABLES` fire-and-forget.

- Quick Sell Untradeables Flow
  1. Handle "Unassigned Items Remain" dialog by clicking "Take Me There" if present; wait for dialog to dismiss.
  2. Click ellipsis `button.ut-image-button-control.ellipsis-btn` (fallbacks by aria/role) to open popup.
  3. In popup, select option matching "Quick Sell untradeable items ..." with tolerant label matching; fallback globally if needed; then Confirm (OK/Yes/Continue...).
  4. Wait for dismissal.

- Network Hook Flow
  1. Background injects MAIN-world patch for `fetch`/`XHR` on `/purchased/items`.
  2. On responses, dispatch `CustomEvent('EA_AUTOMATION_PURCHASED_ITEMS', { detail: { ok, source, url, data } })` and also `window.top.postMessage` with `{ __ea: true, type: evtName, payload: ... }`.


## 5) Selector Catalog (by handler)

- CLICK_RECYCLE
  - Open: `#auto-sbc-recycle`

- RECYCLE_WORKFLOW (container/dialog)
  - Container: `#auto-sbc-container.auto-sbc-container, #auto-sbc-container`
  - Mode buttons (inner `textContent` match):
    - OVR89: includes `"89 ovr squadshifter"` or `"89 ovr squad shifter"`, or any label/aria that contains `89` and either `ovr` or `squad`
    - X10_84: includes `"84+ x10 upgrade"` or `"84 + x10 upgrade"` or `"84x10 upgrade"`
    - TOTW variant: includes `"84+ totw upgrade"` or `"84 + totw upgrade"` or `"totw upgrade"`
  - Submit: `#auto-sbc-recycle-submit` or any dialog button matching `submit|confirm|proceed|continue|ok` (case-insensitive)
  - Follow-up Cancel matching: `cancel|close|back|no thanks`

- CLICK_SEND_ALL
  - Buttons scanned (priority):
    - `button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action`
    - `button.btn-standard.call-to-action`
    - `button.section-header-btn`
    - `button.call-to-action`, `button`
  - Text needle: includes `"send all to club"` in `aria-label` or `textContent`

- CLICK_OPEN
  - Buttons scanned (priority):
    - `button.currency.call-to-action`
    - `button.btn-standard.call-to-action`
    - `button.call-to-action`, `button`
  - Text needle: includes `"open"` (from combined aria + text)

- QUICK_SELL_UNTRADEABLES
  - Unassigned dialog roots: `.ea-dialog-view.ea-dialog-view-type--message, .ea-dialog, .ut-dialog, [role="dialog"]`
  - "Take Me There" matching: exact match on text/aria: `"take me there"`
  - Ellipsis: `button.ut-image-button-control.ellipsis-btn` or buttons with aria/Title containing `more`/`options`
  - Bulk popup containers: `.ut-bulk-action-popup-view, .ut-bulk-action, .ut-bulk-actions, [role="menu"], .context-menu, .menu, ul[role="menu"]`
  - Popup actions: `button, [role="button"], [role="menuitem"]` (and nested spans)
  - Quick Sell label matching (tolerant): must contain both `quick sell` and `untrad(ea|a)ble`
  - Confirm OK dialog roots: `.dialog, .modal, .ut-dialog, .ea-dialog, [role="dialog"]`
  - OK/Confirm matching: `ok|okay|yes|confirm|accept|discard|sell|continue`


## 6) Timing and Waits (by handler)

- CLICK_RECYCLE
  - Scan up to 15s for `#auto-sbc-recycle`; idempotent guard 5s; small scroll-to-top delay 50ms.

- CLICK_SEND_ALL
  - Scan up to 25s; polling every ~250ms; small scroll-to-top delay 50ms.

- CLICK_OPEN
  - Scan up to 20s; polling every ~250ms; small scroll-to-top delay 50ms.

- RECYCLE_WORKFLOW
  - Open recycle: try up to 8s; stabilization 3s.
  - Container wait: up to 8s.
  - Select mode: up to 6s; stabilization 3s after select.
  - Before submit wait: 3s; submit attempts window: ~4s with 200ms cadence; post-submit stabilization: 3s.
  - Dismissal wait: up to 6s; follow-up AutoSBC wait: up to 8s; cancel dismissal wait: up to 6s.
  - Human click jitter: hovers/moves 3–6 steps; down-up 60–140ms; post-click dwells 120–220ms; click cooldown ~600ms.

- QUICK_SELL_UNTRADEABLES
  - Unassigned "Take Me There" search: up to 4s; dismissal wait up to 8s; settle 300ms.
  - Ellipsis search: up to 8s; stabilization 1.2s after click.
  - Popup search: up to 6s; retry path adds ~0.5s re-open.
  - Confirm OK search: primary up to 12s; retry path up to 6s; post-confirm stabilization 3s; dialog dismissal wait up to 6s.

- HOOK_PURCHASED_ITEMS
  - Injection immediate; no explicit waits in background; content script sets 10s timeout for response.


## 7) Diagnostics & Logging

- Background logs use tags: `[Automation][QS]`, `[Automation][RECYCLE]`, `[Automation][RECYCLE][wait]`, etc., with timings.
- Content logs around decisions: histogram prints, pass counters, error warnings on timeouts.
- On hook: events fired both as `CustomEvent` and `window.top.postMessage` for reliability across frames.


## 8) Orchestration Logic (Content Script)

- UI: Shadow DOM button + menu with run count; live badge updates (`running…`/`ready`).
- Loop per run: open pack -> handle Unassigned if present -> send all -> decide recycle mode from histograms -> perform recycle sequence(s) -> quick sell cleanup -> proceed.
- Decision examples:
  - After `OVR89`, refresh histogram from purchased/items; if `X10_84` criteria hold, perform up to 3 passes of `X10_84` recycle.
  - Direct `X10_84` mode: up to 3 passes while criteria hold; then quick sell.
- Messaging: all background calls wrapped with `withTimeout` and `callBg` (retries=2).


## 9) Verification Steps

- Load unpacked extension, open EA FC Web App packs screen.
- Start automation for small run count (e.g., 2–3).
- Expect:
  - Network hook logs on `/purchased/items` responses.
  - Open -> Send All -> Recycle dialog -> Submit -> Dismissal.
  - If follow-up AutoSBC appears, Cancel is clicked and quick sell starts.
  - Quick Sell flow shows ellipsis -> popup -> confirm -> dialog dismissed.
- Check console for `[Automation]` logs and aggregated results in responses.


## 10) Notes & Gotchas

- All DOM actions run in MAIN world; iframes supported by `allFrames: true` where applicable, with aggregation of results.
- Visibility/enabled checks guard against hidden/disabled states; click sequences simulate realistic user input with fallbacks to `.click()` and keyboard where safe.
- Avoids inline quick sell button when it isn’t part of the popup (to reduce accidental actions).
- Background may trigger `QUICK_SELL_UNTRADEABLES` automatically after canceling follow-up AutoSBC dialog during recycle.
