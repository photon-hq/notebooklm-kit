import { createSDK, handleError } from './utils.js';
import { ResearchMode, SearchSourceType } from '../src/types/source.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Web Search (Advanced - Multi-Step) ===\n');

    // Step 1: Start search (returns immediately with sessionId)
    console.log('Step 1: Starting search...');
    const sessionId = await sdk.sources.add.web.search(notebookId, {
      query: 'quantum computing breakthroughs',
      mode: ResearchMode.FAST, // FAST or DEEP
      sourceType: SearchSourceType.WEB,
    });
    console.log(`Session ID: ${sessionId}\n`);

    // Step 2: Poll for results manually (you control when/how often)
    console.log('Step 2: Polling for results...');
    let results;
    let attempts = 0;
    do {
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      results = await sdk.sources.add.web.getResults(notebookId, sessionId);
      attempts++;
      console.log(`   Attempt ${attempts}: Found ${results.web.length} web sources, ${results.drive.length} drive sources`);
    } while (results.web.length === 0 && attempts < 10);

    if (results.web.length === 0) {
      console.log('\nNo results found after 10 attempts');
      return;
    }

    // Step 3: Filter/select sources based on your criteria
    console.log('\nStep 3: Filtering results...');
    const relevantSources = results.web.filter(source =>
      source.title.toLowerCase().includes('quantum') ||
      source.url.includes('arxiv.org') ||
      source.url.includes('nature.com')
    );
    console.log(`   Found ${relevantSources.length} relevant sources out of ${results.web.length} total\n`);

    // Display filtered results
    console.log('Relevant sources:');
    relevantSources.forEach((source, index) => {
      console.log(`  ${index + 1}. ${source.title}`);
      console.log(`     ${source.url}`);
    });

    // Step 4: Add selected sources
    if (relevantSources.length > 0) {
      console.log('\nStep 4: Adding selected sources...');
      const addedIds = await sdk.sources.add.web.addDiscovered(notebookId, {
        sessionId: sessionId, // Must match sessionId from step 1
        webSources: relevantSources,
      });
      console.log(`Added ${addedIds.length} sources`);
    }
  } catch (error) {
    handleError(error, 'Failed to search web (advanced)');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

