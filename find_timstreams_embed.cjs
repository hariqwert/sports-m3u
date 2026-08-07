const https = require('https');

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

async function findScripts() {
    console.log("[*] Fetching TimStreams HTML to extract JS script bundles...");
    const html = await fetchUrl('https://timstreams.st/');
    
    const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    console.log("Script tags found:", scriptSrcs);

    for (const src of scriptSrcs) {
        const fullUrl = src.startsWith('http') ? src : `https://timstreams.st${src.startsWith('/') ? '' : '/'}${src}`;
        console.log(`\nFetching script: ${fullUrl}...`);
        const js = await fetchUrl(fullUrl);
        console.log(`   Length: ${js.length} bytes`);

        // Look for API URLs, embed domain patterns (e.g. logic., icelanders, vixnuvew, embed, st)
        const matches = [...js.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s'"\`<>]*)?/gi)].map(m => m[0]);
        const domains = new Set();
        matches.forEach(u => {
            try { domains.add(new URL(u).hostname); } catch(e) {}
        });

        console.log("   Hostnames in this script:");
        domains.forEach(d => console.log(`     - ${d}`));

        // Look for embed patterns like /embed/ or API endpoints
        const embedMatches = [...js.matchAll(/["'\`][^"'\`]*\/embed\/[^"'\`]*["'\`]/gi)].map(m => m[0]);
        if (embedMatches.length > 0) {
            console.log("   Embed path patterns found:", embedMatches.slice(0, 10));
        }
    }
}

findScripts();
