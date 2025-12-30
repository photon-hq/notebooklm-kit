import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;

async function main() {
  if (!NOTEBOOK_ID) {
    console.error('NOTEBOOK_ID environment variable is required');
    process.exit(1);
  }

  const sdk = createSDK();

  try {
    // Update title only
    const updated1 = await sdk.notebooks.update(NOTEBOOK_ID, {
      title: 'Updated Title',
    });
    console.log(`Updated: ${updated1.title}\n`);

    // Update description only
    const updated2 = await sdk.notebooks.update(NOTEBOOK_ID, {
      description: 'Updated description',
    });
    console.log(`Description updated\n`);

    // Update both title and description
    const updated3 = await sdk.notebooks.update(NOTEBOOK_ID, {
      title: 'Final Title',
      description: 'Final description',
    });
    console.log(`Updated: ${updated3.title}`);
    console.log(`Sources: ${updated3.sourceCount || 0}`);
    console.log(`Last accessed: ${updated3.lastAccessed || 'Never'}`);
  } catch (error) {
    handleError(error, 'Failed to update notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

