import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const artifactId = process.env.ARTIFACT_ID || 'your-artifact-id';
    const newTitle = process.env.NEW_TITLE || 'My Renamed Artifact';

    console.log('=== Renaming Artifact ===\n');
    console.log(`Artifact ID: ${artifactId}`);
    console.log(`New Title: ${newTitle}\n`);

    // Rename artifact
    const updated = await sdk.artifacts.rename(artifactId, newTitle);

    console.log('✓ Artifact renamed successfully\n');
    console.log(`Old Title: (previous title)`);
    console.log(`New Title: ${updated.title}`);
    console.log(`Artifact ID: ${updated.artifactId}`);
    console.log(`Type: ${updated.type}`);
    console.log(`State: ${updated.state}`);

    console.log('\n=== Note ===');
    console.log('For audio artifacts, use the notebook ID as the artifact ID:');
    console.log('  await sdk.artifacts.rename(notebookId, "New Audio Title");');
  } catch (error) {
    handleError(error, 'Failed to rename artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

