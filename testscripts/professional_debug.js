const { chromium } = require('playwright');
const fs = require('fs');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';
const START_DATE = '08-01-2026'; // dd-mm-yyyy
const END_DATE = '09-01-2026';

async function runDiagnostic() {
    console.log('[1/6] Launching Browser...');
    const browser = await chromium.launch({ headless: true }); // Headless: true for speed, but logs will tell us story
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log(`[2/6] Navigating to ${URL}...`);
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('      Page loaded.');

        // Step 3: Set Dates
        console.log(`[3/6] Setting Dates: ${START_DATE} to ${END_DATE}`);
        
        // Wait for inputs
        await page.waitForSelector('#eZ_chkin', { state: 'attached', timeout: 10000 });
        
        // Set values robustly
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

        console.log('      Dates set. Clicking "Check Availability" (#book)...');
        
        // Click Search
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => console.log('      (No full page reload detected, asking for wait...)')),
            page.click('#book')
        ]);
        
        // Wait a bit for stability
        await page.waitForTimeout(3000);
        console.log('      Search completed.');

        // Step 4: Find Calendar Button
        console.log('[4/6] Looking for "Availability Calendar" button (#availcalmain)...');
        const calBtn = await page.$('#availcalmain');
        
        if (!calBtn) {
            throw new Error('CRITICAL: Calendar button #availcalmain NOT found in DOM.');
        }

        const isVisible = await calBtn.isVisible();
        console.log(`      Button found. Visible: ${isVisible}`);

        if (!isVisible) {
            console.log('      WARNING: Button is hidden. Dumping parent HTML...');
            const parentHTML = await calBtn.evaluate(el => el.parentElement.outerHTML);
            console.log(parentHTML.substring(0, 500)); // Log first 500 chars
            // Attempt to force click anyway?
        }

        console.log('      Clicking "Availability Calendar"...');
        await calBtn.click();

        // Step 5: Monitor Modal
        console.log('[5/6] Waiting for Modal Table (table.scroll-tble)...');
        
        try {
            const table = await page.waitForSelector('table.scroll-tble', { state: 'visible', timeout: 10000 });
            console.log('      SUCCESS: Table found and visible!');
        } catch (e) {
            console.error('      FAILURE: Table did not appear within 10s.');
            
            // DIAGNOSTIC: What IS visible?
            console.log('      Diagnosing Modal State...');
            
            // Check if any modal is open
            const modals = await page.$$('.modal, .popup, #availcal'); // Generic guess + specific ID check
            console.log(`      Found ${modals.length} potential modal elements.`);
            
            // Dump the body HTML to a file for review
            const html = await page.content();
            fs.writeFileSync('debug_page_dump.html', html);
            console.log('      Saved page HTML to "debug_page_dump.html"');
        }

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await browser.close();
        console.log('[6/6] Done.');
    }
}

runDiagnostic();
