const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { transcodeToHls } = require('./ffmpeg_transcoder.cjs');

function downloadAnimeVideo(urlStr, destPath) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const client = u.protocol === 'https:' ? https : http;
        const file = fs.createWriteStream(destPath);
        client.get({
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + u.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return resolve(downloadAnimeVideo(res.headers.location, destPath));
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function processRealAnimeVideo() {
    console.log("=========================================================================");
    console.log("   DOWNLOADING REAL DEMON SLAYER 1080P ANIME VIDEO & TRANSCODING HLS     ");
    console.log("=========================================================================\n");

    const animeWebm = path.join(__dirname, 'demon_slayer_real_anime.webm');
    const publicStreamsDir = path.join(__dirname, 'public', 'streams');
    const animeUrl = "https://v.animethemes.moe/KimetsuNoYaiba-OP1.webm";

    console.log(`[*] Downloading real 1080p anime video from AnimeThemes: ${animeUrl}`);
    await downloadAnimeVideo(animeUrl, animeWebm);
    
    const size = fs.statSync(animeWebm).size;
    console.log(`[✓] Downloaded real 1080p anime video to: ${animeWebm} (${size} bytes)`);

    console.log(`\n[*] Transcoding real Demon Slayer anime video with FFmpeg into HLS .m3u8 segments...`);
    await transcodeToHls(animeWebm, publicStreamsDir, 'demon-slayer-ep1');
    console.log(`\n[✓] REAL DEMON SLAYER 1080P ANIME HLS STREAM READY IN /public/streams/demon-slayer-ep1/master.m3u8!`);
}

processRealAnimeVideo();
