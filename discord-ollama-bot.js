const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http'); // For API requests
const https = require('https'); // For downloading Discord images
const InternetAccess = require('./internet-access'); // Internet access module

class TokenDiscordBot {
    constructor(token, ownerId) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        this.token = token;
        this.ownerId = ownerId;
        this.tokensFile = path.join(__dirname, 'tokens.json');
        this.tokens = this.loadTokens();
        
        // Performance limiting
        this.userLastRequest = new Map(); // Track last request time per user
        this.requestCooldown = parseInt(process.env.REQUEST_COOLDOWN) || 5000; // Configurable cooldown
        this.defaultTokens = parseInt(process.env.DEFAULT_TOKENS) || 1; // Configurable default tokens
        this.globalProcessing = new Set(); // Track currently processing users
        this.processingMessagesFile = path.join(__dirname, 'processing-messages.json'); // Store processing messages
        
        // Banned users and prompt tracking
        this.bannedUsersFile = path.join(__dirname, 'banned-users.json');
        this.promptLogFile = path.join(__dirname, 'prompt-log.json');
        this.bannedUsers = this.loadBannedUsers();
        
        // Load models from models.txt file
        this.models = this.loadModels();
        this.defaultModel = process.env.DEFAULT_MODEL || 'llama3:8b';
        
