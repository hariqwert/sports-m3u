import asyncio
import re
import json
import os
import sys
import urllib.parse
from playwright.async_api import async_playwright
import requests

BASE_URL = "https://timstreams.st"
CHANNEL_URL = "https://timstreams.st/channel"
OUTPUT_M3U = "playlist.m3u"
OUTPUT_JSON = "channels.json"

async def fetch_channels_and_streams():
    print(f"[*] Starting extraction from {BASE_URL}...")
    channels_data = []
    stream_links = {}

    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # Monitor requests for .m3u8 or video stream URLs
        def handle_response(response):
            url = response.url
            if ".m3u8" in url or ".m3u" in url or "stream" in url.lower() or "hls" in url.lower():
                if any(ext in url for ext in [".m3u8", ".m3u", "/hls/", "/live/"]):
                    # Store current page URL mapping
                    current = page.url
                    if current not in stream_links:
                        stream_links[current] = []
                    if url not in stream_links[current]:
                        stream_links[current].append(url)

        page.on("response", handle_response)

        # 1. Load main channel page
        print(f"[*] Loading main channel directory: {CHANNEL_URL}")
        try:
            await page.goto(CHANNEL_URL, wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"[!] Warning on initial load: {e}")

        await page.wait_for_timeout(3000)

        # Extract all internal channel links from DOM
        links = await page.eval_on_selector_all("a[href]", "elements => elements.map(e => e.getAttribute('href'))")
        
        # Filter channel hrefs
        channel_slugs = set()
        for link in links:
            if link and ("/channel/" in link or "/live/" in link or "/watch/" in link or link.startswith("/channel")):
                channel_slugs.add(link)

        print(f"[*] Discovered {len(channel_slugs)} potential channel routes from DOM.")

        # If DOM didn't yield links, try reading the bundled JS assets directly
        if not channel_slugs:
            print("[*] Inspecting JavaScript bundles for embedded channel routes...")
            content = await page.content()
            js_srcs = re.findall(r'src="(/assets/[^"]+)"', content)
            for js_src in js_srcs:
                full_js_url = urllib.parse.urljoin(BASE_URL, js_src)
                try:
                    r = requests.get(full_js_url, timeout=10)
                    if r.status_code == 200:
                        # Search for channel patterns like /channel/[name] or channel list objects
                        matches = re.findall(r'/channel/([a-zA-Z0-9_-]+)', r.text)
                        for m in matches:
                            channel_slugs.add(f"/channel/{m}")
                        
                        # Search for embedded stream URLs directly in JS
                        m3u8_matches = re.findall(r'https?://[^\s\'"]+\.m3u8[^\s\'"]*', r.text)
                        for stream in m3u8_matches:
                            if "general" not in stream_links:
                                stream_links["general"] = []
                            if stream not in stream_links["general"]:
                                stream_links["general"].append(stream)
                except Exception as ex:
                    print(f"[!] Error fetching JS asset {full_js_url}: {ex}")

        print(f"[*] Total channels to scan: {len(channel_slugs)}")

        # 2. Iterate through each discovered channel to capture stream links
        for i, slug in enumerate(sorted(channel_slugs), 1):
            target_url = urllib.parse.urljoin(BASE_URL, slug)
            channel_name = slug.strip("/").split("/")[-1].replace("-", " ").title()
            print(f"[{i}/{len(channel_slugs)}] Scanning channel: {channel_name} ({target_url})")

            captured_before = len(stream_links.get(target_url, []))
            try:
                await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(3000)

                # Look for iframes that might host players
                iframes = await page.eval_on_selector_all("iframe[src]", "elements => elements.map(e => e.getAttribute('src'))")
                for iframe_src in iframes:
                    if iframe_src and ("http" in iframe_src or iframe_src.startswith("//")):
                        full_iframe = "https:" + iframe_src if iframe_src.startswith("//") else iframe_src
                        try:
                            # Search inside iframe URL if relevant
                            if ".m3u8" in full_iframe:
                                if target_url not in stream_links:
                                    stream_links[target_url] = []
                                stream_links[target_url].append(full_iframe)
                        except Exception:
                            pass

            except Exception as e:
                print(f"[!] Timeout/Error loading {target_url}: {e}")

            captured_after = len(stream_links.get(target_url, []))
            found = captured_after - captured_before
            print(f"    -> Captured {found} stream link(s) for {channel_name}")

        await browser.close()

    # 3. Generate M3U Playlist
    print("\n[*] Writing output files...")
    m3u_lines = ["#EXTM3U\n"]
    extracted_items = []

    count = 0
    # Process mapped stream links
    for page_url, streams in stream_links.items():
        ch_name = page_url.strip("/").split("/")[-1].replace("-", " ").title() if page_url != "general" else "General Stream"
        for s_url in streams:
            count += 1
            m3u_lines.append(f'#EXTINF:-1 tvg-name="{ch_name}" group-title="TimStreams",{ch_name}\n')
            m3u_lines.append(f"{s_url}\n")
            extracted_items.append({
                "channel": ch_name,
                "page_url": page_url,
                "stream_url": s_url
            })

    with open(OUTPUT_M3U, "w", encoding="utf-8") as f:
        f.writelines(m3u_lines)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(extracted_items, f, indent=2)

    print(f"[✓] Extraction Complete! Generated '{OUTPUT_M3U}' with {count} stream links.")

if __name__ == "__main__":
    asyncio.run(fetch_channels_and_streams())
