import { createSDK, handleError } from './utils.js';  
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const artifactId = process.env.ARTIFACT_ID || 'your-artifact-id';
    const outputDir = process.env.OUTPUT_DIR || './downloads';

    // Create output directory
    await mkdir(outputDir, { recursive: true });

    console.log('=== Downloading Artifact ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Artifact ID: ${artifactId}`);
    console.log(`Output Directory: ${outputDir}\n`);

    // First, get the artifact to check its state and type
    const artifact = await sdk.artifacts.get(artifactId, notebookId);

    if (artifact.state !== ArtifactState.READY) {
      console.log(`Artifact is not ready (state: ${artifact.state}). Please wait and try again.`);
      sdk.dispose();
      process.exit(1);
    }

    console.log(`Artifact: ${artifact.title}`);
    console.log(`Type: ${artifact.type}\n`);

    // Download based on type
    switch (artifact.type) {
      case ArtifactType.QUIZ:
      case ArtifactType.FLASHCARDS: {
        console.log('Downloading as JSON...');
        const result = await sdk.artifacts.download(artifactId, outputDir, notebookId);
        console.log(`✓ Saved to: ${result.filePath}`);
        console.log(`  Questions/Cards: ${result.data.questions?.length || result.data.flashcards?.length || result.data.totalQuestions || 0}`);
        break;
      }

      case ArtifactType.AUDIO: {
        console.log('Downloading audio file...');
        // For audio, artifactId is the notebookId
        const result = await sdk.artifacts.download(notebookId, outputDir, notebookId);
        console.log(`✓ Saved to: ${result.filePath}`);
        console.log(`  File size: ${result.data ? 'Downloaded' : 'Unknown'}`);
        break;
      }

      case ArtifactType.VIDEO:
      case ArtifactType.SLIDE_DECK: {
        console.log('⚠️  Video/Slide downloads are experimental.');
        console.log('Use artifacts.get() to retrieve the URL instead:\n');
        
        const content = await sdk.artifacts.get(artifactId, notebookId);
        const url = (content as any).url || (content as any).videoData;
        
        if (url) {
          console.log(`URL: ${url}`);
          console.log('\nYou can download this URL using:');
          console.log('  - curl or wget');
          console.log('  - fetch/axios in Node.js');
          console.log('  - Browser download');
        } else {
          console.log('URL not available yet. Please try again later.');
        }
        break;
      }

      case ArtifactType.INFOGRAPHIC: {
        console.log('Downloading infographic image...');
        const infographic = await sdk.artifacts.get(artifactId, notebookId);
        const imageUrl = (infographic as any).imageUrl;
        
        if (imageUrl) {
          console.log(`Image URL: ${imageUrl}`);
          console.log('\nYou can download this URL using:');
          console.log('  - curl or wget');
          console.log('  - fetch/axios in Node.js');
          console.log('  - Browser download');
        } else {
          console.log('Image URL not available.');
        }
        break;
      }

      case ArtifactType.REPORT: {
        console.log('Downloading report...');
        const report = await sdk.artifacts.get(artifactId, notebookId);
        const content = (report as any).content;
        
        if (content) {
          const fs = await import('fs/promises');
          const filePath = join(outputDir, `report_${artifactId}_${Date.now()}.txt`);
          await fs.writeFile(filePath, content.content || JSON.stringify(content, null, 2), 'utf-8');
          console.log(`✓ Saved to: ${filePath}`);
        } else {
          console.log('Report content not available.');
        }
        break;
      }

      default: {
        console.log(`Download not implemented for artifact type: ${artifact.type}`);
        console.log('Use artifacts.get() to retrieve the artifact data.');
      }
    }

    console.log('\n=== Download Complete ===');
  } catch (error) {
    handleError(error, 'Failed to download artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

