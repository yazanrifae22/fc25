# EA FC Web App Automation (Starter)

Minimal Chrome Extension (MV3) that injects a Shadow DOM overflow button labeled "Automation" on the EA FC Web App. Automation features can be added later.

## Structure

```
/manifest.json
/src
  /background
    service_worker.js
  /content-scripts
    automation-button.js
  /ui
    popup.html
    popup.js
    popup.css
```

## Install (Load Unpacked)

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select this folder.
4. You should see the extension appear with an "Automation" popup.

## Verify

- Visit: https://www.ea.com/ea-sports-fc/ultimate-team/web-app/
- After the page loads, look at the bottom-right corner.
- You should see an "Automation" overflow button (⋮ Automation).
- Clicking it opens a small menu with a placeholder item.

## Notes

- MV3 service worker is stateless and event-driven.
- No broad permissions; content script runs only on the specified EA URL.
- Popup includes a button to open the EA FC Web App.

## Next Steps (when you're ready)

- Define the Automation menu items and actions.
- Add a typed message bus for content <-> background.
- Centralize storage helpers if you need persistence.
- Add icons and i18n strings in `_locales/` for store readiness.
