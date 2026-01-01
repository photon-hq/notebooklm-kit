import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';
import * as readline from 'readline';

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

    console.log('\n=== Select Artifacts to Delete ===');
    console.log('Enter artifact numbers to delete (comma-separated, e.g., "1,3,5" or "1-3" or "1,3-5"):');
    
    const input = await promptUser('Selection: ');
    
    if (!input) {
      console.log('No selection made. Exiting.');
      sdk.dispose();
      process.exit(0);
    }

    const selectedIndices = parseSelection(input, allArtifacts.length);
    
    if (selectedIndices.length === 0) {
      console.log('Invalid selection. No artifacts will be deleted.');
      sdk.dispose();
      process.exit(0);
    }

    const selectedArtifacts = selectedIndices.map(i => allArtifacts[i]);
    
    console.log(`\n=== Confirming Deletion ===`);
    console.log(`Selected ${selectedArtifacts.length} artifact(s) to delete:\n`);
    selectedArtifacts.forEach((artifact, idx) => {
      const typeName = getTypeName(artifact.type);
      const stateName = getStateName(artifact.state);
      const title = artifact.title || 'Untitled';
      console.log(`${idx + 1}. [${typeName}] ${stateName} - ${title} (${artifact.artifactId})`);
    });

    console.log('\n⚠️  Warning: This action cannot be undone.');
    const confirm = await promptUser('\nAre you sure you want to delete these artifacts? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Deletion cancelled.');
      sdk.dispose();
      process.exit(0);
    }

    console.log('\n=== Deleting Artifacts ===\n');
    
    // Delete selected artifacts
    for (let i = 0; i < selectedArtifacts.length; i++) {
      const artifact = selectedArtifacts[i];
      const typeName = getTypeName(artifact.type);
      const title = artifact.title || 'Untitled';
      
      try {
        console.log(`Deleting ${i + 1}/${selectedArtifacts.length}: [${typeName}] ${title}...`);
        await sdk.artifacts.delete(artifact.artifactId, notebookId);
        console.log(`✓ Deleted: [${typeName}] ${title}\n`);
      } catch (error) {
        console.error(`✗ Failed to delete [${typeName}] ${title}: ${error instanceof Error ? error.message : error}\n`);
      }
    }

    console.log('=== Deletion Complete ===');
    console.log(`Successfully deleted ${selectedArtifacts.length} artifact(s).`);
  } catch (error) {
    handleError(error, 'Failed to delete artifacts');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

