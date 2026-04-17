const https = require('https');
const http = require('http');
const { URL } = require('url');

class InternetAccess {
    constructor(config = {}) {
        this.enabled = config.enabled || false;
        this.method = config.method || 'search'; // 'search', 'fetch', 'hybrid'
        this.searchApiKey = config.searchApiKey || null;
        this.allowedDomains = config.allowedDomains || [];
        this.rateLimit = config.rateLimit || 10;
        this.userRequests = new Map(); // Track user request times
        this.blockedDomains = config.blockedDomains || [
            'pornhub.com', 'xvideos.com', 'adultfriendfinder.com',
            'malware.com', 'virus.com' // Add more as needed
        ];
    }

    // Check if user is rate limited
    checkRateLimit(userId) {
        const now = Date.now();
        const userRequests = this.userRequests.get(userId) || [];
        
        // Remove requests older than 1 minute
        const recentRequests = userRequests.filter(time => now - time < 60000);
        
        if (recentRequests.length >= this.rateLimit) {
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
            if (this.blockedDomains.some(blocked => domain.includes(blocked))) {
                return { valid: false, reason: 'Domain blocked' };
            }
            
            // If allowlist exists, check it
            if (this.allowedDomains.length > 0) {
                const allowed = this.allowedDomains.some(allowed => domain.includes(allowed));
                if (!allowed) {
                    return { valid: false, reason: 'Domain not in allowlist' };
                }
            }
            
            return { valid: true, domain };
        } catch (error) {
            return { valid: false, reason: 'Invalid URL' };
        }
    }

    // DuckDuckGo Instant Answer API (free, no key required)
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
                                relatedTopics: (result.RelatedTopics || []).slice(0, 3).map(topic => ({
                                    title: topic.Text ? topic.Text.substring(0, 100) + '...' : '',
                                    url: topic.FirstURL || ''
                                })).filter(topic => topic.title),
                                results: (result.Results || []).slice(0, 3).map(item => ({
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
                timeout: 10000
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
                            content: textContent.substring(0, 2000), // Limit content length
                            statusCode: res.statusCode
                        });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    // Extract text content from HTML (basic implementation)
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
        
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ');
        text = text.trim();
        
        return text;
    }

    // Extract title from HTML
    extractTitle(html) {
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return titleMatch ? titleMatch[1].trim() : 'No title found';
    }

    // Main internet access method
    async accessInternet(userId, query, url = null) {
        if (!this.enabled) {
            throw new Error('Internet access is disabled');
        }

        if (!this.checkRateLimit(userId)) {
            throw new Error('Rate limit exceeded. Please wait before making another request.');
        }

        try {
            if (url && (this.method === 'fetch' || this.method === 'hybrid')) {
                return await this.fetchUrl(url);
            } else if (!url && (this.method === 'search' || this.method === 'hybrid')) {
                return await this.searchDuckDuckGo(query);
            } else {
                throw new Error('Invalid request for current internet access method');
            }
        } catch (error) {
            throw new Error(`Internet access failed: ${error.message}`);
        }
    }

    // Format search results for AI
    formatForAI(result, type = 'search') {
        if (type === 'search') {
            let formatted = `Web search results for "${result.query}":\n\n`;
            
            if (result.abstract) {
                formatted += `Summary: ${result.abstract}\n\n`;
            }
            
            if (result.relatedTopics && result.relatedTopics.length > 0) {
                formatted += `Related Topics:\n`;
                result.relatedTopics.forEach((topic, index) => {
                    formatted += `${index + 1}. ${topic.title}\n`;
                });
                formatted += '\n';
            }
            
            if (result.results && result.results.length > 0) {
                formatted += `Results:\n`;
                result.results.forEach((result, index) => {
                    formatted += `${index + 1}. ${result.title}\n`;
                });
            }
            
            return formatted;
        } else if (type === 'fetch') {
            return `Content from ${result.url} (${result.domain}):\n\nTitle: ${result.title}\n\nContent: ${result.content}`;
        }
        
        return 'No information available.';
    }
}

module.exports = InternetAccess;
