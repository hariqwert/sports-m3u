const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            https.get({
                hostname: u.hostname,
                port: 443,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://timstreams.st/'
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

async function deepSearchAsset() {
    console.log("[*] Fetching https://timstreams.st/assets/index-IBj1h4le.js ...");
    const js = await fetchUrl('https://timstreams.st/assets/index-IBj1h4le.js');
    console.log(`    Downloaded JS length: ${js.length} bytes`);

    // Search for API endpoints
    const apiMatches = [...js.matchAll(/["'\`](https?:\/\/[^"'\`]+|\/api\/[^"'\`]+|https?:\/\/[a-zA-Z0-9.-]+\.st\/[^"'\`]*)["'\`]/gi)].map(m => m[1]);
    console.log(`\nFound ${apiMatches.length} API/URL strings:`);
    const unique = new Set(apiMatches);
    unique.forEach(u => console.log(`   - ${u}`));

    // Search for any string containing 'icelanders', 'logic', 'vixnuvew', 'embed', 'player', '.m3u8'
    const keywords = ['icelanders', 'logic', 'vixnuvew', 'embed', 'player', '.m3u8', 'stream'];
    keywords.forEach(kw => {
        const matches = [...js.matchAll(new RegExp(`["'\`][^"'\`]*${kw}[^"'\`]*["'\`]`, 'gi'))].map(m => m[0]);
        console.log(`\nKeyword '${kw}' matches count: ${matches.length}`);
        if (matches.length > 0) {
            console.log(`   Samples:`, matches.slice(0, 8));
        }
    });
}

deepSearchAsset();
