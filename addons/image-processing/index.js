const AddonBase = require('../../core/addon-base');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ImageProcessingAddon extends AddonBase {
    constructor() {
        super('image-processing', '1.0.0');
        this.processingImages = new Map();
    }

    async onInitialize() {
        // Register commands
        this.registerCommand('generate', this.handleGenerateCommand.bind(this), {
            description: 'Generate an AI image',
            usage: '> generate [description]',
            category: 'image',
            cooldown: 10000
        });

        this.registerCommand('analyze', this.handleAnalyzeCommand.bind(this), {
            description: 'Analyze an attached image',
            usage: '> analyze [question]',
            category: 'image',
            cooldown: 5000
        });

        this.log('Image processing addon initialized');
    }

    getDefaultConfig() {
        return {
            enabled: true,
            generation: {
                enabled: true,
                defaultModel: 'dall-e',
                maxSize: "1024x1024",
                quality: "standard",
                maxRequestsPerHour: 5
            },
            analysis: {
                enabled: true,
                maxImageSize: "20MB",
                supportedFormats: ["png", "jpg", "jpeg", "gif", "webp"]
            },
            processing: {
                timeout: 30000,
                maxConcurrent: 3
            }
        };
    }

    // Check if user is rate limited for image generation
    checkGenerationRateLimit(userId) {
        if (!this.config.generation.enabled) {
            return false;
        }

        const now = Date.now();
        const userRequests = this.processingImages.get(userId) || [];
        
        // Remove requests older than 1 hour
        const recentRequests = userRequests.filter(time => now - time < 3600000);
        
        if (recentRequests.length >= this.config.generation.maxRequestsPerHour) {
            return false; // Rate limited
        }
        
        recentRequests.push(now);
        this.processingImages.set(userId, recentRequests);
        return true; // Allowed
    }

    // Download image from URL
    async downloadImage(url, filepath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            const client = url.startsWith('https') ? https : http;
            
            const request = client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
                
                file.on('error', (error) => {
                    fs.unlink(filepath, () => {}); // Delete the file on error
                    reject(error);
                });
            });
            
            request.on('error', (error) => {
                fs.unlink(filepath, () => {}); // Delete the file on error
                reject(error);
            });
            
            request.setTimeout(this.config.processing.timeout, () => {
                request.destroy();
                fs.unlink(filepath, () => {}); // Delete the file on timeout
                reject(new Error('Download timeout'));
            });
        });
    }

    // Get image from Discord attachment
    async getDiscordImage(attachment) {
        if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            throw new Error('Attachment is not an image');
        }

        const extension = attachment.name.split('.').pop().toLowerCase();
        if (!this.config.analysis.supportedFormats.includes(extension)) {
            throw new Error(`Unsupported image format: ${extension}`);
        }

        // Check file size
        if (attachment.size > this.parseSize(this.config.analysis.maxImageSize)) {
            throw new Error('Image too large');
        }

        const tempDir = path.join(__dirname, '..', '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filepath = path.join(tempDir, `image_${Date.now()}_${attachment.name}`);
        await this.downloadImage(attachment.url, filepath);
        
        return filepath;
    }

    // Parse size string to bytes
    parseSize(sizeStr) {
        const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
        if (!match) return 0;
        return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
    }

    // Generate image using AI (placeholder implementation)
    async generateImage(description) {
        // This is a placeholder - in a real implementation, you would
        // integrate with an image generation API like DALL-E, Midjourney, etc.
        
        this.log(`Image generation request: "${description}"`);
        
        // Simulate image generation delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Return a mock result for now
        return {
            url: 'https://via.placeholder.com/512x512/0099FF/FFFFFF?text=' + encodeURIComponent(description.substring(0, 20)),
            description: description,
            model: this.config.generation.defaultModel,
            size: this.config.generation.maxSize,
            quality: this.config.generation.quality
        };
    }

    // Analyze image using AI (placeholder implementation)
    async analyzeImage(imagePath, question) {
        // This is a placeholder - in a real implementation, you would
        // integrate with an image analysis API like GPT-4 Vision, etc.
        
        this.log(`Image analysis request: "${question}" for image: ${imagePath}`);
        
        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Return a mock analysis for now
        const analyses = [
            "This image appears to contain various visual elements with interesting colors and composition.",
            "I can see this is a digital image with certain characteristics that make it unique.",
            "The image shows content that could be described as having artistic or informational value.",
            "Based on the visual elements, this image seems to serve a specific purpose or convey a message."
        ];
        
        return analyses[Math.floor(Math.random() * analyses.length)];
    }

    // Handle generate command
    async handleGenerateCommand(message, args) {
        if (!this.config.generation.enabled) {
            await message.reply('Image generation is disabled.');
            return;
        }

        const description = args.join(' ');
        if (!description) {
            await message.reply('Usage: `> generate [description]`');
            return;
        }

        if (!this.checkGenerationRateLimit(message.author.id)) {
            await message.reply(`You can generate up to ${this.config.generation.maxRequestsPerHour} images per hour. Please try again later.`);
            return;
        }

        // Check if user has enough tokens (if token system is enabled)
        if (this.bot && this.bot.useUserTokens) {
            const tokenCost = 5; // Example cost for image generation
            if (!this.bot.useUserTokens(message.author.id, tokenCost)) {
                await message.reply(`You don't have enough tokens. Image generation costs ${tokenCost} tokens.`);
                return;
            }
        }

        await message.reply('Generating image... This may take a moment.');

        try {
            const result = await this.generateImage(description);
            
            const embed = {
                title: 'Generated Image',
                color: 0x0099FF,
                description: `**Description:** ${description}`,
                image: {
                    url: result.url
                },
                fields: [
                    {
                        name: 'Generation Details',
                        value: `**Model:** ${result.model}\n**Size:** ${result.size}\n**Quality:** ${result.quality}`,
                        inline: false
                    }
                ],
                footer: {
                    text: 'Generated by Nimbus AI'
                }
            };

            await message.reply({ embeds: [embed] });
        } catch (error) {
            this.log(`Image generation failed: ${error.message}`, 'error');
            await message.reply(`Image generation failed: ${error.message}`);
        }
    }

    // Handle analyze command
    async handleAnalyzeCommand(message, args) {
        if (!this.config.analysis.enabled) {
            await message.reply('Image analysis is disabled.');
            return;
        }

        if (message.attachments.size === 0) {
            await message.reply('Please attach an image to analyze.');
            return;
        }

        const attachment = message.attachments.first();
        const question = args.join(' ') || 'What do you see in this image?';

        await message.reply('Analyzing image...');

        try {
            // Download the image
            const imagePath = await this.getDiscordImage(attachment);
            
            try {
                // Analyze the image
                const analysis = await this.analyzeImage(imagePath, question);
                
                const embed = {
                    title: 'Image Analysis',
                    color: 0x0099FF,
                    description: `**Question:** ${question}`,
                    fields: [
                        {
                            name: 'Analysis',
                            value: analysis,
                            inline: false
                        },
                        {
                            name: 'Image Details',
                            value: `**File:** ${attachment.name}\n**Size:** ${this.formatFileSize(attachment.size)}\n**Type:** ${attachment.contentType}`,
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Analyzed by Nimbus AI'
                    }
                };

                await message.reply({ embeds: [embed] });
            } finally {
                // Clean up temporary file
                try {
                    fs.unlinkSync(imagePath);
                } catch (error) {
                    this.log(`Failed to clean up temporary file: ${error.message}`, 'warn');
                }
            }
        } catch (error) {
            this.log(`Image analysis failed: ${error.message}`, 'error');
            await message.reply(`Image analysis failed: ${error.message}`);
        }
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = ImageProcessingAddon;
