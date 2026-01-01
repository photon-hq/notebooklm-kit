import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as RPC from '../src/rpc/rpc-methods.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Prompt user for input
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Parse user selection (supports comma-separated numbers and ranges like "1-3")
 */
function parseSelection(input: string, maxIndex: number): number[] {
  const selected: number[] = [];
  const parts = input.split(',').map(s => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Range like "1-3"
      const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
        for (let i = start; i <= end && i <= maxIndex; i++) {
          if (!selected.includes(i - 1)) {
            selected.push(i - 1);
          }
        }
      }
    } else {
      // Single number
      const num = parseInt(part, 10);
      if (!isNaN(num) && num > 0 && num <= maxIndex) {
        if (!selected.includes(num - 1)) {
          selected.push(num - 1);
        }
      }
    }
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Get type name
 */
function getTypeName(type?: ArtifactType): string {
  const typeNames: Record<ArtifactType, string> = {
    [ArtifactType.UNKNOWN]: 'Unknown',
    [ArtifactType.REPORT]: 'Report',
    [ArtifactType.QUIZ]: 'Quiz',
    [ArtifactType.FLASHCARDS]: 'Flashcards',
    [ArtifactType.MIND_MAP]: 'Mind Map',
    [ArtifactType.INFOGRAPHIC]: 'Infographic',
    [ArtifactType.SLIDE_DECK]: 'Slide Deck',
    [ArtifactType.AUDIO]: 'Audio',
    [ArtifactType.VIDEO]: 'Video',
  };
  return typeNames[type || ArtifactType.UNKNOWN] || 'Unknown';
}

/**
 * Get state name with icon
 */
function getStateName(state?: ArtifactState): string {
  const stateNames: Record<ArtifactState, string> = {
    [ArtifactState.UNKNOWN]: '? Unknown',
    [ArtifactState.CREATING]: '⏳ Creating',
    [ArtifactState.READY]: '✓ Ready',
    [ArtifactState.FAILED]: '✗ Failed',
  };
  return stateNames[state || ArtifactState.UNKNOWN] || '? Unknown';
}

/**
 * Extract slide URLs from artifact RPC response
 * Based on slide-download-test.ts extraction logic
 */
function extractSlideUrlsFromArtifact(artifact: any, targetArtifactId?: string, maxDepth = 15): string[] {
  const urls: string[] = [];
  
  function searchForSlides(obj: any, depth = 0): void {
    if (depth > maxDepth) {
      return;
    }
    
    if (Array.isArray(obj)) {
      // Check if this is a slide array: [url_string, width_int, height_int]
      if (obj.length >= 3 && 
          typeof obj[0] === 'string' && 
          obj[0].includes('lh3.googleusercontent.com/notebooklm/') &&
          (obj[0].includes('=w') || obj[0].includes('=s')) &&
          typeof obj[1] === 'number' &&
          typeof obj[2] === 'number') {
        let url = String(obj[0]);
        url = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\u002f/g, '/');
        if (!url.includes('?')) {
          url += '?authuser=0';
        } else if (!url.includes('authuser=0')) {
          url += '&authuser=0';
        }
        if (!urls.includes(url) && (url.includes('=w') || url.includes('=s'))) {
          urls.push(url);
        }
        return;
      }
      
      for (const item of obj) {
        searchForSlides(item, depth + 1);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        searchForSlides(value, depth + 1);
      }
    } else if (typeof obj === 'string' && obj.includes('lh3.googleusercontent.com/notebooklm') && (obj.includes('=w') || obj.includes('=s'))) {
      let url = obj.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
      if (!url.includes('?')) {
        url += '?authuser=0';
      } else if (!url.includes('authuser=0')) {
        url += '&authuser=0';
      }
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }
  
  // If targetArtifactId is provided, only search within that artifact's entry
  if (targetArtifactId && Array.isArray(artifact)) {
    const artifacts = Array.isArray(artifact[0]) ? artifact[0] : artifact;
    for (const artifactEntry of artifacts) {
      if (Array.isArray(artifactEntry) && artifactEntry.length > 0) {
        const artifactId = artifactEntry[0];
        if (artifactId === targetArtifactId) {
          searchForSlides(artifactEntry);
          break;
        }
      }
    }
  } else {
    searchForSlides(artifact);
  }
  
  return urls;
}

/**
 * Extract slide image URLs from artifact (just URLs, no download)
 */
async function getSlideUrls(
  sdk: any,
  artifactId: string,
  notebookId: string
): Promise<string[]> {
  const rpc = await sdk.getRPCClient();
  
  // Get artifacts list response
  const artifactsListResponse = await rpc.call(
    RPC.RPC_LIST_ARTIFACTS,
    [[2], notebookId],
    notebookId
  );
  
  // Parse response
  let parsedResponse = artifactsListResponse;
  if (typeof artifactsListResponse === 'string') {
    try {
      parsedResponse = JSON.parse(artifactsListResponse);
      if (typeof parsedResponse === 'string') {
        parsedResponse = JSON.parse(parsedResponse);
      }
    } catch (e) {
      // Already parsed
    }
  }
  
  // Extract URLs
  const imageUrls = extractSlideUrlsFromArtifact(parsedResponse, artifactId);
  return imageUrls;
}

