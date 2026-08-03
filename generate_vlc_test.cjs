const https = require('https');
const http = require('http');
const fs = require('fs');

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

function decodeTimStreamsXor(html) {
    if (!html) return null;
    let match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/);
    if (!match) {
        match = html.match(/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/);
    }
    if (match) {
        const arr = match[2].split(',').map(Number);
        const arg1 = parseInt(match[4]);
        const arg2 = parseInt(match[6]);
        let decoded = "";
        for (let i = 0; i < arr.length; i++) {
            decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
        }
        const m3u8Match = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
        if (m3u8Match) return m3u8Match[0];
    }
    return null;
}

function decodeDaddyLiveBase64(html) {
    if (!html) return null;
    const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
    if (match) {
        try {
            return Buffer.from(match[1], 'base64').toString('utf-8');
        } catch(e) {}
    }
    return null;
}

async function main() {
    console.log("[*] Generating fresh VLC test playlist (vlc_test.m3u)...");
    let m3uLines = ['#EXTM3U\n'];

    // 1. Resolve TimStreams ABC USA & ESPN USA
    console.log("[1/4] Resolving TimStreams: ABC USA...");
    const tsAbcHtml = await fetchPage('https://logic.icelanders.st/embed/abc-usa', 'https://timstreams.st/');
    const tsAbcUrl = decodeTimStreamsXor(tsAbcHtml);
    if (tsAbcUrl) {
        m3uLines.push(`#EXTINF:-1 tvg-name="ABC USA (TimStreams)" group-title="TimStreams",ABC USA (TimStreams)\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=https://timstreams.st/\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${tsAbcUrl}\n`);
    }

    console.log("[2/4] Resolving TimStreams: ESPN USA...");
    const tsEspnHtml = await fetchPage('https://logic.icelanders.st/embed/espn-usa', 'https://timstreams.st/');
    const tsEspnUrl = decodeTimStreamsXor(tsEspnHtml);
    if (tsEspnUrl) {
        m3uLines.push(`#EXTINF:-1 tvg-name="ESPN USA (TimStreams)" group-title="TimStreams",ESPN USA (TimStreams)\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=https://timstreams.st/\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${tsEspnUrl}\n`);
    }

    // 2. Resolve DaddyLive ABC USA & Astro SuperSport 1
    console.log("[3/4] Resolving DaddyLive: ABC USA (ID 51)...");
    const dlAbcHtml = await fetchPage('https://hamis.romponalis.st/premiumtv/daddy3.php?id=51', 'https://dlhd.st/stream/stream-51.php');
    const dlAbcUrl = decodeDaddyLiveBase64(dlAbcHtml);
    if (dlAbcUrl) {
        m3uLines.push(`#EXTINF:-1 tvg-name="ABC USA (DaddyLive)" group-title="DaddyLive",ABC USA (DaddyLive)\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=https://hamis.romponalis.st/premiumtv/daddy3.php?id=51\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${dlAbcUrl}\n`);
    }

    console.log("[4/4] Resolving DaddyLive: Astro SuperSport 1 (ID 123)...");
    const dlAstroHtml = await fetchPage('https://hamis.romponalis.st/premiumtv/daddy3.php?id=123', 'https://dlhd.st/stream/stream-123.php');
    const dlAstroUrl = decodeDaddyLiveBase64(dlAstroHtml);
    if (dlAstroUrl) {
        m3uLines.push(`#EXTINF:-1 tvg-name="Astro SuperSport 1 (DaddyLive)" group-title="DaddyLive",Astro SuperSport 1 (DaddyLive)\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=https://hamis.romponalis.st/premiumtv/daddy3.php?id=123\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${dlAstroUrl}\n`);
    }

    const playlist = m3uLines.join('');
    fs.writeFileSync('vlc_test.m3u', playlist, 'utf-8');
    console.log("\n[✓] Generated vlc_test.m3u successfully!");
}

main();
