const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

function formatDateDDMMYYYY(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        
        let found = false;
        let currentDate = new Date('2026-01-08'); // Start where user said

        // Try 10 different dates
        for (let i = 0; i < 10; i++) {
            const nextDay = new Date(currentDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const startStr = formatDateDDMMYYYY(currentDate);
            const endStr = formatDateDDMMYYYY(nextDay);
            
            console.log(`Checking ${startStr}...`);

            // Set Date
            await page.evaluate(({ start, end }) => {
                const chkin = document.querySelector('#eZ_chkin');
                const chkout = document.querySelector('#eZ_chkout');
                if (chkin) { chkin.removeAttribute('readonly'); chkin.value = start; chkin.dispatchEvent(new Event('change')); }
                if (chkout) { chkout.removeAttribute('readonly'); chkout.value = end; chkout.dispatchEvent(new Event('change')); }
            }, { start: startStr, end: endStr });

            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
                page.click('#book')
            ]);
            await page.waitForTimeout(2000);

            const bodyText = await page.innerText('body');
            if (!bodyText.includes('We have no rooms available')) {
                console.log('SUCCESS: Found available rooms!');
                
                // Dump selectors
                console.log('--- Room Elements ---');
                // Guessing classes based on typical structure
                const roomNames = await page.$$eval('h2, h3, .room_header, .roomname, .room-type-name', els => els.map(e => e.innerText));
                console.log('Potential Names:', roomNames);
                
                // Dump prices
                const prices = await page.$$eval('.price, .amount, .room-price', els => els.map(e => e.innerText));
                console.log('Potential Prices:', prices);

                // Dump all classes again
                const classes = await page.$$eval('div, span, a', els => els.map(e => e.className).filter(c => c && c.includes('room')));
                console.log('Room Classes:', [...new Set(classes)]);
                
                found = true;
                break;
            } else {
                console.log('  -> No rooms.');
            }
            
            // Advance 5 days to jump around
            currentDate.setDate(currentDate.getDate() + 5);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
