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
                    'Referer': referer || 'https://dlhd.st/'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            const req = client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                    if (data.length > 60000) req.destroy();
                });
                res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', () => resolve({ status: 500, data: '' }));
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
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': referer,
                    'Origin': new URL(referer).origin
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            const req = client.get(options, (res) => {
                let snippet = '';
                res.on('data', chunk => {
                    snippet += chunk.toString();
                    if (snippet.length > 1000) req.destroy();
                });
                res.on('end', () => {
                    const isHls = snippet.includes('#EXTM3U') || snippet.includes('#EXT-X-STREAM-INF') || snippet.includes('#EXTINF') || snippet.includes('.ts');
                    resolve({ working: res.statusCode === 200 && isHls, statusCode: res.statusCode });
                });
            });
            req.on('error', () => resolve({ working: false, statusCode: 500 }));
        } catch(e) {
            resolve({ working: false, statusCode: 500 });
        }
    });
}

async function testExhaustive(ch) {
    const id = ch.id;
    const urlsToTry = [
        `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${id}`,
        `https://hamis.romponalis.st/premiumtv/daddy.php?id=${id}`,
        `https://dlhd.st/stream/stream-${id}.php`
    ];

    for (const pUrl of urlsToTry) {
        const pageRes = await fetchPage(pUrl, `https://dlhd.st/stream/stream-${id}.php`);
        if (pageRes.status === 200 && pageRes.data) {
            const m3u8Url = decodeDaddyLiveBase64(pageRes.data);
            if (m3u8Url) {
                const probe = await probeM3u8Stream(m3u8Url, pUrl);
                if (probe.working) {
                    return { id, name: ch.name, category: ch.category, working: true, m3u8Url, statusCode: probe.statusCode };
                }
            }
        }
    }

    return { id, name: ch.name, category: ch.category, working: false };
}

async function runExhaustiveScan() {
    console.log("=========================================================================");
    console.log("     DADDYLIVE (DLHD.ST) EXHAUSTIVE MULTI-PASS VERIFICATION SWEEP        ");
    console.log("=========================================================================\n");

    const jsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels.json';
    const channels = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`[*] Auditing all ${channels.length} channels using multi-pass player fallback...`);
    
    const workingMap = new Map();
    const BATCH_SIZE = 25;

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(ch => testExhaustive(ch)));

        batchResults.forEach(res => {
            if (res.working) {
                workingMap.set(res.id, res);
            }
        });

        const done = Math.min(i + BATCH_SIZE, channels.length);
        console.log(`[Progress ${done}/${channels.length}] Confirmed Working Channels So Far: ${workingMap.size}`);
    }

    const workingList = Array.from(workingMap.values());
    console.log("\n=========================================================================");
    console.log(` EXHAUSTIVE VERIFICATION RESULT: ${workingList.length} TOTAL WORKING CHANNELS`);
    console.log("=========================================================================\n");

    let m3uLines = ['#EXTM3U\n'];
    workingList.forEach(ch => {
        const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${ch.id}`;
        m3uLines.push(`#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" group-title="${ch.category || 'DaddyLive'}",${ch.name}\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=${playerIframeUrl}\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${ch.m3u8Url}\n`);
    });

    const playlistStr = m3uLines.join('');
    
    fs.writeFileSync('C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\dlhd_working.m3u', playlistStr, 'utf-8');
    fs.writeFileSync('C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels_working.json', JSON.stringify(workingList, null, 2), 'utf-8');

    console.log(`[✓] Updated 'dlhd_working.m3u' and 'channels_working.json' with ${workingList.length} total working channels.`);
}

runExhaustiveScan();
