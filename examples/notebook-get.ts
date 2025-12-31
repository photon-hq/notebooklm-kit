import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;

async function main() {
  if (!NOTEBOOK_ID) {
    console.error('NOTEBOOK_ID environment variable is required');
    process.exit(1);
  }

  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebook = await sdk.notebooks.get(NOTEBOOK_ID);

    console.log(`Notebook: ${notebook.title}`);
    console.log(`ID: ${notebook.projectId}`);
    console.log(`Sources: ${notebook.sourceCount || 0}`);
    console.log(`Last accessed: ${notebook.lastAccessed || 'Never'}`);

    if (notebook.sharing?.isShared) {
      console.log(`\nSharing:`);
      console.log(`  Shared: Yes`);
      console.log(`  Share URL: ${notebook.sharing.shareUrl || 'N/A'}`);
      console.log(`  Public access: ${notebook.sharing.publicAccess ? 'Yes' : 'No'}`);
    } else {
      console.log(`\nSharing: Private`);
    }
  } catch (error) {
    handleError(error, 'Failed to get notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

