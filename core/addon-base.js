const EventEmitter = require('events');

class AddonBase extends EventEmitter {
    constructor(name, version = '1.0.0') {
        super();
        this.name = name;
        this.version = version;
        this.enabled = true;
        this.dependencies = [];
        this.commands = new Map();
        this.config = {};
        this.bot = null;
        this.logger = console;
    }

    // Initialize addon with bot instance and config
    async initialize(bot, config = {}) {
        this.bot = bot;
        this.config = { ...this.getDefaultConfig(), ...config };
        this.logger = bot.logger || console;
        
        try {
            await this.onInitialize();
            this.logger.log(`[Addon] ${this.name} v${this.version} initialized`);
            return true;
        } catch (error) {
            this.logger.error(`[Addon] Failed to initialize ${this.name}:`, error);
            return false;
        }
    }

    // Called when addon is initialized
    async onInitialize() {
        // Override in subclasses
    }

    // Called when addon is enabled
    async onEnable() {
        // Override in subclasses
    }

    // Called when addon is disabled
    async onDisable() {
        // Override in subclasses
    }

    // Get default configuration for this addon
    getDefaultConfig() {
        return {};
    }

    // Register a command
    registerCommand(name, handler, options = {}) {
        const command = {
            name,
            handler,
            description: options.description || '',
            usage: options.usage || '',
            permissions: options.permissions || [],
            cooldown: options.cooldown || 0,
            category: options.category || 'general',
            enabled: options.enabled !== false
        };
        
        this.commands.set(name, command);
        return command;
    }

    // Unregister a command
    unregisterCommand(name) {
        return this.commands.delete(name);
    }

    // Get all commands
    getCommands() {
        return Array.from(this.commands.entries()).map(([name, command]) => ({
            name,
            ...command
        }));
    }

    // Check if user has permission to use command
    hasPermission(userId, command) {
        if (!command.permissions || command.permissions.length === 0) {
            return true;
        }
        
        // Check if user is bot owner
        if (userId === this.bot.ownerId) {
            return true;
        }
        
        // Check guild permissions if in guild
        // This can be extended with role-based permissions
        return true;
    }

    // Handle command execution
    async handleCommand(message, commandName, args) {
        const command = this.commands.get(commandName);
        
        if (!command) {
            return false;
        }
        
        if (!command.enabled) {
            await message.reply('This command is currently disabled.');
            return true;
        }
        
        if (!this.hasPermission(message.author.id, command)) {
            await message.reply('You do not have permission to use this command.');
            return true;
        }
        
        try {
            await command.handler(message, args);
            return true;
        } catch (error) {
            this.logger.error(`[Addon] Error in command ${commandName}:`, error);
            await message.reply('An error occurred while executing this command.');
            return true;
        }
    }

    // Enable addon
    async enable() {
        if (this.enabled) return true;
        
        try {
            await this.onEnable();
            this.enabled = true;
            this.logger.log(`[Addon] ${this.name} enabled`);
            return true;
        } catch (error) {
            this.logger.error(`[Addon] Failed to enable ${this.name}:`, error);
            return false;
        }
    }

    // Disable addon
    async disable() {
        if (!this.enabled) return true;
        
        try {
            await this.onDisable();
            this.enabled = false;
            this.logger.log(`[Addon] ${this.name} disabled`);
            return true;
        } catch (error) {
            this.logger.error(`[Addon] Failed to disable ${this.name}:`, error);
            return false;
        }
    }

    // Get addon status
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            enabled: this.enabled,
            commands: this.getCommands().length,
            dependencies: this.dependencies
        };
    }

    // Validate configuration
    validateConfig(config) {
        // Override in subclasses to implement specific validation
        return true;
    }

    // Update configuration
    updateConfig(newConfig) {
        if (this.validateConfig(newConfig)) {
            this.config = { ...this.config, ...newConfig };
            this.emit('configUpdated', this.config);
            return true;
        }
        return false;
    }

    // Get configuration
    getConfig() {
        return { ...this.config };
    }

    // Log addon-specific messages
    log(message, level = 'info') {
        const prefix = `[Addon:${this.name}]`;
        switch (level) {
            case 'error':
                this.logger.error(prefix, message);
                break;
            case 'warn':
                this.logger.warn(prefix, message);
                break;
            case 'info':
                this.logger.info(prefix, message);
                break;
            case 'debug':
                this.logger.debug(prefix, message);
                break;
            default:
                this.logger.log(prefix, message);
        }
    }
}

module.exports = AddonBase;
