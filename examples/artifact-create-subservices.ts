import { createSDK, handleError } from './utils.js';
import { NotebookLMLanguage } from '../dist/index.js';

/**
 * Example: Creating artifacts using sub-service methods
 * 
 * This demonstrates using the type-safe sub-service methods:
 * - sdk.artifacts.quiz.create()
 * - sdk.artifacts.flashcard.create()
 * - sdk.artifacts.slide.create()
 * - sdk.artifacts.infographic.create()
 * - sdk.artifacts.audio.create()
 * - sdk.artifacts.video.create()
 * - sdk.artifacts.report.create()
 * - sdk.artifacts.mindmap.create()
 * 
 * These are convenience methods that internally call sdk.artifacts.create()
 * with the appropriate ArtifactType. They provide better type safety and
 * cleaner code when you know the artifact type at compile time.
 */

async function main() {
  const sdk = createSDK();

  try {
    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const sourceIds = process.env.SOURCE_IDS?.split(',') || [];

    console.log('=== Creating Artifacts Using Sub-Services ===\n');
    console.log('Using type-safe sub-service methods for cleaner code\n');

    // 1. Create Quiz using sub-service
    console.log('1. Creating Quiz (using sdk.artifacts.quiz.create())...');
    const quiz = await sdk.artifacts.quiz.create(notebookId, {
      title: 'Chapter 1 Quiz',
      instructions: 'Create questions covering key concepts from the sources',
      customization: {
        numberOfQuestions: 2, // 1=Fewer, 2=Standard, 3=More
        difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
        language: NotebookLMLanguage.ENGLISH,
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${quiz.title}`);
    console.log(`   ID: ${quiz.artifactId}`);
    console.log(`   State: ${quiz.state}\n`);

    // 2. Create Flashcards using sub-service
    console.log('2. Creating Flashcards (using sdk.artifacts.flashcard.create())...');
    const flashcards = await sdk.artifacts.flashcard.create(notebookId, {
      title: 'Key Terms Flashcards',
      customization: {
        numberOfCards: 3, // 1=Fewer, 2=Standard, 3=More
        difficulty: 1, // 1=Easy, 2=Medium, 3=Hard
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   ✓ Created: ${flashcards.title}`);
    console.log(`   ID: ${flashcards.artifactId}`);
    console.log(`   State: ${flashcards.state}\n`);

    // 3. Create Slide Deck using sub-service
    console.log('3. Creating Slide Deck (using sdk.artifacts.slide.create())...');
    const slides = await sdk.artifacts.slide.create(notebookId, {
      title: 'Presentation Slides',
      instructions: 'Create a comprehensive presentation',
      customization: {
        format: 2, // 2=Presenter slides, 3=Detailed deck
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   ✓ Created: ${slides.title}`);
    console.log(`   ID: ${slides.artifactId}`);
    console.log(`   State: ${slides.state}\n`);

    // 4. Create Infographic using sub-service
    console.log('4. Creating Infographic (using sdk.artifacts.infographic.create())...');
    const infographic = await sdk.artifacts.infographic.create(notebookId, {
      title: 'Data Visualization',
      customization: {
        orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
        levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
        language: NotebookLMLanguage.ENGLISH,
      },
    });
    console.log(`   ✓ Created: ${infographic.title}`);
    console.log(`   ID: ${infographic.artifactId}`);
    console.log(`   State: ${infographic.state}\n`);

    // 5. Create Audio Overview using sub-service
    console.log('5. Creating Audio Overview (using sdk.artifacts.audio.create())...');
    const audio = await sdk.artifacts.audio.create(notebookId, {
      title: 'Audio Summary',
      instructions: 'Create a narrative summary',
      customization: {
        format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH,
      },
      // Note: sourceIds is ignored for audio - always uses all sources
    });
    console.log(`   ✓ Created: ${audio.title}`);
    console.log(`   ID: ${audio.audioId}`);
    console.log(`   State: ${audio.state}\n`);

    // 6. Create Video Overview using sub-service (requires sourceIds)
    if (sourceIds.length > 0) {
      console.log('6. Creating Video Overview (using sdk.artifacts.video.create())...');
      const video = await sdk.artifacts.video.create(notebookId, {
        title: 'Explainer Video',
        instructions: 'Create an explainer video covering the main topics',
        sourceIds: sourceIds, // Required for video artifacts
        customization: {
          format: 1, // 1=Explainer, 2=Brief
          visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, etc.
          focus: 'Key concepts and main findings',
          language: NotebookLMLanguage.ENGLISH,
        },
      });
      console.log(`   ✓ Created: ${video.title}`);
      console.log(`   ID: ${video.videoId}`);
      console.log(`   State: ${video.state}\n`);
    } else {
      console.log('6. Skipping Video (requires SOURCE_IDS in .env)\n');
    }

    // 7. Create Report using sub-service (no customization)
    console.log('7. Creating Report (using sdk.artifacts.report.create())...');
    const report = await sdk.artifacts.report.create(notebookId, {
      title: 'Research Report',
      instructions: 'Create a comprehensive research report',
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${report.title}`);
    console.log(`   ID: ${report.artifactId}`);
    console.log(`   State: ${report.state}\n`);

    // 8. Create Mind Map using sub-service (no customization)
    console.log('8. Creating Mind Map (using sdk.artifacts.mindmap.create())...');
    const mindMap = await sdk.artifacts.mindmap.create(notebookId, {
      title: 'Concept Map',
      instructions: 'Create a visual mind map of key concepts',
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${mindMap.title}`);
    console.log(`   ID: ${mindMap.artifactId}`);
    console.log(`   State: ${mindMap.state}\n`);

    console.log('=== All Artifacts Created Using Sub-Services ===');
    console.log('\nNote: Sub-service methods are convenience wrappers around sdk.artifacts.create()');
    console.log('They provide better type safety and cleaner code when you know the artifact type.');
    console.log('\nBoth methods work identically:');
    console.log('  - sdk.artifacts.create(notebookId, ArtifactType.QUIZ, options)');
    console.log('  - sdk.artifacts.quiz.create(notebookId, options)');
  } catch (error) {
    handleError(error, 'Failed to create artifacts using sub-services');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

