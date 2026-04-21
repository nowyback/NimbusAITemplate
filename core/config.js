const fs = require('fs');
const path = require('path');
const { eventBus, Events } = require('./events');

class ConfigManager {
    constructor(bot) {
        this.bot = bot;
        this.config = {};
        this.configDir = path.join(__dirname, '..', 'config');
        this.mainConfigFile = path.join(this.configDir, 'bot-config.json');
        this.addonsConfigFile = path.join(this.configDir, 'addons.json');
        this.logger = bot.logger || console;
        
        this.ensureConfigDir();
        this.loadConfig();
    }

    // Ensure config directory exists
    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
            this.logger.log('[Config] Created config directory');
        }
    }

    // Load configuration from files
    loadConfig() {
        try {
            // Load main bot configuration
            this.config = this.loadMainConfig();
            
            // Load addons configuration
            this.config.addons = this.loadAddonsConfig();
            
            this.logger.log('[Config] Configuration loaded successfully');
        } catch (error) {
            this.logger.error('[Config] Error loading configuration:', error);
            this.config = this.getDefaultConfig();
        }
    }

    // Load main bot configuration
    loadMainConfig() {
        if (fs.existsSync(this.mainConfigFile)) {
            const data = fs.readFileSync(this.mainConfigFile, 'utf8');
            return JSON.parse(data);
        }
        
        // Create default config if it doesn't exist
        const defaultConfig = this.getDefaultConfig();
        this.saveMainConfig(defaultConfig);
        return defaultConfig;
    }

    // Load addons configuration
    loadAddonsConfig() {
        if (fs.existsSync(this.addonsConfigFile)) {
            const data = fs.readFileSync(this.addonsConfigFile, 'utf8');
            return JSON.parse(data);
        }
        
        // Create default addons config if it doesn't exist
        const defaultAddonsConfig = this.getDefaultAddonsConfig();
        this.saveAddonsConfig(defaultAddonsConfig);
        return defaultAddonsConfig;
    }

    // Get default main configuration
    getDefaultConfig() {
        return {
            bot: {
                token: process.env.DISCORDBOTTOKEN || '',
                ownerId: process.env.OWNER_ID || '',
                version: process.env.VERSION || '1.0.0',
                prefix: '>'
            },
            ollama: {
                host: process.env.OLLAMA_HOST || 'localhost',
                port: parseInt(process.env.OLLAMA_PORT) || 11434,
                defaultModel: process.env.DEFAULT_MODEL || 'llama3:8b'
            },
            tokens: {
                defaultTokens: parseInt(process.env.DEFAULT_TOKENS) || 1,
                requestCooldown: parseInt(process.env.REQUEST_COOLDOWN) || 5000
            },
            sessions: {
                timeout: parseInt(process.env.SESSION_TIMEOUT) || (3 * 24 * 60 * 60 * 1000),
                maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER) || 5,
                maxMessagesPerSession: parseInt(process.env.MAX_MESSAGES_PER_SESSION) || 50
            },
            internet: {
                enabled: process.env.INTERNET_ACCESS === 'true',
                method: process.env.INTERNET_METHOD || 'search',
                allowedDomains: process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim()) : [],
                rateLimit: parseInt(process.env.RATE_LIMIT) || 10,
                censoringLevel: parseInt(process.env.CENSORING_LEVEL) || 2
            },
            ai: {
                name: process.env.AI_NAME || 'Nimbus AI',
                responsePrefix: process.env.AI_RESPONSE_PREFIX || 'Nimbus AI Response',
                processingPrefix: process.env.AI_PROCESSING_PREFIX || 'AI is generating',
                errorPrefix: process.env.AI_ERROR_PREFIX || 'AI encountered an error'
            },
            server: {
                archiveCategoryName: process.env.ARCHIVE_CATEGORY_NAME || 'Archive',
                deleteRolesOnMove: process.env.DELETE_ROLES_ON_MOVE === 'true',
                createArchiveCategoryIfMissing: process.env.CREATE_ARCHIVE_CATEGORY_IF_MISSING === 'true',
                buildEnabled: process.env.BUILD_ENABLED === 'true'
            }
        };
    }

    // Get default addons configuration
    getDefaultAddonsConfig() {
        return {
            'internet-access': {
                enabled: true,
                config: {}
            },
            'image-processing': {
                enabled: true,
                config: {}
            },
            'server-building': {
                enabled: true,
                config: {}
            },
            'auto-moderation': {
                enabled: false,
                config: {}
            },
            'server-management': {
                enabled: false,
                config: {}
            }
        };
    }

    // Save main configuration
    saveMainConfig(config = this.config) {
        try {
            fs.writeFileSync(this.mainConfigFile, JSON.stringify(config, null, 2));
            this.logger.log('[Config] Main configuration saved');
        } catch (error) {
            this.logger.error('[Config] Error saving main configuration:', error);
        }
    }

    // Save addons configuration
    saveAddonsConfig(addonsConfig = this.config.addons) {
        try {
            fs.writeFileSync(this.addonsConfigFile, JSON.stringify(addonsConfig, null, 2));
            this.logger.log('[Config] Addons configuration saved');
        } catch (error) {
            this.logger.error('[Config] Error saving addons configuration:', error);
        }
    }

    // Get configuration value by path
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    // Set configuration value by path
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        // Emit configuration update event
        eventBus.emit(Events.CONFIG_UPDATED, {
            path,
            oldValue,
            newValue: value,
            timestamp: Date.now()
        }, 'config-manager');
        
        this.saveMainConfig();
    }

    // Get addon configuration
    getAddonConfig(addonName) {
        return this.get(`addons.${addonName}.config`, {});
    }

    // Set addon configuration
    setAddonConfig(addonName, config) {
        this.set(`addons.${addonName}.config`, config);
        this.saveAddonsConfig();
    }

    // Check if addon is enabled
    isAddonEnabled(addonName) {
        return this.get(`addons.${addonName}.enabled`, false);
    }

    // Enable/disable addon
    setAddonEnabled(addonName, enabled) {
        this.set(`addons.${addonName}.enabled`, enabled);
        this.saveAddonsConfig();
    }

    // Get all enabled addons
    getEnabledAddons() {
        const addons = this.get('addons', {});
        return Object.keys(addons).filter(name => addons[name].enabled);
    }

    // Update configuration from environment variables
    updateFromEnv() {
        const envMappings = {
            'DISCORDBOTTOKEN': 'bot.token',
            'OWNER_ID': 'bot.ownerId',
            'VERSION': 'bot.version',
            'OLLAMA_HOST': 'ollama.host',
            'OLLAMA_PORT': 'ollama.port',
            'DEFAULT_MODEL': 'ollama.defaultModel',
            'DEFAULT_TOKENS': 'tokens.defaultTokens',
            'REQUEST_COOLDOWN': 'tokens.requestCooldown',
            'SESSION_TIMEOUT': 'sessions.timeout',
            'MAX_SESSIONS_PER_USER': 'sessions.maxSessionsPerUser',
            'MAX_MESSAGES_PER_SESSION': 'sessions.maxMessagesPerSession',
            'INTERNET_ACCESS': 'internet.enabled',
            'INTERNET_METHOD': 'internet.method',
            'ALLOWED_DOMAINS': 'internet.allowedDomains',
            'RATE_LIMIT': 'internet.rateLimit',
            'CENSORING_LEVEL': 'internet.censoringLevel',
            'AI_NAME': 'ai.name',
            'AI_RESPONSE_PREFIX': 'ai.responsePrefix',
            'AI_PROCESSING_PREFIX': 'ai.processingPrefix',
            'AI_ERROR_PREFIX': 'ai.errorPrefix',
            'ARCHIVE_CATEGORY_NAME': 'server.archiveCategoryName',
            'DELETE_ROLES_ON_MOVE': 'server.deleteRolesOnMove',
            'CREATE_ARCHIVE_CATEGORY_IF_MISSING': 'server.createArchiveCategoryIfMissing',
            'BUILD_ENABLED': 'server.buildEnabled'
        };

        for (const [envVar, configPath] of Object.entries(envMappings)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                // Convert string values to appropriate types
                let value = envValue;
                if (envValue === 'true') value = true;
                else if (envValue === 'false') value = false;
                else if (/^\d+$/.test(envValue)) value = parseInt(envValue);
                else if (configPath.includes('allowedDomains') && envValue.includes(',')) {
                    value = envValue.split(',').map(d => d.trim());
                }
                
                this.set(configPath, value);
            }
        }
    }

    // Validate configuration
    validateConfig() {
        const errors = [];
        
        // Validate bot configuration
        if (!this.get('bot.token')) {
            errors.push('Bot token is required');
        }
        
        if (!this.get('bot.ownerId')) {
            errors.push('Bot owner ID is required');
        }
        
        // Validate Ollama configuration
        const ollamaPort = this.get('ollama.port');
        if (ollamaPort < 1 || ollamaPort > 65535) {
            errors.push('Ollama port must be between 1 and 65535');
        }
        
        // Validate token configuration
        const defaultTokens = this.get('tokens.defaultTokens');
        if (defaultTokens < 0) {
            errors.push('Default tokens must be non-negative');
        }
        
        const requestCooldown = this.get('tokens.requestCooldown');
        if (requestCooldown < 0) {
            errors.push('Request cooldown must be non-negative');
        }
        
        // Validate session configuration
        const sessionTimeout = this.get('sessions.timeout');
        if (sessionTimeout < 60000) { // Minimum 1 minute
            errors.push('Session timeout must be at least 1 minute');
        }
        
        // Validate internet configuration
        const censoringLevel = this.get('internet.censoringLevel');
        if (censoringLevel < 0 || censoringLevel > 5) {
            errors.push('Censoring level must be between 0 and 5');
        }
        
        return errors;
    }

    // Get full configuration
    getAllConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    // Reload configuration from files
    reloadConfig() {
        this.loadConfig();
        this.logger.log('[Config] Configuration reloaded');
    }
}

module.exports = ConfigManager;
