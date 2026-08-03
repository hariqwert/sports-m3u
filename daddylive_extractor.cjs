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
            client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

function extractDlhdStream(html) {
    if (!html) return null;
    const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
    if (match) {
        try {
            return Buffer.from(match[1], 'base64').toString('utf-8');
        } catch(e) {}
    }
    return null;
}

async function extractDlhdChannel(channelId) {
    const cleanId = channelId.replace(/[^0-9]/g, '');
    const streamPhpUrl = `https://dlhd.st/stream/stream-${cleanId}.php`;
    const streamPhpContent = await fetchPage(streamPhpUrl, 'https://dlhd.st/');

    const iframeMatch = streamPhpContent.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return null;

    const playerIframeUrl = iframeMatch[1];
    const playerHtml = await fetchPage(playerIframeUrl, streamPhpUrl);
    const m3u8Url = extractDlhdStream(playerHtml);

    return {
        id: cleanId,
        streamPhpUrl,
        playerIframeUrl,
        m3u8Url
    };
}

async function run() {
    console.log("[*] Fetching DaddyLive 24/7 channels catalog...");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');

    // Matches pattern: <a href="https://dlhd.st/watch.php?id=51">ABC USA</a> or markdown style
    const linkMatches = [...html.matchAll(/href=["'](?:https?:\/\/dlhd\.st)?\/watch\.php\?id=(\d+)["'][^>]*>([^<]+)/gi)];
    
    const channelsMap = new Map();
    for (const m of linkMatches) {
        const id = m[1];
        let name = m[2].trim().replace(/\s+/g, ' ');
        if (!channelsMap.has(id)) {
            channelsMap.set(id, { id, name });
        }
    }

    const channelsList = Array.from(channelsMap.values());
    console.log(`[+] Discovered ${channelsList.length} channels from DaddyLive (dlhd.st).`);

    let m3uLines = ['#EXTM3U\n'];
    let count = 0;

    // Process first 15 channels as a fast demonstration run
    const sampleChannels = channelsList.slice(0, 15);
    console.log(`[*] Resolving direct .m3u8 stream links for sample channels...`);

    for (let i = 0; i < sampleChannels.length; i++) {
        const ch = sampleChannels[i];
        console.log(`[${i+1}/${sampleChannels.length}] Resolving DaddyLive ID ${ch.id}: ${ch.name}...`);
        const res = await extractDlhdChannel(ch.id);

        if (res && res.m3u8Url) {
            count++;
            console.log(`   -> ${res.m3u8Url}`);
            m3uLines.push(`#EXTINF:-1 tvg-name="${ch.name}" group-title="DaddyLive",${ch.name}\n`);
            m3uLines.push(`${res.m3u8Url}\n`);
        } else {
            console.log(`   [!] Could not resolve stream for ID ${ch.id}`);
        }
    }

    fs.writeFileSync('daddylive_sample.m3u', m3uLines.join(''), 'utf-8');
    console.log(`\n[✓] Finished extraction! Saved ${count} DaddyLive stream links to 'daddylive_sample.m3u'.`);
}

if (require.main === module) {
    run();
}

module.exports = { extractDlhdChannel };
