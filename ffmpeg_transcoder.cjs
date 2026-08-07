const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function transcodeToHls(inputPath, outputDir, streamName = 'demon-slayer-ep1') {
    return new Promise((resolve, reject) => {
        const streamOutputDir = path.join(outputDir, streamName);
        if (!fs.existsSync(streamOutputDir)) {
            fs.mkdirSync(streamOutputDir, { recursive: true });
        }

        const masterM3u8Path = path.join(streamOutputDir, 'master.m3u8');
        const segmentPattern = path.join(streamOutputDir, 'segment_%03d.ts');

        console.log(`\n=========================================================================`);
        console.log(`   STAGE 2: FFMPEG HLS MULTI-BITRATE TRANSCODER                          `);
        console.log(`=========================================================================`);
        console.log(`[*] Input Video: ${inputPath}`);
        console.log(`[*] Output Directory: ${streamOutputDir}`);
        console.log(`[*] Target Master Manifest: ${masterM3u8Path}\n`);

        const ffmpegArgs = [
            '-y',
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-hls_time', '4',
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', segmentPattern,
            masterM3u8Path
        ];

        console.log(`[+] Executing: ffmpeg ${ffmpegArgs.join(' ')}\n`);

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        ffmpeg.stdout.on('data', data => console.log(data.toString()));
        ffmpeg.stderr.on('data', data => {
            const str = data.toString();
            if (str.includes('frame=') || str.includes('time=')) {
                process.stdout.write(`[FFmpeg Progress] ${str.trim().slice(0, 80)}\r`);
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`\n[✓] FFMPEG HLS TRANSCODING COMPLETED SUCCESSFULLY!`);
                console.log(`    Generated Master Manifest: ${masterM3u8Path}`);
                resolve(masterM3u8Path);
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });
    });
}

function createSampleVideo(outputPath, durationSeconds = 10) {
    return new Promise((resolve, reject) => {
        console.log(`[*] Generating sample test video file (${durationSeconds}s) via FFmpeg...`);
        const args = [
            '-y',
            '-f', 'lavfi',
            '-i', 'testsrc=duration=10:size=1280x720:rate=30',
            '-f', 'lavfi',
            '-i', 'sine=duration=10:frequency=440',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            outputPath
        ];

        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`Failed sample creation, code ${code}`));
        });
    });
}

async function runDemo() {
    const sampleMp4 = path.join(__dirname, 'sample_anime_episode.mp4');
    const publicStreamsDir = path.join(__dirname, 'public', 'streams');

    try {
        await createSampleVideo(sampleMp4, 10);
        await transcodeToHls(sampleMp4, publicStreamsDir, 'demon-slayer-ep1');
    } catch(e) {
        console.error("Transcoder error:", e.message);
    }
}

if (require.main === module) {
    runDemo();
}

module.exports = { transcodeToHls, createSampleVideo };
