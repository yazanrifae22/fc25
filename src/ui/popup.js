"use strict";

const TARGET_URL = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/";

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-app");
  if (!openBtn) return;
  openBtn.addEventListener("click", async () => {
    try {
      // Use window.open to avoid requiring the 'tabs' permission.
      window.open(TARGET_URL, "_blank", "noopener,noreferrer");
      window.close();
    } catch (err) {
      console.error("Failed to open tab", err);
      alert("Could not open the EA FC Web App.");
    }
  });
});
