import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID from command line or use a default
    const notebookId = process.argv[2];
    
    if (!notebookId) {
      console.error('Usage: tsx note-list.ts <notebook-id>');
      process.exit(1);
    }

    // List all notes in the notebook
    const notes = await sdk.notes.list(notebookId);
    
    console.log(`Found ${notes.length} notes in notebook ${notebookId}\n`);
    
    if (notes.length === 0) {
      console.log('No notes found.');
    } else {
      notes.forEach((note, index) => {
        console.log(`${index + 1}. ${note.title || '(Untitled)'}`);
        console.log(`   ID: ${note.noteId}`);
        if (note.content) {
          const preview = note.content.substring(0, 100);
          console.log(`   Content: ${preview}${note.content.length > 100 ? '...' : ''}`);
        }
        if (note.tags && note.tags.length > 0) {
          console.log(`   Tags: ${note.tags.join(', ')}`);
        }
        console.log();
      });
    }
  } catch (error) {
    handleError(error, 'Failed to list notes');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

