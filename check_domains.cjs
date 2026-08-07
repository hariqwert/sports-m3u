const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            https.get({
                hostname: u.hostname,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://timstreams.st/'
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', (err) => resolve({ status: 500, error: err.message, data: '' }));
        } catch(e) {
            resolve({ status: 500, error: e.message, data: '' });
        }
    });
}

async function checkDomains() {
    console.log("[*] Testing logic.icelanders.st...");
    const resIce = await fetchUrl('https://logic.icelanders.st/embed/skysportsf1-uk');
    console.log(`    logic.icelanders.st status: ${resIce.status} ${resIce.error || ''}`);

    console.log("\n[*] Testing timstreams.st API...");
    const resApi = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    console.log(`    api.vixnuvew.uk status: ${resApi.status}`);

    if (resApi.status === 200 && resApi.data) {
        try {
            const parsed = JSON.parse(resApi.data);
            const channels = parsed.channels || [];
            if (channels.length > 0) {
                console.log(`    Sample stream embed URL from API:`, channels[0].streams);
            }
        } catch(e) {}
    }
}

checkDomains();
