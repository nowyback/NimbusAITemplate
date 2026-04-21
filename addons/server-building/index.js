const AddonBase = require('../../core/addon-base');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

class ServerBuildingAddon extends AddonBase {
    constructor() {
        super('server-building', '1.0.0');
    }

    async onInitialize() {
        // Register slash command
        this.registerSlashCommand('build', this.handleBuildSlashCommand.bind(this), {
            description: 'Build server with AI assistance',
            category: 'administration',
            permissions: ['MANAGE_GUILD']
        });

        this.log('Server building addon initialized');
    }

    getDefaultConfig() {
        return {
            enabled: true,
            building: {
                maxChannels: 50,
                maxRoles: 25,
                maxCategories: 10,
                archiveCategoryName: "Archive",
                deleteRolesOnMove: true,
                createArchiveCategoryIfMissing: true
            },
            ai: {
                model: "llama3:8b",
                maxResponseLength: 2000,
                temperature: 0.7
            },
            templates: {
                gaming: {
                    name: "Gaming Server",
                    description: "A server for gaming communities",
                    categories: ["General", "Gaming", "Voice Channels"],
                    channels: ["welcome", "rules", "announcements", "general-chat", "gaming-chat", "media"],
                    roles: ["Member", "Gamer", "Moderator", "Admin"]
                },
                community: {
                    name: "Community Server",
                    description: "A server for general communities",
                    categories: ["General", "Discussion", "Resources"],
                    channels: ["welcome", "rules", "announcements", "general-chat", "introductions", "resources"],
                    roles: ["Member", "Contributor", "Moderator", "Admin"]
                },
                study: {
                    name: "Study Server",
                    description: "A server for study groups and learning",
                    categories: ["General", "Study Rooms", "Resources"],
                    channels: ["welcome", "rules", "announcements", "general-chat", "study-help", "resources"],
                    roles: ["Student", "Tutor", "Moderator", "Admin"]
                }
            }
        };
    }

    // Register slash command with the bot
    registerSlashCommand(name, handler, options) {
        if (this.bot && this.bot.slashCommands) {
            const builder = new SlashCommandBuilder()
                .setName(name)
                .setDescription(options.description);

            // Add options for build command
            if (name === 'build') {
                builder.addStringOption(option =>
                    option.setName('template')
                        .setDescription('Choose a template or describe your server')
                        .setRequired(false)
                );
            }

            this.bot.slashCommands.push(builder.toJSON());
        }
    }

    // Handle slash command
    async handleSlashCommand(interaction) {
        if (interaction.commandName === 'build') {
            return await this.handleBuildSlashCommand(interaction);
        }
        return false;
    }

