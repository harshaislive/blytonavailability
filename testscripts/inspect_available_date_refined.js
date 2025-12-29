const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '18-01-2026';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        
        // Set Date
        await page.evaluate(({ start }) => {
            const chkin = document.querySelector('#eZ_chkin');
            if (chkin) { chkin.removeAttribute('readonly'); chkin.value = start; chkin.dispatchEvent(new Event('change')); }
        }, { start: START_DATE });
        
        // Checkout auto-set usually, but let's trust the previous success
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        await page.waitForTimeout(3000);

        console.log('--- HTML Dump of First Room Card ---');
        // Get the first room card
        const cardHTML = await page.$eval('.vres-roomlisting', el => el.outerHTML);
        console.log(cardHTML.substring(0, 1000)); // First 1000 chars

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
