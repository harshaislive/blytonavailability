const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('#eZ_chkin', { timeout: 10000 });

        // Remove readonly attribute
        await page.$eval('#eZ_chkin', el => el.removeAttribute('readonly'));
        await page.$eval('#eZ_chkout', el => el.removeAttribute('readonly'));

        // Set Date to 31-12-2025
        await page.fill('#eZ_chkin', '31-12-2025');
        // Trigger change event to be safe
        await page.evaluate(() => {
            document.querySelector('#eZ_chkin').dispatchEvent(new Event('change'));
        });
        await page.press('#eZ_chkin', 'Enter');

        await page.fill('#eZ_chkout', '01-01-2026');
        await page.evaluate(() => {
            document.querySelector('#eZ_chkout').dispatchEvent(new Event('change'));
        });
        await page.press('#eZ_chkout', 'Enter');

        console.log('Clicking Check Availability...');
        await page.click('#book');

        // Wait for update
        await page.waitForTimeout(5000);

        // Check for "No rooms available" message
        const bodyText = await page.innerText('body');
        if (bodyText.includes('We have no rooms available') || bodyText.includes('No rooms available')) {
            console.log('DETECTED: "No rooms available" message is present.');
        } else {
            console.log('NOTE: "No rooms available" message NOT found.');
        }

        // Check for Calendar Button
        const calendarBtn = await page.$('#availcalmain');
        if (calendarBtn) {
            console.log('SUCCESS: "Availability Calendar" button IS present.');
            const isVisible = await calendarBtn.isVisible();
            console.log(`Button Visible: ${isVisible}`);
        } else {
            console.log('FAILURE: "Availability Calendar" button is MISSING.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
