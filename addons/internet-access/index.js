const AddonBase = require('../../core/addon-base');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class InternetAccessAddon extends AddonBase {
    constructor() {
        super('internet-access', '1.0.0');
        this.userRequests = new Map();
    }

    async onInitialize() {
        // Register commands
        this.registerCommand('search', this.handleSearchCommand.bind(this), {
            description: 'Search the web using DuckDuckGo',
            usage: '> search [query]',
            category: 'internet',
            cooldown: 5000
        });

        this.registerCommand('fetch', this.handleFetchCommand.bind(this), {
            description: 'Fetch content from a specific URL',
            usage: '> fetch [URL]',
            category: 'internet',
            cooldown: 5000
        });

        this.registerCommand('read', this.handleReadCommand.bind(this), {
            description: 'Read full website content with censoring applied',
            usage: '> read [URL]',
            category: 'internet',
            cooldown: 5000
        });

        this.log('Internet access addon initialized');
    }

    getDefaultConfig() {
        return {
            enabled: true,
            searchEngine: 'duckduckgo',
            maxResults: 3,
            requestTimeout: 10000,
            maxContentSize: 2000,
            allowedDomains: [],
            blockedDomains: [
                'pornhub.com',
                'xvideos.com',
                'adultfriendfinder.com',
                'malware.com',
                'virus.com'
            ],
            censoring: {
                enabled: true,
                level: 2,
                customFilters: []
            },
            rateLimit: {
                enabled: true,
                requestsPerMinute: 10,
                blockDuration: 60000
            }
        };
    }

    // Check if user is rate limited
    checkRateLimit(userId) {
        if (!this.config.rateLimit.enabled) {
            return true;
        }

        const now = Date.now();
        const userRequests = this.userRequests.get(userId) || [];
        
        // Remove requests older than 1 minute
        const recentRequests = userRequests.filter(time => now - time < 60000);
        
        if (recentRequests.length >= this.config.rateLimit.requestsPerMinute) {
            return false; // Rate limited
        }
        
        recentRequests.push(now);
        this.userRequests.set(userId, recentRequests);
        return true; // Allowed
    }

    // Validate domain against allowlist and blocklist
    validateDomain(urlString) {
        try {
            const url = new URL(urlString);
            const domain = url.hostname.toLowerCase();
            
            // Check blocklist first
            if (this.config.blockedDomains.some(blocked => domain.includes(blocked))) {
                return { valid: false, reason: 'Domain blocked' };
            }
            
            // If allowlist exists, check it
            if (this.config.allowedDomains.length > 0) {
                const allowed = this.config.allowedDomains.some(allowed => domain.includes(allowed));
                if (!allowed) {
                    return { valid: false, reason: 'Domain not in allowlist' };
                }
            }
            
            return { valid: true, domain };
        } catch (error) {
            return { valid: false, reason: 'Invalid URL' };
        }
    }

    // DuckDuckGo Instant Answer API search
    async searchDuckDuckGo(query) {
        return new Promise((resolve, reject) => {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        
                        if (result.AbstractText || result.RelatedTopics || result.Results) {
                            const searchResults = {
                                query: query,
                                abstract: result.AbstractText || '',
                                relatedTopics: (result.RelatedTopics || []).slice(0, this.config.maxResults).map(topic => ({
                                    title: topic.Text ? topic.Text.substring(0, 100) + '...' : '',
                                    url: topic.FirstURL || ''
                                })).filter(topic => topic.title),
                                results: (result.Results || []).slice(0, this.config.maxResults).map(item => ({
                                    title: item.Text || '',
                                    url: item.FirstURL || ''
                                }))
                            };
                            resolve(searchResults);
                        } else {
                            resolve({ query, abstract: '', relatedTopics: [], results: [], message: 'No results found' });
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                
                res.on('error', (error) => {
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    // Fetch content from a URL
    async fetchUrl(urlString) {
        const validation = this.validateDomain(urlString);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        return new Promise((resolve, reject) => {
            const url = new URL(urlString);
            const client = url.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'NimbusAI-Bot/1.0 (Educational Purpose)'
                },
                timeout: this.config.requestTimeout
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        // Extract text content from HTML (basic)
                        const textContent = this.extractTextContent(data);
                        resolve({
                            url: urlString,
                            domain: validation.domain,
                            title: this.extractTitle(data),
                            content: textContent.substring(0, this.config.maxContentSize),
                            statusCode: res.statusCode
                        });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            }).on('error', (error) => {
                reject(error);
            }).on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    // Enhanced website content reading
    async readWebsiteContent(url) {
        const validation = this.validateDomain(url);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'NimbusAI-Bot/1.0 (Educational Purpose)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate'
                },
                timeout: this.config.requestTimeout
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        // Extract meaningful content from website
                        const textContent = this.extractTextContent(data);
                        const title = this.extractTitle(data);
                        
                        // Apply censoring based on level
                        const censoredContent = this.censorContent(textContent);
                        const censoredTitle = this.censorContent(title);
                        
                        resolve({
                            url: url,
                            domain: validation.domain,
                            title: censoredTitle,
                            content: censoredContent,
                            statusCode: res.statusCode,
                            wordCount: censoredContent.split(/\s+/).length,
                            readingTime: Math.ceil(censoredContent.split(/\s+/).length / 200)
                        });
                    } else {
                        resolve({
                            url: url,
                            domain: validation.domain,
                            title: '',
                            content: '',
                            statusCode: res.statusCode,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                });
            }).on('error', (error) => {
                reject(error);
            }).on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    // Extract text content from HTML
    extractTextContent(html) {
        // Remove script and style tags
        let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Remove HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        
        // Decode HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");
        
        // Normalize whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        return text;
    }

    // Extract title from HTML
    extractTitle(html) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return titleMatch ? titleMatch[1].trim() : '';
    }

    // Censor content based on level
    censorContent(content) {
        if (!content || !this.config.censoring.enabled) {
            return content;
        }

        const level = this.config.censoring.level;
        let censored = content;

        switch (level) {
            case 1: // Just IPs, Addresses, etc
                censored = censored.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED]');
                censored = censored.replace(/\b\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}\b/g, '[REDACTED]');
                censored = censored.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED]');
                censored = censored.replace(/\b\d{3,4}[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[PHONE]');
                break;

            case 2: // A bit more censoring
                censored = this.censorContent(content, 1); // Apply level 1
                censored = censored.replace(/\b(shit|fuck|damn|hell|crap|piss)\b/gi, '****');
                censored = censored.replace(/\b(kill|murder|death|die)\b/gi, '****');
                break;

            case 3: // Normal Censorship
                censored = this.censorContent(content, 2); // Apply level 2
                censored = censored.replace(/\b(drug|weed|cocaine|heroin)\b/gi, '****');
                censored = censored.replace(/\b(sex|nude|naked|porn)\b/gi, '****');
                break;

            case 4: // Heavy Censorship
                censored = this.censorContent(content, 3); // Apply level 3
                censored = censored.replace(/\b(alcohol|beer|wine|vodka)\b/gi, '****');
                censored = censored.replace(/\b(violence|weapon|gun|knife)\b/gi, '****');
                censored = censored.replace(/\b(gambling|casino|bet|poker)\b/gi, '****');
                break;

            case 5: // Extreme Censorship
                censored = this.censorContent(content, 4); // Apply level 4
                censored = censored.replace(/\b(kiss|love|date|marriage)\b/gi, '****');
                censored = censored.replace(/\b(money|cash|dollar|payment)\b/gi, '****');
                censored = censored.replace(/\b(work|job|salary|business)\b/gi, '****');
                // Replace most words with asterisks
                censored = censored.replace(/\b\w+\b/g, (match) => '*'.repeat(match.length));
                break;
        }

        return censored;
    }

    // Format search results for AI
    formatSearchForAI(results) {
        let formatted = `Search results for "${results.query}":\n\n`;
        
        if (results.abstract) {
            formatted += `Abstract: ${results.abstract}\n\n`;
        }
        
        if (results.results && results.results.length > 0) {
            formatted += 'Top Results:\n';
            results.results.forEach((result, index) => {
                formatted += `${index + 1}. ${result.title}\n   ${result.url}\n\n`;
            });
        }
        
        if (results.relatedTopics && results.relatedTopics.length > 0) {
            formatted += 'Related Topics:\n';
            results.relatedTopics.forEach((topic, index) => {
                formatted += `${index + 1}. ${topic.title}\n   ${topic.url}\n\n`;
            });
        }
        
        return formatted;
    }

    // Format fetch results for AI
    formatFetchForAI(result) {
        return `Content from ${result.url}:\n\nTitle: ${result.title}\n\nContent: ${result.content}`;
    }

    // Handle search command
    async handleSearchCommand(message, args) {
        if (!this.config.enabled) {
            await message.reply('Internet access is disabled.');
            return;
        }

        const query = args.join(' ');
        if (!query) {
            await message.reply('Usage: `> search [query]`');
            return;
        }

        if (!this.checkRateLimit(message.author.id)) {
            await message.reply('You are being rate limited. Please wait before making another request.');
            return;
        }

        await message.reply('Searching the web...');

        try {
            const results = await this.searchDuckDuckGo(query);
            const formattedResults = this.formatSearchForAI(results);
            
            // Split response into chunks if needed
            const chunks = this.bot.splitMessage(formattedResults);
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(`**Web Search Results:**\n\n${chunks[i]}`);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }
        } catch (error) {
            this.log(`Search failed: ${error.message}`, 'error');
            await message.reply(`Search failed: ${error.message}`);
        }
    }

    // Handle fetch command
    async handleFetchCommand(message, args) {
        if (!this.config.enabled) {
            await message.reply('Internet access is disabled.');
            return;
        }

        const url = args[0];
        if (!url) {
            await message.reply('Usage: `> fetch [URL]`');
            return;
        }

        if (!this.checkRateLimit(message.author.id)) {
            await message.reply('You are being rate limited. Please wait before making another request.');
            return;
        }

        await message.reply('Fetching URL content...');

        try {
            const result = await this.fetchUrl(url);
            const formattedResult = this.formatFetchForAI(result);
            
            // Split response into chunks if needed
            const chunks = this.bot.splitMessage(formattedResult);
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(`**URL Content:**\n\n${chunks[i]}`);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }
        } catch (error) {
            this.log(`Fetch failed: ${error.message}`, 'error');
            await message.reply(`Fetch failed: ${error.message}`);
        }
    }

    // Handle read command
    async handleReadCommand(message, args) {
        if (!this.config.enabled) {
            await message.reply('Internet access is disabled.');
            return;
        }

        const url = args[0];
        if (!url) {
            await message.reply('Usage: `> read [URL]` - Reads full website content with censoring applied');
            return;
        }

        if (!this.checkRateLimit(message.author.id)) {
            await message.reply('You are being rate limited. Please wait before making another request.');
            return;
        }

        await message.reply('Reading website content...');

        try {
            const result = await this.readWebsiteContent(url);
            
            // Format response with censoring info
            let responseMessage = `**Website Content [Censoring Level: ${this.config.censoring.level}]:**\n\n`;
            responseMessage += `**URL:** ${result.url}\n`;
            responseMessage += `**Domain:** ${result.domain}\n`;
            responseMessage += `**Title:** ${result.title}\n\n`;
            responseMessage += `**Content:**\n${result.content.substring(0, 1500)}${result.content.length > 1500 ? '...' : ''}\n\n`;
            responseMessage += `**Stats:** ${result.wordCount} words, ~${result.readingTime} min read time`;
            
            if (result.error) {
                responseMessage += `\n\n**Error:** ${result.error}`;
            }
            
            // Split response into chunks if needed
            const chunks = this.bot.splitMessage(responseMessage);
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(chunks[i]);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }
        } catch (error) {
            this.log(`Website reading failed: ${error.message}`, 'error');
            await message.reply(`Website reading failed: ${error.message}`);
        }
    }
}

module.exports = InternetAccessAddon;
