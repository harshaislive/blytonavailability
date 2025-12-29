const NodeCache = require('node-cache');
const { fetchAvailability, checkDateAvailability } = require('../services/scraper');

// Cache for 15 minutes (900 seconds)
const cache = new NodeCache({ stdTTL: 900 });

async function getAvailability(req, res) {
    // Optional: Extract query params
    const months = req.query.months ? parseInt(req.query.months) : 2;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const mode = req.query.mode || 'calendar'; // 'calendar' (default) or 'check' (single date)
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    
    // Normalize date for cache key (YYYY-MM-DD)
    const dateKey = startDate.toISOString().split('T')[0];
    const cacheKey = `availability_${mode}_m${months}_o${offset}_d${dateKey}`;

    try {
        // 1. Check Cache
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({ 
                source: 'cache', 
                timestamp: Date.now(), 
                params: { mode, startDate: dateKey },
                data: cachedData 
            });
        }

        // 2. Scrape if missing
        console.log(`Cache miss. Starting ${mode} scraper job (Start: ${dateKey})...`);
        
        let data;
        if (mode === 'check' || mode === 'single') {
            data = await checkDateAvailability(startDate);
        } else {
            data = await fetchAvailability(months, offset, startDate);
        }

        // 3. Save to Cache
        cache.set(cacheKey, data);

        return res.json({ 
            source: 'live', 
            timestamp: Date.now(), 
            params: { mode, startDate: dateKey },
            data: data 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch availability', details: error.message });
    }
}

module.exports = { getAvailability };
