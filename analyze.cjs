const https = require('https');
const fs = require('fs');

async function main() {
    console.log("[*] Fetching TimStreams JS asset...");
    const url = 'https://timstreams.st/assets/index-aUN8iPCA.js';
    
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            console.log(`[+] Downloaded JS bundle (${(data.length / 1024).toFixed(1)} KB)`);
            fs.writeFileSync('bundle.js', data);

            // Extract channel data structure or routes
            const channels = data.match(/\/channel\/[a-zA-Z0-9_-]+/g) || [];
            const uniqueRoutes = [...new Set(channels)];
            console.log(`[+] Discovered ${uniqueRoutes.length} channel routes in bundle.`);
            console.log("Channels:", uniqueRoutes);

            // Extract stream URLs (.m3u8, embed, api, stream)
            const m3u8s = data.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/gi) || [];
            const embeds = data.match(/https?:\/\/[^\s'"\\]+\/(?:embed|stream|live|player)\/[^\s'"\\]*/gi) || [];
            
            console.log("\n--- Direct M3U8 Stream Links ---");
            console.log([...new Set(m3u8s)]);

            console.log("\n--- Embed / Stream Player Links ---");
            console.log([...new Set(embeds)]);

            // Search for API endpoints
            const apiUrls = data.match(/https?:\/\/[^\s'"\\]+\/api\/[^\s'"\\]*/gi) || [];
            console.log("\n--- API Endpoints ---");
            console.log([...new Set(apiUrls)]);
        });
    }).on('error', (err) => {
        console.error("[!] Error:", err.message);
    });
}

main();
