"use strict";

// Content Script: Injects a Shadow DOM overflow button on the EA FC Web App page.
// Keeps page pollution minimal and CSS isolated.

(function init() {
  // Only inject into the top frame to avoid duplicate overlays in iframes
  try { if (window.top !== window) return; } catch {}
  const ROOT_ID = "ext-automation-root";
  const EXISTING = document.getElementById(ROOT_ID);
  if (EXISTING) return; // avoid double-injection

  const container = document.createElement("div");
  container.id = ROOT_ID;
  // Keep container inert to the page layout
  container.style.all = "initial";
  container.style.position = "fixed";
  container.style.top = "12px";
  container.style.right = "12px"; // anchor to top-right to avoid off-screen overflow
  container.style.transform = "none";
  container.style.zIndex = "2147483647"; // on top
  // Allow interactions; Shadow DOM keeps styles isolated.
  container.style.pointerEvents = "auto";

  const shadow = container.attachShadow({ mode: "open" });

  // Styles scoped within the Shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    :host { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
    .ext-wrap { pointer-events: auto; }
    .ext-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,0.15);
      background: #111827;
      color: #F9FAFB;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      transition: transform 120ms ease, background 120ms ease;
      user-select: none;
    }
    .ext-button:hover { background: #0B1220; }
    .ext-button:active { transform: translateY(1px); }
    .ext-icon { font-size: 18px; line-height: 1; }

    .ext-menu {
      margin-top: 8px;
      position: absolute;
      right: 0;
      min-width: 240px;
      background: #111827;
      color: #F9FAFB;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.35);
      padding: 6px;
    }
    .ext-menu[hidden] { display: none; }

    .ext-item {
      padding: 10px 8px;
      border-radius: 6px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #9CA3AF;
    }
    .ext-item .ext-badge { margin-left: auto; font-size: 10px; color: #6B7280; }
    .ext-item.action { color: #F9FAFB; cursor: pointer; }
    .ext-item.action:hover { background: #0B1220; }

    /* High contrast and focus */
    .ext-button:focus-visible {
      outline: 2px solid #60A5FA;
      outline-offset: 2px;
    }
  `;

  const wrap = document.createElement("div");
  wrap.className = "ext-wrap";

  const button = document.createElement("button");
  button.className = "ext-button";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("title", "Automation");
  button.innerHTML = `<span class="ext-icon" aria-hidden="true">⋮</span><span>Automation</span>`;

  const menu = document.createElement("div");
  menu.className = "ext-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.innerHTML = `
    <div class="ext-item" role="group" aria-label="Automation controls">
      <span style="color:#F9FAFB">Runs</span>
      <input id="ext-run-count" type="number" min="1" value="5" style="margin-left:8px;width:56px;background:#0B1220;color:#F9FAFB;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px 8px;" />
      <button id="ext-start" class="ext-button" style="margin-left:8px;padding:8px 10px;">Start</button>
      <button id="ext-stop" class="ext-button" style="margin-left:6px;padding:8px 10px;background:#374151;">Stop</button>
      <span id="ext-opened-label" style="margin-left:8px;color:#9CA3AF;">Opened</span>
      <span id="ext-open-count" style="color:#F9FAFB;">0</span><span style="color:#6B7280;">/</span><span id="ext-open-total" style="color:#9CA3AF;">0</span>
      <span class="ext-badge" aria-live="polite" style="margin-left:8px;">ready</span>
    </div>
  `;

  function closeMenu() {
    if (!menu.hidden) {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  }

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  });

  // Click outside to close
  document.addEventListener(
    "click",
    (ev) => {
      try {
        // Only close if the click is truly outside our container/shadow root
        const path = (ev.composedPath && ev.composedPath()) || [];
        const inside = path.includes(container) || path.includes(shadow);
        if (inside) return;
        const t = ev.target;
        if (t && (t === container || (container.contains && container.contains(t)))) return;
      } catch {}
      closeMenu();
    },
    { capture: true }
  );

  // --- Automation logic ---
  let isRunning = false;
  let cancelRequested = false;

  async function injectNetworkHook() {
    // Ask background to inject in MAIN world using chrome.scripting.executeScript
    try {
      const res = await withTimeout(chrome.runtime.sendMessage({ type: 'HOOK_PURCHASED_ITEMS' }), 'HOOK_PURCHASED_ITEMS', 10000);
      if (!res || !res.ok) {
        console.warn('[Automation] Hook injection failed:', res && res.error);
      }
    } catch (e) {
      console.warn('[Automation] Hook injection error:', e);
    }
  }

  // Keep track of the latest purchased/items response and always print it
  let lastPurchasedItems = null;
  let lastRatingHistogram = {};
  function setupPurchasedItemsLogger() {
    window.addEventListener('EA_AUTOMATION_PURCHASED_ITEMS', (ev) => {
      try {
        lastPurchasedItems = ev && ev.detail;
        // Expose for manual inspection if needed
        try { window.__EA_lastPurchasedItems = lastPurchasedItems; } catch {}
        const d = lastPurchasedItems || {};
        console.log('[Automation] purchased/items (latest):', {
          source: d.source,
          url: d.url,
          data: d.data
        });
        const data = d.data || {};
        const itemsArr = extractItemsArray(data);
        const itemCount = Array.isArray(itemsArr) ? itemsArr.length : null;
        const duplicateCount = Array.isArray(data.duplicateItemIdList) ? data.duplicateItemIdList.length : null;
        const allDuplicates = (typeof itemCount === 'number' && typeof duplicateCount === 'number' && itemCount > 0 && duplicateCount === itemCount);
        console.log('[Automation] purchased/items summary (latest):', {
          itemCount,
          duplicateCount,
          dupLessThanItems: (typeof itemCount === 'number' && typeof duplicateCount === 'number') ? (duplicateCount < itemCount) : null,
          allDuplicates
        });
        // Rating histogram and deltas
        const hist = computeRatingHistogram(data);
        const delta = diffHistograms(lastRatingHistogram, hist);
        console.log('[Automation] rating histogram (latest):', hist);
        if (Object.keys(delta).length) {
          console.log('[Automation] rating histogram delta:', delta);
        }
        lastRatingHistogram = hist;
        try { window.__EA_lastRatingHistogram = lastRatingHistogram; } catch {}
      } catch (e) {
        console.warn('[Automation] Error logging purchased/items event:', e);
      }
    }, true);
  }

  // Bridge messages from subframes: the hook also postMessages the payload to the top window.
  // We listen here and re-dispatch the same CustomEvent in the top frame so existing listeners work.
  function setupPurchasedItemsBridge() {
    window.addEventListener('message', (ev) => {
      try {
        const msg = ev && ev.data;
        if (!msg || msg.__ea !== true || msg.type !== 'EA_AUTOMATION_PURCHASED_ITEMS') return;
        const payload = msg.payload;
        window.dispatchEvent(new CustomEvent('EA_AUTOMATION_PURCHASED_ITEMS', { detail: payload }));
      } catch {}
    }, true);
  }

  function oncePurchasedItems(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener('EA_AUTOMATION_PURCHASED_ITEMS', onEvt, true);
        reject(new Error('Timed out waiting for purchased/items response'));
      }, timeoutMs);
      function onEvt(ev) {
        clearTimeout(timer);
        window.removeEventListener('EA_AUTOMATION_PURCHASED_ITEMS', onEvt, true);
        try {
          const d = ev && ev.detail;
          console.log('[Automation] purchased/items response:', {
            source: d && d.source,
            url: d && d.url,
            data: d && d.data
          });
        } catch {}
        resolve(ev.detail);
      }
      window.addEventListener('EA_AUTOMATION_PURCHASED_ITEMS', onEvt, true);
    });
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function sleepLog(ms, label = 'sleep') {
    const t0 = Date.now();
    try { console.log(`[Automation][wait] ${label} start ms=${ms} at ${t0}`); } catch {}
    await sleep(ms);
    try { console.log(`[Automation][wait] ${label} end elapsed=${Date.now() - t0}ms`); } catch {}
  }

  // Wrap async operations with a timeout and structured logs to avoid indefinite hangs
  async function withTimeout(promise, label = 'op', timeoutMs = 20000) {
    const start = Date.now();
    try {
      const res = await Promise.race([
        promise,
        (async () => { await sleep(timeoutMs); throw new Error('timeout'); })()
      ]);
      try { console.log(`[Automation] ${label} completed in`, Date.now() - start, 'ms:', res); } catch {}
      return res;
    } catch (e) {
      try { console.warn(`[Automation] ${label} timeout/error after`, Date.now() - start, 'ms:', e); } catch {}
      return { ok: false, error: String((e && e.message) || e), timeout: true };
    }
  }

  // Unified background call with timeout and retries to keep flows resilient and non-blocking
  async function callBg(type, payload = {}, options = {}) {
    const {
      label = type,
      timeoutMs = 60000,
      retries = 2,
      waitBetweenMs = 800
    } = options || {};
    let attempt = 0;
    let last = null;
    while (attempt <= retries) {
      try {
        last = await withTimeout(chrome.runtime.sendMessage({ type, ...payload }), label + ` attempt ${attempt + 1}`, timeoutMs);
        if (last && last.ok) return last;
      } catch (e) {
        try { console.warn(`[Automation] ${label} attempt ${attempt + 1} failed:`, e); } catch {}
      }
      attempt++;
      if (attempt <= retries) await sleep(waitBetweenMs);
    }
    return last || { ok: false, error: 'no-response' };
  }

  async function doRecycle(mode, passLabel) {
    return callBg('RECYCLE_WORKFLOW', { mode }, { label: `RECYCLE_WORKFLOW ${passLabel || mode}`, timeoutMs: 15000, retries: 1, waitBetweenMs: 500 });
  }

  async function doQuickSell(passes = 1) {
    let last = null;
    for (let i = 0; i < passes; i++) {
      last = await callBg('QUICK_SELL_UNTRADEABLES', {}, { label: `QUICK_SELL_UNTRADEABLES pass ${i + 1}`, timeoutMs: 15000, retries: 1, waitBetweenMs: 500 });
      await sleepLog(350, `after QUICK_SELL pass ${i + 1}`);
    }
    return last;
  }

  // Helpers to compute rating histogram from response data
  function extractItemsArray(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.itemData)) return data.itemData;
    if (Array.isArray(data.itemList)) return data.itemList;
    return [];
  }

  function computeItemsStats(data) {
    try {
      const items = extractItemsArray(data);
      const totalItems = items.length;
      const dup = Array.isArray(data && data.duplicateItemIdList) ? data.duplicateItemIdList : [];
      const duplicateCount = dup.length;
      const allDuplicates = totalItems > 0 && duplicateCount === totalItems;
      return { available: true, totalItems, duplicateCount, allDuplicates };
    } catch {
      return { available: false, totalItems: 0, duplicateCount: 0, allDuplicates: false };
    }
  }

  function computeRatingHistogram(data) {
    const items = extractItemsArray(data);
    const hist = {};
    for (const it of items) {
      const r = Number(it && it.rating);
      if (Number.isFinite(r)) hist[r] = (hist[r] || 0) + 1;
    }
    return hist;
  }

  function decideRecycleModeFromHistogram(hist) {
    try {
      const keys = Object.keys(hist || {});
      const has90plus = keys.some((k) => Number(k) >= 90 && (hist[k] || 0) > 0);
      const count84 = (hist[84] || hist['84'] || 0);
      const any85 = (hist[85] || hist['85'] || 0) > 0;
      const any86 = (hist[86] || hist['86'] || 0) > 0;
      const any84to86 = count84 > 0 || any85 || any86;
      if (has90plus) return 'OVR89';
      if (count84 >= 4 || any84to86) return 'X10_84';
      return null;
    } catch { return null; }
  }

  function hasX10CriteriaFromHistogram(hist) {
    try {
      const count84 = (hist[84] || hist['84'] || 0);
      const any85 = (hist[85] || hist['85'] || 0) > 0;
      const any86 = (hist[86] || hist['86'] || 0) > 0;
      // Align with decideRecycleModeFromHistogram: X10_84 when we have enough 84s or any 85/86
      return count84 >= 4 || any85 || any86;
    } catch {
      return false;
    }
  }

  function diffHistograms(prev, curr) {
    const out = {};
    const keys = new Set([
      ...Object.keys(prev || {}),
      ...Object.keys(curr || {})
    ]);
    for (const k of keys) {
      const a = (prev && prev[k]) || 0;
      const b = (curr && curr[k]) || 0;
      const d = b - a;
      if (d !== 0) out[k] = d;
    }
    return out;
  }

  function isVisibleClickable(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    // Consider disabled attribute
    if ('disabled' in el && el.disabled) return false;
    return true;
  }

  // Scroll the inner unassigned view container (and page) to top to ensure header buttons are visible
  async function scrollUnassignedContainerToTop() {
    try {
      // Scroll the main document to top as a baseline
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
      try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}

      const root = document.querySelector('section.ut-unassigned-view.ui-layout-left, section.ut-unassigned-view, .ut-unassigned-view.ui-layout-left, .ut-unassigned-view');
      let scrolled = false;
      if (root) {
        // If the root itself scrolls, reset it
        try {
          const cs = getComputedStyle(root);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && root.scrollHeight > root.clientHeight + 4) {
            root.scrollTop = 0;
            scrolled = true;
          }
        } catch {}
        // Also reset obvious scrollable descendants
        const kids = root.querySelectorAll('*');
        for (const el of kids) {
          try {
            const cs = getComputedStyle(el);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
              el.scrollTop = 0;
              scrolled = true;
            }
          } catch {}
        }
      }
      // Nudge likely header buttons into view
      try {
        const send = document.querySelector('button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action, button.btn-standard.call-to-action');
        if (send) send.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      } catch {}
      await sleep(120);
      return scrolled;
    } catch {
      return false;
    }
  }

  // Try to resolve transient states when no Open button is visible.
  // - Click generic OK/Confirm dialogs if present
  // - Try Quick Sell flow (short timeout)
  // - Try Send All to Club (short timeout)
  // Returns true if any recovery action was taken.
  async function attemptRecoveryBeforeStop() {
    try {
      // 1) Generic confirmation dialogs: OK / Confirm / Continue
      const confirmBtn = await waitForButton([
        'button',
        '[role="button"]',
      ], '', 1500);
      if (confirmBtn) {
        const label = ((confirmBtn.getAttribute('aria-label') || confirmBtn.textContent || '').trim().toLowerCase());
        if (label === 'ok' || label.includes('ok ') || label.includes('confirm') || label.includes('continue') || label.includes('proceed')) {
          await clickElement(confirmBtn);
          console.log('[Automation][recovery] Clicked generic confirm/ok');
          await sleep(400);
          return true;
        }
      }

      // 2) Try a quick, single-attempt Quick Sell to clear confirmations
      try {
        const qs = await callBg('QUICK_SELL_UNTRADEABLES', {}, { label: 'QUICK_SELL_UNTRADEABLES recovery', timeoutMs: 12000, retries: 0 });
        if (qs && qs.ok) {
          console.log('[Automation][recovery] QUICK_SELL_UNTRADEABLES took action');
          await sleep(400);
          return true;
        }
      } catch {}

      // 3) Try Send All To Club quickly
      try {
        await scrollUnassignedContainerToTop();
        const send = await callBg('CLICK_SEND_ALL', {}, { label: 'CLICK_SEND_ALL recovery', timeoutMs: 8000, retries: 0 });
        if (send && send.ok && send.clicked) {
          console.log('[Automation][recovery] CLICK_SEND_ALL clicked');
          await sleep(400);
          return true;
        }
        // Local quick check (short)
        await scrollUnassignedContainerToTop();
        const sendBtn = await waitForButton([
          'button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action',
          'button.btn-standard.call-to-action',
          'button'
        ], 'Send All To Club', 2000);
        if (sendBtn) {
          await clickElement(sendBtn);
          console.log('[Automation][recovery] Local Send All clicked');
          await sleep(400);
          return true;
        }
      } catch {}

      // 4) Recycle entry present? If our recycle button is visible, we'll prefer to decide via histogram
      try {
        await scrollUnassignedContainerToTop();
        const recycleBtn = document.querySelector('#auto-sbc-recycle');
        if (recycleBtn && isVisibleClickable(recycleBtn)) {
          const mode = decideRecycleModeFromHistogram(lastRatingHistogram || {});
          if (mode) {
            const res = await doRecycle(mode, 'recovery');
            console.log('[Automation][recovery] RECYCLE_WORKFLOW result:', res);
            await sleep(400);
            return true;
          }
        }
      } catch {}

      return false;
    } catch {
      return false;
    }
  }

  // Detect and handle the "Unassigned Items Remain" dialog
  async function handleUnassignedDialogIfPresent(timeoutMs = 6000) {
    const start = Date.now();
    const findDialog = () => {
      const roots = document.querySelectorAll('.ea-dialog-view.ea-dialog-view-type--message, .ea-dialog, .ut-dialog, [role="dialog"]');
      for (const root of roots) {
        const titleEl = root.querySelector('.ea-dialog-view--title, h1, h2');
        const bodyEl = root.querySelector('.ea-dialog-view--msg, .ea-dialog-view--body, p');
        const titleText = (titleEl && (titleEl.textContent || '')) || '';
        const bodyText = (bodyEl && (bodyEl.textContent || '')) || '';
        const combined = `${titleText} ${bodyText}`.toLowerCase();
        if (combined.includes('unassigned items remain') || combined.includes('unassigned pile')) {
          // Find Take Me There
          const btns = root.querySelectorAll('button, [role="button"], [role="menuitem"]');
          for (const b of btns) {
            const t = (b.textContent || '').trim().toLowerCase();
            const a = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
            if (t === 'take me there' || a === 'take me there') return b;
          }
          const spans = root.querySelectorAll('span, div, a');
          for (const sp of spans) {
            const t = (sp.textContent || '').trim().toLowerCase();
            const a = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
            if (t === 'take me there' || a === 'take me there') {
              return sp.closest('button, [role="button"], [role="menuitem"]') || sp;
            }
          }
        }
      }
      return null;
    };
    let btn = null;
    while (!btn && Date.now() - start < timeoutMs) {
      btn = findDialog();
      if (!btn) await sleep(200);
    }
    if (!btn) return false;
    await clickElement(btn);
    console.log('[Automation] Unassigned dialog: Take Me There clicked');
    // Wait for the dialog to be gone
    const t2 = Date.now();
    const dialogGone = () => !document.querySelector('.ea-dialog-view.ea-dialog-view-type--message, .ea-dialog, .ut-dialog, [role="dialog"]');
    while (!dialogGone() && Date.now() - t2 < 8000) {
      await sleep(200);
    }
    await sleep(300);
    return true;
  }

  async function waitForButton(selectors, textIncludes, timeoutMs = 8000) {
    const start = Date.now();
    const needle = textIncludes ? String(textIncludes).toLowerCase() : "";
    while (Date.now() - start < timeoutMs) {
      for (const sel of selectors) {
        const nodes = document.querySelectorAll(sel);
        for (const el of nodes) {
          const t = (el.textContent || '').trim().toLowerCase();
          const t1 = (el.getAttribute('aria-label') || '').toLowerCase();
          const txtSpan = el.querySelector('.text');
          const subSpan = el.querySelector('.subtext');
          const has = !needle || t.includes(needle) || t1.includes(needle) ||
            (txtSpan && (txtSpan.textContent || '').toLowerCase().includes(needle)) ||
            (subSpan && (subSpan.textContent || '').toLowerCase().includes(needle));
          if (has && isVisibleClickable(el)) {
            return el;
          }
        }
      }
      await sleep(200);
    }
    return null;
  }

  async function clickElement(el) {
    if (!el) return false;
    // Ensure visible
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    await sleep(150);

    const rect = el.getBoundingClientRect();
    const cx = Math.floor(rect.left + rect.width / 2);
    const cy = Math.floor(rect.top + rect.height / 2);
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };

    // Prefer the actual clickable target at the point
    const pointEl = document.elementFromPoint(cx, cy) || el;
    const targetEl = pointEl.closest('button, [role="button"], .call-to-action, .currency') || pointEl || el;

    // Hover sequence
    try { targetEl.dispatchEvent(new PointerEvent('pointerover', opts)); } catch {}
    try { targetEl.dispatchEvent(new MouseEvent('mouseover', opts)); } catch {}
    try { targetEl.dispatchEvent(new PointerEvent('pointerenter', opts)); } catch {}
    try { targetEl.dispatchEvent(new MouseEvent('mouseenter', opts)); } catch {}
    await sleep(20);

    // Press sequence on both target and original (to satisfy various handlers)
    const press = (n) => {
      try { n.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch {}
      try { n.dispatchEvent(new MouseEvent('mousedown', opts)); } catch {}
      try { n.dispatchEvent(new PointerEvent('pointerup', opts)); } catch {}
      try { n.dispatchEvent(new MouseEvent('mouseup', opts)); } catch {}
      try { n.dispatchEvent(new MouseEvent('click', opts)); } catch {}
    };
    press(targetEl);
    if (targetEl !== el) press(el);

    await new Promise(requestAnimationFrame);
    return true;
  }

  // Attempt to open the next pack quickly after finishing actions.
  // Tries background click first, then a short local fallback.
  async function tryOpenNextPackAtEnd(maxLocalWaitMs = 3000) {
    try {
      const res = await withTimeout(chrome.runtime.sendMessage({ type: 'CLICK_OPEN' }), 'CLICK_OPEN (post-actions)', 5000);
      if (res && res.ok && res.clicked) {
        console.log('[Automation] CLICK_OPEN succeeded immediately after actions');
        return true;
      }
    } catch (e) {
      try { console.warn('[Automation] Background CLICK_OPEN (post-actions) error:', e); } catch {}
    }
    // Short local fallback
    const openBtn = await waitForButton([
      'button.currency.call-to-action',
      'button.call-to-action',
      'button'
    ], 'Open', Math.max(0, Math.min(3000, maxLocalWaitMs)));
    if (openBtn) {
      const clicked = await clickElement(openBtn);
      if (clicked) {
        console.log('[Automation] Local Open clicked immediately after actions');
        return true;
      }
    }
    return false;
  }

  async function runAutomation(runsParam) {
    if (isRunning) return;
    isRunning = true;
    setRunningUI(true);
    try {
      // Close menu so it doesn't overlay clicks
      closeMenu();
      await injectNetworkHook();
      // small stabilization to ensure fetch/XHR are patched
      await sleep(120);
      const runs = Math.max(1, parseInt(String(runsParam ?? 5), 10) || 5);
      let opened = 0;
      resetOpenCounter(runs);
      let preOpened = false; // if true, a next pack was opened at the end of the previous loop

      while (opened < runs) {
        console.log(`[Automation] ==== Run ${opened + 1}/${runs} start ====`);
        if (cancelRequested) { console.warn('[Automation] Cancel requested; stopping.'); break; }
        const iterStart = Date.now();
        const iterTimeoutMs = 120000; // watchdog for a single iteration (extended for recycle/quick sell passes)
        const deadlineExceeded = () => (Date.now() - iterStart) > iterTimeoutMs;
        // Prepare listener BEFORE clicking to avoid race with fast network
        const purchasedWait = oncePurchasedItems(12000);
        // 1) Click the Open button (prefer background MAIN-world click), or consume a pre-opened click
        let openClicked = false;
        let didOpen = false;
        if (preOpened) {
          didOpen = true;
          preOpened = false;
        } else {
          try {
            const res = await withTimeout(chrome.runtime.sendMessage({ type: 'CLICK_OPEN' }), 'CLICK_OPEN', 20000);
            openClicked = !!(res && res.ok && res.clicked);
            didOpen = didOpen || openClicked;
          } catch (e) {
            console.warn('[Automation] Background CLICK_OPEN error:', e);
          }
          if (!openClicked) {
            // Fallback: try locally (shorter wait to avoid long stalls)
            const openBtn = await waitForButton([
              'button.currency.call-to-action',
              'button.call-to-action',
              'button'
            ], 'Open', 4000);
            if (!openBtn) {
              console.warn('[Automation] Open button not found. Attempting recovery before stopping...');
              const recovered = await attemptRecoveryBeforeStop();
              if (recovered) {
                // Give the UI a moment and try next iteration instead of stopping
                await sleep(300);
                continue;
              }
              // Final guard: ensure there is truly no quick sell or recycle available
              const quickCheckSend = await waitForButton([
                'button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action',
                'button.btn-standard.call-to-action',
                'button'
              ], 'Send All To Club', 1200);
              const recycleVisible = !!(document.querySelector('#auto-sbc-recycle') && isVisibleClickable(document.querySelector('#auto-sbc-recycle')));
              if (quickCheckSend || recycleVisible) {
                console.warn('[Automation] Recovery hint found (send-all or recycle). Continuing loop.');
                await sleep(300);
                continue;
              }
              console.warn('[Automation] Open button not found and no recovery actions available. Stopping.');
              break;
            }
            const localClicked = await clickElement(openBtn);
            if (localClicked) didOpen = true;
          }
        }
        if (didOpen) {
          opened++;
          updateOpenCounter(opened, runs);
        }
        if (deadlineExceeded()) {
          console.warn('[Automation] Iteration watchdog: deadline exceeded after clicking Open');
          {
            const openedNext = await tryOpenNextPackAtEnd(2500);
            if (openedNext) preOpened = true;
            await sleep(openedNext ? 350 : 300);
          }
          continue;
        }

        // Stabilize after opening the pack before proceeding
        await sleepLog(987, 'post-open-stabilize');

        // Handle Unassigned dialog immediately after Open
        const diverted = await handleUnassignedDialogIfPresent(6000);
        if (diverted) {
          console.log('[Automation] Unassigned dialog handled; jumping to Quick Sell flow');
          try {
            const q = await doQuickSell();
            console.log('[Automation] QUICK_SELL_UNTRADEABLES result (after Unassigned):', q);
          } catch (e) {
            console.warn('[Automation] QUICK_SELL_UNTRADEABLES error (after Unassigned):', e);
          }
          // If no items remain, proceed to the next open attempt
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after Unassigned quick sell; continuing to next open.');
            }
          } catch {}
          {
            const openedNext = await tryOpenNextPackAtEnd(2500);
            if (openedNext) preOpened = true;
            await sleep(openedNext ? 350 : 300);
          }
          continue;
        }

        // 2) Wait for purchased/items after opening, then compute fast path
        let latestEvent = null;
        try {
          latestEvent = await purchasedWait;
        } catch (e) {
          console.warn('[Automation] No purchased/items event after Open within 12s:', e);
        }
        const latestData = (latestEvent && latestEvent.data) || ((lastPurchasedItems && lastPurchasedItems.data) || null);
        const stats = computeItemsStats(latestData);
        console.log('[Automation] items stats after Open:', stats);
        const shouldHaveSendAll = stats.available ? (stats.totalItems > 0 && stats.duplicateCount < stats.totalItems) : null;
        console.log('[Automation] Should Send All To Club button exist?', {
          shouldExist: shouldHaveSendAll,
          reason: stats.available ? (stats.allDuplicates ? 'all-duplicates (no items to send)' : (stats.totalItems === 0 ? 'no items yet' : 'has non-duplicates (items to send)')) : 'unknown (no latest purchased/items)',
          totalItems: stats.totalItems,
          duplicateCount: stats.duplicateCount
        });
        if (stats.available && stats.allDuplicates) {
          const hist = lastRatingHistogram || {};
          const mode = decideRecycleModeFromHistogram(hist);
          console.log('[Automation] All duplicates detected; skipping Send All. Decision:', { mode, hist });
          try {
            if (mode === 'OVR89') {
              const res1 = await doRecycle('OVR89');
              console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
              await sleepLog(987, 'after OVR89 recycle');
              // Refresh histogram after OVR89 to decide next step
              let refreshed = null;
              try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
              const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
              console.log('[Automation] Histogram after OVR89:', hist2);
              if (hasX10CriteriaFromHistogram(hist2)) {
                let xHist = hist2;
                for (let pass = 0; pass < 3; pass++) {
                  if (!hasX10CriteriaFromHistogram(xHist)) break;
                  const res2 = await doRecycle('X10_84', 'X10_84');
                  console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                  await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                  let ref = null;
                  try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                  xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                  console.log('[Automation] Histogram after X10_84 pass:', xHist);
                }
              }
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else if (mode === 'X10_84') {
              // Recycle X10_84 repeatedly while criteria hold
              let xHist = lastRatingHistogram || {};
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                const res = await doRecycle('X10_84', 'X10_84');
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else {
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            }
          } catch (e) {
            console.warn('[Automation] Fast-path action error:', e);
          }
          // If no items remain, proceed quickly to next open
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after actions; continuing to next open.');
            }
          } catch {}
          {
            const openedNext = await tryOpenNextPackAtEnd(2500);
            if (openedNext) preOpened = true;
            await sleep(openedNext ? 350 : 300);
          }
          continue;
        }

        // 3) Click "Send All To Club" first
        let clicked = false;
        try {
          await scrollUnassignedContainerToTop();
          const res = await withTimeout(chrome.runtime.sendMessage({ type: 'CLICK_SEND_ALL' }), 'CLICK_SEND_ALL', 15000);
          clicked = !!(res && res.ok && res.clicked);
        } catch (e) {
          console.warn('[Automation] Background click attempt failed:', e);
        }

        if (!clicked) {
          // Fallback: try to find and click locally within 10s
          await scrollUnassignedContainerToTop();
          const sendBtn = await waitForButton([
            'button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action',
            'button.btn-standard.call-to-action',
            'button'
          ], 'Send All To Club', 10000);
          if (sendBtn) {
            await clickElement(sendBtn);
            clicked = true;
          }
        }

        // Enforce order: after pressing Send All, wait 3s, then take action (stabilization)
        if (clicked) {
          if (deadlineExceeded()) {
            console.warn('[Automation] Iteration watchdog: deadline exceeded before post-send actions');
            await sleep(600);
            continue;
          }
          await sleepLog(987, 'post-send-stabilize');
          try {
            const hist = lastRatingHistogram || {};
            const mode = decideRecycleModeFromHistogram(hist);
            console.log('[Automation] Post-send decision:', { mode, hist });

            if (mode === 'OVR89') {
              await scrollUnassignedContainerToTop();
              const res1 = await doRecycle('OVR89');
              console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
              await sleepLog(987, 'after OVR89 recycle');
              // Refresh histogram after OVR89 to decide next step
              let refreshed = null;
              try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
              const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
              console.log('[Automation] Histogram after OVR89:', hist2);
              if (hasX10CriteriaFromHistogram(hist2)) {
                let xHist = hist2;
                for (let pass = 0; pass < 3; pass++) {
                  if (!hasX10CriteriaFromHistogram(xHist)) break;
                  await scrollUnassignedContainerToTop();
                  const res2 = await doRecycle('X10_84', 'X10_84');
                  console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                  await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                  let ref = null;
                  try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                  xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                  console.log('[Automation] Histogram after X10_84 pass:', xHist);
                }
              }
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else if (mode === 'X10_84') {
              // Recycle X10_84 repeatedly while criteria hold
              let xHist = lastRatingHistogram || {};
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                await scrollUnassignedContainerToTop();
                const res = await doRecycle('X10_84', 'X10_84');
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else {
              const q = await doQuickSell();
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            }
          } catch (e) {
            console.warn('[Automation] Post-send action error:', e);
          }
          // If no items remain, proceed to the next open attempt (opened count is unchanged)
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after actions; continuing to next open.');
            }
          } catch {}
          {
            const openedNext = await tryOpenNextPackAtEnd(2500);
            if (openedNext) preOpened = true;
            await sleep(openedNext ? 350 : 300);
          }
          continue;
        }

        // Case: No Send All button → only decide directly if all duplicates; otherwise do nothing (wait for next run)
        if (!clicked) {
          const latestData2 = (lastPurchasedItems && lastPurchasedItems.data) || null;
          const stats2 = computeItemsStats(latestData2);
          console.log('[Automation] Re-check items stats (no Send All clicked):', stats2);
          if (stats2.available && stats2.allDuplicates) {
            if (deadlineExceeded()) {
              console.warn('[Automation] Iteration watchdog: deadline exceeded before direct decision actions');
              await sleep(600);
              continue;
            }
            const hist = lastRatingHistogram || {};
            const mode = decideRecycleModeFromHistogram(hist);
            console.log('[Automation] No Send All; all duplicates. Deciding directly:', { mode, hist });
            try {
              if (mode === 'OVR89') {
                await scrollUnassignedContainerToTop();
                const res1 = await doRecycle('OVR89');
                console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
                await sleepLog(987, 'after OVR89 recycle');
                // Refresh histogram after OVR89 to decide next step
                let refreshed = null;
                try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
                const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
                console.log('[Automation] Histogram after OVR89:', hist2);
                if (hasX10CriteriaFromHistogram(hist2)) {
                  let xHist = hist2;
                  for (let pass = 0; pass < 3; pass++) {
                    if (!hasX10CriteriaFromHistogram(xHist)) break;
                    await scrollUnassignedContainerToTop();
                    const res2 = await doRecycle('X10_84', 'X10_84');
                    console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                    await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                    let ref = null;
                    try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                    xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                    console.log('[Automation] Histogram after X10_84 pass:', xHist);
                  }
                }
                const q = await doQuickSell();
                console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
              } else if (mode === 'X10_84') {
                // Recycle X10_84 repeatedly while criteria hold
                let xHist = lastRatingHistogram || {};
                for (let pass = 0; pass < 3; pass++) {
                  if (!hasX10CriteriaFromHistogram(xHist)) break;
                  await scrollUnassignedContainerToTop();
                  const res = await doRecycle('X10_84', 'X10_84');
                  console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                  await sleepLog(987, `after X10_84 pass ${pass + 1}`);
                  let ref = null;
                  try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                  xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                  console.log('[Automation] Histogram after X10_84 pass:', xHist);
                }
                const q = await doQuickSell();
                console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
              } else {
                const q = await doQuickSell();
                console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
              }
            } catch (e) {
              console.warn('[Automation] Direct decision action error:', e);
            }
            // If no items remain, proceed to the next open attempt (opened count is unchanged)
            try {
              const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
              const s = computeItemsStats(latest);
              if (s.available && s.totalItems === 0) {
                console.log('[Automation] No players/items remain after actions; continuing to next open.');
              }
            } catch {}
            {
              const openedNext = await tryOpenNextPackAtEnd(2500);
              if (openedNext) preOpened = true;
              await sleep(openedNext ? 350 : 300);
            }
            continue;
          }
        }

        // Small delay between runs
        await sleep(600);
        console.log(`[Automation] ==== Run ${opened}/${runs} end ====`);
      }
    } finally {
      isRunning = false;
      setRunningUI(false);
      closeMenu();
    }
  }

  // Bind controls: Start/Stop with live state
  const runInput = menu.querySelector('#ext-run-count');
  const startBtn = menu.querySelector('#ext-start');
  const stopBtn = menu.querySelector('#ext-stop');
  const badge = menu.querySelector('.ext-badge');
  const openCountSpan = menu.querySelector('#ext-open-count');
  const openTotalSpan = menu.querySelector('#ext-open-total');

  function updateOpenCounter(opened, total) {
    try {
      if (openCountSpan) openCountSpan.textContent = String(opened);
      if (openTotalSpan) openTotalSpan.textContent = String(total);
    } catch {}
  }

  function resetOpenCounter(total) {
    updateOpenCounter(0, total);
  }

  function setRunningUI(running) {
    try {
      isRunning = !!running;
      if (startBtn) startBtn.disabled = running;
      if (stopBtn) stopBtn.disabled = !running;
      if (badge) badge.textContent = running ? 'running…' : 'ready';
    } catch {}
  }
  setRunningUI(false);

  if (startBtn) startBtn.addEventListener('click', () => {
    if (isRunning) return;
    cancelRequested = false;
    const val = (runInput && runInput.value) ? parseInt(runInput.value, 10) : 5;
    const runs = Math.max(1, Number.isFinite(val) ? val : 5);
    runAutomation(runs).catch((e) => { try { console.warn('[Automation] runAutomation error:', e); } catch {} });
  });
  if (stopBtn) stopBtn.addEventListener('click', () => {
    cancelRequested = true;
    setRunningUI(true); // still running until loop checks cancel
  });

  wrap.appendChild(button);
  wrap.appendChild(menu);
  shadow.appendChild(style);
  shadow.appendChild(wrap);
  document.documentElement.appendChild(container);

  // Always enable logging and hook injection so latest responses are printed on every GET/POST
  try { setupPurchasedItemsLogger(); } catch {}
  try { setupPurchasedItemsBridge(); } catch {}
  try { injectNetworkHook(); } catch {}

})();
