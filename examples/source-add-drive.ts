import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const fileId = process.env.GOOGLE_DRIVE_FILE_ID || 'your-file-id';

    console.log('=== Adding Google Drive Source ===\n');

    if (fileId === 'your-file-id') {
      console.log('⚠️  Set GOOGLE_DRIVE_FILE_ID in .env to add a Google Drive file');
      console.log('\nExample:');
      console.log('  GOOGLE_DRIVE_FILE_ID=1a2b3c4d5e6f7g8h9i0j');
      return;
    }

    // Add Google Drive file
    const sourceId = await sdk.sources.add.drive(notebookId, {
      fileId: fileId,
      title: 'My Google Drive Document', // Optional
      mimeType: 'application/vnd.google-apps.document', // Optional, will be inferred
    });

    console.log(`Added Google Drive source`);
    console.log(`File ID: ${fileId}`);
    console.log(`Source ID: ${sourceId}\n`);

    // Check processing status
    const status = await sdk.sources.status(notebookId);
    if (status.processing.includes(sourceId)) {
      console.log('Source is still processing...');
    } else {
      console.log('Source is ready!');
    }

    console.log('\nNote: Google Drive sources may take longer to process.');
  } catch (error) {
    handleError(error, 'Failed to add Google Drive source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

