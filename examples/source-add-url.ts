import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding URL Source ===\n');

    // Add URL source with custom title
    // Note: The API will use the website's title by default, but if you provide
    // a title, it will be automatically updated after the source is created
    const sourceId = await sdk.sources.add.url(notebookId, {
      url: 'https://ai.google.dev/',
      title: 'Google AI Developer',
    });
    console.log(`✓ Added URL source`);
    console.log(`✓ Source ID: ${sourceId}`);
    console.log(`✓ Title updated to: Google AI Developer\n`);

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

