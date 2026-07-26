const https = require('https');
const fs = require('fs');

function fetchPage(url) {
    return new Promise((resolve) => {
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
    });
}

async function dumpEmbed() {
    const html = await fetchPage('https://logic.icelanders.st/embed/abc-usa');
    fs.writeFileSync('embed_abc.html', html);
    console.log("[+] Saved embed_abc.html");
}

dumpEmbed();
