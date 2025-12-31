import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID from command line
    const notebookId = process.argv[2];
    
    if (!notebookId) {
      console.error('Usage: tsx chat-conversation.ts <notebook-id>');
      process.exit(1);
    }

    console.log(`Starting conversation with notebook: ${notebookId}\n`);

    // First message
    const message1 = 'What are the key findings?';
    console.log(`Q: ${message1}`);
    console.log('─'.repeat(60));
    const response1 = await sdk.generation.chat(notebookId, message1);
    console.log(`A: ${response1}`);
    console.log('─'.repeat(60));
    console.log();

    // Follow-up message with conversation history
    const message2 = 'Tell me more about the methodology';
    console.log(`Q: ${message2}`);
    console.log('─'.repeat(60));
    
    // For a real conversation, you'd track the conversationId from the first response
    // Here we're simulating it - in practice, you'd extract it from the response
    const response2 = await sdk.generation.chat(notebookId, message2, {
      conversationHistory: [
        { message: message1, role: 'user' },
        { message: response1, role: 'assistant' }
      ]
    });
    
    console.log(`A: ${response2}`);
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

