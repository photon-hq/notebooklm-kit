import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID and note ID from command line
    const notebookId = process.argv[2];
    const noteId = process.argv[3];
    
    if (!notebookId || !noteId) {
      console.error('Usage: tsx note-update.ts <notebook-id> <note-id> [title] [content]');
      console.error('\nExample:');
      console.error('  tsx note-update.ts <notebook-id> <note-id> "Updated Title" "Updated content"');
      process.exit(1);
    }

    // Get title and content from command line
    const title = process.argv[4] || '';
    const content = process.argv[5] || '';

    console.log(`Updating note: ${noteId}`);
    console.log(`In notebook: ${notebookId}`);
    if (title) {
      console.log(`New title: ${title}`);
    }
    if (content) {
      console.log(`New content: ${content}`);
    }
    console.log();

    // Update the note
    const updated = await sdk.notes.update(notebookId, noteId, {
      title: title || undefined,
      content: content || undefined,
    });
    
    console.log('Note updated successfully!');
    console.log('─'.repeat(60));
    console.log(`Note ID: ${updated.noteId}`);
    console.log(`Title: ${updated.title}`);
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to update note');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

