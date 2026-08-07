const fs = require('fs');

const logoMap = {
    "ABC USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/ABC_logo_2021.svg/500px-ABC_logo_2021.svg.png",
    "ABC NY USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/ABC_logo_2021.svg/500px-ABC_logo_2021.svg.png",
    "A&E USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/A%2BE_Network_logo_2021.svg/500px-A%2BE_Network_logo_2021.svg.png",
    "beIN Sports MENA English 2": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 1 France": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 2 France": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 3 France": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 1 Turkey": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 2 Turkey": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 3 Turkey": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "beIN SPORTS 4 Turkey": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "BeIN SPORTS USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png",
    "Astro SuperSport 3": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Astro_SuperSport_logo.png/500px-Astro_SuperSport_logo.png",
    "Astro SuperSport 4": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Astro_SuperSport_logo.png/500px-Astro_SuperSport_logo.png",
    "Astro Cricket": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Astro_Cricket_Logo.png/500px-Astro_Cricket_Logo.png",
    "DAZN 2 Spain": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo_2018.svg/500px-DAZN_Logo_2018.svg.png",
    "Arena Sport 2 Serbia": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Arena_Sport_Logo.png/500px-Arena_Sport_Logo.png",
    "Arena Sport 2 Croatia": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Arena_Sport_Logo.png/500px-Arena_Sport_Logo.png",
    "ESPN Brasil": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/500px-ESPN_wordmark.svg.png",
    "Fox Sports 2 USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Fox_Sports_logo_2012.svg/500px-Fox_Sports_logo_2012.svg.png",
    "FOX Sports 503 AU": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Fox_Sports_logo_2012.svg/500px-Fox_Sports_logo_2012.svg.png",
    "FanDuel Sports Network Midwest": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/FanDuel_Sports_Network_logo.png/500px-FanDuel_Sports_Network_logo.png",
    "Sportsnet One": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sportsnet_logo.svg/500px-Sportsnet_logo.svg.png",
    "Sportsnet 360": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sportsnet_logo.svg/500px-Sportsnet_logo.svg.png",
    "SuperSport Variety 1": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/SuperSport_logo_2020.svg/500px-SuperSport_logo_2020.svg.png",
    "TSN5": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/TSN_Logo.svg/500px-TSN_Logo.svg.png",
    "TNT USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/TNT_Logo_2016.svg/500px-TNT_Logo_2016.svg.png",
    "Starz": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Starz_2023_logo.svg/500px-Starz_2023_logo.svg.png",
    "Cinemax USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Cinemax_2011_logo.svg/500px-Cinemax_2011_logo.svg.png",
    "MGM+ USA / Epix": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/MGM%2B_logo.svg/500px-MGM%2B_logo.svg.png",
    "Showtime Showcase USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Showtime.svg/500px-Showtime.svg.png",
    "BBC America (BBCA)": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/BBC_America_logo_2021.svg/500px-BBC_America_logo_2021.svg.png",
    "BET USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/BET_Network_logo_2021.svg/500px-BET_Network_logo_2021.svg.png",
    "CNBC USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CNBC_logo.svg/500px-CNBC_logo.svg.png",
    "CTV Canada": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/CTV_logo_2018.svg/500px-CTV_logo_2018.svg.png",
    "CBSNY USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/CBS_logo_2020.svg/500px-CBS_logo_2020.svg.png",
    "Discovery Life Channel": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Discovery_Channel_logo.svg/500px-Discovery_Channel_logo.svg.png",
    "Disney XD": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Disney_XD_2015.svg/500px-Disney_XD_2015.svg.png",
    "NBC Sports Philadelphia": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/NBC_Sports_logo_2023.svg/500px-NBC_Sports_logo_2023.svg.png",
    "Nat Geo Wild USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Nat_Geo_Wild_logo.svg/500px-Nat_Geo_Wild_logo.svg.png",
    "Fox Weather Channel": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Fox_Weather_logo.svg/500px-Fox_Weather_logo.svg.png",
    "EuroSport 1 Spain": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Eurosport_logo_2015.svg/500px-Eurosport_logo_2015.svg.png"
};

function defaultLogo(name) {
    const lower = name.toLowerCase();
    if (lower.includes('bein')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/BeIN_Sports_logo.svg/500px-BeIN_Sports_logo.svg.png";
    if (lower.includes('fox')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Fox_Sports_logo_2012.svg/500px-Fox_Sports_logo_2012.svg.png";
    if (lower.includes('espn')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/500px-ESPN_wordmark.svg.png";
    if (lower.includes('sky')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Sky_Sports_logo_2020.svg/500px-Sky_Sports_logo_2020.svg.png";
    if (lower.includes('tnt')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/TNT_Sports_logo_2023.svg/500px-TNT_Sports_logo_2023.svg.png";
    if (lower.includes('star sports')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Star_Sports_logo.svg/500px-Star_Sports_logo.svg.png";
    if (lower.includes('sony')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Sony_Sports_Network_logo.png/500px-Sony_Sports_Network_logo.png";
    if (lower.includes('dazn')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_Logo_2018.svg/500px-DAZN_Logo_2018.svg.png";
    if (lower.includes('eurosport')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Eurosport_logo_2015.svg/500px-Eurosport_logo_2015.svg.png";
    if (lower.includes('disney')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Disney_XD_2015.svg/500px-Disney_XD_2015.svg.png";
    if (lower.includes('bbc')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/BBC_America_logo_2021.svg/500px-BBC_America_logo_2021.svg.png";
    return "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/generic.png";
}

async function updateLogos() {
    const jsonPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\channels_working.json';
    const m3uPath = 'C:\\Users\\HP\\Documents\\antigravity\\dlhd-m3u\\dlhd_working.m3u';

    if (!fs.existsSync(jsonPath)) return;

    const channels = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    let m3uLines = ['#EXTM3U\n'];

    channels.forEach(ch => {
        const logoUrl = logoMap[ch.name] || defaultLogo(ch.name);
        ch.logo = logoUrl;

        const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${ch.id}`;
        m3uLines.push(`#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${logoUrl}" group-title="${ch.category || 'DaddyLive'}",${ch.name}\n`);
        m3uLines.push(`#EXTVLCOPT:http-referrer=${playerIframeUrl}\n`);
        m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\n`);
        m3uLines.push(`${ch.m3u8Url}\n`);
    });

    fs.writeFileSync(jsonPath, JSON.stringify(channels, null, 2), 'utf-8');
    fs.writeFileSync(m3uPath, m3uLines.join(''), 'utf-8');

    console.log(`[✓] Added external tvg-logo URLs to all ${channels.length} working channels in dlhd_working.m3u & channels_working.json`);
}

updateLogos();
