import { createSDK, handleError } from './utils.js';

/**
 * Map source type number to readable name
 */
function getSourceTypeName(type: number | string | undefined): string {
  const typeMap: Record<number, string> = {
    0: 'Unknown',
    1: 'URL',
    2: 'Text',
    3: 'File',
    4: 'YouTube Video',
    5: 'Google Drive',
    6: 'Google Slides',
    7: 'PDF',
    8: 'Text Note',
    9: 'YouTube Video', // Alternative code
    10: 'Video File',
    13: 'Image',
    14: 'PDF from Drive',
    15: 'Mind Map Note',
  };
  
  if (type === undefined || type === null) {
    return 'Unknown';
  }
  
  const typeNum = typeof type === 'string' ? parseInt(type, 10) : type;
  return typeMap[typeNum] || `Type ${typeNum}`;
}

/**
 * Map source status number to readable name
 */
function getSourceStatusName(status: number | string | undefined): string {
  const statusMap: Record<number, string> = {
    0: 'Unknown',
    1: 'Processing',
    2: 'Ready',
    3: 'Failed',
  };
  
  if (status === undefined || status === null) {
    return 'Unknown';
  }
  
  const statusNum = typeof status === 'string' ? parseInt(status, 10) : status;
  return statusMap[statusNum] || `Status ${statusNum}`;
}

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const sourceId = process.env.SOURCE_ID || 'your-source-id';

    console.log('=== Getting Source ===\n');

    // Get all sources
    console.log('1. Getting all sources...');
    const allSources = await sdk.sources.get(notebookId);
    const sourcesArray = Array.isArray(allSources) ? allSources : [allSources];
    console.log(`   Found ${sourcesArray.length} source(s)\n`);
    
    if (sourcesArray.length > 0) {
      console.log('   Source IDs:');
      sourcesArray.forEach((source, index) => {
        const sourceData = Array.isArray(source) ? source[0] : source;
        const sourceId = sourceData?.sourceId || sourceData?.id || 'N/A';
        const title = sourceData?.title || 'Untitled';
        const type = sourceData?.type;
        const typeName = getSourceTypeName(type);
        console.log(`   ${index + 1}. ${sourceId} - "${title}" (${typeName})`);
      });
      console.log();
    }

    // Get specific source
    if (sourceId && sourceId !== 'your-source-id') {
      console.log('2. Getting specific source...');
      const source = await sdk.sources.get(notebookId, sourceId);
      const sourceData = source?.[0] || source;
      console.log(`   Title: ${sourceData?.title || 'Untitled'}`);
      console.log(`   ID: ${sourceData?.sourceId || sourceData?.id || 'N/A'}`);
      console.log(`   Type: ${getSourceTypeName(sourceData?.type)}`);
      console.log(`   Status: ${getSourceStatusName(sourceData?.status)}`);
      if (sourceData?.url) {
        console.log(`   URL: ${sourceData.url}`);
      }
      if (sourceData?.metadata) {
        console.log(`   Metadata:`, sourceData.metadata);
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

