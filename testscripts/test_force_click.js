const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '08-01-2026';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });

        // Set Date to Available Date
        await page.waitForSelector('#eZ_chkin', { timeout: 10000 });
        await page.evaluate(({ start }) => {
            const chkin = document.querySelector('#eZ_chkin');
            const chkout = document.querySelector('#eZ_chkout');
            if (chkin) {
                chkin.removeAttribute('readonly');
                chkin.value = start;
                chkin.dispatchEvent(new Event('change'));
            }
        }, { start: START_DATE });
        
        // We assume checkout updates automatically or we don't care for this test
        
        console.log('Searching (triggering Available state)...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        await page.waitForTimeout(3000);

        // Force Click Hidden Calendar Button
        console.log('Attempting to click HIDDEN calendar button...');
        const calBtn = await page.$('#availcalmain');
        
        // Force visibility
        await page.$eval('#availcalmain', el => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
        });

        await calBtn.click();
        console.log('Clicked!');

        // Check if modal opens
        try {
            await page.waitForSelector('table.scroll-tble', { timeout: 5000 });
            console.log('SUCCESS: Calendar modal opened via force-click!');
        } catch (e) {
            console.log('FAILURE: Calendar modal did NOT open.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
