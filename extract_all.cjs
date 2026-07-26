const https = require('https');
const fs = require('fs');

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function generateM3U() {
    console.log("[*] Fetching channel list from API...");
    const response = await fetchJson('https://api.vixnuvew.uk/api/channels');
    
    if (!response || !response.channels) {
        console.error("[!] Failed to fetch channel list.");
        return;
    }

    const { channels, genres } = response;
    console.log(`[+] Total channels found: ${channels.length}`);

    let m3uLines = ['#EXTM3U\n'];
    let count = 0;

    for (const ch of channels) {
        const name = ch.name || ch.url;
        const logo = ch.logo || '';
        const genreName = genres[ch.genre] || 'Live TV';

        // Check embedded streams in channel object
        if (ch.streams && Array.isArray(ch.streams) && ch.streams.length > 0) {
            for (let i = 0; i < ch.streams.length; i++) {
                const st = ch.streams[i];
                const streamUrl = typeof st === 'string' ? st : st.url || st.stream || st.link;
                if (streamUrl) {
                    count++;
                    const suffix = ch.streams.length > 1 ? ` (Server ${i+1})` : '';
                    m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}${suffix}\n`);
                    m3uLines.push(`${streamUrl}\n`);
                }
            }
        } else if (ch.url) {
            // Fetch watch endpoint for stream links
            const watchData = await fetchJson(`https://api.vixnuvew.uk/api/watch/${ch.url}`);
            if (watchData && watchData.streams && Array.isArray(watchData.streams)) {
                for (let i = 0; i < watchData.streams.length; i++) {
                    const st = watchData.streams[i];
                    const streamUrl = typeof st === 'string' ? st : st.url || st.stream || st.link;
                    if (streamUrl) {
                        count++;
                        const suffix = watchData.streams.length > 1 ? ` (Server ${i+1})` : '';
                        m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}${suffix}\n`);
                        m3uLines.push(`${streamUrl}\n`);
                    }
                }
            }
        }
    }

    const m3uContent = m3uLines.join('');
    fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
    console.log(`[✓] Generated playlist.m3u with ${count} stream links across ${channels.length} channels.`);
}

generateM3U();
