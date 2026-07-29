const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', (err) => resolve({ status: 500, body: err.message }));
    });
}

async function checkStatus() {
    console.log("[*] Testing vixnuvew API endpoints...");
    
    const resChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    console.log("Channels API Status:", resChannels.status);
    console.log("Channels API Body Sample:", resChannels.body.slice(0, 300));

    const resLive = await fetchUrl('https://api.vixnuvew.uk/api/live-upcoming');
    console.log("\nLive-Upcoming API Status:", resLive.status);
    console.log("Live-Upcoming API Body Sample:", resLive.body.slice(0, 300));

    console.log("\n[*] Inspecting current timstreams.st website html & assets...");
    const resSite = await fetchUrl('https://timstreams.st/channel');
    console.log("Site Status:", resSite.status);
    
    const jsSrcs = resSite.body.match(/src="(\/assets\/[^"]+)"/g) || [];
    console.log("Asset scripts found:", jsSrcs);
}

checkStatus();
