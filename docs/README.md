# Nimbus AI Discord Bot

A powerful Discord bot that integrates with Ollama for local AI processing, featuring token management, model selection, and AI-powered server building.

## Features

- **Local AI Processing** - Uses Ollama for free, private AI responses
- **Multiple AI Models** - Support for Phi, Gemma, and other Ollama models
- **Token Management** - Built-in token economy to manage usage
- **Image Analysis** - AI can analyze uploaded images
- **Server Building** - AI-assisted Discord server creation
- **Model Selection** - Choose specific models with suffixes
- **Slash Commands** - Modern Discord slash command support

## Quick Start

### Prerequisites
- Node.js 16+ 
- Ollama (https://ollama.ai)
- Discord bot token

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure bot (GUI)
configure-discord-bot.bat

# 3. Install AI models (GUI)
omi.bat

# 4. Start bot
npm start
```

## Available Models

| Model | Suffix | Tokens | Size | Description |
|-------|--------|--------|------|-------------|
| Phi 2.7b | `--phi:2.7b` | 1 | 1.6GB | Fast, efficient |
| Gemma3n E4b | `--gemma3n:e4b` | 1 | 7.5GB | Default model |
| Gemma4 26b | `--gemma4:26b` | 4 | 17GB | Advanced reasoning |

## Usage

### Basic Commands
- `> [question]` - Ask AI a question
- `?tokens` - Check remaining tokens
- `?help` - Show help menu
- `/models` - List available models

### Model Selection
- `> Hello world` (uses default model)
- `> Explain physics --phi:2.7b` (uses specific model)
- `> Write code --gemma4:26b` (uses advanced model)

### Image Features
- Upload image with `> What do you see in this image?`
- `> Create a server like this [attach image]`

### Server Building
- `/build` - Open AI server building modal
- AI creates channels, roles, and categories automatically

### Owner Commands
- `!addtokens <user> <amount>` - Give tokens
- `!checktokens <user>` - Check user tokens
- `!ban <user>` - Ban user from bot
- `!models` - Update model list

## Configuration

### Environment Variables (.env)
```env
DISCORDBOTTOKEN=your_bot_token
OWNER_ID=your_user_id
DEFAULT_MODEL=gemma3n:e4b
REQUEST_COOLDOWN=5000
DEFAULT_TOKENS=1
```

### Discord Bot Setup
1. Create application at https://discord.com/developers/applications
2. Enable "Message Content Intent"
3. Invite bot with "Send Messages" permission

## Installers

### Bot Configuration
- `configure-discord-bot.bat` - GUI setup for bot configuration
- `configure-discord-bot.ps1` - PowerShell version

### Model Management  
- `omi.bat` - GUI for installing Ollama models
- `omi.ps1` - PowerShell version with advanced features

## Troubleshooting

### Common Issues
- **Ollama not found**: Install from https://ollama.ai
- **Empty responses**: Check models with `ollama list`
- **Permission errors**: Enable Message Content Intent
- **Model not found**: Install with `omi.bat`

### Debug Commands
- `!debug [question]` - Test model detection
- `!ollama` - Check Ollama connection
- `node check-ollama-models.js` - Verify available models

## File Structure

```
OpenCord/
 discord-ollama-bot.js     # Main bot code
 discord-models.txt        # Model configuration
 tokens.json               # User tokens
 banned-users.json         # Banned users
 .env                      # Environment variables
 discord-models-config.json # Model settings
```

## Security

- Never share your Discord bot token
- Keep `.env` file private
- Only install models from trusted sources
- Regularly update dependencies

## Support

- **Documentation**: See `docs/` folder
- **Issues**: Check console logs first
- **Ollama**: https://ollama.ai/docs
- **Discord**: https://discord.com/developers/docs

## License

This project is provided as-is for educational and personal use.