/**
 * Display artifact content based on type
 */
function displayArtifactContent(artifact: any, index: number, total: number, notebookId?: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Artifact ${index + 1}/${total}: [${getTypeName(artifact.type)}] ${artifact.title || 'Untitled'}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Title: ${artifact.title || 'Untitled'}`);
  console.log(`Type: ${getTypeName(artifact.type)}`);
  console.log(`State: ${getStateName(artifact.state)}`);
  console.log(`ID: ${artifact.artifactId}\n`);

  if (artifact.state === ArtifactState.READY) {
    console.log('=== Artifact Content ===\n');

    // Handle different artifact types
    switch (artifact.type) {
      case ArtifactType.QUIZ: {
        const quiz = artifact;
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
            if (q.hint) {
              console.log(`  Hint: ${q.hint}`);
            }
            if (q.optionReasons && Array.isArray(q.optionReasons)) {
              console.log(`  Option Reasons:`);
              q.optionReasons.forEach((reason: string, j: number) => {
                console.log(`    ${j + 1}. ${reason}`);
              });
            }
            console.log();
          });
        }
        
        // Log all quiz data
        console.log('\n=== All Quiz Data (JSON) ===\n');
        console.log(JSON.stringify(quiz, null, 2));
        console.log();
        break;
      }

      case ArtifactType.FLASHCARDS: {
        const flashcards = artifact;
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
        const audio = artifact;
        console.log(`Duration: ${audio.duration || 'Unknown'} seconds`);
        console.log(`Audio Data: ${audio.audioData ? 'Available' : 'Not available'}`);
        if (audio.audioData) {
          console.log(`  Size: ~${Math.round(audio.audioData.length * 0.75 / 1024)} KB (base64)`);
          if (audio.saveToFile) {
            console.log('  Use saveToFile() helper to save to disk');
          }
        } else {
          console.log('\nNote: Audio data may require a special download method.');
          console.log('Try using artifacts.download() or check if notebookId needs to match artifactId for audio artifacts.');
        }
        
        // Log all audio data
        console.log('\n=== All Audio Data (JSON) ===\n');
        console.log(JSON.stringify(audio, null, 2));
        console.log();
        break;
      }

      case ArtifactType.VIDEO: {
        const video = artifact;
        if (video.downloadPath) {
          console.log(`✓ Downloaded to: ${video.downloadPath}`);
        } else if (video.videoData) {
          console.log(`Video URL: ${video.videoData}`);
          console.log('\nYou can download the video using:');
          console.log('  - curl or wget:');
          console.log(`    curl "${video.videoData}" -o video.mp4`);
          console.log('  - Browser: Open the URL in your browser');
          console.log('  - Video player: Use VLC or other players that support streaming URLs');
        } else {
          console.log('⚠️  Video URL not available');
          console.log('The video may not be ready yet or the URL could not be extracted.');
        }
        break;
      }

      case ArtifactType.SLIDE_DECK: {
        const slides = artifact;
        if ((slides as any).slideUrls && Array.isArray((slides as any).slideUrls)) {
          const slideUrls = (slides as any).slideUrls;
          console.log(`Slide Image URLs (${slideUrls.length} slide(s)):\n`);
          slideUrls.forEach((url: string, index: number) => {
            console.log(`  Slide ${index + 1}: ${url}`);
          });
          console.log('\nYou can download these URLs using:');
          console.log('  - curl or wget for each URL');
          console.log('  - Browser: Open URLs in your browser');
          console.log('  - Use slide-download-test.ts example for automated download');
        } else if (slides.downloadPath) {
          console.log(`✓ Downloaded to: ${slides.downloadPath}`);
          console.log(`Format: ${slides.downloadFormat || 'pdf'}`);
        } else {
          console.log('⚠️  Slide URLs not available');
          console.log('The slide deck may not be ready yet or URLs could not be extracted.');
        }
        break;
      }

      case ArtifactType.REPORT: {
        const report = artifact;
        console.log(`Report artifactId: ${report.artifactId}`);
        console.log(`Report notebookId: ${notebookId}`);
        console.log(`Report state: ${report.state}`);
        console.log(`Report title: ${report.title || 'Untitled'}`);
        console.log('\nTo export report to Google Docs:');
        console.log('  await sdk.artifacts.get(artifactId, notebookId, { exportToDocs: true });');
        console.log('\nTo export report to Google Sheets:');
        console.log('  await sdk.artifacts.get(artifactId, notebookId, { exportToSheets: true });');
        console.log('\nTo download report content:');
        console.log('  await sdk.artifacts.download(artifactId, outputPath, notebookId);');
        break;
      }

      case ArtifactType.INFOGRAPHIC: {
        const infographic = artifact;
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
        if (artifact.experimental) {
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
}

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID;
    if (!notebookId) {
      throw new Error('NOTEBOOK_ID environment variable is required');
    }

    console.log('=== Listing Artifacts ===\n');
    console.log(`Notebook ID: ${notebookId}\n`);

    // List all artifacts
    const allArtifacts = await sdk.artifacts.list(notebookId);
    
    if (allArtifacts.length === 0) {
      console.log('No artifacts found in this notebook.');
      sdk.dispose();
      process.exit(0);
    }

    console.log(`Found ${allArtifacts.length} artifact(s):\n`);

    // Display artifacts with type and state
    allArtifacts.forEach((artifact, index) => {
      const typeName = getTypeName(artifact.type);
      const stateName = getStateName(artifact.state);
      const title = artifact.title || 'Untitled';
      console.log(`${index + 1}. [${typeName}] ${stateName} - ${title} (${artifact.artifactId})`);
    });

    console.log('\n=== Select Artifacts to Get ===');
    console.log('Enter artifact numbers to get (comma-separated, e.g., "1,3,5" or "1-3" or "1,3-5"):');
    
    const input = await promptUser('Selection: ');
    
    if (!input) {
      console.log('No selection made. Exiting.');
      sdk.dispose();
      process.exit(0);
    }

    const selectedIndices = parseSelection(input, allArtifacts.length);
    
    if (selectedIndices.length === 0) {
      console.log('Invalid selection. No artifacts will be retrieved.');
      sdk.dispose();
      process.exit(0);
    }

    const selectedArtifacts = selectedIndices.map(i => allArtifacts[i]);
    
    console.log(`\n=== Getting ${selectedArtifacts.length} Artifact(s) ===\n`);

    // Get selected artifacts
    for (let i = 0; i < selectedArtifacts.length; i++) {
      const artifactSummary = selectedArtifacts[i];
      const typeName = getTypeName(artifactSummary.type);
      const title = artifactSummary.title || 'Untitled';
      
      try {
        console.log(`Fetching ${i + 1}/${selectedArtifacts.length}: [${typeName}] ${title}...`);
        
        // Debug logging for reports
        if (artifactSummary.type === ArtifactType.REPORT) {
          console.log(`  [DEBUG] Report artifactId: ${artifactSummary.artifactId}`);
          console.log(`  [DEBUG] Report notebookId: ${notebookId}`);
          console.log(`  [DEBUG] Report state: ${artifactSummary.state}`);
        }
        
        // For videos and slides, just get the artifact (no download options)
        const artifact = await sdk.artifacts.get(
          artifactSummary.artifactId, 
          notebookId
        );
        
        // Debug logging for reports after get()
        if (artifactSummary.type === ArtifactType.REPORT) {
          console.log(`  [DEBUG] Report get() returned:`);
          console.log(`    - artifactId: ${artifact.artifactId}`);
          console.log(`    - type: ${artifact.type}`);
          console.log(`    - state: ${artifact.state}`);
          console.log(`    - title: ${artifact.title || 'N/A'}`);
          console.log(`    - has content field: ${!!(artifact as any).content}`);
          console.log(`    - has exportUrl field: ${!!(artifact as any).exportUrl}`);
          console.log(`    - content type: ${(artifact as any).content ? typeof (artifact as any).content : 'N/A'}`);
          if ((artifact as any).content) {
            console.log(`    - content.title: ${(artifact as any).content?.title || 'N/A'}`);
            console.log(`    - content.content length: ${(artifact as any).content?.content?.length || 0}`);
            console.log(`    - content.sections count: ${(artifact as any).content?.sections?.length || 0}`);
          }
        }
        
        // For slides, extract URLs if not in artifact
        if (artifactSummary.type === ArtifactType.SLIDE_DECK) {
          try {
            const slideUrls = await getSlideUrls(sdk, artifactSummary.artifactId, notebookId);
            if (slideUrls.length > 0) {
              (artifact as any).slideUrls = slideUrls;
            }
          } catch (urlError) {
            // If URL extraction fails, continue without URLs
            console.log(`  ⚠️  Could not extract slide URLs: ${urlError instanceof Error ? urlError.message : urlError}`);
          }
        }
        
        displayArtifactContent(artifact, i, selectedArtifacts.length, notebookId);
      } catch (error) {
        console.error(`\n✗ Failed to get [${typeName}] ${title}: ${error instanceof Error ? error.message : error}\n`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('=== Complete ===');
    console.log(`Successfully retrieved ${selectedArtifacts.length} artifact(s).`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    handleError(error, 'Failed to get artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

