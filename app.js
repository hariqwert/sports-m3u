let artPlayer = null;
let currentAnimeInfo = null;
let currentEpisodeId = null;
let statusInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadTrendingAnime();
    setupSearch();
    startStatusPolling();
});

// Reset to homepage view
function resetHome(e) {
    if (e) e.preventDefault();
    closePlayer();
    loadTrendingAnime();
}

// Fetch and render trending anime catalog via AniList GraphQL API
async function loadTrendingAnime() {
    const query = `{ Page(perPage: 24) { media(type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } coverImage { extraLarge } episodes seasonYear format status description } } }`;
    
    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (data && data.data && data.data.Page && data.data.Page.media) {
            renderAnimeGrid(data.data.Page.media);
            if (data.data.Page.media.length > 0) {
                updateHeroBanner(data.data.Page.media[0]);
            }
        }
    } catch(e) {
        console.error("Failed to load trending anime:", e);
    }
}

// Render anime cards
function renderAnimeGrid(animeList) {
    const grid = document.getElementById('animeGrid');
    grid.innerHTML = '';

    animeList.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.onclick = () => watchAnime(anime.id);

        const imgUrl = anime.coverImage ? anime.coverImage.extraLarge : 'https://via.placeholder.com/180x250/1e293b/ffffff?text=Anime';
        const title = anime.title.english || anime.title.romaji || 'Anime Title';
        const release = anime.seasonYear || '2024';

        card.innerHTML = `
            <img class="anime-card-img" src="${imgUrl}" alt="${title}" loading="lazy">
            <div class="anime-card-body">
                <h3 class="anime-card-title">${title}</h3>
                <div class="anime-card-meta">
                    <span>${release}</span>
                    <span class="badge-sub">SUB / DUB</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Update featured hero banner
function updateHeroBanner(anime) {
    if (!anime) return;
    document.getElementById('heroBg')?.setAttribute('src', anime.coverImage ? anime.coverImage.extraLarge : '');
    document.getElementById('heroTitle').innerText = anime.title.english || anime.title.romaji || 'Featured Anime';
    document.getElementById('heroDesc').innerText = (anime.description || '').replace(/<[^>]*>?/gm, '').slice(0, 160) + '...';
}

// Live Search Autocomplete Setup
function setupSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchResults');
    let debounceTimer = null;

    input.addEventListener('input', (e) => {
        const queryStr = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (queryStr.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const query = `query ($search: String) { Page(perPage: 6) { media(type: ANIME, search: $search) { id title { romaji english } coverImage { extraLarge } seasonYear } } }`;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { search: queryStr } })
                });
                const data = await res.json();

                if (data && data.data && data.data.Page && data.data.Page.media) {
                    renderSearchDropdown(data.data.Page.media);
                } else {
                    dropdown.classList.remove('active');
                }
            } catch(e) {}
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderSearchDropdown(results) {
    const dropdown = document.getElementById('searchResults');
    dropdown.innerHTML = '';

    results.forEach(anime => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.onclick = () => {
            dropdown.classList.remove('active');
            watchAnime(anime.id);
        };

        const imgUrl = anime.coverImage ? anime.coverImage.extraLarge : 'https://via.placeholder.com/40x56/1e293b/ffffff';
        const title = anime.title.english || anime.title.romaji || 'Anime Title';
        const release = anime.seasonYear || '2024';

        item.innerHTML = `
            <img src="${imgUrl}" alt="${title}">
            <div class="search-item-info">
                <h4>${title}</h4>
                <p>${release} • SUB/DUB</p>
            </div>
        `;
        dropdown.appendChild(item);
    });

    dropdown.classList.add('active');
}

// Watch Anime & Episode Selector Logic
async function watchAnime(animeId) {
    try {
        console.log(`[*] Loading anime info for ID: ${animeId}...`);
        const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english } coverImage { extraLarge } episodes seasonYear description } }`;
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: parseInt(animeId, 10) } })
        });
        const data = await res.json();

        if (data && data.data && data.data.Media) {
            currentAnimeInfo = data.data.Media;
            showPlayerSection();
            renderEpisodesGrid(currentAnimeInfo.episodes || 24);
            
            // Play first episode by default
            playEpisode(1);
        }
    } catch(e) {
        console.error("Failed to load anime info:", e);
    }
}

function renderEpisodesGrid(count) {
    const grid = document.getElementById('episodesGrid');
    grid.innerHTML = '';

    const epCount = count || 24;
    for (let i = 1; i <= epCount; i++) {
        const btn = document.createElement('button');
        btn.className = `ep-btn ${i === 1 ? 'active' : ''}`;
        btn.id = `ep-btn-${i}`;
        btn.innerText = `Ep ${i}`;
        btn.onclick = () => playEpisode(i);
        grid.appendChild(btn);
    }
}

// Play specific episode via WebTorrent Sequential Engine
function playEpisode(epNum) {
    document.querySelectorAll('.ep-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`ep-btn-${epNum}`);
    if (activeBtn) activeBtn.classList.add('active');

    const animeTitle = currentAnimeInfo ? (currentAnimeInfo.title.english || currentAnimeInfo.title.romaji) : 'Anime Stream';
    document.getElementById('nowPlayingTitle').innerText = `${animeTitle} — Episode ${epNum}`;

    // Launch WebTorrent Sequential P2P Stream Endpoint
    const magnetPreset = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10';
    const p2pStreamUrl = `/stream/play?magnet=${encodeURIComponent(magnetPreset)}&ep=${epNum}`;
    
    initArtPlayer(p2pStreamUrl, 'mp4');
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
    document.getElementById('numPeers').innerText = `${stats.numPeers || 0} Swarm Peers`;
    document.getElementById('downloadSpeed').innerText = `${stats.downloadSpeed || '0.00'} MB/s`;
    
    const prog = stats.progress || 0;
    document.getElementById('progressText').innerText = `${prog}%`;
    document.getElementById('progressBarFill').style.width = `${prog}%`;
}

// Safely Initialize ArtPlayer (supports ArtPlayer, Artplayer, or HTML5 HLS fallback)
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

function showPlayerSection() {
    const section = document.getElementById('playerSection');
    section.classList.add('active');
    section.scrollIntoView({ behavior: 'smooth' });
}

function closePlayer() {
    if (artPlayer && typeof artPlayer.destroy === 'function') {
        artPlayer.destroy();
        artPlayer = null;
    }
    document.getElementById('playerSection').classList.remove('active');
}
