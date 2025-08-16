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
              await sleep(600); // allow menu render (stabilization)
            } else {
              try { console.warn('[Automation][QS] Ellipsis button not found'); } catch {}
            }

            // 2) From popup, click: "Quick Sell untradeable items for 0"
            const isInlineKeyQuickSell = (n) => !!(n && (n.closest && n.closest('.key-quick-sell-btn')));
            const matchPopupQuickSell = (txt, node, aria) => {
              const label = `${txt} ${aria}`;
              const hasQuickSell = label.includes('quick sell');
              const hasUntrade = label.includes('untradeable') || label.includes('untradable') || label.includes('untradeble');
              const hasZero = /\b0\b/.test(label) || /for\s*0/.test(label) || /0\s*coins?/.test(label);
              return hasQuickSell && hasUntrade && hasZero;
            };
            let qsBtn = null;
            const t1 = Date.now();
            while (!qsBtn && Date.now() - t1 < 8000) {
              qsBtn = findByText((txt, node, aria) => {
                if (isInlineKeyQuickSell(node)) return false; // avoid inline quick sell button
                return matchPopupQuickSell(txt, node, aria);
              });
              if (qsBtn && (!isVisible(qsBtn) || !isEnabled(qsBtn))) qsBtn = null;
              if (!qsBtn) await sleep(250);
            }
            if (!qsBtn && ellipsisClicked) {
              // Retry once by re-clicking ellipsis in case menu closed
              await clickEl(ell);
              await sleep(500);
              const t1b = Date.now();
              while (!qsBtn && Date.now() - t1b < 4000) {
                qsBtn = findByText((txt, node, aria) => {
                  if (isInlineKeyQuickSell(node)) return false;
                  return matchPopupQuickSell(txt, node, aria);
                });
                if (qsBtn && (!isVisible(qsBtn) || !isEnabled(qsBtn))) qsBtn = null;
                if (!qsBtn) await sleep(200);
              }
            }
            if (!qsBtn) { try { console.warn('[Automation][QS] Popup Quick Sell option not found'); } catch {} }
            if (qsBtn) {
              quickSellClicked = await clickEl(qsBtn.closest('button') || qsBtn);
              try { console.log('[Automation][QS] Popup Quick Sell clicked:', quickSellClicked); } catch {}
            }
            await sleep(600); // allow confirm dialog to appear

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
              okBtn = findOkInDialogs() || findByText((txt, node, aria) => matchOk(txt, aria));
              if (okBtn) {
                if (!isVisible(okBtn) || !isEnabled(okBtn)) okBtn = null;
              }
              if (!okBtn) await sleep(250);
            }
            if (okBtn) { try { console.log('[Automation][QS] OK/Confirm button found on first try'); } catch {} }
            else { try { console.warn('[Automation][QS] OK/Confirm button not found; retrying Quick Sell once'); } catch {} }
            // If OK didn't show, retry Quick Sell once
            if (!okBtn && qsBtn) {
              await clickEl(qsBtn.closest('button') || qsBtn);
              await sleep(400);
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
              await sleep(1000);
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
                            window.dispatchEvent(
                              new CustomEvent(evtName, { detail: { ok: true, source: "fetch", url, data } })
                            );
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
                            window.dispatchEvent(
                              new CustomEvent(evtName, { detail: { ok: true, source: "xhr", url, data } })
                            );
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
            while (Date.now() - start < 25000) { // up to 25s
              const el = find();
              if (el && isEnabled(el)) {
                tryClick(el);
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
            const clickEl = async (el) => {
              if (!el || !isVisible(el) || !isEnabled(el)) return false;
              el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
              await sleep(40);
              const r = el.getBoundingClientRect();
              const cx = Math.max(0, Math.floor(r.left + r.width / 2));
              const cy = Math.max(0, Math.floor(r.top + r.height / 2));
              const topEl = document.elementFromPoint(cx, cy) || el;
              const target = topEl.closest('button, [role="button"], .btn-standard, .call-to-action') || topEl || el;
              highlight(target);
              const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
              try { target.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
              try { target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
              await sleep(20);
              try { target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
              try { target.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
              try { target.dispatchEvent(new MouseEvent('click', base)); } catch {}
              try { target.click && target.click(); } catch {}
              await sleep(120);
              return true;
            };
            const textOf = (n) => (n && (n.textContent || n.innerText || '') || '').trim().toLowerCase();
            const waitForContainer = async () => {
              const start = Date.now();
              while (Date.now() - start < 8000) {
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
            while (!opened && Date.now() - t0 < 8000) {
              const btn = document.querySelector('#auto-sbc-recycle');
              if (btn && isVisible(btn) && isEnabled(btn)) {
                opened = await clickEl(btn);
                break;
              }
              await sleep(250);
            }
            await sleep(400);

            const container = await waitForContainer();
            if (!container) {
              // Fallback: try to select and submit directly by global text search
              try { console.debug('[Automation][RECYCLE] Container not found; using global fallback'); } catch {}
              let targetBtn = null;
              const selStart2 = Date.now();
              while (!targetBtn && Date.now() - selStart2 < 6000) {
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
              if (targetBtn) selected = await clickEl(targetBtn.closest('button') || targetBtn);
              await sleep(800);

              // Try to find a submit/confirm button globally
              let submit = null;
              const tSub2 = Date.now();
              while (!submit && Date.now() - tSub2 < 6000) {
                submit = findByText((txt, node, aria) => {
                  const label = `${txt} ${aria}`;
                  return label.includes('submit') || label.includes('confirm') || label.includes('proceed') || label.includes('continue') || label === 'ok' || label.includes('ok ');
                });
                if (submit && (!isVisible(submit) || !isEnabled(submit))) submit = null;
                if (!submit) await sleep(200);
              }
              let submitClicked = false;
              if (submit) submitClicked = await clickEl(submit.closest('button') || submit);
              await sleep(1000);

              // Consider dismissed if no obvious dialog elements present
              const dismissed = !document.querySelector('[role="dialog"], .dialog, .utt-modal, .ut-dialog');
              return { opened, selected, submitClicked, dismissed, fallback: true };
            }

            // 1) Select SBC option based on mode
            let targetBtn = null;
            const selStart = Date.now();
            while (!targetBtn && Date.now() - selStart < 6000) {
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
            if (targetBtn) selected = await clickEl(targetBtn.closest('button') || targetBtn);
            await sleep(1000); // stabilization after selecting SBC

            // 2) Click Submit button (robust)
            const dialogGone = () => !document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
            let submit = null;
            const t2 = Date.now();
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
                try {
                  const target = (btn.closest('button') || btn);
                  // 1) pointer/mouse sequence
                  const r = target.getBoundingClientRect();
                  const cx = Math.max(0, Math.floor(r.left + r.width / 2));
                  const cy = Math.max(0, Math.floor(r.top + r.height / 2));
                  const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0 };
                  target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
                  await sleep(30);
                  try { target.dispatchEvent(new PointerEvent('pointerover', { ...base, pointerType: 'mouse' })); } catch {}
                  try { target.dispatchEvent(new MouseEvent('mouseover', base)); } catch {}
                  try { target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' })); } catch {}
                  try { target.dispatchEvent(new MouseEvent('mousedown', base)); } catch {}
                  await sleep(15);
                  try { target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse' })); } catch {}
                  try { target.dispatchEvent(new MouseEvent('mouseup', base)); } catch {}
                  try { target.dispatchEvent(new MouseEvent('click', base)); } catch {}
                  // 2) programmatic click
                  try { target.click && target.click(); } catch {}
                  // 3) keyboard fallback
                  try { target.focus && target.focus(); } catch {}
                  try { target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
                  try { target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true })); } catch {}
                  try { target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); } catch {}
                  try { target.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true })); } catch {}
                  // 4) form submit fallback if inside a form
                  try { const form = target.closest('form'); form && form.submit && form.submit(); } catch {}
                  return true;
                } catch { return false; }
              };
              // Multi-attempt strategy with small delays and re-querying
              const startClick = Date.now();
              while (Date.now() - startClick < 4000 && !dialogGone()) {
                if (!submit || !isVisible(submit) || !isEnabled(submit)) {
                  submit = document.querySelector('#auto-sbc-recycle-submit') || submit;
                }
                if (submit && isVisible(submit) && isEnabled(submit)) {
                  submitClicked = await trySubmitOnce(submit);
                }
                await sleep(200);
                if (dialogGone()) break;
              }
              await sleep(1000); // stabilization after submit
            }

            // 3) Wait for container to dismiss
            let dismissed = false;
            const t3 = Date.now();
            while (Date.now() - t3 < 6000) {
              const c = document.querySelector('#auto-sbc-container.auto-sbc-container, #auto-sbc-container');
              if (!c || !isVisible(c)) { dismissed = true; break; }
              await sleep(200);
            }

            return { opened, selected, submitClicked, dismissed };
          },
          args: [mode, pickTotw],
        })
        .then((results) => {
          const agg = { opened: false, selected: false, submitClicked: false, dismissed: false };
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r && r.result) {
                agg.opened = agg.opened || !!r.result.opened;
                agg.selected = agg.selected || !!r.result.selected;
                agg.submitClicked = agg.submitClicked || !!r.result.submitClicked;
                agg.dismissed = agg.dismissed || !!r.result.dismissed;
              }
            }
          }
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
