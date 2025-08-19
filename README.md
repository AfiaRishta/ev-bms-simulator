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
“An interactive EV Battery Management System (BMS) Simulator built using HTML, CSS, and vanilla JavaScript. The simulator models real-world EV battery behavior under different driving conditions (idle, city, highway, and hills) and charging states. It provides live telemetry on key parameters such as State of Charge (SoC), State of Health (SoH), voltage, current, power, temperature, speed, and estimated driving range.

The app also includes fault injection features (overheating, sensor noise, cell imbalance, stuck current sensor, etc.) to simulate critical scenarios and study their impact. Real-time charts and logs are generated offline without external libraries, and users can export or copy telemetry data as CSV for further analysis in Excel or other tools.

This project is designed as a lightweight, browser-based tool for learning, demonstrations, and assignments; no server or dependencies required, just open the index.html file and start simulating.”
