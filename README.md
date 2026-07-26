# TimStreams Sports M3U Auto-Updater (Google AI Studio / Google Cloud Deployment)

An automated extractor and dynamic live server that fetches live channel stream links from `timstreams.st`, decodes obfuscated `.m3u8` video stream URLs, and maintains a continuously updated `#EXTM3U` playlist (`sports.m3u` / `playlist.m3u`) refreshed every **45 minutes**.

---

## 🚀 Features

- **Automated Channel Discovery**: Queries backend channel directory API (`https://api.vixnuvew.uk/api/channels`).
- **Dynamic XOR Script Decoder**: Decodes JavaScript array XOR obfuscation in embed pages (`https://logic.icelanders.st/embed/{channel}`) to extract true `.m3u8` stream URLs.
- **45-Minute Auto-Refresh**: Maintains an in-memory & file-based cache that automatically re-scans and updates all stream tokens every 45 minutes.
- **Google Cloud / AI Studio Ready**: Includes `server.cjs` and `Dockerfile` configured to bind to `process.env.PORT || 8080`.

---

## 📁 File Overview

| File | Description |
| --- | --- |
| `server.cjs` | Dynamic Node.js HTTP server. Serves `/sports.m3u` and auto-refreshes stream links every 45 min. |
| `auto_updater.cjs` | Background service script that updates `sports.m3u` on a 45-minute `setInterval` loop. |
| `fetch_real_m3u.cjs` | Core execution script that performs one full extraction run across all 145 channels. |
| `sports.m3u` | The generated `#EXTM3U` playlist containing direct `.m3u8` links. |
| `Dockerfile` | Container configuration for Google Cloud Run / Google AI Studio deployment. |
| `AGENTS.md` | Instructions for AI coding assistants on how to maintain or extend this repository. |

---

## ☁️ Google Cloud / Google AI Studio Deployment

### Deployment via Google Cloud CLI (`gcloud`)
1. Open terminal in the project directory.
2. Deploy directly to Google Cloud Run:
   ```bash
   gcloud run deploy sports-m3u-service --source . --port 8080 --allow-unauthenticated
   ```
3. Once deployed, Google Cloud will give you a live URL:
   `https://sports-m3u-service-xxxx.a.run.app/sports.m3u`

Whenever anyone or any IPTV player accesses `https://your-service.run.app/sports.m3u`, your Google Cloud server automatically checks the 45-minute timestamp and serves fresh `.m3u8` links continuously!

---

## ⚙️ Local Quick Start

### 1. Run Web Server Locally
```bash
npm start
```
Starts the server at `http://localhost:8080/sports.m3u`.

### 2. Standalone Daemon Script
```bash
node auto_updater.cjs
```
Runs in the background and updates `sports.m3u` on disk every 45 minutes.
