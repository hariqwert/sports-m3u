const fs = require('fs');
const path = require('path');

async function generateWorkingPlaylist() {
    console.log("[*] Building 100% Verified Working Playlist for DaddyLive (DLHD)...");

    const auditPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\dlhd_full_audit.json';
    if (!fs.existsSync(auditPath)) {
        console.error("Audit log dlhd_full_audit.json not found!");
        return;
    }

    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const workingChannels = auditData.workingChannels || [];

    console.log(`[+] Found ${workingChannels.length} confirmed working DaddyLive channels.`);

    let m3uLines = ['#EXTM3U\n'];

    workingChannels.forEach(ch => {
        const id = ch.id;
        const name = ch.name;
        const cat = ch.category || 'DaddyLive HD';
        const m3u8Url = ch.m3u8Url;
        const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${id}`;

        m3uLines.push(`#EXTINF:-1 tvg-id="${id}" tvg-name="${name}" group-title="${cat}",${name}\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=${playerIframeUrl}\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${m3u8Url}\n`);
    });

    const playlistStr = m3uLines.join('');
    
    // Save locally to dlhd-m3u folder
    const targetM3uPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\dlhd_working.m3u';
    const targetJsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels_working.json';

    fs.writeFileSync(targetM3uPath, playlistStr, 'utf-8');
    fs.writeFileSync(targetJsonPath, JSON.stringify(workingChannels, null, 2), 'utf-8');

    console.log(`[✓] Successfully saved ${workingChannels.length} working channels to:`);
    console.log(`    - ${targetM3uPath}`);
    console.log(`    - ${targetJsonPath}`);
}

generateWorkingPlaylist();
