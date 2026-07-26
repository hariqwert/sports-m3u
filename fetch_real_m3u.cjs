const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const options = {
                hostname: u.hostname,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://timstreams.st/'
                }
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

function decodeStreamUrl(html) {
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
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

async function run() {
    console.log("[*] Starting extraction for Live Sports Events & TV Channels...");
    let m3uLines = ['#EXTM3U\n'];
    let totalStreamsCount = 0;

    // 1. LIVE & UPCOMING SPORTS EVENTS
    console.log("[*] Fetching Live & Upcoming Sports Events...");
    const rawEvents = await fetchUrl('https://api.vixnuvew.uk/api/live-upcoming');
    try {
        const eventsData = JSON.parse(rawEvents);
        const events = eventsData.events || [];
        console.log(`[+] Processing ${events.length} Sports Events...`);

        for (const ev of events) {
            const evName = ev.name || ev.url;
            const evLogo = ev.logo || '';
            const eventStreams = ev.streams || [];

            for (let sIdx = 0; sIdx < eventStreams.length; sIdx++) {
                const st = eventStreams[sIdx];
                const stName = st.name ? `${evName} (${st.name})` : evName;
                const embedUrl = st.url || `https://logic.icelanders.st/embed/${ev.url}`;

                let streamUrl = embedUrl;
                if (embedUrl.includes('icelanders.st/embed/')) {
                    const html = await fetchUrl(embedUrl);
                    streamUrl = decodeStreamUrl(html) || embedUrl;
                }

                totalStreamsCount++;
                m3uLines.push(`#EXTINF:-1 tvg-name="${stName}" tvg-logo="${evLogo}" group-title="Live Sports Events",${stName}\n`);
                m3uLines.push(`${streamUrl}\n`);
            }
        }
    } catch(e) {
        console.error("[!] Failed to process live sports events:", e.message);
    }

    // 2. LIVE TV CHANNELS
    console.log("[*] Fetching Live TV Channels...");
    const rawChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    try {
        const apiData = JSON.parse(rawChannels);
        const channels = apiData.channels || [];
        const genres = apiData.genres || {};
        console.log(`[+] Processing ${channels.length} TV Channels...`);

        for (let i = 0; i < channels.length; i++) {
            const ch = channels[i];
            const name = ch.name || ch.url;
            const logo = ch.logo || '';
            const genreName = genres[ch.genre] || 'Sports Channels';
            
            let embedUrl = (ch.streams && ch.streams[0] && (ch.streams[0].url || ch.streams[0])) || `https://logic.icelanders.st/embed/${ch.url}`;
            const embedHtml = await fetchUrl(embedUrl);
            const m3u8StreamUrl = decodeStreamUrl(embedHtml) || embedUrl;

            totalStreamsCount++;
            m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
            m3uLines.push(`${m3u8StreamUrl}\n`);
        }
    } catch(e) {
        console.error("[!] Failed to process channels:", e.message);
    }

    const playlist = m3uLines.join('');
    fs.writeFileSync('sports.m3u', playlist, 'utf-8');
    fs.writeFileSync('playlist.m3u', playlist, 'utf-8');

    console.log(`\n[✓] Successfully generated sports.m3u with ${totalStreamsCount} total stream items!`);
}

run();
