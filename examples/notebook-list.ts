import type { Notebook } from '../src/types/notebook.js';
import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebooks: Notebook[] = await sdk.notebooks.list();
    console.log(`Found ${notebooks.length} notebooks\n`);

    notebooks.slice(0, 10).forEach((notebook, i) => {
      console.log(`${i + 1}. ${notebook.title}`);
      console.log(`   ID: ${notebook.projectId}`);
      console.log(`   Sources: ${notebook.sourceCount || 0}\n`);
    });
  } catch (error) {
    handleError(error, 'Failed to list notebooks');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

