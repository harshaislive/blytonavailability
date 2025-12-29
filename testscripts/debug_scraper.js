const { fetchAvailability } = require('./src/services/scraper');

(async () => {
    try {
        console.log('Starting debug scrape...');
        // Scrape 1 month only to verify the first batch is caught
        const data = await fetchAvailability(1); 
        
        const familyRoom = data.find(r => r.room === 'STANDARD FAMILY ROOM');
        
        if (familyRoom) {
            console.log('Found STANDARD FAMILY ROOM data:');
            // Log first 5 items to verify start date
            console.log(JSON.stringify(familyRoom.availability.slice(0, 5), null, 2));
        } else {
            console.log('STANDARD FAMILY ROOM not found.');
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();