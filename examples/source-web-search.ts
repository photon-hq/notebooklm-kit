import { createSDK, handleError } from './utils.js';
import { ResearchMode, SearchSourceType } from '../src/types/source.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Web Search (Simple - Search and Wait) ===\n');

    // Simple workflow: Search and wait for results
    console.log('1. Searching web (DEEP mode)...');
    const result = await sdk.sources.add.web.searchAndWait(notebookId, {
      query: 'machine learning research papers 2024',
      mode: ResearchMode.DEEP, // DEEP = comprehensive, FAST = quick
      sourceType: SearchSourceType.WEB, // WEB or GOOGLE_DRIVE
      timeout: 120000, // Wait up to 2 minutes
      pollInterval: 2000, // Check every 2 seconds
      onProgress: (status) => {
        console.log(`   Progress: ${status.resultCount || 0} results found...`);
      },
    });

    console.log(`\nFound ${result.web.length} web sources`);
    console.log(`Session ID: ${result.sessionId}\n`);

    // Display top results
    console.log('Top 5 results:');
    result.web.slice(0, 5).forEach((source, index) => {
      console.log(`  ${index + 1}. ${source.title}`);
      console.log(`     ${source.url}`);
    });

    // Add selected sources
    console.log('\n2. Adding top 3 sources...');
    const addedIds = await sdk.sources.add.web.addDiscovered(notebookId, {
      sessionId: result.sessionId,
      webSources: result.web.slice(0, 3),
    });

    console.log(`Added ${addedIds.length} sources:`);
    addedIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
  } catch (error) {
    handleError(error, 'Failed to search web');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

