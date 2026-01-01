import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    // Support both SOURCE_ID (singular) and SOURCE_IDS (plural) for consistency
    // For single source operations, takes first ID if SOURCE_IDS is provided
    const sourceIdsEnv = process.env.SOURCE_ID || process.env.SOURCE_IDS || '';
    const sourceId = sourceIdsEnv.split(',')[0].trim() || 'your-source-id';

    console.log('=== Updating Source ===\n');

    // List sources first
    const sources = await sdk.sources.list(notebookId);
    console.log(`Found ${sources.length} sources\n`);

    if (sources.length === 0) {
      console.log('No sources to update');
      return;
    }

    // Use provided sourceId or first source
    const targetSourceId = sourceId !== 'your-source-id' ? sourceId : sources[0].sourceId;
    const targetSource = sources.find(s => s.sourceId === targetSourceId);

    if (!targetSource) {
      console.log(`Source not found: ${targetSourceId}`);
      return;
    }

    console.log(`Current title: ${targetSource.title || 'Untitled'}`);
    console.log(`Source ID: ${targetSourceId}\n`);

    // Update source title
    const newTitle = `Updated: ${targetSource.title || 'Untitled'} (${new Date().toLocaleTimeString()})`;
    await sdk.sources.update(notebookId, targetSourceId, {
      title: newTitle,
    });

    console.log(`Source updated successfully!`);
    console.log(`New title: ${newTitle}`);

    // Verify update
    const updatedSource = await sdk.sources.get(notebookId, targetSourceId);
    console.log(`\nVerified: ${updatedSource?.[0]?.title || 'Untitled'}`);
  } catch (error) {
    handleError(error, 'Failed to update source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

