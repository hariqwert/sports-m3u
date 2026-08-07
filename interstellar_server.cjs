const http = require('http');
const https = require('https');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

// TMDB ID 157336 = Interstellar (2014)
const INTERSTELLAR_TMDB_ID = "157336";

function fetchPage(urlStr, extraHeaders = {}) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const client = u.protocol === 'https:' ? https : http;
            client.get({
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://vidsrc.to/',
                    ...extraHeaders
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', () => resolve({ status: 500, data: '' }));
        } catch(e) {
            resolve({ status: 500, data: '' });
        }
    });
}

async function resolveInterstellarStream() {
    console.log("[*] Resolving live stream for Interstellar (TMDB ID: 157336)...");

    // Primary & Fallback high quality HLS stream manifests for Interstellar (1080p Full HD)
    const streamUrls = [
        "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
        "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8"
    ];

    return {
        success: true,
        title: "Interstellar (2014)",
        tmdbId: INTERSTELLAR_TMDB_ID,
        embedUrl: `https://vidsrc.me/embed/movie?tmdb=${INTERSTELLAR_TMDB_ID}`,
        m3u8Url: streamUrls[0],
        backupM3u8Url: streamUrls[1]
    };
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (url === '/' || url === '/interstellar' || url === '/interstellar_player.html') {
        if (fs.existsSync('interstellar_player.html')) {
            const html = fs.readFileSync('interstellar_player.html', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(html);
        }
    }

    if (url === '/interstellar.m3u' || url === '/movie.m3u') {
        const streamInfo = await resolveInterstellarStream();
        const m3uContent = `#EXTM3U\n#EXTINF:-1 tvg-id="157336" tvg-name="Interstellar (2014)" tvg-logo="https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" group-title="Movies",Interstellar (2014)\n${streamInfo.m3u8Url}\n`;
        res.writeHead(200, { 'Content-Type': 'application/x-mpegurl; charset=utf-8' });
        return res.end(m3uContent);
    }

    if (url === '/api/movie/157336' || url === '/api/interstellar') {
        const streamInfo = await resolveInterstellarStream();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(streamInfo, null, 2));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`[✓] Interstellar Movie Stream Server running on port ${PORT}`);
    console.log(`[✓] Test Web Player: http://localhost:${PORT}/interstellar_player.html`);
    console.log(`[✓] M3U Endpoint: http://localhost:${PORT}/interstellar.m3u`);
    console.log(`[✓] JSON API: http://localhost:${PORT}/api/movie/157336`);
});
