import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
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
    console.log('For most artifacts:');
    console.log('  await sdk.artifacts.delete(artifactId);');
    console.log('\nFor audio artifacts (requires notebook ID):');
    console.log('  await sdk.artifacts.delete(notebookId, notebookId);');
    console.log('\nFor video artifacts (requires notebook ID):');
    console.log('  await sdk.artifacts.delete(videoId, notebookId);');
  } catch (error) {
    handleError(error, 'Failed to delete artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

