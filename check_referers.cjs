const https = require('https');
const http = require('http');

function probeWithReferer(urlStr, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': referer,
                    'Origin': new URL(referer).origin
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

async function testReferers() {
    const url = "https://xameleon.phantemlis.top/three/secure/17da7b1610120d43731d9684e153d0ed/1785783971/premium51/index.m3u8";
    const referersToTest = [
        'https://hamis.romponalis.st/',
        'https://hamis.romponalis.st/premiumtv/daddy3.php?id=51',
        'https://dlhd.st/',
        'https://dlhd.st/stream/stream-51.php'
    ];

    console.log(`Testing stream URL with different Referer headers: ${url}\n`);

    for (const ref of referersToTest) {
        console.log(`Referer: ${ref}`);
        const res = await probeWithReferer(url, ref);
        console.log(`   HTTP Status: ${res.status}`);
        console.log(`   Content-Type: ${res.contentType}`);
        console.log(`   Is HLS (#EXTM3U): ${res.isHls}`);
        console.log(`   Snippet: ${res.snippet}\n`);
    }
}

testReferers();
