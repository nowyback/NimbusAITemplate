# Internet Access Guide

## Overview

Your Discord bot now has controlled internet access capabilities, allowing it to search the web and fetch content from URLs while maintaining security and proper rate limiting.

## Features

### Web Search
- **DuckDuckGo Integration** - Free web search API (no key required)
- **Real-time Results** - Current information from the internet
- **AI Enhancement** - Search results are added to AI context for better responses

### URL Content Fetching
- **Direct URL Access** - Fetch content from specific websites
- **Text Extraction** - Automatically extracts and cleans text content
- **Domain Filtering** - Only allows specified domains for security

### Security Controls
- **Domain Allowlist/Blocklist** - Control which websites can be accessed
- **Rate Limiting** - Prevent abuse with configurable limits per user
- **Content Filtering** - Removes inappropriate content and HTML/scripts

## Configuration

### Enable Internet Access

1. **Run Configuration Tool:**
   ```bash
   config.bat
   ```

2. **Enable Internet Features:**
   - Check "Enable Internet Access"
   - Choose access method (Search Only, URL Fetch Only, or Hybrid)
   - Set allowed domains (optional)
   - Configure rate limits

3. **Save Configuration**

### Environment Variables

The configuration tool creates these settings in your `.env` file:

```env
# Internet Access Configuration
INTERNET_ACCESS=true                    # Enable/disable features
INTERNET_METHOD=hybrid                  # search, fetch, or hybrid
ALLOWED_DOMAINS=wikipedia.org,github.com,stackoverflow.com
RATE_LIMIT=10                           # Requests per minute per user
```

## Usage Commands

### Web Search
```
> search latest AI developments
> search what is quantum computing
> search current weather in New York
```

### URL Content Fetching
```
> fetch https://wikipedia.org/wiki/Artificial_intelligence
> fetch https://github.com/user/repo
> fetch https://stackoverflow.com/questions/123456
```

### Owner Controls
```
> internet on    # Enable internet access (owner only)
> internet off   # Disable internet access (owner only)
```

## Access Methods

### Search Only
- Only web search functionality
- Uses DuckDuckGo API
- Safest option for general use

### URL Fetch Only
- Only direct URL content fetching
- Requires domain allowlist
- Good for specific research tasks

### Hybrid (Recommended)
- Both search and URL fetching
- Maximum flexibility
- Best for comprehensive research

## Security Features

### Domain Filtering
```env
# Allow only specific domains
ALLOWED_DOMAINS=wikipedia.org,github.com,stackoverflow.com

# Allow all domains (leave empty)
ALLOWED_DOMAINS=
```

### Rate Limiting
- **Default:** 10 requests per minute per user
- **Purpose:** Prevent abuse and API overuse
- **Configurable:** Set higher/lower limits as needed

### Content Filtering
- **Automatic HTML removal** - Extracts clean text content
- **Script filtering** - Removes JavaScript and embedded content
- **Domain blocking** - Blocks inappropriate websites

## Examples

### Research Example
```
User: > search benefits of quantum computing
Bot: **Web Search Results [gemma3n:e4b]:**
Based on current web search results, quantum computing offers several key benefits:
1. Exponential speedup for certain calculations
2. Advanced cryptography capabilities
3. Drug discovery and molecular modeling
4. Financial modeling and optimization
[Detailed AI analysis based on search results...]
```

### URL Fetch Example
```
User: > fetch https://wikipedia.org/wiki/Artificial_intelligence
Bot: **URL Content [gemma3n:e4b]:**
Here's a summary of the Wikipedia article on Artificial Intelligence:
AI refers to intelligence demonstrated by machines, particularly computer systems...
[AI provides comprehensive summary and analysis of the content...]
```

## Troubleshooting

### Internet Access Disabled
```
Bot: Internet access is disabled. Use config.bat to enable it.
```
**Solution:** Run `config.bat` and enable internet access.

### Rate Limited
```
Bot: Rate limit exceeded. Please wait before making another request.
```
**Solution:** Wait for the rate limit to reset (default: 1 minute)

### Domain Blocked
```
Bot: Fetch failed: Domain blocked
```
**Solution:** Add the domain to allowed domains list or use a different URL

### Search Failed
```
Bot: Search failed: Network error
```
**Solution:** Check internet connection and try again

## Advanced Configuration

### Custom Domain Allowlist
```env
# Educational domains
ALLOWED_DOMAINS=wikipedia.org,github.com,stackoverflow.com,arxiv.org,mit.edu

# News domains  
ALLOWED_DOMAINS=bbc.com,cnn.com,reuters.com,apnews.com

# Development domains
ALLOWED_DOMAINS=github.com,stackoverflow.com,dev.to,medium.com
```

### Rate Limiting for Different Use Cases
```env
# Personal bot (low usage)
RATE_LIMIT=5

# Community bot (moderate usage)  
RATE_LIMIT=15

# Public bot (high usage)
RATE_LIMIT=25
```

### Method Selection by Use Case
```env
# General chat bot
INTERNET_METHOD=search

# Research assistant
INTERNET_METHOD=hybrid

# Documentation fetcher
INTERNET_METHOD=fetch
```

## Privacy Considerations

- **Search queries** are sent to DuckDuckGo (anonymous)
- **URL content** is fetched directly from websites
- **No personal data** is stored or transmitted
- **All requests** are logged locally for monitoring

## Best Practices

1. **Start with Search Only** - Enable URL fetching only when needed
2. **Use Domain Allowlist** - Restrict to trusted domains
3. **Monitor Usage** - Check logs for abuse patterns
4. **Educate Users** - Teach proper command usage
5. **Regular Updates** - Keep domain lists current

## API Information

### DuckDuckGo Search API
- **Free:** No API key required
- **Anonymous:** No tracking or personal data
- **Reliable:** Stable service with good coverage
- **Rate Limited:** Built-in protection against abuse

### URL Fetching
- **Direct:** HTTP/HTTPS requests to target URLs
- **Filtered:** Content extraction and cleaning
- **Secure:** Domain validation and content filtering
- **Respectful:** Follows robots.txt and rate limits

## Support

For issues with internet access:

1. **Check Configuration:** Verify `.env` settings
2. **Test Connection:** Use `> search test` to verify functionality
3. **Check Logs:** Review bot console for error messages
4. **Verify Domains:** Ensure target domains are allowed
5. **Network Status:** Confirm internet connectivity

## Updates

Internet access features are regularly updated with:
- **New search sources** and API integrations
- **Enhanced security** and filtering capabilities
- **Improved content extraction** and analysis
- **Better rate limiting** and monitoring tools

---

**Note:** Internet access is a powerful feature that should be used responsibly. Always respect website terms of service and user privacy when enabling these capabilities.
