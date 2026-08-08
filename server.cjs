const http = require('http');
const https = require('https');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (req.url === '/' || req.url === '/sports.m3u' || req.url === '/playlist.m3u') {
        if (fs.existsSync('sports.m3u')) {
            res.writeHead(200, { 'Content-Type': 'application/x-mpegurl; charset=utf-8' });
            return res.end(fs.readFileSync('sports.m3u', 'utf-8'));
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`[✓] IPTV Sports M3U Server running on http://localhost:${PORT}`);
});
