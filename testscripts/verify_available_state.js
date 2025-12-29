const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '08-01-2026'; // We know this date has availability
const END_DATE = '09-01-2026';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });

        // Set Dates
        await page.waitForSelector('#eZ_chkin', { timeout: 10000 });
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

        console.log(`Searching for available dates: ${START_DATE} to ${END_DATE}`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        await page.waitForTimeout(3000);

        // Check for "Availability Calendar" button
        const calBtn = await page.$('#availcalmain');
        const isCalVisible = calBtn ? await calBtn.isVisible() : false;
        console.log(`"Availability Calendar" button present: ${!!calBtn}, visible: ${isCalVisible}`);

        // Check for Room Results
        const roomResults = await page.$$('.room-type-header, .room_header, .roomname'); // Guessing classes
        console.log(`Found ${roomResults.length} room result headers (approx).`);

        // Check text content to confirm availability
        const bodyText = await page.innerText('body');
        if (bodyText.includes('Book Now') || bodyText.includes('Select Room')) {
            console.log('Confirmed: Page is showing booking options.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
