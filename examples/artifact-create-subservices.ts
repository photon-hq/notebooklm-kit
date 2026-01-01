import { createSDK, handleError } from './utils.js';
import { NotebookLMLanguage } from '../src/types/languages.js';
import * as readline from 'readline';

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
 * 
 * This example also demonstrates:
 * 1. Setting the notebook's default output language
 * 2. Creating artifacts that use the notebook's default language
 * 3. Creating artifacts with explicit language overrides
 * 4. Interactive source selection
 */

async function promptUser(question: string): Promise<string> {
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

async function main() {
  const sdk = await createSDK({ debug: true });

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    
    // Optional: Set the notebook's default output language
    // This will be used as the default for all artifacts unless overridden
    const setDefaultLanguage = process.env.SET_DEFAULT_LANGUAGE === 'true';
    if (setDefaultLanguage) {
      const defaultLang = process.env.DEFAULT_LANGUAGE || NotebookLMLanguage.ENGLISH;
      console.log(`\n=== Setting Notebook Default Language ===\n`);
      console.log(`Setting default language to: ${defaultLang}`);
      await sdk.notebookLanguage.set(notebookId, defaultLang);
      console.log(`✅ Default language set to ${defaultLang}\n`);
      
      // Verify the language was set
      const currentLang = await sdk.notebookLanguage.get(notebookId);
      console.log(`Current notebook language: ${currentLang}\n`);
    } else {
      // Get current default language
      const currentLang = await sdk.notebookLanguage.get(notebookId);
      console.log(`\n=== Notebook Default Language ===\n`);
      console.log(`Current default language: ${currentLang}`);
      console.log(`(All artifacts will use this language unless overridden)\n`);
    }
    
    // List sources first
    console.log('=== Listing Sources ===\n');
    const sources = await sdk.sources.list(notebookId);
    
    if (sources.length === 0) {
      console.error('❌ No sources found in notebook. Please add sources before creating artifacts.');
      process.exit(1);
    }
    
    console.log(`Found ${sources.length} source(s):\n`);
    sources.forEach((source, index) => {
      const statusText = source.status === 2 ? 'READY' : source.status === 1 ? 'PROCESSING' : source.status === 3 ? 'FAILED' : 'UNKNOWN';
      console.log(`  ${index + 1}. [${source.sourceId}] ${source.title || 'Untitled'} (${source.type}) - ${statusText}`);
    });
    console.log();
    
    // Warn if any sources are not ready
    const notReadySources = sources.filter(s => s.status !== 2);
    if (notReadySources.length > 0) {
      console.warn(`⚠️  Warning: ${notReadySources.length} source(s) are not ready (status != READY).`);
      console.warn('   Artifact creation may fail if sources are still processing.\n');
    }
    
    // Support both interactive selection and environment variables
    // If SOURCE_IDS is set, use it; otherwise prompt user
    let sourceIds: string[] = [];
    const sourceIdsEnv = process.env.SOURCE_IDS || process.env.SOURCE_ID || '';
    
    if (sourceIdsEnv) {
      // Use environment variable
      sourceIds = sourceIdsEnv.split(',').map(id => id.trim()).filter(id => id.length > 0);
      console.log(`Using SOURCE_IDS from environment: ${sourceIds.length} source(s)\n`);
    } else {
      // Interactive selection
      const selection = await promptUser(
        `Select sources to use (enter numbers separated by commas, e.g., "1,2,3" or "all" for all sources): `
      );
      
      if (selection.toLowerCase() === 'all' || selection === '') {
        // Use ALL sources
        sourceIds = sources.map(s => s.sourceId);
        console.log(`Using ALL ${sourceIds.length} source(s)\n`);
      } else {
        // Parse user selection
        const selectedIndices = selection
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= sources.length);
        
        if (selectedIndices.length === 0) {
          console.error('❌ Invalid selection. Please enter valid source numbers or "all".');
          process.exit(1);
        }
        
        sourceIds = selectedIndices.map(index => sources[index - 1].sourceId);
        console.log(`Using ${sourceIds.length} selected source(s): ${selectedIndices.join(', ')}\n`);
      }
    }

    console.log('=== Creating Artifacts Using Sub-Services ===\n');
    console.log('Using type-safe sub-service methods for cleaner code');
    console.log('Note: Artifacts will use the notebook\'s default language unless explicitly specified.');
    console.log('Language support: Audio, Video, Report, Infographics, Slide Decks\n');

    // 1. Create Quiz using sub-service
    console.log('1. Creating Quiz (using sdk.artifacts.quiz.create())...');
    // Note: Quiz language is set via instructions, not customization.language
    const quiz = await sdk.artifacts.quiz.create(notebookId, {
      title: 'Chapter 1 Quiz',
      instructions: 'Create questions covering key concepts from the sources',
      customization: {
        numberOfQuestions: 2, // 1=Fewer, 2=Standard, 3=More
        difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
        // language is not supported for Quiz - use instructions instead
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${quiz.title}`);
    console.log(`   ID: ${quiz.artifactId}`);
    console.log(`   State: ${quiz.state}\n`);

    // 2. Create Flashcards using sub-service
    console.log('2. Creating Flashcards (using sdk.artifacts.flashcard.create())...');
    // Note: Flashcard language is set via instructions, not customization.language
    const flashcards = await sdk.artifacts.flashcard.create(notebookId, {
      title: 'Key Terms Flashcards',
      customization: {
        numberOfCards: 3, // 1=Fewer, 2=Standard/More (API only accepts 1 or 2; 3 is auto-mapped to 2)
        difficulty: 1, // 1=Easy, 2=Medium, 3=Hard
        // language is not supported for Flashcards - use instructions instead
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${flashcards.title}`);
    console.log(`   ID: ${flashcards.artifactId}`);
    console.log(`   State: ${flashcards.state}\n`);

    // 3. Create Slide Deck using sub-service
    console.log('3. Creating Slide Deck (using sdk.artifacts.slide.create())...');
    // Slide decks support language customization - will use notebook default if not specified
    const slides = await sdk.artifacts.slide.create(notebookId, {
      title: 'Presentation Slides',
      instructions: 'Create a comprehensive presentation',
      customization: {
        format: 2, // 2=Presenter slides, 3=Detailed deck
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH, // Optional: overrides notebook default
        // If language is omitted, will use notebook's default language
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${slides.title}`);
    console.log(`   ID: ${slides.artifactId}`);
    console.log(`   State: ${slides.state}\n`);

    // 4. Create Infographic using sub-service
    console.log('4. Creating Infographic (using sdk.artifacts.infographic.create())...');
    // Infographics support language customization - will use notebook default if not specified
    const infographic = await sdk.artifacts.infographic.create(notebookId, {
      title: 'Data Visualization',
      customization: {
        orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
        levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
        language: NotebookLMLanguage.ENGLISH, // Optional: overrides notebook default
        // If language is omitted, will use notebook's default language
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
    });
    console.log(`   ✓ Created: ${infographic.title}`);
    console.log(`   ID: ${infographic.artifactId}`);
    console.log(`   State: ${infographic.state}\n`);

    // 5. Create Audio Overview using sub-service
    console.log('5. Creating Audio Overview (using sdk.artifacts.audio.create())...');
    // Audio supports language customization - will use notebook default if not specified
    const audio = await sdk.artifacts.audio.create(notebookId, {
      title: 'Audio Summary',
      instructions: 'Create a narrative summary',
      customization: {
        format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
        length: 2, // 1=Short, 2=Default, 3=Long
        language: NotebookLMLanguage.ENGLISH, // Optional: overrides notebook default
        // If language is omitted, will use notebook's default language
      },
      // Note: sourceIds is ignored for audio - always uses all sources
    });
    console.log(`   ✓ Created: ${audio.title}`);
    console.log(`   ID: ${audio.audioId}`);
    console.log(`   State: ${audio.state}\n`);

    // 6. Create Video Overview using sub-service (requires sourceIds)
    if (sourceIds.length > 0) {
      console.log('6. Creating Video Overview (using sdk.artifacts.video.create())...');
      // Video supports language customization - will use notebook default if not specified
      const video = await sdk.artifacts.video.create(notebookId, {
        title: 'Explainer Video',
        instructions: 'Create an explainer video covering the main topics',
        sourceIds: sourceIds, // Required for video artifacts
        customization: {
          format: 1, // 1=Explainer, 2=Brief
          visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime, 6=Watercolour, 7=Anime (alt), 8=Retro print, 9=Heritage, 10=Paper-craft
          focus: 'Key concepts and main findings',
          language: NotebookLMLanguage.ENGLISH, // Optional: overrides notebook default
          // If language is omitted, will use notebook's default language
        },
      });
      console.log(`   ✓ Created: ${video.title}`);
      console.log(`   ID: ${video.videoId}`);
      console.log(`   State: ${video.state}\n`);
    } else {
      console.log('6. Skipping Video (requires source selection or SOURCE_IDS in .env)\n');
    }

    // 7. Create Report using sub-service
    console.log('7. Creating Report (using sdk.artifacts.report.create())...');
    // Reports support language - will use notebook default if not specified
    const report = await sdk.artifacts.report.create(notebookId, {
      title: 'Research Report',
      instructions: 'Create a comprehensive research report',
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
      // Report language uses notebook's default language automatically
    });
    console.log(`   ✓ Created: ${report.title}`);
    console.log(`   ID: ${report.artifactId}`);
    console.log(`   State: ${report.state}\n`);

    // 8. Create Mind Map using sub-service
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
    console.log('\nNote: Artifacts are created asynchronously.');
    console.log('Check the state field - when state is READY, use artifacts.get() to fetch full content.');
  } catch (error) {
    handleError(error, 'Failed to create artifacts using sub-services');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

