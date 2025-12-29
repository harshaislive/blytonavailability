const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        
        // Look for inputs with 'date' in id, name, or class
        const inputs = await page.$$eval('input', els => {
            return els.map(el => ({
                id: el.id,
                name: el.name,
                class: el.className,
                value: el.value,
                placeholder: el.placeholder,
                type: el.type
            })).filter(i => 
                (i.id && i.id.toLowerCase().includes('date')) || 
                (i.name && i.name.toLowerCase().includes('date')) ||
                (i.class && i.class.toLowerCase().includes('date')) ||
                (i.placeholder && i.placeholder.toLowerCase().includes('date'))
            );
        });

        console.log('Date related inputs found:', inputs);

        // Also look for "Today" button or similar in the calendar wrapper if possible
        const calendarButtons = await page.$$eval('button, a, span', els => {
            return els
                .map(el => ({ tag: el.tagName, text: el.innerText, id: el.id, class: el.className }))
                .filter(el => ['today', 'current'].some(s => el.text.toLowerCase().includes(s)));
        });
        
        console.log('Possible "Today" controls:', calendarButtons);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
