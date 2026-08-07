const http = require('http');
const https = require('https');
const urlModule = require('url');

const PORT = 8088;

function fetchDlhdM3u8(id) {
    return new Promise((resolve) => {
        const playerUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${id}`;
        const streamPhpUrl = `https://dlhd.st/stream/stream-${id}.php`;
        
        const u = new URL(playerUrl);
        const options = {
            hostname: u.hostname,
            port: 443,
            path: u.pathname + u.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': streamPhpUrl
            }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
                if (match) {
                    try {
                        const m3u8Url = Buffer.from(match[1], 'base64').toString('utf-8');
                        resolve({ m3u8Url, playerUrl });
                    } catch(e) { resolve(null); }
                } else resolve(null);
            });
        }).on('error', () => resolve(null));
    });
}

function proxyStream(targetUrl, referer, req, res) {
    try {
        const target = new URL(targetUrl);
        const options = {
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

        const client = (target.protocol === 'https:' ? https : http).request(options, (remoteRes) => {
            if (remoteRes.headers['content-type'] && (remoteRes.headers['content-type'].includes('mpegurl') || remoteRes.headers['content-type'].includes('text/plain') || targetUrl.endsWith('.m3u8'))) {
                let body = '';
                remoteRes.on('data', chunk => body += chunk.toString());
                remoteRes.on('end', () => {
                    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                    const lines = body.split('\n').map(line => {
                        line = line.trim();
                        if (line && !line.startsWith('#')) {
                            const fullSegmentUrl = line.startsWith('http') ? line : baseUrl + line;
                            return `http://localhost:${PORT}/proxy?url=` + encodeURIComponent(fullSegmentUrl) + `&ref=` + encodeURIComponent(referer);
                        }
                        return line;
                    });
                    const modifiedBody = lines.join('\n');
                    res.writeHead(remoteRes.statusCode, {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(modifiedBody);
                });
            } else {
                res.writeHead(remoteRes.statusCode, remoteRes.headers);
                remoteRes.pipe(res);
            }
        });
        client.on('error', () => {
            res.writeHead(502);
            res.end('Proxy Error');
        });
        req.pipe(client);
    } catch(e) {
        res.writeHead(400);
        res.end('Invalid URL');
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = urlModule.parse(req.url, true);
    const pathName = parsedUrl.pathname;
    const query = parsedUrl.query;

    if (pathName === '/play.m3u8') {
        const id = query.id || '51';
        console.log(`[*] Resolving live stream for channel ID: ${id}...`);
        const info = await fetchDlhdM3u8(id);
        if (info && info.m3u8Url) {
            console.log(`[✓] Stream resolved: ${info.m3u8Url}`);
            proxyStream(info.m3u8Url, info.playerUrl, req, res);
        } else {
            res.writeHead(500);
            res.end('Failed to resolve stream');
        }
    } else if (pathName === '/proxy') {
        if (query.url && query.ref) {
            proxyStream(query.url, query.ref, req, res);
        } else {
            res.writeHead(400);
            res.end('Missing proxy parameters');
        }
    } else if (pathName === '/vlc.m3u') {
        const id = query.id || '51';
        const playlist = `#EXTM3U\n#EXTINF:-1, Live Stream (${id})\nhttp://localhost:${PORT}/play.m3u8?id=${id}\n`;
        res.writeHead(200, { 'Content-Type': 'application/x-mpegurl' });
        res.end(playlist);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[✓] VLC Bridge Server running on http://localhost:${PORT}`);
    console.log(`[✓] Test in VLC by opening: http://localhost:${PORT}/play.m3u8?id=51`);
});
