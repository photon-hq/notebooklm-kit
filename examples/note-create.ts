import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID from command line or use a default
    const notebookId = process.argv[2];
    
    if (!notebookId) {
      console.error('Usage: tsx note-create.ts <notebook-id>');
      process.exit(1);
    }

    // Create a note with title and content
    const note1 = await sdk.notes.create(notebookId, {
      title: 'Meeting Notes',
      content: 'Key points from today\'s meeting:\n- Discussed project timeline\n- Reviewed budget allocation\n- Next steps: Follow up with stakeholders',
    });
    console.log(`Created note: ${note1.title}`);
    console.log(`Note ID: ${note1.noteId}\n`);

    // Create a note with tags
    const note2 = await sdk.notes.create(notebookId, {
      title: 'Research Findings',
      content: 'Important research findings:\n- Finding 1: ...\n- Finding 2: ...',
      tags: ['research', 'findings'],
    });
    console.log(`Created note: ${note2.title}`);
    console.log(`Note ID: ${note2.noteId}`);
    console.log(`Tags: ${note2.tags?.join(', ') || 'none'}\n`);

    // Create a simple note with just title
    const note3 = await sdk.notes.create(notebookId, {
      title: 'Quick Reminder',
      content: 'Don\'t forget to review the proposal',
    });
    console.log(`Created note: ${note3.title}`);
    console.log(`Note ID: ${note3.noteId}`);
  } catch (error) {
    handleError(error, 'Failed to create note');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

