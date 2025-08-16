"use strict";

// Content Script: Injects a Shadow DOM overflow button on the EA FC Web App page.
// Keeps page pollution minimal and CSS isolated.

(function init() {
  const ROOT_ID = "ext-automation-root";
  const EXISTING = document.getElementById(ROOT_ID);
  if (EXISTING) return; // avoid double-injection

  const container = document.createElement("div");
  container.id = ROOT_ID;
  // Keep container inert to the page layout
  container.style.all = "initial";
  container.style.position = "fixed";
  container.style.top = "12px";
  container.style.left = "12px";
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
    <div id="ext-run-automation" class="ext-item action" role="menuitem">
      ▶ Run automation...
      <span class="ext-badge">prompt count</span>
    </div>
    <div class="ext-item" role="menuitem" aria-disabled="true">
      Automation (more steps)
      <span class="ext-badge">TODO</span>
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
    () => closeMenu(),
    { capture: true }
  );

  // --- Automation logic ---
  let isRunning = false;

  async function injectNetworkHook() {
    // Ask background to inject in MAIN world using chrome.scripting.executeScript
    try {
      const res = await chrome.runtime.sendMessage({ type: 'HOOK_PURCHASED_ITEMS' });
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

  async function runAutomation() {
    if (isRunning) return;
    isRunning = true;
    try {
      // Close menu so it doesn't overlay clicks
      closeMenu();
      injectNetworkHook();

      const input = prompt('Enter number of runs', '5');
      if (!input) return;
      const runs = Math.max(1, Math.min(50, parseInt(String(input).trim(), 10) || 0));
      if (!runs) return;

      for (let i = 0; i < runs; i++) {
        const iterStart = Date.now();
        const iterTimeoutMs = 45000; // watchdog for a single iteration
        const deadlineExceeded = () => (Date.now() - iterStart) > iterTimeoutMs;
        // 1) Click the Open button
        const openBtn = await waitForButton([
          'button.currency.call-to-action',
          'button.call-to-action',
          'button'
        ], 'Open', 8000);
        if (!openBtn) {
          console.warn('[Automation] Open button not found. Stopping.');
          break;
        }
        await clickElement(openBtn);
        if (deadlineExceeded()) {
          console.warn('[Automation] Iteration watchdog: deadline exceeded after clicking Open');
          await sleep(600);
          continue;
        }

        // 2) Wait for purchased/items after opening, then compute fast path
        let latestEvent = null;
        try {
          latestEvent = await oncePurchasedItems(12000);
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
              const res1 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'OVR89' });
              console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
              await sleep(1000);
              // Refresh histogram after OVR89 to decide next step
              let refreshed = null;
              try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
              const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
              console.log('[Automation] Histogram after OVR89:', hist2);
              // Run X10_84 repeatedly while criteria remain (safety cap 3), then quick sell
              let xHist = hist2;
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                const res2 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                await sleep(1000);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else if (mode === 'X10_84') {
              // Recycle X10_84 repeatedly while criteria hold
              let xHist = lastRatingHistogram || {};
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                const res = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                await sleep(1000);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else {
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            }
          } catch (e) {
            console.warn('[Automation] Fast-path action error:', e);
          }
          // If no items remain, redo this iteration so we open a new pack immediately
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after actions; redoing iteration to open a new pack.');
              i--; // do not consume a run; redo logic on the next loop
            }
          } catch {}
          await sleep(600);
          continue;
        }

        // 3) Click "Send All To Club" first
        let clicked = false;
        try {
          const res = await chrome.runtime.sendMessage({ type: 'CLICK_SEND_ALL' });
          clicked = !!(res && res.ok && res.clicked);
        } catch (e) {
          console.warn('[Automation] Background click attempt failed:', e);
        }

        if (!clicked) {
          // Fallback: try to find and click locally within 10s
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

        // Enforce order: after pressing Send All, wait 1s, then take action (stabilization)
        if (clicked) {
          if (deadlineExceeded()) {
            console.warn('[Automation] Iteration watchdog: deadline exceeded before post-send actions');
            await sleep(600);
            continue;
          }
          await sleep(1000);
          const hist = lastRatingHistogram || {};
          const mode = decideRecycleModeFromHistogram(hist);
          console.log('[Automation] Decision after Send All (using latest histogram):', { mode, hist });
          try {
            if (mode === 'OVR89') {
              const res1 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'OVR89' });
              console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
              await sleep(1000);
              // Refresh histogram after OVR89 to decide next step
              let refreshed = null;
              try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
              const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
              console.log('[Automation] Histogram after OVR89:', hist2);
              // Run X10_84 repeatedly while criteria remain (safety cap 3), then quick sell
              let xHist = hist2;
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                const res2 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                await sleep(1000);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else if (mode === 'X10_84') {
              // Recycle X10_84 repeatedly while criteria hold
              let xHist = lastRatingHistogram || {};
              for (let pass = 0; pass < 3; pass++) {
                if (!hasX10CriteriaFromHistogram(xHist)) break;
                const res = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                await sleep(1000);
                let ref = null;
                try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                console.log('[Automation] Histogram after X10_84 pass:', xHist);
              }
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            } else {
              const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
              console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
            }
          } catch (e) {
            console.warn('[Automation] Post-send action error:', e);
          }
          // If no items remain, redo this iteration so we open a new pack immediately
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after actions; redoing iteration to open a new pack.');
              i--; // do not consume a run; redo logic on the next loop
            }
          } catch {}
          await sleep(600);
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
                const res1 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'OVR89' });
                console.log('[Automation] RECYCLE_WORKFLOW OVR89 result:', res1);
                await sleep(1000);
                // Refresh histogram after OVR89 to decide next step
                let refreshed = null;
                try { refreshed = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after OVR89 within 8s:', e); }
                const hist2 = (refreshed && computeRatingHistogram(refreshed.data)) || lastRatingHistogram || hist;
                console.log('[Automation] Histogram after OVR89:', hist2);
                if (hasX10CriteriaFromHistogram(hist2)) {
                  let xHist = hist2;
                  for (let pass = 0; pass < 3; pass++) {
                    if (!hasX10CriteriaFromHistogram(xHist)) break;
                    const res2 = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                    console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res2);
                    await sleep(1000);
                    let ref = null;
                    try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                    xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                    console.log('[Automation] Histogram after X10_84 pass:', xHist);
                  }
                  const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
                  console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
                } else {
                  const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
                  console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
                }
              } else if (mode === 'X10_84') {
                // Recycle X10_84 repeatedly while criteria hold
                let xHist = lastRatingHistogram || {};
                for (let pass = 0; pass < 3; pass++) {
                  if (!hasX10CriteriaFromHistogram(xHist)) break;
                  const res = await chrome.runtime.sendMessage({ type: 'RECYCLE_WORKFLOW', mode: 'X10_84' });
                  console.log(`[Automation] RECYCLE_WORKFLOW X10_84 pass ${pass + 1} result:`, res);
                  await sleep(1000);
                  let ref = null;
                  try { ref = await oncePurchasedItems(8000); } catch (e) { console.warn('[Automation] No purchased/items after X10_84 within 8s:', e); }
                  xHist = (ref && computeRatingHistogram(ref.data)) || lastRatingHistogram || xHist;
                  console.log('[Automation] Histogram after X10_84 pass:', xHist);
                }
                const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
                console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
              } else {
                const q = await chrome.runtime.sendMessage({ type: 'QUICK_SELL_UNTRADEABLES' });
                console.log('[Automation] QUICK_SELL_UNTRADEABLES result:', q);
              }
            } catch (e) {
              console.warn('[Automation] Direct decision action error:', e);
            }
          } else {
            console.warn('[Automation] Send All not clicked and not all duplicates; will wait for next run.');
          }
          // If no items remain, redo this iteration so we open a new pack immediately
          try {
            const latest = (lastPurchasedItems && lastPurchasedItems.data) || null;
            const s = computeItemsStats(latest);
            if (s.available && s.totalItems === 0) {
              console.log('[Automation] No players/items remain after actions; redoing iteration to open a new pack.');
              i--; // do not consume a run; redo logic on the next loop
            }
          } catch {}
          await sleep(600);
          continue;
        }

        // Small delay between runs
        await sleep(600);
      }
    } finally {
      isRunning = false;
      closeMenu();
    }
  }

  // Bind menu item
  menu.addEventListener('click', (e) => {
    const target = e.target;
    const item = target && target.closest('#ext-run-automation');
    if (item) {
      e.stopPropagation();
      runAutomation();
    }
  });

  wrap.appendChild(button);
  wrap.appendChild(menu);
  shadow.appendChild(style);
  shadow.appendChild(wrap);
  document.documentElement.appendChild(container);

  // Always enable logging and hook injection so latest responses are printed on every GET/POST
  try { setupPurchasedItemsLogger(); } catch {}
  try { injectNetworkHook(); } catch {}

})();
