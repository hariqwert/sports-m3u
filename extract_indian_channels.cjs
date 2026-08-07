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

async function findIndianChannels() {
    console.log("[*] Searching DaddyLive (dlhd.st) 24/7 catalog for Indian Channels...\n");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');

    const linkMatches = [...html.matchAll(/href=["'](?:https?:\/\/dlhd\.st)?\/watch\.php\?id=(\d+)["'][^>]*>([^<]+)/gi)];
    
    const indianKeywords = ['star sports', 'sony sports', 'sony ten', 'sports18', 'willow', 'astro cricket', 'a sport', 'ptv sports', 'ten sports', 'dd sports', 'tsports', 't sports', 'geo super', 'star plus', 'zee tv', 'colors', 'sony tv', 'aaj tak'];
    
    const found = [];
    for (const m of linkMatches) {
        const id = m[1];
        const name = m[2].trim().replace(/\s+/g, ' ');
        const lower = name.toLowerCase();

        if (indianKeywords.some(kw => lower.includes(kw))) {
            found.push({ id, name });
        }
    }

    console.log(`[+] Found ${found.length} Indian / Cricket / South Asian Channels on DaddyLive:\n`);
    found.forEach(ch => console.log(`   - ID ${ch.id}: ${ch.name}`));
}

findIndianChannels();
