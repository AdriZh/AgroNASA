// Pre-generates the static QR code for the live app shown on the closing pitch slide.
// Usage: node scripts/make-qr.cjs [url] [out]
// Dark modules on a white quiet zone are baked into the SVG so it stays scannable in dark mode too.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const url = process.argv[2] || 'https://adrizh.github.io/AgroNASA/';
const out = process.argv[3] || path.join(__dirname, '..', 'public', 'media', 'qr-live.svg');

QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } })
  .then((svg) => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const titled = svg.replace(/<svg([^>]*)>/, `<svg$1 role="img" aria-label="QR code for ${url}"><title>${url}</title>`);
    fs.writeFileSync(out, titled + '\n');
    console.log(`QR for ${url} -> ${path.relative(process.cwd(), out)} (${titled.length} bytes)`);
  })
  .catch((e) => { console.error(e); process.exit(1); });
