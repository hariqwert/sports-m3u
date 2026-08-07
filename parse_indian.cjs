const https = require('https');

function fetchPage(urlStr) {
    return new Promise((resolve) => {
        const u = new URL(urlStr);
        https.get({
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dlhd.st/'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
    });
}

async function parseChannels() {
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');
    // Match <a href="...watch.php?id=XYZ"> ... </a>
    const matches = [...html.matchAll(/<a[^>]+href=["'](?:https?:\/\/dlhd\.st)?\/watch\.php\?id=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    console.log(`Found ${matches.length} channel anchor tags.`);

    const indianChannels = [];
    const keywords = ['india', 'star sports', 'sony sports', 'sony ten', 'sports18', 'willow', 'astro cricket', 'a sport', 'ptv sports', 'ten sports', 'dd sports', 'tsports', 't sports', 'geo super', 'sony', 'star', 'zee', 'colors', 'aaj tak', 'ndtv'];

    for (const m of matches) {
        const id = m[1];
        // Strip HTML tags from anchor text
        const text = m[2].replace(/<[^>]+>/g, ' ').trim().replace(/\s+/g, ' ');
        const lower = text.toLowerCase();

        if (keywords.some(kw => lower.includes(kw))) {
            indianChannels.push({ id, name: text });
        }
    }

    console.log(`\n=================== TOP INDIAN / CRICKET CHANNELS (dlhd.st) ===================`);
    indianChannels.forEach((ch, idx) => console.log(`${idx + 1}. ID ${ch.id}: ${ch.name}`));
}

parseChannels();
