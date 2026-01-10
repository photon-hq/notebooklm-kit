import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;
const NOTEBOOK_IDS = process.env.NOTEBOOK_IDS?.split(',').map(id => id.trim());
const DELETE_MODE = (process.env.DELETE_MODE || 'parallel').toLowerCase() as 'parallel' | 'sequential';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    if (NOTEBOOK_IDS && NOTEBOOK_IDS.length > 0) {
      // Delete multiple notebooks
      console.log(`Deleting ${NOTEBOOK_IDS.length} notebook(s) in ${DELETE_MODE} mode...\n`);
      const result = await sdk.notebooks.delete(NOTEBOOK_IDS, { mode: DELETE_MODE });
      
      if (result.count > 0) {
        console.log(`✓ Successfully deleted ${result.count} notebook(s): ${result.deleted.join(', ')}`);
      }
      
      if (result.failed && result.failed.length > 0) {
        console.log(`\n✗ Failed to delete ${result.failedCount} notebook(s): ${result.failed.join(', ')}`);
      }
    } else if (NOTEBOOK_ID) {
      // Delete single notebook
      console.log(`Deleting notebook: ${NOTEBOOK_ID}\n`);
      const result = await sdk.notebooks.delete(NOTEBOOK_ID);
      console.log(`✓ Deleted ${result.count} notebook: ${result.deleted[0]}`);
    } else {
      console.error('NOTEBOOK_ID or NOTEBOOK_IDS environment variable is required');
      console.error('\nUsage:');
      console.error('  Single: NOTEBOOK_ID=notebook-id npx tsx examples/notebook-delete.ts');
      console.error('  Multiple (parallel): NOTEBOOK_IDS=id-1,id-2,id-3 npx tsx examples/notebook-delete.ts');
      console.error('  Multiple (sequential): NOTEBOOK_IDS=id-1,id-2,id-3 DELETE_MODE=sequential npx tsx examples/notebook-delete.ts');
      process.exit(1);
    }
  } catch (error) {
    handleError(error, 'Failed to delete notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

