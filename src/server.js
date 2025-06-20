const express = require('express');
const chokidar = require('chokidar');
const path = require('path');
const { build } = require('./build'); // Import the build function

const app = express();
const PORT = 3000;

const publicDir = path.join(__dirname, '..', 'public');
const contentDir = path.join(__dirname, '..', 'content');
const templatesDir = path.join(__dirname, '..', 'templates');

// --- Main Server Logic ---

async function run() {
    // 1. Perform an initial build on startup.
    await build();

    // 2. Serve the generated static files from the /public directory.
    app.use(express.static(publicDir));

    // 3. Watch for changes in content and templates.
    const watcher = chokidar.watch([contentDir, templatesDir], {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true
    });

    watcher.on('change', async (filePath) => {
        console.log(`\n📄 File change detected: ${path.basename(filePath)}`);
        console.log('🔄 Rebuilding site...');
        try {
            await build();
            console.log('✅ Site rebuild complete. Please refresh your browser.');
        } catch (error) {
            console.error('❌ Error during rebuild:', error);
        }
    });

    // 4. Start the Express server.
    app.listen(PORT, () => {
        console.log(`\n🎉 Development server running at http://localhost:${PORT}`);
        console.log('Watching for file changes in /content and /templates...');
    });
}

run();