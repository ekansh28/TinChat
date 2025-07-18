const fs = require('fs');
const path = require('path');

const CDN_BASE = "https://cdn.tinchat.online/emotes/";
const INDEX_FILE = path.join(__dirname, 'emote_index.json'); // Your original file

console.log("📥 Reading local emote index...");

(async () => {
  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

    const emoteList = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    console.log(`✅ Loaded ${emoteList.length} emotes`);

    const working = [];
    const broken = [];

    async function checkEmote(emoteObj) {
      const url = CDN_BASE + emoteObj.filename;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
          working.push(emoteObj); // keep full object
        } else {
          broken.push(emoteObj.filename);
        }
      } catch (e) {
        broken.push(emoteObj.filename);
      }
    }

    console.log("🔍 Checking emotes...");
    await Promise.all(emoteList.map(checkEmote));

    console.log(`✅ Working: ${working.length}`);
    console.log(`❌ Broken: ${broken.length}`);
    if (broken.length) console.log("🧹 Removed:", broken);

    const outputPath = path.join(__dirname, 'cleaned_emote_index.json');
    fs.writeFileSync(outputPath, JSON.stringify(working, null, 2));
    console.log(`📁 Cleaned index saved as: ${outputPath}`);
  } catch (err) {
    console.error("💥 Error:", err);
  }
})();
