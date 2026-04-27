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
        let messages = [];
        
        if (userId && this.chatSessions) {
            const conversationHistory = this.chatSessions.getConversationHistory(userId, guildId, 10);
            
            this.logger.log(`[Ollama] Found ${conversationHistory.length} messages in conversation history for ${userId}`);
            
            if (conversationHistory.length > 0) {
                // Build proper chat message array for Ollama
                messages = conversationHistory.map(msg => ({
                    role: msg.isUser ? 'user' : 'assistant',
                    content: msg.content
                }));
                
                this.logger.log(`[Ollama] Built ${messages.length} message array for context`);
            } else {
                this.logger.log(`[Ollama] No conversation context found`);
            }
        } else {
            this.logger.log(`[Ollama] No chat sessions available or no userId`);
        }
        
        // Add current question
        messages.push({
            role: 'user',
            content: question
        });

        return new Promise((resolve, reject) => {
            try {
                // Add images to the last user message if present
                if (images && images.length > 0 && messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.role === 'user') {
                        lastMessage.images = images;
                    }
                }
                
                const postData = JSON.stringify({
                    model: selectedModel,
                    messages: messages,
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
                            this.logger.log('[Ollama] Parsed response:', JSON.stringify(response, null, 2));
                            if (response.message && response.message.content) {
                                resolve(response.message.content.trim());
                            } else if (response.response) {
                                // Some Ollama versions use 'response' field
                                resolve(response.response.trim());
                            } else if (response.content) {
                                // Some Ollama versions use 'content' field
                                resolve(response.content.trim());
                            } else {
                                this.logger.log('[Ollama] Response structure:', Object.keys(response));
                                resolve('Received an empty or invalid response from Ollama.');
                            }
                        } catch (e) {
                            this.logger.error('[Ollama] Response parsing error:', e);
                            this.logger.error('[Ollama] Raw response data:', data);
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

    async handleChat(message, question, model = null, messageId = null) {
        const userId = message.author.id;
        const guildId = message.guildId;
        
        this.logger.log(`[Ollama] handleChat called with model: "${model}", question: "${question.substring(0, 50)}..."`);
        
        // Token consumption check
        const tokenCost = 1; // Default cost
        if (this.bot.useUserTokens && !this.bot.useUserTokens(userId, tokenCost)) {
            const tokenEmbed = {
                title: '💰 Insufficient Tokens',
                description: `You don't have enough tokens to use the chat.\n\n**Required:** ${tokenCost} tokens\n**Use:** \`/tokens\` to check your balance`,
                color: 0xFF9900,
                footer: {
                    text: 'Token System'
                },
                timestamp: new Date().toISOString()
            };
            await message.reply({ embeds: [tokenEmbed] });
            return;
        }

        // Use bot's custom processing messages with cycling
        let currentMsg = this.bot.getRandomProcessingMessage();
        const typingMsg = await message.reply(currentMsg);
        
        // Start cycling through messages every 2 seconds
        const messageInterval = setInterval(async () => {
            const newMsg = this.bot.getRandomProcessingMessage();
            if (newMsg !== currentMsg) {
                currentMsg = newMsg;
                try {
                    await typingMsg.edit(currentMsg);
                } catch (err) {
                    // Message might be deleted, stop cycling
                    clearInterval(messageInterval);
                }
            }
        }, 7000); // Change every 2 seconds

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
        
        // Stop cycling messages when response is ready
        clearInterval(messageInterval);
        
        // Check if response is an error message
        if (response.includes('Ollama is currently unreachable') || response.includes('Error:')) {
            // Delete the processing message
            try {
                await typingMsg.delete();
            } catch (err) {
                // If message was already deleted, continue
            }
            
            // Create error embed
            const errorEmbed = {
                title: '🔌 Service Unavailable',
                description: response,
                color: 0xFF0000,
                footer: {
                    text: 'AI Service Status'
                },
                timestamp: new Date().toISOString()
            };
            
            await message.channel.send({ embeds: [errorEmbed] });
            return response;
        }
        
        // Save to chat session
        if (this.chatSessions) {
            this.chatSessions.addMessage(userId, guildId, question, true, model);
            this.chatSessions.addMessage(userId, guildId, response, false, model);
        }

        // Create embed for AI response
        const embed = {
            title: '🤖 AI Response',
            description: response,
            color: 0x0099FF,
            footer: {
                text: `Debug ID: ${messageId}`
            },
            timestamp: new Date().toISOString()
        };
        
        // Delete the processing message
        try {
            await typingMsg.delete();
        } catch (err) {
            // If message was already deleted, continue
        }
        
        // Send AI response as embed
        await message.channel.send({ embeds: [embed] });
        
        eventBus.emit(Events.RESPONSE_SENT, {
            userId,
            response,
            model: this.config.get('ollama.defaultModel')
        }, 'ollama');
        
    } catch (error) {
        // Stop cycling messages on error
        clearInterval(messageInterval);
        
        this.logger.error('[Ollama] Chat handling error:', error);
        
        // Create error embed
        const errorEmbed = {
            title: '❌ Error',
            description: `Sorry, I had trouble processing your request.\n\n**Error:** ${error.message}`,
            color: 0xFF0000,
            footer: {
                text: 'Please try again later'
            },
            timestamp: new Date().toISOString()
        };
        
        // Delete the processing message
        try {
            await typingMsg.delete();
        } catch (err) {
            // If message was already deleted, continue
        }
        
        // Send error as embed
        await message.channel.send({ embeds: [errorEmbed] }).catch(() => {});
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
