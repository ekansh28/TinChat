const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');

const CURRENT_DIR = __dirname;
const EMOTES_DIR = path.join(CURRENT_DIR, 'emotes');
const OUTPUT_JSON = path.join(CURRENT_DIR, 'emote_index.json');

// Function to read or initialize emoteIndex
const loadEmoteIndex = () => {
    try {
        if (fs.existsSync(OUTPUT_JSON)) {
            const data = fs.readFileSync(OUTPUT_JSON, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn(`⚠️ Could not load existing emote index from ${OUTPUT_JSON}:`, e.message);
    }
    return []; // Return an empty array if file doesn't exist or is corrupted
};

let emoteIndex = loadEmoteIndex();
const existingEmoteMap = new Map(emoteIndex.map(e => [e.filename, e])); // Map for quick lookup

fs.readdir(EMOTES_DIR, (err, files) => {
    if (err) {
        console.error('❌ Failed to read emotes folder:', err);
        return;
    }

    const currentEmoteFiles = new Set();
    const newEmoteIndex = [];

    files.forEach((file) => {
        const filePath = path.join(EMOTES_DIR, file);

        // Skip non-image files
        if (!/\.(gif|png|jpe?g)$/i.test(file)) {
            return;
        }

        currentEmoteFiles.add(file); // Add to set of currently existing files

        // If the emote is already in our existing index, use its data
        if (existingEmoteMap.has(file)) {
            newEmoteIndex.push(existingEmoteMap.get(file));
        } else {
            // Otherwise, it's a new emote, so process it
            try {
                const stats = fs.statSync(filePath);
                const imageBuffer = fs.readFileSync(filePath);
                const dimensions = imageSize(imageBuffer);

                newEmoteIndex.push({
                    filename: file,
                    width: dimensions.width || 16,
                    height: dimensions.height || 16,
                    size_bytes: stats.size
                });
                console.log(`✨ Added new emote: ${file}`);
            } catch (e) {
                console.warn(`⚠️ Skipped new file ${file} due to error:`, e.message);
            }
        }
    });

    // Filter out emotes from the old index that no longer exist in the folder
    const finalEmoteIndex = newEmoteIndex.filter(emote => currentEmoteFiles.has(emote.filename));

    // Identify and report removed emotes
    const removedEmotes = emoteIndex.filter(emote => !currentEmoteFiles.has(emote.filename));
    if (removedEmotes.length > 0) {
        console.log(`🗑️ Removed ${removedEmotes.length} emotes no longer found in folder:`);
        removedEmotes.forEach(emote => console.log(`   - ${emote.filename}`));
    }

    // Sort the emotes by filename for consistent output
    finalEmoteIndex.sort((a, b) => a.filename.localeCompare(b.filename));

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalEmoteIndex, null, 2));
    console.log(`✅ Emote index saved to ${OUTPUT_JSON} with ${finalEmoteIndex.length} emotes.`);
});