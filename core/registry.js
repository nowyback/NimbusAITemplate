const fs = require('fs');
const path = require('path');

class AddonRegistry {
    constructor(bot) {
        this.bot = bot;
        this.addons = new Map();
        this.addonsDir = path.join(__dirname, '..', 'addons');
        this.logger = bot.logger || console;
    }

    // Load all addons from the addons directory
    async loadAllAddons() {
        try {
            if (!fs.existsSync(this.addonsDir)) {
                this.logger.log('[Registry] Addons directory not found, creating...');
                fs.mkdirSync(this.addonsDir, { recursive: true });
                return;
            }

            const addonDirs = fs.readdirSync(this.addonsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const addonDir of addonDirs) {
                await this.loadAddon(addonDir);
            }

            this.logger.log(`[Registry] Loaded ${this.addons.size} addons`);
        } catch (error) {
            this.logger.error('[Registry] Error loading addons:', error);
        }
    }

    // Load a specific addon
    async loadAddon(addonName) {
        try {
            const addonPath = path.join(this.addonsDir, addonName);
            const packagePath = path.join(addonPath, 'package.json');
            const indexPath = path.join(addonPath, 'index.js');

            // Check if addon files exist
            if (!fs.existsSync(packagePath) || !fs.existsSync(indexPath)) {
                this.logger.warn(`[Registry] Addon ${addonName} missing required files`);
                return false;
            }

            // Read addon metadata
            const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Check if addon is already loaded
            if (this.addons.has(addonName)) {
                this.logger.warn(`[Registry] Addon ${addonName} is already loaded`);
                return false;
            }

            // Load addon class
            const AddonClass = require(indexPath);
            const addon = new AddonClass();

            // Validate addon
            if (!addon.name || typeof addon.initialize !== 'function') {
                this.logger.error(`[Registry] Invalid addon structure for ${addonName}`);
                return false;
            }

            // Check dependencies
            if (!this.checkDependencies(addon)) {
                this.logger.error(`[Registry] Addon ${addonName} has unmet dependencies`);
                return false;
            }

            // Get addon configuration
            const addonConfig = this.getAddonConfig(addonName);
            
            // Initialize addon
            const success = await addon.initialize(this.bot, addonConfig);
            if (!success) {
                this.logger.error(`[Registry] Failed to initialize addon ${addonName}`);
                return false;
            }

            // Register addon
            this.addons.set(addonName, addon);
            
            // Register addon's commands
            this.registerAddonCommands(addon);

            this.logger.log(`[Registry] Loaded addon: ${addon.name} v${addon.version}`);
            return true;

        } catch (error) {
            this.logger.error(`[Registry] Error loading addon ${addonName}:`, error);
            return false;
        }
    }

    // Unload an addon
    async unloadAddon(addonName) {
        try {
            const addon = this.addons.get(addonName);
            if (!addon) {
                this.logger.warn(`[Registry] Addon ${addonName} is not loaded`);
                return false;
            }

            // Disable addon
            await addon.disable();

            // Unregister commands
            this.unregisterAddonCommands(addon);

            // Remove from registry
            this.addons.delete(addonName);

            this.logger.log(`[Registry] Unloaded addon: ${addon.name}`);
            return true;

        } catch (error) {
            this.logger.error(`[Registry] Error unloading addon ${addonName}:`, error);
            return false;
        }
    }

    // Reload an addon
    async reloadAddon(addonName) {
        const wasLoaded = this.addons.has(addonName);
        
        if (wasLoaded) {
            await this.unloadAddon(addonName);
        }

        // Clear require cache
        const addonPath = path.join(this.addonsDir, addonName);
        const indexPath = path.join(addonPath, 'index.js');
        delete require.cache[require.resolve(indexPath)];

        return await this.loadAddon(addonName);
    }

    // Enable an addon
    async enableAddon(addonName) {
        const addon = this.addons.get(addonName);
        if (!addon) {
            this.logger.warn(`[Registry] Addon ${addonName} is not loaded`);
            return false;
        }

        return await addon.enable();
    }

