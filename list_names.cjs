const https = require('https');
const http = require('http');

function fetchPage(urlStr, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': referer || 'https://dlhd.st/'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

async function listAllNames() {
    console.log("[*] Fetching all channel names on dlhd.st...");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');

    const linkMatches = [...html.matchAll(/watch\.php\?id=(\d+)[^>]*>([^<]+)/gi)];
    console.log(`Total link matches: ${linkMatches.length}`);

    // Print first 50 channel names to inspect exact naming
    for (let i = 0; i < Math.min(60, linkMatches.length); i++) {
        console.log(`ID ${linkMatches[i][1]}: ${linkMatches[i][2].trim().replace(/\s+/g, ' ')}`);
    }
}

listAllNames();
