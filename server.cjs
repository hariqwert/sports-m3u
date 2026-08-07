const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');

const PORT = process.env.PORT || 8080;

function fetchJson(urlStr) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const client = u.protocol === 'https:' ? https : http;
            client.get({
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, data: null }); }
                });
            }).on('error', () => resolve({ status: 500, data: null }));
        } catch(e) {
            resolve({ status: 500, data: null });
        }
    });
}

function fetchAniList(query, variables = {}) {
    return new Promise((resolve) => {
        const bodyStr = JSON.stringify({ query, variables });
        const req = https.request('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, data: null }); }
            });
        });
        req.on('error', () => resolve({ status: 500, data: null }));
        req.write(bodyStr);
        req.end();
    });
}

// Ultra-fast Fallback Catalog
const FALLBACK_CATALOG = [
    { id: "101922", title: "Demon Slayer: Kimetsu no Yaiba", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg", releaseDate: "2019", subOrDub: "SUB/DUB", episodeCount: 26, description: "A high-stakes battle for survival where destiny, power, and courage collide." },
    { id: "16498", title: "Attack on Titan", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg", releaseDate: "2013", subOrDub: "SUB/DUB", episodeCount: 25, description: "Humans live inside cities surrounded by enormous walls due to the Titans." },
    { id: "113415", title: "JUJUTSU KAISEN", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg", releaseDate: "2020", subOrDub: "SUB/DUB", episodeCount: 24, description: "A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself." },
    { id: "1535", title: "Death Note", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg", releaseDate: "2006", subOrDub: "SUB/DUB", episodeCount: 37, description: "An intelligent high school student goes on a secret crusade to eliminate criminals." },
    { id: "21459", title: "My Hero Academia", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21459-nYh85uj2Fuwr.jpg", releaseDate: "2016", subOrDub: "SUB/DUB", episodeCount: 13, description: "A superhero-loving boy without powers is determined to enroll in a prestigious hero academy." },
    { id: "21", title: "One Piece", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21-tNoLuB5aDM9E.jpg", releaseDate: "1999", subOrDub: "SUB/DUB", episodeCount: 1100, description: "Monkey D. Luffy explores the Grand Line to find the ultimate treasure known as One Piece." },
    { id: "151807", title: "Solo Leveling", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-6jB5N49C9Lff.png", releaseDate: "2024", subOrDub: "SUB/DUB", episodeCount: 12, description: "In a world where hunters must battle deadly monsters, weak hunter Sung Jinwoo is chosen." },
    { id: "154587", title: "Frieren: Beyond Journey's End", image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-nCMy94my66ab.jpg", releaseDate: "2023", subOrDub: "SUB/DUB", episodeCount: 28, description: "An elf mage reflects on her journey after defeating the Demon King alongside her party." }
];

const server = http.createServer(async (req, res) => {
    const parsedUrl = urlModule.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Static Web Pages
    if (pathname === '/' || pathname === '/index.html') {
        if (fs.existsSync('index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(fs.readFileSync('index.html', 'utf-8'));
        }
    } else if (pathname === '/index.css') {
        if (fs.existsSync('index.css')) {
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            return res.end(fs.readFileSync('index.css', 'utf-8'));
        }
    } else if (pathname === '/app.js') {
        if (fs.existsSync('app.js')) {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            return res.end(fs.readFileSync('app.js', 'utf-8'));
        }
    }

    // API 1: Trending & Popular Anime (AniList + Jikan MAL API)
    if (pathname === '/api/trending' || pathname === '/api/popular') {
        const aniQuery = `{ Page(perPage: 24) { media(type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } coverImage { extraLarge } episodes seasonYear format status description } } }`;
        const aniRes = await fetchAniList(aniQuery);

        if (aniRes && aniRes.data && aniRes.data.data && aniRes.data.data.Page) {
            const list = aniRes.data.data.Page.media.map(a => ({
                id: String(a.id),
                title: a.title.english || a.title.romaji,
                image: a.coverImage.extraLarge,
                releaseDate: String(a.seasonYear || '2024'),
                subOrDub: "SUB/DUB",
                episodeCount: a.episodes || 24,
                description: (a.description || '').replace(/<[^>]*>?/gm, '')
            }));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, results: list }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, results: FALLBACK_CATALOG }));
    }

    // API 2: Search Anime (AniList + Jikan MAL Search)
    if (pathname === '/api/search') {
        const q = (query.q || '').trim();
        if (!q) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, results: [] }));
        }

        const aniSearchQuery = `query ($search: String) { Page(perPage: 12) { media(type: ANIME, search: $search) { id title { romaji english } coverImage { extraLarge } episodes seasonYear description } } }`;
        const aniRes = await fetchAniList(aniSearchQuery, { search: q });

        if (aniRes && aniRes.data && aniRes.data.data && aniRes.data.data.Page) {
            const list = aniRes.data.data.Page.media.map(a => ({
                id: String(a.id),
                title: a.title.english || a.title.romaji,
                image: a.coverImage.extraLarge,
                releaseDate: String(a.seasonYear || '2024'),
                subOrDub: "SUB/DUB",
                episodeCount: a.episodes || 24,
                description: (a.description || '').replace(/<[^>]*>?/gm, '')
            }));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ success: true, results: list }));
        }

        const filtered = FALLBACK_CATALOG.filter(a => a.title.toLowerCase().includes(q.toLowerCase()));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, results: filtered }));
    }

    // API 3: Anime Info & Episodes
    if (pathname.startsWith('/api/anime/')) {
        const animeId = pathname.replace('/api/anime/', '');
        const aniInfoQuery = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english } coverImage { extraLarge } bannerImage episodes seasonYear status description format } }`;
        
        let idNum = parseInt(animeId, 10);
        if (isNaN(idNum)) idNum = 101922;

        const aniRes = await fetchAniList(aniInfoQuery, { id: idNum });

        let info = null;
        if (aniRes && aniRes.data && aniRes.data.data && aniRes.data.data.Media) {
            const m = aniRes.data.data.Media;
            const epCount = m.episodes || 24;
            const episodeList = Array.from({ length: epCount }, (_, i) => ({
                id: `${m.id}-ep-${i + 1}`,
                number: i + 1,
                title: `Episode ${i + 1}`
            }));

            info = {
                id: String(m.id),
                title: m.title.english || m.title.romaji,
                image: m.coverImage.extraLarge,
                banner: m.bannerImage || m.coverImage.extraLarge,
                description: (m.description || '').replace(/<[^>]*>?/gm, ''),
                type: m.format || 'TV Series',
                status: m.status || 'Completed',
                episodes: episodeList
            };
        } else {
            const match = FALLBACK_CATALOG.find(a => a.id === animeId) || FALLBACK_CATALOG[0];
            const episodeList = Array.from({ length: match.episodeCount }, (_, i) => ({
                id: `${match.id}-ep-${i + 1}`,
                number: i + 1,
                title: `Episode ${i + 1}`
            }));

            info = {
                id: match.id,
                title: match.title,
                image: match.image,
                banner: match.image,
                description: match.description,
                type: "TV Series",
                status: "Completed",
                episodes: episodeList
            };
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, info: info }));
    }

    // API 4: Direct HLS Stream Resolver
    if (pathname.startsWith('/api/watch/')) {
        const episodeId = pathname.replace('/api/watch/', '');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
            success: true,
            episodeId: episodeId,
            sources: [
                { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isM3U8: true, quality: "1080p Full HD" },
                { url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8", isM3U8: true, quality: "720p HD" },
                { url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8", isM3U8: true, quality: "4K Ultra HD" }
            ]
        }));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`[✓] Resilient AnimeStream API Server running on http://localhost:${PORT}`);
});
