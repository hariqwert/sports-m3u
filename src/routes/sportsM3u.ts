import { Router, Request, Response } from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';

const router = Router();
const CACHE_DURATION_MS = 45 * 60 * 1000;

let cachedPlaylist: string | null = null;
let lastFetchTime = 0;

function fetchUrl(url: string): Promise<{ status: number; data: string }> {
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const options = {
                hostname: u.hostname,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://timstreams.st/'
                }
            };
            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode || 500, data }));
            }).on('error', () => resolve({ status: 500, data: '' }));
        } catch (e) {
            resolve({ status: 500, data: '' });
        }
    });
}

function decodeStreamUrl(html: string): string | null {
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
    const directMatch = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
    return directMatch ? directMatch[0] : null;
}

function getFallbackChannelCatalog(): any[] {
    const pathsToTry = [
        path.join(process.cwd(), 'assets', 'channels.json'),
        path.join(process.cwd(), 'channels.json')
    ];

    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
                const list = Array.isArray(parsed) ? parsed : (parsed.channels || []);
                if (list.length > 0) {
                    console.log(`[+] Loaded fallback channel catalog from ${p} (${list.length} channels).`);
                    return list;
                }
            } catch (e) {}
        }
    }

    // Default hardcoded catalog fallback if no JSON exists
    return [
        { url: 'skysportsmainevent-uk', name: 'Sky Sports Main Event', genre: 'Sports' },
        { url: 'skysportsf1-uk', name: 'Sky Sports F1', genre: 'Sports' },
        { url: 'skysportspremierleague-uk', name: 'Sky Sports Premier League', genre: 'Sports' },
        { url: 'skysportsfootball-uk', name: 'Sky Sports Football', genre: 'Sports' },
        { url: 'skysportsaction-uk', name: 'Sky Sports Action', genre: 'Sports' },
        { url: 'tntsports1-uk', name: 'TNT Sports 1', genre: 'Sports' },
        { url: 'tntsports2-uk', name: 'TNT Sports 2', genre: 'Sports' },
        { url: 'tntsports3-uk', name: 'TNT Sports 3', genre: 'Sports' },
        { url: 'tntsports4-uk', name: 'TNT Sports 4', genre: 'Sports' },
        { url: 'espn-usa', name: 'ESPN', genre: 'Sports' },
        { url: 'espn2-usa', name: 'ESPN 2', genre: 'Sports' },
        { url: 'willow-usa', name: 'Willow Cricket', genre: 'Sports' }
    ];
}

export async function getOrUpdatePlaylist(force: boolean = false): Promise<string> {
    const now = Date.now();
    if (!force && cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedPlaylist;
    }

    console.log(`[*] Cache expired. Extracting Live Sports Streams from timstreams.st/streams & TV Channels...`);
    let m3uLines = ['#EXTM3U\n'];
    let totalStreamsCount = 0;

    // 1. EXTRACT FROM TIMSTREAMS.ST/STREAMS (LIVE & UPCOMING SPORTS EVENTS)
    const resEvents = await fetchUrl('https://api.vixnuvew.uk/api/live-upcoming');
    if (resEvents.status === 200 && !resEvents.data.includes('KV get() limit exceeded')) {
        try {
            const eventsData = JSON.parse(resEvents.data);
            const events = eventsData.events || [];
            const eventGenres = eventsData.genres || {};
            console.log(`[+] Processing ${events.length} Live Sports Event Streams from /streams...`);

            for (const ev of events) {
                const evName = ev.name || ev.url;
                const evLogo = ev.logo || '';
                const genreName = eventGenres[ev.genre] || ev.genre || 'Live Sports';
                const eventStreams = ev.streams || [];

                for (let sIdx = 0; sIdx < eventStreams.length; sIdx++) {
                    const st = eventStreams[sIdx];
                    const stName = st.name ? `${evName} (${st.name})` : evName;
                    const embedUrl = st.url || `https://logic.icelanders.st/embed/${ev.url}`;

                    let streamUrl = embedUrl;
                    if (embedUrl.includes('icelanders.st/embed/')) {
                        const embedRes = await fetchUrl(embedUrl);
                        streamUrl = decodeStreamUrl(embedRes.data) || embedUrl;
                    }

                    totalStreamsCount++;
                    m3uLines.push(`#EXTINF:-1 tvg-name="${stName}" tvg-logo="${evLogo}" group-title="${genreName}",${stName}\n`);
                    m3uLines.push(`${streamUrl}\n`);
                }
            }
        } catch (e: any) {
            console.error('[!] Error parsing live-upcoming events:', e.message);
        }
    } else {
        console.warn(`[!] API live-upcoming rate-limited (${resEvents.status}). Skipping event feed until KV quota resets.`);
    }

    // 2. EXTRACT LIVE TV CHANNELS (WITH FALLBACK CATALOG PROTECTION)
    let channels: any[] = [];
    let channelGenres: Record<string, string> = {};

    const resChannels = await fetchUrl('https://api.vixnuvew.uk/api/channels');
    if (resChannels.status === 200 && !resChannels.data.includes('KV get() limit exceeded')) {
        try {
            const apiData = JSON.parse(resChannels.data);
            channels = apiData.channels || [];
            channelGenres = apiData.genres || {};
        } catch (e: any) {
            console.error('[!] Error parsing channels API:', e.message);
        }
    }

    // Fallback if API failed or rate limited
    if (channels.length === 0) {
        console.warn(`[!] Primary API rate-limited or failed. Using fallback catalog...`);
        const fallbackList = getFallbackChannelCatalog();
        channels = fallbackList.map((item: any) => ({
            url: item.channel_id || item.url || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: item.name,
            logo: item.logo || '',
            genreName: item.genre || 'Sports',
            streams: [{ url: `https://logic.icelanders.st/embed/${item.channel_id || item.url || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` }]
        }));
    }

    console.log(`[+] Resolving direct live .m3u8 stream URLs for ${channels.length} channels...`);
    for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        const name = ch.name || ch.url;
        const logo = ch.logo || '';
        const genreName = ch.genreName || channelGenres[ch.genre] || 'Sports';

        let embedUrl = (ch.streams && ch.streams[0] && (ch.streams[0].url || ch.streams[0])) || `https://logic.icelanders.st/embed/${ch.url}`;
        const embedRes = await fetchUrl(embedUrl);
        const m3u8StreamUrl = decodeStreamUrl(embedRes.data) || embedUrl;

        totalStreamsCount++;
        m3uLines.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" group-title="${genreName}",${name}\n`);
        m3uLines.push(`${m3u8StreamUrl}\n`);
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();

    // Write file outputs
    try {
        const assetsDir = path.join(process.cwd(), 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
        fs.writeFileSync(path.join(assetsDir, 'sports.m3u'), cachedPlaylist, 'utf-8');
        fs.writeFileSync(path.join(process.cwd(), 'sports.m3u'), cachedPlaylist, 'utf-8');
        fs.writeFileSync(path.join(process.cwd(), 'playlist.m3u'), cachedPlaylist, 'utf-8');
    } catch (e) {}

    console.log(`[✓] Successfully updated sports.m3u playlist with ${totalStreamsCount} total stream items.`);
    return cachedPlaylist;
}

router.get(['/sports.m3u', '/playlist.m3u'], async (req: Request, res: Response) => {
    const playlist = await getOrUpdatePlaylist();
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=2700');
    res.send(playlist);
});

export default router;
