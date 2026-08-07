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
                    if (data.length > 50000) req.destroy();
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
                    resolve({
                        working: res.statusCode === 200 && isHls,
                        statusCode: res.statusCode
                    });
                });
            });
            req.on('error', () => resolve({ working: false, statusCode: 500 }));
        } catch(e) {
            resolve({ working: false, statusCode: 500 });
        }
    });
}

async function testSingleChannel(ch) {
    const playerUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${ch.id}`;
    const streamPhpUrl = `https://dlhd.st/stream/stream-${ch.id}.php`;
    
    const pageRes = await fetchPage(playerUrl, streamPhpUrl);
    if (pageRes.status !== 200 || !pageRes.data) {
        return { id: ch.id, name: ch.name, category: ch.category, working: false, reason: `Page HTTP ${pageRes.status}` };
    }

    const m3u8Url = decodeDaddyLiveBase64(pageRes.data);
    if (!m3u8Url) {
        return { id: ch.id, name: ch.name, category: ch.category, working: false, reason: 'No Base64 stream source' };
    }

    const probe = await probeM3u8Stream(m3u8Url, playerUrl);
    return {
        id: ch.id,
        name: ch.name,
        category: ch.category,
        working: probe.working,
        statusCode: probe.statusCode,
        m3u8Url: probe.working ? m3u8Url : null
    };
}

async function runFullScan() {
    console.log("=========================================================================");
    console.log("        DADDYLIVE (DLHD.ST) COMPLETE 899-CHANNEL HEALTH DIAGNOSTIC       ");
    console.log("=========================================================================\n");

    const jsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels.json';
    const channels = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`[*] Loaded ${channels.length} channels from dlhd-m3u/channels.json.`);
    console.log(`[*] Starting parallel batch audit (20 concurrent workers)...\n`);

    const workingList = [];
    const offlineList = [];
    const BATCH_SIZE = 20;

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(ch => testSingleChannel(ch)));

        batchResults.forEach(res => {
            if (res.working) {
                workingList.push(res);
            } else {
                offlineList.push(res);
            }
        });

        const done = Math.min(i + BATCH_SIZE, channels.length);
        const currentPct = ((workingList.length / done) * 100).toFixed(1);
        console.log(`[Progress ${done}/${channels.length}] Working: ${workingList.length} (${currentPct}%) | Offline: ${offlineList.length}`);
    }

    console.log("\n=========================================================================");
    console.log("                     FINAL COMPLETE AUDIT REPORT                         ");
    console.log("=========================================================================");
    console.log(` Total Channels Audited:  ${channels.length}`);
    console.log(` 🟢 ONLINE / WORKING:      ${workingList.length} (${((workingList.length/channels.length)*100).toFixed(1)}%)`);
    console.log(` 🔴 OFFLINE / INACTIVE:   ${offlineList.length} (${((offlineList.length/channels.length)*100).toFixed(1)}%)`);
    console.log("=========================================================================\n");

    // Group working channels by category
    const byCategory = {};
    workingList.forEach(ch => {
        const cat = ch.category || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ id: ch.id, name: ch.name });
    });

    console.log("--- WORKING CHANNELS BY CATEGORY ---");
    for (const cat in byCategory) {
        console.log(`\n📁 ${cat} (${byCategory[cat].length} working channels):`);
        byCategory[cat].slice(0, 15).forEach(c => console.log(`   - [ID ${c.id}] ${c.name}`));
        if (byCategory[cat].length > 15) {
            console.log(`   ... and ${byCategory[cat].length - 15} more ${cat} channels`);
        }
    }

    // Write health scan outputs
    const reportData = {
        scanDate: new Date().toISOString(),
        totalChannels: channels.length,
        workingCount: workingList.length,
        offlineCount: offlineList.length,
        workingPercentage: parseFloat(((workingList.length/channels.length)*100).toFixed(1)),
        byCategory,
        workingChannels: workingList,
        offlineChannels: offlineList
    };

    fs.writeFileSync('C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\dlhd_full_audit.json', JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`\n[✓] Audit complete! Full results saved to 'dlhd-m3u/dlhd_full_audit.json'.`);
}

runFullScan();
