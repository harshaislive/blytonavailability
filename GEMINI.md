# Hospitality Availability API Service

## Project Overview
This project is a design and specification for a **REST API Service** that provides programmatic access to room availability data for a specific hospitality provider.
Because the target data is behind a complex, dynamic web interface (AJAX, modals), this service uses **Playwright** (a headless browser automation tool) to scrape the live booking engine on-demand or via a schedule.

**Current Status:** Specification Phase. (Implementation pending).

## Core Architecture
*   **Goal:** Expose a JSON endpoint (`GET /api/availability`) to authorized clients.
*   **Data Source:** Scrapes `https://live.ipms247.com/booking/book-rooms-blytonbungalow`.
*   **Performance Strategy:**
    *   **Browser Pooling:** Uses a singleton browser instance to avoid the overhead of launching a new browser for every request.
    *   **Caching:** Implements a "Cache-First" strategy (Node-Cache or Redis) to serve repeated requests instantly (<10ms) and minimize load on the target site.

## Technology Stack
*   **Runtime:** Node.js (v18+)
*   **API Framework:** Express.js
*   **Scraping Engine:** Playwright (Chromium)
*   **Caching:** Node-Cache (In-memory) / Redis
*   **Deployment:** Docker (Essential for managing Playwright's OS dependencies).

## Planned Project Structure
The specification outlines the following directory structure for the implementation:

```text
hospitality-api/
├── src/
│   ├── config/          # Configuration (URLs, selectors)
│   ├── controllers/     # Request handling logic
│   ├── services/        # Business logic (Scraper, Browser management)
│   ├── utils/           # Helpers (Cache wrapper)
│   └── app.js           # Application entry point
├── Dockerfile           # Container definition
└── docker-compose.yml   # Orchestration
```

## Implementation Plan
1.  **Initialize Project:** `npm init` and install dependencies (`express`, `playwright`, `node-cache`, `dotenv`).
2.  **Browser Service:** Implement a singleton pattern to manage the Chromium instance.
3.  **Scraper Logic:** Port the verified scraping logic (handling modals, iterating room types, parsing calendar tables) into a reusable service function.
4.  **API Endpoint:** Create the Express controller to handle `GET /api/availability`, integrating the caching layer.
5.  **Dockerization:** precise `Dockerfile` setup using the official `mcr.microsoft.com/playwright` base image.

## Key Reference
*   `availability-api-service.md`: Contains the detailed architectural blueprint, code snippets, and deployment strategy.