    // Disable an addon
    async disableAddon(addonName) {
        const addon = this.addons.get(addonName);
        if (!addon) {
            this.logger.warn(`[Registry] Addon ${addonName} is not loaded`);
            return false;
        }

        return await addon.disable();
    }

    // Check if addon dependencies are met
    checkDependencies(addon) {
        if (!addon.dependencies || addon.dependencies.length === 0) {
            return true;
        }

        for (const dependency of addon.dependencies) {
            if (!this.addons.has(dependency)) {
                this.logger.error(`[Registry] Addon ${addon.name} requires ${dependency} but it's not loaded`);
                return false;
            }
        }

        return true;
    }

    // Get addon configuration
    getAddonConfig(addonName) {
        const configPath = path.join(this.addonsDir, addonName, 'config.json');
        
        try {
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            this.logger.warn(`[Registry] Error reading config for ${addonName}:`, error);
        }

        return {};
    }

    // Register addon commands with the bot
    registerAddonCommands(addon) {
        const commands = addon.getCommands();
        
        for (const command of commands) {
            this.bot.registerCommand(command.name, addon, command);
        }
    }

    // Unregister addon commands from the bot
    unregisterAddonCommands(addon) {
        const commands = addon.getCommands();
        
        for (const command of commands) {
            this.bot.unregisterCommand(command.name);
        }
    }

    // Get addon by name
    getAddon(addonName) {
        return this.addons.get(addonName);
    }

    // Get all loaded addons
    getAllAddons() {
        return Array.from(this.addons.entries()).map(([name, addon]) => ({
            name,
            ...addon.getStatus()
        }));
    }

    // Get enabled addons
    getEnabledAddons() {
        return this.getAllAddons().filter(addon => addon.enabled);
    }

    // Get disabled addons
    getDisabledAddons() {
        return this.getAllAddons().filter(addon => !addon.enabled);
    }

    // Check if addon is loaded
    isLoaded(addonName) {
        return this.addons.has(addonName);
    }

    // Get addon status
    getAddonStatus(addonName) {
        const addon = this.addons.get(addonName);
        return addon ? addon.getStatus() : null;
    }

    // Handle message and route to appropriate addon
    async handleMessage(message) {
        const content = message.content.trim();
        
        // Check if it's a command
        if (!content.startsWith('>')) {
            return false;
        }

        const parts = content.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Find addon that handles this command
        for (const addon of this.addons.values()) {
            if (addon.enabled && addon.commands.has(commandName)) {
                return await addon.handleCommand(message, commandName, args);
            }
        }

        // FALLBACK: If no specific command matches, use core Ollama service
        // treat the whole content as a question for the AI.
        const question = content.slice(1).trim();
        if (question && this.bot.ollama) {
            await this.bot.ollama.handleChat(message, question);
            return true;
        }

        return false;
    }

    // Handle slash command and route to appropriate addon
    async handleSlashCommand(interaction) {
        const { commandName } = interaction;
        
        // Find addon that handles this slash command
        for (const addon of this.addons.values()) {
            if (addon.enabled && addon.commands.has(commandName)) {
                const command = addon.commands.get(commandName);
                if (command.type === 'slash') {
                    return await addon.handleSlashCommand(interaction, commandName);
                }
            }
        }

        return false;
    }

    // Get all commands from all enabled addons
    getAllCommands() {
        const commands = [];
        
        for (const addon of this.addons.values()) {
            if (addon.enabled) {
                const addonCommands = addon.getCommands().map(cmd => ({
                    ...cmd,
                    addon: addon.name
                }));
                commands.push(...addonCommands);
            }
        }

        return commands;
    }

    // Get commands by category
    getCommandsByCategory(category) {
        return this.getAllCommands().filter(cmd => cmd.category === category);
    }
}

module.exports = AddonRegistry;
