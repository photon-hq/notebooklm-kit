import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding YouTube Source ===\n');

    // Add YouTube video by URL
    const sourceId1 = await sdk.sources.add.youtube(notebookId, {
      urlOrId: 'https://www.youtube.com/watch?v=Ec08db2hP10&list=RDEc08db2hP10',
    });
    console.log(`Added YouTube video (URL)`);
    console.log(`Source ID: ${sourceId1}\n`);

    // Add YouTube video by ID
    const sourceId2 = await sdk.sources.add.youtube(notebookId, {
      urlOrId: 'dQw4w9WgXcQ',
    });
    console.log(`Added YouTube video (ID)`);
    console.log(`Source ID: ${sourceId2}\n`);

    // Check processing status
    const status = await sdk.sources.status(notebookId);
    console.log(`Processing: ${status.processing.length} sources still processing`);
  } catch (error) {
    handleError(error, 'Failed to add YouTube source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

