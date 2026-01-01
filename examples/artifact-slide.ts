import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const slideId = process.env.ARTIFACT_ID || 'your-slide-id';
    const outputDir = process.env.OUTPUT_DIR || './downloads';
    const downloadFormat = (process.env.DOWNLOAD_FORMAT || 'pdf') as 'pdf' | 'png';

    console.log('=== Slide Artifact Download ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Slide ID: ${slideId}`);
    console.log(`Output Directory: ${outputDir}`);
    console.log(`Format: ${downloadFormat.toUpperCase()}\n`);

    // First, get the slide artifact to check its state
    console.log('=== Checking Slide Status ===\n');
    const slides = await sdk.artifacts.get(slideId, notebookId);

    console.log(`Title: ${slides.title}`);
    console.log(`State: ${slides.state}\n`);

    if (slides.state !== ArtifactState.READY) {
      if (slides.state === ArtifactState.CREATING) {
        console.log('Slides are still being created. Please wait and try again.');
      } else if (slides.state === ArtifactState.FAILED) {
        console.log('Slide creation failed.');
      }
      sdk.dispose();
      process.exit(1);
    }

    console.log('✓ Slides are ready\n');
    
    // Get slide URLs
    console.log('=== Slide URLs ===\n');
    if (slides.slideUrls && slides.slideUrls.length > 0) {
      console.log(`Found ${slides.slideUrls.length} slide URLs:\n`);
      slides.slideUrls.slice(0, 3).forEach((url, i) => {
        console.log(`  Slide ${i + 1}: ${url}`);
      });
      if (slides.slideUrls.length > 3) {
        console.log(`  ... and ${slides.slideUrls.length - 3} more\n`);
      } else {
        console.log();
      }
    } else {
      console.log('No slide URLs available\n');
    }

    // Download slides using download() method
    console.log('=== Downloading Slides ===\n');
    console.log('Note: download() method saves slides as PDF by default.\n');
    console.log('Downloading slides as PDF...\n');
    
    const result = await sdk.artifacts.download(slideId, outputDir, notebookId);

    console.log(`✓ Slides downloaded successfully!`);
    console.log(`  Saved to: ${result.filePath}\n`);

    // Note about get() vs download()
    console.log('=== Note ===\n');
    console.log('Use get() to get slide URLs:');
    console.log('  const slides = await sdk.artifacts.get(slideId, notebookId);');
    console.log('  console.log(`Slide URLs: ${slides.slideUrls?.length || 0} slides`);');
    console.log('  slides.slideUrls?.forEach((url, i) => {');
    console.log('    console.log(`Slide ${i + 1}: ${url}`);');
    console.log('  });\n');
    console.log('Use download() to download slides as PDF:');
    console.log('  const result = await sdk.artifacts.download(slideId, outputDir, notebookId);');
    console.log('  console.log(`Slides saved to: ${result.filePath}`);\n');
    console.log('Note: download() currently only supports PDF format. For PNG format,');
    console.log('you can download individual slide images from the URLs returned by get().\n');

    console.log('=== Format Options ===\n');
    console.log('PDF (default):');
    console.log('  - Single PDF file containing all slides');
    console.log('  - Filename: <artifact-title>.pdf\n');
    console.log('PNG:');
    console.log('  - Individual PNG files for each slide');
    console.log('  - Saved in subfolder: <artifact-title>/');
    console.log('  - Filenames: slide_1.png, slide_2.png, etc.\n');

    console.log('=== Download Complete ===');
  } catch (error) {
    handleError(error, 'Failed to download slides');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

