const https = require('https');
const fs = require('fs');

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function dumpStreams() {
    const data = await fetchJson('https://api.vixnuvew.uk/api/live-upcoming');
    fs.writeFileSync('live_streams_dump.json', JSON.stringify(data, null, 2));
    console.log("[+] Downloaded live_streams_dump.json");
    if (data && data.events) {
        console.log(`Total Live Streams / Events: ${data.events.length}`);
        data.events.forEach((ev, i) => {
            console.log(`\nEvent ${i+1}: ${ev.name} (${ev.time || 'Live'})`);
            console.log(`Genre: ${data.genres ? data.genres[ev.genre] : ev.genre}`);
            console.log(`Streams Count: ${ev.streams ? ev.streams.length : 0}`);
            if (ev.streams) {
                ev.streams.forEach(s => console.log(`  - ${s.name}: ${s.url}`));
            }
        });
    }
}

dumpStreams();
