import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;
const NOTEBOOK_IDS = process.env.NOTEBOOK_IDS?.split(',').map(id => id.trim());

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    if (NOTEBOOK_IDS && NOTEBOOK_IDS.length > 0) {
      // Delete multiple notebooks
      const result = await sdk.notebooks.delete(NOTEBOOK_IDS);
      console.log(`Deleted ${result.count} notebook(s):`);
      result.deleted.forEach(id => console.log(`  - ${id}`));
    } else if (NOTEBOOK_ID) {
      // Delete single notebook
      const result = await sdk.notebooks.delete(NOTEBOOK_ID);
      console.log(`Deleted ${result.count} notebook: ${result.deleted[0]}`);
    } else {
      console.error('NOTEBOOK_ID or NOTEBOOK_IDS environment variable is required');
      process.exit(1);
    }
  } catch (error) {
    handleError(error, 'Failed to delete notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

