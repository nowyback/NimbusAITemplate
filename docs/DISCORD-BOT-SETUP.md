# Discord Bot Configuration Guide

## Quick Setup

### 1. Run Configuration Tool
```bash
# Windows
configure-discord-bot.bat

# Or directly with PowerShell
powershell -ExecutionPolicy Bypass -File ".\configure-discord-bot.ps1"
```

### 2. Configure Settings
The configuration tool will help you set up:

**Required Settings:**
- **Discord Bot Token** - Your bot's token from Discord Developer Portal
- **Owner Discord ID** - Your Discord user ID (right-click your name in Discord)
- **Bot Version** - Version number for your bot

**Optional Settings:**
- **Default Model** - Which AI model to use by default
- **Request Cooldown** - Seconds between user requests (default: 5)
- **Default User Tokens** - Starting tokens for new users (default: 1)

### 3. Configure Model Costs
Edit `models-config.json` to customize:
- Token costs for each model
- Enable/disable specific models
- Model descriptions and suffixes

### 4. Start the Bot
```bash
npm start
```

## Configuration Files

### `.env` - Environment Configuration
```env
# Discord Bot Configuration
DISCORDBOTTOKEN=your_discord_bot_token_here
OWNER_ID=your_discord_user_id_here
VERSION=1.1.3
DEFAULT_MODEL=gemma3n:e4b
REQUEST_COOLDOWN=5000
DEFAULT_TOKENS=1

# Optional: Custom settings
# MAX_PROMPT_LOG_ENTRIES=1000
# BOT_PREFIX=>
# HELP_PREFIX=?
```

### `models-config.json` - Model Configuration
```json
{
  "models": {
    "llama3:8b": {
      "name": "Llama 3 8B",
      "suffix": null,
      "tokens": 1,
      "description": "Fast, efficient - great for general use",
      "enabled": true
    },
    "llama3:8b-instruct": {
      "name": "Llama 3 8B Instruct",
      "suffix": "--4.1mini",
      "tokens": 2,
      "description": "Optimized for instructions and conversations",
      "enabled": true
    }
  }
}
```

## Model Token Costs

| Model | Tokens | Description | Suffix |
|-------|--------|-------------|--------|
| Llama 3 8B | 1 | Fast, efficient | none |
| Llama 3 8B Instruct | 2 | Better conversations | `--4.1mini` |
| Llama 3 70B | 4 | Very powerful | `--5mini` |
| Llama 3 70B Instruct | 9 | Premium quality | `--5.2pro` |
| Code Llama 7B | 2 | Programming help | `--code` |
| Code Llama 13B | 3 | Advanced coding | `--code13` |
| Mistral 7B | 2 | Fast chat | `--mistral` |
| Mixtral 8x7B | 6 | Advanced reasoning | `--mixtral` |
| Qwen 7B | 2 | Strong reasoning | `--qwen` |
| Phi-2 Mini | 1 | Ultra-fast | `--phi` |
| Gemma 7B | 2 | Google model | `--gemma` |

## Discord Commands

### User Commands
- `?tokens` - Check remaining tokens
- `> [question]` - Ask a question (uses tokens)
- `> [question] --suffix` - Use specific model
- `?help` - Show available models and help

### Owner Commands (DM only)
- `!addtokens <userId> <amount>` - Give tokens to user
- `!checktokens <userId>` - Check user's tokens
- `!tokenstatus` - Show total users with tokens
- `!ban <userId>` - Ban user from bot
- `!unban <userId>` - Unban user
- `!banned` - Show banned users
- `!prompts` - Show recent prompt history

## Getting Your Discord ID

1. Open Discord
2. Go to User Settings > Advanced
3. Enable "Developer Mode"
4. Right-click your username
5. Select "Copy User ID"

## Getting Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create or select your application
3. Go to "Bot" section
4. Click "Reset Token" to get your token
5. Copy the token (keep it secret!)

## Customizing Model Costs

Edit `models-config.json`:

```json
{
  "models": {
    "your:model": {
      "name": "Your Model Name",
      "suffix": "--your-suffix",
      "tokens": 5,
      "description": "Model description",
      "enabled": true
    }
  }
}
```

**Settings:**
- `tokens`: Cost in tokens per question
- `enabled`: Whether users can select this model
- `suffix`: Command suffix to trigger this model
- `description`: Help text for users

## Security Best Practices

1. **Never share your bot token** - Keep it secret
2. **Use strong owner ID** - Only you should have owner commands
3. **Set reasonable cooldowns** - Prevent spam (5+ seconds)
4. **Monitor token usage** - Check with `!tokenstatus`
5. **Ban abusive users** - Use `!ban <userId>`

## Troubleshooting

### Bot won't start
- Check `.env` file exists and has correct format
- Verify Discord bot token is valid
- Ensure Ollama is installed and running

### Users can't use bot
- Check if users have tokens: `!checktokens <userId>`
- Add tokens if needed: `!addtokens <userId> <amount>`
- Verify user isn't banned: `!banned`

### Models not working
- Ensure models are installed: `ollama list`
- Download missing models: `ollama pull <model>`
- Check model names in `models-config.json`

### Configuration issues
- Run `config.bat` to reconfigure
- Check `.env` file syntax
- Verify all required fields are filled

## Advanced Configuration

### Custom Prefixes
```env
BOT_PREFIX=!
HELP_PREFIX=@
```

### Performance Tuning
```env
REQUEST_COOLDOWN=3000
MAX_PROMPT_LOG_ENTRIES=500
```

### Model Restrictions
```json
{
  "models": {
    "expensive:model": {
      "enabled": false,
      "tokens": 20
    }
  }
}
```

## Backup and Recovery

### Backup Configuration
```bash
# Copy configuration files
copy .env .env.backup
copy models-config.json models-config.json.backup
copy tokens.json tokens.json.backup
```

### Restore Configuration
```bash
# Restore from backup
copy .env.backup .env
copy models-config.json.backup models-config.json
copy tokens.json.backup tokens.json
```

## Multiple Bots

You can run multiple bots with different configurations:

1. Create separate folders for each bot
2. Copy configuration files
3. Update `.env` with different tokens
4. Run each bot from its folder

## Support

For issues with:
- **Discord API**: Check Discord Developer Portal
- **Ollama**: Check Ollama documentation
- **Configuration**: Run `config.bat` for guided setup
