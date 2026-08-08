let artPlayer = null;
let statusInterval = null;

const PRESETS = {
    sintel: 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10',
    tears: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8'
};

document.addEventListener('DOMContentLoaded', () => {
    // Start streaming default magnet preset
    usePreset('sintel');
    startStatusPolling();
});

function usePreset(type) {
    const magnet = PRESETS[type];
    if (magnet) {
        document.getElementById('magnetInput').value = magnet;
        startTorrentStream(magnet);
    }
}

function loadMagnetStream(e) {
    if (e) e.preventDefault();
    const magnet = document.getElementById('magnetInput').value.trim();
    if (magnet) {
        startTorrentStream(magnet);
    }
}

function startTorrentStream(magnet) {
    const streamUrl = `/stream/play?magnet=${encodeURIComponent(magnet)}`;
    
    if (magnet.startsWith('http://') || magnet.startsWith('https://')) {
        initArtPlayer(magnet, 'm3u8');
    } else {
        initArtPlayer(streamUrl, 'mp4');
    }
}

// Poll P2P telemetry stats from backend server
function startStatusPolling() {
    clearInterval(statusInterval);
    statusInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/torrent/status');
            const data = await res.json();
            if (data.success && data.stats) {
                updateTelemetryUI(data.stats);
            }
        } catch(e) {}
    }, 1000);
}

function updateTelemetryUI(stats) {
    document.getElementById('nowPlayingTitle').innerText = stats.name || 'Sintel 1080p Movie';
    document.getElementById('numPeers').innerText = `${stats.numPeers || 0} Swarm Peers`;
    document.getElementById('downloadSpeed').innerText = `${stats.downloadSpeed || '0.00'} MB/s`;
    
    const prog = stats.progress || 0;
    document.getElementById('progressText').innerText = `${prog}%`;
    document.getElementById('progressBarFill').style.width = `${prog}%`;
}

// Safely Initialize ArtPlayer.js
function initArtPlayer(videoUrl, type = 'mp4') {
    const playerBox = document.getElementById('artplayer');

    if (artPlayer && typeof artPlayer.destroy === 'function') {
        artPlayer.destroy();
        artPlayer = null;
    }

    const ArtPlayerConstructor = window.Artplayer || window.ArtPlayer;

    if (ArtPlayerConstructor) {
        artPlayer = new ArtPlayerConstructor({
            container: '#artplayer',
            url: videoUrl,
            type: type,
            theme: '#0284c7',
            autoplay: true,
            fullscreen: true,
            fullscreenWeb: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            pip: true,
            customType: {
                m3u8: function (video, url) {
                    if (window.Hls && window.Hls.isSupported()) {
                        const hls = new window.Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    }
                }
            }
        });
    } else {
        playerBox.innerHTML = '<video id="html5VideoPlayer" controls autoplay style="width:100%; height:100%; object-fit:contain;"></video>';
        const video = document.getElementById('html5VideoPlayer');
        if (type === 'm3u8' && window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
        } else {
            video.src = videoUrl;
        }
    }
}
