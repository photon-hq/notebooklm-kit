import { createSDK, handleError } from './utils.js';
import { ArtifactType, NotebookLMLanguage } from '../src/types/artifact.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    // Support both SOURCE_IDS (plural) and SOURCE_ID (singular) for consistency
    // Format: SOURCE_IDS=id1,id2,id3 or SOURCE_ID=id1 (comma-separated for multiple)
    const sourceIdsEnv = process.env.SOURCE_IDS || process.env.SOURCE_ID || '';
    const sourceIds = sourceIdsEnv.split(',').map(id => id.trim()).filter(id => id.length > 0);

    console.log('=== Creating Artifacts ===\n');

    // 1. Create Quiz
    console.log('1. Creating Quiz...');
    const quiz = await sdk.artifacts.create(notebookId, ArtifactType.QUIZ, {
      title: 'Chapter 1 Quiz',
      instructions: 'Create questions covering key concepts from the sources',
      customization: {
        numberOfQuestions: 2, // 1=Fewer, 2=Standard, 3=More
        difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
        language: NotebookLMLanguage.ENGLISH,
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined, // Optional: omit to use all sources
    });
    console.log(`   Created: ${quiz.title}`);
    console.log(`   ID: ${quiz.artifactId}`);
    console.log(`   State: ${quiz.state}\n`);

    // 2. Create Flashcards
    console.log('2. Creating Flashcards...');
    const flashcards = await sdk.artifacts.create(notebookId, ArtifactType.FLASHCARDS, {
      title: 'Key Terms Flashcards',
      customization: {
        numberOfCards: 3, // 1=Fewer, 2=Standard, 3=More
        difficulty: 1, // 1=Easy, 2=Medium, 3=Hard
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   Created: ${flashcards.title}`);
    console.log(`   ID: ${flashcards.artifactId}`);
    console.log(`   State: ${flashcards.state}\n`);

    // 3. Create Slide Deck
    console.log('3. Creating Slide Deck...');
    const slides = await sdk.artifacts.create(notebookId, ArtifactType.SLIDE_DECK, {
      title: 'Presentation Slides',
      instructions: 'Create a comprehensive presentation',
      customization: {
        format: 2, // 2=Presenter slides, 3=Detailed deck
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   Created: ${slides.title}`);
    console.log(`   ID: ${slides.artifactId}`);
    console.log(`   State: ${slides.state}\n`);

    // 4. Create Infographic
    console.log('4. Creating Infographic...');
    const infographic = await sdk.artifacts.create(notebookId, ArtifactType.INFOGRAPHIC, {
      title: 'Data Visualization',
      customization: {
        orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
        levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   Created: ${infographic.title}`);
    console.log(`   ID: ${infographic.artifactId}`);
    console.log(`   State: ${infographic.state}\n`);

    // 5. Create Audio Overview
    console.log('5. Creating Audio Overview...');
    const audio = await sdk.artifacts.create(notebookId, ArtifactType.AUDIO, {
      title: 'Audio Summary',
      instructions: 'Create a narrative summary',
      customization: {
        format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH,
      },
      // Note: sourceIds is ignored for audio - always uses all sources
    });
    console.log(`   Created: ${audio.title}`);
    console.log(`   ID: ${audio.artifactId}`);
    console.log(`   State: ${audio.state}\n`);

    // 6. Create Video Overview (requires sourceIds)
    if (sourceIds.length > 0) {
      console.log('6. Creating Video Overview...');
      const video = await sdk.artifacts.create(notebookId, ArtifactType.VIDEO, {
        title: 'Explainer Video',
        instructions: 'Create an explainer video covering the main topics',
        sourceIds: sourceIds, // Required for video artifacts
        customization: {
          format: 1, // 1=Explainer, 2=Brief
          visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime, 6=Watercolour, 7=Anime (alt), 8=Retro print, 9=Heritage, 10=Paper-craft
          focus: 'Key concepts and main findings',
          language: NotebookLMLanguage.ENGLISH,
        },
      });
      console.log(`   Created: ${video.title}`);
      console.log(`   ID: ${video.artifactId}`);
      console.log(`   State: ${video.state}\n`);
    } else {
      console.log('6. Skipping Video (requires SOURCE_IDS in .env)\n');
    }

    // 7. Create Report (no customization)
    console.log('7. Creating Report...');
    const report = await sdk.artifacts.create(notebookId, ArtifactType.REPORT, {
      title: 'Research Report',
      instructions: 'Create a comprehensive research report',
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   Created: ${report.title}`);
    console.log(`   ID: ${report.artifactId}`);
    console.log(`   State: ${report.state}\n`);

    // 8. Create Mind Map (no customization)
    console.log('8. Creating Mind Map...');
    const mindMap = await sdk.artifacts.create(notebookId, ArtifactType.MIND_MAP, {
      title: 'Concept Map',
      instructions: 'Create a visual mind map of key concepts',
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   Created: ${mindMap.title}`);
    console.log(`   ID: ${mindMap.artifactId}`);
    console.log(`   State: ${mindMap.state}\n`);

    console.log('=== All Artifacts Created ===');
    console.log('\nNote: Artifacts are created asynchronously.');
    console.log('Check the state field - when state is READY, use artifacts.get() to fetch full content.');
  } catch (error) {
    handleError(error, 'Failed to create artifacts');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

