import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    // Get notebook ID and optional source ID from command line
    const notebookId = process.argv[2];
    const sourceId = process.argv[3];
    
    if (!notebookId) {
      console.error('Usage: tsx generation-document-guides.ts <notebook-id> [source-id]');
      console.error('\nExample:');
      console.error('  tsx generation-document-guides.ts <notebook-id>              # Generate for all sources');
      console.error('  tsx generation-document-guides.ts <notebook-id> <source-id>  # Generate for specific source');
      process.exit(1);
    }

    if (sourceId) {
      console.log(`Generating document guides for notebook: ${notebookId}`);
      console.log(`For source: ${sourceId}\n`);
    } else {
      console.log(`Generating document guides for notebook: ${notebookId}`);
      console.log('For all sources\n');
    }
    console.log('Generating...');

    // Generate document guides (for all sources or specific source)
    const guides = await sdk.generation.generateDocumentGuides(notebookId, sourceId);
    
    console.log('\nDocument Guides:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(guides, null, 2));
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to generate document guides');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

