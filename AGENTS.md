# AGENTS.md — IPTV Sports & DaddyLive Streaming Pipeline

Guidance for AI coding agents (Claude Code, Antigravity, Cursor, Copilot, OpenCode) integrating live TV & sports stream extraction into web applications.

---

## 1. Overview & Core Architecture

This application provides an automated **M3U Playlist Extraction Engine** and **45-Minute Token Auto-Refresh Mechanism** for live sports and TV channels sourced from **TimStreams (`timstreams.st`)** and **DaddyLive (`dlhd.st`)**.

Because stream CDN tokens expire every 30 to 45 minutes, client players (HTML5 video players, HLS.js, Clappr, VLC, IPTVnator) must resolve active `.m3u8` manifests on demand via self-hosted Node.js backend endpoints rather than hardcoded static links.

```
[ Web Application / HTML Player ]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│  Node.js Backend Server (server.cjs / Express)             │
│                                                             │
│  GET /sports.m3u              ➜ Serves TimStreams M3U       │
│  GET /dlhd_working.m3u        ➜ Serves DaddyLive 51 M3U     │
│  GET /api/resolve_stream/:id  ➜ Decodes token on-demand    │
│  GET /live.php?token=...      ➜ Reverse Proxy (Bypasses 403)│
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
[ TimStreams API & Embeds ]             [ DaddyLive Embeds ]
https://timstreams.st/api/channels      https://dlhd.st/stream/stream-{id}.php
https://hux-giants.shop/embed/{id}       https://hamis.romponalis.st/premiumtv/daddy3.php?id={id}
```

---

## 2. Key Embed Domains & Decoders

> ⚠️ **CRITICAL DOMAIN UPDATE:** Legacy domain `logic.icelanders.st` is DEPRECATED and offline (`NXDOMAIN`). Use the active embed endpoints below.

### A. TimStreams (`timstreams.st`) Extraction Pipeline
- **API Endpoint:** `https://timstreams.st/api/channels` (Returns 157 live sports channels)
- **Active Player iFrame URL:** `https://hux-giants.shop/embed/{channelId}`
- **XOR Obfuscation Decoding Algorithm:**
  ```javascript
  // Extract XOR array and constants from player HTML script:
  const regex = /var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/;
  const match = html.match(regex);
  const arr = match[2].split(',').map(Number);
  const arg1 = parseInt(match[4], 10);
  const arg2 = parseInt(match[6], 10);

  let decoded = '';
  for (let i = 0; i < arr.length; i++) {
      decoded += String.fromCharCode(((arr[i] ^ arg1) - arg2 + 256) % 256);
  }
  // Result contains direct CDN manifest: https://hiveatick.casadenoval.uk/.../stream.m3u8
  ```

### B. DaddyLive (`dlhd.st`) Extraction Pipeline
- **Catalog Directory:** `channels.json` (899 channels) & `channels_working.json` (51 active 24/7 channels)
- **Player iFrame URL:** `https://hamis.romponalis.st/premiumtv/daddy3.php?id={channelId}`
- **Base64 Decoding Algorithm:**
  ```javascript
  // Player HTML contains window.atob Base64 string:
  const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
  const m3u8Url = Buffer.from(match[1], 'base64').toString('utf-8');
  // Result contains direct CDN manifest: https://xameleon.phantemlis.top/.../index.m3u8
  ```

---

## 3. Web Application Backend Endpoints (`server.cjs`)

Integrate these standard HTTP endpoints into your backend server:

| Endpoint | Method | Response Format | Purpose |
| :--- | :--- | :--- | :--- |
| `/sports.m3u` | `GET` | `#EXTM3U` Playlist | TimStreams 155 sports channels playlist with CORS headers |
| `/dlhd_working.m3u` | `GET` | `#EXTM3U` Playlist | 51 confirmed active DaddyLive 24/7 channels with `tvg-logo` |
| `/api/resolve_stream/:id` | `GET` | JSON | Resolves fresh stream URL & proxy link for channel ID |
| `/live.php?token=...` | `GET` | HLS Stream Stream | Reverse proxy spoofing `Referer` & `Origin` to prevent 403 Forbidden |

---

## 4. Frontend Website Integration Code

### A. Automatic Player Stream Resolver (HTML5 / HLS.js / Clappr)

Add this JavaScript snippet to your website player (`play.php` or `play_consumet.php`):

```javascript
async function loadChannelStream(channelId, videoElementId) {
    try {
        console.log(`[*] Resolving live stream for channel ID: ${channelId}...`);
        
        // 1. Call backend resolver API
        const response = await fetch(`/api/resolve_stream/${channelId}`);
        const data = await response.json();

        if (!data.success || !data.m3u8Url) {
            throw new Error('Stream offline or token resolution failed');
        }

        // 2. Build proxy stream URL to avoid CORS / 403 blocks
        const streamUrl = data.proxyUrl || data.m3u8Url;
        const video = document.getElementById(videoElementId);

        // 3. Initialize HLS.js player
        if (Hls.isSupported()) {
            const hls = new Hls({
                manifestLoadingTimeOut: 15000,
                manifestLoadingMaxRetry: 4
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());

            // 4. Auto-reconnect watchdog if token expires (after 30-45 mins)
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.warn('[!] Stream stalled/expired. Auto-refreshing stream token...');
                    setTimeout(() => loadChannelStream(channelId, videoElementId), 2000);
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play();
        }
    } catch (error) {
        console.error('[!] Failed to play channel:', error.message);
    }
}
```

---

## 5. Deployment Guidelines

1. **Port Binding:** Always bind the HTTP server to `process.env.PORT || 8080`.
2. **CORS Enablement:** Always include `'Access-Control-Allow-Origin': '*'` on all M3U and API responses.
3. **HTTP Header Spoofing:** When fetching embeds from Node.js, include:
   - User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`
   - TimStreams Referer: `https://timstreams.st/`
   - DaddyLive Referer: `https://hamis.romponalis.st/`
