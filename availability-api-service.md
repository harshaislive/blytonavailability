# Hospitality Availability API Service Architecture

This document outlines the detailed architecture and implementation steps to transform the Playwright-based scraper into a robust, production-ready REST API service. This service will allow authorized clients to query room availability programmatically.

## 1. Architecture Overview

Since the target site requires complex DOM interactions (modals, dropdowns, dynamic AJAX loading), a simple HTTP client (like `fetch` or `axios`) is insufficient. We must use a **Headless Browser Service**.

### High-Level Flow
1.  **Client** sends `GET /api/availability?checkIn=2025-12-31` request.
2.  **API Server** checks **Redis/Memory Cache**.
    *   *Hit:* Returns cached data immediately (< 10ms).
    *   *Miss:* Triggers the **Scraper Service**.
3.  **Scraper Service** acquires a browser context from the **Browser Pool**.
4.  **Playwright** navigates to the booking engine, interacts with the calendar, and scrapes data.
5.  **Scraper Service** normalizes data and returns it to the API.
6.  **API Server** caches the result and sends the JSON response to the Client.

---

## 2. Technology Stack

*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js (for API routing)
*   **Browser Engine:** Playwright (Chromium)
*   **Caching:** Node-Cache (In-memory) or Redis (Distributed)
*   **Containerization:** Docker (Crucial for managing browser dependencies)

---

## 3. Project Structure

```text
hospitality-api/
├── src/
│   ├── config/
│   │   └── index.js         # Config (URLs, timeouts, selectors)
│   ├── controllers/
│   │   └── availability.js  # Request handling & validation
│   ├── services/
│   │   ├── browser.js       # Singleton Browser instance management
│   │   └── scraper.js       # Core scraping logic
│   ├── utils/
│   │   └── cache.js         # Caching wrapper
│   └── app.js               # Express entry point
├── Dockerfile               # Playwright-ready Docker image
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 4. Implementation Details

### Step 1: Dependencies
Initialize the project and install necessary packages.

```bash
npm init -y
npm install express playwright node-cache dotenv cors
npm install -D nodemon
npx playwright install chromium
```

### Step 2: Browser Management (`src/services/browser.js`)
To ensure performance, we do not launch a new browser for every request. We keep one browser instance open and use lightweight "Contexts" or "Pages".

```javascript
const { chromium } = require('playwright');

let browser;

async function getBrowser() {
    if (!browser) {
        console.log('Launching browser instance...');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for Docker
        });
    }
    return browser;
}

async function closeBrowser() {
    if (browser) await browser.close();
}

module.exports = { getBrowser, closeBrowser };
```

### Step 3: The Core Scraper Logic (`src/services/scraper.js`)
This encapsulates the logic we verified in `scraper_full.js`, adapted to be a reusable function.

```javascript
const { getBrowser } = require('./browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

async function fetchAvailability(monthsToScrape = 2) {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const results = [];

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Open Modal
        await page.waitForSelector('#availcalmain', { timeout: 10000 });
        await page.click('#availcalmain');
        await page.waitForSelector('table.scroll-tble', { timeout: 10000 });

        // Get Rooms
        const roomOptions = await page.$$eval('#avairoomtype option', options => {
            return options
                .map(o => ({ value: o.value, text: o.innerText.trim() }))
                .filter(o => o.value && o.text !== '--Select--');
        });

        // Iterate Rooms
        for (const room of roomOptions) {
            await page.selectOption('#avairoomtype', room.value);
            // Small wait for AJAX table refresh
            await page.waitForTimeout(1500); 

            const roomData = { room: room.text, availability: [] };
            const seenDates = new Set();

            for (let i = 0; i < monthsToScrape; i++) {
                // Scrape current view
                const rows = await page.$$eval('table.scroll-tble tr', (trs) => {
                    return trs.filter(tr => tr.querySelector('td')).map(tr => {
                        const cells = Array.from(tr.querySelectorAll('td')).slice(1);
                        return cells.map(cell => ({
                            aria: cell.getAttribute('aria-label') || '',
                            price: cell.querySelector('span')?.innerText.trim(),
                            isAvailable: cell.classList.contains('avail')
                        }));
                    });
                });

                // Flatten and parse
                rows.flat().forEach(item => {
                    const dateMatch = item.aria.match(/for\s+(.*?)\s+with/i);
                    const dateStr = dateMatch ? dateMatch[1].trim().replace(/\s+/g, ' ') : null;
                    
                    if (dateStr && !seenDates.has(dateStr)) {
                        seenDates.add(dateStr);
                        roomData.availability.push({
                            date: dateStr,
                            price: item.price,
                            available: item.isAvailable
                        });
                    }
                });

                // Click Next (if not last iteration)
                if (i < monthsToScrape - 1) {
                    const nextBtn = await page.$('#next_dt_clk');
                    if (nextBtn) {
                        await nextBtn.click();
                        await page.waitForTimeout(1500);
                    }
                }
            }
            results.push(roomData);
        }

    } catch (error) {
        console.error('Scraping failed:', error);
        throw error;
    } finally {
        await context.close(); // Close tab, keep browser
    }

    return results;
}

