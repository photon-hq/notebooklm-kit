import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID and conversation ID from command line
    const notebookId = process.argv[2];
    const conversationId = process.argv[3];
    
    if (!notebookId || !conversationId) {
      console.error('Usage: tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>');
      console.error('\nExample:');
      console.error('  tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>');
      process.exit(1);
    }

    console.log(`Deleting chat history for notebook: ${notebookId}`);
    console.log(`Conversation ID: ${conversationId}\n`);

    // Delete chat history
    const result = await sdk.generation.deleteChatHistory(notebookId, conversationId);
    
    console.log('Chat history deleted successfully!');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to delete chat history');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

