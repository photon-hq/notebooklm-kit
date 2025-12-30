import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID and note ID from command line
    const notebookId = process.argv[2];
    const noteId = process.argv[3];
    
    if (!notebookId || !noteId) {
      console.error('Usage: tsx note-update.ts <notebook-id> <note-id>');
      process.exit(1);
    }

    // Update note title only
    const updated1 = await sdk.notes.update(notebookId, noteId, {
      title: 'Updated Meeting Notes',
    });
    console.log(`Updated note title: ${updated1.title}`);
    console.log(`Note ID: ${updated1.noteId}\n`);

    // Update note content
    const updated2 = await sdk.notes.update(notebookId, noteId, {
      content: 'Updated content:\n- New point 1\n- New point 2\n- New point 3',
    });
    console.log(`Updated note content`);
    console.log(`Note ID: ${updated2.noteId}\n`);

    // Update both title and content
    const updated3 = await sdk.notes.update(notebookId, noteId, {
      title: 'Final Meeting Notes',
      content: 'Final meeting notes with all updates',
      tags: ['meeting', 'final'],
    });
    console.log(`Updated note: ${updated3.title}`);
    console.log(`Note ID: ${updated3.noteId}`);
    if (updated3.tags && updated3.tags.length > 0) {
      console.log(`Tags: ${updated3.tags.join(', ')}`);
    }
  } catch (error) {
    handleError(error, 'Failed to update note');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

