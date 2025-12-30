import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID, message, and source IDs from command line
    const notebookId = process.argv[2];
    const message = process.argv[3];
    const sourceIds = process.argv.slice(4);
    
    if (!notebookId || !message) {
      console.error('Usage: tsx chat-with-sources.ts <notebook-id> <message> [source-id-1] [source-id-2] ...');
      console.error('\nExample:');
      console.error('  tsx chat-with-sources.ts <notebook-id> "Summarize the key findings" source-1 source-2');
      process.exit(1);
    }

    console.log(`Chatting with notebook: ${notebookId}`);
    console.log(`Question: ${message}`);
    
    if (sourceIds.length > 0) {
      console.log(`Using specific sources: ${sourceIds.join(', ')}`);
    } else {
      console.log('Using all sources in the notebook');
    }
    console.log('\nResponse:');
    console.log('─'.repeat(60));

    // Chat with specific sources (or all if none provided)
    const response = await sdk.generation.chat(
      notebookId,
      message,
      sourceIds.length > 0 ? sourceIds : undefined
    );
    
    console.log(response);
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

