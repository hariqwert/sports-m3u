const https = require('https');
const fs = require('fs');

const INTERVAL_MINUTES = 45;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const OUTPUT_FILE = 'sports.m3u';

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
    
    // Pattern 1: Comma-separated
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);

    // Pattern 2: Semicolon-separated
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
        if (m3u8Match) {
            return m3u8Match[0];
        }
    }

    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

async function updateSportsM3u() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting scheduled update for ${OUTPUT_FILE}...`);
    
    const rawChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    let apiData;
    try {
        apiData = JSON.parse(rawChannels);
    } catch(e) {
        console.error(`[!] [${timestamp}] Failed to parse API response.`);
        return;
    }

    const { channels, genres } = apiData;
    let m3uLines = ['#EXTM3U\n'];
    let resolvedCount = 0;

    for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        const name = ch.name || ch.url;
        const logo = ch.logo || '';
        const genreName = genres[ch.genre] || 'Sports';
        
        let embedUrl = (ch.streams && ch.streams[0] && (ch.streams[0].url || ch.streams[0])) || `https://logic.icelanders.st/embed/${ch.url}`;
        const embedHtml = await fetchUrl(embedUrl);
        const m3u8StreamUrl = decodeStreamUrl(embedHtml) || embedUrl;

        if (m3u8StreamUrl && m3u8StreamUrl.includes('.m3u8')) {
            resolvedCount++;
        }

        m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
        m3uLines.push(`${m3u8StreamUrl}\n`);
    }

    const content = m3uLines.join('');
    fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
    fs.writeFileSync('playlist.m3u', content, 'utf-8');

    console.log(`[✓] [${new Date().toISOString()}] Successfully updated ${OUTPUT_FILE} with ${channels.length} channels (${resolvedCount} direct streams). Next update in ${INTERVAL_MINUTES} minutes.`);
}

// Perform initial update immediately
updateSportsM3u();

// Schedule recurring updates every 45 minutes
setInterval(updateSportsM3u, INTERVAL_MS);
