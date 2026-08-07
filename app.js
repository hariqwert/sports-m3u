let artPlayer = null;
let currentAnimeInfo = null;
let currentEpisodeId = null;
let currentServers = [];

document.addEventListener('DOMContentLoaded', () => {
    loadTrendingAnime();
    setupSearch();
});

// Reset to homepage view
function resetHome(e) {
    if (e) e.preventDefault();
    closePlayer();
    loadTrendingAnime();
}

// Fetch and render trending anime catalog
async function loadTrendingAnime() {
    try {
        const res = await fetch('/api/trending');
        const data = await res.json();
        if (data.success && data.results) {
            renderAnimeGrid(data.results);
            if (data.results.length > 0) {
                updateHeroBanner(data.results[0]);
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
        card.onclick = () => watchAnime(anime.id || anime.url);

        const imgUrl = anime.image || 'https://via.placeholder.com/180x250/1e293b/ffffff?text=Anime';
        const title = anime.title || anime.name || 'Anime Title';
        const release = anime.releaseDate || anime.year || '2024';

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
    document.getElementById('heroBg')?.setAttribute('src', anime.image);
    document.getElementById('heroTitle').innerText = anime.title || 'Featured Anime';
}

// Live Search Autocomplete Setup
function setupSearch() {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchResults');
    let debounceTimer = null;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success && data.results && data.results.length > 0) {
                    renderSearchDropdown(data.results);
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

    results.slice(0, 6).forEach(anime => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.onclick = () => {
            dropdown.classList.remove('active');
            watchAnime(anime.id);
        };

        const imgUrl = anime.image || 'https://via.placeholder.com/40x56/1e293b/ffffff';
        const title = anime.title || 'Anime Title';
        const release = anime.releaseDate || '2024';

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
        console.log(`[*] Loading anime info for: ${animeId}...`);
        const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}`);
        const data = await res.json();

        if (data.success && data.info) {
            currentAnimeInfo = data.info;
            showPlayerSection();
            renderEpisodesGrid(currentAnimeInfo.episodes || []);
            
            if (currentAnimeInfo.episodes && currentAnimeInfo.episodes.length > 0) {
                playEpisode(currentAnimeInfo.episodes[0].id, 1);
            }
        }
    } catch(e) {
        console.error("Failed to load anime info:", e);
    }
}

function renderEpisodesGrid(episodes) {
    const grid = document.getElementById('episodesGrid');
    grid.innerHTML = '';

    if (episodes.length === 0) {
        grid.innerHTML = '<p style="font-size:13px; color:#94a3b8;">No episodes found.</p>';
        return;
    }

    episodes.forEach((ep, idx) => {
        const btn = document.createElement('button');
        btn.className = `ep-btn ${idx === 0 ? 'active' : ''}`;
        btn.id = `ep-btn-${ep.id}`;
        btn.innerText = `Ep ${ep.number || idx + 1}`;
        btn.onclick = () => playEpisode(ep.id, ep.number || idx + 1);
        grid.appendChild(btn);
    });
}

// Play specific episode
async function playEpisode(episodeId, epNum) {
    currentEpisodeId = episodeId;

    document.querySelectorAll('.ep-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`ep-btn-${episodeId}`);
    if (activeBtn) activeBtn.classList.add('active');

    const animeTitle = currentAnimeInfo ? currentAnimeInfo.title : 'Anime Stream';
    document.getElementById('nowPlayingTitle').innerText = `${animeTitle} — Episode ${epNum}`;

    try {
        console.log(`[*] Resolving multi-server streams for episode: ${episodeId}...`);
        const res = await fetch(`/api/watch/${encodeURIComponent(episodeId)}`);
        const data = await res.json();

        if (data.success && data.servers && data.servers.length > 0) {
            currentServers = data.servers;
            renderServersGrid(currentServers);
            initArtPlayer(currentServers[0].url);
        } else {
            initArtPlayer('/streams/demon-slayer-ep1/master.m3u8');
        }
    } catch(e) {
        console.error("Failed to play episode:", e);
        initArtPlayer('/streams/demon-slayer-ep1/master.m3u8');
    }
}

// Render kaa.lt Style Server Selection Bar
function renderServersGrid(servers) {
    const grid = document.getElementById('serversGrid');
    grid.innerHTML = '';

    servers.forEach((srv, idx) => {
        const btn = document.createElement('button');
        btn.className = `ep-btn ${idx === 0 ? 'active' : ''}`;
        btn.style.width = 'auto';
        btn.id = `srv-btn-${idx}`;
        btn.innerText = srv.name;
        btn.onclick = () => switchServer(srv.url, idx);
        grid.appendChild(btn);
    });
}

function switchServer(url, idx) {
    document.querySelectorAll('#serversGrid .ep-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`srv-btn-${idx}`);
    if (activeBtn) activeBtn.classList.add('active');

    initArtPlayer(url);
}

// Safely Initialize ArtPlayer (supports ArtPlayer, Artplayer, or HTML5 HLS fallback)
function initArtPlayer(m3u8Url) {
    const playerBox = document.getElementById('artplayer');

    if (artPlayer && typeof artPlayer.destroy === 'function') {
        artPlayer.destroy();
        artPlayer = null;
    }

    const ArtPlayerConstructor = window.Artplayer || window.ArtPlayer;

    if (ArtPlayerConstructor) {
        artPlayer = new ArtPlayerConstructor({
            container: '#artplayer',
            url: m3u8Url,
            type: 'm3u8',
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
        if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls();
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = m3u8Url;
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
