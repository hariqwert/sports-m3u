const https = require('https');
const http = require('http');

function probeStream(urlStr) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://dlhd.st/',
                    'Origin': 'https://dlhd.st'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            const req = client.get(options, (res) => {
                let bodySnippet = '';
                res.on('data', chunk => {
                    bodySnippet += chunk.toString();
                    if (bodySnippet.length > 500) req.destroy();
                });
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        contentType: res.headers['content-type'] || 'unknown',
                        isHls: bodySnippet.includes('#EXTM3U') || bodySnippet.includes('#EXT-X-STREAM-INF') || bodySnippet.includes('#EXTINF'),
                        snippet: bodySnippet.slice(0, 200).replace(/\r?\n/g, ' ')
                    });
                });
            });
            req.on('error', (err) => resolve({ status: 500, error: err.message }));
        } catch(e) {
            resolve({ status: 500, error: e.message });
        }
    });
}

async function testStreams() {
    console.log("[*] Testing sample DaddyLive (dlhd.st) extracted stream URLs...\n");
    
    const sampleUrls = [
        { name: "ABC USA (ID 51)", url: "https://xameleon.phantemlis.top/three/secure/17da7b1610120d43731d9684e153d0ed/1785783971/premium51/index.m3u8" },
        { name: "A&E USA (ID 302)", url: "https://xameleon.phantemlis.top/three/secure/0ac512b0a0bc7fb9b6a9cd95e3ece467/1785783979/premium302/index.m3u8" },
        { name: "Astro SuperSport 1 (ID 123)", url: "https://xameleon.phantemlis.top/three/secure/4f3e2ff5ecc7deb999f4aefa550aa491/1785783987/premium123/index.m3u8" },
        { name: "Arena Sport 1 Premium (ID 134)", url: "https://xameleon.phantemlis.top/two/secure/950585304ed9e3dbbf3fdc95cded6541/1785784011/premium134/index.m3u8" }
    ];

    for (const item of sampleUrls) {
        console.log(`Testing: ${item.name}`);
        console.log(`URL: ${item.url}`);
        const res = await probeStream(item.url);
        console.log(`   HTTP Status: ${res.status}`);
        console.log(`   Content-Type: ${res.contentType}`);
        console.log(`   Protocol Type: ${res.isHls ? 'HLS (HTTP Live Streaming / .m3u8)' : 'Other/MPEG'}`);
        console.log(`   Response Snippet: ${res.snippet}\n`);
    }
}

testStreams();
