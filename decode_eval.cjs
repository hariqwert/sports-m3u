const fs = require('fs');

const html = fs.readFileSync('embed_abc.html', 'utf-8');

const mt4Match = html.match(/_mt4\s*=\s*\[([\d,]+)\]/);
const ad1Match = html.match(/_ad1\s*=\s*(\d+)/);
const ro0Match = html.match(/_ro0\s*=\s*(\d+)/);

if (mt4Match && ad1Match && ro0Match) {
    const _mt4 = mt4Match[1].split(',').map(Number);
    const _ad1 = parseInt(ad1Match[1]);
    const _ro0 = parseInt(ro0Match[1]);

    let decoded = "";
    for (let i = 0; i < _mt4.length; i++) {
        decoded += String.fromCharCode(((_mt4[i] ^ _ad1) - _ro0 + 256) % 256);
    }

    console.log("[+] DECODED SCRIPT:");
    console.log(decoded);
} else {
    console.log("Matches:", { mt4: !!mt4Match, ad1: !!ad1Match, ro0: !!ro0Match });
}
