import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Test script to verify OpenAI API key is working
async function testOpenAIConnection() {
  console.log('[OpenAI Test] Starting OpenAI API key test...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[OpenAI Test] ERROR: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  console.log('[OpenAI Test] API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    const openai = createOpenAI({
      apiKey: apiKey,
    });
    
    console.log('[OpenAI Test] OpenAI client created successfully');
    
    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: 'Say "Hello, Zero!" in a friendly way.',
      maxTokens: 50,
    });
    
    console.log('[OpenAI Test] SUCCESS: OpenAI API is working!');
    console.log('[OpenAI Test] Response:', result.text);
    console.log('[OpenAI Test] Usage:', result.usage);
    
  } catch (error) {
    console.error('[OpenAI Test] ERROR: Failed to connect to OpenAI API');
    console.error('[OpenAI Test] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Check for common error types
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.error('[OpenAI Test] ❌ AUTHENTICATION ERROR: Invalid API key');
        console.error('[OpenAI Test] 💡 Solution: Check your OpenAI API key in .dev.vars');
      } else if (error.message.includes('quota') || error.message.includes('billing')) {
        console.error('[OpenAI Test] ❌ QUOTA/BILLING ERROR: OpenAI account has insufficient credits');
        console.error('[OpenAI Test] 💡 Solution: Add credits to your OpenAI account at https://platform.openai.com/account/billing');
        console.error('[OpenAI Test] 💡 Alternative: Use a different OpenAI API key with available credits');
      } else if (error.message.includes('429')) {
        console.error('[OpenAI Test] ❌ RATE LIMIT ERROR: Too many requests');
        console.error('[OpenAI Test] 💡 Solution: Wait a moment and try again');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error('[OpenAI Test] ❌ NETWORK ERROR: Connection failed');
        console.error('[OpenAI Test] 💡 Solution: Check your internet connection');
      } else {
        console.error('[OpenAI Test] ❌ UNKNOWN ERROR: See error details above');
      }
    }
    
    console.error('\n[OpenAI Test] 🔧 TROUBLESHOOTING STEPS:');
    console.error('[OpenAI Test] 1. Check your OpenAI account at https://platform.openai.com/account/api-keys');
    console.error('[OpenAI Test] 2. Verify your billing details at https://platform.openai.com/account/billing');
    console.error('[OpenAI Test] 3. Ensure your API key has sufficient credits');
    console.error('[OpenAI Test] 4. Try using gpt-3.5-turbo instead of gpt-4o for lower costs');
    
    process.exit(1);
  }
}

// Run the test immediately
testOpenAIConnection().catch(console.error);

export { testOpenAIConnection }; 