const https = require('https');

/**
 * Directly fetches and decodes the .m3u8 stream URL from an embed page ID/URL
 * Example IDs: 'boomerang-usa', 'fox-sports-506', 'espn-usa', 'skysportsf1-uk'
 */
function getDirectM3u8(channelId) {
    return new Promise((resolve) => {
        // Clean channel ID in case full URL was passed
        const cleanId = channelId.replace(/.*\/embed\//, '').replace(/^\/+|\/+$/g, '');
        const targetUrl = `https://logic.icelanders.st/embed/${cleanId}`;

        const options = {
            hostname: 'logic.icelanders.st',
            path: `/embed/${cleanId}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://timstreams.st/'
            }
        };

        https.get(options, (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                // Decode obfuscated XOR array variable in iframe script
                let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
                if (!match) {
                    match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
                }

                if (match) {
                    const arr = match[2].split(',').map(Number);
                    const arg1 = parseInt(match[4]);
                    const arg2 = parseInt(match[6]);

                    let decoded = '';
                    for (let i = 0; i < arr.length; i++) {
                        decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
                    }

                    const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
                    if (m3u8Match) return resolve({ success: true, channelId: cleanId, streamUrl: m3u8Match[0] });
                }

                const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
                if (directMatch) {
                    return resolve({ success: true, channelId: cleanId, streamUrl: directMatch[0] });
                }

                resolve({ success: false, channelId: cleanId, error: 'Could not decode .m3u8 stream from page' });
            });
        }).on('error', (err) => resolve({ success: false, channelId: cleanId, error: err.message }));
    });
}

// CLI Execution Support
async function main() {
    const args = process.argv.slice(2);
    const channelsToFetch = args.length > 0 ? args : ['boomerang-usa', 'fox-sports-506', 'espn-usa', 'skysportsf1-uk'];

    console.log(`[*] Fetching direct .m3u8 streams for: ${channelsToFetch.join(', ')}\n`);

    let m3uLines = ['#EXTM3U\n'];

    for (const chId of channelsToFetch) {
        const res = await getDirectM3u8(chId);
        const name = chId.split('-').map(w => w.toUpperCase()).join(' ');
        if (res.success) {
            console.log(`[✓] ${chId}:`);
            console.log(`    Stream URL: ${res.streamUrl}\n`);
            m3uLines.push(`#EXTINF:-1 tvg-name="${chId}" group-title="Direct Streams",${name}\n`);
            m3uLines.push(`${res.streamUrl}\n`);
        } else {
            console.log(`[!] ${chId}: ${res.error}\n`);
        }
    }

    console.log("--- M3U Output ---");
    console.log(m3uLines.join(''));
}

if (require.main === module) {
    main();
}

module.exports = { getDirectM3u8 };
