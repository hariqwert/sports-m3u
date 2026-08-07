# UPDATING.md — Step-by-Step Manual Update Guide (No `git pull` Required)

If you cannot run `git pull` or want to manually update your existing website and backend files, follow these 3 simple file replacement steps:

---

## 🛠️ Step 1: Update `server.cjs`

Replace the contents of your backend **`server.cjs`** file with this exact code:

```javascript
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

    if (fs.existsSync('sports.m3u')) {
        cachedPlaylist = fs.readFileSync('sports.m3u', 'utf-8');
        lastFetchTime = Date.now();
        return cachedPlaylist;
    }

    return "#EXTM3U\n";
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
});
```

---

## 🛠️ Step 2: Update `fetch_real_m3u.cjs`

Replace **`fetch_real_m3u.cjs`** with this updated code (fixes `NXDOMAIN` by using active embed domain `https://hux-giants.shop/embed/{id}`):

```javascript
const https = require('https');
const http = require('http');
const fs = require('fs');

function fetchPage(urlStr, extraHeaders = {}) {
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
                    'Accept': 'application/json, text/plain, */*',
                    ...extraHeaders
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

function decodeXORStream(html) {
    if (!html) return null;

    const regex1 = /var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/;
    const regex2 = /var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*var\s+([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*var\s+([a-zA-Z0-9_$]+)\s*=\s*(\d+);/;

    const match = html.match(regex1) || html.match(regex2);
    if (!match) return null;

    const arr = match[2].split(',').map(Number);
    const arg1 = parseInt(match[4], 10);
    const arg2 = parseInt(match[6], 10);

    let decoded = '';
    for (let i = 0; i < arr.length; i++) {
        decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
    }

    const m3u8Match = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    return m3u8Match ? m3u8Match[0] : null;
}

async function extractChannel(ch) {
    let embedUrl = null;
    if (ch.streams && ch.streams.length > 0 && ch.streams[0].url) {
        embedUrl = ch.streams[0].url;
    } else {
        const chId = ch.url || ch.id || ch.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        embedUrl = `https://hux-giants.shop/embed/${chId}`;
    }

    const pageRes = await fetchPage(embedUrl);
    const m3u8Url = decodeXORStream(pageRes.data);

    const idStr = ch.url || ch.id || ch.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const logoUrl = ch.logo || `https://flagcdn.com/20x15/${(ch.flag || 'us').toLowerCase()}.png`;

    if (m3u8Url) {
        return {
            id: idStr,
            name: ch.name,
            logo: logoUrl,
            m3u8Url: m3u8Url
        };
    }
    return null;
}

async function extractTimStreamsPlaylist() {
    console.log("[*] Fetching live channel list dynamically from timstreams.st/api/channels...");
    
    let channels = [];
    const apiRes = await fetchPage('https://timstreams.st/api/channels');
    
    if (apiRes.status === 200 && apiRes.data) {
        try {
            const parsed = JSON.parse(apiRes.data);
            channels = parsed.channels || [];
        } catch(e) {}
    }

    if (channels.length === 0 && fs.existsSync('channels.json')) {
        channels = JSON.parse(fs.readFileSync('channels.json', 'utf-8'));
    }

    const BATCH_SIZE = 25;
    const results = [];

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(ch => extractChannel(ch)));
        batchResults.forEach(r => { if (r) results.push(r); });
    }

    let m3uLines = ['#EXTM3U\n'];
    results.forEach(res => {
        m3uLines.push(`#EXTINF:-1 tvg-id="${res.id}" tvg-name="${res.name}" tvg-logo="${res.logo}" group-title="TimStreams Sports",${res.name}\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=https://timstreams.st/\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${res.m3u8Url}\n`);
    });

    const playlistContent = m3uLines.join('');
    fs.writeFileSync('playlist.m3u', playlistContent, 'utf-8');
    fs.writeFileSync('sports.m3u', playlistContent, 'utf-8');

    console.log(`[✓] Successfully updated sports.m3u with ${results.length} active streams!`);
}

extractTimStreamsPlaylist();
```

---

## 🛠️ Step 3: Direct M3U Live Stream Links

If you want to use the direct raw playlist links on your website or video player:

* ⚽ **TimStreams Sports (155 Channels):**  
  `https://raw.githubusercontent.com/hariqwert/sports-m3u/main/sports.m3u`

* 🎬 **DaddyLive Verified (51 Channels):**  
  `https://raw.githubusercontent.com/hariqwert/dlhd-m3u/main/dlhd_working.m3u`
