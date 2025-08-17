"use strict";

// Background service worker (stateless, MV3)
// Minimal message bus scaffold for future automation features.

let __x10AltToggle = false; // alternates X10_84 between x10 and TOTW

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("EA FC Automation: Installed");
  } else if (details.reason === "update") {
    console.log("EA FC Automation: Updated from", details.previousVersion);
  }
});

// Example message handler (request/response contract)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!message || typeof message !== "object") return; // ignore

    if (message.type === "PING") {
      sendResponse({ ok: true, data: "PONG" });
      return; // keep listener synchronous
    }

    if (message.type === "CLICK_RECYCLE") {
      const tabId = sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for click injection" });
        return;
      }
      chrome.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            async function sleepLog(ms, label = 'qs-sleep') {
              const t0 = Date.now();
              try { console.log(`[Automation][QS][wait] ${label} start ms=${ms} at ${t0}`); } catch {}
              await sleep(ms);
              try { console.log(`[Automation][QS][wait] ${label} end elapsed=${Date.now() - t0}ms`); } catch {}
            }
            // Idempotent guard to avoid double clicking within a short window
            if (window.__ea_recycleClickedRecently && Date.now() - window.__ea_recycleClickedRecently < 5000) {
              return { clicked: false, skipped: true };
            }
            const sel = '#auto-sbc-recycle';
            const isVisible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') return false;
              const r = el.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const isEnabled = (el) => {
              if (el.matches('[disabled], [aria-disabled="true"]')) return false;
              const cls = el.className || '';
              if (/\bdisabled\b|\bis-disabled\b|\bbtn-disabled\b/i.test(cls)) return false;
              return true;
            };
            const highlight = (el) => {
              try {
                const r = el.getBoundingClientRect();
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = r.left + 'px';
                div.style.top = r.top + 'px';
                div.style.width = r.width + 'px';
                div.style.height = r.height + 'px';
                div.style.border = '2px solid #00e5ff';
                div.style.borderRadius = '6px';
                div.style.zIndex = '2147483647';
                div.style.pointerEvents = 'none';
                div.style.boxShadow = '0 0 12px rgba(0,229,255,0.8)';
                document.documentElement.appendChild(div);
                setTimeout(() => div.remove(), 1200);
              } catch {}
            };
            const singleClick = (el, cx, cy) => {
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              try { el.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousemove', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('click', base)); } catch {}
            };
            const scrollToTop = async () => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}
              try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch {}
              try { if (document.body) document.body.scrollTop = 0; } catch {}
              await sleep(50);
            };
            await scrollToTop();
            const start = Date.now();
            while (Date.now() - start < 15000) {
              const el = document.querySelector(sel);
              if (el && isVisible(el) && isEnabled(el)) {
                el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
                const r = el.getBoundingClientRect();
                const cx = Math.max(0, Math.floor(r.left + r.width / 2));
                const cy = Math.max(0, Math.floor(r.top + r.height / 2));
                highlight(el);
                singleClick(el, cx, cy);
                window.__ea_recycleClickedRecently = Date.now();
                return { clicked: true };
              }
              await sleep(250);
            }
            return { clicked: false };
          },
        })
        .then((results) => {
          const any = Array.isArray(results) && results.some((r) => r && r.result && r.result.clicked);
          sendResponse({ ok: true, clicked: !!any });
        })
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (message.type === "QUICK_SELL_UNTRADEABLES") {
      const tabId = message.tabId || sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for quick sell injection" });
        return;
      }
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            async function sleepLog(ms, label = 'qs-sleep') {
              const t0 = Date.now();
              try { console.log(`[Automation][QS][wait] ${label} start ms=${ms} at ${t0}`); } catch {}
              await sleep(ms);
              try { console.log(`[Automation][QS][wait] ${label} end elapsed=${Date.now() - t0}ms`); } catch {}
            }
            // Allow running in all frames; only frames containing elements will act
            if (window.__ea_qs_inflight) {
              return { skipped: true, reason: 'inflight' };
            }
            window.__ea_qs_inflight = true;
            const finish = (res) => { try { window.__ea_qs_inflight = false; } catch {} return res; };
            try {
            const isVisible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') return false;
              const r = el.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const isEnabled = (el) => {
              if (el.matches('[disabled], [aria-disabled="true"]')) return false;
              const cls = el.className || '';
              if (/\bdisabled\b|\bis-disabled\b|\bbtn-disabled\b/i.test(cls)) return false;
              return true;
            };
            const highlight = (el) => {
              try {
                const r = el.getBoundingClientRect();
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = r.left + 'px';
                div.style.top = r.top + 'px';
                div.style.width = r.width + 'px';
                div.style.height = r.height + 'px';
                div.style.border = '2px solid #00e5ff';
                div.style.borderRadius = '6px';
                div.style.zIndex = '2147483647';
                div.style.pointerEvents = 'none';
                div.style.boxShadow = '0 0 12px rgba(0,229,255,0.8)';
                document.documentElement.appendChild(div);
                setTimeout(() => div.remove(), 1200);
              } catch {}
            };
            const dispatchAll = (el, cx, cy) => {
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              try { el.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousemove', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('click', base)); } catch {}
            };
            const clickEl = async (el) => {
              if (!el || !isVisible(el) || !isEnabled(el)) return false;
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              await sleep(40);
              const r = el.getBoundingClientRect();
              const cx = Math.max(0, Math.floor(r.left + r.width / 2));
              const cy = Math.max(0, Math.floor(r.top + r.height / 2));
              const topEl = document.elementFromPoint(cx, cy) || el;
              const target = topEl.closest('button, [role="button"], [role="menuitem"], .call-to-action, .btn-standard') || topEl || el;
              highlight(target);
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              // Minimal, single click sequence to avoid app instability
              try { target.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              await sleep(20);
              try { target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { target.dispatchEvent(new MouseEvent('click', base)); } catch {}
              // Last resort programmatic click
              try { target.click && target.click(); } catch {}
              await sleep(120);
              return true;
            };
            const textOf = (n) => (n && (n.textContent || n.innerText || '') || '').trim().toLowerCase();
            const findByText = (pred) => {
              const sels = ['button', '[role="button"]', '[role="menuitem"]', '.btn-standard', '.call-to-action', '.currency-coins'];
              const nodes = [];
              for (const s of sels) nodes.push(...document.querySelectorAll(s));
              // De-dup
              const seen = new Set();
              for (const n of nodes) {
                if (!n || seen.has(n)) continue;
                seen.add(n);
                const txt = textOf(n);
                const aria = (n.getAttribute && (n.getAttribute('aria-label') || '') || '').toLowerCase();
                if (pred(txt, n, aria)) return n;
              }
              // Also inspect spans that might carry the label
              const spans = Array.from(document.querySelectorAll('span, div, a'));
              for (const sp of spans) {
                const t = textOf(sp);
                const aria = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                if (pred(t, sp, aria)) return sp.closest('button, [role="button"], [role="menuitem"]') || sp;
              }
              return null;
            };
            const scrollToTop = async () => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}
              try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch {}
              try { if (document.body) document.body.scrollTop = 0; } catch {}
              await sleep(50);
            };
            // Wait for the bulk action popup container (deep across shadow DOM)
            const waitForBulkPopup = async (ms = 6000) => {
              const containerSelectors = [
                '.ut-bulk-action-popup-view',
                '.ut-bulk-action',
                '.ut-bulk-actions',
                '[role="menu"]',
                '.context-menu',
                '.menu',
                'ul[role="menu"]'
              ];
              const deepFind = () => {
                const results = [];
                const scan = (root) => {
                  for (const sel of containerSelectors) {
                    try { results.push(...root.querySelectorAll(sel)); } catch {}
                  }
                  let nodes = [];
                  try { nodes = root.querySelectorAll('*'); } catch {}
                  for (const el of nodes) {
                    if (el && el.shadowRoot) scan(el.shadowRoot);
                  }
                };
                scan(document);
                // Prefer visible and floating (not hidden in layout)
                return results.find((n) => n && isVisible(n)) || null;
              };
              const start = Date.now();
              while (Date.now() - start < ms) {
                const c = deepFind();
                if (c) return c;
                await sleep(150);
              }
              return null;
            };
            // Pre-step: handle "Unassigned Items Remain" dialog if present
            let takeMeThereClicked = false;
            const matchTakeMeThere = (txt, aria) => {
              const t = (txt || '').trim().toLowerCase();
              const a = (aria || '').trim().toLowerCase();
              return t === 'take me there' || a === 'take me there';
            };
            const findUnassignedDialogTakeMeThere = () => {
              const roots = Array.from(document.querySelectorAll('.ea-dialog-view.ea-dialog-view-type--message, .ea-dialog, .ut-dialog, [role="dialog"]'));
              for (const root of roots) {
                const titleEl = root.querySelector('.ea-dialog-view--title, h1, h2');
                const bodyEl = root.querySelector('.ea-dialog-view--msg, .ea-dialog-view--body, p');
                const titleText = (titleEl && (titleEl.textContent || '')) || '';
                const bodyText = (bodyEl && (bodyEl.textContent || '')) || '';
                const combined = `${titleText} ${bodyText}`.toLowerCase();
                if (combined.includes('unassigned items remain') || combined.includes('unassigned pile')) {
                  // find the Take Me There button
                  const btns = Array.from(root.querySelectorAll('button, [role="button"], [role="menuitem"]'));
                  for (const b of btns) {
                    const txt = (b.textContent || '').trim().toLowerCase();
                    const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                    if (matchTakeMeThere(txt, aria) && isVisible(b) && isEnabled(b)) return b;
                  }
                  // also scan spans
                  const spans = Array.from(root.querySelectorAll('span, div, a'));
                  for (const sp of spans) {
                    const t = (sp.textContent || '').trim().toLowerCase();
                    const a = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                    if (matchTakeMeThere(t, a)) {
                      const b = sp.closest('button, [role="button"], [role="menuitem"]') || sp;
                      if (b && isVisible(b) && isEnabled(b)) return b;
                    }
                  }
                }
              }
              return null;
            };
            // Try detect and click "Take Me There"
            {
              const tD = Date.now();
              let tmtBtn = null;
              while (!tmtBtn && Date.now() - tD < 4000) {
                tmtBtn = findUnassignedDialogTakeMeThere();
                if (!tmtBtn) await sleep(200);
              }
              if (tmtBtn) {
                takeMeThereClicked = await clickEl(tmtBtn.closest('button') || tmtBtn);
                try { console.log('[Automation][Unassigned] Take Me There clicked:', takeMeThereClicked); } catch {}
                // Wait for dialog to dismiss
                const tW = Date.now();
                const dialogGone = () => !document.querySelector('.ea-dialog-view.ea-dialog-view-type--message, .ea-dialog, .ut-dialog, [role="dialog"]');
                while (!dialogGone() && Date.now() - tW < 8000) {
                  await sleep(200);
                }
                await sleep(300); // small settle
              }
            }
            await scrollToTop();
            // Force ellipsis path: click the 3-dots then choose "Quick Sell untradeable items for 0" from popup
            let ellipsisClicked = false;
            let quickSellClicked = false;

            // 1) Open ellipsis menu (strict selector first)
            let ell = null;
            const t0 = Date.now();
            while (!ell && Date.now() - t0 < 8000) {
              ell = document.querySelector('button.ut-image-button-control.ellipsis-btn')
                 || document.querySelector('button[aria-label*="more" i], button[aria-label*="options" i], button[title*="more" i], button[title*="options" i]');
              if (ell && isVisible(ell) && isEnabled(ell)) break;
              ell = null;
              await sleep(250);
            }
            if (ell) {
              ellipsisClicked = await clickEl(ell);
              try { console.log('[Automation][QS] Ellipsis clicked:', ellipsisClicked); } catch {}
              await sleepLog(1200, 'after-ellipsis'); // allow menu render (stabilization)
            } else {
              try { console.warn('[Automation][QS] Ellipsis button not found'); } catch {}
            }

            // 2) From popup, click: "Quick Sell untradeable items for 0"
            const isInlineKeyQuickSell = (n) => {
              if (!n || !(n.closest)) return false;
              const inPopup = !!n.closest('.ut-bulk-action-popup-view');
              const isInline = !!n.closest('.key-quick-sell-btn');
              // Only treat as inline (to skip) when it's NOT inside the popup menu
              return isInline && !inPopup;
            };
            const matchPopupQuickSell = (txt, node, aria) => {
              // Be tolerant: just require quick sell + untrad(e)able, amount may vary or be hidden
              const label = `${txt} ${aria}`.replace(/\s+/g, ' ').toLowerCase();
              const hasQuickSell = /quick\s*sell/.test(label);
              const hasUntrade = /(untrad(ea|a)?ble)/.test(label);
              return hasQuickSell && hasUntrade;
            };
            // Prefer a scoped search inside the bulk action popup
            let qsBtn = null;
            let popup = await waitForBulkPopup(6000);
            if (popup) {
              // Helper to search within popup including nested shadow roots
              const deepWithin = (root, sel) => {
                const out = [];
                const scan = (node) => {
                  if (!node) return;
                  try { out.push(...node.querySelectorAll(sel)); } catch {}
                  let all = [];
                  try { all = node.querySelectorAll('*'); } catch {}
                  for (const el of all) { if (el && el.shadowRoot) scan(el.shadowRoot); }
                };
                scan(root);
                return out;
              };
              const btns = Array.from(new Set([
                ...deepWithin(popup, 'button'),
                ...deepWithin(popup, '[role="button"]'),
                ...deepWithin(popup, '[role="menuitem"]')
              ]));
              for (const b of btns) {
                const txt = textOf(b);
                const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                if (matchPopupQuickSell(txt, b, aria) && isVisible(b) && isEnabled(b)) { qsBtn = b; break; }
                const sp = b.querySelector('span.btn-text, span');
                if (sp) {
                  const st = textOf(sp);
                  const sa = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                  if (matchPopupQuickSell(st, sp, sa)) { qsBtn = b; break; }
                }
              }
              // As a broader fallback inside popup, scan all elements for a matching label and bubble to clickable
              if (!qsBtn) {
                const all = Array.from(popup.querySelectorAll('*'));
                const candidates = [];
                for (const el of all) {
                  const t = textOf(el);
                  const a = (el.getAttribute && (el.getAttribute('aria-label') || '') || '').toLowerCase();
                  if (matchPopupQuickSell(t, el, a)) {
                    let clickable = el.closest('button, [role="button"], [role="menuitem"], li, a, div');
                    if (!clickable) clickable = el;
                    if (isVisible(clickable) && isEnabled(clickable)) { candidates.push(clickable); }
                  }
                }
                if (candidates.length) {
                  // Prefer the first unique clickable
                  const seen = new Set();
                  qsBtn = candidates.find(c => { if (seen.has(c)) return false; seen.add(c); return true; }) || candidates[0];
                  try { console.log('[Automation][QS] Popup fallback matched candidates count:', candidates.length); } catch {}
                }
              }
              // Fallback: accept any option with "quick sell" if specific phrasing isn't found
              if (!qsBtn) {
                for (const b of btns) {
                  const label = `${textOf(b)} ${(b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase()}`;
                  if (/quick\s*sell/.test(label) && isVisible(b) && isEnabled(b)) { qsBtn = b; break; }
                  const sp = b.querySelector('span.btn-text, span');
                  if (sp) {
                    const spLabel = `${textOf(sp)} ${(sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase()}`;
                    if (/quick\s*sell/.test(spLabel)) { qsBtn = b; break; }
                  }
                }
              }
            }
            // Global fallback if not found in popup
            if (!qsBtn) {
              const t1 = Date.now();
              while (!qsBtn && Date.now() - t1 < 8000) {
                qsBtn = findByText((txt, node, aria) => {
                  if (isInlineKeyQuickSell(node)) return false; // avoid inline quick sell button
                  return matchPopupQuickSell(txt, node, aria);
                });
                if (qsBtn && (!isVisible(qsBtn) || !isEnabled(qsBtn))) qsBtn = null;
                if (!qsBtn) await sleep(250);
              }
              // If still not found, log available menu options for diagnostics (broad)
              try {
                const menus = Array.from(document.querySelectorAll('.ut-bulk-action-popup-view, .ut-bulk-action, .ut-bulk-actions, [role="menu"], .context-menu, .menu, ul[role="menu"]'));
                const labels = [];
                for (const m of menus) {
                  const items = Array.from(m.querySelectorAll('button, [role="button"], [role="menuitem"], li, a, div'));
                  for (const it of items) {
                    if (!isVisible(it)) continue;
                    const t = (it.textContent || '').trim().replace(/\s+/g,' ');
                    const a = (it.getAttribute && it.getAttribute('aria-label')) || '';
                    const line = t || a || '[no-text]';
                    if (line) labels.push(line);
                  }
                }
                if (labels.length) console.warn('[Automation][QS] Menu options seen (broad):', labels);
              } catch {}
              if (!qsBtn && ellipsisClicked && ell) {
                // Retry once by re-opening the ellipsis menu and re-checking the popup
                await clickEl(ell);
                await sleepLog(500, 'retry-ellipsis-menu');
                popup = await waitForBulkPopup(4000);
                if (popup && !qsBtn) {
                  const btns = Array.from(popup.querySelectorAll('button, [role="button"], [role="menuitem"]'));
                  for (const b of btns) {
                    const txt = textOf(b);
                    const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                    if (matchPopupQuickSell(txt, b, aria) && isVisible(b) && isEnabled(b)) { qsBtn = b; break; }
                    const sp = b.querySelector('span.btn-text, span');
                    if (sp) {
                      const st = textOf(sp);
                      const sa = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                      if (matchPopupQuickSell(st, sp, sa)) { qsBtn = b; break; }
                    }
                  }
                }
                // Final broad fallback: any visible menuitem containing "quick sell"
                if (!qsBtn) {
                  const anyQuick = findByText((txt, node, aria) => /quick\s*sell/i.test(`${txt} ${aria}`));
                  if (anyQuick && isVisible(anyQuick) && isEnabled(anyQuick)) qsBtn = anyQuick;
                }
              }
            }
            if (!qsBtn) { try { console.warn('[Automation][QS] Popup Quick Sell option not found'); } catch {} }
            if (qsBtn) {
              quickSellClicked = await clickEl(qsBtn.closest('button') || qsBtn);
              try { console.log('[Automation][QS] Popup Quick Sell clicked:', quickSellClicked); } catch {}
            }
            await sleepLog(600, 'after-popup-quick-sell'); // allow confirm dialog to appear

            // 3) Confirm OK
            const matchOk = (txt, aria) => {
              const t = (txt || '').trim().toLowerCase();
              const a = (aria || '').trim().toLowerCase();
              const tests = [t, a];
              const has = (s) => tests.some((v) => v === s || v.includes(` ${s} `) || v.startsWith(`${s} `) || v.endsWith(` ${s}`));
              return has('ok') || has('okay') || has('yes') || has('confirm') || has('accept') || has('discard') || has('sell') || has('continue');
            };
            const findOkInDialogs = () => {
              const roots = Array.from(document.querySelectorAll('.dialog, .modal, .ut-dialog, .ea-dialog, [role="dialog"]'));
              for (const root of roots) {
                // Prefer explicit span.btn-text with "Ok"
                const spans = Array.from(root.querySelectorAll('span.btn-text, span, div, a'));
                for (const sp of spans) {
                  const txt = textOf(sp);
                  const aria = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                  if (matchOk(txt, aria)) {
                    const btn = sp.closest('button, [role="button"], [role="menuitem"]') || sp;
                    if (btn && isVisible(btn) && isEnabled(btn)) return btn;
                  }
                }
                // Fallback: any button within dialog that matches
                const btns = Array.from(root.querySelectorAll('button, [role="button"], [role="menuitem"]'));
                for (const b of btns) {
                  const txt = textOf(b);
                  const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                  if (matchOk(txt, aria) && isVisible(b) && isEnabled(b)) return b;
                }
              }
              return null;
            };
            let okBtn = null;
            const t2 = Date.now();
            while (!okBtn && Date.now() - t2 < 12000) {
              // Prefer finding OK within the bulk action popup view
              const pop = document.querySelector('.ut-bulk-action-popup-view');
              if (pop) {
                const btns = Array.from(pop.querySelectorAll('button, [role="button"], [role="menuitem"]'));
                for (const b of btns) {
                  const txt = textOf(b);
                  const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                  if (matchOk(txt, aria) && isVisible(b) && isEnabled(b)) { okBtn = b; break; }
                }
              }
              if (!okBtn) {
                okBtn = findOkInDialogs() || findByText((txt, node, aria) => matchOk(txt, aria));
                if (okBtn && (!isVisible(okBtn) || !isEnabled(okBtn))) okBtn = null;
              }
              if (!okBtn) await sleep(250);
            }
            if (okBtn) { try { console.log('[Automation][QS] OK/Confirm button found on first try'); } catch {} }
            else { try { console.warn('[Automation][QS] OK/Confirm button not found; retrying Quick Sell once'); } catch {} }
            // If OK didn't show, retry Quick Sell once
            if (!okBtn && qsBtn) {
              await clickEl(qsBtn.closest('button') || qsBtn);
              await sleepLog(400, 'retry-after-popup-quick-sell');
              const t2b = Date.now();
              while (!okBtn && Date.now() - t2b < 6000) {
                okBtn = findOkInDialogs() || findByText((txt, node, aria) => matchOk(txt, aria));
                if (okBtn && (!isVisible(okBtn) || !isEnabled(okBtn))) okBtn = null;
                if (!okBtn) await sleep(250);
              }
            }
            let confirmClicked = false;
            if (okBtn) {
              const okTarget = okBtn.closest('button') || okBtn;
              confirmClicked = await clickEl(okTarget);
              if (!confirmClicked) {
                // Try direct .click and focused Enter
                try { okTarget.focus && okTarget.focus(); okTarget.click && okTarget.click(); confirmClicked = true; } catch {}
              }
            }
            try { console.log('[Automation][QS] Confirm clicked:', confirmClicked); } catch {}
            // Final keyboard fallback only on OK target
            if (!confirmClicked && okBtn) {
              try {
                const kbTarget = (okBtn.closest('button') || okBtn);
                kbTarget.focus && kbTarget.focus();
                kbTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                kbTarget.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
                // Space fallback
                kbTarget.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
                kbTarget.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
              } catch {}
            }
            // Give the UI time to process confirmation and start dismissing dialog (stabilization)
            if (okBtn) {
              await sleepLog(987, 'after-confirm-click');
            }
            // Wait for dialog dismissal to ensure flow completes
            let dismissed = false;
            const t3 = Date.now();
            const dialogGone = () => !document.querySelector('.dialog, .modal, .ut-dialog, .ea-dialog, [role="dialog"]');
            while (Date.now() - t3 < 6000) {
              if (dialogGone()) { dismissed = true; break; }
              await sleep(200);
            }
            try { console.log('[Automation][QS] Dialog dismissed:', dismissed, 'elapsedMs=', Date.now() - t3); } catch {}
            return finish({ takeMeThereClicked, ellipsisClicked, quickSellClicked, confirmClicked, dismissed });
            } catch (e) {
              try { console.error('[Automation] QUICK_SELL_UNTRADEABLES error:', e); } catch {}
              return finish({ error: String(e && e.message || e) });
            }
          },
        })
        .then((results) => {
          const agg = { takeMeThereClicked: false, ellipsisClicked: false, quickSellClicked: false, confirmClicked: false, dismissed: false };
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r && r.result) {
                agg.takeMeThereClicked = agg.takeMeThereClicked || !!r.result.takeMeThereClicked;
                agg.ellipsisClicked = agg.ellipsisClicked || !!r.result.ellipsisClicked;
                agg.quickSellClicked = agg.quickSellClicked || !!r.result.quickSellClicked;
                agg.confirmClicked = agg.confirmClicked || !!r.result.confirmClicked;
                agg.dismissed = agg.dismissed || !!r.result.dismissed;
              }
            }
          }
          sendResponse({ ok: true, ...agg });
        })
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (message.type === "HOOK_PURCHASED_ITEMS") {
      const tabId = sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for hook injection" });
        return; // sync
      }
      // Inject a MAIN world hook to observe fetch/XHR for purchased/items
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: () => {
            try {
              if (window.__eaAutomationHooked) return;
              window.__eaAutomationHooked = true;
              const TARGET = /\/(ut|ut2)\/game\/fc25\/purchased\/items(\?|$)/;
              const evtName = "EA_AUTOMATION_PURCHASED_ITEMS";

              // Patch fetch
              try {
                const _fetch = window.fetch;
                if (typeof _fetch === "function") {
                  window.fetch = async function (...args) {
                    const res = await _fetch.apply(this, args);
                    try {
                      const req = args[0];
                      const url = typeof req === "string" ? req : req && req.url;
                      const method = String((args[1] && args[1].method) || (req && req.method) || "GET").toUpperCase();
                      const okMethod = method === "POST" || method === "GET";
                      if (url && TARGET.test(url) && okMethod) {
                        res
                          .clone()
                          .json()
                          .then((data) => {
                            // Dispatch CustomEvent in this frame
                            window.dispatchEvent(
                              new CustomEvent(evtName, { detail: { ok: true, source: "fetch", url, data } })
                            );
                            // Also post to the top window so top-frame listeners receive it even if request originated in a subframe
                            try {
                              if (window.top) {
                                window.top.postMessage({ __ea: true, type: evtName, payload: { ok: true, source: "fetch", url, data } }, "*");
                              }
                            } catch {}
                          })
                          .catch(() => {});
                      }
                    } catch {}
                    return res;
                  };
                }
              } catch {}

              // Patch XHR
              try {
                const X = window.XMLHttpRequest;
                if (X) {
                  const open = X.prototype.open;
                  const send = X.prototype.send;
                  X.prototype.open = function (method, url, ...rest) {
                    this.__ea_url = url;
                    this.__ea_method = method;
                    return open.call(this, method, url, ...rest);
                  };
                  X.prototype.send = function (...args) {
                    this.addEventListener("loadend", () => {
                      try {
                        const url = this.__ea_url;
                        const method = String(this.__ea_method || "GET").toUpperCase();
                        const okMethod = method === "POST" || method === "GET";
                        if (url && TARGET.test(url) && okMethod) {
                          try {
                            const data = JSON.parse(this.responseText);
                            // Dispatch CustomEvent in this frame
                            window.dispatchEvent(
                              new CustomEvent(evtName, { detail: { ok: true, source: "xhr", url, data } })
                            );
                            // And post to top window
                            try {
                              if (window.top) {
                                window.top.postMessage({ __ea: true, type: evtName, payload: { ok: true, source: "xhr", url, data } }, "*");
                              }
                            } catch {}
                          } catch {}
                        }
                      } catch {}
                    });
                    return send.apply(this, args);
                  };
                }
              } catch {}
            } catch (e) {
              // Swallow errors in page world to avoid breaking site scripts
            }
          },
        })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // async response
    }

    if (message.type === "CLICK_SEND_ALL") {
      const tabId = sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for click injection" });
        return;
      }
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const selectors = [
              'button.btn-standard.autosbc-header-button.section-header-btn.mini.call-to-action',
              'button.btn-standard.call-to-action',
              'button.section-header-btn',
              'button.call-to-action',
              'button'
            ];
            const needle = 'send all to club';
            const getLabel = (el) => ((el.getAttribute('aria-label') || el.textContent || '').trim()).toLowerCase();
            const isVisible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') return false;
              const r = el.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const isEnabled = (el) => {
              if (el.matches('[disabled], [aria-disabled="true"]')) return false;
              const cls = el.className || '';
              if (/\bdisabled\b|\bis-disabled\b|\bbtn-disabled\b/i.test(cls)) return false;
              return true;
            };
            const highlight = (el) => {
              try {
                const r = el.getBoundingClientRect();
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = r.left + 'px';
                div.style.top = r.top + 'px';
                div.style.width = r.width + 'px';
                div.style.height = r.height + 'px';
                div.style.border = '2px solid #00e5ff';
                div.style.borderRadius = '6px';
                div.style.zIndex = '2147483647';
                div.style.pointerEvents = 'none';
                div.style.boxShadow = '0 0 12px rgba(0,229,255,0.8)';
                document.documentElement.appendChild(div);
                setTimeout(() => div.remove(), 1200);
              } catch {}
            };
            const dispatchAll = (el, cx, cy) => {
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              // Hover/move
              try { el.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousemove', base )); } catch {}
              // Mouse click
              try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('click', base)); } catch {}
              // Touch fallback
              try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'touch' })); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerup',   { ...base, pointerType: 'touch' })); } catch {}
              // Keyboard fallback
              try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
              try { el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
            };
            const tryClick = (el) => {
              if (!el) return false;
              if (!isEnabled(el)) return false;
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              const r = el.getBoundingClientRect();
              const cx = Math.max(0, Math.floor(r.left + r.width / 2));
              const cy = Math.max(0, Math.floor(r.top + r.height / 2));
              highlight(el);
              // If overlaid, prefer the button itself
              const topEl = document.elementFromPoint(cx, cy);
              const target = el.contains(topEl) ? (topEl.closest('button, [role="button"], .call-to-action') || el) : el;
              // Multiple attempts to ensure framework picks it up
              for (let i = 0; i < 3; i++) {
                dispatchAll(target, cx, cy);
              }
              // Last resort programmatic click
              try { target.click && target.click(); } catch {}
              return true;
            };
            const find = () => {
              // Prefer exact includes, then aria-label
              for (const sel of selectors) {
                const list = document.querySelectorAll(sel);
                for (const el of list) {
                  const label = getLabel(el);
                  if (label.includes(needle) && isVisible(el)) return el;
                }
              }
              // Fallback: query by aria-label globally
              const aria = document.querySelector('[aria-label]');
              if (aria && getLabel(aria).includes(needle) && isVisible(aria)) return aria;
              return null;
            };
            const scrollToTop = async () => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}
              try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch {}
              try { if (document.body) document.body.scrollTop = 0; } catch {}
              await sleep(50);
            };
            await scrollToTop();
            const start = Date.now();
            while (Date.now() - start < 12000) { // up to 12s
              const el = find();
              if (el && isEnabled(el)) {
                tryClick(el);
                return { clicked: true };
              }
              await sleep(200);
            }
            return { clicked: false };
          },
        })
        .then((results) => {
          const any = Array.isArray(results) && results.some((r) => r && r.result && r.result.clicked);
          sendResponse({ ok: true, clicked: !!any });
        })
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // async
    }

    if (message.type === "CLICK_OPEN") {
      const tabId = sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for click injection" });
        return;
      }
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const selectors = [
              'button.currency.call-to-action',
              'button.btn-standard.call-to-action',
              'button.call-to-action',
              'button'
            ];
            const needle = 'open';
            const getLabel = (el) => {
              try {
                const aria = (el.getAttribute && el.getAttribute('aria-label')) || '';
                const text = (el.textContent || '').trim();
                return `${aria} ${text}`.toLowerCase();
              } catch { return ''; }
            };
            const isVisible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') return false;
              const r = el.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const isEnabled = (el) => {
              if (el.matches('[disabled], [aria-disabled="true"]')) return false;
              const cls = el.className || '';
              if (/\bdisabled\b|\bis-disabled\b|\bbtn-disabled\b/i.test(cls)) return false;
              return true;
            };
            const highlight = (el) => {
              try {
                const r = el.getBoundingClientRect();
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = r.left + 'px';
                div.style.top = r.top + 'px';
                div.style.width = r.width + 'px';
                div.style.height = r.height + 'px';
                div.style.border = '2px solid #00e5ff';
                div.style.borderRadius = '6px';
                div.style.zIndex = '2147483647';
                div.style.pointerEvents = 'none';
                div.style.boxShadow = '0 0 12px rgba(0,229,255,0.8)';
                document.documentElement.appendChild(div);
                setTimeout(() => div.remove(), 1000);
              } catch {}
            };
            const dispatchAll = (el, cx, cy) => {
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              try { el.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousemove', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { el.dispatchEvent(new MouseEvent('click', base)); } catch {}
              // keyboard fallback
              try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
              try { el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
            };
            const tryClick = (el) => {
              if (!el) return false;
              if (!isEnabled(el)) return false;
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              const r = el.getBoundingClientRect();
              const cx = Math.max(0, Math.floor(r.left + r.width / 2));
              const cy = Math.max(0, Math.floor(r.top + r.height / 2));
              const topEl = document.elementFromPoint(cx, cy);
              const target = (topEl && (topEl.closest('button, [role="button"], .call-to-action, .btn-standard') || topEl)) || el;
              highlight(target);
              for (let i = 0; i < 2; i++) dispatchAll(target, cx, cy);
              try { target.click && target.click(); } catch {}
              return true;
            };
            const find = () => {
              // Prefer explicit button selectors first
              for (const sel of selectors) {
                const list = document.querySelectorAll(sel);
                for (const el of list) {
                  const label = getLabel(el);
                  if (label.includes(needle) && isVisible(el)) return el;
                }
              }
              // Also scan spans/divs carrying the text and bubble to button
              const spans = Array.from(document.querySelectorAll('span, div, a'));
              for (const sp of spans) {
                const t = (sp.textContent || '').trim().toLowerCase();
                const a = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                if ((t.includes(needle) || a.includes(needle)) && isVisible(sp)) {
                  const btn = sp.closest('button, [role="button"], .call-to-action, .btn-standard');
                  if (btn && isVisible(btn)) return btn;
                }
              }
              return null;
            };
            const scrollToTop = async () => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}
              try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch {}
              try { if (document.body) document.body.scrollTop = 0; } catch {}
              await sleep(50);
            };
            await scrollToTop();
            const start = Date.now();
            while (Date.now() - start < 12000) { // up to 12s
              const el = find();
              if (el && isEnabled(el)) {
                tryClick(el);
                return { clicked: true };
              }
              await sleep(200);
            }
            return { clicked: false };
          },
        })
        .then((results) => {
          const any = Array.isArray(results) && results.some((r) => r && r.result && r.result.clicked);
          sendResponse({ ok: true, clicked: !!any });
        })
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // async
    }

    if (message.type === "RECYCLE_WORKFLOW") {
      const tabId = sender?.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "No tabId for recycle workflow" });
        return;
      }
      const mode = message.mode; // 'OVR89' or 'X10_84'
      const pickTotw = (mode === 'X10_84') ? __x10AltToggle : false;
      if (mode === 'X10_84') { __x10AltToggle = !__x10AltToggle; }
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: async (mode, pickTotw) => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            async function sleepLog(ms, label = 'recycle-sleep') {
              const t0 = Date.now();
              try { console.log(`[Automation][RECYCLE][wait] ${label} start ms=${ms} at ${t0}`); } catch {}
              await sleep(ms);
              try { console.log(`[Automation][RECYCLE][wait] ${label} end elapsed=${Date.now() - t0}ms`); } catch {}
            }
            const rand = (min, max) => Math.random() * (max - min) + min;
            const randInt = (min, max) => Math.floor(rand(min, max));
            const isVisible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') return false;
              const r = el.getBoundingClientRect();
              return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const isEnabled = (el) => {
              if (el.matches('[disabled], [aria-disabled="true"]')) return false;
              const cls = el.className || '';
              if (/\bdisabled\b|\bis-disabled\b|\bbtn-disabled\b/i.test(cls)) return false;
              return true;
            };
            const highlight = (el) => {
              try {
                const r = el.getBoundingClientRect();
                const div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = r.left + 'px';
                div.style.top = r.top + 'px';
                div.style.width = r.width + 'px';
                div.style.height = r.height + 'px';
                div.style.border = '2px solid #00e5ff';
                div.style.borderRadius = '6px';
                div.style.zIndex = '2147483647';
                div.style.pointerEvents = 'none';
                div.style.boxShadow = '0 0 12px rgba(0,229,255,0.8)';
                document.documentElement.appendChild(div);
                setTimeout(() => div.remove(), 600);
              } catch {}
            };
            const humanClick = async (el) => {
              if (!el || !isVisible(el) || !isEnabled(el)) return false;
              // Simple cooldown to avoid rapid consecutive clicks
              const now = Date.now();
              if (window.__ea_clickCooldown && now - window.__ea_clickCooldown < 600) {
                await sleep(randInt(120, 320));
              }
              window.__ea_clickCooldown = now;

              // Bring into view with a small dwell
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              await sleep(randInt(60, 140));

              const r = el.getBoundingClientRect();
              // Pick a natural point inside the element (not exact center)
              const px = Math.floor(rand(r.left + r.width * 0.3, r.left + r.width * 0.7));
              const py = Math.floor(rand(r.top + r.height * 0.35, r.top + r.height * 0.65));

              // Determine actual top target under the point
              const maybe = document.elementFromPoint(px, py) || el;
              const target = maybe.closest('button, [role="button"], [role="menuitem"], .btn-standard, .call-to-action') || maybe || el;

              // Simulate a short hover with some pointer moves
              const steps = randInt(3, 6);
              for (let i = 0; i < steps; i++) {
                const jitterX = px + randInt(-2, 3);
                const jitterY = py + randInt(-2, 3);
                const moveBase = { bubbles: true, cancelable: true, composed: true, clientX: jitterX, clientY: jitterY };
                try { target.dispatchEvent(new PointerEvent('pointerover', { ...moveBase, pointerType: 'mouse' })); } catch {}
                try { target.dispatchEvent(new MouseEvent('mouseover', moveBase)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mousemove', moveBase)); } catch {}
                await sleep(randInt(12, 28));
              }

              highlight(target);
              // Press with realistic down->up timing
              const base = { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, button: 0 };
              try { target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              await sleep(randInt(60, 140));
              try { target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              // Single click event (avoid multiple different methods)
              try { target.dispatchEvent(new MouseEvent('click', base)); } catch {}

              // Dwell a bit to allow the framework to react
              await sleep(randInt(120, 220));

              // Fallback: if nothing changed visually, try programmatic click once
              try { if (document.contains(target)) target.click && target.click(); } catch {}
              await sleep(randInt(60, 120));
              return true;
            };
            const textOf = (n) => (n && (n.textContent || n.innerText || '') || '').trim().toLowerCase();
            const waitForContainer = async () => {
              const start = Date.now();
              while (Date.now() - start < 5000) {
                const c = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
                if (c && isVisible(c)) return c;
                await sleep(200);
              }
              return null;
            };
            const scrollToTop = async () => {
              try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}
              try { const se = document.scrollingElement; if (se) se.scrollTop = 0; } catch {}
              try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch {}
              try { if (document.body) document.body.scrollTop = 0; } catch {}
              await sleep(50);
            };
            await scrollToTop();
            // 0) Open recycle popup by clicking #auto-sbc-recycle
            let opened = false;
            const t0 = Date.now();
            while (!opened && Date.now() - t0 < 5000) {
              const btn = document.querySelector('#auto-sbc-recycle');
              if (btn && isVisible(btn) && isEnabled(btn)) {
                opened = await humanClick(btn);
                break;
              }
              await sleep(250);
            }
            // Stabilize after opening recycle popup
            await sleepLog(800, 'after-open-recycle');

            const container = await waitForContainer();
            if (!container) {
              // Fallback: try to select and submit directly by global text search
              try { console.debug('[Automation][RECYCLE] Container not found; using global fallback'); } catch {}
              let targetBtn = null;
              await sleepLog(800, 'fallback-before-select-mode');
              const selStart2 = Date.now();
              while (!targetBtn && Date.now() - selStart2 < 4000) {
                targetBtn = findByText((txt, node, aria) => {
                  if (mode === 'OVR89') {
                    return (txt.includes('89') && (txt.includes('ovr') || txt.includes('squadshifter') || txt.includes('squad shifter')))
                      || (aria.includes('89') && (aria.includes('ovr') || aria.includes('squad')));
                  } else {
                    const hasX10 = txt.includes('84+ x10') || txt.includes('84 + x10') || txt.includes('84x10') || aria.includes('x10');
                    const hasTotw = txt.includes('totw upgrade') || aria.includes('totw');
                    return pickTotw ? (hasTotw || hasX10) : (hasX10 || hasTotw);
                  }
                });
                if (targetBtn && (!isVisible(targetBtn) || !isEnabled(targetBtn))) targetBtn = null;
                if (!targetBtn) await sleep(200);
              }
              let selected = false;
              if (targetBtn) selected = await humanClick(targetBtn.closest('button') || targetBtn);
              await sleep(800);

              // Try to find a submit/confirm button globally
              let submit = null;
              const tSub2 = Date.now();
              while (!submit && Date.now() - tSub2 < 4000) {
                submit = findByText((txt, node, aria) => {
                  const label = `${txt} ${aria}`;
                  return label.includes('submit') || label.includes('confirm') || label.includes('proceed') || label.includes('continue') || label === 'ok' || label.includes('ok ');
                });
                if (submit && (!isVisible(submit) || !isEnabled(submit))) submit = null;
                if (!submit) await sleep(200);
              }
              let submitClicked = false;
              if (submit) {
                await sleepLog(800, 'fallback-before-submit');
                submitClicked = await humanClick(submit.closest('button') || submit);
                await sleepLog(800, 'fallback-after-submit');
              }

              // Consider dismissed if no obvious dialog elements present
              const dismissed = !document.querySelector('[role="dialog"], .dialog, .utt-modal, .ut-dialog');
              return { opened, selected, submitClicked, dismissed, fallback: true };
            }

            // 1) Select SBC option based on mode
            await sleepLog(800, 'before-select-mode');
            let targetBtn = null;
            const selStart = Date.now();
            while (!targetBtn && Date.now() - selStart < 4000) {
              const buttons = Array.from(container.querySelectorAll('button'));
              let candX10 = null;
              let candTotw = null;
              for (const b of buttons) {
                const t = textOf(b);
                if (mode === 'OVR89' && t.includes('89 ovr squadshifter')) { targetBtn = b; break; }
                if (mode === 'X10_84') {
                  const isX10 = t.includes('84+ x10 upgrade') || t.includes('84 + x10 upgrade') || t.includes('84x10 upgrade');
                  const isTotw = t.includes('84+ totw upgrade') || t.includes('84 + totw upgrade') || t.includes('totw upgrade');
                  if (isX10 && !candX10) candX10 = b;
                  if (isTotw && !candTotw) candTotw = b;
                }
              }
              if (!targetBtn && mode === 'X10_84') {
                targetBtn = pickTotw ? (candTotw || candX10) : (candX10 || candTotw);
              }
              if (!targetBtn) await sleep(200);
            }
            let selected = false;
            if (targetBtn) selected = await humanClick(targetBtn.closest('button') || targetBtn);
            await sleepLog(800, 'after-select-mode'); // stabilization after selecting SBC

            // 2) Click Submit button (robust)
            const dialogGone = () => !document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
            let submit = null;
            const t2 = Date.now();
            // Wait before attempting to submit
            await sleepLog(800, 'before-submit');
            while (!submit && Date.now() - t2 < 6000) {
              // Prefer inside container, then global fallback by id
              submit = container.querySelector('#auto-sbc-recycle-submit')
                || document.querySelector('#auto-sbc-recycle-submit')
                || Array.from(container.querySelectorAll('button')).find((b) => textOf(b) === 'submit' || textOf(b).includes('submit'));
              if (submit && (!isVisible(submit) || !isEnabled(submit))) submit = null;
              if (!submit) await sleep(200);
            }
            let submitClicked = false;
            if (submit) {
              const trySubmitOnce = async (btn) => {
                try { return await humanClick(btn.closest('button') || btn); } catch { return false; }
              };
              // Multi-attempt strategy with small delays and re-querying
              const startClick = Date.now();
              while (Date.now() - startClick < 2500 && !dialogGone()) {
                if (!submit || !isVisible(submit) || !isEnabled(submit)) {
                  submit = document.querySelector('#auto-sbc-recycle-submit') || submit;
                }
                if (submit && isVisible(submit) && isEnabled(submit)) {
                  submitClicked = await trySubmitOnce(submit);
                }
                await sleep(200);
                if (dialogGone()) break;
              }
              await sleepLog(800, 'after-submit'); // stabilization after submit
            }

            // 3) Wait for container to dismiss (primary recycle dialog)
            let dismissed = false;
            const t3 = Date.now();
            while (Date.now() - t3 < 4000) {
              const c = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
              if (!c || !isVisible(c)) { dismissed = true; break; }
              await sleep(200);
            }

            // 4) Handle potential follow-up AutoSBC dialog that appears after recycling (Cancel it)
            let autosbcCancelClicked = false;
            const findCancelInAutoSbc = (root) => {
              if (!root) return null;
              const matchCancel = (txt, aria) => {
                const t = (txt || '').trim().toLowerCase();
                const a = (aria || '').trim().toLowerCase();
                return t === 'cancel' || a === 'cancel' || t === 'close' || a === 'close' || t === 'back' || a === 'back' || t === 'no thanks' || a === 'no thanks';
              };
              // Prefer explicit buttons
              const btns = Array.from(root.querySelectorAll('button, [role="button"], [role="menuitem"]'));
              for (const b of btns) {
                const txt = (b.textContent || '').trim().toLowerCase();
                const aria = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                if (matchCancel(txt, aria) && isVisible(b) && isEnabled(b)) return b;
              }
              // Also inspect spans/divs that might carry the label
              const spans = Array.from(root.querySelectorAll('span, div, a'));
              for (const sp of spans) {
                const t = (sp.textContent || '').trim().toLowerCase();
                const a = (sp.getAttribute && (sp.getAttribute('aria-label') || '') || '').toLowerCase();
                if (matchCancel(t, a)) {
                  const b = sp.closest('button, [role="button"], [role="menuitem"]') || sp;
                  if (b && isVisible(b) && isEnabled(b)) return b;
                }
              }
              return null;
            };

            // If primary dismissed, wait briefly for a new AutoSBC container, then click Cancel
            const waitForAutoSbc = async (ms) => {
              const start = Date.now();
              while (Date.now() - start < ms) {
                const c = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
                if (c && isVisible(c)) return c;
                await sleep(200);
              }
              return null;
            };

            // Case A: if not dismissed, try to cancel current container
            if (!dismissed) {
              const cont = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
              const cancelBtn = findCancelInAutoSbc(cont);
              if (cancelBtn) {
                autosbcCancelClicked = await humanClick(cancelBtn.closest('button') || cancelBtn);
                const tW = Date.now();
                while (Date.now() - tW < 4000) {
                  const still = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
                  if (!still || !isVisible(still)) { dismissed = true; break; }
                  await sleep(200);
                }
              }
            }

            // Case B: after dismissal, a fresh AutoSBC suggestion dialog may appear; cancel it
            if (dismissed && !autosbcCancelClicked) {
              const follow = await waitForAutoSbc(5000);
              if (follow) {
                const cancelBtn = findCancelInAutoSbc(follow);
                if (cancelBtn) {
                  autosbcCancelClicked = await humanClick(cancelBtn.closest('button') || cancelBtn);
                  const tW2 = Date.now();
                  while (Date.now() - tW2 < 4000) {
                    const still = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
                    if (!still || !isVisible(still)) break;
                    await sleep(200);
                  }
                }
              }
            }

            return { opened, selected, submitClicked, dismissed, autosbcCancelClicked };
          },
          args: [mode, pickTotw],
        })
        .then((results) => {
          const agg = { opened: false, selected: false, submitClicked: false, dismissed: false, autosbcCancelClicked: false };
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r && r.result) {
                agg.opened = agg.opened || !!r.result.opened;
                agg.selected = agg.selected || !!r.result.selected;
                agg.submitClicked = agg.submitClicked || !!r.result.submitClicked;
                agg.dismissed = agg.dismissed || !!r.result.dismissed;
                agg.autosbcCancelClicked = agg.autosbcCancelClicked || !!r.result.autosbcCancelClicked;
              }
            }
          }
          // Fire-and-forget: if we cancelled a follow-up AutoSBC dialog, immediately trigger quick sell flow
          try {
            if (agg.autosbcCancelClicked) {
              chrome.runtime.sendMessage({ type: "QUICK_SELL_UNTRADEABLES", tabId });
            }
          } catch {}
          sendResponse({ ok: true, mode, ...agg });
        })
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
  } catch (err) {
    console.error("Background error:", err);
    sendResponse({ ok: false, error: String(err) });
  }
  // Indicate we responded synchronously
  return false;
});
