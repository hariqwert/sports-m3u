const https = require('https');
const http = require('http');

function fetchNyaaRss() {
    return new Promise((resolve) => {
        const urlStr = 'https://nyaa.si/?page=rss&q=1080p&c=1_2';
        https.get(urlStr, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let xml = '';
            res.on('data', c => xml += c);
            res.on('end', () => resolve(xml));
        }).on('error', () => resolve(''));
    });
}

function parseNyaaItems(xml) {
    const items = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    itemMatches.forEach(m => {
        const itemXml = m[1];
        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
        const infoHashMatch = itemXml.match(/<nyaa:infoHash>([\s\S]*?)<\/nyaa:infoHash>/i);
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

        if (titleMatch && linkMatch) {
            items.push({
                title: titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                link: linkMatch[1].trim(),
                infoHash: infoHashMatch ? infoHashMatch[1].trim() : null,
                pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString()
            });
        }
    });

    return items;
}

async function runNyaaBot() {
    console.log("=========================================================================");
    console.log("    STAGE 1: NYAA.SI AUTOMATED ANIME TORRENT TRACKER BOT                 ");
    console.log("=========================================================================\n");

    console.log("[*] Fetching latest 1080p anime releases from Nyaa.si RSS feed...");
    const xml = await fetchNyaaRss();
    
    if (!xml) {
        console.log("[!] Could not connect to Nyaa.si RSS feed.");
        return [];
    }

    const items = parseNyaaItems(xml);
    console.log(`[✓] Successfully fetched ${items.length} latest anime torrent releases!\n`);

    items.slice(0, 5).forEach((item, i) => {
        console.log(`[${i+1}] ${item.title}`);
        console.log(`    Torrent Link: ${item.link}`);
        console.log(`    InfoHash: ${item.infoHash || 'N/A'}\n`);
    });

    return items;
}

if (require.main === module) {
    runNyaaBot();
}

module.exports = { runNyaaBot, fetchNyaaRss, parseNyaaItems };
