import { SourceStatus } from '../src/types/source.js';
import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Checking Source Processing Status ===\n');

    // Get processing status
    const status = await sdk.sources.status(notebookId);

    console.log(`All sources ready: ${status.allReady}`);
    console.log(`Sources still processing: ${status.processing.length}\n`);

    if (status.processing.length > 0) {
      console.log('Processing source IDs:');
      status.processing.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
    } else {
      console.log('All sources are ready!');
    }

    // List all sources with their status
    console.log('\n=== All Sources ===');
    const sources = await sdk.sources.list(notebookId);
    sources.forEach((source, index) => {
      const isProcessing = status.processing.includes(source.sourceId);
      const statusIcon = isProcessing ? '⏳' : source.status === SourceStatus.READY ? '✅' : '❌';
      console.log(`${statusIcon} ${index + 1}. ${source.title || 'Untitled'}`);
      console.log(`     Status: ${source.status}`);
      console.log(`     ID: ${source.sourceId}`);
    });
  } catch (error) {
    handleError(error, 'Failed to check source status');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

