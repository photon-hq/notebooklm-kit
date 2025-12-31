import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const sourceId = process.env.SOURCE_ID || 'your-source-id';

    console.log('=== Refreshing Source ===\n');

    // List sources first
    const sources = await sdk.sources.list(notebookId);
    console.log(`Found ${sources.length} sources\n`);

    if (sources.length === 0) {
      console.log('No sources to refresh');
      return;
    }

    // Use provided sourceId or first source
    const targetSourceId = sourceId !== 'your-source-id' ? sourceId : sources[0].sourceId;
    const targetSource = sources.find(s => s.sourceId === targetSourceId);

    if (!targetSource) {
      console.log(`Source not found: ${targetSourceId}`);
      return;
    }

    console.log(`Refreshing: ${targetSource.title || 'Untitled'}`);
    console.log(`Source ID: ${targetSourceId}`);
    console.log(`Current status: ${targetSource.status}\n`);

    // Refresh source
    await sdk.sources.refresh(notebookId, targetSourceId);

    console.log('Source refresh initiated');

    // Check processing status
    console.log('\nChecking processing status...');
    let status = await sdk.sources.status(notebookId);
    let attempts = 0;
    
    while (status.processing.includes(targetSourceId) && attempts < 10) {
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      status = await sdk.sources.status(notebookId);
      attempts++;
      console.log(`  Attempt ${attempts}: Still processing...`);
    }

    if (!status.processing.includes(targetSourceId)) {
      console.log('\n✅ Source refresh completed!');
    } else {
      console.log('\n⏳ Source is still processing (may take longer)');
    }
  } catch (error) {
    handleError(error, 'Failed to refresh source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

