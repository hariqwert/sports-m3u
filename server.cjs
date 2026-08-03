const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CACHE_DURATION_MS = 45 * 60 * 1000; // 45 Minutes

let cachedPlaylist = null;
let lastFetchTime = 0;

/**
 * Base HTTP/HTTPS request with spoofed TimStreams headers
 */
function fetchUrl(urlStr, extraHeaders = {}) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://timstreams.st/',
                    'Origin': 'https://timstreams.st',
                    ...extraHeaders
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
            }).on('error', () => resolve({ status: 500, headers: {}, data: '' }));
        } catch(e) {
            resolve({ status: 500, headers: {}, data: '' });
        }
    });
}

/**
 * Decode obfuscated XOR JavaScript array from iframe player page
 */
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

/**
 * Token Encoder/Decoder for safe Proxy URLs
 */
function encodeToken(str) {
    return Buffer.from(str).toString('base64url');
}

function decodeToken(token) {
    try {
        return Buffer.from(token, 'base64url').toString('utf-8');
    } catch(e) {
        return null;
    }
}

/**
 * Resolve direct .m3u8 stream link + proxy fallback link for any channel ID
 */
async function resolveChannelStream(channelId) {
    const cleanId = channelId.replace(/.*\/embed\//, '').replace(/^\/+|\/+$/g, '');
    const embedUrl = `https://logic.icelanders.st/embed/${cleanId}`;
    const embedRes = await fetchUrl(embedUrl);
    const m3u8Url = decodeStreamUrl(embedRes.data) || embedUrl;
    const token = encodeToken(m3u8Url);
    
    return {
        success: !!m3u8Url,
        channelId: cleanId,
        embedUrl: embedUrl,
        directM3u8Url: m3u8Url,
        backupProxyUrl: `/live.php?token=${token}`,
        token: token
    };
}

function getFallbackCatalog() {
    if (fs.existsSync('channels.json')) {
        try {
            const data = JSON.parse(fs.readFileSync('channels.json', 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data;
        } catch(e) {}
    }
    return [];
}

/**
 * Generates playlist with dual endpoints (Direct + Backup Proxy links)
 */
async function getOrUpdatePlaylist() {
    const now = Date.now();
    if (cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        console.log(`[+] Serving cached sports.m3u (Age: ${Math.round((now - lastFetchTime) / 60000)} min)`);
        return cachedPlaylist;
    }

    console.log(`[*] Cache expired. Resolving streams & building sports.m3u...`);
    let m3uLines = ['#EXTM3U\n'];
    let totalCount = 0;

    // 1. LIVE & UPCOMING SPORTS EVENTS
    const resEvents = await fetchUrl('https://api.vixnuvew.uk/api/live-upcoming');
    if (resEvents.status === 200) {
        try {
            const eventsData = JSON.parse(resEvents.data);
            const events = eventsData.events || [];
            const eventGenres = eventsData.genres || {};

            for (const ev of events) {
                const evName = ev.name || ev.url;
                const evLogo = ev.logo || '';
                const genreName = eventGenres[ev.genre] || ev.genre || 'Live Sports';
                const eventStreams = ev.streams || [];

                for (let sIdx = 0; sIdx < eventStreams.length; sIdx++) {
                    const st = eventStreams[sIdx];
                    const stName = st.name ? `${evName} (${st.name})` : evName;
                    const embedUrl = st.url || `https://logic.icelanders.st/embed/${ev.url}`;

                    let streamUrl = embedUrl;
                    if (embedUrl.includes('icelanders.st/embed/')) {
                        const embedRes = await fetchUrl(embedUrl);
                        streamUrl = decodeStreamUrl(embedRes.data) || embedUrl;
                    }

                    totalCount++;
                    const token = encodeToken(streamUrl);
                    m3uLines.push(`#EXTINF:-1 tvg-name="${stName}" tvg-logo="${evLogo}" group-title="${genreName}" backup-url="/live.php?token=${token}",${stName}\n`);
                    m3uLines.push(`${streamUrl}\n`);
                }
            }
        } catch(e) {}
    }

    // 2. LIVE TV CHANNELS (WITH FALLBACK CATALOG PROTECTION)
    let channels = [];
    let genres = {};

    const resChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    if (resChannels.status === 200) {
        try {
            const apiData = JSON.parse(resChannels.data);
            channels = apiData.channels || [];
            genres = apiData.genres || {};
        } catch(e) {}
    }

    if (channels.length === 0) {
        console.warn(`[!] Primary API failed. Using local fallback catalog...`);
        const fallbackList = getFallbackCatalog();
        channels = fallbackList.map(item => ({
            url: item.channel_id || item.url || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: item.name,
            logo: item.logo,
            genreName: item.genre || 'Sports Channels',
            streams: [{ url: `https://logic.icelanders.st/embed/${item.channel_id || item.url || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` }]
        }));
    }

    for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        const name = ch.name || ch.url;
        const logo = ch.logo || '';
        const genreName = ch.genreName || genres[ch.genre] || 'Sports Channels';
        
        let embedUrl = (ch.streams && ch.streams[0] && (ch.streams[0].url || ch.streams[0])) || `https://logic.icelanders.st/embed/${ch.url}`;
        const embedRes = await fetchUrl(embedUrl);
        const m3u8StreamUrl = decodeStreamUrl(embedRes.data) || embedUrl;

        totalCount++;
        const token = encodeToken(m3u8StreamUrl);
        m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}" backup-url="/live.php?token=${token}",${name}\n`);
        m3uLines.push(`${m3u8StreamUrl}\n`);
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    
    try {
        fs.writeFileSync('sports.m3u', cachedPlaylist, 'utf-8');
        fs.writeFileSync('playlist.m3u', cachedPlaylist, 'utf-8');
    } catch(e) {}

    console.log(`[✓] Successfully updated sports.m3u playlist (${totalCount} streams).`);
    return cachedPlaylist;
}

/**
 * REVERSE PROXY BACKUP ENGINE (/live.php)
 * Spoofs Referer & Origin headers server-side to bypass 403 Forbidden & CORS restrictions
 */
function handleProxyRequest(req, res) {
    const parsedUrl = urlModule.parse(req.url, true);
    const query = parsedUrl.query;
    
    let rawTargetUrl = null;
    if (query.token) {
        rawTargetUrl = decodeToken(query.token);
    } else if (query.url || query.wanda) {
        rawTargetUrl = decodeToken(query.wanda || query.url) || query.wanda || query.url;
    }

    if (!rawTargetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing or invalid stream token' }));
    }

    try {
        const target = new URL(rawTargetUrl);
        const proxyOptions = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://timstreams.st/',
                'Origin': 'https://timstreams.st',
                'Accept': '*/*'
            }
        };

        const client = (target.protocol === 'https:' ? https : http).request(proxyOptions, (remoteRes) => {
            const headers = { ...remoteRes.headers };
            headers['access-control-allow-origin'] = '*';
            headers['access-control-allow-methods'] = 'GET, OPTIONS';
            headers['access-control-allow-headers'] = '*';

            res.writeHead(remoteRes.statusCode, headers);
            remoteRes.pipe(res);
        });

        client.on('error', (err) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy Gateway Error', message: err.message }));
        });

        req.pipe(client);
    } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL format' }));
    }
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // CORS Pre-flight Options
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });
        return res.end();
    }

    // 1. Full M3U Playlist Endpoint
    if (url === '/sports.m3u' || url === '/playlist.m3u' || url === '/') {
        const playlist = await getOrUpdatePlaylist();
        res.writeHead(200, {
            'Content-Type': 'application/x-mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=2700'
        });
        res.end(playlist);
    } 
    // 2. Resolver API (/api/resolve_stream/:id or /stream/:id)
    else if (url.startsWith('/stream/') || url.startsWith('/embed/') || url.startsWith('/api/resolve_stream/')) {
        const channelId = url.replace(/^\/(?:stream|embed|api\/resolve_stream)\//, '');
        if (!channelId) {
            res.writeHead(400);
            return res.end('Missing channel ID parameter');
        }
        
        const result = await resolveChannelStream(channelId);
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result, null, 2));
    } 
    // 3. Backup Reverse Proxy Endpoint (/live.php)
    else if (url === '/live.php' || url === '/proxy') {
        handleProxyRequest(req, res);
    } 
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[✓] Server listening on port ${PORT}`);
    console.log(`[✓] Playlist URL: http://localhost:${PORT}/sports.m3u`);
    console.log(`[✓] Stream Resolver: http://localhost:${PORT}/api/resolve_stream/:channelId`);
    console.log(`[✓] Backup Proxy: http://localhost:${PORT}/live.php?token=TOKEN`);
    getOrUpdatePlaylist();
});
