const http = require('http');
const https = require('https');
const { eventBus, Events } = require('./events');

class OllamaService {
    constructor(bot) {
        this.bot = bot;
        this.config = bot.config;
        this.logger = bot.logger || console;
        this.ollamaConnected = false;
        this.chatSessions = null;
        this.connectionCheckInterval = null;
    }

    async initialize() {
        // Initialize chat sessions
        try {
            const ChatSessions = require('./chat-sessions');
            this.chatSessions = new ChatSessions({
                sessionTimeout: this.config.get('sessions.timeout'),
                maxSessionsPerUser: this.config.get('sessions.maxSessionsPerUser'),
                maxMessagesPerSession: this.config.get('sessions.maxMessagesPerSession')
            });
            this.logger.log('[Ollama] Chat sessions initialized');
        } catch (error) {
            this.logger.error('[Ollama] Failed to initialize chat sessions:', error);
        }

        // Initial connection check
        await this.checkOllamaConnection();
        
        // Periodic connection check (every 60 seconds to prevent log spam if busy)
        this.connectionCheckInterval = setInterval(() => this.checkOllamaConnection(), 60000);
        
        this.logger.log('[Ollama] Ollama service initialized');
    }

    async stop() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
    }

    async checkOllamaConnection() {
        const host = this.config.get('ollama.host', '127.0.0.1');
        const port = this.config.get('ollama.port', 11434);

        return new Promise((resolve) => {
            const options = {
                hostname: host,
                port: port,
                path: '/api/tags',
                method: 'GET',
                timeout: 5000 // 5 second timeout for pinging tags
            };

            const req = http.request(options, (res) => {
                const wasConnected = this.ollamaConnected;
                this.ollamaConnected = (res.statusCode === 200);
                
                if (this.ollamaConnected) {
                    this.consecutiveTimeouts = 0; // Reset timeouts on success
                }

                if (this.ollamaConnected && !wasConnected) {
                    this.logger.log('[Ollama] Successfully connected to Ollama');
                    eventBus.emit(Events.SERVICE_READY, { service: 'ollama' }, 'ollama');
                } else if (!this.ollamaConnected && wasConnected) {
                    this.logger.warn('[Ollama] Lost connection to Ollama');
                }
                resolve(this.ollamaConnected);
            });

            req.on('error', (err) => {
                if (this.ollamaConnected) {
                    this.logger.error(`[Ollama] Connection error: ${err.message}`);
                }
                this.ollamaConnected = false;
                resolve(false);
            });

            req.on('timeout', () => {
                req.destroy();
                this.consecutiveTimeouts = (this.consecutiveTimeouts || 0) + 1;
                
                // Only log and consider disconnected if we timeout twice consecutively
                if (this.consecutiveTimeouts >= 2) {
                    if (this.ollamaConnected) {
                        this.logger.warn('[Ollama] Connection timeout (Multiple failures)');
                    }
                    this.ollamaConnected = false;
                }
                resolve(this.ollamaConnected);
            });

            req.end();
        });
    }

    async askOllama(question, model = null, images = [], userId = null, guildId = null) {
        const host = this.config.get('ollama.host', '127.0.0.1');
        const port = this.config.get('ollama.port', 11434);
        const selectedModel = model || this.config.get('ollama.defaultModel', 'llama3:8b');

        this.logger.log(`[Ollama] askOllama called with model: "${selectedModel}", question: "${question.substring(0, 50)}..."`);
        this.logger.log(`[Ollama] Ollama connected: ${this.ollamaConnected}`);

        if (!this.ollamaConnected) {
            this.logger.log('[Ollama] Ollama is not connected, returning error message');
            return 'Ollama is currently unreachable. Please check if it is running.';
        }

        let enhancedQuestion = question;
        if (userId && this.chatSessions) {
            const conversationContext = this.chatSessions.formatConversationForAI(userId, guildId, 10);
            if (conversationContext) {
                enhancedQuestion = conversationContext + question;
            }
        }

        return new Promise((resolve, reject) => {
            try {
                const messageContent = {
                    role: 'user',
                    content: enhancedQuestion
                };
                
                if (images && images.length > 0) {
                    messageContent.images = images;
                }
                
                const postData = JSON.stringify({
                    model: selectedModel,
                    messages: [messageContent],
                    stream: false
                });
                
                const options = {
                    hostname: host,
                    port: port,
                    path: '/api/chat',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    timeout: 180000 // 3 minutes timeout for response
                };
                
                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            if (res.statusCode !== 200) {
                                throw new Error(`Ollama API error: ${res.statusCode}`);
                            }
                            const response = JSON.parse(data);
                            if (response.message && response.message.content) {
                                resolve(response.message.content.trim());
                            } else {
                                resolve('Received an empty or invalid response from Ollama.');
                            }
                        } catch (e) {
                            resolve('Error parsing Ollama response.');
                        }
                    });
                });
                
                req.on('error', (e) => resolve(`Ollama request error: ${e.message}`));
                req.on('timeout', () => {
                    req.destroy();
                    resolve('Ollama request timed out.');
                });
                
                req.write(postData);
                req.end();
            } catch (e) {
                resolve(`Error: ${e.message}`);
            }
        });
    }

    async handleChat(message, question, model = null) {
        const userId = message.author.id;
        const guildId = message.guildId;
        
        this.logger.log(`[Ollama] handleChat called with model: "${model}", question: "${question.substring(0, 50)}..."`);
        
        // Token consumption check
        const tokenCost = 1; // Default cost
        if (this.bot.useUserTokens && !this.bot.useUserTokens(userId, tokenCost)) {
            await message.reply(`You don't have enough tokens. This chat costs ${tokenCost} tokens.`);
            return;
        }

        const typingMsg = await message.reply('Thinking...');

        try {
            // Check for images
            const images = [];
            if (message.attachments.size > 0) {
                for (const attachment of message.attachments.values()) {
                    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                        const base64 = await this.downloadImageAsBase64(attachment.url);
                        images.push(base64);
                    }
                }
            }

            const response = await this.askOllama(question, model, images, userId, guildId);
            
            // Save to chat session
            if (this.chatSessions) {
                this.chatSessions.addMessage(userId, guildId, 'user', question);
                this.chatSessions.addMessage(userId, guildId, 'assistant', response);
            }

            // Send response in chunks
            const chunks = this.bot.splitMessage(response);
            
            try {
                await typingMsg.edit(chunks[0]);
            } catch (err) {
                // If "Thinking..." message was deleted or expired
                await message.channel.send(chunks[0]);
            }

            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]);
            }
            
            eventBus.emit(Events.RESPONSE_SENT, {
                userId,
                response,
                model: this.config.get('ollama.defaultModel')
            }, 'ollama');
            
        } catch (error) {
            this.logger.error('[Ollama] Chat handling error:', error);
            try {
                await typingMsg.edit(`Error: ${error.message}`);
            } catch (e) {
                await message.channel.send(`Error: ${error.message}`).catch(() => {});
            }
        }
    }

    async downloadImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
                res.on('error', reject);
            }).on('error', reject);
        });
    }
}

module.exports = OllamaService;
