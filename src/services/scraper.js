const { getBrowser } = require('./browser');

const URL = 'https://live.ipms247.com/booking/book-rooms-blytonbungalow';

function formatDateDDMMYYYY(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

async function fetchAvailability(monthsToScrape = 2, skipMonths = 0, startDate = new Date()) {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const results = [];

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // --- STEP 1: SET DATES & SEARCH ---
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const checkInStr = formatDateDDMMYYYY(start);
        const checkOutStr = formatDateDDMMYYYY(end);

        console.log(`Setting search range: ${checkInStr} to ${checkOutStr}`);

        await page.waitForSelector('#eZ_chkin', { timeout: 10000 });

        // Robustly set values via JS
        await page.evaluate(({ id, val }) => {
            const el = document.querySelector(id);
            if (el) {
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('change'));
                el.dispatchEvent(new Event('input'));
            }
        }, { id: '#eZ_chkin', val: checkInStr });
        
        await page.evaluate(({ id, val }) => {
            const el = document.querySelector(id);
            if (el) {
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('change'));
                el.dispatchEvent(new Event('input'));
            }
        }, { id: '#eZ_chkout', val: checkOutStr });

        // Click Search
        console.log('Clicking Check Availability...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        
        await page.waitForTimeout(3000);


        // --- STEP 2: OPEN CALENDAR (UNIVERSAL BYPASS) ---
        console.log('Opening Availability Calendar...');
        const calBtn = await page.waitForSelector('#availcalmain', { timeout: 10000 });
        
        // FORCE VISIBILITY & REMOVE BLOCKERS
        await page.evaluate(() => {
            // 1. Force Button Visible
            const btn = document.querySelector('#availcalmain');
            if (btn) {
                btn.style.display = 'block';
                btn.style.visibility = 'visible';
                btn.style.opacity = '1';
            }

            // 2. Nuke potential blockers (SweetAlert, overlays)
            const blockers = document.querySelectorAll('.sweet-alert, .sweet-overlay, .modal-backdrop, .loadingbar');
            blockers.forEach(el => el.remove());
        });

        await calBtn.click();
        
        // Wait for table
        await page.waitForSelector('table.scroll-tble', { timeout: 15000 });


        // --- STEP 3: HANDLE ROOM DROPDOWN (HIDDEN/DUPLICATE FIX) ---
        await page.waitForSelector('#avairoomtype', { timeout: 10000, state: 'attached' });
        
        // FORCE VISIBILITY
        await page.$$eval('#avairoomtype', els => {
            els.forEach(el => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.height = 'auto';
                el.style.width = 'auto';
                el.style.zIndex = '99999';
            });
        });

        // Get Options
        const roomOptions = await page.$$eval('#avairoomtype option', options => {
            return options
                .map(o => ({ value: o.value, text: o.innerText.trim() }))
                .filter(o => o.value && o.text !== '--Select--');
        });

        // Iterate Rooms
        for (const room of roomOptions) {
            console.log(`Scraping room: ${room.text}`);
            
            await page.selectOption('#avairoomtype', room.value);
            
            // Wait for AJAX update
            await page.waitForTimeout(3000); 

            // Skip months if requested
            if (skipMonths > 0) {
                console.log(`Skipping ${skipMonths} months...`);
                for (let s = 0; s < skipMonths; s++) {
                    const nextBtn = await page.$('#next_dt_clk');
                    if (nextBtn) {
                        await nextBtn.click();
                        await page.waitForTimeout(1000); 
                    } else {
                        break;
                    }
                }
            }

            const roomData = { room: room.text, availability: [] };
            const seenDates = new Set();

            for (let i = 0; i < monthsToScrape; i++) {
                // Scrape rows
                let rows = await page.$$eval('table.scroll-tble tr', (trs) => {
                    return trs.filter(tr => tr.querySelector('td')).map(tr => {
                        const cells = Array.from(tr.querySelectorAll('td')).slice(1);
                        return cells.map(cell => ({
                            aria: cell.getAttribute('aria-label') || '',
                            price: cell.querySelector('span')?.innerText.trim(),
                            isAvailable: cell.classList.contains('avail')
                        }));
                    });
                });
                
                // Retry if empty
                if (rows.length === 0) {
                     await page.waitForTimeout(2000);
                     rows = await page.$$eval('table.scroll-tble tr', (trs) => {
                        return trs.filter(tr => tr.querySelector('td')).map(tr => {
                            const cells = Array.from(tr.querySelectorAll('td')).slice(1);
                            return cells.map(cell => ({
                                aria: cell.getAttribute('aria-label') || '',
                                price: cell.querySelector('span')?.innerText.trim(),
                                isAvailable: cell.classList.contains('avail')
                            }));
                        });
                    });
                }

                // Parse
                rows.flat().forEach(item => {
                    const dateMatch = item.aria.match(/for\s+(.*?)\s+with/i);
                    const dateStr = dateMatch ? dateMatch[1].trim().replace(/\s+/g, ' ') : null;
                    
                    if (dateStr && !seenDates.has(dateStr)) {
                        seenDates.add(dateStr);
                        roomData.availability.push({
                            date: dateStr,
                            price: item.price,
                            available: item.isAvailable
                        });
                    }
                });

                // Next
                if (i < monthsToScrape - 1) {
                    const nextBtn = await page.$('#next_dt_clk');
                    if (nextBtn) {
                        await nextBtn.click();
                        await page.waitForTimeout(1500);
                    }
                }
            }
            results.push(roomData);
        }

    } catch (error) {
        console.error('Scraping failed:', error);
        throw error;
    } finally {
        await context.close(); 
    }

    return results;
}

