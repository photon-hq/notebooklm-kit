/**
 * Delete Chat History Example
 * ============================
 * 
 * Demonstrates chat history management:
 * - Deleting conversation history
 * - Conversation ID usage
 * - Cleanup and management
 * 
 * Use this to:
 * - Remove old conversations
 * - Clean up chat history
 * - Manage conversation storage
 * 
 * Usage:
 *   tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>
 * 
 * Examples:
 *   # Delete a specific conversation
 *   tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>
 * 
 * Note: Conversation IDs are returned when you chat with a notebook.
 *       You can find them in the metadata of chat responses.
 */

import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect();

    // Get notebook ID and conversation ID from command line
    const notebookId = process.argv[2];
    const conversationId = process.argv[3];
    
    if (!notebookId || !conversationId) {
      console.error('Usage: tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>');
      console.error('\nExamples:');
      console.error('  # Delete a specific conversation');
      console.error('  tsx generation-delete-chat-history.ts <notebook-id> <conversation-id>');
      console.error('');
      console.error('💡 How to get conversation ID:');
      console.error('   - Conversation IDs are returned when you chat with a notebook');
      console.error('   - Check the metadata in chat responses (chat-basic.ts shows this)');
      console.error('   - Each conversation has a unique ID that persists across sessions');
      console.error('');
      console.error('⚠️  Warning: This action cannot be undone!');
      process.exit(1);
    }

    console.log(`\n🗑️  Deleting chat history`);
    console.log('─'.repeat(60));
    console.log(`📝 Notebook ID: ${notebookId}`);
    console.log(`💬 Conversation ID: ${conversationId}`);
    console.log('─'.repeat(60));
    console.log('\n⚠️  Warning: This will permanently delete the conversation history!');
    console.log('   This action cannot be undone.\n');

    // Delete chat history
    try {
      const startTime = Date.now();
      const result = await sdk.generation.deleteChatHistory(notebookId, conversationId);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Chat history deleted successfully! (${duration}ms)`);
      console.log('─'.repeat(60));
      
      if (result) {
        console.log('\n📄 Response:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('\n(History deleted - no response data)');
      }
      
      console.log('─'.repeat(60));
      
      console.log('\n💡 Next Steps:');
      console.log('   - The conversation history has been removed');
      console.log('   - You can start a new conversation anytime');
      console.log('   - New conversations will get a fresh conversation ID');
      console.log('   - Use chat-basic.ts or chat-conversation.ts to start chatting\n');
      
    } catch (error) {
      console.error('\n❌ Failed to delete chat history');
      console.error('─'.repeat(60));
      console.error('Possible reasons:');
      console.error('   - Conversation ID does not exist');
      console.error('   - Notebook ID is invalid');
      console.error('   - Network or authentication error');
      console.error('─'.repeat(60));
      throw error;
    }
  } catch (error) {
    handleError(error, 'Failed to delete chat history');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
