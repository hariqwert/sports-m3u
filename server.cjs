const http = require('http');
const https = require('https');
const urlModule = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

let torrentClient = null;

async function initEngine() {
    try {
        const { default: WebTorrent } = await import('webtorrent');
        torrentClient = new WebTorrent();
        console.log('[✓] WebTorrent ESM Engine initialized successfully!');
    } catch(e) {
        console.warn('[!] WebTorrent ESM init warning:', e.message);
    }
}
initEngine();

// Active Torrent State Tracker
let activeTorrentStats = {
    name: 'P2P Torrent Stream',
    magnet: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10',
    progress: 0,
    downloadSpeed: '0.00',
    numPeers: 0,
    length: 0,
    ready: false
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = urlModule.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Serve Static Web Assets
    if (pathname === '/' || pathname === '/index.html') {
        if (fs.existsSync('index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(fs.readFileSync('index.html', 'utf-8'));
        }
    } else if (pathname === '/index.css') {
        if (fs.existsSync('index.css')) {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            return res.end(fs.readFileSync('index.css', 'utf-8'));
        }
    } else if (pathname === '/app.js') {
        if (fs.existsSync('app.js')) {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            return res.end(fs.readFileSync('app.js', 'utf-8'));
        }
    }

    // API 1: Live Torrent Status Dashboard (/api/torrent/status)
    if (pathname === '/api/torrent/status') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, stats: activeTorrentStats }));
    }

    // API 2: P2P Sequential Stream Endpoint (/stream/play?magnet=...)
    if (pathname === '/stream/play') {
        const magnet = query.magnet || activeTorrentStats.magnet;
        console.log(`[*] Request received for stream magnet: ${magnet.slice(0, 60)}...`);
        
        if (torrentClient && magnet) {
            try {
                let torrent = torrentClient.get(magnet);
                if (!torrent) {
                    console.log('[*] Resolving magnet via WebTorrent Client (async)...');
                    torrent = await torrentClient.add(magnet);
                }

                activeTorrentStats.magnet = magnet;

                if (torrent && typeof torrent.on === 'function') {
                    torrent.on('download', () => {
                        activeTorrentStats.name = torrent.name || activeTorrentStats.name;
                        activeTorrentStats.progress = Math.round(torrent.progress * 100);
                        activeTorrentStats.downloadSpeed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
                        activeTorrentStats.numPeers = torrent.numPeers;
                        activeTorrentStats.length = torrent.length;
                        activeTorrentStats.ready = true;
                    });

                    torrent.on('wire', (wire, addr) => {
                        console.log(`[+] Connected to BitTorrent peer: ${addr || 'unknown'}`);
                        activeTorrentStats.numPeers = torrent.numPeers;
                    });

                    const serveTorrentFile = (torrentObj) => {
                        console.log(`[✓] Torrent metadata ready! Title: ${torrentObj.name}, Files: ${torrentObj.files.length}`);
                        const file = torrentObj.files && torrentObj.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm') || f.name.endsWith('.avi'));
                        
                        if (file) {
                            console.log(`[✓] Serving video file: ${file.name} (${(file.length / 1024 / 1024).toFixed(2)} MB)`);
                            file.select(); // Enable linear sequential piece downloading
                            
                            const range = req.headers.range;
                            if (!range) {
                                res.writeHead(200, {
                                    'Content-Length': file.length,
                                    'Content-Type': file.name.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4'
                                });
                                return file.createReadStream().pipe(res);
                            }

                            const parts = range.replace(/bytes=/, "").split("-");
                            const start = parseInt(parts[0], 10);
                            const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
                            const chunksize = (end - start) + 1;

                            res.writeHead(206, {
                                'Content-Range': `bytes ${start}-${end}/${file.length}`,
                                'Accept-Ranges': 'bytes',
                                'Content-Length': chunksize,
                                'Content-Type': file.name.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4'
                            });

                            return file.createReadStream({ start, end }).pipe(res);
                        } else {
                            console.warn('[!] No supported video file (.mp4, .mkv, .webm) found in torrent.');
                            res.writeHead(302, { 'Location': 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8' });
                            return res.end();
                        }
                    };

                    if (torrent.files && torrent.files.length > 0) {
                        return serveTorrentFile(torrent);
                    } else {
                        console.log('[*] Waiting for metadata from BitTorrent swarm...');
                        torrent.once('ready', () => serveTorrentFile(torrent));
                        return;
                    }
                }
            } catch(e) {
                console.error("Torrent stream error:", e.message);
            }
        }

        // Direct Stream Fallback
        res.writeHead(302, { 'Location': 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8' });
        return res.end();
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`[✓] AnimeTorrent P2P Portal Server running on http://localhost:${PORT}`);
});
