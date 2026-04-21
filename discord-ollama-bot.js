const TokenDiscordBot = require('./core/bot');

async function main() {
    console.log('[Main] Starting Nimbus AI Bot...');
    
    const bot = new TokenDiscordBot();
    
    try {
        await bot.start();
        console.log('[Main] Bot started successfully!');
    } catch (error) {
        console.error('[Main] Failed to start bot:', error);
        process.exit(1);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('[Main] Received SIGINT, shutting down gracefully...');
        await bot.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('[Main] Received SIGTERM, shutting down gracefully...');
        await bot.stop();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('[Main] Unhandled error:', error);
    process.exit(1);
});
