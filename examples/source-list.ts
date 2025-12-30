import { createSDK, handleError } from './utils.js';
import { SourceType } from '../src/types/source.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Listing Sources ===\n');

    // List all sources
    const sources = await sdk.sources.list(notebookId);
    console.log(`Found ${sources.length} sources\n`);

    // Display source details
    sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.title || 'Untitled'}`);
      console.log(`   ID: ${source.sourceId}`);
      console.log(`   Type: ${source.type}`);
      console.log(`   Status: ${source.status}`);
      if (source.url) {
        console.log(`   URL: ${source.url}`);
      }
      if (source.createdAt) {
        console.log(`   Created: ${source.createdAt}`);
      }
      console.log('');
    });

    // Filter by type
    const pdfs = sources.filter(s => s.type === SourceType.PDF || s.type === SourceType.PDF_FROM_DRIVE);
    const urls = sources.filter(s => s.type === SourceType.URL);
    const videos = sources.filter(s => s.type === SourceType.YOUTUBE_VIDEO);

    console.log(`\nSummary:`);
    console.log(`  PDFs: ${pdfs.length}`);
    console.log(`  URLs: ${urls.length}`);
    console.log(`  YouTube Videos: ${videos.length}`);
  } catch (error) {
    handleError(error, 'Failed to list sources');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