        // Initialize internet access
        this.internetAccess = new InternetAccess({
            enabled: process.env.INTERNET_ACCESS === 'true',
            method: process.env.INTERNET_METHOD || 'search',
            allowedDomains: process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim()) : [],
            rateLimit: parseInt(process.env.RATE_LIMIT) || 10
        });
        
        this.setupEventHandlers();
        this.ollamaConnected = false;
        this.clientReady = false;
        this.lastStatusUpdate = null;
        
        // Build feature configuration
        this.buildEnabled = process.env.BUILD_ENABLED === 'true';
    }

    loadTokens() {
        try {
            if (fs.existsSync(this.tokensFile)) {
                return JSON.parse(fs.readFileSync(this.tokensFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
        }
        
        // Default structure
        return {};
    }

    saveTokens() {
        try {
            fs.writeFileSync(this.tokensFile, JSON.stringify(this.tokens, null, 2));
        } catch (error) {
            console.error('Error saving tokens:', error);
        }
    }

    getUserTokens(userId) {
        if (!this.tokens[userId]) {
            this.tokens[userId] = this.defaultTokens; // Use configurable default
            this.saveTokens();
        }
        return this.tokens[userId];
    }

    addUserTokens(userId, amount) {
        if (!this.tokens[userId]) {
            this.tokens[userId] = this.defaultTokens;
        }
        this.tokens[userId] += amount;
        this.saveTokens();
        return this.tokens[userId];
    }

    consumeToken(userId) {
        const currentTokens = this.getUserTokens(userId);
        if (currentTokens > 0) {
            this.tokens[userId]--;
            this.saveTokens();
            return true;
        }
        return false;
    }

    async processImages(attachments) {
        const images = [];
        
        for (const attachment of attachments) {
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                try {
                    console.log(`Processing image: ${attachment.url}`);
                    
                    // Download image from Discord
                    const imageData = await this.downloadImage(attachment.url);
                    
                    // Convert to base64
                    const base64Image = imageData.toString('base64');
                    
                    images.push(base64Image);
                } catch (error) {
                    console.error('Error processing image:', error);
                }
            }
        }
        
        return images;
    }

    async generateImage(prompt) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Generating image with prompt: "${prompt.substring(0, 50)}..."`);
                
                const postData = JSON.stringify({
                    model: 'stable-diffusion', // or any image generation model you have
                    prompt: prompt,
                    n: 1,
                    size: '1024x1024'
                });
                
                const options = {
                    hostname: 'localhost',
                    port: 11434,
                    path: '/api/generate',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: 120000 // 2 minute timeout
                };
                
                const req = http.request(options, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                throw new Error(`Image generation API error: ${res.statusCode} ${res.statusMessage}`);
                            }
                            
                            // For now, return a placeholder since Ollama image generation varies by setup
                            resolve(null);
                            
                        } catch (parseError) {
                            console.error('Error parsing image generation response:', parseError);
                            resolve(null);
                        }
                    });
                });
                
                req.on('error', (error) => {
                    console.error('Image generation request error:', error);
                    resolve(null);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    resolve(null);
                });
                
                req.write(postData);
                req.end();
                
            } catch (error) {
                console.error('Image generation error:', error);
                resolve(null);
            }
        });
    }

    async downloadImage(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                const data = [];
                
                response.on('data', (chunk) => {
                    data.push(chunk);
                });
                
                response.on('end', () => {
                    resolve(Buffer.concat(data));
                });
                
                response.on('error', (error) => {
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    async askLlama3(question, model = 'llama3:8b', images = []) {
        // Check if Ollama is connected
        if (!this.ollamaConnected) {
            const ownerId = this.ownerId;
            return `Nimbus AI unavailable at the moment. If this persists contact <@${ownerId}>`;
        }
        
        return new Promise((resolve, reject) => {
            try {
                console.log(`Sending request to Ollama API: model=${model}, question="${question.substring(0, 50)}...", images=${images.length}`);
                console.log('Request payload:', JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: question, ...(images && images.length > 0 ? { images } : {}) }],
                    stream: false
                }, null, 2));
                
                // Create message content with images if provided
                const messageContent = {
                    role: 'user',
                    content: question
                };
                
                // Add images to message if provided
                if (images && images.length > 0) {
                    messageContent.images = images;
                }
                
                const postData = JSON.stringify({
                    model: model,
                    messages: [messageContent],
                    stream: false // Get complete response at once
                });
                
                const options = {
                    hostname: 'localhost',
                    port: 11434,
                    path: '/api/chat',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: 180000 // 3 minute timeout
                };
                
                const req = http.request(options, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            console.log(`Ollama API response status: ${res.statusCode}, data length: ${data.length}`);
                            
                            if (res.statusCode !== 200) {
                                throw new Error(`Ollama API error: ${res.statusCode} ${res.statusMessage}`);
                            }
                            
                            if (!data || data.trim().length === 0) {
                                throw new Error('Empty response from Ollama API');
                            }
                            
                            const response = JSON.parse(data);
                            
                            if (!response.message || !response.message.content) {
                                console.error('Invalid Ollama response structure:', response);
                                throw new Error('Invalid response from Ollama API');
                            }
                            
                            let aiResponse = response.message.content.trim();
                            
                            console.log(`Ollama API response received: ${aiResponse.length} characters, content: "${aiResponse.substring(0, 100)}..."`);
                            
                            if (!aiResponse || aiResponse.length === 0) {
                                // Try with a different model as fallback
                                console.log('Empty response from current model, trying fallback model...');
                                const availableModels = Object.keys(this.models);
                                // Try models that are actually available in Ollama
                                const workingModels = ['gemma3n:e4b', 'gemma4:26b']; // Models we know work
                                const fallbackModel = workingModels.find(m => availableModels.includes(m)) || availableModels[0];
                                
                                // Retry with fallback model
                                this.askLlama3(question, fallbackModel, images)
                                    .then(fallbackResponse => {
                                        if (fallbackResponse && fallbackResponse.length > 0) {
                                            console.log(`Fallback model succeeded: ${fallbackResponse.substring(0, 100)}...`);
                                            resolve(fallbackResponse);
                                        } else {
                                            resolve('The AI returned an empty response with both models. This might indicate an issue with the question or Ollama setup. Please try rephrasing your question or check if Ollama is running properly.');
                                        }
                                    })
                                    .catch(error => {
                                        console.log('Fallback model also failed:', error);
                                        resolve('The AI returned an empty response with both models. This might indicate an issue with the question or Ollama setup. Please try rephrasing your question or check if Ollama is running properly.');
                                    });
                            } else {
                                resolve(aiResponse);
                            }
                            
                        } catch (parseError) {
                            console.error('Error parsing Ollama response:', parseError);
                            resolve('Error processing AI response.');
                        }
                    });
                });
                
                req.on('error', (error) => {
                    console.error('Ollama API request error:', error);
                    
                    // Mark as disconnected on connection error
                    this.handleOllamaDisconnected();
                    
                    // Provide helpful error messages
                    if (error.code === 'ECONNREFUSED') {
                        const ownerId = this.ownerId;
                        resolve(`Nimbus AI unavailable at the moment. If this persists contact <@${ownerId}>`);
                    } else if (error.code === 'ENOTFOUND') {
                        const ownerId = this.ownerId;
                        resolve(`Nimbus AI unavailable at the moment. If this persists contact <@${ownerId}>`);
                    } else {
                        resolve(`AI model connection error: ${error.message}`);
                    }
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    resolve('The AI is taking longer than expected. Please try with a simpler question.');
                });
                
                req.write(postData);
                req.end();
                
            } catch (error) {
                console.error('Ollama API error:', error);
                resolve(`AI model error: ${error.message}`);
            }
        });
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, async () => {
            console.log(`Starting Discord Token Bot...\n`);
            console.log(`Connected to ${this.client.guilds.cache.size} servers`);
            console.log(`Ready to process messages`);
            
            // Mark client as ready
            this.clientReady = true;
            
            // Register slash commands
            await this.setupSlashCommands();
            
            // Start Ollama connection checking
            this.checkOllamaConnection();
            // Check Ollama connection every 30 seconds
            setInterval(() => this.checkOllamaConnection(), 30000);
            
            // Set initial status based on Ollama connection
            const initialStatus = this.ollamaConnected ? 'Nimbus AI' : 'Nimbus AI - Offline';
            await this.updateBotStatus(initialStatus);
            
            // Cleanup old cooldown data every 5 minutes
            setInterval(() => {
                this.cleanupCooldowns();
            }, 300000);
        });

        this.client.on(Events.GuildCreate, (guild) => {
            console.log(`📥 Joined server: ${guild.name} (${guild.id})`);
        });

        this.client.on(Events.MessageCreate, async (message) => {
            console.log(`📨 Message received: ${message.author.tag} in ${message.channel.type === 1 ? 'DM' : message.guild.name}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
            console.log(`🔍 Channel type: ${message.channel.type}, User ID: ${message.author.id}, Owner ID: ${this.ownerId}, Bot ID: ${this.client.user.id}`);
            
            // Ignore bot messages and own messages FIRST
            if (message.author.bot || message.author.id === this.client.user?.id) {
                console.log(`🚫 Filtered bot/own message from: ${message.author.tag} (bot: ${message.author.bot}, own: ${message.author.id === this.client.user?.id})`);
                return;
            }

            const userId = message.author.id;
            const isDM = message.channel.type === 1; // DM channel type
            
            // Check if user is banned
            if (this.bannedUsers.includes(userId)) {
                console.log(`Banned user ${message.author.tag} attempted to use bot`);
                return; // Silently ignore banned users
            }

            // Owner commands (DMs or any channel for owner)
            if (userId === this.ownerId) {
                console.log(`Owner command detected: ${message.content} (DM: ${isDM}, UserID: ${userId}, OwnerID: ${this.ownerId})`);
                if (message.content.startsWith('!addtokens ')) {
                    const args = message.content.split(' ');
                    if (args.length === 3) {
                        const targetUserId = args[1];
                        const amount = parseInt(args[2]);
                        
                        if (!isNaN(amount) && amount > 0) {
                            const newTotal = this.addUserTokens(targetUserId, amount);
                            await message.reply(`Added ${amount} tokens to user ${targetUserId}. They now have ${newTotal} tokens.`);
                        } else {
                            await message.reply('Invalid amount. Usage: !addtokens <userId> <amount>');
                        }
                    } else {
                        await message.reply('Usage: !addtokens <userId> <amount>');
                    }
                    return;
                }

                if (message.content.startsWith('!checktokens ')) {
                    const targetUserId = message.content.split(' ')[1];
                    if (targetUserId) {
                        const tokens = this.getUserTokens(targetUserId);
                        await message.reply(`User ${targetUserId} has ${tokens} tokens.`);
                    } else {
                        await message.reply('Usage: !checktokens <userId>');
                    }
                    return;
                }

                if (message.content === '!tokenstatus') {
                    await message.reply(`Total users with tokens: ${Object.keys(this.tokens).length}`);
                    return;
                }

                if (message.content === '!version') {
                    const version = process.env.VERSION || 'Unknown';
                    await message.reply(`Bot Version: ${version}`);
                    return;
                }

                if (message.content.startsWith('!ban ')) {
                    const targetUserId = message.content.split(' ')[1];
                    if (targetUserId) {
                        if (!this.bannedUsers.includes(targetUserId)) {
                            this.bannedUsers.push(targetUserId);
                            this.saveBannedUsers();
                            await message.reply(`User ${targetUserId} has been banned.`);
                        } else {
                            await message.reply(`User ${targetUserId} is already banned.`);
                        }
                    } else {
                        await message.reply('Usage: !ban <userId>');
                    }
                    return;
                }

                if (message.content.startsWith('!unban ')) {
                    const targetUserId = message.content.split(' ')[1];
                    if (targetUserId) {
                        const index = this.bannedUsers.indexOf(targetUserId);
                        if (index > -1) {
                            this.bannedUsers.splice(index, 1);
                            this.saveBannedUsers();
                            await message.reply(`User ${targetUserId} has been unbanned.`);
                        } else {
                            await message.reply(`User ${targetUserId} is not banned.`);
                        }
                    } else {
                        await message.reply('Usage: !unban <userId>');
                    }
                    return;
                }

                if (message.content === '!banned') {
                    if (this.bannedUsers.length === 0) {
                        await message.reply('No users are currently banned.');
                    } else {
                        await message.reply(`Banned users (${this.bannedUsers.length}): ${this.bannedUsers.join(', ')}`);
                    }
                    return;
                }

                if (message.content === '!prompts') {
                    try {
                        const logs = JSON.parse(fs.readFileSync(this.promptLogFile, 'utf8'));
                        const recent = logs.slice(-10); // Show last 10 prompts
                        
                        if (recent.length === 0) {
                            await message.reply('No prompts logged yet.');
                        } else {
                            let response = 'Recent prompts:\n\n';
                            recent.forEach(log => {
                                response += `**${log.username}**: ${log.question.substring(0, 50)}${log.question.length > 50 ? '...' : ''} (${log.success ? 'Success' : 'Failed'})\n`;
                            });
                            await message.reply(response);
                        }
                    } catch (error) {
                        await message.reply('Error reading prompt logs.');
                    }
                    return;
                }

                if (message.content === '!ollama') {
                    const status = this.ollamaConnected ? 'Connected' : 'Disconnected';
                    const botStatus = this.ollamaConnected ? 'Nimbus AI' : 'Nimbus AI - Offline';
                    await message.reply(`Ollama Status: ${status}\nBot Status: ${botStatus}\n\nChecking every 30 seconds...`);
                    return;
                }

                if (message.content === '!test-ollama') {
                    await message.reply('Testing Ollama connection...');
                    await this.checkOllamaConnection();
                    const status = this.ollamaConnected ? 'Connected' : 'Disconnected';
                    await message.reply(`Test complete. Ollama Status: ${status}`);
                    return;
                }

                if (message.content.startsWith('!debug ')) {
                    const testQuestion = message.content.substring(7); // Remove "!debug "
                    const modelDetection = this.detectModel(testQuestion);
                    await message.reply(`Debug Info:\nOriginal: "${testQuestion}"\nDetected Model: ${modelDetection.model}\nClean Question: "${modelDetection.cleanQuestion}"\nSuffix Used: ${modelDetection.config.suffix || 'none'}\nTokens: ${modelDetection.config.tokens}`);
                    return;
                }

                if (message.content === '!cancel') {
                    // Remove user from global processing set
                    if (this.globalProcessing.has(userId)) {
                        this.globalProcessing.delete(userId);
                        await message.reply('⏹️ Question cancelled. You can ask a new question now.');
                        
                        // Log the cancellation
                        this.logPrompt(userId, message.author.username, 'CANCELLED', 'Question was cancelled', 0);
                    } else {
                        await message.reply('No question is currently being processed.');
                    }
                    return;
                }
            } else {
                // Debug: Check if this looks like an owner command but user isn't owner
                if (message.content.startsWith('!')) {
                    console.log(`Command detected but not owner: ${message.content} (DM: ${isDM}, UserID: ${userId}, OwnerID: ${this.ownerId}, IsOwner: ${userId === this.ownerId})`);
                }
            }

            // Regular user commands
            if (message.content === '?help') {
                const helpPart1 = `**🤖 Nimbus AI Bot - Commands (1/3)**

**Slash Commands:**
• /models - Show available AI models
• /tokens - Check remaining tokens
• /help - Show this help message
• /build - AI server building (admin only)

**Prefix Commands:**
• > [question] - Ask AI (uses tokens)
• > search [query] - Search the web (if enabled)
• > fetch [URL] - Get content from URL (if enabled)
• > internet on/off - Toggle internet access (owner only)
• >> [request] - AI server building (owner only)
• ?tokens - Check remaining tokens
• ?help - Show this help message
• !models - Show models with details
• !cancel - Cancel current processing`;

    const helpPart2 = `**🖼️ Image Features (2/3)**
Upload images with > or >> commands:
• > What do you see in this image? [attach image]
• >> Create a server like this [attach image]

**AI Image Generation:**
Ask AI to generate images:
- "generate image of..."
- "draw a picture of..."  
- "create visual of..."
- > Generate an image of a futuristic city`;

                const helpPart3 = `**World Wide Web (4/4)**
Internet access features (if enabled):
- > search [query] - Search the web with DuckDuckGo
- > fetch [URL] - Get content from specific URLs
- > internet on/off - Toggle access (owner only)
- Rate limited and domain filtered for safety

**Model Selection (3/4)**
Use suffixes to choose models:
• --gemma3n:e4b (1 token) • --llama3:8b (1 token)
• --phi:2.7b (1 token) • --mistral:7b (2 tokens)
• --llama3:70b (4 tokens) • --mixtral:8x7b (6 tokens)

**👑 Owner Commands:**
• /addtokens [user] [amount] • /checktokens [user]
• /ban [user] • /unban [user] • !debug [question]

**💡 Tips:**
• Different models cost different tokens
• Images work with > and >> commands  
• /build opens modal for server building
• Your tokens: ${this.getUserTokens(userId)}`;

                const helpPart4 = `**Internet Status:**
${this.internetAccess.enabled ? 'Internet access: ENABLED' : 'Internet access: DISABLED'}
${this.internetAccess.enabled ? `Method: ${this.internetAccess.method.toUpperCase()}` : ''}
${this.internetAccess.enabled && this.internetAccess.allowedDomains.length > 0 ? `Allowed domains: ${this.internetAccess.allowedDomains.join(', ')}` : ''}`;

                try {
                    await message.reply(helpPart1);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await message.reply(helpPart2);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await message.reply(helpPart3);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await message.reply(helpPart4);
                } catch (error) {
                    console.error('Error sending help message:', error);
                    // Fallback to shorter version
                    await message.reply('🤖 **Nimbus AI Bot**\n• > [question] - Ask AI\n• /models - Show models\n• /help - More info');
                }
                return;
            }

            if (message.content === '!models') {
                await message.reply('🔍 Fetching available models from your local Ollama instance...');
                
                try {
                    // Get actual installed models from Ollama
                    const options = {
                        hostname: 'localhost',
                        port: 11434,
                        path: '/api/tags',
                        method: 'GET',
                        timeout: 5000
                    };
                    
                    const req = http.request(options, (res) => {
                        let data = '';
                        
                        res.on('data', (chunk) => {
                            data += chunk;
                        });
                        
                        res.on('end', async () => {
                            if (res.statusCode === 200) {
                                try {
                                    const response = JSON.parse(data);
                                    const ollamaModels = response.models || [];
                                    
                                    // Create embed for models list
                                    const embed = {
                                        title: '🤖 Available AI Models',
                                        color: 0x0099FF, // Blue color
                                        description: 'Models installed for this Discord Bot',
                                        fields: [],
                                        footer: {
                                            text: `Your tokens: ${this.getUserTokens(userId)} | Use !cancel to stop processing`
                                        }
                                    };

                                    // Only show models that are actually available in Ollama
                                    const availableModelsByCost = {};
                                    for (const [modelId, config] of Object.entries(this.models)) {
                                        // Check if this model is actually available in Ollama
                                        const isAvailable = ollamaModels.some(ollamaModel => ollamaModel.name === modelId);
                                        
                                        if (isAvailable) {
                                            const cost = config.tokens;
                                            if (!availableModelsByCost[cost]) {
                                                availableModelsByCost[cost] = [];
                                            }
                                            
                                            availableModelsByCost[cost].push({
                                                ...config,
                                                modelId: modelId
                                            });
                                        }
                                    }

                                    // Add fields for each cost group (only available models)
                                    for (const [cost, modelList] of Object.entries(availableModelsByCost)) {
                                        const costEmoji = cost === 1 ? '🟢' : cost === 2 ? '🟡' : cost === 3 ? '🟠' : cost === 4 ? '🔴' : cost >= 6 ? '🟣' : '⚪';
                                        const modelNames = modelList.map(m => `**${m.name}** ${m.suffix || '(default)'}`).join('\n');
                                        
                                        embed.fields.push({
                                            name: `${costEmoji} ${cost} Token${cost === 1 ? '' : 's'} per Question`,
                                            value: modelNames,
                                            inline: false
                                        });
                                    }

                                    // Count total available models
                                    const totalAvailableModels = Object.values(availableModelsByCost).reduce((sum, models) => sum + models.length, 0);
                                    
                                    // Add Ollama connection info
                                    embed.fields.push({
                                        name: 'Ollama Connection',
                                        value: `Found ${ollamaModels.length} model(s) in Ollama\nShowing ${totalAvailableModels} available model(s)`,
                                        inline: false
                                    });

                                    // Add usage examples
                                    embed.fields.push({
                                        name: 'Usage Examples',
                                        value: '`> your question` (default model)\n`> your question --26b` (gemma4:26b)\n`> your question --31b` (gemma4:31b)',
                                        inline: false
                                    });

                                    embed.fields.push({
                                        name: 'Configuration',
                                        value: `Default model: ${this.models[this.defaultModel].name}\n\nOnly showing models that are downloaded in your Ollama instance.`,
                                        inline: false
                                    });

                                    await message.reply({ embeds: [embed] });
                                    
                                } catch (parseError) {
                                    console.error('Parse error details:', parseError);
                                    console.error('Received data:', data);
                                    message.reply(`❌ Error parsing Ollama model list: ${parseError.message}`);
                                }
                            } else {
                                message.reply('❌ Failed to connect to Ollama API');
                            }
                        });
                    });
                    
                    req.on('error', () => {
                        message.reply('❌ Could not connect to Ollama. Make sure Ollama is running on localhost:11434.');
                    });
                    
                    req.on('timeout', () => {
                        req.destroy();
                        message.reply('❌ Ollama connection timeout');
                    });
                    
                    req.end();
                    
                } catch (error) {
                    message.reply(`❌ Error fetching models: ${error.message}`);
                }
                return;
            }

            if (message.content === '!model') {
                if (userId === this.ownerId) {
                    await message.reply('🔍 Scanning your installed Ollama models...');
                    
                    try {
                        // Get actual installed models from Ollama
                        const options = {
                            hostname: 'localhost',
                            port: 11434,
                            path: '/api/tags',
                            method: 'GET',
                            timeout: 5000
                        };
                        
                        const req = http.request(options, (res) => {
                            let data = '';
                            
                            res.on('data', (chunk) => {
                                data += chunk;
                            });
                            
                            res.on('end', async () => {
                                if (res.statusCode === 200) {
                                    try {
                                        const response = JSON.parse(data);
                                        if (response.models && response.models.length > 0) {
                                            const embed = {
                                                title: '🔍 Detected Ollama Models',
                                                color: 0x00FF00, // Green
                                                description: `Found ${response.models.length} installed model(s)`,
                                                fields: [],
                                                footer: {
                                                    text: 'Use !update-models to sync bot configuration'
                                                }
                                            };

                                            // Add each detected model
                                            response.models.forEach(model => {
                                                const modelName = model.name.split(':')[0]; // Get base name
                                                const modelSize = model.name.split(':')[1] || '';
                                                
                                                embed.fields.push({
                                                    name: `🤖 ${model.name}`,
                                                    value: `Size: ${modelSize || 'Default'}\nDigest: ${model.digest ? model.digest.substring(0, 8) + '...' : 'Unknown'}`,
                                                    inline: false
                                                });
                                            });

                                            await message.reply({ embeds: [embed] });
                                            
                                            // Offer to update configuration
                                            message.reply('Would you like me to update the bot\'s model configuration with these detected models? Use `!update-models` to sync.');
                                            
                                        } else {
                                            message.reply('❌ Failed to parse Ollama response');
                                        }
                                    } catch (parseError) {
                                        console.error('Parse error details in !model:', parseError);
                                        console.error('Received data in !model:', data);
                                        message.reply(`❌ Error parsing Ollama model list: ${parseError.message}`);
                                    }
                                } else {
                                    message.reply('❌ Failed to connect to Ollama API');
                                }
                            });
                        });
                        
                        req.on('error', () => {
                            message.reply('❌ Could not connect to Ollama. Make sure Ollama is running.');
                        });
                        
                        req.on('timeout', () => {
                            req.destroy();
                            message.reply('❌ Ollama connection timeout');
                        });
                        
                        req.end();
                        
                    } catch (error) {
                        message.reply(`❌ Error scanning Ollama: ${error.message}`);
                    }
                } else {
                    message.reply('❌ Only the bot owner can use this command.');
                }
                return;
            }

            if (message.content === '!update-models') {
                if (userId === this.ownerId) {
                    message.reply('🔄 Updating bot model configuration from installed Ollama models...');
                    
                    try {
                        // Get actual installed models from Ollama
                        const options = {
                            hostname: 'localhost',
                            port: 11434,
                            path: '/api/tags',
                            method: 'GET',
                            timeout: 5000
                        };
                        
                        const req = http.request(options, (res) => {
                            let data = '';
                            
                            res.on('data', (chunk) => {
                                data += chunk;
                            });
                            
                            res.on('end', async () => {
                                if (res.statusCode === 200) {
                                    try {
                                        const response = JSON.parse(data);
                                        if (response.models && response.models.length > 0) {
                                            // Read current models.txt
                                            const currentModelsFile = path.join(__dirname, 'discord-models.txt');
                                            let currentModels = [];
                                            
                                            try {
                                                if (fs.existsSync(currentModelsFile)) {
                                                    const content = fs.readFileSync(currentModelsFile, 'utf8');
                                                    currentModels = content.split('\n')
                                                        .map(line => line.trim())
                                                        .filter(line => line.includes(','));
                                                }
                                            } catch (error) {
                                                console.error('Error reading current models:', error);
                                            }
                                            
                                            // Create new models list
                                            const newModels = [];
                                            response.models.forEach(model => {
                                                // Determine token cost based on model characteristics
                                                let tokenCost = 1; // Default
                                                const modelName = model.name.toLowerCase();
                                                
                                                // Assign costs based on model characteristics
                                                if (modelName.includes('70b') || modelName.includes('31b')) {
                                                    tokenCost = 9; // Large models
                                                } else if (modelName.includes('70b') || modelName.includes('13b') || modelName.includes('8x7b')) {
                                                    tokenCost = 6; // Medium-large models
                                                } else if (modelName.includes('8b') || modelName.includes('7b')) {
                                                    tokenCost = 2; // Medium models
                                                } else if (modelName.includes('2.7b') || modelName.includes('1.3b')) {
                                                    tokenCost = 1; // Small models
                                                }
                                                
                                                newModels.push(`${model.name},${tokenCost}`);
                                            });
                                            
                                            // Write updated models.txt
                                            const updatedContent = newModels.join('\n') + '\n';
                                            fs.writeFileSync(currentModelsFile, updatedContent);
                                            
                                            // Reload models in bot
                                            this.models = this.loadModels();
                                            
                                            const embed = {
                                                title: '✅ Models Updated Successfully',
                                                color: 0x00FF00,
                                                description: `Updated bot configuration with ${response.models.length} detected model(s)\n\n**New models.txt created with current costs**`,
                                                fields: [
                                                    {
                                                        name: '🔄 Bot Reloaded',
                                                        value: `${Object.keys(this.models).length} models now configured`
                                                    }
                                                ]
                                            };
                                            
                                            await message.reply({ embeds: [embed] });
                                            
                                        } else {
                                            message.reply('❌ Failed to parse Ollama response');
                                        }
                                    } catch (parseError) {
                                        console.error('Parse error details in !update-models:', parseError);
                                        console.error('Received data in !update-models:', data);
                                        message.reply(`❌ Error parsing Ollama model list: ${parseError.message}`);
                                    }
                                } else {
                                    message.reply('❌ Failed to connect to Ollama API');
                                }
                            });
                        });
                        
                        req.on('error', () => {
                            message.reply('❌ Could not connect to Ollama. Make sure Ollama is running.');
                        });
                        
                        req.on('timeout', () => {
                            req.destroy();
                            message.reply('❌ Ollama connection timeout');
                        });
                        
                        req.end();
                        
                    } catch (error) {
                        await message.reply(`❌ Error updating models: ${error.message}`);
                    }
                } else {
                    await message.reply('❌ Only the bot owner can use this command.');
                }
                return;
            }

            if (message.content === '?tokens') {
                const userTokens = this.getUserTokens(userId);
                await message.reply(`Tokens: ${userTokens}`);
                return;
            }

            // Internet access commands
            if (message.content.startsWith('> search ')) {
                if (!this.internetAccess.enabled) {
                    await message.reply('Internet access is disabled. Use config.bat to enable it.');
                    return;
                }
                
                const query = message.content.substring(9).trim();
                if (!query) {
                    await message.reply('Usage: `> search [query]`');
                    return;
                }
                
                await message.reply('Searching the web...');
                
                try {
                    const result = await this.internetAccess.accessInternet(userId, query);
                    const formattedResult = this.internetAccess.formatForAI(result, 'search');
                    
                    // Add search results to AI context
                    const enhancedQuestion = `${query}\n\n${formattedResult}\n\nBased on the search results above, please answer: ${query}`;
                    const response = await this.askLlama3(enhancedQuestion, this.defaultModel);
                    
                    // Split response into chunks if needed
                    const chunks = this.splitMessage(response);
                    for (let i = 0; i < chunks.length; i++) {
                        if (i === 0) {
                            await message.reply(`**Web Search Results [${this.defaultModel}]:**\n\n${chunks[i]}`);
                        } else {
                            await message.channel.send(chunks[i]);
                        }
                    }
                } catch (error) {
                    await message.reply(`Search failed: ${error.message}`);
                }
                return;
            }

            if (message.content.startsWith('> fetch ')) {
                if (!this.internetAccess.enabled) {
                    await message.reply('Internet access is disabled. Use config.bat to enable it.');
                    return;
                }
                
                const url = message.content.substring(8).trim();
                if (!url) {
                    await message.reply('Usage: `> fetch [URL]`');
                    return;
                }
                
                await message.reply('Fetching URL content...');
                
                try {
                    const result = await this.internetAccess.accessInternet(userId, '', url);
                    const formattedResult = this.internetAccess.formatForAI(result, 'fetch');
                    
                    // Add fetched content to AI context
                    const enhancedQuestion = `Please summarize and analyze the content from ${url}:\n\n${formattedResult}`;
                    const response = await this.askLlama3(enhancedQuestion, this.defaultModel);
                    
                    // Split response into chunks if needed
                    const chunks = this.splitMessage(response);
                    for (let i = 0; i < chunks.length; i++) {
                        if (i === 0) {
                            await message.reply(`**URL Content [${this.defaultModel}]:**\n\n${chunks[i]}`);
                        } else {
                            await message.channel.send(chunks[i]);
                        }
                    }
                } catch (error) {
                    await message.reply(`Fetch failed: ${error.message}`);
                }
                return;
            }

            // Owner-only internet toggle
            if (message.content === '> internet on' && userId === this.ownerId) {
                this.internetAccess.enabled = true;
                await message.reply('Internet access enabled.');
                return;
            }

            if (message.content === '> internet off' && userId === this.ownerId) {
                this.internetAccess.enabled = false;
                await message.reply('Internet access disabled.');
                return;
            }

            if (message.content.startsWith('> ')) {
                // Performance limiting checks
                const now = Date.now();
                const lastRequest = this.userLastRequest.get(userId) || 0;
                
                // Check cooldown
                if (now - lastRequest < this.requestCooldown) {
                    const remainingTime = Math.ceil((this.requestCooldown - (now - lastRequest)) / 1000);
                    await message.reply(`⏱️ Please wait ${remainingTime} seconds before asking another question.`);
                    return;
                }
                
                // Check if user is already being processed
                if (this.globalProcessing.has(userId)) {
                    await message.reply('⏳ Your previous question is still being processed. Please wait.');
                    return;
                }
                
                const question = message.content.substring(2).trim();
                const modelInfo = this.detectModel(question);
                const tokensNeeded = modelInfo.config.tokens;
                
                // Check if user has enough tokens
                if (this.getUserTokens(userId) >= tokensNeeded) {
                    // Consume tokens
                    for (let i = 0; i < tokensNeeded; i++) {
                        this.consumeToken(userId);
                    }
                    
                    // Update last request time and mark as processing
                    this.userLastRequest.set(userId, now);
                    this.globalProcessing.add(userId);
                    
                    // Let user know we're processing
                    const processingMsg = await message.reply('Processing your question...');
                    
                    // Load processing messages from file
                    const processingMessages = this.loadProcessingMessages();
                    let messageIndex = 0;
                    
                    // Start live editing the processing message
                    const editInterval = setInterval(async () => {
                        const message = processingMessages[messageIndex % processingMessages.length];
                        try {
                            await processingMsg.edit(`> ${message}`);
                            messageIndex++;
                        } catch (e) {
                            // Message might be deleted, stop editing
                            clearInterval(editInterval);
                        }
                    }, 7000); // Edit every 2 seconds
                    
                    try {
                        // Process images if any
                        const images = await this.processImages(message.attachments);
                        
                        // Send question to Llama 3 with detected model and images
                        const response = await this.askLlama3(modelInfo.cleanQuestion, modelInfo.model, images);
                        
                        // Stop editing and clean up
                        clearInterval(editInterval);
                        await processingMsg.delete().catch(() => {});
                        
                        // Log successful prompt
                        this.logPrompt(userId, message.author.username, question, response, true, tokensNeeded);
                        
                        // Check if user requested image generation
                        const imageRequest = question.toLowerCase();
                        const wantsImage = imageRequest.includes('generate') && 
                                        (imageRequest.includes('image') || 
                                         imageRequest.includes('picture') || 
                                         imageRequest.includes('draw') || 
                                         imageRequest.includes('create') && imageRequest.includes('visual'));
                        
                        if (wantsImage) {
                            await message.reply('Generating image... This may take a moment.');
                            
                            try {
                                const imageBuffer = await this.generateImage(question);
                                if (imageBuffer) {
                                    await message.reply({
                                        content: 'Here is your generated image:',
                                        files: [{
                                            attachment: imageBuffer,
                                            name: 'generated-image.png'
                                        }]
                                    });
                                } else {
                                    await message.reply('Sorry, I could not generate an image. Image generation may not be configured.');
                                }
                            } catch (error) {
                                console.error('Error generating image:', error);
                                await message.reply('Sorry, there was an error generating the image.');
                            }
                        }
                        
                        // Send Llama 3's response (split if too long for Discord)
                        const maxLength = 1900; // Discord limit is 2000
                        if (response.length > maxLength) {
                            const chunks = response.match(/.{1,1900}/g) || [];
                            try {
                                await message.reply(`Nimbus AI Response [${modelInfo.model}]:\n\n${chunks[0]}`);
                            } catch (replyError) {
                                console.error('Error sending response chunk:', replyError);
                                // Try sending as a new message instead
                                try {
                                    await message.channel.send(`Nimbus AI Response [${modelInfo.model}]:\n\n${chunks[0]}`);
                                } catch (sendError) {
                                    console.error('Error sending message to channel:', sendError);
                                }
                            }
                            for (let i = 1; i < chunks.length; i++) {
                                try {
                                    await message.reply(chunks[i]);
                                } catch (replyError) {
                                    console.error('Error sending response chunk:', replyError);
                                    // Try sending as a new message instead
                                    try {
                                        await message.channel.send(chunks[i]);
                                    } catch (sendError) {
                                        console.error('Error sending message to channel:', sendError);
                                    }
                                }
                            }
                        } else {
                            try {
                                await message.reply(`Nimbus AI Response [${modelInfo.model}]:\n\n${response}`);
                            } catch (replyError) {
                                console.error('Error sending response:', replyError);
                                // Try sending as a new message instead
                                try {
                                    await message.channel.send(`Nimbus AI Response [${modelInfo.model}]:\n\n${response}`);
                                } catch (sendError) {
                                    console.error('Error sending message to channel:', sendError);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing question:', error);
                        clearInterval(editInterval); // Stop editing on error
                        await processingMsg.delete().catch(() => {});
                        
                        // Log failed prompt
                        this.logPrompt(userId, message.author.username, question, error.message, false, tokensNeeded);
                        
                        try {
                            await message.reply('Sorry, I encountered an error processing your question.');
                        } catch (replyError) {
                            console.error('Error sending error message:', replyError);
                            // Try sending as a new message instead
                            try {
                                await message.channel.send('Sorry, I encountered an error processing your question.');
                            } catch (sendError) {
                                console.error('Error sending message to channel:', sendError);
                            }
                        }
                    } finally {
                        // Remove from processing set
                        this.globalProcessing.delete(userId);
                        clearInterval(editInterval); // Ensure editing is stopped
                    }
                } else {
                    try {
                        await message.reply(`Insufficient tokens! Need ${tokensNeeded} tokens for ${modelInfo.config.name}, but you only have ${this.getUserTokens(userId)}. Contact owner for more.`);
                    } catch (replyError) {
                        console.error('Error sending insufficient tokens message:', replyError);
                        // Try sending as a new message instead
                        try {
                            await message.channel.send(`Insufficient tokens! Need ${tokensNeeded} tokens for ${modelInfo.config.name}, but you only have ${this.getUserTokens(userId)}. Contact owner for more.`);
                        } catch (sendError) {
                            console.error('Error sending message to channel:', sendError);
                        }
                    }
                }
                return;
            }

            if (message.content.startsWith('>> ')) {
                if (!this.buildEnabled) {
                    await message.reply('AI building feature is currently disabled. Use `/build` to enable it.');
                    return;
                }

                if (userId !== this.ownerId) {
                    await message.reply('Only the bot owner can use the AI building feature.');
                    return;
                }

                const buildRequest = message.content.substring(3).trim();
                
                if (!buildRequest) {
                    await message.reply('Please describe what you want to build. Usage: `>> [build request]`');
                    return;
                }

                // Process images if any
                const images = await this.processImages(message.attachments);
                
                await message.reply('AI is generating your server building guide...');

                try {
                    const prompt = `You are an expert Discord server architect and administrator. A user wants to build the following for their Discord server:

"${buildRequest}"

Please provide a detailed, step-by-step guide on how to accomplish this. Include:
1. Required permissions and roles
2. Channel structure and organization
3. Bot recommendations (if applicable)
4. Settings and configurations
5. Best practices and tips
6. Any security considerations

Format your response in a clear, organized way with proper markdown formatting.`;

                    const response = await this.askLlama3(prompt, this.defaultModel, images);
                    
                    const maxLength = 1900;
                    if (response.length > maxLength) {
                        const chunks = response.match(/.{1,1900}/g) || [];
                        await message.reply(`**AI Server Building Guide:**\n\n${chunks[0]}`);
                        for (let i = 1; i < chunks.length; i++) {
                            await message.reply(chunks[i]);
                        }
                    } else {
                        await message.reply(`**AI Server Building Guide:**\n\n${response}`);
                    }
                    
                } catch (error) {
                    console.error('Error processing build request:', error);
                    await message.reply('Sorry, I encountered an error processing your build request.');
                }
                return;
            }
        });
    }

    async setupSlashCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('models')
                .setDescription('Show available AI models'),
            new SlashCommandBuilder()
                .setName('tokens')
                .setDescription('Check your remaining tokens'),
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show help information'),
            new SlashCommandBuilder()
                .setName('build')
                .setDescription('AI-assisted Discord server building')
        ];

        // Always include all commands now
        const commandData = commands;

        const rest = new REST({ version: '10' }).setToken(this.token);

        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commandData.map(cmd => cmd.toJSON()) },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error registering slash commands:', error);
        }

        // Handle slash command interactions
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
                return;
            }
            
            if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
                return;
            }
            
            if (!interaction.isChatInputCommand()) return;

            const { commandName } = interaction;

            try {
                switch (commandName) {
                    case 'models':
                        await this.handleModelsCommand(interaction);
                        break;
                    case 'tokens':
                        await this.handleTokensCommand(interaction);
                        break;
                    case 'help':
                        await this.handleHelpCommand(interaction);
                        break;
                    case 'build':
                        await this.handleBuildCommand(interaction);
                        break;
                }
            } catch (error) {
                console.error('Error handling slash command:', error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        });
    }

    async handleModelsCommand(interaction) {
        await interaction.deferReply();
        
        try {
            // Get actual installed models from Ollama
            const options = {
                hostname: 'localhost',
                port: 11434,
                path: '/api/tags',
                method: 'GET',
                timeout: 5000
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', async () => {
                    if (res.statusCode === 200) {
                        try {
                            const response = JSON.parse(data);
                            const ollamaModels = response.models || [];
                            
                            // Only show models that are actually available in Ollama
                            const availableModelsByCost = {};
                            for (const [modelId, config] of Object.entries(this.models)) {
                                const isAvailable = ollamaModels.some(ollamaModel => ollamaModel.name === modelId);
                                
                                if (isAvailable) {
                                    const cost = config.tokens;
                                    if (!availableModelsByCost[cost]) {
                                        availableModelsByCost[cost] = [];
                                    }
                                    
                                    availableModelsByCost[cost].push({
                                        ...config,
                                        modelId: modelId
                                    });
                                }
                            }

                            // Create embed for models list
                            const embed = {
                                title: 'Available AI Models',
                                color: 0x0099FF,
                                description: 'Models detected in your local Ollama instance',
                                fields: [],
                                footer: {
                                    text: `Your tokens: ${this.getUserTokens(interaction.user.id)}`
                                }
                            };

                            // Add fields for each cost group
                            for (const [cost, modelList] of Object.entries(availableModelsByCost)) {
                                const costEmoji = cost === 1 ? 'X' : cost === 2 ? 'X' : cost === 3 ? 'X' : cost === 4 ? 'X' : cost >= 6 ? 'X' : 'X';
                                const modelNames = modelList.map(m => `**${m.name}** ${m.suffix || '(default)'}`).join('\n');
                                
                                embed.fields.push({
                                    name: `${costEmoji} ${cost} Token${cost === 1 ? '' : 's'} per Question`,
                                    value: modelNames,
                                    inline: false
                                });
                            }

                            // Count total available models
                            const totalAvailableModels = Object.values(availableModelsByCost).reduce((sum, models) => sum + models.length, 0);
                            
                            embed.fields.push({
                                name: 'Ollama Connection',
                                value: `Connected to localhost:11434\nFound ${ollamaModels.length} model(s) in Ollama\nShowing ${totalAvailableModels} available model(s)`,
                                inline: false
                            });

                            embed.fields.push({
                                name: 'Configuration',
                                value: `Default model: ${this.models[this.defaultModel].name}\n\nOnly showing models that are downloaded in your Ollama instance.`,
                                inline: false
                            });

                            await interaction.editReply({ embeds: [embed] });
                            
                        } catch (parseError) {
                            console.error('Parse error details:', parseError);
                            console.error('Received data:', data);
                            await interaction.editReply(`Error parsing Ollama model list: ${parseError.message}`);
                        }
                    } else {
                        await interaction.editReply('Failed to connect to Ollama API');
                    }
                });
            });
            
            req.on('error', () => {
                interaction.editReply('Could not connect to Ollama. Make sure Ollama is running on localhost:11434.');
            });
            
            req.on('timeout', () => {
                req.destroy();
                interaction.editReply('Ollama connection timeout');
            });
            
            req.end();
            
        } catch (error) {
            await interaction.editReply(`Error fetching models: ${error.message}`);
        }
    }

    async handleTokensCommand(interaction) {
        const userTokens = this.getUserTokens(interaction.user.id);
        await interaction.reply(`Tokens: ${userTokens}`);
    }

    async handleHelpCommand(interaction) {
        const helpText = `**Nimbus AI Bot Commands**

**Slash Commands:**
/models - Show available models with details
/tokens - Check remaining tokens
/help - Show this help message
/build - AI-assisted Discord server building (admin only)

**Prefix Commands:**
> [question] - Ask a question (uses tokens)
>> [build request] - AI-assisted Discord server building (owner only, requires /build to be enabled first)
?tokens - Check remaining tokens
?help - Show help
!models - Show available models with details

**Usage:**
Use > followed by your question to ask the AI.
Use >> followed by your build request to get AI server building guides.
Use /build for detailed server building with modal interface.
Different models cost different amounts of tokens.
Your tokens: ${this.getUserTokens(interaction.user.id)}`;

        await interaction.reply(helpText);
    }

    async handleBuildCommand(interaction) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('Administrator') && interaction.user.id !== this.ownerId) {
            await interaction.reply({ content: 'Only server administrators can use the build command.', ephemeral: true });
            return;
        }

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId('build_modal')
            .setTitle('AI Server Building Assistant');

        // Create the text input for build request
        const buildInput = new TextInputBuilder()
            .setCustomId('build_request')
            .setLabel('Describe what you want to build')
            .setPlaceholder('e.g., "I want to create a gaming community server with voice channels and roles..."')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        // Create the text input for model selection
        const modelInput = new TextInputBuilder()
            .setCustomId('model_selection')
            .setLabel('AI Model (leave empty for default)')
            .setPlaceholder('e.g., gemma:3n:e4b, llama3:8b, phi:2.7b')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

        // Create the text input for archive options
        const archiveInput = new TextInputBuilder()
            .setCustomId('archive_option')
            .setLabel('Archive Options: delete, keep, or move')
            .setPlaceholder('delete (remove all), keep (keep existing), move (move to archive category)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

        // Add inputs to modal
        const firstActionRow = new ActionRowBuilder().addComponents(buildInput);
        const secondActionRow = new ActionRowBuilder().addComponents(modelInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(archiveInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        // Show the modal
        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction) {
        if (interaction.customId === 'build_modal') {
            await interaction.deferReply();

            const buildRequest = interaction.fields.getTextInputValue('build_request');
            const selectedModel = interaction.fields.getTextInputValue('model_selection').trim();
            const archiveOption = interaction.fields.getTextInputValue('archive_option').toLowerCase() || 'keep';

            // Validate archive option
            if (archiveOption && !['delete', 'keep', 'move'].includes(archiveOption)) {
                await interaction.editReply('Invalid archive option. Please use: delete, keep, or move');
                return;
            }

            await interaction.editReply('AI is generating your server building guide...');

            try {
                // Process images if any (from the original interaction message)
                const images = []; // Modal interactions don't have attachments
                
                const prompt = `You are an expert Discord server architect and administrator. A user wants to build the following for their Discord server:

"${buildRequest}"

Archive preference: ${archiveOption}

Please respond with ONLY a JSON object containing the server structure. Your response must be valid JSON that can be parsed.

Format:
{
  "serverName": "Server Name",
  "description": "Brief description of the server",
  "channels": [
    {
      "name": "channel-name",
      "type": "text|voice|category",
      "description": "Channel purpose",
      "parentId": "category-name-or-null"
    }
  ],
  "roles": [
    {
      "name": "role-name",
      "description": "Role purpose",
      "color": "#hex-color-or-null",
      "permissions": ["key permissions"]
    }
  ],
  "categories": [
    {
      "name": "category-name",
      "description": "Category purpose"
    }
  ],
  "steps": [
    "Step 1: Setup overview",
    "Step 2: Create categories",
    "Step 3: Create channels",
    "Step 4: Create roles",
    "Step 5: Configure permissions"
  ],
  "archiveAction": "delete|keep|move"
}

Create appropriate channels, roles, and categories for a "${buildRequest}". Make it practical and useful.`;

                // Use selected model or default
                const modelToUse = selectedModel && this.models[selectedModel] ? selectedModel : this.defaultModel;
                
                const response = await this.askLlama3(prompt, modelToUse, images);
                
                // Parse JSON response
                let serverPlan;
                try {
                    // Clean up response - remove any markdown formatting
                    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
                    serverPlan = JSON.parse(cleanResponse);
                } catch (parseError) {
                    console.error('Failed to parse AI response as JSON:', parseError);
                    await interaction.editReply('Sorry, I had trouble generating a structured server plan. Please try again.');
                    return;
                }
                
                // Create the server structure immediately
                const result = await this.createServerStructure(interaction, serverPlan, archiveOption);
                
                // Display results
                let responseMessage = `**Server Structure Created**\n\n`;
                responseMessage += `**Planned Server Name:** ${serverPlan.serverName || 'New Server'}\n`;
                responseMessage += `**Description:** ${serverPlan.description || 'No description provided'}\n\n`;
                responseMessage += `*Note: Server name and description require manual server settings changes*\n\n`;
                
                if (result.createdCategories.length > 0) {
                    responseMessage += `**Categories Created:** ${result.createdCategories.join(', ')}\n`;
                }
                
                if (result.createdChannels.length > 0) {
                    responseMessage += `**Channels Created:** ${result.createdChannels.join(', ')}\n`;
                }
                
                if (result.createdRoles.length > 0) {
                    responseMessage += `**Roles Created:** ${result.createdRoles.join(', ')}\n`;
                }
                
                if (serverPlan.steps && serverPlan.steps.length > 0) {
                    responseMessage += `\n**Setup Steps:**\n${serverPlan.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
                }
                
                await interaction.editReply(responseMessage);
                
            } catch (error) {
                console.error('Error processing build request:', error);
                await interaction.editReply('Sorry, I encountered an error processing your build request.');
            }
        }
    }

    async createServerStructure(interaction, serverPlan, archiveOption) {
        const guild = interaction.guild;
        if (!guild) {
            throw new Error('This command can only be used in a server.');
        }

        // Check bot permissions
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has('ManageChannels') || !botMember.permissions.has('ManageRoles')) {
            throw new Error('I need "Manage Channels" and "Manage Roles" permissions to create the server structure.');
        }

        const result = {
            createdCategories: [],
            createdChannels: [],
            createdRoles: [],
            archivedChannels: []
        };

        // Handle archive action first
        if (archiveOption === 'delete' || archiveOption === 'move') {
            result.archivedChannels = await this.archiveOldChannels(guild, archiveOption);
        }

        // Create categories first
        const categoryMap = {};
        if (serverPlan.categories) {
            console.log('Creating categories:', serverPlan.categories.map(c => c.name));
            for (const category of serverPlan.categories) {
                try {
                    const createdCategory = await guild.channels.create({
                        name: category.name,
                        type: 4, // Category
                        reason: `Created by AI Server Building Assistant: ${category.description || 'No description'}`
                    });
                    categoryMap[category.name] = createdCategory;
                    result.createdCategories.push(category.name);
                    console.log(`Created category: ${createdCategory.name} (ID: ${createdCategory.id})`);
                } catch (error) {
                    console.error(`Error creating category ${category.name}:`, error.message);
                }
            }
        } else {
            console.log('No categories found in server plan');
        }

        // Create roles
        if (serverPlan.roles) {
            for (const role of serverPlan.roles) {
                try {
                    const roleData = {
                        name: role.name,
                        reason: `Created by AI Server Building Assistant: ${role.description || 'No description'}`
                    };
                    
                    if (role.color && role.color !== 'null') {
                        // Convert hex color to decimal number for Discord
                        const hexColor = role.color.replace('#', '');
                        roleData.color = parseInt(hexColor, 16);
                    }
                    
                    const createdRole = await guild.roles.create(roleData);
                    result.createdRoles.push(role.name);
                } catch (error) {
                    console.error(`Error creating role ${role.name}:`, error.message);
                }
            }
        }

        // Create channels
        if (serverPlan.channels) {
            for (const channel of serverPlan.channels) {
                try {
                    let channelType = 0; // Text channel by default
                    if (channel.type === 'voice') {
                        channelType = 2; // Voice channel
                    } else if (channel.type === 'category') {
                        continue; // Categories already created
                    }

                    const channelData = {
                        name: channel.name,
                        type: channelType,
                        reason: `Created by AI Server Building Assistant: ${channel.description || 'No description'}`
                    };

                    // Set parent category if specified
                    if (channel.parentId && categoryMap[channel.parentId]) {
                        channelData.parent = categoryMap[channel.parentId].id;
                        console.log(`Setting parent for channel ${channel.name} to category ${channel.parentId} (ID: ${categoryMap[channel.parentId].id})`);
                    }

                    const createdChannel = await guild.channels.create(channelData);
                    console.log(`Created channel: ${createdChannel.name}, parent: ${createdChannel.parentId}, type: ${createdChannel.type}`);
                    result.createdChannels.push(createdChannel.name);
                } catch (error) {
                    console.error(`Error creating channel ${channel.name}:`, error.message);
                }
            }
        }

        return result;
    }

    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        
        // Store the AI response and archive option temporarily
        // In a real implementation, you'd want to store this in a database or cache
        const aiResponse = interaction.message.content.replace(/\*\*AI Server Building Guide:\*\*\n\n/, '');
        const archiveOption = 'keep'; // Default, you might want to extract this from the original interaction
        
        await this.handleChannelCreation(interaction, customId, aiResponse, archiveOption);
    }

    async addChannelCreationButtons(interaction, aiResponse, archiveOption) {
        // Create buttons for channel creation
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_channels')
                    .setLabel('Create Channels')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('1f3a7'),
                new ButtonBuilder()
                    .setCustomId('create_roles')
                    .setLabel('Create Roles')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('1f464'),
                new ButtonBuilder()
                    .setCustomId('archive_old')
                    .setLabel('Archive Old Channels')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('1f4c1')
            );

        try {
            await interaction.followUp({
                content: 'Would you like me to automatically create the suggested channels and roles?',
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error adding buttons:', error);
        }
    }

    async handleChannelCreation(interaction, action, aiResponse, archiveOption) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const guild = interaction.guild;
            if (!guild) {
                await interaction.editReply('This command can only be used in a server.');
                return;
            }

            // Check bot permissions
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has('ManageChannels') || !botMember.permissions.has('ManageRoles')) {
                await interaction.editReply('I need "Manage Channels" and "Manage Roles" permissions to create channels and roles.');
                return;
            }

            let createdChannels = [];
            let createdRoles = [];
            let archivedChannels = [];

            switch (action) {
                case 'create_channels':
                    createdChannels = await this.createChannelsFromResponse(guild, aiResponse);
                    await interaction.editReply(`Created ${createdChannels.length} channels: ${createdChannels.join(', ')}`);
                    break;
                    
                case 'create_roles':
                    createdRoles = await this.createRolesFromResponse(guild, aiResponse);
                    await interaction.editReply(`Created ${createdRoles.length} roles: ${createdRoles.join(', ')}`);
                    break;
                    
                case 'archive_old':
                    archivedChannels = await this.archiveOldChannels(guild, archiveOption);
                    await interaction.editReply(`Archived ${archivedChannels.length} channels: ${archivedChannels.join(', ')}`);
                    break;
            }

        } catch (error) {
            console.error('Error in channel creation:', error);
            await interaction.editReply('Sorry, I encountered an error while creating channels/roles.');
        }
    }

    async createChannelsFromResponse(guild, aiResponse) {
        const createdChannels = [];
        
        // Parse channel suggestions from AI response
        const channelPatterns = [
            /create.*?channel.*?called?["']([^"']+)["']/gi,
            /channel.*?named?["']([^"']+)["']/gi,
            /##?\s*(.+?)\s*\n/gi  // Headers that might be channel names
        ];

        for (const pattern of channelPatterns) {
            const matches = [...aiResponse.matchAll(pattern)];
            for (const match of matches) {
                const channelName = match[1] || match[0].replace(/[#\s]+/g, '').toLowerCase();
                
                if (channelName && !createdChannels.includes(channelName)) {
                    try {
                        // Determine channel type from name
                        let channelType = 0; // Text channel by default
                        if (channelName.includes('voice') || channelName.includes('vc') || channelName.includes('stage')) {
                            channelType = 2; // Voice channel
                        } else if (channelName.includes('stage')) {
                            channelType = 13; // Stage channel
                        }

                        const channel = await guild.channels.create({
                            name: channelName,
                            type: channelType,
                            reason: 'Created by AI Server Building Assistant'
                        });
                        
                        createdChannels.push(channel.name);
                    } catch (error) {
                        console.error(`Error creating channel ${channelName}:`, error.message);
                    }
                }
            }
        }

        return createdChannels;
    }

    async createRolesFromResponse(guild, aiResponse) {
        const createdRoles = [];
        
        // Parse role suggestions from AI response
        const rolePatterns = [
            /create.*?role.*?called?["']([^"']+)["']/gi,
            /role.*?named?["']([^"']+)["']/gi,
            /@([a-zA-Z0-9\s]+)/gi
        ];

        for (const pattern of rolePatterns) {
            const matches = [...aiResponse.matchAll(pattern)];
            for (const match of matches) {
                const roleName = match[1] || match[0].replace(/[@\s]+/g, '').trim();
                
                if (roleName && !createdRoles.includes(roleName)) {
                    try {
                        const role = await guild.roles.create({
                            name: roleName,
                            reason: 'Created by AI Server Building Assistant'
                        });
                        
                        createdRoles.push(role.name);
                    } catch (error) {
                        console.error(`Error creating role ${roleName}:`, error.message);
                    }
                }
            }
        }

        return createdRoles;
    }

    async archiveOldChannels(guild, archiveOption) {
        const archivedChannels = [];
        
        if (archiveOption === 'delete') {
            // Delete old channels (be careful with this!)
            const channels = guild.channels.cache.filter(c => c.type === 0); // Text channels only
            for (const channel of channels) {
                try {
                    await channel.delete('Archived by AI Server Building Assistant');
                    archivedChannels.push(channel.name);
                } catch (error) {
                    console.error(`Error deleting channel ${channel.name}:`, error.message);
                }
            }
        } else if (archiveOption === 'move') {
            // Create archive category and move channels
            let archiveCategory = guild.channels.cache.find(c => c.name === 'Archive' && c.type === 4);
            
            if (!archiveCategory) {
                archiveCategory = await guild.channels.create({
                    name: 'Archive',
                    type: 4, // Category
                    reason: 'Created by AI Server Building Assistant'
                });
            }

            const channels = guild.channels.cache.filter(c => c.type === 0 && c.parentId !== archiveCategory.id);
            for (const [id, channel] of channels) {
                try {
                    await channel.setParent(archiveCategory.id, 'Archived by AI Server Building Assistant');
                    archivedChannels.push(channel.name);
                } catch (error) {
                    console.error(`Error moving channel ${channel.name}:`, error.message);
                }
            }
        }

        return archivedChannels;
    }

    loadModels() {
        const modelsFile = path.join(__dirname, 'discord-models.txt');
        
        try {
            if (fs.existsSync(modelsFile)) {
                const content = fs.readFileSync(modelsFile, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                const models = {};
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && trimmedLine.includes(',')) {
                        const parts = trimmedLine.split(',');
                        if (parts.length === 2) {
                            const modelId = parts[0].trim();
                            const tokenCost = parseInt(parts[1].trim());
                            
                            if (modelId && !isNaN(tokenCost)) {
                                // Create a clean name from the model ID
                                const name = modelId.split(':').map(part => 
                                    part.charAt(0).toUpperCase() + part.slice(1)
                                ).join(' ');
                                
                                // Create suffix from full model ID
                                const suffix = modelId.includes(':') ? `--${modelId}` : null;
                                
                                models[modelId] = {
                                    name: name,
                                    suffix: suffix,
                                    tokens: tokenCost
                                };
                            }
                        }
                    }
                }
                
                if (Object.keys(models).length > 0) {
                    console.log(`Loaded ${Object.keys(models).length} models from models.txt`);
                    return models;
                }
            }
        } catch (error) {
            console.error('Error loading models from models.txt:', error);
        }
        
        // Fallback to default models if file doesn't exist or has errors
        console.log('Using default model configuration');
        return {
            'llama3:8b': {
                name: 'Llama 3 8B',
                suffix: null,
                tokens: 1
            },
            'llama3:8b-instruct': {
                name: 'Llama 3 8B Instruct',
                suffix: '--8b-instruct',
                tokens: 2
            },
            'llama3:70b': {
                name: 'Llama 3 70B',
                suffix: '--70b',
                tokens: 4
            },
            'codellama:7b': {
                name: 'Code Llama 7B',
                suffix: '--7b',
                tokens: 2
            },
            'mistral:7b': {
                name: 'Mistral 7B',
                suffix: '--7b',
                tokens: 2
            },
            'qwen:7b': {
                name: 'Qwen 7B',
                suffix: '--7b',
                tokens: 2
            },
            'phi:2.7b': {
                name: 'Phi 2.7B',
                suffix: '--2.7b',
                tokens: 1
            },
            'gemma:7b': {
                name: 'Gemma 7B',
                suffix: '--7b',
                tokens: 2
            }
        };
    }

    async checkOllamaConnection() {
        try {
            const options = {
                hostname: 'localhost',
                port: 11434,
                path: '/api/tags',
                method: 'GET',
                timeout: 3000
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const response = JSON.parse(data);
                            if (response.models && response.models.length > 0) {
                                const wasDisconnected = !this.ollamaConnected;
                                this.ollamaConnected = true;
                                
                                if (wasDisconnected) {
                                    console.log('Ollama reconnected! Found', response.models.length, 'models');
                                    this.updateBotStatus('Nimbus AI');
                                }
                            } else {
                                this.handleOllamaDisconnected();
                            }
                        } catch (parseError) {
                            console.log('Invalid Ollama response format');
                            this.handleOllamaDisconnected();
                        }
                    } else {
                        this.handleOllamaDisconnected();
                    }
                });
            });
            
            req.on('error', (error) => {
                this.handleOllamaDisconnected();
            });
            
            req.on('timeout', () => {
                req.destroy();
                this.handleOllamaDisconnected();
            });
            
            req.end();
            
        } catch (error) {
            this.handleOllamaDisconnected();
        }
    }

    handleOllamaDisconnected() {
        if (this.ollamaConnected) {
            console.log('Ollama disconnected!');
            this.ollamaConnected = false;
            this.updateBotStatus('Nimbus AI - Offline');
        }
        // Don't spam the console if already disconnected
    }

    async updateBotStatus(status) {
        try {
            // Prevent duplicate status updates
            if (this.lastStatusUpdate === status) {
                return;
            }
            
            if (this.clientReady && this.client.user) {
                await this.client.user.setActivity(status, { type: 'WATCHING' });
                console.log(`Bot status updated to: ${status}`);
                this.lastStatusUpdate = status;
            } else {
                console.log(`Client not ready, status update queued: ${status}`);
                this.lastStatusUpdate = status;
            }
        } catch (error) {
            console.error('Failed to update bot status:', error);
        }
    }

    loadBannedUsers() {
        try {
            if (fs.existsSync(this.bannedUsersFile)) {
                return JSON.parse(fs.readFileSync(this.bannedUsersFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading banned users:', error);
        }
        return [];
    }

    saveBannedUsers() {
        try {
            fs.writeFileSync(this.bannedUsersFile, JSON.stringify(this.bannedUsers, null, 2));
        } catch (error) {
            console.error('Error saving banned users:', error);
        }
    }

    detectModel(question) {
        console.log(`Checking for model suffixes in: "${question}"`);
        
        for (const [modelId, config] of Object.entries(this.models)) {
            if (config.suffix && question.includes(config.suffix)) {
                console.log(`Model suffix detected: "${config.suffix}" -> ${modelId} (${config.name})`);
                return {
                    model: modelId,
                    config: config,
                    cleanQuestion: question.replace(config.suffix, '').trim()
                };
            }
        }
        
        console.log(`Selected model: ${this.defaultModel} (${this.models[this.defaultModel].name})`);
        
        // Default model
        return {
            model: this.defaultModel,
            config: this.models[this.defaultModel],
            cleanQuestion: question
        };
    }

    logPrompt(userId, username, question, response, success, tokensUsed) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                userId: userId,
                username: username,
                question: question,
                response: response,
                success: success,
                tokensUsed: tokensUsed
            };
            
            let logs = [];
            if (fs.existsSync(this.promptLogFile)) {
                logs = JSON.parse(fs.readFileSync(this.promptLogFile, 'utf8'));
            }
            
            logs.push(logEntry);
            
            // Keep only last 1000 entries
            if (logs.length > 1000) {
                logs = logs.slice(-1000);
            }
            
            fs.writeFileSync(this.promptLogFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error logging prompt:', error);
        }
    }

    loadProcessingMessages() {
        try {
            if (fs.existsSync(this.processingMessagesFile)) {
                const messages = JSON.parse(fs.readFileSync(this.processingMessagesFile, 'utf8'));
                return Array.isArray(messages) ? messages : [
                    "Processing your question.",
                    "Thinking about your question...",
                    "Consulting the AI...",
                    "Analyzing your query...",
                    "Generating response...",
                    "Almost there...",
                    "Putting it all together...",
                    "Finalizing answer..."
                ];
            }
        } catch (error) {
            console.error('Error loading processing messages:', error);
        }
        
        // Default messages if file doesn't exist
        return [
            "Processing your question.",
            "Thinking about your question...",
            "Consulting the AI...",
            "Analyzing your query...",
            "Generating response...",
            "Almost there...",
            "Putting it all together...",
            "Finalizing answer..."
        ];
    }

    cleanupCooldowns() {
        const now = Date.now();
        const cutoffTime = now - (this.requestCooldown * 2); // Remove entries older than 2x cooldown
        
        for (const [userId, lastRequest] of this.userLastRequest.entries()) {
            if (lastRequest < cutoffTime) {
                this.userLastRequest.delete(userId);
            }
        }
    }
    
    start() {
        this.client.login(this.token).catch(error => {
            console.error('Discord login error:', error);
            if (error.code === 'TOKEN_INVALID') {
                console.error('❌ Invalid Discord bot token. Please check your .env file.');
            } else if (error.code === 'DISALLOWED_INTENTS') {
                console.error('❌ Disallowed intents. Please check bot permissions in Discord Developer Portal.');
            } else {
                console.error('❌ Discord connection error:', error.message);
            }
        });
        
        // Add error handler for client
        this.client.on('error', error => {
            console.error('Discord client error:', error);
        });
        
        // Add warning handler
        this.client.on('warn', warning => {
            console.warn('Discord client warning:', warning);
        });
    }
}

module.exports = TokenDiscordBot;
