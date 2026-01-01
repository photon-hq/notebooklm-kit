/**
 * Artifact types
 */

// Re-export language constants for artifact customization
export { NotebookLMLanguage, getLanguageInfo, isLanguageSupported, COMMON_LANGUAGES } from './languages.js';

/**
 * Artifact type enum
 * 
 * **Supported Types:**
 * - `UNKNOWN` (0) - Fallback for undefined/missing types
 * - `REPORT` (1) - Comprehensive reports/documents
 * - `QUIZ` (5) - Interactive quizzes with questions and answers
 * - `FLASHCARDS` (6) - Study flashcards
 * - `MIND_MAP` (7) - Visual mind maps
 * - `INFOGRAPHIC` (8) - Data visualizations
 * - `SLIDE_DECK` (9) - Presentation slides
 * - `AUDIO` (10) - Audio overview/podcast
 * - `VIDEO` (11) - Video overview
 */
export enum ArtifactType {
  UNKNOWN = 0,
  REPORT = 1,
  QUIZ = 5,
  FLASHCARDS = 6,
  MIND_MAP = 7,
  INFOGRAPHIC = 8,
  SLIDE_DECK = 9,
  AUDIO = 10,  // Audio overview (podcast)
  VIDEO = 11,  // Video overview
}

/**
 * Artifact state enum
 */
export enum ArtifactState {
  UNKNOWN = 0,
  CREATING = 1,
  READY = 2,
  FAILED = 3,
}

/**
 * Artifact
 */
export interface Artifact {
  /** Artifact ID */
  artifactId: string;
  
  /** Artifact type */
  type?: ArtifactType;
  
  /** Artifact state */
  state?: ArtifactState;
  
  /** Artifact title */
  title?: string;
  
  /** Source IDs used */
  sourceIds?: string[];
  
  /** Creation timestamp */
  createdAt?: string;
  
  /** Last modified timestamp */
  updatedAt?: string;
  
  /** Audio data (base64, for audio artifacts) */
  audioData?: string;
  
  /** Video data (URL or base64, for video artifacts) */
  videoData?: string;
  
  /** Status (for audio/video artifacts) */
  status?: string;
  
  /** Duration in seconds (for audio artifacts) */
  duration?: number;
}

/**
 * Quiz customization options
 */
export interface QuizCustomization {
  /** Number of questions: 1=Fewer, 2=Standard, 3=More (default: 2) */
  numberOfQuestions?: 1 | 2 | 3;
  
  /** Difficulty level: 1=Easy, 2=Medium, 3=Hard (default: 2) */
  difficulty?: 1 | 2 | 3;
  
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta') - optional */
  language?: string;
}

/**
 * Flashcard customization options
 */
export interface FlashcardCustomization {
  /** Number of cards: 1=Fewer, 2=Standard/More (default: 2). Note: API only accepts 1 or 2; value 3 is automatically mapped to 2 */
  numberOfCards?: 1 | 2 | 3;
  
  /** Difficulty level: 1=Easy, 2=Medium, 3=Hard (default: 2) */
  difficulty?: 1 | 2 | 3;
  
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta') - optional */
  language?: string;
}

/**
 * Slide deck customization options
 */
export interface SlideDeckCustomization {
  /** Format: 2=Presenter slides, 3=Detailed deck (default: 2) */
  format?: 2 | 3;
  
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en') */
  language?: string;
  
  /** Length: 1=Short, 2=Default, 3=Long (default: 2) */
  length?: 1 | 2 | 3;
}

/**
 * Infographic customization options
 */
export interface InfographicCustomization {
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta') */
  language?: string;
  
  /** Orientation/Visual style: 1=Landscape, 2=Portrait, 3=Square (default: 1) */
  orientation?: 1 | 2 | 3;
  
  /** Level of detail: 1=Concise, 2=Standard, 3=Detailed (default: 2) */
  levelOfDetail?: 1 | 2 | 3;
}

/**
 * Audio customization options
 */
export interface AudioCustomization {
  /** Format: 0=Deep dive, 1=Brief, 2=Critique, 3=Debate (default: 0) */
  format?: 0 | 1 | 2 | 3;
  
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi') */
  language?: string;
  
  /** Length: 1=Short, 2=Default, 3=Long (default: 2) */
  length?: 1 | 2 | 3;
}

/**
 * Video customization options
 */
export interface VideoCustomization {
  /** Format: 1=Explainer, 2=Brief (default: 1) */
  format?: 1 | 2;
  
  /** Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en') */
  language?: string;
  
