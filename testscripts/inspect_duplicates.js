const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const checkInCount = await page.locator('#eZ_chkin').count();
        console.log(`Found ${checkInCount} elements for #eZ_chkin`);

        const checkInDetails = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('#eZ_chkin'));
            return els.map((el, i) => ({
                id: '#eZ_chkin',
                index: i,
                tagName: el.tagName,
                isVisible: el.offsetParent !== null,
                className: el.className
            }));
        });
        console.table(checkInDetails);

        // Check avairoomtype
        const roomTypeCount = await page.locator('#avairoomtype').count();
        console.log(`Found ${roomTypeCount} elements for #avairoomtype`);

        const roomTypeDetails = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('#avairoomtype'));
            return els.map((el, i) => ({
                id: '#avairoomtype',
                index: i,
                tagName: el.tagName,
                isVisible: el.offsetParent !== null,
                className: el.className,
                optionCount: el.options ? el.options.length : 0
            }));
        });
        console.table(roomTypeDetails);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
