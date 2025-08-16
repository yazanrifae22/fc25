"use strict";

// Background service worker (stateless, MV3)
// Minimal message bus scaffold for future automation features.

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
            // 1) Open ellipsis menu
            let ell = null;
            const t0 = Date.now();
            while (!ell && Date.now() - t0 < 8000) {
              ell = document.querySelector('button.ut-image-button-control.ellipsis-btn');
              if (ell && isVisible(ell) && isEnabled(ell)) break;
              ell = null;
              await sleep(250);
            }
            let ellipsisClicked = false;
            if (ell) ellipsisClicked = await clickEl(ell);
            await sleep(1000); // allow menu render (stabilization)

            // 2) Click "Quick Sell untradeable items for 0"
            let qsBtn = null;
            const t1 = Date.now();
            while (!qsBtn && Date.now() - t1 < 8000) {
              qsBtn = findByText((txt, node, aria) => {
                const label = `${txt} ${aria}`;
                const hasQuickSell = label.includes('quick sell');
                const hasUntrade = label.includes('untradeable') || label.includes('untradable') || label.includes('untradeble');
                const hasZero = /\b0\b/.test(label) || /for\s*0/.test(label) || /0\s*coins?/.test(label);
                return hasQuickSell && hasUntrade && hasZero;
              });
              if (qsBtn) {
                if (!isVisible(qsBtn) || !isEnabled(qsBtn)) qsBtn = null;
              }
              if (!qsBtn) await sleep(250);
            }
            let quickSellClicked = false;
            if (qsBtn) quickSellClicked = await clickEl(qsBtn.closest('button') || qsBtn);
            await sleep(1000); // allow confirm dialog to appear (stabilization)

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

            return finish({ ellipsisClicked, quickSellClicked, confirmClicked, dismissed });
            } catch (e) {
              try { console.error('[Automation] QUICK_SELL_UNTRADEABLES error:', e); } catch {}
              return finish({ error: String(e && e.message || e) });
            }
          },
        })
        .then((results) => {
          const agg = { ellipsisClicked: false, quickSellClicked: false, confirmClicked: false, dismissed: false };
          if (Array.isArray(results)) {
            for (const r of results) {
              if (r && r.result) {
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
  } catch (err) {
    console.error("Background error:", err);
    sendResponse({ ok: false, error: String(err) });
  }
  // Indicate we responded synchronously
  return false;
});