  /** 
   * Visual style options:
   * - 0 = Auto-select (default) - AI chooses the best style
   * - 1 = Custom - Requires customStyleDescription
   * - 2 = Classic - Traditional, professional style
   * - 3 = Whiteboard - Hand-drawn whiteboard style
   * - 4 = Kawaii - Cute, colorful style
   * - 5 = Anime - Anime-inspired style
   * - 6 = Watercolour - Watercolor painting style
   * - 7 = Anime (alternative) - Alternative anime style
   * - 8 = Retro print - Vintage print/poster style
   * - 9 = Heritage - Traditional ink-wash/woodcut style
   * - 10 = Paper-craft - Layered paper cutout style
   * 
   * Note: All styles except Custom (1) support only the `focus` option.
   * Custom (1) additionally requires `customStyleDescription`.
   */
  visualStyle?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  
  /** 
   * What should the AI hosts focus on? (optional)
   * Supported by all visual styles (including Auto-select and Custom)
   */
  focus?: string;
  
  /** 
   * Custom visual style description (required when visualStyle=1/Custom)
   * Only used when visualStyle=1
   */
  customStyleDescription?: string;
}

/**
 * Options for creating artifacts
 * 
 * **Source Selection:**
 * - `sourceIds` (optional): Specific source IDs to use for the artifact
 *   - If omitted: Uses **all sources** in the notebook automatically
 *   - If provided: Uses **only the specified sources**
 *   - **Video artifacts**: `sourceIds` is **required** - always provide it
 *   - **Audio artifacts**: `sourceIds` is ignored - always uses all sources
 *   - **Other artifacts**: `sourceIds` is optional - omit to use all, or specify to use selected sources
 * 
 * **Note:** The `customization` field is only supported for the following artifact types:
 * - Quiz (ArtifactType.QUIZ)
 * - Flashcards (ArtifactType.FLASHCARDS)
 * - Slide Deck (ArtifactType.SLIDE_DECK)
 * - Infographic (ArtifactType.INFOGRAPHIC)
 * - Audio (ArtifactType.AUDIO)
 * - Video (ArtifactType.VIDEO)
 * 
 * For other artifact types (Study Guide, Mind Map, Report, Document), customization is not supported.
 */
export interface CreateArtifactOptions {
  /** Artifact title */
  title?: string;
  
  /** Custom instructions */
  instructions?: string;
  
  /** 
   * Source IDs to use for artifact generation
   * 
   * **Behavior by artifact type:**
   * - **Video**: Required - always provide `sourceIds`
   * - **Audio**: Ignored - always uses all sources in notebook
   * - **Quiz, Flashcards, Slide Deck, Infographic**: Optional - omit to use all sources, or specify to use selected sources
   * - **Study Guide, Mind Map, Report, Document**: Optional - omit to use all sources, or specify to use selected sources
   * 
   * **Examples:**
   * ```typescript
   * // Use all sources (omit sourceIds)
   * { instructions: 'Create quiz' }
   * 
   * // Use specific sources only
   * { sourceIds: ['source-id-1', 'source-id-2'], instructions: 'Create quiz' }
   * 
   * // Video requires sources
   * { sourceIds: ['source-id-1'], instructions: 'Create video' }
   * ```
   */
  sourceIds?: string[];
  
  /** 
   * Customization options (only supported for Quiz, Flashcards, Slide Deck, Infographic, Audio, Video)
   * Must match the artifact type being created
   */
  customization?: QuizCustomization | FlashcardCustomization | SlideDeckCustomization | InfographicCustomization | AudioCustomization | VideoCustomization;
}

/**
 * Quiz question data
 */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  explanation?: string; // Deprecated: use reasoning instead
  hint?: string; // Hint for the question
  reasoning?: string; // Explanation/rationale for the correct answer
  optionReasons?: string[]; // Rationales for all options (in order), both correct and incorrect
}

/**
 * Quiz data structure
 */
export interface QuizData {
  questions: QuizQuestion[];
  totalQuestions: number;
}

/**
 * Flashcard data
 */
export interface FlashcardData {
  /** CSV string with question,answer pairs */
  csv: string;
  /** Parsed flashcards */
  flashcards?: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Audio artifact (extends base Artifact)
 */
export interface AudioArtifact extends Artifact {
  audioData: string; // Base64 encoded audio data
  duration?: number;
  status?: string;
}

/**
 * Video artifact (extends base Artifact)
 */
export interface VideoArtifact extends Artifact {
  videoData: string; // URL or base64 encoded video data
  status?: string;
}

