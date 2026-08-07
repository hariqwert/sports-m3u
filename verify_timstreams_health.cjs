const https = require('https');
const http = require('http');
const fs = require('fs');

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
                    'Referer': referer || 'https://timstreams.st/'
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

function decodeTimStreamsXor(html) {
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
    return null;
}

function probeM3u8Stream(m3u8Url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(m3u8Url);
            const options = {
                hostname: u.hostname,
                port: 443,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://timstreams.st/',
                    'Origin': 'https://timstreams.st'
                }
            };
            https.get(options, (res) => {
                let snippet = '';
                res.on('data', chunk => snippet += chunk.toString());
                res.on('end', () => {
                    const isHls = snippet.includes('#EXTM3U') || snippet.includes('#EXTINF') || snippet.includes('.m3u8');
                    resolve({ working: res.statusCode === 200 && isHls, statusCode: res.statusCode });
                });
            }).on('error', () => resolve({ working: false, statusCode: 500 }));
        } catch(e) {
            resolve({ working: false, statusCode: 500 });
        }
    });
}

async function testTimStreams() {
    console.log("=========================================================================");
    console.log("       TIMSTREAMS (TIMSTREAMS.ST) CHANNEL HEALTH DIAGNOSTIC              ");
    console.log("=========================================================================\n");

    const channelsJsonPath = 'channels.json';
    const channels = JSON.parse(fs.readFileSync(channelsJsonPath, 'utf-8'));
    const list = Array.isArray(channels) ? channels : (channels.channels || []);

    console.log(`[*] Testing all ${list.length} TimStreams channels...`);

    let workingCount = 0;
    let offlineCount = 0;

    for (let i = 0; i < list.length; i++) {
        const ch = list[i];
        const slug = ch.channel_id || ch.url || ch.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const embedUrl = `https://logic.icelanders.st/embed/${slug}`;
        
        const pageRes = await fetchPage(embedUrl, 'https://timstreams.st/');
        const m3u8Url = decodeTimStreamsXor(pageRes.data);

        if (m3u8Url) {
            const probe = await probeM3u8Stream(m3u8Url);
            if (probe.working) {
                workingCount++;
                console.log(`[✓ WORKING] ${ch.name.padEnd(35)} | HTTP 200 | ${m3u8Url.slice(0, 55)}...`);
            } else {
                offlineCount++;
                console.log(`[✗ OFFLINE] ${ch.name.padEnd(35)} | Stream HTTP ${probe.statusCode}`);
            }
        } else {
            offlineCount++;
            console.log(`[✗ OFFLINE] ${ch.name.padEnd(35)} | XOR Decode Failed / Empty`);
        }
    }

    const pct = ((workingCount / list.length) * 100).toFixed(1);
    console.log("\n=========================================================================");
    console.log(` TimStreams Total:  ${list.length}`);
    console.log(` 🟢 WORKING:        ${workingCount} (${pct}%)`);
    console.log(` 🔴 OFFLINE:        ${offlineCount} (${(100 - pct).toFixed(1)}%)`);
    console.log("=========================================================================");
}

testTimStreams();