module.exports = { fetchAvailability };
```

### Step 4: API Controller with Caching (`src/controllers/availability.js`)

```javascript
const NodeCache = require('node-cache');
const { fetchAvailability } = require('../services/scraper');

// Cache for 15 minutes (900 seconds)
const cache = new NodeCache({ stdTTL: 900 });

async function getAvailability(req, res) {
    const cacheKey = 'full_availability';

    try {
        // 1. Check Cache
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({ 
                source: 'cache', 
                timestamp: Date.now(), 
                data: cachedData 
            });
        }

        // 2. Scrape if missing
        console.log('Cache miss. Starting scraper job...');
        const data = await fetchAvailability();

        // 3. Save to Cache
        cache.set(cacheKey, data);

        return res.json({ 
            source: 'live', 
            timestamp: Date.now(), 
            data: data 
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch availability', details: error.message });
    }
}

module.exports = { getAvailability };
```

### Step 5: Express Server (`src/app.js`)

```javascript
const express = require('express');
const { getAvailability } = require('./controllers/availability');
const { closeBrowser } = require('./services/browser');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/availability', getAvailability);

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    await closeBrowser();
    server.close(() => process.exit(0));
});
```

---

## 5. Deployment (Dockerization)

This is the **most critical part**. Playwright requires specific OS dependencies. We use the official Microsoft image.

### `Dockerfile`
```dockerfile
# Use the official Playwright image (includes Node.js and Browsers)
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose API port
EXPOSE 3000

# Run the server
CMD ["node", "src/app.js"]
```

### `docker-compose.yml`
```yaml
version: '3.8'
services:
  availability-api:
    build: .
    ports:
      - "3000:3000"
    restart: always
    environment:
      - NODE_ENV=production
```

---

## 6. API Specification

### Endpoint: Get Availability
`GET /api/availability`

**Response Example:**
```json
{
  "source": "live",
  "timestamp": 1703892000000,
  "data": [
    {
      "room": "DORAI SUITES",
      "availability": [
        {
          "date": "Wednesday, December 31, 2025",
          "price": "18,400.00",
          "available": false
        },
        {
          "date": "Thursday, January 1, 2026",
          "price": "19,500.00",
          "available": false
        }
      ]
    },
    {
      "room": "STANDARD FAMILY ROOM",
      "availability": [
         // ...
      ]
    }
  ]
}
```

---

## 7. Optimization & Best Practices

1.  **Concurrency Control:**
    *   Do not allow unlimited parallel scraping requests. Use a queue (like `bull` or `p-queue`) if you expect high traffic. The `node-cache` implementation above acts as a basic shield, but if 10 people hit the endpoint simultaneously when the cache is empty, 10 browsers might spawn.
    *   *Fix:* Implement a "Promise singleton" pattern where simultaneous requests wait for the *same* scraping operation to finish.

2.  **Robustness:**
    *   **Retry Logic:** If the page fails to load (timeout), retry the navigation once before throwing an error.
    *   **Health Check:** `GET /health` should verify the browser instance is responsive.

3.  **Anti-Bot Detection (Advanced):**
    *   While the current site is lenient, consider using `playwright-extra` and `puppeteer-extra-plugin-stealth` if you encounter blocking.
    *   Rotate User-Agent strings.

4.  **Scheduled Scraping (Proactive Caching):**
    *   Instead of scraping *on demand* (which takes 5-10 seconds), run a CRON job (e.g., every 15 minutes) to update the cache in the background. This ensures the API always responds instantly.
