const https = require('https');
const http = require('http');
const fs = require('fs');

/**
 * Fetch helper with standard User-Agent and Referer
 */
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

/**
 * Decode Base64 Clappr source from DaddyLive player HTML
 */
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

/**
 * Probe an M3U8 stream URL with the required Referer header
 */
function probeM3u8Stream(m3u8Url, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(m3u8Url);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
                        statusCode: res.statusCode,
                        isHls: isHls
                    });
                });
            });
            req.on('error', () => resolve({ working: false, statusCode: 500, isHls: false }));
        } catch(e) {
            resolve({ working: false, statusCode: 500, isHls: false });
        }
    });
}

/**
 * Test a single DaddyLive channel ID
 */
async function testDlhdChannel(ch) {
    const playerUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${ch.id}`;
    const streamPhpUrl = `https://dlhd.st/stream/stream-${ch.id}.php`;
    
    const pageRes = await fetchPage(playerUrl, streamPhpUrl);
    if (pageRes.status !== 200 || !pageRes.data) {
        return { ...ch, working: false, reason: `Player Page Error (HTTP ${pageRes.status})` };
    }

    const m3u8Url = decodeDaddyLiveBase64(pageRes.data);
    if (!m3u8Url) {
        return { ...ch, working: false, reason: 'Failed to decode Base64 stream URL' };
    }

    const probe = await probeM3u8Stream(m3u8Url, playerUrl);
    if (probe.working) {
        return { ...ch, working: true, m3u8Url, statusCode: probe.statusCode };
    } else {
        return { ...ch, working: false, reason: `M3U8 Stream HTTP ${probe.statusCode}` };
    }
}

async function runDiagnostic() {
    console.log("=========================================================================");
    console.log("       DADDYLIVE (DLHD.ST) COMPREHENSIVE CHANNEL HEALTH DIAGNOSTIC       ");
    console.log("=========================================================================\n");

    const channelsJsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels.json';
    if (!fs.existsSync(channelsJsonPath)) {
        console.error("channels.json not found!");
        return;
    }

    const allChannels = JSON.parse(fs.readFileSync(channelsJsonPath, 'utf-8'));
    console.log(`[*] Loaded ${allChannels.length} total channels from channels.json.`);

    // Perform verification on a representative 100-channel sample across all categories
    const sampleSize = 100;
    const step = Math.floor(allChannels.length / sampleSize);
    const testSample = [];
    for (let i = 0; i < allChannels.length; i += step) {
        testSample.push(allChannels[i]);
        if (testSample.length >= sampleSize) break;
    }

    console.log(`[*] Starting deep verification on ${testSample.length} channels...\n`);

    const results = [];
    let workingCount = 0;
    let offlineCount = 0;

    // Concurrent batch processing (10 at a time)
    const BATCH_SIZE = 10;
    for (let i = 0; i < testSample.length; i += BATCH_SIZE) {
        const batch = testSample.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(ch => testDlhdChannel(ch)));
        
        batchResults.forEach(res => {
            results.push(res);
            if (res.working) {
                workingCount++;
                console.log(`[✓ WORKING] ID ${res.id.padEnd(5)} | ${res.name.padEnd(35)} | HTTP ${res.statusCode}`);
            } else {
                offlineCount++;
                console.log(`[✗ OFFLINE] ID ${res.id.padEnd(5)} | ${res.name.padEnd(35)} | Reason: ${res.reason}`);
            }
        });
    }

    const successPercentage = ((workingCount / testSample.length) * 100).toFixed(1);

    console.log("\n=========================================================================");
    console.log("                       DIAGNOSTIC TEST SUMMARY REPORT                    ");
    console.log("=========================================================================");
    console.log(` Total Channels Tested:   ${testSample.length}`);
    console.log(` 🟢 WORKING Channels:     ${workingCount} (${successPercentage}%)`);
    console.log(` 🔴 OFFLINE / ERRORS:     ${offlineCount} (${(100 - successPercentage).toFixed(1)}%)`);
    console.log("=========================================================================");

    // Save diagnostic report
    const reportData = {
        timestamp: new Date().toISOString(),
        testedCount: testSample.length,
        workingCount,
        offlineCount,
        successPercentage: parseFloat(successPercentage),
        results
    };

    fs.writeFileSync('C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channel_health_report.json', JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`[✓] Full detailed health report saved to 'dlhd-m3u/channel_health_report.json'.\n`);
}

runDiagnostic();