// FAST MODE: Checks a single date range by reading the search results page directly.
// Returns: { available: boolean, message: string }
async function checkDateAvailability(startDate = new Date()) {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1); // 1 Night

        const checkInStr = formatDateDDMMYYYY(start);
        const checkOutStr = formatDateDDMMYYYY(end);

        console.log(`[Fast Check] Searching: ${checkInStr} to ${checkOutStr}`);

        // Set Date Inputs
        await page.waitForSelector('#eZ_chkin', { timeout: 10000 });
        
        await page.evaluate(({ id, val }) => {
            const el = document.querySelector(id);
            if (el) {
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('change'));
            }
        }, { id: '#eZ_chkin', val: checkInStr });
        
        await page.evaluate(({ id, val }) => {
            const el = document.querySelector(id);
            if (el) {
                el.removeAttribute('readonly');
                el.value = val;
                el.dispatchEvent(new Event('change'));
            }
        }, { id: '#eZ_chkout', val: checkOutStr });

        // Click Search
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
            page.click('#book')
        ]);
        
        await page.waitForTimeout(2000);

        // Check for "No rooms available" message
        const bodyText = await page.innerText('body');
        const isUnavailable = bodyText.includes('We have no rooms available');

        if (isUnavailable) {
            return {
                date: checkInStr,
                available: false,
                status: 'Sold Out',
                rooms: []
            };
        } else {
            // Scrape available rooms
            const rooms = await page.$$eval('.vres-roomlisting', cards => {
                return cards.map(card => {
                    // Check visibility - if hidden, it's likely not bookable/sold out logic
                    // We check if the main container is displayed
                    const isVisible = card.offsetParent !== null;

                    const nameEl = card.querySelector('h3.followMeBar em') || card.querySelector('h3');
                    const name = nameEl ? nameEl.textContent.trim() : 'Unknown Room';
                    
                    // Simple visibility check or look for "Sold Out" badges
                    // Note: innerText is empty if hidden, so we use textContent or check visibility explicit
                    const isSoldOut = !isVisible || card.textContent.includes('Sold Out') || card.classList.contains('sold-out');
                    
                    const priceEl = card.querySelector('.price, .amount, .room-rate'); 
                    let price = priceEl ? priceEl.textContent.trim() : null;
                    
                    if (!price) {
                        const text = card.textContent;
                        const match = text.match(/Rs\.?\s*([\d,]+)/i);
                        if (match) price = match[1];
                    }

                    return {
                        name: name,
                        status: isSoldOut ? 'Sold Out' : 'Available',
                        price: price || 'Check Details'
                    };
                });
            });

            console.log('[Fast Check] Scraped Rooms:', JSON.stringify(rooms, null, 2));

            return {
                date: checkInStr,
                available: rooms.some(r => r.status === 'Available'),
                status: 'Available',
                rooms: rooms
            };
        }

    } catch (error) {
        console.error('Fast check failed:', error);
        throw error;
    } finally {
        await context.close();
    }
}

module.exports = { fetchAvailability, checkDateAvailability };
