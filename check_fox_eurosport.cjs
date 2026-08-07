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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': referer || 'https://dlhd.st/'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            client.get(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
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

function probeM3u8Stream(m3u8Url, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(m3u8Url);
            const options = {
                hostname: u.hostname,
                port: 443,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': referer,
                    'Origin': new URL(referer).origin
                }
            };
            https.get(options, (res) => {
                let snippet = '';
                res.on('data', chunk => snippet += chunk.toString());
                res.on('end', () => {
                    const isHls = snippet.includes('#EXTM3U') || snippet.includes('#EXTINF') || snippet.includes('.ts');
                    resolve({ working: res.statusCode === 200 && isHls, statusCode: res.statusCode });
                });
            }).on('error', () => resolve({ working: false, statusCode: 500 }));
        } catch(e) {
            resolve({ working: false, statusCode: 500 });
        }
    });
}

async function checkTargetChannels() {
    console.log("[*] Searching for Fox Weather and Eurosport channels across DaddyLive...\n");

    const jsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels.json';
    const channels = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    const targets = channels.filter(ch => {
        const lower = ch.name.toLowerCase();
        return lower.includes('fox weather') || lower.includes('eurosport') || lower.includes('euro sport');
    });

    console.log(`Found ${targets.length} matching channels in DaddyLive catalog:\n`);

    for (const ch of targets) {
        console.log(`Testing [ID ${ch.id}] ${ch.name}...`);
        const playerUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${ch.id}`;
        const pageRes = await fetchPage(playerUrl, `https://dlhd.st/stream/stream-${ch.id}.php`);
        const m3u8Url = decodeDaddyLiveBase64(pageRes.data);

        if (m3u8Url) {
            const probe = await probeM3u8Stream(m3u8Url, playerUrl);
            if (probe.working) {
                console.log(`   🟢 [WORKING] Stream URL: ${m3u8Url}`);
                console.log(`   VLC Proxy URL: http://localhost:8088/play.m3u8?id=${ch.id}\n`);
            } else {
                console.log(`   🔴 [OFFLINE] Stream HTTP ${probe.statusCode}\n`);
            }
        } else {
            console.log(`   🔴 [OFFLINE] Could not decode stream URL\n`);
        }
    }
}

checkTargetChannels();
