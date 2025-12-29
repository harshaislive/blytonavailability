const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '21-01-2026';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        
        // Set Date
        await page.evaluate(({ start }) => {
            const chkin = document.querySelector('#eZ_chkin');
            if (chkin) {
                chkin.removeAttribute('readonly');
                chkin.value = start;
                chkin.dispatchEvent(new Event('change'));
            }
        }, { start: START_DATE });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        await page.waitForTimeout(3000);

        console.log(`Checking results for ${START_DATE}...`);

        // Check for room cards
        const cards = await page.$$('.vres-roomlisting');
        console.log(`Found ${cards.length} cards with selector .vres-roomlisting`);

        if (cards.length > 0) {
            const firstCardHTML = await cards[0].evaluate(el => el.outerHTML);
            console.log('--- First Card HTML ---');
            console.log(firstCardHTML.substring(0, 1500));
        } else {
            console.log('No cards found. Dumping body classes to check page structure...');
            const bodyClasses = await page.$eval('body', el => el.className);
            console.log('Body classes:', bodyClasses);
            
            const divClasses = await page.$$eval('div', divs => divs.map(d => d.className).slice(0, 20));
            console.log('Top 20 div classes:', divClasses);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
