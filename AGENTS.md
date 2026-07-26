# AGENTS.md

Guidance for AI coding agents (Claude Code, Antigravity, Cursor, Copilot, OpenCode) working in this repository.

## Repository Overview

This repository contains an automated M3U playlist extraction and 45-minute auto-refresh mechanism for IPTV sports and live TV channels sourced from `timstreams.st`, deployed on Google Cloud / Google AI Studio backend or any Node.js host.

TimStreams uses signed `.m3u8` stream tokens embedded in obfuscated JavaScript within player iFrames (`https://logic.icelanders.st/embed/{id}`). Because these tokens expire, the system uses a 45-minute caching and re-extraction pipeline to keep stream URLs working continuously.

---

## Core Architecture & Workflow

```
[ TimStreams API ] ───> Get Channel List & Embed URLs (145 channels)
         │
         ▼
[ Embed Page Fetch ] ───> Fetch HTML for https://logic.icelanders.st/embed/{id}
         │
         ▼
[ Obfuscation Decoder ] ───> Extract XOR array & constants (_mt4, _ad1, _ro0)
                             Execute: String.fromCharCode(((val ^ arg1) - arg2 + 256) % 256)
                             Regex match direct master stream URL (.m3u8)
         │
         ▼
[ M3U Generator ] ───> Construct #EXTM3U playlist & write sports.m3u / playlist.m3u
         │
         ▼
[ 45-Min Auto-Updater ] ───> Served via HTTP Server (server.cjs) or Dockerfile on Google Cloud
```

---

## Key Files & Entry Points

- **`server.cjs`**: Primary web application entry point for Google Cloud Run / Google AI Studio backend. Serves `/sports.m3u` and `/playlist.m3u`. Checks in-memory timestamp and auto-refreshes if cache age > 45 minutes (2,700,000 ms). Listens on `process.env.PORT || 8080`.
- **`auto_updater.cjs`**: Standalone daemon script. Runs `updateSportsM3u()` immediately and schedules recurring runs every 45 minutes using `setInterval`.
- **`fetch_real_m3u.cjs`**: Core standalone extractor module. Executes a single pass over all channels and updates `sports.m3u` and `channels.json`.
- **`sports.m3u`**: Standardized `#EXTM3U` output playlist file.
- **`Dockerfile`**: Docker container configuration tailored for Google Cloud Run / App Engine deployment.

---

## Google Cloud / Google AI Studio Deployment Rules

1. **Port Binding**: Always bind the HTTP server to `process.env.PORT || 8080`.
2. **In-Memory & File Fallback Caching**: Keep an in-memory variable `cachedPlaylist` and timestamp `lastFetchTime`. If a request arrives within 45 minutes, return `cachedPlaylist` immediately. If > 45 minutes, fetch fresh streams asynchronously, update `sports.m3u`, and respond.
3. **HTTP Headers**: Always include `'User-Agent': 'Mozilla/5.0...'` and `'Referer': 'https://timstreams.st/'` when making HTTP requests to avoid 403 blocks.
4. **Decoder Regex**: Match both comma-separated and semicolon-separated XOR array declarations in player iframe scripts:
   - Comma: `/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\]\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)\s*,\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+)/`
   - Semicolon: `/var\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\d,]+)\];\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);\s*([a-zA-Z0-9_$]+)\s*=\s*(\d+);/`
