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
    
    // Pattern 1: Comma-separated (var _af1=[...],_gb3=119,_va7=165)
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);

    // Pattern 2: Semicolon-separated (var _mt4=[...];_ad1=134;_ro0=198;)
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

    // Direct fallback if un-obfuscated m3u8 exists
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

async function run() {
    console.log("[*] Fetching channel directory from API...");
    const rawChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    let apiData;
    try {
        apiData = JSON.parse(rawChannels);
    } catch(e) {
        console.error("[!] Failed to parse API channels.");
        return;
    }

    const { channels, genres } = apiData;
    console.log(`[+] Found ${channels.length} channels. Extracting direct .m3u8 stream links...`);

    let m3uLines = ['#EXTM3U\n'];
    let jsonResult = [];
    let resolvedCount = 0;

    for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        const name = ch.name || ch.url;
        const logo = ch.logo || '';
        const genreName = genres[ch.genre] || 'Live TV';
        
        let embedUrl = null;
        if (ch.streams && Array.isArray(ch.streams) && ch.streams.length > 0) {
            embedUrl = ch.streams[0].url || ch.streams[0];
        }
        if (!embedUrl) {
            embedUrl = `https://logic.icelanders.st/embed/${ch.url}`;
        }

        const embedHtml = await fetchUrl(embedUrl);
        const m3u8StreamUrl = decodeStreamUrl(embedHtml);

        if (m3u8StreamUrl) {
            resolvedCount++;
            console.log(`[${i+1}/${channels.length}] ${name} -> ${m3u8StreamUrl}`);
            m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
            m3uLines.push(`${m3u8StreamUrl}\n`);
            jsonResult.push({
                name,
                logo,
                genre: genreName,
                channel_id: ch.url,
                stream_url: m3u8StreamUrl
            });
        } else {
            console.log(`[${i+1}/${channels.length}] ${name} -> [Fallback Embed] ${embedUrl}`);
            m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
            m3uLines.push(`${embedUrl}\n`);
            jsonResult.push({
                name,
                logo,
                genre: genreName,
                channel_id: ch.url,
                stream_url: embedUrl
            });
        }
    }

    fs.writeFileSync('playlist.m3u', m3uLines.join(''), 'utf-8');
    fs.writeFileSync('channels.json', JSON.stringify(jsonResult, null, 2), 'utf-8');

    console.log(`\n[✓] Successfully resolved ${resolvedCount}/${channels.length} direct .m3u8 streams!`);
    console.log(`[✓] Output saved to 'playlist.m3u' and 'channels.json'.`);
}

run();