    // Handle build slash command
    async handleBuildSlashCommand(interaction) {
        if (!this.config.enabled) {
            await interaction.reply('Server building is disabled.');
            return true;
        }

        // Check permissions
        if (!interaction.member.permissions.has('ManageGuild')) {
            await interaction.reply({
                content: 'You need "Manage Server" permission to use this command.',
                ephemeral: true
            });
            return true;
        }

        // Create modal
        const modal = new ModalBuilder()
            .setCustomId('server-build-modal')
            .setTitle('AI Server Builder');

        // Server description input
        const descriptionInput = new TextInputBuilder()
            .setCustomId('server-description')
            .setLabel('Describe your ideal server or choose a template')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('e.g., "I want a gaming server with channels for different games..."')
            .setRequired(true);

        // Template selection input
        const templateInput = new TextInputBuilder()
            .setCustomId('template-choice')
            .setLabel('Template (gaming, community, study, or custom)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('gaming, community, study, or custom')
            .setRequired(false);

        // Archive option input
        const archiveInput = new TextInputBuilder()
            .setCustomId('archive-option')
            .setLabel('Archive old channels? (keep, move, delete)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('keep, move, or delete')
            .setValue('keep')
            .setRequired(false);

        // Add inputs to modal
        const firstActionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const secondActionRow = new ActionRowBuilder().addComponents(templateInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(archiveInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
        return true;
    }

    // Handle modal submission
    async handleModalSubmit(interaction) {
        if (interaction.customId === 'server-build-modal') {
            await this.processServerBuild(interaction);
            return true;
        }
        return false;
    }

    // Process server build request
    async processServerBuild(interaction) {
        await interaction.deferReply();

        const description = interaction.fields.getTextInputValue('server-description');
        const templateChoice = interaction.fields.getTextInputValue('template-choice').toLowerCase();
        const archiveOption = interaction.fields.getTextInputValue('archive-option').toLowerCase();

        try {
            // Get template or generate custom
            let template;
            if (templateChoice && this.config.templates[templateChoice]) {
                template = this.config.templates[templateChoice];
            } else {
                template = await this.generateCustomTemplate(description);
            }

            // Validate template
            if (!this.validateTemplate(template)) {
                await interaction.editReply('Invalid template configuration.');
                return;
            }

            // Handle old channels
            if (archiveOption !== 'keep') {
                await this.handleOldChannels(interaction.guild, archiveOption);
            }

            // Create new server structure
            const result = await this.createServerStructure(interaction.guild, template);

            // Send success message
            const embed = {
                title: 'Server Built Successfully!',
                color: 0x00FF00,
                description: `Created ${template.name} template`,
                fields: [
                    {
                        name: 'Created Categories',
                        value: result.categories.join('\n') || 'None',
                        inline: false
                    },
                    {
                        name: 'Created Channels',
                        value: result.channels.join('\n') || 'None',
                        inline: false
                    },
                    {
                        name: 'Created Roles',
                        value: result.roles.join('\n') || 'None',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Built by Nimbus AI'
                }
            };

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            this.log(`Server build failed: ${error.message}`, 'error');
            await interaction.editReply(`Server build failed: ${error.message}`);
        }
    }

    // Generate custom template using AI
    async generateCustomTemplate(description) {
        // This is a placeholder - in a real implementation, you would
        // integrate with an AI API to generate a custom template
        
        this.log(`Generating custom template for: "${description}"`);
        
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Return a basic custom template
        return {
            name: "Custom Server",
            description: "A custom server based on your requirements",
            categories: ["General", "Custom"],
            channels: ["welcome", "rules", "general-chat", "custom-chat"],
            roles: ["Member", "Custom Role", "Moderator", "Admin"]
        };
    }

    // Validate template configuration
    validateTemplate(template) {
        if (!template.name || !template.categories || !template.channels || !template.roles) {
            return false;
        }

        if (template.categories.length > this.config.building.maxCategories) {
            return false;
        }

        if (template.channels.length > this.config.building.maxChannels) {
            return false;
        }

        if (template.roles.length > this.config.building.maxRoles) {
            return false;
        }

        return true;
    }

    // Handle old channels
    async handleOldChannels(guild, archiveOption) {
        switch (archiveOption) {
            case 'delete':
                await this.deleteOldChannels(guild);
                break;
            case 'move':
                await this.archiveOldChannels(guild);
                break;
            case 'keep':
            default:
                // Do nothing
                break;
        }
    }

    // Delete old channels
    async deleteOldChannels(guild) {
        const channels = guild.channels.cache.filter(c => c.type === 0); // Text channels only
        for (const channel of channels) {
            try {
                await channel.delete('Archived by AI Server Building Assistant');
                this.log(`Deleted channel: ${channel.name}`);
            } catch (error) {
                this.log(`Failed to delete channel ${channel.name}: ${error.message}`, 'warn');
            }
        }
    }

    // Archive old channels
    async archiveOldChannels(guild) {
        let archiveCategory = guild.channels.cache.find(c => 
            c.name === this.config.building.archiveCategoryName && c.type === 4
        );
        
        if (!archiveCategory && this.config.building.createArchiveCategoryIfMissing) {
            archiveCategory = await guild.channels.create({
                name: this.config.building.archiveCategoryName,
                type: 4, // Category
                reason: 'Created by AI Server Building Assistant'
            });
        }

        if (archiveCategory) {
            const channels = guild.channels.cache.filter(c => c.type === 0 && c.parentId !== archiveCategory.id);
            for (const channel of channels) {
                try {
                    await channel.setParent(archiveCategory.id, 'Archived by AI Server Building Assistant');
                    this.log(`Archived channel: ${channel.name}`);
                } catch (error) {
                    this.log(`Failed to archive channel ${channel.name}: ${error.message}`, 'warn');
                }
            }
        }
    }

    // Create server structure
    async createServerStructure(guild, template) {
        const result = {
            categories: [],
            channels: [],
            roles: []
        };

        // Create categories
        for (const categoryName of template.categories) {
            try {
                const category = await guild.channels.create({
                    name: categoryName,
                    type: 4, // Category
                    reason: 'Created by AI Server Building Assistant'
                });
                result.categories.push(category.name);
                template.categories[categoryName] = category;
            } catch (error) {
                this.log(`Failed to create category ${categoryName}: ${error.message}`, 'warn');
            }
        }

        // Create channels
        for (const channelName of template.channels) {
            try {
                // Determine category for this channel
                let parentCategory = null;
                for (const [catName, category] of Object.entries(template.categories)) {
                    if (typeof category === 'object' && category.id) {
                        parentCategory = category;
                        break;
                    }
                }

                const channel = await guild.channels.create({
                    name: channelName,
                    type: 0, // Text channel
                    parent: parentCategory,
                    reason: 'Created by AI Server Building Assistant'
                });
                result.channels.push(channel.name);
            } catch (error) {
                this.log(`Failed to create channel ${channelName}: ${error.message}`, 'warn');
            }
        }

        // Create roles
        for (const roleName of template.roles) {
            try {
                const role = await guild.roles.create({
                    name: roleName,
                    reason: 'Created by AI Server Building Assistant'
                });
                result.roles.push(role.name);
            } catch (error) {
                this.log(`Failed to create role ${roleName}: ${error.message}`, 'warn');
            }
        }

        return result;
    }
}

module.exports = ServerBuildingAddon;
