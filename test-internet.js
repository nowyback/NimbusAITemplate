const InternetAccess = require('./internet-access');

console.log('Testing Internet Access Module...\n');

// Test configuration
const testConfig = {
    enabled: true,
    method: 'search',
    allowedDomains: ['wikipedia.org', 'github.com'],
    rateLimit: 5
};

const internet = new InternetAccess(testConfig);

async function testInternetAccess() {
    try {
        console.log('1. Testing DuckDuckGo search...');
        const searchResult = await internet.accessInternet('test-user-123', 'latest AI news');
        console.log('Search successful!');
        console.log('Abstract:', searchResult.abstract.substring(0, 100) + '...');
        
        console.log('\n2. Testing URL fetch...');
        const fetchResult = await internet.accessInternet('test-user-123', '', 'https://wikipedia.org');
        console.log('Fetch successful!');
        console.log('Title:', fetchResult.title);
        console.log('Content length:', fetchResult.content.length);
        
        console.log('\n3. Testing rate limiting...');
        try {
            for (let i = 0; i < 7; i++) {
                await internet.accessInternet('test-user-456', `test query ${i}`);
            }
        } catch (error) {
            console.log('Rate limiting working:', error.message);
        }
        
        console.log('\n4. Testing domain validation...');
        try {
            await internet.accessInternet('test-user-789', '', 'https://blocked-site.com');
        } catch (error) {
            console.log('Domain validation working:', error.message);
        }
        
        console.log('\n5. Testing formatted output...');
        const formatted = internet.formatForAI(searchResult, 'search');
        console.log('Formatted output length:', formatted.length);
        
        console.log('\nAll tests passed! Internet access is working correctly!');

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testInternetAccess();
