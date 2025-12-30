import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Create notebook with title
    const notebook1 = await sdk.notebooks.create({
      title: 'My Research Project',
    });
    console.log(`Created: ${notebook1.title}`);
    console.log(`ID: ${notebook1.projectId}\n`);

    // Create notebook with auto-generated title
    const notebook2 = await sdk.notebooks.create({});
    console.log(`Created: ${notebook2.title}`);
    console.log(`ID: ${notebook2.projectId}\n`);

    // Create notebook with title and description
    const notebook3 = await sdk.notebooks.create({
      title: 'Project Notes',
      description: 'Initial project description',
    });
    console.log(`Created: ${notebook3.title}`);
    console.log(`ID: ${notebook3.projectId}`);
  } catch (error) {
    handleError(error, 'Failed to create notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

