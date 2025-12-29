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
    if (browser) {
        await browser.close();
        browser = null;
    }
}

module.exports = { getBrowser, closeBrowser };
