const TokenDiscordBot = require('./core/bot');
const logger = console;

async function main() {
    try {
        // Create and start bot
        const bot = new TokenDiscordBot();
        
        logger.log('[Main] Starting Nimbus AI Bot...');
        await bot.start();
        
        logger.log('[Main] Bot started successfully!');
        
    } catch (error) {
        logger.error('[Main] Fatal error:', error);
        process.exit(1);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('[Main] Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('[Main] Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });
}

main();
