import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';

async function main() {
  const sdk = createSDK();

  try {
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

    console.log('✓ Slides are ready for download\n');

    // Download slides using get() with outputPath option
    console.log('=== Downloading Slides ===\n');
    console.log(`Downloading slides as ${downloadFormat.toUpperCase()}...\n`);
    
    const downloadedSlides = await sdk.artifacts.get(slideId, notebookId, { 
      outputPath: outputDir,
      downloadAs: downloadFormat
    });

    console.log(`✓ Slides downloaded successfully!`);
    console.log(`  Saved to: ${downloadedSlides.downloadPath}`);
    console.log(`  Format: ${downloadedSlides.downloadFormat || downloadFormat}\n`);

    // Alternative: Use download() method
    console.log('=== Alternative: Using download() Method ===\n');
    console.log('You can also use the download() method:\n');
    console.log('  // Download as PDF (default)');
    console.log('  const result = await sdk.artifacts.download(slideId, outputDir, notebookId);');
    console.log('  console.log(`Slides saved to: ${result.filePath}`);\n');
    console.log('  // Download as PNG files');
    console.log('  // Note: download() uses PDF by default, use get() with downloadAs option for PNG\n');

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

