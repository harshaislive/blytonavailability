const { getBrowser } = require('./src/services/browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        
        // specific wait to ensure form is rendered
        await page.waitForTimeout(2000);

        // Get all inputs
        const inputs = await page.$$eval('input, select', els => {
            return els.map(el => ({
                tag: el.tagName,
                id: el.id,
                name: el.name,
                class: el.className,
                placeholder: el.placeholder,
                type: el.type,
                value: el.value,
                isVisible: el.offsetParent !== null // Check visibility
            }));
        });

        console.log('--- All Inputs & Selects ---');
        console.table(inputs);

        // Get all buttons/links that might be search triggers
        const buttons = await page.$$eval('button, a, input[type="submit"], input[type="button"]', els => {
            return els.map(el => ({
                tag: el.tagName,
                text: el.innerText.trim(),
                id: el.id,
                class: el.className,
                isVisible: el.offsetParent !== null
            })).filter(b => b.isVisible && b.text.length > 0); // Only visible with text
        });

        console.log('--- Visible Buttons/Links ---');
        console.table(buttons);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        process.exit();
    }
})();
