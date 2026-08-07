const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 Minutes

let cachedPlaylist = null;
let lastFetchTime = 0;

function fetchPage(urlStr, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': referer || 'https://dlhd.st/'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', () => resolve({ status: 500, data: '' }));
        } catch(e) {
            resolve({ status: 500, data: '' });
        }
    });
}

function decodeDaddyLiveBase64(html) {
    if (!html) return null;
    const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
    if (match) {
        try {
            return Buffer.from(match[1], 'base64').toString('utf-8');
        } catch(e) {}
    }
    return null;
}

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

async function resolveChannelStream(channelId) {
    const cleanId = channelId.replace(/[^0-9]/g, '') || '51';
    const streamPhpUrl = `https://dlhd.st/stream/stream-${cleanId}.php`;
    const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${cleanId}`;
    
    const playerHtml = await fetchPage(playerIframeUrl, streamPhpUrl);
    const m3u8Url = decodeDaddyLiveBase64(playerHtml.data);
    const token = m3u8Url ? encodeToken(m3u8Url + '|' + playerIframeUrl) : null;

    return {
        success: !!m3u8Url,
        channelId: cleanId,
        streamPhpUrl,
        playerIframeUrl,
        m3u8Url,
        proxyUrl: token ? `/live.php?token=${token}` : null
    };
}

async function getOrUpdatePlaylist() {
    const now = Date.now();
    if (cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedPlaylist;
    }

    if (fs.existsSync('dlhd.m3u')) {
        cachedPlaylist = fs.readFileSync('dlhd.m3u', 'utf-8');
        lastFetchTime = Date.now();
        return cachedPlaylist;
    }

    let m3uLines = ['#EXTM3U\n'];
    const sampleIds = ["51", "61", "62", "90", "91", "100", "116", "117", "118", "123", "124", "125", "126", "134", "145", "206", "267", "268", "283", "284", "293", "302", "303", "304", "305", "306", "309", "311", "313", "314", "315", "316", "335", "346", "352", "370", "374", "411", "423", "425", "429", "430", "432", "433", "436", "446", "524", "578", "600", "602", "646", "664", "699", "742", "745", "766", "767", "775", "791", "793", "885", "886", "887", "892", "900", "936", "1042", "1052"];
    
    for (const id of sampleIds) {
        const res = await resolveChannelStream(id);
        if (res.success) {
            m3uLines.push(`#EXTINF:-1 tvg-id="${id}" tvg-name="Channel ${id}" group-title="Live Sports",Channel ${id}\n`);
            m3uLines.push(`#EXTVLCOPT:http-referrer=${res.playerIframeUrl}\n`);
            m3uLines.push(`${res.m3u8Url}\n`);
        }
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    return cachedPlaylist;
}

function handleProxyRequest(req, res) {
    const parsedUrl = urlModule.parse(req.url, true);
    const query = parsedUrl.query;
    
    let decodedStr = null;
    if (query.token) decodedStr = decodeToken(query.token);
    
    if (!decodedStr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing or invalid token' }));
    }

    const parts = decodedStr.split('|');
    const targetUrl = parts[0];
    const referer = parts[1] || 'https://hamis.romponalis.st/';

    try {
        const target = new URL(targetUrl);
        const proxyOptions = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': referer,
                'Origin': new URL(referer).origin
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
            res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
        });

        req.pipe(client);
    } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL format' }));
    }
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });
        return res.end();
    }

    if (url === '/sports.m3u' || url === '/playlist.m3u' || url === '/') {
        const playlist = await getOrUpdatePlaylist();
        res.writeHead(200, {
            'Content-Type': 'application/x-mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(playlist);
    } 
    else if (url.startsWith('/api/resolve_stream/') || url.startsWith('/stream/')) {
        const channelId = url.replace(/^\/(?:api\/resolve_stream|stream)\//, '');
        const result = await resolveChannelStream(channelId);
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result, null, 2));
    } 
    else if (url === '/live.php' || url === '/proxy') {
        handleProxyRequest(req, res);
    } 
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[✓] Resilient M3U Server running on port ${PORT}`);
    console.log(`[✓] M3U Playlist: http://localhost:${PORT}/sports.m3u`);
    console.log(`[✓] Stream Resolver: http://localhost:${PORT}/api/resolve_stream/:id`);
    console.log(`[✓] Reverse Proxy: http://localhost:${PORT}/live.php?token=TOKEN`);
});
