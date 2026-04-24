const fs = require('fs');
const path = require('path');

class ChatSessions {
    constructor(config = {}) {
        this.sessionsFile = path.join(__dirname, 'chat-sessions.json');
        this.sessionTimeout = config.sessionTimeout || (3 * 24 * 60 * 60 * 1000); // 3 days default
        this.maxSessionsPerUser = config.maxSessionsPerUser || 5;
        this.maxMessagesPerSession = config.maxMessagesPerSession || 50;
        this.sessions = this.loadSessions();
        
        // Clean old sessions on startup
        this.cleanupExpiredSessions();
    }

    // Load sessions from file
    loadSessions() {
        try {
            if (fs.existsSync(this.sessionsFile)) {
                const data = fs.readFileSync(this.sessionsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading chat sessions:', error.message);
        }
        return {};
    }

    // Save sessions to file
    saveSessions() {
        try {
            fs.writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
        } catch (error) {
            console.error('Error saving chat sessions:', error.message);
        }
    }

    // Get or create a session for a user
    getSession(userId, guildId = null) {
        const sessionKey = this.getSessionKey(userId, guildId);
        
        // Clean expired sessions first
        this.cleanupExpiredSessions();
        
        // Get existing session or create new one
        let session = this.sessions[sessionKey];
        
        if (!session) {
            session = {
                userId: userId,
                guildId: guildId,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                messages: [],
                context: {},
                model: null
            };
            
            // Limit sessions per user
            this.limitUserSessions(userId);
            
            this.sessions[sessionKey] = session;
        }
        
        // Update last activity
        session.lastActivity = Date.now();
        
        return session;
    }

    // Generate session key
    getSessionKey(userId, guildId) {
        if (guildId) {
            return `${userId}_${guildId}`;
        }
        return `${userId}_dm`;
    }

    // Add message to session
    addMessage(userId, guildId, message, isUser = true, model = null) {
        const session = this.getSession(userId, guildId);
        
        const messageData = {
            timestamp: Date.now(),
            isUser: isUser,
            content: message,
            model: model || session.model
        };
        
        // Add to messages array
        session.messages.push(messageData);
        
        // Limit messages per session
        if (session.messages.length > this.maxMessagesPerSession) {
            session.messages = session.messages.slice(-this.maxMessagesPerSession);
        }
        
        // Update model if specified
        if (model) {
            session.model = model;
        }
        
        // Update context for AI
        this.updateContext(session);
        
        this.saveSessions();
        return session;
    }

    // Update session context for AI
    updateContext(session) {
        const recentMessages = session.messages.slice(-10); // Last 10 messages for context
        
        session.context = {
            recentMessages: recentMessages,
            messageCount: session.messages.length,
            sessionAge: Date.now() - session.createdAt,
            lastActivity: session.lastActivity
        };
    }

    // Get conversation history for AI context
    getConversationHistory(userId, guildId, maxMessages = 10) {
        const session = this.getSession(userId, guildId);
        return session.messages.slice(-maxMessages);
    }

    // Format conversation for AI
    formatConversationForAI(userId, guildId, maxMessages = 10) {
        const messages = this.getConversationHistory(userId, guildId, maxMessages);
        
        if (messages.length === 0) {
            return "";
        }
        
        let conversation = "Previous conversation:\n";
        
        messages.forEach(msg => {
            const sender = msg.isUser ? "User" : "Assistant";
            conversation += `${sender}: ${msg.content}\n`;
        });
        
        conversation += "\nCurrent question: ";
        return conversation;
    }

    // Limit sessions per user
    limitUserSessions(userId) {
        const userSessions = [];
        
        // Find all sessions for this user
        for (const [key, session] of Object.entries(this.sessions)) {
            if (session.userId === userId) {
                userSessions.push({ key, session });
            }
        }
        
        // Sort by last activity (oldest first)
        userSessions.sort((a, b) => a.session.lastActivity - b.session.lastActivity);
        
        // Remove oldest sessions if too many
        if (userSessions.length > this.maxSessionsPerUser) {
            const sessionsToRemove = userSessions.slice(0, userSessions.length - this.maxSessionsPerUser);
            
            sessionsToRemove.forEach(({ key }) => {
                delete this.sessions[key];
            });
        }
    }

    // Clean expired sessions
    cleanupExpiredSessions() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, session] of Object.entries(this.sessions)) {
            if (now - session.lastActivity > this.sessionTimeout) {
                expiredKeys.push(key);
            }
        }
        
