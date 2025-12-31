import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const sourceId = process.env.SOURCE_ID || 'your-source-id';

    console.log('=== Deleting Source ===\n');

    // List sources first
    const sources = await sdk.sources.list(notebookId);
    console.log(`Found ${sources.length} sources\n`);

    if (sources.length === 0) {
      console.log('No sources to delete');
      return;
    }

    // Delete specific source (or use first one if SOURCE_ID not set)
    const targetSourceId = sourceId !== 'your-source-id' ? sourceId : sources[0].sourceId;
    const targetSource = sources.find(s => s.sourceId === targetSourceId);

    if (!targetSource) {
      console.log(`Source not found: ${targetSourceId}`);
      return;
    }

    console.log(`Deleting: ${targetSource.title || 'Untitled'}`);
    console.log(`ID: ${targetSourceId}\n`);

    await sdk.sources.delete(notebookId, targetSourceId);

    console.log('Source deleted successfully');

    // Verify deletion
    const updatedSources = await sdk.sources.list(notebookId);
    console.log(`\nRemaining sources: ${updatedSources.length}`);
  } catch (error) {
    handleError(error, 'Failed to delete source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

