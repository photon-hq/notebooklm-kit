import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding URL Source ===\n');

    // Add URL source
    const sourceId = await sdk.sources.add.url(notebookId, {
      url: 'https://ai.google.dev/',
      title: 'Google AI Developer',
    });
    console.log(`Added URL source`);
    console.log(`Source ID: ${sourceId}\n`);

    // Check processing status
    console.log('Checking processing status...');
    const status = await sdk.sources.status(notebookId);
    if (status.processing.includes(sourceId)) {
      console.log('Source is still processing...');
    } else {
      console.log('Source is ready!');
    }
  } catch (error) {
    handleError(error, 'Failed to add URL source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

