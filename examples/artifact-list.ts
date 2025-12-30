import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../dist/index.js';

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Listing All Artifacts ===\n');

    // List all artifacts
    const allArtifacts = await sdk.artifacts.list(notebookId);
    console.log(`Found ${allArtifacts.length} total artifacts\n`);

    // Group by type
    const byType = new Map<ArtifactType, typeof allArtifacts>();
    const byState = new Map<ArtifactState, typeof allArtifacts>();

    allArtifacts.forEach(artifact => {
      const type = artifact.type || ArtifactType.UNKNOWN;
      const state = artifact.state || ArtifactState.UNKNOWN;

      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(artifact);

      if (!byState.has(state)) {
        byState.set(state, []);
      }
      byState.get(state)!.push(artifact);
    });

    // Display by type
    console.log('=== By Type ===');
    const typeNames: Partial<Record<ArtifactType, string>> = {
      [ArtifactType.QUIZ]: 'Quiz',
      [ArtifactType.FLASHCARDS]: 'Flashcards',
      [ArtifactType.REPORT]: 'Report',
      [ArtifactType.MIND_MAP]: 'Mind Map',
      [ArtifactType.INFOGRAPHIC]: 'Infographic',
      [ArtifactType.SLIDE_DECK]: 'Slide Deck',
      [ArtifactType.AUDIO]: 'Audio',
      [ArtifactType.VIDEO]: 'Video',
      [ArtifactType.UNKNOWN]: 'Unknown',
    };

    byType.forEach((artifacts, type) => {
      if (artifacts.length > 0) {
        console.log(`\n${typeNames[type] || `Type ${type}`}: ${artifacts.length}`);
        artifacts.forEach(artifact => {
          const stateName = artifact.state === ArtifactState.READY ? '✓' :
                           artifact.state === ArtifactState.CREATING ? '⏳' :
                           artifact.state === ArtifactState.FAILED ? '✗' : '?';
          console.log(`  ${stateName} ${artifact.title || 'Untitled'} (${artifact.artifactId})`);
        });
      }
    });

    // Display by state
    console.log('\n\n=== By State ===');
    const stateNames: Record<ArtifactState, string> = {
      [ArtifactState.READY]: 'Ready',
      [ArtifactState.CREATING]: 'Creating',
      [ArtifactState.FAILED]: 'Failed',
      [ArtifactState.UNKNOWN]: 'Unknown',
    };

    byState.forEach((artifacts, state) => {
      if (artifacts.length > 0) {
        console.log(`\n${stateNames[state] || `State ${state}`}: ${artifacts.length}`);
        artifacts.forEach(artifact => {
          const typeName = typeNames[artifact.type || ArtifactType.UNKNOWN] || `Type ${artifact.type}`;
          console.log(`  ${typeName}: ${artifact.title || 'Untitled'} (${artifact.artifactId})`);
        });
      }
    });

    // Filter examples
    console.log('\n\n=== Filter Examples ===\n');

    // Filter by type
    const allArtifactsForFiltering = await sdk.artifacts.list(notebookId);
    const quizzes = allArtifactsForFiltering.filter(a => a.type === ArtifactType.QUIZ);
    console.log(`Quizzes: ${quizzes.length}`);

    // Filter by state
    const ready = allArtifactsForFiltering.filter(a => a.state === ArtifactState.READY);
    console.log(`Ready artifacts: ${ready.length}`);

    // Filter by both
    const readyQuizzes = allArtifactsForFiltering.filter(
      a => a.type === ArtifactType.QUIZ && a.state === ArtifactState.READY
    );
    console.log(`Ready quizzes: ${readyQuizzes.length}`);
  } catch (error) {
    handleError(error, 'Failed to list artifacts');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

