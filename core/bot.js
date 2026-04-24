const { Client, GatewayIntentBits, Events: DiscordEvents, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const AddonRegistry = require('./registry');
const ConfigManager = require('./config');
const OllamaService = require('./ollama');
const { eventBus, Events } = require('./events');

class TokenDiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        // Core services
        this.config = new ConfigManager(this);
        this.ollama = new OllamaService(this);
        this.registry = new AddonRegistry(this);
        this.logger = console;
        
        // Bot state
        this.ready = false;
        this.commands = new Map();
        this.slashCommands = [];
        
        // Core data files
        this.tokensFile = path.join(__dirname, '..', 'tokens.json');
        this.bannedUsersFile = path.join(__dirname, '..', 'banned-users.json');
        this.promptLogFile = path.join(__dirname, '..', 'prompt-log.json');
        this.processingMessagesFile = path.join(__dirname, '..', 'processing-messages.json');
        
        // Core data
        this.tokens = this.loadTokens();
        this.bannedUsers = this.loadBannedUsers();
        this.processingMessages = this.loadProcessingMessages();
        
        // Performance tracking
        this.userLastRequest = new Map();
        this.globalProcessing = new Set();
        
        // Debug info storage
        this.debugMessages = new Map();
        
        this.setupEventHandlers();
    }

    // Start the bot
    async start() {
        try {
            // Validate configuration
            const configErrors = this.config.validateConfig();
            if (configErrors.length > 0) {
                this.logger.error('[Bot] Configuration errors:', configErrors);
                throw new Error('Invalid configuration: ' + configErrors.join(', '));
            }
            
            // Load addons
            await this.registry.loadAllAddons();
            
            // Initialize Ollama service
            await this.ollama.initialize();
            
            // Login to Discord
            const token = this.config.get('bot.token');
            if (!token) {
                throw new Error('Discord bot token not configured');
            }
            
            await this.client.login(token);
            
        } catch (error) {
            this.logger.error('[Bot] Failed to start:', error);
            throw error;
        }
    }

    // Setup Discord event handlers
    setupEventHandlers() {
        // Bot ready
        this.client.once(DiscordEvents.ClientReady, async (readyClient) => {
            this.ready = true;
            this.client = readyClient;
            this.logger.log(`[Bot] Logged in as ${readyClient.user.tag}`);
            
            // Register slash commands after client is ready
            await this.registerSlashCommands();
            
            // Register commands with Discord
            const rest = new REST({ version: '10' }).setToken(this.config.get('bot.token'));
            
            try {
                await rest.put(
                    Routes.applicationCommands(this.client.user.id),
                    { body: this.slashCommands }
                );
                
                this.logger.log(`[Bot] Registered ${this.slashCommands.length} slash commands`);
            } catch (error) {
                this.logger.error('[Bot] Error registering slash commands:', error);
            }
            
            // Emit bot ready event
            eventBus.emit(Events.BOT_READY, {
                user: readyClient.user,
                guilds: readyClient.guilds.cache.size
            }, 'bot');
        });

        // Message received
        this.client.on(DiscordEvents.MessageCreate, async (message) => {
            this.logger.log(`[Bot] Message received: "${message.content}" from ${message.author.tag}`);
            
            // Ignore bot messages
            if (message.author.bot) {
                this.logger.log('[Bot] Ignoring bot message');
                return;
            }
            
            // Ignore banned users
            if (this.bannedUsers.includes(message.author.id)) {
                this.logger.log('[Bot] Ignoring banned user');
                return;
            }
            
            // Emit message received event
            eventBus.emit(Events.MESSAGE_RECEIVED, {
                message,
                author: message.author,
                channel: message.channel,
                guild: message.guild
            }, 'bot');
            
            // Handle command
            const handled = await this.registry.handleMessage(message);
            this.logger.log(`[Bot] Command handled: ${handled}`);
            
            // Handle AI chat with model suffix if not a command
            if (!handled && !message.content.startsWith('>')) {
                this.logger.log(`[Bot] Handling AI chat for: "${message.content}"`);
                try {
                    await this.handleAIChat(message);
                    this.logger.log('[Bot] AI chat handled successfully');
                } catch (error) {
                    this.logger.error('[Bot] Error in AI chat:', error);
                }
            }
            
            // Emit message processed event
            eventBus.emit(Events.MESSAGE_PROCESSED, {
                message,
                handled
            }, 'bot');
        });

        // Guild member joined
        this.client.on(DiscordEvents.GuildMemberAdd, (member) => {
            eventBus.emit(Events.USER_JOINED, {
                user: member.user,
                guild: member.guild
            }, 'bot');
        });

        // Guild member left
        this.client.on(DiscordEvents.GuildMemberRemove, (member) => {
            eventBus.emit(Events.USER_LEFT, {
                user: member.user,
                guild: member.guild
            }, 'bot');
        });

        // Slash command interactions
        this.client.on(DiscordEvents.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;
            
            await this.handleSlashCommand(interaction);
        });

        // Error handling
        this.client.on(DiscordEvents.Error, (error) => {
            this.logger.error('[Bot] Discord client error:', error);
            eventBus.emit(Events.BOT_ERROR, {
                error,
                timestamp: Date.now()
            }, 'bot');
        });

        // Process errors
        process.on('uncaughtException', (error) => {
            this.logger.error('[Bot] Uncaught exception:', error);
            eventBus.emit(Events.BOT_ERROR, {
                error,
                type: 'uncaughtException'
            }, 'bot');
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('[Bot] Unhandled rejection:', reason);
            eventBus.emit(Events.BOT_ERROR, {
                error: reason,
                type: 'unhandledRejection',
                promise
            }, 'bot');
        });
    }

    // Register slash commands
    async registerSlashCommands() {
        // Build slash commands from all addons
        const commands = this.registry.getAllCommands();
        
        // Add addon commands
        for (const command of commands) {
            if (command && command.type === 'slash') {
                this.slashCommands.push(
                    new SlashCommandBuilder()
                        .setName(command.name)
                        .setDescription(command.description)
                        .toJSON()
                );
            }
        }

        // Add core commands
        this.slashCommands.push(
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show help information')
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('addons')
                .setDescription('Manage addons')
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('tokens')
                .setDescription('Check your token balance')
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('models')
                .setDescription('Show available AI models')
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('debug')
                .setDescription('Debug information for AI responses')
                .addStringOption(option => 
                    option.setName('id')
                        .setDescription('Message ID to debug')
                        .setRequired(true))
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('stop')
                .setDescription('Stop the bot gracefully')
                .toJSON()
        );
    }

    // Handle slash command interactions
    async handleSlashCommand(interaction) {
        const { commandName } = interaction;
        
        try {
            switch (commandName) {
                case 'help':
                    await this.handleHelpCommand(interaction);
                    break;
                    
                case 'addons':
                    await this.handleAddonsCommand(interaction);
                    break;
                    
                case 'tokens':
                    await this.handleTokensCommand(interaction);
                    break;
                    
                case 'models':
                    await this.handleModelsCommand(interaction);
                    break;
                    
                case 'debug':
                    await this.handleDebugCommand(interaction);
                    break;
                    
                case 'stop':
                    await this.handleStopCommand(interaction);
                    break;
                    
                default:
                    // Let addons handle their own slash commands
                    const handled = await this.registry.handleSlashCommand(interaction);
                    if (!handled) {
                        await interaction.reply('Unknown command.');
                    }
            }
        } catch (error) {
            this.logger.error(`[Bot] Error handling slash command ${commandName}:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while executing this command.',
                    ephemeral: true
                });
            } else if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred while executing this command.'
                });
            }
        }
    }

    // Handle help command
    async handleHelpCommand(interaction) {
        await interaction.deferReply();
        
        const commands = this.registry.getAllCommands();
        const enabledAddons = this.registry.getEnabledAddons();
        
        const embed = {
            title: 'Bot Help',
            color: 0x0099FF,
            description: `**Prefix:** ${this.config.get('bot.prefix')}\n**Enabled Addons:** ${enabledAddons.length}`,
            fields: [],
            footer: {
                text: `Bot v${this.config.get('bot.version')} | Your tokens: ${this.getUserTokens(interaction.user.id)}`
            }
        };

        // Group commands by category
        const commandsByCategory = {};
        for (const command of commands) {
            if (!commandsByCategory[command.category]) {
                commandsByCategory[command.category] = [];
            }
            commandsByCategory[command.category].push(command);
        }

        // Add command categories
        for (const [category, categoryCommands] of Object.entries(commandsByCategory)) {
            const commandList = categoryCommands
                .map(cmd => `\`${this.config.get('bot.prefix')}${cmd.name}\` - ${cmd.description}`)
                .join('\n');
                
            embed.fields.push({
                name: category.charAt(0).toUpperCase() + category.slice(1),
                value: commandList,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }

    // Handle addons command
    async handleAddonsCommand(interaction) {
        await interaction.deferReply();
        
        const enabledAddons = this.registry.getEnabledAddons();
        const disabledAddons = this.registry.getDisabledAddons();
        
        const embed = {
            title: 'Addon Management',
            color: 0x0099FF,
            description: `**Enabled Addons:** ${enabledAddons.length}\n**Disabled Addons:** ${disabledAddons.length}`,
            fields: []
        };

        // Add enabled addons
        if (enabledAddons.length > 0) {
            const enabledList = enabledAddons.map(addon => `✅ **${addon.name}** v${addon.version}`).join('\n');
            embed.fields.push({
                name: '🟢 Enabled Addons',
                value: enabledList,
                inline: false
            });
        }
        
        // Add disabled addons
        if (disabledAddons.length > 0) {
            const disabledList = disabledAddons.map(addon => `❌ **${addon.name}** v${addon.version}`).join('\n');
            embed.fields.push({
                name: '🔴 Disabled Addons',
                value: disabledList,
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
    }

    // Handle models command
    async handleModelsCommand(interaction) {
        await interaction.deferReply();
        
        try {
            // Get actual models from Ollama
            const models = await this.getAvailableModels();
            
            // Get current model costs from discord-models.txt
            const modelCosts = this.getModelCosts();
            
            // Get token settings
            const defaultTokens = this.config.get('tokens.defaultTokens');
            const requestCooldown = this.config.get('tokens.requestCooldown');
            
            const embed = {
                title: '🤖 Available AI Models & Configuration',
                color: 0x0099FF,
                description: `Found ${models.length} models. Edit costs in discord-models.txt or use model suffixes in your messages.`,
                fields: [],
                footer: {
                    text: `Default: ${defaultTokens} tokens | Cooldown: ${requestCooldown}ms`
                },
                timestamp: new Date().toISOString()
            };
            
            // Create editable table format
            let tableContent = "```\n";
            tableContent += "│ Model │ Size │ Cost │ Description │ Suffix\n";
            tableContent += "──────┼─────┼──────────────┼────────\n";
            
            for (const model of models) {
                const cost = String(modelCosts[model.name] || "1");
                const size = model.size ? String(model.size) : "Unknown";
                const suffix = String(model.name);
                const modelName = String(model.name);
                
                tableContent += `│ ${modelName.padEnd(15)} │ ${size.padEnd(12)} │ ${cost.padEnd(5)} │ ${suffix.padEnd(15)} │\n`;
            }
            
            tableContent += "```\n\n";
            tableContent += "**How to Edit Costs:**\n";
            tableContent += "Edit `discord-models.txt` with format: `model:release,cost`\n";
            tableContent += "Example: `gemma3n:e4b,2`\n\n";
            tableContent += "**Token Settings:**\n";
            tableContent += `Default tokens per request: ${defaultTokens}\n`;
            tableContent += `Request cooldown: ${requestCooldown}ms`;
            
            embed.fields.push({
                name: '📊 Model Configuration Table',
                value: tableContent,
                inline: false
            });
            
            embed.fields.push({
                name: '💰 Token Settings',
                value: `• Default: ${defaultTokens} tokens per request\n• Cooldown: ${requestCooldown}ms between requests`,
                inline: false
            });
            
            embed.fields.push({
                name: '📝 Usage Examples',
                value: '• `What is 2+2? --gemma3n:e4b`\n• `Explain physics --mistrallite:7b`\n• `Write code --codellama:13b`',
                inline: false
            });
            
            embed.fields.push({
                name: '⚙️ Edit Instructions',
                value: '1. Edit `discord-models.txt`\n2. Format: `model:release,cost`\n3. Restart bot to apply changes',
                inline: false
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            this.logger.error('[Bot] Error fetching models:', error);
            await interaction.editReply({
                content: 'Failed to fetch available models. Please check if Ollama is running.',
                ephemeral: true
            });
        }
    }

    // Get model costs from discord-models.txt
    getModelCosts() {
        try {
            const modelsFile = path.join(__dirname, '..', 'discord-models.txt');
            if (fs.existsSync(modelsFile)) {
                const content = fs.readFileSync(modelsFile, 'utf8');
                const costs = {};
                
                content.split('\n').forEach(line => {
                    const parts = line.split(',');
                    if (parts.length >= 2) {
                        const modelName = parts[0].trim();
                        const cost = parts[1].trim();
                        if (cost.match('^\d+$')) {
                            costs[modelName] = parseInt(cost);
                        }
                    }
                });
                return costs;
            }
        } catch (error) {
            this.logger.error('[Bot] Error loading model costs:', error);
            return {};
        }
    }

    // Get available models from Ollama
    async getAvailableModels() {
        return new Promise((resolve, reject) => {
            const host = this.config.get('ollama.host', '127.0.0.1');
            const port = this.config.get('ollama.port', 11434);
            
            const options = {
                hostname: host,
                port: port,
                path: '/api/tags',
                method: 'GET',
                timeout: 5000
            };
            
            const req = require('http').request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const response = JSON.parse(data);
                            resolve(response.models || []);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    // Handle debug command
    async handleDebugCommand(interaction) {
        const messageId = interaction.options.getString('id');
        
        // Only bot owner can use debug command
        if (interaction.user.id !== this.config.get('bot.ownerId')) {
            await interaction.reply({
                content: 'Only the bot owner can use debug commands.',
                ephemeral: true
            });
            return;
        }
        
        const debugInfo = this.getDebugInfo(messageId);
        
        if (!debugInfo) {
            await interaction.reply({
                content: `No debug information found for message ID: ${messageId}`,
                ephemeral: true
            });
            return;
        }
        
        const embed = {
            title: '🔍 Debug Information',
            color: 0xFF6B6B,
            fields: [
                {
                    name: '👤 User',
                    value: `**ID:** ${debugInfo.userId}\n**Username:** ${debugInfo.username}`,
                    inline: true
                },
                {
                    name: '🤖 Model',
                    value: debugInfo.model,
                    inline: true
                },
                {
                    name: '📝 Question',
                    value: debugInfo.question.length > 100 ? 
                        debugInfo.question.substring(0, 100) + '...' : 
                        debugInfo.question,
                    inline: false
                },
                {
                    name: '💬 Response',
                    value: debugInfo.response.length > 200 ? 
                        debugInfo.response.substring(0, 200) + '...' : 
                        debugInfo.response,
                    inline: false
                },
                {
                    name: '📍 Location',
                    value: `**Guild:** ${debugInfo.guildId || 'DM'}\n**Channel:** ${debugInfo.channelId}`,
                    inline: true
                },
                {
                    name: '⏰ Time',
                    value: new Date(debugInfo.timestamp).toLocaleString(),
                    inline: true
                }
            ],
            footer: {
                text: `Message ID: ${messageId}`
            },
            timestamp: new Date().toISOString()
        };
        
        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    // Handle AI chat with model suffix parsing
    async handleAIChat(message) {
        const content = message.content.trim();
        
        // Parse model suffix
        const { question, model } = this.parseModelSuffix(content);
        
        this.logger.log(`[Bot] AI Chat - Question: "${question}", Model: "${model}"`);
        
        try {
            this.logger.log(`[Bot] Using Ollama handleChat method`);
            
            // Use Ollama's handleChat method which handles everything including "Thinking..."
            const response = await this.ollama.handleChat(message, question, model);
            
            this.logger.log(`[Bot] Ollama handleChat completed, response: "${response.substring(0, 50)}..."`);
            
            // Generate unique message ID
            const messageId = this.generateMessageId();
            
            // Store debug info
            this.storeDebugInfo(messageId, {
                userId: message.author.id,
                username: message.author.tag,
                question,
                model,
                response,
                timestamp: Date.now(),
                guildId: message.guild?.id,
                channelId: message.channel.id
            });
            
            this.logger.log(`[Bot] AI chat completed successfully using Ollama handleChat`);
            
        } catch (error) {
            this.logger.error('[Bot] Error in AI chat:', error);
            await message.reply('Sorry, I had trouble processing your request. Please try again.');
        }
    }

    // Parse model suffix from message
    parseModelSuffix(content) {
        const modelSuffixRegex = /\s*--([a-zA-Z0-9:.-]+)\s*$/;
        const match = content.match(modelSuffixRegex);
        
        if (match) {
            const model = match[1];
            const question = content.replace(modelSuffixRegex, '').trim();
            return { question, model };
        }
        
        // Default model if no suffix
        return { 
            question: content, 
            model: this.config.get('ollama.defaultModel') || 'gemma3n:e4b'
        };
    }

    // Get random processing message
    getRandomProcessingMessage() {
        if (this.processingMessages && this.processingMessages.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.processingMessages.length);
            const message = this.processingMessages[randomIndex];
            this.logger.log(`[Bot] Selected processing message: "${message}"`);
            return message;
        }
        this.logger.log('[Bot] Using default processing message');
        return "Processing your request...";
    }

    // Get AI response using Ollama with internet access
    async getAIResponse(question, model) {
        this.logger.log(`[Bot] getAIResponse called with question: "${question}", model: "${model}"`);
        
        try {
            // Check if question needs internet access
            const needsInternet = this.needsInternetAccess(question);
            this.logger.log(`[Bot] Internet access needed: ${needsInternet}`);
            
            if (needsInternet) {
                this.logger.log(`[Bot] Question needs internet access: ${question}`);
                
                // Get internet search results
                const searchResults = await this.getInternetSearchResults(question);
                this.logger.log(`[Bot] Search results received: ${searchResults.substring(0, 100)}...`);
                
                // Create enhanced question with internet context
                const enhancedQuestion = `Based on the following internet search results, please answer: "${question}"\n\nSearch results:\n${searchResults}`;
                
                this.logger.log(`[Bot] Calling Ollama with internet context`);
                
                // Use Ollama with internet context
                const response = await this.ollama.askOllama(enhancedQuestion, model);
                
                this.logger.log(`[Bot] Ollama response received with internet context`);
                
                // Add internet attribution
                return `${response}\n\n*(Information sourced from internet search)*`;
            } else {
                this.logger.log(`[Bot] Calling Ollama normally for question: "${question}" with model: "${model}"`);
                
                // Use Ollama normally for non-internet questions
                const response = await this.ollama.askOllama(question, model);
                
                this.logger.log(`[Bot] Ollama response received normally: "${response.substring(0, 50)}..."`);
                return response;
            }
        } catch (error) {
            this.logger.error('[Bot] Error getting AI response:', error);
            return `Sorry, I had trouble processing your request with ${model}. Error: ${error.message}`;
        }
    }

    // Check if question needs internet access
    needsInternetAccess(question) {
        const internetKeywords = [
            'what is', 'who is', 'when did', 'where is', 'how many', 'current', 'latest', 'news',
            'weather', 'price', 'stock', 'today', 'yesterday', 'recent', 'search', 'find',
            'tell me about', 'explain', 'define', 'information about', 'what happened'
        ];
        
        const lowerQuestion = question.toLowerCase();
        return internetKeywords.some(keyword => lowerQuestion.includes(keyword));
    }

    // Get internet search results
    async getInternetSearchResults(query) {
        try {
            // Use internet-access addon to search
            const internetAddon = this.registry.getAddon('internet-access');
            if (internetAddon && internetAddon.enabled) {
                const searchResult = await internetAddon.searchDuckDuckGo(query);
                
                if (searchResult && searchResult.AbstractText) {
                    // Format the search result
                    return `Search result for "${query}":\n\n${searchResult.AbstractText}\n\nSource: DuckDuckGo`;
                } else {
                    return `No results found for "${query}"`;
                }
            } else {
                return "Internet access addon is not available.";
            }
        } catch (error) {
            this.logger.error('[Bot] Error getting internet results:', error);
            return "Failed to get internet search results.";
        }
    }

    // Generate unique message ID
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    // Store debug info
    storeDebugInfo(messageId, info) {
        this.debugMessages.set(messageId, info);
        
        // Clean up old debug messages (keep last 100)
        if (this.debugMessages.size > 100) {
            const oldestKey = this.debugMessages.keys().next().value;
            this.debugMessages.delete(oldestKey);
        }
    }

    // Get debug info
    getDebugInfo(messageId) {
        return this.debugMessages.get(messageId);
    }

    // Enable addon
    async enableAddon(interaction) {
        const addonName = interaction.options.getString('addon');
        
        // Check if user is bot owner
        if (interaction.user.id !== this.config.get('bot.ownerId')) {
            await interaction.reply('Only the bot owner can manage addons.');
            return;
        }
        
        const success = await this.registry.enableAddon(addonName);
        
        if (success) {
            this.config.setAddonEnabled(addonName, true);
            await interaction.reply(`Addon ${addonName} has been enabled.`);
        } else {
            await interaction.reply(`Failed to enable addon ${addonName}.`);
        }
    }

    // Disable addon
    async disableAddon(interaction) {
        const addonName = interaction.options.getString('addon');
        
        // Check if user is bot owner
        if (interaction.user.id !== this.config.get('bot.ownerId')) {
            await interaction.reply('Only the bot owner can manage addons.');
            return;
        }
        
        const success = await this.registry.disableAddon(addonName);
        
        if (success) {
            this.config.setAddonEnabled(addonName, false);
            await interaction.reply(`Addon ${addonName} has been disabled.`);
        } else {
            await interaction.reply(`Failed to disable addon ${addonName}.`);
        }
    }

    // Handle tokens command
    async handleTokensCommand(interaction) {
        const tokens = this.getUserTokens(interaction.user.id);
        
        const embed = {
            title: 'Token Balance',
            color: 0x0099FF,
            description: `You have **${tokens}** tokens.`,
            fields: [
                {
                    name: 'How to earn tokens',
                    value: 'Tokens are awarded by the bot owner. Contact them for more tokens.',
                    inline: false
                }
            ],
            footer: {
                text: `Default: ${this.config.get('tokens.defaultTokens')} tokens | Cooldown: ${this.config.get('tokens.requestCooldown')}ms`
            }
        };

        await interaction.reply({ embeds: [embed] });
    }

    // Register a command (for addons)
    registerCommand(name, addon, command) {
        this.commands.set(name, { addon, ...command });
    }

    // Unregister a command
    unregisterCommand(name) {
        return this.commands.delete(name);
    }

    // Get user tokens
    getUserTokens(userId) {
        if (!this.tokens[userId]) {
            this.tokens[userId] = this.config.get('tokens.defaultTokens');
            this.saveTokens();
        }
        return this.tokens[userId];
    }

    // Add user tokens
    addUserTokens(userId, amount) {
        if (!this.tokens[userId]) {
            this.tokens[userId] = this.config.get('tokens.defaultTokens');
        }
        this.tokens[userId] += amount;
        this.saveTokens();
        
        eventBus.emit(Events.TOKENS_ADDED, {
            userId,
            amount,
            newBalance: this.tokens[userId]
        }, 'bot');
    }

    // Remove user tokens
    removeUserTokens(userId, amount) {
        if (!this.tokens[userId]) {
            this.tokens[userId] = this.config.get('tokens.defaultTokens');
        }
        this.tokens[userId] = Math.max(0, this.tokens[userId] - amount);
        this.saveTokens();
        
        eventBus.emit(Events.TOKENS_REMOVED, {
            userId,
            amount,
            newBalance: this.tokens[userId]
        }, 'bot');
    }

    // Use user tokens
    useUserTokens(userId, amount) {
        if (this.getUserTokens(userId) >= amount) {
            this.removeUserTokens(userId, amount);
            
            eventBus.emit(Events.TOKENS_USED, {
                userId,
                amount,
                newBalance: this.tokens[userId]
            }, 'bot');
            
            return true;
        }
        return false;
    }

    // Load tokens from file
    loadTokens() {
        try {
            if (fs.existsSync(this.tokensFile)) {
                return JSON.parse(fs.readFileSync(this.tokensFile, 'utf8'));
            }
        } catch (error) {
            this.logger.error('[Bot] Error loading tokens:', error);
        }
        return {};
    }

    // Save tokens to file
    saveTokens() {
        try {
            fs.writeFileSync(this.tokensFile, JSON.stringify(this.tokens, null, 2));
        } catch (error) {
            this.logger.error('[Bot] Error saving tokens:', error);
        }
    }

    // Load banned users from file
    loadBannedUsers() {
        try {
            if (fs.existsSync(this.bannedUsersFile)) {
                return JSON.parse(fs.readFileSync(this.bannedUsersFile, 'utf8'));
            }
        } catch (error) {
            this.logger.error('[Bot] Error loading banned users:', error);
        }
        return [];
    }

    // Load processing messages from file
    loadProcessingMessages() {
        try {
            if (fs.existsSync(this.processingMessagesFile)) {
                const messages = JSON.parse(fs.readFileSync(this.processingMessagesFile, 'utf8'));
                this.logger.log(`[Bot] Loaded ${messages.length} processing messages from file`);
                this.logger.log(`[Bot] Processing messages: ${JSON.stringify(messages.slice(0, 3))}`);
                return messages;
            }
        } catch (error) {
            this.logger.error('[Bot] Error loading processing messages:', error);
        }
        this.logger.log('[Bot] Using default processing messages');
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

    // Save banned users to file
    saveBannedUsers() {
        try {
            fs.writeFileSync(this.bannedUsersFile, JSON.stringify(this.bannedUsers, null, 2));
        } catch (error) {
            this.logger.error('[Bot] Error saving banned users:', error);
        }
    }

    // Ban user
    banUser(userId) {
        if (!this.bannedUsers.includes(userId)) {
            this.bannedUsers.push(userId);
            this.saveBannedUsers();
            
            eventBus.emit(Events.USER_BANNED, {
                userId,
                timestamp: Date.now()
            }, 'bot');
            
            return true;
        }
        return false;
    }

    // Unban user
    unbanUser(userId) {
        const index = this.bannedUsers.indexOf(userId);
        if (index > -1) {
            this.bannedUsers.splice(index, 1);
            this.saveBannedUsers();
            
            eventBus.emit(Events.USER_UNBANNED, {
                userId,
                timestamp: Date.now()
            }, 'bot');
            
            return true;
        }
        return false;
    }

    // Check if user is banned
    isUserBanned(userId) {
        return this.bannedUsers.includes(userId);
    }

    // Get bot owner ID
    get ownerId() {
        return this.config.get('bot.ownerId');
    }

    // Stop the bot
    async stop() {
        this.logger.log('[Bot] Shutting down...');
        
        // Emit shutdown event
        eventBus.emit(Events.BOT_SHUTDOWN, {
            timestamp: Date.now()
        }, 'bot');
        
        // Disable all addons
        for (const addon of this.registry.addons.values()) {
            await addon.disable();
        }

        // Stop Ollama service
        await this.ollama.stop();
        
        // Destroy Discord client
        this.client.destroy();
        
        this.ready = false;
        this.logger.log('[Bot] Shutdown complete');
    }

    // Handle stop command
    async handleStopCommand(interaction) {
        if (interaction.user.id !== this.config.get('bot.ownerId')) {
            await interaction.reply({
                content: 'Only the bot owner can stop the bot.',
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: 'Shutting down bot gracefully...'
        });

        this.logger.log('[Bot] Stop command received, shutting down...');
        await this.stop();
        
        // Exit after a short delay to allow reply to be sent
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }

    // Split message into chunks for Discord
    splitMessage(text, maxLength = 1900) {
        if (text.length <= maxLength) return [text];
        
        const chunks = [];
        let current = '';
        
        const lines = text.split('\n');
        for (const line of lines) {
            if (current.length + line.length + 1 > maxLength) {
                if (current.length > 0) {
                    chunks.push(current);
                    current = '';
                }
                
                // If a single line is too long, split it character by character
                if (line.length > maxLength) {
                    let remainingLine = line;
                    while (remainingLine.length > 0) {
                        chunks.push(remainingLine.substring(0, maxLength));
                        remainingLine = remainingLine.substring(maxLength);
                    }
                } else {
                    current = line + '\n';
                }
            } else {
                current += line + '\n';
            }
        }
        
        if (current.length > 0) {
            chunks.push(current);
        }
        
        return chunks;
    }
}

module.exports = TokenDiscordBot;
