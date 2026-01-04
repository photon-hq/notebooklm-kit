import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID and note ID(s) from command line or environment
    // Support: note-delete.ts <notebook-id> <note-id-1> [note-id-2] ...
    // Or: NOTEBOOK_ID=<id> note-delete.ts <note-id-1> [note-id-2] ...
    let notebookId = process.argv[2];
    let noteIds = process.argv.slice(3);
    
    // If notebook ID is not provided as first arg, check environment variable
    if (!notebookId || (!noteIds.length && notebookId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i))) {
      // If first arg looks like a note ID (UUID), try to get notebook ID from env
      if (notebookId && notebookId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
        noteIds = [notebookId, ...process.argv.slice(3)];
        notebookId = process.env.NOTEBOOK_ID || '';
      }
    }
    
    if (!notebookId || noteIds.length === 0) {
      console.error('Usage: tsx note-delete.ts <notebook-id> <note-id-1> [note-id-2] ...');
      console.error('   Or: NOTEBOOK_ID=<notebook-id> tsx note-delete.ts <note-id-1> [note-id-2] ...');
      console.error('');
      console.error('Examples:');
      console.error('  tsx note-delete.ts 9c40da15-f909-4042-bb9e-47fa370b5e3b f11c7591-b5a4-4686-b0a5-c8c967a919ba');
      console.error('  NOTEBOOK_ID=9c40da15-f909-4042-bb9e-47fa370b5e3b tsx note-delete.ts f11c7591-b5a4-4686-b0a5-c8c967a919ba');
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

