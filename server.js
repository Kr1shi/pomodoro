const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 7272;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Validation helper - checks for YYYY-MM-DD format
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

// Validation helper - checks preferences
function isValidPreferences(preferences) {
    const { lastMinutes, lastSeconds } = preferences;
    return typeof lastMinutes === 'number' && lastMinutes >= 0 &&
           typeof lastSeconds === 'number' && lastSeconds >= 0 && lastSeconds < 60;
}

// Initialize data directory and file
async function initDataFile() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        try {
            await fs.access(DATA_FILE);
        } catch {
            await fs.writeFile(DATA_FILE, JSON.stringify({}));
        }
    } catch (err) {
        console.error('Failed to initialize data file:', err);
    }
}

// Read data from file
async function readData() {
    try {
        const content = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error('Error reading data file:', err);
        return {};
    }
}

// Write data to file
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get daily total
app.get('/api/daily-total/:date', async (req, res, next) => {
    try {
        const { date } = req.params;

        if (!isValidDate(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        const data = await readData();
        const total = data[date] || 0;
        res.json({ total });
    } catch (err) {
        next(err);
    }
});

// Save daily total
app.post('/api/daily-total/:date', async (req, res, next) => {
    try {
        const { date } = req.params;
        const { total } = req.body;

        if (!isValidDate(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        if (typeof total !== 'number' || total < 0) {
            return res.status(400).json({ error: 'Invalid total. Must be a non-negative number.' });
        }

        const data = await readData();
        data[date] = total;
        await writeData(data);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Get user preferences
app.get('/api/preferences', async (req, res, next) => {
    try {
        const data = await readData();
        const preferences = data.preferences || { lastMinutes: 25, lastSeconds: 0 };
        res.json(preferences);
    } catch (err) {
        next(err);
    }
});

// Save user preferences
app.post('/api/preferences', async (req, res, next) => {
    try {
        if (!isValidPreferences(req.body)) {
            return res.status(400).json({ error: 'Invalid preferences' });
        }

        const data = await readData();
        data.preferences = {
            lastMinutes: req.body.lastMinutes,
            lastSeconds: req.body.lastSeconds
        };
        await writeData(data);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
initDataFile().then(() => {
    try {
        // 1. Look for .crt and .key files in /app/certs
        const certFiles = fsSync.readdirSync('/app/certs');
        const crtFile = certFiles.find(f => f.endsWith('.crt'));
        const keyFile = certFiles.find(f => f.endsWith('.key'));

        if (!crtFile || !keyFile) throw new Error("Certificates not found");

        // 2. Load the certificates
        const options = {
            key: fsSync.readFileSync(path.join('/app/certs', keyFile)),
            cert: fsSync.readFileSync(path.join('/app/certs', crtFile))
        };

        // 3. Start HTTPS Server
        https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Focus Timer (HTTPS) running at https://0.0.0.0:${PORT}`);
        });

    } catch (err) {
        console.warn("⚠️  SSL Certs missing or invalid. Falling back to HTTP (Notifications will fail).");
        console.error(err.message);
        
        // Fallback to HTTP if certs fail
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Focus Timer (HTTP) running at http://0.0.0.0:${PORT}`);
        });
    }
});