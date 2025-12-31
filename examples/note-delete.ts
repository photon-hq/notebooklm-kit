import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID and note ID(s) from command line
    const notebookId = process.argv[2];
    const noteIds = process.argv.slice(3);
    
    if (!notebookId || noteIds.length === 0) {
      console.error('Usage: tsx note-delete.ts <notebook-id> <note-id-1> [note-id-2] ...');
      process.exit(1);
    }

    // Delete single note
    if (noteIds.length === 1) {
      await sdk.notes.delete(notebookId, noteIds[0]);
      console.log(`Deleted note: ${noteIds[0]}`);
    } else {
      // Delete multiple notes
      await sdk.notes.delete(notebookId, noteIds);
      console.log(`Deleted ${noteIds.length} notes:`);
      noteIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
    }
  } catch (error) {
    handleError(error, 'Failed to delete note(s)');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

