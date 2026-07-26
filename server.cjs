const http = require('http');
const https = require('https');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CACHE_DURATION_MS = 45 * 60 * 1000; // 45 Minutes

let cachedPlaylist = null;
let lastFetchTime = 0;

function fetchUrl(url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const options = {
                hostname: u.hostname,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://timstreams.st/'
                }
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

function decodeStreamUrl(html) {
    if (!html) return null;
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (!match) {
        match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    }
    if (match) {
        const arr = match[2].split(',').map(Number);
        const arg1 = parseInt(match[4]);
        const arg2 = parseInt(match[6]);
        let decoded = "";
        for (let i = 0; i < arr.length; i++) {
            decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
        }
        const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
        if (m3u8Match) return m3u8Match[0];
    }
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

async function getOrUpdatePlaylist() {
    const now = Date.now();
    if (cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        const cacheAgeMin = Math.round((now - lastFetchTime) / 60000);
        console.log(`[+] Serving cached sports.m3u (Age: ${cacheAgeMin} min)`);
        return cachedPlaylist;
    }

    console.log(`[*] Cache expired. Fetching Live Sports Events + TV Channels...`);
    let m3uLines = ['#EXTM3U\n'];
    let totalStreamsCount = 0;

    // 1. FETCH LIVE & UPCOMING SPORTS EVENTS / MATCHES
    const rawEvents = await fetchUrl('https://api.vixnuvew.uk/api/live-upcoming');
    try {
        const eventsData = JSON.parse(rawEvents);
        const events = eventsData.events || [];
        console.log(`[+] Found ${events.length} Live/Upcoming Sports Events.`);

        for (const ev of events) {
            const evName = ev.name || ev.url;
            const evLogo = ev.logo || '';
            const eventStreams = ev.streams || [];

            for (let sIdx = 0; sIdx < eventStreams.length; sIdx++) {
                const st = eventStreams[sIdx];
                const stName = st.name ? `${evName} (${st.name})` : evName;
                const embedUrl = st.url || `https://logic.icelanders.st/embed/${ev.url}`;

                let streamUrl = embedUrl;
                if (embedUrl.includes('icelanders.st/embed/')) {
                    const html = await fetchUrl(embedUrl);
                    streamUrl = decodeStreamUrl(html) || embedUrl;
                }

                totalStreamsCount++;
                m3uLines.push(`#EXTINF:-1 tvg-name="${stName}" tvg-logo="${evLogo}" group-title="Live Sports Events",${stName}\n`);
                m3uLines.push(`${streamUrl}\n`);
            }
        }
    } catch(e) {
        console.error("[!] Error parsing live-upcoming events:", e.message);
    }

    // 2. FETCH LIVE TV CHANNELS
    const rawChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    try {
        const apiData = JSON.parse(rawChannels);
        const channels = apiData.channels || [];
        const genres = apiData.genres || {};
        console.log(`[+] Found ${channels.length} Live TV Channels.`);

        for (let i = 0; i < channels.length; i++) {
            const ch = channels[i];
            const name = ch.name || ch.url;
            const logo = ch.logo || '';
            const genreName = genres[ch.genre] || 'Sports Channels';
            
            let embedUrl = (ch.streams && ch.streams[0] && (ch.streams[0].url || ch.streams[0])) || `https://logic.icelanders.st/embed/${ch.url}`;
            const embedHtml = await fetchUrl(embedUrl);
            const m3u8StreamUrl = decodeStreamUrl(embedHtml) || embedUrl;

            totalStreamsCount++;
            m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
            m3uLines.push(`${m3u8StreamUrl}\n`);
        }
    } catch(e) {
        console.error("[!] Error parsing channels:", e.message);
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    
    try {
        fs.writeFileSync('sports.m3u', cachedPlaylist, 'utf-8');
        fs.writeFileSync('playlist.m3u', cachedPlaylist, 'utf-8');
    } catch(e) {}

    console.log(`[✓] Successfully updated sports.m3u playlist with ${totalStreamsCount} total stream items. Next auto-refresh in 45 minutes.`);
    return cachedPlaylist;
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/sports.m3u' || url === '/playlist.m3u' || url === '/') {
        const playlist = await getOrUpdatePlaylist();
        res.writeHead(200, {
            'Content-Type': 'application/x-mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=2700'
        });
        res.end(playlist);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[✓] Server listening on port ${PORT}`);
    console.log(`[✓] Serving live auto-updating M3U at http://localhost:${PORT}/sports.m3u`);
    getOrUpdatePlaylist();
});
