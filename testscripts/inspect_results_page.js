const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '08-01-2026';

const END_DATE = '09-01-2026';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });

        // Set Date
        await page.evaluate(({ start, end }) => {
            const chkin = document.querySelector('#eZ_chkin');
            const chkout = document.querySelector('#eZ_chkout');
            if (chkin) {
                chkin.removeAttribute('readonly');
                chkin.value = start;
                chkin.dispatchEvent(new Event('change'));
            }
            if (chkout) {
                chkout.removeAttribute('readonly');
                chkout.value = end;
                chkout.dispatchEvent(new Event('change'));
            }
        }, { start: START_DATE, end: END_DATE });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        await page.waitForTimeout(3000);

        console.log('Dumping classes of potential room elements...');
        // Log all div classes to find the room container
        const classes = await page.$$eval('div', divs => divs.map(d => d.className).filter(c => c && c.length < 50));
        console.log(classes.slice(0, 50));

        // Try to find price or room name
        const content = await page.innerText('body');
        console.log('Sample Body Text:', content.substring(0, 500));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
