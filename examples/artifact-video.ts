import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const videoId = process.env.ARTIFACT_ID || 'your-video-id';
    const outputDir = process.env.OUTPUT_DIR || './downloads';

    console.log('=== Video Artifact Download ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Video ID: ${videoId}`);
    console.log(`Output Directory: ${outputDir}\n`);

    // First, get the video artifact to check its state
    console.log('=== Checking Video Status ===\n');
    const video = await sdk.artifacts.get(videoId, notebookId);

    console.log(`Title: ${video.title}`);
    console.log(`State: ${video.state}\n`);

    if (video.state !== ArtifactState.READY) {
      if (video.state === ArtifactState.CREATING) {
        console.log('Video is still being created. Please wait and try again.');
      } else if (video.state === ArtifactState.FAILED) {
        console.log('Video creation failed.');
      }
      sdk.dispose();
      process.exit(1);
    }

    console.log('✓ Video is ready for download\n');

    // Download video using get() with outputPath option
    console.log('=== Downloading Video ===\n');
    console.log('Downloading video as MP4...\n');
    
    const downloadedVideo = await sdk.artifacts.get(videoId, notebookId, { 
      outputPath: outputDir 
    });

    console.log(`✓ Video downloaded successfully!`);
    console.log(`  Saved to: ${downloadedVideo.downloadPath}\n`);

    // Alternative: Use download() method
    console.log('=== Alternative: Using download() Method ===\n');
    console.log('You can also use the download() method:\n');
    console.log('  const result = await sdk.artifacts.download(videoId, outputDir, notebookId);');
    console.log('  console.log(`Video saved to: ${result.filePath}`);\n');

    console.log('=== Download Complete ===');
  } catch (error) {
    handleError(error, 'Failed to download video');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

