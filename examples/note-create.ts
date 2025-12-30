import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID from command line or use a default
    const notebookId = process.argv[2];
    
    if (!notebookId) {
      console.error('Usage: tsx note-create.ts <notebook-id> [title] [content]');
      console.error('\nExample:');
      console.error('  tsx note-create.ts <notebook-id> "Meeting Notes" "Key points from today\'s meeting"');
      process.exit(1);
    }

    // Get title and optional content from command line
    const title = process.argv[3] || 'New Note';
    const content = process.argv[4] || '';

    console.log(`Creating note in notebook: ${notebookId}`);
    console.log(`Title: ${title}`);
    if (content) {
      console.log(`Content: ${content}`);
    }
    console.log();

    // Create the note
    const note = await sdk.notes.create(notebookId, {
      title,
      content,
    });
    
    console.log('Note created successfully!');
    console.log('─'.repeat(60));
    console.log(`Note ID: ${note.noteId}`);
    console.log(`Title: ${note.title}`);
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to create note');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

