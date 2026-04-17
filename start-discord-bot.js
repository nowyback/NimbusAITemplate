require('dotenv').config();
const TokenDiscordBot = require('./discord-ollama-bot');

const config = {
    botToken: process.env.DISCORDBOTTOKEN,
    ownerId: process.env.OWNER_ID || '1326557394171592717'
};

console.log('Starting Discord Token Bot...\n');

const bot = new TokenDiscordBot(config.botToken, config.ownerId);
bot.start();

console.log('Bot Commands:');
console.log('For users:');
console.log('  ?tokens - Check remaining tokens');
console.log('  > [question] - Ask a question (uses 1 token)');
console.log('  ?help - Show help');
console.log('\nFor owner (any channel):');
console.log('  !addtokens <userId> <amount> - Give tokens');
console.log('  !checktokens <userId> - Check user tokens');
console.log('  !tokenstatus - Show total users');
console.log('  !version - Show bot version');
console.log('  !ban <userId> - Ban user from bot');
console.log('  !unban <userId> - Unban user');
console.log('  !banned - Show banned users');
console.log('  !prompts - Show recent prompt history');
console.log('  !ollama - Check Ollama connection status');
console.log('  !test-ollama - Test Ollama connection');
console.log('  !debug <question> - Debug model detection');
console.log('  !cancel - Cancel current question processing');
console.log('  !models - Show available models with details');
console.log('  !model - Scan installed Ollama models');
console.log('  !update-models - Sync bot with installed models');
