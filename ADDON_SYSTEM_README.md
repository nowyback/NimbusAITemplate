# Nimbus AI Bot - Addon System

This document describes the new modular addon system for the Nimbus AI Discord bot.

## Overview

The addon system transforms the monolithic bot code into a modular, extensible architecture where features are packaged as independent addons. This makes the code more maintainable, testable, and allows for easy feature addition/removal.

## Architecture

### Core System
- **core/bot.js** - Main bot class with Discord client management
- **core/addon-base.js** - Base class for all addons
- **core/registry.js** - Addon loading and management
- **core/events.js** - Event system for inter-addon communication
- **core/config.js** - Centralized configuration management

### Addons
- **addons/internet-access/** - Web search, URL fetching, website reading
- **addons/image-processing/** - Image generation and analysis
- **addons/server-building/** - AI-powered server setup
- **addons/auto-moderation/** - (Future) Content moderation
- **addons/server-management/** - (Future) Server administration

## Benefits

### Modularity
- Each feature is self-contained
- Easy to enable/disable features
- Clear separation of concerns

### Maintainability
- Smaller, focused code files
- Easier debugging and testing
- Independent feature development

### Extensibility
- Simple addon creation process
- No need to modify core code
- Shared addon marketplace potential

### Performance
- Load only needed addons
- Reduced memory footprint
- Faster startup times

## Migration

### From Old System
1. Run the migration script:
   ```bash
   node migrate-to-addons.js
   ```

2. This will:
   - Create backup of original files
   - Generate new configuration files
   - Migrate settings from .env

### Configuration Files
- **config/bot-config.json** - Main bot configuration
- **config/addons.json** - Addon-specific settings

## Usage

### Starting the Bot
```bash
# Old system
npm start

# New addon system
npm run start-addon
```

### Managing Addons
Use Discord commands:
- `/addons list` - Show all addons
- `/addons enable [addon]` - Enable an addon (owner only)
- `/addons disable [addon]` - Disable an addon (owner only)

### Available Commands
- **Internet Access**: `> search`, `> fetch`, `> read`
- **Image Processing**: `> generate`, `> analyze`
- **Server Building**: `/build` (slash command)

## Creating Addons

### Basic Structure
```
addons/my-addon/
  package.json          # Addon metadata
  index.js              # Main addon class
  config.json           # Default configuration
```

### Addon Class
```javascript
const AddonBase = require('../../core/addon-base');

class MyAddon extends AddonBase {
    constructor() {
        super('my-addon', '1.0.0');
    }

    async onInitialize() {
        // Register commands
        this.registerCommand('hello', this.handleHello.bind(this), {
            description: 'Say hello',
            category: 'utility'
        });
    }

    async handleHello(message, args) {
        await message.reply('Hello from my addon!');
    }
}

module.exports = MyAddon;
```

### Package.json
```json
{
  "name": "my-addon",
  "version": "1.0.0",
  "description": "My custom addon",
  "main": "index.js",
  "dependencies": {},
  "addon": {
    "name": "My Addon",
    "category": "utility",
    "permissions": [],
    "dependencies": []
  }
}
```

## Configuration

### Environment Variables
The system still supports environment variables. They are automatically migrated to the new config system.

### Addon Configuration
Each addon can have its own configuration in:
- `config/addons.json` (global)
- `addons/[addon]/config.json` (defaults)

### Runtime Configuration
Configuration can be updated at runtime through the bot's API or by editing the config files.

## Event System

The addon system includes an event bus for inter-addon communication:

```javascript
const { eventBus, Events } = require('./core/events');

// Emit event
eventBus.emit(Events.CUSTOM_EVENT, data, 'my-addon');

// Listen for event
eventBus.on(Events.CUSTOM_EVENT, (event) => {
    console.log('Received event:', event.data);
});
```

## Development

### Testing Addons
Each addon can be tested independently:
```bash
node addons/my-addon/test.js
```

### Debugging
Enable debug logging:
```bash
DEBUG=* npm run start-addon
```

### Hot Reloading
Addons can be reloaded without restarting the bot:
```javascript
await bot.registry.reloadAddon('my-addon');
```

## Future Addons

### Auto Moderation
- Content filtering
- Spam detection
- Auto-moderation rules
- Warning system

### Server Management
- Server configuration
- Permission management
- User management
- Analytics dashboard

## Troubleshooting

### Common Issues

**Addon fails to load**
- Check package.json syntax
- Verify dependencies
- Check console logs for errors

**Configuration not applied**
- Ensure config files are valid JSON
- Check file permissions
- Verify environment variables

**Commands not working**
- Check addon is enabled
- Verify user permissions
- Check command registration

### Getting Help
1. Check console logs for errors
2. Verify configuration files
3. Test individual addons
4. Check Discord permissions

## Migration Checklist

- [ ] Run migration script
- [ ] Review generated config files
- [ ] Test new addon system
- [ ] Verify all features work
- [ ] Update deployment scripts
- [ ] Update documentation

## Security Considerations

- Addon permissions are enforced
- Configuration validation
- Rate limiting per addon
- Safe addon loading/unloading

## Performance

- Lazy loading of addons
- Event-driven architecture
- Minimal memory footprint
- Efficient command routing

## Contributing

When creating new addons:
1. Follow the addon structure
2. Include proper error handling
3. Add configuration validation
4. Write tests
5. Update documentation

## License

This addon system is licensed under the MIT License, same as the original Nimbus AI bot.
