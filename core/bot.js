const { Client, GatewayIntentBits, Events: DiscordEvents, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const AddonRegistry = require('./registry');
const ConfigManager = require('./config');
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
        
        // Core data
        this.tokens = this.loadTokens();
        this.bannedUsers = this.loadBannedUsers();
        
        // Performance tracking
        this.userLastRequest = new Map();
        this.globalProcessing = new Set();
        
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
            
            // Register slash commands
            await this.registerSlashCommands();
            
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
        this.client.once(DiscordEvents.ClientReady, (readyClient) => {
            this.ready = true;
            this.client = readyClient;
            this.logger.log(`[Bot] Logged in as ${readyClient.user.tag}`);
            
            // Emit bot ready event
            eventBus.emit(Events.BOT_READY, {
                user: readyClient.user,
                guilds: readyClient.guilds.cache.size
            }, 'bot');
        });

        // Message received
        this.client.on(DiscordEvents.MessageCreate, async (message) => {
            // Ignore bot messages
            if (message.author.bot) return;
            
            // Ignore banned users
            if (this.bannedUsers.includes(message.author.id)) return;
            
            // Emit message received event
            eventBus.emit(Events.MESSAGE_RECEIVED, {
                message,
                author: message.author,
                channel: message.channel,
                guild: message.guild
            }, 'bot');
            
            // Handle command
            const handled = await this.registry.handleMessage(message);
            
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
        
        // Add core commands
        this.slashCommands.push(
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show help information')
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('addons')
                .setDescription('Manage addons')
                .addSubcommand(subcommand =>
                    subcommand.setName('list').setDescription('List all addons')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('enable').setDescription('Enable an addon')
                    .addStringOption(option =>
                        option.setName('addon').setDescription('Addon name').setRequired(true)
                    )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('disable').setDescription('Disable an addon')
                    .addStringOption(option =>
                        option.setName('addon').setDescription('Addon name').setRequired(true)
                    )
                )
                .toJSON(),
                
            new SlashCommandBuilder()
                .setName('tokens')
                .setDescription('Check your token balance')
                .toJSON()
        );

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
                    
                default:
                    // Let addons handle their own slash commands
                    const handled = await this.registry.handleSlashCommand(interaction);
                    if (!handled) {
                        await interaction.reply('Unknown command.');
                    }
            }
        } catch (error) {
            this.logger.error(`[Bot] Error handling slash command ${commandName}:`, error);
            
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'An error occurred while executing this command.',
                    ephemeral: true
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
        
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'list':
                await this.listAddons(interaction);
                break;
                
            case 'enable':
                await this.enableAddon(interaction);
                break;
                
            case 'disable':
                await this.disableAddon(interaction);
                break;
        }
    }

    // List all addons
    async listAddons(interaction) {
        const addons = this.registry.getAllAddons();
        
        const embed = {
            title: 'Addons',
            color: 0x0099FF,
            fields: []
        };

        for (const addon of addons) {
            const status = addon.enabled ? 'Enabled' : 'Disabled';
            const color = addon.enabled ? 'Green' : 'Red';
            
            embed.fields.push({
                name: `${addon.name} v${addon.version}`,
                value: `**Status:** ${status}\n**Commands:** ${addon.commands}\n**Dependencies:** ${addon.dependencies.join(', ') || 'None'}`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
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
        
        // Destroy Discord client
        this.client.destroy();
        
        this.ready = false;
        this.logger.log('[Bot] Shutdown complete');
    }
}

module.exports = TokenDiscordBot;
