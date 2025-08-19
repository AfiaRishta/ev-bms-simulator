# EV BMS Simulator — v3 (offline-safe, bulletproof CSV)

**What’s new in v3**
- **Offline charts** (no CDN) so opening from `file://` works everywhere.
- **Export CSV** now has a **data-URI fallback** if your browser blocks Blob downloads.
- **Copy CSV** still available as a one-click backup.
- Auto-start on page load + visible status indicator.

## Quick Start
1. Unzip this folder.
2. Double-click **index.html**.
3. It starts automatically; switch profiles, inject faults, click **Export CSV** or **Copy CSV**.

If your browser blocks downloads:
- You’ll see a **new tab** open with the CSV contents → press **Ctrl+S** (Save As) and save as `ev-bms-log.csv`.

## Notes for Assignment
- Use **Export CSV** to attach logs to your session notes.
- Take screenshots of **alerts** and **trends** during fault scenarios.