        // Remove expired sessions
        expiredKeys.forEach(key => {
            delete this.sessions[key];
        });
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired chat sessions`);
            this.saveSessions();
        }
        
        return expiredKeys.length;
    }

    // Delete specific session
    deleteSession(userId, guildId) {
        const sessionKey = this.getSessionKey(userId, guildId);
        
        if (this.sessions[sessionKey]) {
            delete this.sessions[sessionKey];
            this.saveSessions();
            return true;
        }
        
        return false;
    }

    // Delete all sessions for user
    deleteAllUserSessions(userId) {
        const deletedKeys = [];
        
        for (const [key, session] of Object.entries(this.sessions)) {
            if (session.userId === userId) {
                deletedKeys.push(key);
                delete this.sessions[key];
            }
        }
        
        if (deletedKeys.length > 0) {
            this.saveSessions();
        }
        
        return deletedKeys.length;
    }

    // Get session statistics
    getSessionStats(userId = null) {
        const stats = {
            totalSessions: Object.keys(this.sessions).length,
            activeSessions: 0,
            expiredSessions: 0,
            userSessions: {}
        };
        
        const now = Date.now();
        
        for (const [key, session] of Object.entries(this.sessions)) {
            const age = now - session.lastActivity;
            
            if (age > this.sessionTimeout) {
                stats.expiredSessions++;
            } else {
                stats.activeSessions++;
            }
            
            // User-specific stats
            if (!stats.userSessions[session.userId]) {
                stats.userSessions[session.userId] = {
                    sessionCount: 0,
                    totalMessages: 0,
                    lastActivity: 0
                };
            }
            
            stats.userSessions[session.userId].sessionCount++;
            stats.userSessions[session.userId].totalMessages += session.messages.length;
            stats.userSessions[session.userId].lastActivity = Math.max(
                stats.userSessions[session.userId].lastActivity,
                session.lastActivity
            );
        }
        
        // Filter by user if specified
        if (userId) {
            return stats.userSessions[userId] || { sessionCount: 0, totalMessages: 0, lastActivity: 0 };
        }
        
        return stats;
    }

    // Export session data
    exportSessions(userId = null) {
        const sessions = [];
        
        for (const [key, session] of Object.entries(this.sessions)) {
            if (!userId || session.userId === userId) {
                sessions.push({
                    userId: session.userId,
                    guildId: session.guildId,
                    createdAt: new Date(session.createdAt).toISOString(),
                    lastActivity: new Date(session.lastActivity).toISOString(),
                    messageCount: session.messages.length,
                    model: session.model
                });
            }
        }
        
        return sessions;
    }

    // Set session timeout
    setSessionTimeout(timeoutMs) {
        this.sessionTimeout = timeoutMs;
        this.cleanupExpiredSessions();
    }

    // Get session info for debugging
    getSessionInfo(userId, guildId) {
        const session = this.getSession(userId, guildId);
        
        return {
            userId: session.userId,
            guildId: session.guildId,
            createdAt: new Date(session.createdAt).toISOString(),
            lastActivity: new Date(session.lastActivity).toISOString(),
            messageCount: session.messages.length,
            model: session.model,
            age: Date.now() - session.createdAt,
            timeUntilExpiry: this.sessionTimeout - (Date.now() - session.lastActivity)
        };
    }
}

module.exports = ChatSessions;
