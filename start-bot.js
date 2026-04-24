const TokenDiscordBot = require('./core/bot');
const path = require('path');

async function start() {
    try {
        console.log('Starting Nimbus AI (Modular Addon System)...');
        const bot = new TokenDiscordBot();
        
        // Initialize the bot
        await bot.start();
        
        console.log('Bot is running!');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

start();
