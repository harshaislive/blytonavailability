const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { getAvailability } = require('./controllers/availability');
const { closeBrowser } = require('./services/browser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Setup
try {
    const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
    console.error('Failed to load Swagger documentation:', e.message);
}

// Routes
app.get('/api/availability', getAvailability);

app.get('/', (req, res) => {
    res.redirect('/api-docs');
});

// Start Server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    // Keep running or exit gracefully depending on severity
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await closeBrowser();
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
