const https = require('https');

function fetchApi(path) {
    return new Promise((resolve) => {
        https.get({
            hostname: 'timstreams.st',
            path: path,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://timstreams.st/streams',
                'Accept': 'application/json, text/plain, */*'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', (err) => resolve(''));
    });
}

async function parseChannels() {
    const raw = await fetchApi('/api/channels');
    try {
        const parsed = JSON.parse(raw);
        const channels = parsed.channels || [];
        console.log(`Total TimStreams Channels from API: ${channels.length}\n`);

        const streamUrls = new Set();
        channels.slice(0, 10).forEach(ch => {
            console.log(`[Channel: ${ch.name}] (VIP: ${ch.vip})`);
            if (ch.streams) {
                ch.streams.forEach(s => {
                    console.log(`   - Stream Name: "${s.name}" | Link: ${s.link}`);
                    if (s.link) streamUrls.add(s.link);
                });
            }
        });

        console.log("\nSample stream link formats:");
        Array.from(streamUrls).slice(0, 10).forEach(l => console.log(`  => ${l}`));
    } catch(e) {
        console.error("JSON parse error:", e.message);
    }
}

parseChannels();
