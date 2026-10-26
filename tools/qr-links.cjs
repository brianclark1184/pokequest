'use strict';
const { CONFIG, qrDestinations } = require('../app.js');
try {
  const links = qrDestinations(process.argv[2] || CONFIG.canonicalUrl);
  for (const item of links) console.log(`${item.displayName}\t${item.url}`);
} catch (error) {
  console.error('Set CONFIG.canonicalUrl in app.js or pass your final HTTPS URL:');
  console.error('node tools/qr-links.cjs https://quest.example.org/');
  console.error(error.message);
  process.exitCode = 1;
}
