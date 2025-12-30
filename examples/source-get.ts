import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const sourceId = process.env.SOURCE_ID || 'your-source-id';

    console.log('=== Getting Source ===\n');

    // Get all sources
    console.log('1. Getting all sources...');
    const allSources = await sdk.sources.get(notebookId);
    console.log(`   Found ${Array.isArray(allSources) ? allSources.length : 1} source(s)\n`);

    // Get specific source
    if (sourceId && sourceId !== 'your-source-id') {
      console.log('2. Getting specific source...');
      const source = await sdk.sources.get(notebookId, sourceId);
      console.log(`   Title: ${source.title || 'Untitled'}`);
      console.log(`   ID: ${source.sourceId}`);
      console.log(`   Type: ${source.type}`);
      console.log(`   Status: ${source.status}`);
      if (source.url) {
        console.log(`   URL: ${source.url}`);
      }
      if (source.metadata) {
        console.log(`   Metadata:`, source.metadata);
      }
    } else {
      console.log('2. Set SOURCE_ID in .env to get a specific source');
    }
  } catch (error) {
    handleError(error, 'Failed to get source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

