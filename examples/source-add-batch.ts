import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding Multiple Sources (Batch) ===\n');

    // Add multiple sources at once
    const sourceIds = await sdk.sources.add.batch(notebookId, {
      sources: [
        {
          type: 'url',
          url: 'https://ai.google.dev/',
          title: 'Google AI Developer',
        },
        {
          type: 'text',
          title: 'Research Notes',
          content: 'Key findings from research...',
        },
        {
          type: 'youtube',
          urlOrId: 'dQw4w9WgXcQ',
          title: 'Example Video',
        },
        // Add Google Drive file if you have fileId
        // {
        //   type: 'gdrive',
        //   fileId: 'your-file-id',
        //   title: 'Document',
        // },
      ],
    });

    console.log(`Added ${sourceIds.length} sources:`);
    sourceIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });

    // Check processing status
    console.log('\nChecking processing status...');
    const status = await sdk.sources.status(notebookId);
    console.log(`All ready: ${status.allReady}`);
    console.log(`Still processing: ${status.processing.length}`);
  } catch (error) {
    handleError(error, 'Failed to add sources in batch');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

