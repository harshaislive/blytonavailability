# Hospitality Availability API

A robust REST API service that provides programmatic access to room availability for **Blyton Bungalow**. It scrapes the live booking engine (`live.ipms247.com`) on-demand and caches the results to ensure high performance and low latency.

## 🚀 How It Works

1.  **Request:** Client calls `GET /api/availability`.
2.  **Cache Layer:** The system checks in-memory `node-cache` (TTL: 15 mins).
    *   *Hit:* Returns data instantly (<10ms).
    *   *Miss:* Triggers the Scraper Service.
3.  **Scraper Service:** 
    *   Uses a **Singleton** Chromium browser instance (via Playwright) to avoid overhead.
    *   Navigates to the booking engine.
    *   Injects JavaScript to force date selection and bypass UI blockers (modals/overlays).
    *   Parses the HTML table into structured JSON.
4.  **Response:** Returns the data and updates the cache.

---

## 🛠️ Tech Stack

*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js
*   **Automation:** Playwright (Chromium)
*   **Documentation:** Swagger UI
*   **Deployment:** Docker (optimized with `mcr.microsoft.com/playwright`)

---

## ⚙️ Local Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Install Browsers (Local only):**
    If running outside Docker, you need the Playwright binaries:
    ```bash
    npx playwright install chromium
    ```
3.  **Run the Server:**
    ```bash
    npm start
    ```
4.  **Access:**
    *   API: `http://localhost:3000/api/availability`
    *   Docs: `http://localhost:3000/api-docs`

---

## ☁️ Deployment (Coolify / Docker)

This project is Docker-native. It uses a specific base image to ensure all OS-level dependencies for Chromium are present.

### Coolify Configuration
*   **Build Type:** `Dockerfile` (Do **NOT** use Nixpacks).
*   **Port:** `3000`
*   **Base Image Note:** The `Dockerfile` is pinned to `mcr.microsoft.com/playwright:v1.57.0-jammy` to match `package.json`.

---

## 🔧 Maintenance: Handling UI Changes

Web scrapers are sensitive to UI changes on the target website. If the API returns `500` errors or empty data, the target site structure has likely changed.

### 🚨 Diagnosis & Mitigation Plan

**Step 1: Verify the breakage**
Check the logs. If you see `TimeoutError: waiting for selector "#some-id"`, the ID has changed.

**Step 2: Visual Debugging (Local)**
Use the scripts in the `testscripts/` folder. These are designed to help you inspect the site without running the full API.

1.  Open `testscripts/debug_scraper.js`.
2.  Change `headless: true` to `headless: false` in the launch options.
    ```javascript
    // testscripts/debug_scraper.js
    const browser = await chromium.launch({ headless: false }); // Watch it happen
    ```
3.  Run the script:
    ```bash
    node testscripts/debug_scraper.js
    ```
4.  Watch the browser window. See where it gets stuck (e.g., clicking the Calendar button, selecting dates).

**Step 3: Update Selectors**
Once you find the new ID or Class Name using the browser's Developer Tools (F12):
1.  Open `src/services/scraper.js`.
2.  Update the `const` or `page.click()` selectors to match the new site structure.
3.  Commit and push. Coolify will auto-deploy the fix.

### Common Failure Points (Files to Watch)
*   **Date Pickers:** Logic in `src/services/scraper.js` (Step 1).
*   **Calendar Button:** Logic in `src/services/scraper.js` (Step 2).
*   **Room Dropdown:** Logic in `src/services/scraper.js` (Step 3).

---

## 📂 Project Structure

```
├── src/
│   ├── app.js                 # Entry point & Express setup
│   ├── controllers/           # Request handling & Caching logic
│   ├── services/
│   │   ├── browser.js         # Singleton Browser Management
│   │   └── scraper.js         # CORE LOGIC: The actual scraping instructions
│   └── utils/
├── testscripts/               # 🛠️ DEBUGGING TOOLS (Use these when fixing bugs)
├── Dockerfile                 # Production container config
├── swagger.yaml               # API Documentation definition
└── package.json
```

## 📝 API Usage

### Get Availability (Calendar Mode)
Scrapes 2 months of data. Slower (5-10s) but comprehensive.
```http
GET /api/availability?mode=calendar
```

### Fast Check (Single Date)
Checks if "No rooms available" message exists. Fast (2-3s).
```http
GET /api/availability?mode=check&startDate=2025-12-31
```
