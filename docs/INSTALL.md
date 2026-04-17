# Discord AI Bot - Installation Guide

## Quick Start (Recommended)

1. **Run the installer:**
   ```bash
   # Windows
   configure-discord-bot.bat
   
   # Or manually with PowerShell
   powershell -ExecutionPolicy Bypass -File configure-discord-bot.ps1
   ```

2. **Fill in your bot details:**
   - Discord Bot Token
   - Your Discord User ID (Owner ID)
   - Bot version (optional)

3. **Auto-detect models:**
   - The installer will automatically find your local Ollama models
   - Creates proper model configuration with suffixes
   - Calculates token costs based on model size

4. **Start the bot:**
   ```bash
   npm start
   ```

## Manual Installation

### Prerequisites
- Node.js 16+ 
- Ollama installed and running
- At least one Ollama model pulled
- Discord Bot Application created

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Configuration Files

#### Create `.env` file:
```bash
# Discord Bot Configuration
DISCORDBOTTOKEN=YOUR_ACTUAL_BOT_TOKEN
OWNER_ID=YOUR_DISCORD_USER_ID
VERSION=1.0.0
DEFAULT_MODEL=gemma3n:e4b
REQUEST_COOLDOWN=5
DEFAULT_TOKENS=1
```

#### Create `discord-models.txt` file:
```bash
# Format: model:release,cost
gemma3n:e4b,1
phi:2.7b,1
gemma4:26b,4
```

### Step 3: Pull Ollama Models (if needed)
```bash
ollama pull gemma3n:e4b
ollama pull phi:2.7b
ollama pull gemma4:26b
```

### Step 4: Start the Bot
```bash
npm start
```

## Configuration Details

### Model Suffixes
The bot automatically creates suffixes for model selection:
- `gemma3n:e4b` becomes `--gemma3ne4b`
- `phi:2.7b` becomes `--phi27b`
- `gemma4:26b` becomes `--gemma426b`

Usage:
```
> What is 2+2? --gemma3ne4b
> Explain quantum physics --gemma426b
```

### Token Costs
The installer automatically calculates costs:
- **Small models (2B-4B):** 1 token
- **Medium models (7B-8B):** 2 tokens  
- **Medium-large (13B-26B):** 6 tokens
- **Large models (70B+):** 9 tokens

### Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a New Application
3. Add a Bot to the application
4. Enable **Message Content Intent**
5. Copy the Bot Token
6. Get your User ID (right-click your name in Discord)
7. Invite the bot to your server

## Features

### Commands
- **Slash Commands:** `/models`, `/tokens`, `/help`, `/build`
- **Prefix Commands:** `> question`, `>> build`, `?help`, `!models`
- **Image Support:** Upload images with questions
- **AI Image Generation:** Ask to generate images

### Model Selection
- **Automatic:** Uses default model
- **Manual:** Use suffixes like `--gemma3ne4b`
- **Fallback:** Auto-switches models on empty responses

### Admin Features
- **Server Building:** `/build` command with modal interface
- **Token Management:** Give/remove user tokens
- **User Management:** Ban/unban users
- **Model Management:** Sync with Ollama models

## Troubleshooting

### Common Issues

#### "AI returned an empty response"
- **Cause:** Model compatibility issues (common with phi:2.7b)
- **Solution:** Bot automatically falls back to other models
- **Manual:** Use a different model with suffix

#### "Ollama not found"
- **Solution:** Install Ollama and add to PATH
- **Windows:** Run installer as Administrator
- **Linux:** `curl -fsSL https://ollama.ai/install.sh | sh`

#### "Discord API Error"
- **Check:** Bot has Message Content Intent enabled
- **Check:** Bot token is correct
- **Check:** Bot is invited to the server

#### Model Detection Fails
- **Check:** Ollama is running (`ollama list`)
- **Check:** Models are pulled (`ollama pull llama3:8b`)
- **Solution:** Use manual configuration

### Getting Help
1. Check console logs for detailed error messages
2. Use `!help` command in Discord
3. Check if Ollama is running: `ollama list`
4. Verify Discord bot permissions

## Advanced Configuration

### Environment Variables
```bash
# Optional settings
MAX_PROMPT_LOG_ENTRIES=1000
BOT_PREFIX=>
HELP_PREFIX=?
BUILD_ENABLED=false
```

### Model Configuration
Edit `discord-models.txt` to customize:
```bash
# model:release,cost
custom:model,3
another:model,5
```

### Port Configuration
The bot uses:
- **Ollama:** localhost:11434
- **Discord:** Default ports

## Security Notes

- Keep your bot token secret
- Don't share `.env` file
- Use secure passwords for bot accounts
- Regularly update dependencies
- Monitor token usage

## Performance Tips

- Use smaller models for simple questions
- Use larger models for complex tasks
- Monitor Ollama memory usage
- Adjust cooldowns for high-traffic servers

## Support

For issues:
1. Check this guide first
2. Review console logs
3. Test with simple commands
4. Verify Ollama installation
5. Check Discord bot permissions

## Updates

To update the bot:
```bash
git pull
npm install
npm start
```

Configuration files are preserved during updates.
