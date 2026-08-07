const { extractDlhdChannel } = require('./daddylive_extractor.cjs');

async function getLink() {
    const res = await extractDlhdChannel('51'); // ABC USA
    if (res && res.m3u8Url) {
        console.log("\n=================== FRESH LIVE M3U8 STREAM LINK ===================");
        console.log("Channel: ABC USA (DaddyLive)");
        console.log("Stream URL:\n" + res.m3u8Url);
        console.log("Required Referer Header: https://hamis.romponalis.st/premiumtv/daddy3.php?id=51");
        console.log("===================================================================\n");
    } else {
        console.log("Failed to extract stream link.");
    }
}

getLink();
