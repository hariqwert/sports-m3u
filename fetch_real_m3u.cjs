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
            console.log(`[+] Fetched ${channels.length} channels dynamically from timstreams.st API.`);
        } catch(e) {}
    }

    if (channels.length === 0) {
        console.log("[!] API fallback to local channels.json...");
        channels = JSON.parse(fs.readFileSync('channels.json', 'utf-8'));
    }

    console.log(`[*] Extracting streams for ${channels.length} channels in parallel batches...`);

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

    console.log(`[✓] Successfully generated sports.m3u & playlist.m3u with ${results.length} working streams!`);
}

extractTimStreamsPlaylist();
