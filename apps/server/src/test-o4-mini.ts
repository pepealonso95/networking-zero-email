import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Test OpenAI o4-mini-2025-04-16 model
async function testO4Mini() {
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log('Testing o4-mini-2025-04-16 model...');
    
    const result = await generateText({
      model: openai('o4-mini-2025-04-16'),
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a simple JSON object containing your model name and a greeting.',
        },
      ],
      maxTokens: 200,
      maxRetries: 2,
    });

    console.log('✅ Success!');
    console.log('Response:', result.text);
    console.log('Usage:', result.usage);
    
    return result;
  } catch (error) {
    console.error('❌ Error testing o4-mini:', error);
    throw error;
  }
}

// Run the test
testO4Mini()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

export { testO4Mini };