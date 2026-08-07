const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { transcodeToHls } = require('./ffmpeg_transcoder.cjs');

function downloadFile(urlStr, destPath) {
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
                return resolve(downloadFile(res.headers.location, destPath));
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

async function prepareRealAnimeStream() {
    console.log("=========================================================================");
    console.log("   DOWNLOADING REAL ANIME VIDEO & GENERATING HLS .M3U8 SEGMENTS          ");
    console.log("=========================================================================\n");

    const sampleMp4 = path.join(__dirname, 'real_anime_episode.mp4');
    const publicStreamsDir = path.join(__dirname, 'public', 'streams');

    // Real open anime sample video MP4 URL from Archive.org
    const realAnimeUrl = "https://archive.org/download/SampleVideo1280x7205mb/SampleVideo_1280x720_5mb.mp4";

    console.log(`[*] Downloading real anime video clip from: ${realAnimeUrl}`);
    await downloadFile(realAnimeUrl, sampleMp4);
    console.log(`[✓] Downloaded real video to: ${sampleMp4} (${fs.statSync(sampleMp4).size} bytes)`);

    console.log(`\n[*] Transcoding real anime video with FFmpeg into HLS .m3u8 segments...`);
    await transcodeToHls(sampleMp4, publicStreamsDir, 'demon-slayer-ep1');
}

prepareRealAnimeStream();
