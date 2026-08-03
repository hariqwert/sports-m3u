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

async function extractChannel(id) {
    const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${id}`;
    const streamPhpUrl = `https://dlhd.st/stream/stream-${id}.php`;
    const playerHtml = await fetchPage(playerIframeUrl, streamPhpUrl);
    const m3u8Url = decodeDaddyLiveBase64(playerHtml);
    return { id, m3u8Url, playerIframeUrl };
}

async function main() {
    console.log("[*] Fetching 24/7 channel catalog from dlhd.st...");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');

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
    console.log(`[+] Found ${channelsList.length} channels from dlhd.st.`);

    // Target top popular sports & TV channels on dlhd.st
    const targetIds = [
        "51",   // ABC USA
        "61",   // beIN Sports MENA English 1
        "62",   // beIN SPORTS 1 Turkey
        "90",   // beIN Sports MENA English 2
        "91",   // beIN Sports 1 Arabic
        "100",  // beIN SPORTS XTRA 1
        "116",  // beIN SPORTS 1 France
        "123",  // Astro SuperSport 1
        "124",  // Astro SuperSport 2
        "134",  // Arena Sport 1 Premium
        "206",  // AHC USA
        "269",  // A Sport PK
        "283",  // Antenna TV USA
        "302",  // A&E USA
        "303",  // AMC USA
        "304",  // Animal Planet
        "370",  // Astro Cricket
        "425",  // BeIN SPORTS USA
        "429",  // Arena Sport 1 Serbia
        "432",  // Arena Sport 1 Croatia
        "578",  // BeIN Sports HD Qatar
        "600",  // Abu Dhabi Sports 1 UAE
        "664",  // ACC Network USA
        "742"   // AXS TV USA
    ];

    console.log(`[*] Resolving direct .m3u8 streams for ${targetIds.length} top channels...`);

    let m3uLines = ['#EXTM3U\n'];
    let count = 0;

    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const info = channelsMap.get(id) || { id, name: `Channel ${id}` };
        console.log(`[${i+1}/${targetIds.length}] Resolving ID ${id}: ${info.name}...`);
        
        const res = await extractChannel(id);
        if (res.m3u8Url) {
            count++;
            console.log(`   -> Stream: ${res.m3u8Url}`);
            m3uLines.push(`#EXTINF:-1 tvg-name="${info.name}" group-title="DaddyLive (DLHD)",${info.name}\n`);
            m3uLines.push(`#EXTVLCOPT:http-referrer=${res.playerIframeUrl}\n`);
            m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
            m3uLines.push(`${res.m3u8Url}\n`);
        } else {
            console.log(`   [!] Could not resolve ID ${id}`);
        }
    }

    const playlist = m3uLines.join('');
    fs.writeFileSync('dlhd.m3u', playlist, 'utf-8');
    console.log(`\n[✓] Successfully generated dlhd.m3u playlist with ${count} stream links!`);
}

main();
