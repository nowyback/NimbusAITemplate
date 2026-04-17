# Discord-Ollama Setup Guide

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file with your Discord bot details:
```env
DISCORDBOTTOKEN=your_discord_bot_token_here
OWNER_ID=your_discord_user_id_here
VERSION=1.0.0
```

### 3. Start the Bot
```bash
npm start
```

## Discord Bot Commands

### User Commands
- `?tokens` - Check remaining tokens
- `> [question]` - Ask a question (uses tokens)
- `?help` - Show available models and help

### Model Selection
- `> your question` - Uses default Llama 3 8B model (1 token)
- `> your question --4.1mini` - Uses Llama 3 8B Instruct (2 tokens)
- `> your question --code` - Uses Code Llama 7B (2 tokens)
- `> your question --mixtral` - Uses Mixtral 8x7B (6 tokens)

### Owner Commands (DM only)
- `!addtokens <userId> <amount>` - Give tokens to user
- `!checktokens <userId>` - Check user's tokens
- `!tokenstatus` - Show total users with tokens
- `!ban <userId>` - Ban user from bot
- `!unban <userId>` - Unban user
- `!banned` - Show banned users
- `!prompts` - Show recent prompt history

## Available Models & Costs

| Model | Tokens | Description |
|-------|--------|-------------|
| Llama 3 8B | 1 | Fast, efficient - great for general use |
| Llama 3 8B Instruct | 2 | Optimized for instructions and conversations |
| Llama 3 70B | 4 | Very powerful, high-quality responses |
| Llama 3 70B Instruct | 9 | Premium quality for complex tasks |
| Code Llama 7B | 2 | Specialized for programming and code |
| Code Llama 13B | 3 | Advanced coding capabilities |
| Mistral 7B | 2 | Fast and capable, good for chat |
| Mixtral 8x7B | 6 | Advanced reasoning and coding |
| Qwen 7B | 2 | Strong reasoning capabilities |
| Phi-2 Mini | 1 | Very small, fast for simple tasks |
| Gemma 7B | 2 | Google's open model, good performance |

## How It Works

1. **Token System**: Users start with 1 token, owners can add more
2. **Cooldown**: 5 seconds between requests per user
3. **Model Detection**: Bot automatically detects model from suffixes
4. **Processing**: Shows live updates while processing questions
5. **Logging**: Tracks all prompts and responses
6. **Safety**: Includes user banning and prompt logging

## Ollama Integration

The bot uses Ollama's REST API for reliable communication with local AI models:
- **API Endpoint**: `http://localhost:11434/api/chat`
- **Request Format**: JSON with model and messages
- **3-minute timeout** for responses
- **Automatic error handling** with helpful messages
- **Response truncation** for Discord limits
- **Better reliability** than command-line interface

### API Request Example:
```json
{
  "model": "llama3:8b",
  "messages": [
    { "role": "user", "content": "why is the sky blue?" }
  ],
  "stream": false
}
```

## Troubleshooting

### Bot can't find Ollama
- Make sure Ollama is installed and running
- Check that models are downloaded: `ollama list`
- Test manually: `ollama run llama3:8b "test"`

### Discord connection issues
- Verify bot token in `.env`
- Check bot has proper Discord permissions
- Ensure OWNER_ID is correct

### Model not found
- Download missing models: `ollama pull [model]`
- Check model names in `token-bot.js`
- Update model mapping if needed

## Security Features

- **User banning**: Prevent abuse
- **Token limits**: Control usage
- **Cooldown**: Prevent spam
- **Prompt logging**: Track usage
- **Error handling**: Graceful failures

## Performance

- **Local AI**: No API costs, fast responses
- **Model variety**: Multiple AI models available
- **Token economy**: Fair usage distribution
- **Live updates**: Real-time processing feedback
