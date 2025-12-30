import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID from command line
    const notebookId = process.argv[2];
    const message = process.argv[3];
    
    if (!notebookId || !message) {
      console.error('Usage: tsx chat-basic.ts <notebook-id> <message>');
      process.exit(1);
    }

    console.log(`Chatting with notebook: ${notebookId}`);
    console.log(`Question: ${message}\n`);
    console.log('Response:');
    console.log('─'.repeat(60));

    // Chat with the notebook (uses all sources)
    const response = await sdk.generation.chat(notebookId, message);
    
    console.log(response);
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

