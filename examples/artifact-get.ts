import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const artifactId = process.env.ARTIFACT_ID || 'your-artifact-id';

    console.log('=== Getting Artifact ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Artifact ID: ${artifactId}\n`);

    // Get artifact
    const artifact = await sdk.artifacts.get(artifactId, notebookId);

    console.log(`Title: ${artifact.title}`);
    console.log(`Type: ${artifact.type}`);
    console.log(`State: ${artifact.state}\n`);

    if (artifact.state === ArtifactState.READY) {
      console.log('=== Artifact Content ===\n');

      // Handle different artifact types
      switch (artifact.type) {
        case ArtifactType.QUIZ: {
          const quiz = artifact as any;
          console.log(`Total Questions: ${quiz.totalQuestions || quiz.questions?.length || 0}\n`);
          if (quiz.questions) {
            quiz.questions.forEach((q: any, i: number) => {
              console.log(`Q${i + 1}: ${q.question}`);
              if (q.options) {
                q.options.forEach((opt: string, j: number) => {
                  const marker = j === q.correctAnswer ? '✓' : ' ';
                  console.log(`  ${marker} ${j + 1}. ${opt}`);
                });
              }
              if (q.reasoning || q.explanation) {
                console.log(`  Explanation: ${q.reasoning || q.explanation}`);
              }
              console.log();
            });
          }
          break;
        }

        case ArtifactType.FLASHCARDS: {
          const flashcards = artifact as any;
          console.log(`Total Cards: ${flashcards.totalCards || flashcards.flashcards?.length || 0}\n`);
          if (flashcards.flashcards) {
            flashcards.flashcards.slice(0, 5).forEach((card: any, i: number) => {
              console.log(`Card ${i + 1}:`);
              console.log(`  Q: ${card.question}`);
              console.log(`  A: ${card.answer}\n`);
            });
            if (flashcards.flashcards.length > 5) {
              console.log(`... and ${flashcards.flashcards.length - 5} more cards\n`);
            }
          }
          if (flashcards.csv) {
            console.log('CSV available (first 200 chars):');
            console.log(flashcards.csv.substring(0, 200) + '...\n');
          }
          break;
        }

        case ArtifactType.AUDIO: {
          const audio = artifact as any;
          console.log(`Duration: ${audio.duration || 'Unknown'} seconds`);
          console.log(`Audio Data: ${audio.audioData ? 'Available' : 'Not available'}`);
          if (audio.audioData) {
            console.log(`  Size: ~${Math.round(audio.audioData.length * 0.75 / 1024)} KB (base64)`);
            if (audio.saveToFile) {
              console.log('  Use saveToFile() helper to save to disk');
            }
          }
          break;
        }

        case ArtifactType.VIDEO: {
          const video = artifact as any;
          console.log(`Video URL: ${video.url || video.videoData || 'Not available'}`);
          if (video.url || video.videoData) {
            console.log('  Use this URL to access/download the video');
          }
          break;
        }

        case ArtifactType.SLIDE_DECK: {
          const slides = artifact as any;
          if (slides.downloadPath) {
            console.log(`Downloaded to: ${slides.downloadPath}`);
            console.log(`Format: ${slides.downloadFormat || 'pdf'}`);
          } else {
            console.log('⚠️  Slides require download with outputPath option');
            console.log('\nTo download slides:');
            console.log('  // Download as PDF (default)');
            console.log('  const slides = await sdk.artifacts.get(artifactId, notebookId, { outputPath: "./downloads" });');
            console.log('  // Download as PNG files');
            console.log('  const slides = await sdk.artifacts.get(artifactId, notebookId, { downloadAs: "png", outputPath: "./downloads" });');
          }
          break;
        }

        case ArtifactType.REPORT: {
          const report = artifact as any;
          if (report.content) {
            console.log(`Report Title: ${report.content.title || 'Untitled'}`);
            console.log(`Content Length: ${report.content.content?.length || 0} characters`);
            if (report.content.content) {
              console.log('\nContent Preview (first 500 chars):');
              console.log(report.content.content.substring(0, 500) + '...\n');
            }
            if (report.content.sections) {
              console.log(`Sections: ${report.content.sections.length}`);
              report.content.sections.forEach((section: any, i: number) => {
                console.log(`  ${i + 1}. ${section.title}`);
              });
            }
          } else if (report.exportUrl) {
            console.log(`Export URL: ${report.exportUrl}`);
            console.log('  Report exported to Google Docs/Sheets');
          }
          break;
        }

        case ArtifactType.INFOGRAPHIC: {
          const infographic = artifact as any;
          if (infographic.imageUrl) {
            console.log(`Image URL: ${infographic.imageUrl}`);
          }
          if (infographic.width && infographic.height) {
            console.log(`Dimensions: ${infographic.width}x${infographic.height}`);
          }
          if (infographic.imageData) {
            console.log(`Image Data: Available (${infographic.imageData.byteLength || infographic.imageData.length} bytes)`);
          }
          break;
        }

        case ArtifactType.MIND_MAP: {
          console.log('Mind Map (experimental)');
          if ((artifact as any).experimental) {
            console.log('  This is an experimental feature');
          }
          break;
        }

        default:
          console.log('Artifact type not fully supported in this example');
          console.log('Raw artifact:', JSON.stringify(artifact, null, 2));
      }
    } else if (artifact.state === ArtifactState.CREATING) {
      console.log('Artifact is still being created. Please wait and try again.');
    } else if (artifact.state === ArtifactState.FAILED) {
      console.log('Artifact creation failed.');
    }

    // Example: Export report to Google Docs
    if (artifact.type === ArtifactType.REPORT && artifact.state === ArtifactState.READY) {
      console.log('\n=== Export Options ===\n');
      console.log('To export report to Google Docs:');
      console.log('  const report = await sdk.artifacts.get(artifactId, notebookId, { exportToDocs: true });');
      console.log('\nTo export report to Google Sheets:');
      console.log('  const report = await sdk.artifacts.get(artifactId, notebookId, { exportToSheets: true });');
    }

    // Example: Download slides
    if (artifact.type === ArtifactType.SLIDE_DECK && artifact.state === ArtifactState.READY && !(artifact as any).downloadPath) {
      console.log('\n=== Slide Download (Required) ===\n');
      console.log('Slides require download with outputPath option:');
      console.log('  // Download as PDF (default)');
      console.log('  const slides = await sdk.artifacts.get(artifactId, notebookId, { outputPath: "./downloads" });');
      console.log('  // Download as PNG files');
      console.log('  const slides = await sdk.artifacts.get(artifactId, notebookId, { downloadAs: "png", outputPath: "./downloads" });');
    }
  } catch (error) {
    handleError(error, 'Failed to get artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

