// Connect to the RUNNING browser via CDP if possible, else fall back to screenshot crop.
// The running chrome was launched WITHOUT --remote-debugging-port, so CDP attach isn't possible.
// Crop the latest full-page screenshot instead.
const fs = require('fs');
const { execSync } = require('child_process');
const files = fs.readdirSync('./logs').filter(f => f.startsWith('qr_') && f.endsWith('.png')).sort();
const latest = files[files.length - 1];
console.log('cropping from', latest);
// Full page is 1440x900+; the verify panel is centered, QR img ~180x180 near center.
// Crop a generous center region and let the user see it.
execSync(`ffmpeg -y -i logs/${latest} -vf "crop=600:700:420:100" logs/qr_crop.png 2>&1 | tail -1`);
console.log('wrote logs/qr_crop.png');
