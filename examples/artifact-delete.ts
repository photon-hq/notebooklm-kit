import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const artifactId = process.env.ARTIFACT_ID || 'your-artifact-id';
    const notebookId = process.env.NOTEBOOK_ID; // Optional, required for audio/video

    console.log('=== Deleting Artifact ===\n');
    console.log(`Artifact ID: ${artifactId}`);
    if (notebookId) {
      console.log(`Notebook ID: ${notebookId}`);
    }
    console.log();

    // Delete artifact
    await sdk.artifacts.delete(artifactId, notebookId);

    console.log('✓ Artifact deleted successfully');
    console.log('\n⚠️  Warning: This action cannot be undone.');

    console.log('\n=== Notes ===');
    console.log('For all artifacts (recommended - automatically detects type):');
    console.log('  await sdk.artifacts.delete(artifactId);');
    console.log('\nWith notebook ID (helpful if get() fails):');
    console.log('  await sdk.artifacts.delete(artifactId, notebookId);');
    console.log('\nNote: Audio and video artifacts have their own artifactId from create() or list()');
  } catch (error) {
    handleError(error, 'Failed to delete artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

