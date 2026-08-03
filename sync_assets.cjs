const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

if (fs.existsSync('channels.json')) {
    fs.copyFileSync('channels.json', path.join(assetsDir, 'channels.json'));
    console.log("[✓] Synced channels.json to assets/channels.json");
}
