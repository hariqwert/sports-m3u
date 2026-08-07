const https = require('https');
const fs = require('fs');

function fetchPage(urlStr) {
    return new Promise((resolve) => {
        const u = new URL(urlStr);
        https.get({
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dlhd.st/'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(''));
    });
}

async function buildChannelsJson() {
    console.log("[*] Fetching all 900 DaddyLive channels for channels.json...");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');
    
    const matches = [...html.matchAll(/<a[^>]+href=["'](?:https?:\/\/dlhd\.st)?\/watch\.php\?id=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    console.log(`[+] Discovered ${matches.length} channel elements.`);

    const channelsMap = new Map();
    for (const m of matches) {
        const id = m[1];
        const rawText = m[2].replace(/<[^>]+>/g, ' ').trim().replace(/\s+/g, ' ');
        // Clean out trailing "ID: 123" if present
        const name = rawText.replace(/\s*ID:\s*\d+/i, '').trim() || `Channel ${id}`;

        if (!channelsMap.has(id)) {
            channelsMap.set(id, {
                id: id,
                name: name,
                category: categorizeChannel(name),
                watchUrl: `https://dlhd.st/watch.php?id=${id}`,
                streamPhpUrl: `https://dlhd.st/stream/stream-${id}.php`,
                playerIframeUrl: `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${id}`,
                resolverEndpoint: `/api/resolve_stream/${id}`
            });
        }
    }

    const channelsList = Array.from(channelsMap.values());
    console.log(`[+] Built channels catalog array with ${channelsList.length} channels.`);

    const targetPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels.json';
    fs.writeFileSync(targetPath, JSON.stringify(channelsList, null, 2), 'utf-8');
    console.log(`[✓] Successfully saved ${channelsList.length} channels to ${targetPath}`);
}

function categorizeChannel(name) {
    const lower = name.toLowerCase();
    if (lower.includes('sport') || lower.includes('cricket') || lower.includes('bein') || lower.includes('espn') || lower.includes('tnt') || lower.includes('dazn') || lower.includes('arena') || lower.includes('willow') || lower.includes('racing') || lower.includes('ufc') || lower.includes('nba') || lower.includes('nfl') || lower.includes('nhl') || lower.includes('mlb') || lower.includes('golf') || lower.includes('tennis')) {
        return 'Sports';
    }
    if (lower.includes('movie') || lower.includes('hbo') || lower.includes('starz') || lower.includes('amc') || lower.includes('fx') || lower.includes('cinema') || lower.includes('showtime') || lower.includes('axn')) {
        return 'Movies & Cinema';
    }
    if (lower.includes('cartoon') || lower.includes('disney') || lower.includes('nick') || lower.includes('boomerang') || lower.includes('cbeebies') || lower.includes('anim')) {
        return 'Cartoons & Kids';
    }
    if (lower.includes('news') || lower.includes('cnn') || lower.includes('bbc') || lower.includes('weather') || lower.includes('aaj tak') || lower.includes('abp')) {
        return 'News';
    }
    return 'General Entertainment';
}

buildChannelsJson();
