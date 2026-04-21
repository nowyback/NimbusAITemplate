const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
        this.eventFilters = new Map();
    }

    // Emit an event with metadata
    emit(eventName, data, source = 'unknown') {
        const event = {
            name: eventName,
            data,
            source,
            timestamp: Date.now(),
            id: this.generateEventId()
        };

        // Add to history
        this.addToHistory(event);

        // Apply filters
        if (!this.shouldEmitEvent(event)) {
            return false;
        }

        // Emit the event
        return super.emit(eventName, event);
    }

    // Generate unique event ID
    generateEventId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Add event to history
    addToHistory(event) {
        this.eventHistory.push(event);
        
        // Trim history if it gets too large
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }

    // Check if event should be emitted based on filters
    shouldEmitEvent(event) {
        for (const [eventName, filter] of this.eventFilters) {
            if (eventName === event.name || eventName === '*') {
                if (!filter(event)) {
                    return false;
                }
            }
        }
        return true;
    }

    // Add event filter
    addEventFilter(eventName, filter) {
        this.eventFilters.set(eventName, filter);
    }

    // Remove event filter
    removeEventFilter(eventName) {
        this.eventFilters.delete(eventName);
    }

    // Get event history
    getEventHistory(eventName = null, limit = 100) {
        let history = this.eventHistory;
        
        if (eventName) {
            history = history.filter(event => event.name === eventName);
        }

        return history.slice(-limit);
    }

    // Get recent events
    getRecentEvents(timeMs = 60000) {
        const cutoff = Date.now() - timeMs;
        return this.eventHistory.filter(event => event.timestamp >= cutoff);
    }

    // Clear event history
    clearHistory() {
        this.eventHistory = [];
    }

    // Get event statistics
    getEventStats() {
        const stats = {};
        
        for (const event of this.eventHistory) {
            if (!stats[event.name]) {
                stats[event.name] = {
                    count: 0,
                    lastSeen: 0,
                    sources: new Set()
                };
            }
            
            stats[event.name].count++;
            stats[event.name].lastSeen = Math.max(stats[event.name].lastSeen, event.timestamp);
            stats[event.name].sources.add(event.source);
        }

        // Convert Sets to Arrays for serialization
        for (const stat of Object.values(stats)) {
            stat.sources = Array.from(stat.sources);
        }

        return stats;
    }
}

// Global event bus instance
const eventBus = new EventBus();

// Common event types
const Events = {
    // Bot events
    BOT_READY: 'bot.ready',
    BOT_ERROR: 'bot.error',
    BOT_SHUTDOWN: 'bot.shutdown',
    
    // Addon events
    ADDON_LOADED: 'addon.loaded',
    ADDON_UNLOADED: 'addon.unloaded',
    ADDON_ENABLED: 'addon.enabled',
    ADDON_DISABLED: 'addon.disabled',
    ADDON_ERROR: 'addon.error',
    
    // Message events
    MESSAGE_RECEIVED: 'message.received',
    MESSAGE_PROCESSED: 'message.processed',
    COMMAND_EXECUTED: 'command.executed',
    COMMAND_FAILED: 'command.failed',
    
    // User events
    USER_JOINED: 'user.joined',
    USER_LEFT: 'user.left',
    USER_BANNED: 'user.banned',
    USER_UNBANNED: 'user.unbanned',
    
    // Token events
    TOKENS_ADDED: 'tokens.added',
    TOKENS_REMOVED: 'tokens.removed',
    TOKENS_USED: 'tokens.used',
    
    // AI events
    AI_REQUEST: 'ai.request',
    AI_RESPONSE: 'ai.response',
    AI_ERROR: 'ai.error',
    
    // Server events
    SERVER_CREATED: 'server.created',
    SERVER_UPDATED: 'server.updated',
    CHANNEL_CREATED: 'channel.created',
    ROLE_CREATED: 'role.created',
    
    // System events
    CONFIG_UPDATED: 'config.updated',
    RATE_LIMIT_HIT: 'ratelimit.hit',
    ERROR_OCCURRED: 'error.occurred'
};

module.exports = {
    EventBus,
    Events,
    eventBus
};
