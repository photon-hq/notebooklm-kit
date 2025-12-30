/**
 * Artifacts service
 * Handles artifact operations (documents, presentations, audio, video, etc.)
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { 
  Artifact, 
  CreateArtifactOptions, 
  QuizData, 
  FlashcardData, 
  AudioArtifact, 
  VideoArtifact,
  QuizCustomization,
  FlashcardCustomization,
  SlideDeckCustomization,
  InfographicCustomization,
  AudioCustomization,
  VideoCustomization,
} from '../types/artifact.js';
import { ArtifactType, ArtifactState } from '../types/artifact.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Service for artifact operations
 */
export class ArtifactsService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  /**
   * List all artifacts for a notebook
   * 
   * **What it does:** Retrieves a list of all artifacts (quizzes, flashcards, study guides, 
   * mind maps, infographics, slide decks, reports, audio, video) associated with a notebook.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook to list artifacts from
   * 
   * **Output:** Returns an array of `Artifact` objects, each containing:
   * - `artifactId`: Unique identifier for the artifact
   * - `type`: Artifact type (QUIZ, FLASHCARDS, STUDY_GUIDE, etc.)
   * - `state`: Current state (CREATING, READY, FAILED)
   * - `title`: Artifact title/name
   * - `sourceIds`: Source IDs used to create the artifact
   * - `createdAt`, `updatedAt`: Timestamps
   * 
   * **Next steps:**
   * - Use `get(artifactId)` to fetch detailed artifact information
   * - Use `download(artifactId)` to retrieve artifact content (for quizzes, flashcards, audio, etc.)
   * - Check `state` field to see if artifact is READY before downloading
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const artifacts = await client.artifacts.list('notebook-id');
   * console.log(`Found ${artifacts.length} artifacts`);
   * 
   * // Filter for ready artifacts
   * const readyArtifacts = artifacts.filter(a => a.state === ArtifactState.READY);
   * 
   * // Find a specific artifact type
   * const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ);
   * ```
   */
  async list(notebookId: string): Promise<Artifact[]> {
    const response = await this.rpc.call(
      RPC.RPC_LIST_ARTIFACTS,
      [
        [2], // filter parameter - 2 for all artifacts
        notebookId,
      ],
      notebookId
    );
    
    return this.parseListResponse(response);
  }
  
  /**
   * Rename an artifact
   * 
   * **What it does:** Changes the display name/title of an existing artifact. Works for all artifact 
   * types (quiz, flashcards, study guide, mind map, infographic, slide deck, report, audio, video).
   * 
   * **Input:**
   * - `artifactId` (string, required): The ID of the artifact to rename
   *   - For most artifacts: use the artifact ID from `create()` or `list()`
   *   - For audio artifacts: use the notebook ID
   * - `newTitle` (string, required): The new title/name for the artifact
   * 
   * **Output:** Returns the updated `Artifact` object with the new title.
   * 
   * **Note:** 
   * - This only updates the title. To update other fields, use `update()`.
   * - Works for all artifact types (quiz, flashcards, study guide, mind map, infographic, slide deck, report, audio, video)
   * 
   * @param artifactId - The artifact ID
   * @param newTitle - New title
   * 
   * @example
   * ```typescript
   * // Rename any artifact type
   * const artifact = await client.artifacts.rename('artifact-id', 'My Updated Quiz');
   * console.log(`Renamed to: ${artifact.title}`);
   * 
   * // Rename audio artifact
   * const audio = await client.artifacts.rename('notebook-id', 'My Audio Overview');
   * ```
   */
  async rename(artifactId: string, newTitle: string): Promise<Artifact> {
    const response = await this.rpc.call(
      RPC.RPC_RENAME_ARTIFACT,
      [
        [artifactId, newTitle],
        [['title']],
      ]
    );
    
    return this.parseArtifactResponse(response);
  }
  
  /**
   * Delete an artifact
   * 
   * **What it does:** Permanently removes an artifact from the notebook. Works for all artifact types 
   * (quiz, flashcards, study guide, mind map, infographic, slide deck, report, audio, video). 
   * This action cannot be undone.
   * 
   * **Input:**
   * - `artifactId` (string, required): The ID of the artifact to delete
   *   - For most artifacts: use the artifact ID from `create()` or `list()`
   *   - For audio artifacts: use the notebook ID (same as `notebookId` parameter)
   * - `notebookId` (string, optional): Required only for audio artifacts (must match `artifactId`)
   * 
   * **Output:** Returns `void` on success. Throws an error if deletion fails.
   * 
   * **Note:** 
   * - Deletion is permanent and cannot be undone
   * - Works for all artifact types (quiz, flashcards, study guide, mind map, infographic, slide deck, report, audio, video)
   * - Audio artifacts require passing the notebook ID as both parameters
   * 
   * @param artifactId - The artifact ID (for audio artifacts, use notebookId)
   * @param notebookId - Optional notebook ID (required for audio artifacts)
   * 
   * @example
   * ```typescript
   * // Delete any artifact type
   * await client.artifacts.delete('artifact-id');
   * 
   * // Delete audio artifact (requires notebook ID)
   * await client.artifacts.delete('notebook-id', 'notebook-id');
   * ```
   */
  async delete(artifactId: string, notebookId?: string): Promise<void> {
    // Audio and Video artifacts use V5N4be RPC with [[2], artifactId] structure
    // Audio: notebookId === artifactId
    // Video: need to check artifact type
    if (notebookId && artifactId === notebookId) {
      // Audio artifacts
      await this.rpc.call(
        RPC.RPC_DELETE_AUDIO_OVERVIEW,
        [[2], artifactId], // Audio delete uses [[2], artifactId] structure
        artifactId
      );
    } else {
      // Check if it's a video artifact
      try {
        const artifact = await this.get(artifactId);
        if (artifact.type === ArtifactType.VIDEO) {
          // Video artifacts also use V5N4be with same structure
          await this.rpc.call(
            RPC.RPC_DELETE_AUDIO_OVERVIEW, // V5N4be - used for both audio and video
            [[2], artifactId],
            artifactId
          );
        } else {
          // Other artifacts use WxBZtb
          await this.rpc.call(
            RPC.RPC_DELETE_ARTIFACT,
            [artifactId]
          );
        }
      } catch (error) {
        // If we can't get artifact, fall back to standard delete
        await this.rpc.call(
          RPC.RPC_DELETE_ARTIFACT,
          [artifactId]
        );
      }
    }
  }
  
  /**
   * Get artifact details
   * 
   * **What it does:** Retrieves detailed information about a specific artifact, including its 
   * current state, metadata, and content references.
   * 
   * **Input:**
   * - `artifactId` (string, required): The ID of the artifact to retrieve
   *   - For most artifacts: use the artifact ID from `create()` or `list()`
   *   - For audio artifacts: use the notebook ID
   * - `notebookId` (string, optional): Required for audio artifacts (must match `artifactId`)
   * 
   * **Output:** Returns an `Artifact` object containing:
   * - `artifactId`: Unique identifier
   * - `type`: Artifact type (QUIZ, FLASHCARDS, STUDY_GUIDE, MIND_MAP, INFOGRAPHIC, SLIDE_DECK, AUDIO, VIDEO, etc.)
   * - `state`: Current state - check this to see if artifact is ready:
   *   - `CREATING`: Artifact is still being generated
   *   - `READY`: Artifact is complete and ready to use
   *   - `FAILED`: Artifact creation failed
   * - `title`: Display name
   * - `sourceIds`: Source IDs used in creation
   * - `createdAt`, `updatedAt`: Timestamps
   * - For audio: `audioData`, `duration`, `status` (if available)
   * - For video: `videoData`, `status` (if available)
   * 
   * **Next steps:**
   * - Check `state` field - if `CREATING`, wait and poll again using `get()`
   * - If `READY`, use `download(artifactId)` to retrieve the actual content
   * - For quizzes/flashcards: `download()` returns structured data (QuizData/FlashcardData)
   * - For audio/video: `download()` returns the media data
   * 
   * @param artifactId - The artifact ID
   * @param notebookId - Optional notebook ID (for audio artifacts)
   * 
   * @example
   * ```typescript
   * // Get artifact details
   * const artifact = await client.artifacts.get('artifact-id');
   * 
   * // Check if ready
   * if (artifact.state === ArtifactState.READY) {
   *   const data = await client.artifacts.download(artifact.artifactId);
   *   console.log('Artifact is ready!', data);
   * } else if (artifact.state === ArtifactState.CREATING) {
   *   console.log('Still creating... wait and check again');
   * }
   * 
   * // Get audio artifact (requires notebook ID)
   * const audio = await client.artifacts.get('notebook-id', 'notebook-id');
   * ```
   */
  async get(artifactId: string, notebookId?: string): Promise<Artifact> {
    // Audio artifacts use a different RPC method
    if (notebookId && artifactId === notebookId) {
      const response = await this.rpc.call(
        RPC.RPC_GET_AUDIO_OVERVIEW,
        [artifactId, 1],
        artifactId
      );
      return this.parseAudioResponse(response, artifactId);
    }
    
    // For regular artifacts, try RPC_GET_ARTIFACT first
    // NOTE: RPC_GET_ARTIFACT (BnLyuf) returns 400 for quiz/flashcard artifacts
    // If it fails and we have notebookId, fall back to using list() to find the artifact
    try {
      const response = await this.rpc.call(
        RPC.RPC_GET_ARTIFACT,
        [artifactId],
        notebookId // Pass notebookId to set source-path correctly
      );
      
      return this.parseArtifactResponse(response);
    } catch (error: any) {
      // If RPC_GET_ARTIFACT fails (likely 400 for quiz/flashcards) and we have notebookId,
      // fall back to using list() to find the artifact metadata
      if (notebookId && (error?.message?.includes('400') || error?.statusCode === 400)) {
        const artifacts = await this.list(notebookId);
        const artifact = artifacts.find(a => a.artifactId === artifactId);
        if (artifact) {
          return artifact;
        }
        // If not found in list, throw the original error
        throw new NotebookLMError(
          `Artifact ${artifactId} not found. RPC_GET_ARTIFACT failed and artifact not found in list.`,
          error
        );
      }
      // Re-throw if we don't have notebookId or it's a different error
      throw error;
    }
  }
  
  /**
   * Update artifact metadata
   * 
   * **What it does:** Updates various fields of an artifact, such as title, state, or custom metadata.
   * Works for all artifact types (quiz, flashcards, study guide, mind map, infographic, slide deck, 
   * report, audio, video). Note that this updates metadata only - to get updated content, use 
   * `get()` or `download()`.
   * 
   * **Input:**
   * - `artifactId` (string, required): The ID of the artifact to update
   *   - For most artifacts: use the artifact ID from `create()` or `list()`
   *   - For audio artifacts: use the notebook ID
   * - `updates` (object, required): Fields to update:
   *   - `title` (string, optional): New display name for the artifact
   *   - `state` (ArtifactState, optional): Update artifact state (rarely needed - backend manages this)
   *   - Additional fields: Any other fields supported by the artifact type
   * 
   * **Output:** Returns the updated `Artifact` object with the new values.
   * 
   * **Common use cases:**
   * - Updating artifact metadata (title, state, etc.)
   * - Updating custom metadata fields specific to certain artifact types
   * - Note: For just renaming, `rename()` is more convenient
   * 
   * **Note:** 
   * - Works for all artifact types (quiz, flashcards, study guide, mind map, infographic, slide deck, report, audio, video)
   * - Most artifact content changes require creating a new artifact. This method is primarily for metadata updates.
   * 
   * @param artifactId - The artifact ID
   * @param updates - Fields to update
   * 
   * @example
   * ```typescript
   * // Update title for any artifact type
   * const artifact = await client.artifacts.update('artifact-id', {
   *   title: 'Updated Title',
   * });
   * 
   * // Update multiple fields
   * await client.artifacts.update('artifact-id', {
   *   title: 'New Title',
   *   state: ArtifactState.READY,
   * });
   * ```
   */
  async update(artifactId: string, updates: {
    title?: string;
    state?: ArtifactState;
    [key: string]: any;
  }): Promise<Artifact> {
    const updateMask: string[] = [];
    const artifact: any = { id: artifactId };
    
    if (updates.title !== undefined) {
      artifact.title = updates.title;
      updateMask.push('title');
    }
    if (updates.state !== undefined) {
      artifact.state = updates.state;
      updateMask.push('state');
    }
    
    // Allow other fields to be passed through
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'title' && key !== 'state' && value !== undefined) {
        artifact[key] = value;
        updateMask.push(key);
      }
    }
    
    const response = await this.rpc.call(
      RPC.RPC_UPDATE_ARTIFACT,
      [artifact, updateMask]
    );
    
    return this.parseArtifactResponse(response);
  }
  
  /**
   * Create an artifact
   * 
   * **What it does:** Creates a new artifact (quiz, flashcards, study guide, mind map, infographic, 
   * slide deck, report, audio overview, or video overview) from the sources in a notebook. The 
   * artifact generation process begins immediately but may take time to complete.
   * 
   * **⚠️ IMPORTANT: Sources Required**
   * - **The notebook must have at least one source** before creating artifacts
   * - If `sourceIds` is omitted, **all sources in the notebook** are used automatically
   * - If `sourceIds` is provided, **only those specific sources** are used
   * - **Video artifacts specifically require sources** - always provide `sourceIds` for videos
   * - **Audio artifacts** work like slides - if `sourceIds` is provided, use those sources; if omitted/empty, use all sources
   * 
   * **Input:**
   * - `notebookId` (string, required): The notebook containing the sources to use
   * - `type` (ArtifactType, required): The type of artifact to create:
   *   - `ArtifactType.QUIZ` - Multiple choice questions with explanations
   *   - `ArtifactType.FLASHCARDS` - Question/answer pairs for memorization
   *   - `ArtifactType.STUDY_GUIDE` - Comprehensive study document
   *   - `ArtifactType.MIND_MAP` - Visual concept mapping
   *   - `ArtifactType.INFOGRAPHIC` - Visual data summary
   *   - `ArtifactType.SLIDE_DECK` - Presentation slides
   *   - `ArtifactType.AUDIO` - Audio overview (podcast-style)
   *   - `ArtifactType.VIDEO` - Video overview
   *   - `ArtifactType.DOCUMENT` - General document
   * - `options` (CreateArtifactOptions, optional): Creation parameters:
   *   - `title` (string, optional): Display name for the artifact
   *   - `instructions` (string, optional): Custom instructions for generation (e.g., "Focus on key concepts")
   *   - `sourceIds` (string[], optional): Source IDs to use for artifact generation:
   *     - **For Video**: **Required** - always provide `sourceIds` (e.g., `['source-id-1', 'source-id-2']`)
   *     - **For Audio**: Optional - omit to use all sources, or specify to use only selected sources (works like slides)
   *     - **For Quiz**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Flashcards**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Slide Deck**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Infographic**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Study Guide**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Mind Map**: Optional - omit to use all sources, or specify to use only selected sources
   *     - **For Report/Document**: Optional - omit to use all sources, or specify to use only selected sources
   *   - `customization` (object, optional): Type-specific customization options (see below)
   * 
   * **Customization Options by Type:**
   * 
   * **Note:** Customization is only supported for the following artifact types:
   * Quiz, Flashcards, Slide Deck, Infographic, Audio, Video.
   * 
   * Other artifact types (Study Guide, Mind Map, Report, Document) do not support customization.
   * 
   * **Quiz (`QuizCustomization`):**
   * - `customization.numberOfQuestions` (1 | 2 | 3, optional): Number of questions
   *   - `1` = Fewer questions
   *   - `2` = Standard (default)
   *   - `3` = More questions
   * - `customization.difficulty` (1 | 2 | 3, optional): Difficulty level
   *   - `1` = Easy
   *   - `2` = Medium (default)
   *   - `3` = Hard
   * - `customization.language` (string, optional): Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta')
 *   - NotebookLM supports 80+ languages for artifacts
 *   - Use `NotebookLMLanguage` enum for type safety, or pass ISO 639-1 codes directly
   * - `instructions` (string, optional): Custom instructions for question focus
   * 
   * **Flashcards (`FlashcardCustomization`):**
   * - `customization.numberOfCards` (1 | 2 | 3, optional): Number of flashcard pairs
   *   - `1` = Fewer cards
   *   - `2` = Standard (default)
   *   - `3` = More cards
   * - `customization.difficulty` (1 | 2 | 3, optional): Difficulty level
   *   - `1` = Easy
   *   - `2` = Medium (default)
   *   - `3` = Hard
   * - `customization.language` (string, optional): Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta')
 *   - NotebookLM supports 80+ languages for artifacts
 *   - Use `NotebookLMLanguage` enum for type safety, or pass ISO 639-1 codes directly
   * - `instructions` (string, optional): Custom instructions for topic focus
   * 
   * **Slide Deck (`SlideDeckCustomization`):**
   * - `customization.format` (2 | 3, optional): Presentation format
   *   - `2` = Presenter slides (default)
   *   - `3` = Detailed deck
   * - `customization.language` (string, optional): Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en')
 *   - NotebookLM supports 80+ languages for slide decks
   * - `customization.length` (1 | 2 | 3, optional): Length preference
   *   - `1` = Short
   *   - `2` = Default (default)
   *   - `3` = Long
   * - `instructions` (string, optional): Used as description/theme for the presentation
   * 
   * **Infographic (`InfographicCustomization`):**
   * - `customization.language` (string, optional): Language code (use NotebookLMLanguage enum or ISO 639-1 code, e.g., 'en', 'hi', 'ta')
 *   - NotebookLM supports 80+ languages for artifacts
 *   - Use `NotebookLMLanguage` enum for type safety, or pass ISO 639-1 codes directly
   * - `customization.orientation` (1 | 2 | 3, optional): Visual orientation/style
   *   - `1` = Landscape (default)
   *   - `2` = Portrait
   *   - `3` = Square
   * - `customization.levelOfDetail` (1 | 2 | 3, optional): Level of detail
   *   - `1` = Concise
   *   - `2` = Standard (default)
   *   - `3` = Detailed
   * 
   * **Audio Overview (`AudioCustomization`):**
   * - `customization.format` (0 | 1 | 2 | 3, optional): Audio format type
   *   - `0` = Deep dive (default)
   *   - `1` = Brief
   *   - `2` = Critique
   *   - `3` = Debate
   * - `customization.language` (string, optional): Language code (e.g., 'en', 'hi')
   * - `customization.length` (1 | 2 | 3, optional): Length preference
   *   - `1` = Short
   *   - `2` = Default (default)
   *   - `3` = Long
   * - `instructions` (string, optional): Custom instructions for content and style
   * 
   * **Video Overview (`VideoCustomization`):**
   * - `customization.format` (1 | 2, optional): Video format
   *   - `1` = Explainer (default)
   *   - `2` = Brief
   * - `customization.language` (string, optional): Language code (use NotebookLMLanguage enum or ISO 639-1 code, default: 'en')
 *   - NotebookLM supports 80+ languages for video overviews
   * - `customization.visualStyle` (0 | 1 | 2 | 3 | 4 | 5, optional): Visual style
   *   - `0` = Auto-select (default)
   *   - `1` = Custom
   *   - `2` = Classic
   *   - `3` = Whiteboard
   *   - `4` = Kawaii
   *   - `5` = Anime
   * - `sourceIds` (string[], required for video): Specify sources to include - **video artifacts require sources**
   * - `instructions` (string, optional): Detailed instructions for video content and style
   * 
   * **Study Guide, Mind Map, Report, Document:**
   * - Customization is NOT supported for these artifact types
   * - Use `title` and `instructions` only
   * 
   * **Output:** Returns an `Artifact` object with:
   * - `artifactId`: Unique identifier (save this for later operations)
   * - `type`: The artifact type you specified
   * - `state`: Usually `CREATING` initially (check with `get()` to see when it becomes `READY`)
   * - `title`: The title (if provided)
   * - `sourceIds`: Sources used for generation
   * - `createdAt`, `updatedAt`: Timestamps
   * 
   * **Next steps:**
   * 1. **Poll for completion:** Use `get(artifactId)` periodically to check if `state === ArtifactState.READY`
   * 2. **Download content:** Once ready, use `download(artifactId)` to get the actual data:
   *    - Quizzes: Returns `QuizData` with questions, options, correct answers, explanations
   *    - Flashcards: Returns `FlashcardData` with CSV string and parsed flashcards
   *    - Audio: Returns `AudioArtifact` with base64 audio data (save to file)
   *    - Video: Returns `VideoArtifact` with video data
   *    - Others: Returns artifact data structure
   * 3. **List artifacts:** Use `list(notebookId)` to see all artifacts in the notebook
   * 4. **Manage:** Use `rename()`, `update()`, or `delete()` as needed
   * 
   * **Quota:** Creation consumes quota for certain types (quizzes, flashcards, audio, video). 
   * Quota is checked before creation and recorded after success.
   * 
   * @param notebookId - The notebook ID
   * @param type - The artifact type (use ArtifactType enum)
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * import { ArtifactType, ArtifactState } from 'notebooklm-kit';
   * 
   * // Create a quiz with custom instructions
   * const quiz = await client.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   title: 'Chapter 1 Quiz',
   *   instructions: 'Create 10 multiple choice questions covering key concepts',
   * });
   * console.log(`Quiz ID: ${quiz.artifactId}, State: ${quiz.state}`);
   * 
   * // Create flashcards
   * const flashcards = await client.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
   *   instructions: 'Focus on key terminology and definitions',
   * });
   * 
   * // Create quiz with customization
   * import { NotebookLMLanguage } from 'notebooklm-kit';
   * 
   * const quiz = await client.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   title: 'Chapter 1 Quiz',
   *   instructions: 'Focus on key concepts',
   *   customization: {
   *     numberOfQuestions: 3, // More questions
   *     difficulty: 3, // Hard
   *     language: NotebookLMLanguage.ENGLISH, // or 'en'
   *   },
   * });
   * 
   * // Create flashcards with customization
   * const flashcards = await client.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
   *   instructions: 'Focus on key terminology',
   *   customization: {
   *     numberOfCards: 2, // Standard
   *     difficulty: 2, // Medium
   *     language: NotebookLMLanguage.HINDI, // or 'hi'
   *   },
   * });
   * 
   * // Create slide deck with customization
   * const slides = await client.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
   *   title: 'Quarterly Report',
   *   instructions: 'Focus on revenue and growth metrics',
   *   customization: {
   *     format: 3, // Detailed deck
   *     language: NotebookLMLanguage.SPANISH, // or 'es'
   *     length: 2, // Default
   *   },
   * });
   * 
   * // Create infographic with customization
   * const infographic = await client.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
   *   customization: {
   *     language: NotebookLMLanguage.TAMIL, // or 'ta'
   *     orientation: 1, // Landscape
   *     levelOfDetail: 2, // Standard
   *   },
   * });
   * 
   * // Create audio overview with customization
   * const audio = await client.artifacts.create('notebook-id', ArtifactType.AUDIO, {
   *   instructions: 'Create an engaging podcast summary',
   *   customization: {
   *     format: 0, // Deep dive
   *     language: NotebookLMLanguage.FRENCH, // or 'fr' - supports 80+ languages
   *     length: 2, // Default
   *   },
   * });
   * 
   * // Create video overview with customization
   * const video = await client.artifacts.create('notebook-id', ArtifactType.VIDEO, {
   *   instructions: 'Create a video overview focusing on the main research findings',
   *   sourceIds: ['source-id-1', 'source-id-2'],
   *   customization: {
   *     format: 1, // Explainer
   *     language: NotebookLMLanguage.JAPANESE, // or 'ja' - supports 80+ languages
   *     visualStyle: 0, // Auto-select
   *   },
   * });
   * 
   * // Create study guide (uses all sources)
   * const guide = await client.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
   *   title: 'Final Exam Study Guide',
   *   instructions: 'Focus on key concepts, formulas, and important dates',
   *   // sourceIds omitted = uses all sources
   * });
   * 
   * // Create study guide from specific sources
   * const guideFromSelected = await client.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
   *   title: 'Chapter 1-3 Study Guide',
   *   instructions: 'Focus on chapters 1-3',
   *   sourceIds: ['source-id-1', 'source-id-2', 'source-id-3'], // Only these sources
   * });
   * 
   * // Poll until ready, then download
   * let artifact = quiz;
   * while (artifact.state === ArtifactState.CREATING) {
   *   await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
   *   artifact = await client.artifacts.get(quiz.artifactId);
   * }
   * 
   * if (artifact.state === ArtifactState.READY) {
   *   const quizData = await client.artifacts.download(quiz.artifactId);
   *   console.log(`Quiz has ${quizData.totalQuestions} questions`);
   * }
   * ```
   */
  async create(
    notebookId: string,
    type: ArtifactType,
    options: CreateArtifactOptions = {}
  ): Promise<Artifact> {
    // Validate that customization is only provided for supported types
    const supportedCustomizationTypes = [
      ArtifactType.QUIZ,
      ArtifactType.FLASHCARDS,
      ArtifactType.SLIDE_DECK,
      ArtifactType.INFOGRAPHIC,
      ArtifactType.AUDIO,
      ArtifactType.VIDEO,
    ];
    
    if (options.customization && !supportedCustomizationTypes.includes(type)) {
      throw new NotebookLMError(
        `Customization is not supported for artifact type ${type}. ` +
        `Customization is only supported for: Quiz, Flashcards, Slide Deck, Infographic, Audio, Video.`
      );
    }
    
    // Handle quota checks for quota-tracked artifact types
    const quotaType = this.getQuotaType(type);
    if (quotaType) {
      this.quota?.checkQuota(quotaType);
    }
    
    let artifact: Artifact;
    
    // Mind Map uses yyryJe (RPC_ACT_ON_SOURCES) with special structure
    if (type === ArtifactType.MIND_MAP) {
      artifact = await this.createMindMap(notebookId, options);
    } else if (type === ArtifactType.AUDIO || type === ArtifactType.VIDEO || type === ArtifactType.QUIZ || type === ArtifactType.FLASHCARDS || type === ArtifactType.SLIDE_DECK || type === ArtifactType.INFOGRAPHIC) {
      // Audio, Video, Quiz, Flashcards, Slides, and Infographics all use R7cb6c
      artifact = await this.createR7cb6cArtifact(notebookId, type, options);
    } else {
      // Other artifacts use xpWGLf (Study Guide, Report, Document)
      artifact = await this.createStandardArtifact(notebookId, type, options);
    }
    
    // Record quota usage
    if (quotaType) {
      this.quota?.recordUsage(quotaType);
    }
    
    return artifact;
  }
  
  /**
   * Download artifact data and save to file
   * 
   * **What it does:** Downloads the actual content/data for artifacts and saves it to the specified 
   * folder location. The file format and naming depend on the artifact type. Use this after an 
   * artifact's state is `READY`.
   * 
   * **Input:**
   * - `artifactId` (string, required): The ID of the artifact to download
   *   - For most artifacts: use the artifact ID from `create()` or `list()`
   *   - For audio artifacts: use the notebook ID
   * - `folderPath` (string, required): Folder path where the file should be saved
   *   - On Node.js: Absolute or relative file system path (e.g., `./downloads` or `/tmp/artifacts`)
   *   - On Browser: File name only (file will be downloaded via browser download)
   * - `notebookId` (string, optional): Required for audio artifacts (must match `artifactId`)
   * 
   * **Output:** Returns the path/name of the saved file and the data structure:
   * ```typescript
   * {
   *   filePath: string, // Path/filename where the file was saved
   *   data: QuizData | FlashcardData | AudioArtifact | VideoArtifact | any // The artifact data
   * }
   * ```
   * 
   * **File Formats by Type:**
   * 
   * **Audio:**
   * - Format: MP3 audio file
   * - Filename: `audio_<artifactId>.mp3` (or based on artifact title if available)
   * - Content: Base64 decoded audio data saved as binary
   * 
   * **Video:**
   * - Format: Video file (format depends on backend response - may be URL or base64)
   * - Filename: `video_<artifactId>.mp4` (or based on artifact title)
   * - Content: Video data saved as binary
   * 
   * **Slide Deck:**
   * - Format: Depends on backend (may be PDF, PPTX, or other format)
   * - Filename: `slides_<artifactId>.pdf` (or based on artifact title)
   * - Content: Slide deck file saved as binary
   * 
   * **Quiz:**
   * - Format: JSON file
   * - Filename: `quiz_<artifactId>.json`
   * - Content: Structured quiz data with questions, options, correct answers, explanations
   * 
   * **Flashcards:**
   * - Format: CSV file
   * - Filename: `flashcards_<artifactId>.csv`
   * - Content: CSV format with question,answer pairs
   * 
   * **Mind Map:**
   * - Format: JSON file
   * - Filename: `mindmap_<artifactId>.json`
   * - Content: Structured mind map data (nodes, connections, etc.)
   * 
   * **Infographic:**
   * - Format: JSON or image file (depends on backend)
   * - Filename: `infographic_<artifactId>.json` or `.png`/`.jpg`
   * - Content: Infographic data or image file
   * 
   * **Study Guide / Report:**
   * - Format: JSON file
   * - Filename: `studyguide_<artifactId>.json` or `report_<artifactId>.json`
   * - Content: Structured document data
   * 
   * **Important:** 
   * - Ensure artifact state is `READY` before downloading (check with `get()`)
   * - Downloading a `CREATING` artifact may return incomplete data
   * - For audio/video/slides, large files may take time to download
   * - On Node.js: The folder must exist or be creatable
   * - On Browser: The file will trigger a browser download with the specified filename
   * 
   * @param artifactId - The artifact ID
   * @param folderPath - Folder path where to save the file
   * @param notebookId - Optional notebook ID (for audio artifacts)
   * @returns Object with filePath and data
   * 
   * @example
   * ```typescript
   * import { ArtifactState } from 'notebooklm-kit';
   * 
   * // Download quiz and save as JSON
   * const artifact = await client.artifacts.get('quiz-id');
   * if (artifact.state === ArtifactState.READY) {
   *   const result = await client.artifacts.download('quiz-id', './downloads');
   *   console.log(`Quiz saved to: ${result.filePath}`);
   *   console.log(`Quiz has ${result.data.totalQuestions} questions`);
   * }
   * 
   * // Download flashcards and save as CSV
   * const flashcardResult = await client.artifacts.download('flashcard-id', './downloads');
   * console.log(`Flashcards saved to: ${flashcardResult.filePath}`);
   * 
   * // Download audio and save as MP3
   * const audioResult = await client.artifacts.download('notebook-id', './downloads', 'notebook-id');
   * console.log(`Audio saved to: ${audioResult.filePath}`);
   * 
   * // Download video and save
   * const videoResult = await client.artifacts.download('video-id', './downloads');
   * console.log(`Video saved to: ${videoResult.filePath}`);
   * 
   * // Download slide deck
   * const slidesResult = await client.artifacts.download('slide-id', './downloads');
   * console.log(`Slides saved to: ${slidesResult.filePath}`);
   * 
   * // Download mind map
   * const mindmapResult = await client.artifacts.download('mindmap-id', './downloads');
   * console.log(`Mind map saved to: ${mindmapResult.filePath}`);
   * 
   * // Download infographic
   * const infographicResult = await client.artifacts.download('infographic-id', './downloads');
   * console.log(`Infographic saved to: ${infographicResult.filePath}`);
   * 
   * // Download study guide
   * const guideResult = await client.artifacts.download('guide-id', './downloads');
   * console.log(`Study guide saved to: ${guideResult.filePath}`);
   * ```
   */
  async download(
    artifactId: string, 
    folderPath: string,
    notebookId?: string,
    artifactType?: ArtifactType
  ): Promise<{ filePath: string; data: QuizData | FlashcardData | AudioArtifact | VideoArtifact | any }> {
    // Determine artifact type and get metadata
    let artifact: Artifact;
    
    if (notebookId && artifactId === notebookId) {
      // Audio artifacts - get() works for them
      artifact = await this.get(artifactId, notebookId);
    } else if (artifactType === ArtifactType.QUIZ || artifactType === ArtifactType.FLASHCARDS) {
      // For quiz/flashcard, get metadata from list() if notebookId is available
      // RPC_GET_ARTIFACT (BnLyuf) returns 400 for quiz/flashcards, so we don't use it
      if (notebookId) {
        const artifacts = await this.list(notebookId);
        const found = artifacts.find(a => a.artifactId === artifactId);
        if (found) {
          artifact = found;
        } else {
          // Fallback: create minimal artifact object
          artifact = {
            artifactId,
            type: artifactType,
            state: ArtifactState.READY,
          };
        }
      } else {
        // No notebookId provided, use the provided type
        artifact = {
          artifactId,
          type: artifactType,
          state: ArtifactState.READY,
        };
      }
    } else {
      // For other artifacts, get() works fine
      artifact = await this.get(artifactId, notebookId);
    }
    
    // Download the data - return raw response without parsing
    let data: any;
    if (notebookId && artifactId === notebookId) {
      // Audio artifacts use a different RPC method
      data = await this.downloadAudio(artifactId);
    } else if (artifact.type === ArtifactType.QUIZ || artifact.type === ArtifactType.FLASHCARDS) {
      // Quiz and Flashcard artifacts use v9rmvd (RPC_GET_QUIZ_DATA) for download
      // RPC_GET_ARTIFACT (BnLyuf) doesn't work for quiz/flashcards
      const response = await this.rpc.call(
        RPC.RPC_GET_QUIZ_DATA,
        [artifactId],
        notebookId // Pass notebookId to set correct source-path
      );
      data = response; // Raw response, no parsing
    } else {
      // Other artifacts use RPC_GET_ARTIFACT (BnLyuf) for download
      const response = await this.rpc.call(
        RPC.RPC_GET_ARTIFACT,
        [artifactId],
        notebookId // Pass notebookId to set correct source-path
      );
      data = response; // Raw response
    }
    
    // Save to file based on artifact type (will format appropriately)
    const filePath = await this.saveArtifactToFile(artifact, data, folderPath);
    
    return { filePath, data };
  }
  
  // ========================================================================
  // Private creation methods
  // ========================================================================
  
  /**
   * Maps ArtifactType enum to API type numbers (for creation)
   */
  private getApiTypeNumber(artifactType: ArtifactType): number {
    switch (artifactType) {
      case ArtifactType.QUIZ:
        return 4;
      case ArtifactType.FLASHCARDS:
        return 4; // Flashcards use same API type as Quiz for creation
      case ArtifactType.INFOGRAPHIC:
        return 7;
      case ArtifactType.SLIDE_DECK:
        return 8;
      case ArtifactType.VIDEO:
        return 3;
      case ArtifactType.AUDIO:
        return 1;
      default:
        return artifactType;
    }
  }
  
  /**
   * Maps API response type numbers to ArtifactType enum (for parsing list/get responses)
   * Note: Both Quiz and Flashcards use type 4 in API responses, so we need to differentiate
   * them by looking at the customization data structure or other fields.
   */
  private mapApiTypeToArtifactType(apiType: number, artifactData: any[]): ArtifactType {
    // Both Quiz and Flashcards use type 4 in the API response
    // We need to differentiate them by looking at the customization structure or content patterns
    if (apiType === 4) {
      // First, try to find customization data structure
      // Quiz customization has 8 elements in the inner array (7 nulls + difficulty array at index 7)
      // Flashcard customization has 7 elements in the inner array (6 nulls + difficulty array at index 6)
      const possibleIndices = [9, 10, 8, 11, 12];
      
      for (const index of possibleIndices) {
        if (Array.isArray(artifactData) && artifactData.length > index && artifactData[index]) {
          const customization = artifactData[index];
          
          // Check if it's the customization array structure: [null, [innerArray]]
          if (Array.isArray(customization) && customization.length > 1 && Array.isArray(customization[1])) {
            const innerArray = customization[1];
            
            // Quiz has 8 elements with difficulty array at index 7
            if (innerArray.length === 8 && innerArray[7] && Array.isArray(innerArray[7])) {
              return ArtifactType.QUIZ;
            }
            
            // Flashcards have 7 elements with difficulty array at index 6
            if (innerArray.length === 7 && innerArray[6] && Array.isArray(innerArray[6])) {
              return ArtifactType.FLASHCARDS;
            }
          }
        }
      }
      
      // Additional fallback: search through the entire array for customization-like structures
      if (Array.isArray(artifactData)) {
        for (let i = 0; i < artifactData.length; i++) {
          const item = artifactData[i];
          if (Array.isArray(item) && item.length > 1 && Array.isArray(item[1])) {
            const innerArray = item[1];
            // Quiz pattern: 8 elements, difficulty array at index 7
            if (innerArray.length === 8 && innerArray[7] && Array.isArray(innerArray[7])) {
              return ArtifactType.QUIZ;
            }
            // Flashcard pattern: 7 elements, difficulty array at index 6
            if (innerArray.length === 7 && innerArray[6] && Array.isArray(innerArray[6])) {
              return ArtifactType.FLASHCARDS;
            }
          }
        }
      }
      
      // Second fallback: search for content patterns in strings (including JSON stringified data)
      // This helps detect flashcards vs quiz even in list responses that might have JSON strings
      const searchForContentPattern = (obj: any, depth: number = 0): 'quiz' | 'flashcards' | null => {
        if (depth > 10) return null; // Prevent deep recursion, but allow deeper search
        
        if (typeof obj === 'string') {
          // Check for flashcard patterns (more specific, check first)
          // Look for "flashcards" in various encodings/contexts
          const lowerStr = obj.toLowerCase();
          if (lowerStr.includes('flashcards') || 
              obj.includes('"flashcards"') || 
              obj.includes('&quot;flashcards&quot;') ||
              (obj.includes('data-app-data') && obj.includes('flashcards'))) {
            return 'flashcards';
          }
          // Check for quiz patterns
          // Use word boundaries or context to avoid false positives like "question" containing "quiz"
          if ((obj.includes('"quiz"') && !obj.includes('"flashcards"')) || 
              (obj.includes('&quot;quiz&quot;') && !obj.includes('&quot;flashcards&quot;')) ||
              (obj.includes('data-app-data') && obj.includes('"quiz"') && !obj.includes('flashcards'))) {
            return 'quiz';
          }
        } else if (Array.isArray(obj)) {
          for (const item of obj) {
            const result = searchForContentPattern(item, depth + 1);
            if (result) return result;
          }
        } else if (obj && typeof obj === 'object') {
          for (const key in obj) {
            const result = searchForContentPattern(obj[key], depth + 1);
            if (result) return result;
          }
        }
        
        return null;
      };
      
      // Search the data structure
      let contentPattern = searchForContentPattern(artifactData);
      
      // Also try searching the stringified version (in case data is in JSON string form)
      if (!contentPattern) {
        try {
          const stringified = JSON.stringify(artifactData);
          contentPattern = searchForContentPattern(stringified);
        } catch {
          // If stringify fails, continue
        }
      }
      
      if (contentPattern === 'flashcards') {
        return ArtifactType.FLASHCARDS;
      }
      if (contentPattern === 'quiz') {
        return ArtifactType.QUIZ;
      }
      
      // If we still can't differentiate, default to QUIZ (to preserve existing behavior)
      // This should be rare if the customization data or content patterns are present
      return ArtifactType.QUIZ;
    }
    
    // Both Video and Outline use type 3 in the API response
    // We need to differentiate them by looking for video-specific patterns
    if (apiType === 3) {
      // Check for video-specific patterns:
      // 1. Look for video URLs (lh3.googleusercontent.com/notebooklm/...)
      // 2. Look for video-related strings
      // 3. Check customization structure (videos might have different customization)
      
      const searchForVideoPattern = (obj: any, depth: number = 0): boolean => {
        if (depth > 10) return false;
        
        if (typeof obj === 'string') {
          // Check for video URL patterns
          if (obj.includes('lh3.googleusercontent.com/notebooklm/') ||
              obj.includes('lh3.google.com/rd-notebooklm/') ||
              obj.includes('googlevideo.com/videoplayback') ||
              obj.includes('=m22') ||
              obj.includes('video') ||
              obj.includes('videoplayback')) {
            return true;
          }
        } else if (Array.isArray(obj)) {
          for (const item of obj) {
            if (searchForVideoPattern(item, depth + 1)) {
              return true;
            }
          }
        } else if (obj && typeof obj === 'object') {
          for (const key in obj) {
            if (searchForVideoPattern(obj[key], depth + 1)) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      // Search the data structure for video patterns
      let isVideo = searchForVideoPattern(artifactData);
      
      // Also try searching the stringified version
      if (!isVideo) {
        try {
          const stringified = JSON.stringify(artifactData);
          isVideo = searchForVideoPattern(stringified);
        } catch {
          // If stringify fails, continue
        }
      }
      
      if (isVideo) {
        return ArtifactType.VIDEO;
      }
      
      // Default to OUTLINE if no video patterns found
      return ArtifactType.OUTLINE;
    }
    
    // For other types, map based on known patterns
    switch (apiType) {
      case 1:
        // Type 1 can be DOCUMENT or AUDIO - check for audio patterns
        // Audio artifacts might have audio-specific URLs or patterns
        const searchForAudioPattern = (obj: any, depth: number = 0): boolean => {
          if (depth > 10) return false;
          
          if (typeof obj === 'string') {
            // Check for audio URL patterns (similar to video detection)
            // Audio URLs from mm30.txt have pattern: =m140-dv
            // Video URLs have pattern: =m22-dv
            if (obj.includes('lh3.googleusercontent.com/notebooklm/') ||
                obj.includes('lh3.google.com/rd-notebooklm/') ||
                obj.includes('=m140') || // Audio format marker from mm30.txt (m140-dv)
                obj.includes('=m140-dv') || // Full audio format marker
                (obj.includes('lh3.googleusercontent.com/notebooklm/') && !obj.includes('=m22')) || // Audio URL without video marker
                obj.toLowerCase().includes('audio') ||
                obj.toLowerCase().includes('podcast')) {
              return true;
            }
          } else if (Array.isArray(obj)) {
            for (const item of obj) {
              if (searchForAudioPattern(item, depth + 1)) {
                return true;
              }
            }
          } else if (obj && typeof obj === 'object') {
            for (const key in obj) {
              if (searchForAudioPattern(obj[key], depth + 1)) {
                return true;
              }
            }
          }
          return false;
        };
        
        // Search for audio patterns
        let isAudio = searchForAudioPattern(artifactData);
        
        // Also try searching the stringified version
        if (!isAudio) {
          try {
            const stringified = JSON.stringify(artifactData);
            isAudio = searchForAudioPattern(stringified);
          } catch {
            // If stringify fails, continue
          }
        }
        
        if (isAudio) {
          return ArtifactType.AUDIO;
        }
        
        return ArtifactType.DOCUMENT;
      case 2:
        return ArtifactType.PRESENTATION;
      case 5:
        return ArtifactType.QUIZ; // Quiz enum value is 5
      case 6:
        return ArtifactType.FLASHCARDS; // Flashcard enum value is 6
      case 7:
        return ArtifactType.INFOGRAPHIC;
      case 8:
        return ArtifactType.SLIDE_DECK;
      case 10:
        return ArtifactType.AUDIO;
      case 11:
        return ArtifactType.VIDEO;
      default:
        // If no match, return the number as-is (it might still work for comparison)
        return apiType as ArtifactType;
    }
  }
  
  /**
   * Create artifacts using R7cb6c RPC (Quiz, Slides, Infographics, Video)
   */
  private async createR7cb6cArtifact(
    notebookId: string,
    artifactType: ArtifactType,
    options: CreateArtifactOptions
  ): Promise<Artifact> {
    const { instructions = '', sourceIds = [], customization } = options;
    const apiType = this.getApiTypeNumber(artifactType);
    
    // Format source IDs as nested arrays: [[[sourceId1]], [[sourceId2]]]
    const formattedSourceIds = sourceIds.map(id => [[id]]);
    
    // Build the base structure: [null, null, type, sourceIds, ...nulls, customization]
    // Use any[] to avoid TypeScript errors with complex nested structure
    const args: any[] = [
      [2], // Mode
      notebookId,
      [
        null,
        null,
        apiType,
        formattedSourceIds,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null, // Index 14
        null, // Index 15 (for slides/infographics)
      ],
    ];
    
    // Add customization based on artifact type
    // Note: Slide decks, Audio, and Video ALWAYS need customization array set, even with defaults
    if (artifactType === ArtifactType.SLIDE_DECK) {
      // Slides customization at index 15: [[instructions, language, format, length]]
      // Structure from mm9.txt: [[null,"en",1,3]]
      // Always set customization array, even if no customization object provided
      const slideCustom = customization as SlideDeckCustomization | undefined;
      const format = slideCustom?.format ?? 2; // 2=Presenter, 3=Detailed deck
      const length = slideCustom?.length ?? 2; // 1=Short, 2=Default, 3=Long
      
      (args[2] as any[])[15] = [[
        instructions || null, // Description/instructions
        slideCustom?.language || 'en', // Language (default: 'en')
        format, // Format (2=presenter, 3=detailed deck)
        length, // Length (1=short, 2=default, 3=long)
      ]];
    } else if (artifactType === ArtifactType.AUDIO) {
      // Audio customization at index 8: [null, [null, format, null, [sourceIdsFlat], language, null, length]]
      // Structure from mm3.txt and mm15.txt
      // Always set customization array, even if no customization object provided (to pass sourceIds)
      const audioCustom = customization as AudioCustomization | undefined;
      const userFormat = audioCustom?.format ?? 0; // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
      const rpcFormat = userFormat + 1; // Map to RPC format: 1=Deep dive, 2=Brief, 3=Critique, 4=Debate
      
      // Length restrictions per format:
      // - Deep dive (1): 1=Short, 2=Default, 3=Long (all 3 options)
      // - Brief (2): no length option (should be null)
      // - Critique (3): 1=Short, 2=Default (2 options)
      // - Debate (4): 1=Short, 2=Default (2 options)
      let length: number | null = null;
      if (audioCustom?.length !== undefined) {
        if (rpcFormat === 1) {
          // Deep dive: all 3 options (1, 2, 3)
          length = audioCustom.length;
        } else if (rpcFormat === 2) {
          // Brief: no length option
          length = null;
        } else if (rpcFormat === 3 || rpcFormat === 4) {
          // Critique or Debate: only 1=Short, 2=Default
          if (audioCustom.length === 1 || audioCustom.length === 2) {
            length = audioCustom.length;
          } else {
            // Default to 2 if invalid length provided
            length = 2;
          }
        }
      } else {
        // Default length based on format
        if (rpcFormat === 1) {
          length = 2; // Deep dive default
        } else if (rpcFormat === 3 || rpcFormat === 4) {
          length = 2; // Critique/Debate default
        }
        // Brief (rpcFormat === 2) stays null
      }
      
      const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]); // Flatten from [[[id]]] to [[id]]
      
      // CRITICAL: Audio customization is at INDEX 6, not 8!
      // Working structure from manual request: [null, [null, null, null, [[id1], [id2]], "en", null, length]]
      (args[2] as any[])[6] = [
        null,
        [
          null,
          null,
          null,
          sourceIdsFlat, // [[id1], [id2]] format - pass sourceIds here too
          audioCustom?.language || 'en', // Language
          null,
          length, // Length (1=Short, 2=Default, 3=Long, or null for Brief)
        ],
      ];
    } else if (artifactType === ArtifactType.VIDEO) {
      // Video customization at index 8: [null, null, [sourceIds, language, focus, null, format, visualStyle, customStyleDescription]]
      // Structure from mm2.txt and mm16.txt examples
      // Always set customization array, even if no customization object provided
      const videoCustom = customization as VideoCustomization | undefined;
      const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]); // Flatten from [[[id]]] to [[id]]
      const format = videoCustom?.format ?? 1; // 1=Explainer, 2=Brief
      const visualStyle = videoCustom?.visualStyle ?? 0; // 0=Auto-select
      
      // Build the customization array
      const customArray: any[] = [
        [sourceIdsFlat], // IMPORTANT: Wrap in extra array! [[["id1"], ["id2"]]] format
        videoCustom?.language || 'en',
        videoCustom?.focus || null, // "What should the AI hosts focus on?"
        null, // Placeholder
        format,
        visualStyle === 1 ? null : visualStyle, // If Custom (1), set to null and add description at end
      ];
      
      // If visualStyle is Custom (1), add customStyleDescription at the end
      if (visualStyle === 1 && videoCustom?.customStyleDescription) {
        customArray.push(videoCustom.customStyleDescription);
      }
      
      (args[2] as any[])[8] = [
        null,
        null,
        customArray,
      ];
    }
    
    // Optional customization for other artifacts (only if provided)
    if (customization) {
      if (artifactType === ArtifactType.QUIZ) {
        // Quiz customization at index 9: [null, [questionCount, null, instructions, null, null, null, null, [difficulty, difficulty]]]
        // Structure from mm11.txt: [null,[2,null,"hi",null,null,null,null,[3,3]]]
        const quizCustom = customization as QuizCustomization;
        const questionCount = quizCustom.numberOfQuestions ?? 2; // 1=Fewer, 2=Standard, 3=More
        const difficulty = quizCustom.difficulty ?? 2; // 1=Easy, 2=Medium, 3=Hard
        
        (args[2] as any[])[9] = [
          null,
          [
            questionCount,
            null,
            quizCustom.language || instructions || null, // Language or instructions at index 2
            null,
            null,
            null,
            null,
            [difficulty, difficulty], // Difficulty array
          ],
        ];
      } else if (artifactType === ArtifactType.FLASHCARDS) {
        // Flashcard customization at index 9: [null, [numberOfCards, null, instructions, null, null, null, [difficulty1, difficulty2]]]
        // Structure from mm13.txt: [null,[1,null,"add a logo at bottom of \"PHOTON\"",null,null,null,[1,2]]]
        const flashcardCustom = customization as FlashcardCustomization;
        const numberOfCards = flashcardCustom.numberOfCards ?? 2; // 1=Fewer, 2=Standard, 3=More
        const difficulty = flashcardCustom.difficulty ?? 2; // 1=Easy, 2=Medium, 3=Hard
        
        (args[2] as any[])[9] = [
          null,
          [
            numberOfCards,
            null,
            flashcardCustom.language || instructions || null, // Language or instructions at index 2
            null,
            null,
            null,
            [difficulty, difficulty === 1 ? 2 : difficulty], // Difficulty array - note: [1,2] pattern observed for Easy
          ],
        ];
      } else if (artifactType === ArtifactType.INFOGRAPHIC) {
        // Infographic customization at index 13: [[language, "en", null, orientation, levelOfDetail]]
        // Structure from mm10.txt: [["hi","en",null,1,1]] or [[null,"en",null,1,3]]
        const infographicCustom = customization as InfographicCustomization;
        const orientation = infographicCustom.orientation ?? 1; // 1=Landscape, 2=Portrait, 3=Square
        const levelOfDetail = infographicCustom.levelOfDetail ?? 2; // 1=Concise, 2=Standard, 3=Detailed
        
        (args[2] as any[])[13] = [[
          infographicCustom.language || null, // Primary language
          'en', // Secondary language (always "en")
          null,
          orientation, // Orientation/visual style (1=Landscape, 2=Portrait, 3=Square)
          levelOfDetail, // Level of detail (1=Concise, 2=Standard, 3=Detailed)
        ]];
      } else if (artifactType === ArtifactType.VIDEO) {
        // Video customization at index 8: [null, null, [sourceIds, language, focus, null, format, visualStyle, customStyleDescription]]
        // Structure from mm2.txt and mm16.txt examples:
        // - sourceIds: [[[id1]],[id2]] format (flattened from [[[id]]])
        // - language: string (e.g., "en", "hi", "id")
        // - focus: string or null ("What should the AI hosts focus on?") - supported by all styles
        // - null: placeholder
        // - format: 1=Explainer, 2=Brief
        // - visualStyle: 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime, 6=Watercolour, 7=Anime (alt), 8=Retro print, 9=Heritage, 10=Paper-craft
        // - customStyleDescription: string or null (only when visualStyle=1/Custom)
        const videoCustom = customization as VideoCustomization;
        const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]); // Flatten from [[[id]]] to [[id]]
        const format = videoCustom.format ?? 1; // 1=Explainer, 2=Brief
        const visualStyle = videoCustom.visualStyle ?? 0; // 0=Auto-select
        
        // Build the customization array
        const customArray: any[] = [
          sourceIdsFlat, // [[id1], [id2]] format
          videoCustom.language || 'en',
          videoCustom.focus || null, // "What should the AI hosts focus on?"
          null, // Placeholder
          format,
          visualStyle === 1 ? null : visualStyle, // If Custom (1), set to null and add description at end
        ];
        
        // If visualStyle is Custom (1), add customStyleDescription at the end
        if (visualStyle === 1) {
          customArray.push(videoCustom.customStyleDescription || null);
        }
        
        (args[2] as any[])[8] = [
          null,
          null,
          customArray,
        ];
      }
    }
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_VIDEO_OVERVIEW, // R7cb6c is the same constant
      args,
      notebookId
    );
    
    return this.parseArtifactResponse(response);
  }
  
  /**
   * Maps length string to number
   */
  private mapLengthToNumber(length: string): number {
    switch (length) {
      case 'short':
      case 'brief':
        return 1;
      case 'medium':
      case 'standard':
        return 2;
      case 'long':
      case 'detailed':
        return 3;
      default:
        return 2;
    }
  }
  
  /**
   * Create mind map using yyryJe RPC (RPC_ACT_ON_SOURCES)
   * Structure from RPC: [[[sourceId1]], [[sourceId2]], ...], null, null, null, null, ["interactive_mindmap", [["[CONTEXT]", ""]], "", null, [2, null, [1]]]
   */
  private async createMindMap(
    notebookId: string,
    options: CreateArtifactOptions
  ): Promise<Artifact> {
    const { sourceIds = [], instructions = '' } = options;
    
    if (sourceIds.length === 0) {
      throw new NotebookLMError('Mind map requires at least one source ID');
    }
    
    // Format source IDs as nested arrays: [[[sourceId1]], [[sourceId2]]]
    const formattedSourceIds = sourceIds.map(id => [[id]]);
    
    // Build mind map arguments matching observed RPC structure
    // Structure: [sourceIds, null, null, null, null, ["interactive_mindmap", [["[CONTEXT]", instructions]], "", null, [2, null, [1]]]]
    const args: any[] = [
      formattedSourceIds, // [[[sourceId1]], [[sourceId2]], ...]
      null,
      null,
      null,
      null,
      [
        'interactive_mindmap', // Action type
        [[instructions || '[CONTEXT]', '']], // Context/instructions: [["[CONTEXT]", ""]] or [["instructions", ""]]
        '', // Empty string
        null,
        [2, null, [1]], // Configuration: [2, null, [1]]
      ],
    ];
    
    const response = await this.rpc.call(
      RPC.RPC_ACT_ON_SOURCES,
      args,
      notebookId
    );
    
    return this.parseArtifactResponse(response);
  }
  
  private async createStandardArtifact(
    notebookId: string,
    artifactType: ArtifactType,
    options: CreateArtifactOptions
  ): Promise<Artifact> {
    const { title, instructions = '', sourceIds, customization } = options;
    
    // Build artifact creation arguments
    const args: any[] = [
      notebookId,
      artifactType,
      title || '',
      instructions,
    ];
    
    // Add source IDs if specified
    if (sourceIds && sourceIds.length > 0) {
      args.push(sourceIds);
    }
    
    // Add customization if specified (for flashcards and other xpWGLf artifacts)
    // Note: Only flashcards support customization in xpWGLf artifacts
    if (customization && artifactType === ArtifactType.FLASHCARDS) {
      const flashcardCustom = customization as FlashcardCustomization;
      // Pass customization as object - the exact structure may need to be validated
      // Based on images, flashcards have: numberOfCards, difficulty, language
      args.push({
        numberOfCards: flashcardCustom.numberOfCards,
        difficulty: flashcardCustom.difficulty,
        language: flashcardCustom.language,
      });
    } else if (customization && artifactType !== ArtifactType.FLASHCARDS) {
      // For other artifacts (Study Guide, Mind Map, etc.), customization is not supported
      // But we'll pass it through in case the backend accepts it
      // Note: This should not happen due to validation in create(), but adding as fallback
      throw new NotebookLMError(
        `Customization is not supported for artifact type ${artifactType} when using xpWGLf RPC`
      );
    }
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_ARTIFACT,
      args,
      notebookId
    );
    
    return this.parseArtifactResponse(response);
  }
  
  private async createAudio(
    notebookId: string,
    options: CreateArtifactOptions
  ): Promise<Artifact> {
    const { instructions = '', customization } = options;
    // Audio format: 0=Deep dive, 1=Brief, 2=Critique, 3=Debate (default: 0)
    const audioCustom = customization as AudioCustomization | undefined;
    const audioType = audioCustom?.format ?? 0;
    
    // Build instructions with language and customization
    // Note: Audio RPC structure is: [notebookId, audioType, [instructions]]
    // Language and length may need to be included in instructions
    let finalInstructions = instructions;
    
    if (audioCustom) {
      const parts: string[] = [];
      
      if (instructions) {
        parts.push(instructions);
      }
      
      if (audioCustom.language) {
        parts.push(`Language: ${audioCustom.language}`);
      }
      
      if (audioCustom.length) {
        const lengthMap: Record<number, string> = {
          1: 'short',
          2: 'default',
          3: 'long',
        };
        parts.push(`Length: ${lengthMap[audioCustom.length] || 'default'}`);
      }
      
      if (parts.length > 1) {
        finalInstructions = parts.join('. ');
      }
    }
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_AUDIO_OVERVIEW,
      [notebookId, audioType, [finalInstructions]],
      notebookId
    );
    
    return this.parseAudioCreateResponse(response, notebookId);
  }
  
  private async createVideo(
    notebookId: string,
    options: CreateArtifactOptions
  ): Promise<Artifact> {
    // Video now uses createR7cb6cArtifact, but keep this for backward compatibility
    // or if we need special handling
    return this.createR7cb6cArtifact(notebookId, ArtifactType.VIDEO, options);
  }
  
  private async downloadAudio(notebookId: string): Promise<Artifact> {
    // Try different request types to find audio data
    const requestTypes = [0, 1, 2, 3, 4, 5];
    
    for (const requestType of requestTypes) {
      try {
        const response = await this.rpc.call(
          RPC.RPC_GET_AUDIO_OVERVIEW,
          [notebookId, requestType],
          notebookId
        );
        
        const audio = this.parseAudioResponse(response, notebookId);
        
        if (audio.audioData) {
          return audio;
        }
      } catch {
        // Try next request type
        continue;
      }
    }
    
    throw new NotebookLMError('No request type returned audio data - the audio may not be ready yet');
  }
  
  private getQuotaType(type: ArtifactType): string | null {
    switch (type) {
      case ArtifactType.DOCUMENT:
      case ArtifactType.STUDY_GUIDE:
        return 'createReport';
      case ArtifactType.QUIZ:
        return 'createQuiz';
      case ArtifactType.FLASHCARDS:
        return 'createFlashcards';
      case ArtifactType.AUDIO:
        return 'createAudioOverview';
      case ArtifactType.VIDEO:
        return 'createVideoOverview';
      default:
        return null;
    }
  }
  
  // ========================================================================
  // Response parsers
  // ========================================================================
  
  private parseListResponse(response: any): Artifact[] {
    try {
      const artifacts: Artifact[] = [];
      
      // Handle string response (JSON string that needs parsing)
      let data = response;
      if (typeof response === 'string') {
        try {
          data = JSON.parse(response);
        } catch {
          // If parsing fails, try to handle as raw string
          data = response;
        }
      }
      
      if (Array.isArray(data)) {
        // Response might be nested: [[[...]]] or [[...]]
        // Keep unwrapping until we find an array where first element looks like an artifact
        let unwrappedData: any = data;
        
        // Keep unwrapping while we have nested arrays
        while (Array.isArray(unwrappedData) && unwrappedData.length > 0 && Array.isArray(unwrappedData[0])) {
          // Check if data[0][0] looks like an artifact (starts with string ID)
          // If the first element of the first nested array is a string (artifact ID), stop unwrapping
          const firstItem = unwrappedData[0];
          if (Array.isArray(firstItem) && firstItem.length > 0 && typeof firstItem[0] === 'string' && firstItem[0].length > 10) {
            // This looks like an artifact array, stop unwrapping
            break;
          }
          unwrappedData = unwrappedData[0];
        }
        
        // Now unwrappedData should be an array of artifacts: [[artifact1], [artifact2], ...] or [artifact1, artifact2, ...]
        const artifactArray: any[] = Array.isArray(unwrappedData) ? unwrappedData : [];
        
        for (const item of artifactArray) {
          // Handle both cases: item is already an array [artifact_data] or item is nested [[artifact_data]]
          let artifactData = item;
          
          // If item is nested array, unwrap once more
          if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
            artifactData = item[0];
          }
          
          const artifact = this.parseArtifactData(artifactData);
          if (artifact) {
            artifacts.push(artifact);
          }
        }
      }
      
      return artifacts;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse artifacts list: ${(error as Error).message}`);
    }
  }
  
  private parseArtifactResponse(response: any): Artifact {
    try {
      let data = response;
      
      // Handle string response (JSON)
      if (typeof response === 'string') {
        data = JSON.parse(response);
      }
      
      // Navigate through nested arrays: [[artifact_data]]
      if (Array.isArray(data) && data.length > 0) {
        // If first element is an array, unwrap it
        if (Array.isArray(data[0])) {
          data = data[0];
        }
        
        const artifact = this.parseArtifactData(data);
        if (artifact) {
          return artifact;
        }
      }
      
      throw new Error('Failed to parse artifact from response');
    } catch (error) {
      throw new NotebookLMError(`Failed to parse artifact response: ${(error as Error).message}`);
    }
  }
  
  private parseArtifactData(data: any): Artifact | null {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    
    const artifact: Artifact = {
      artifactId: '',
    };
    
    // Response structure: [artifactId, title?, type, sources?, state, ...]
    // Parse artifact ID (first element)
    if (data[0] && typeof data[0] === 'string') {
      artifact.artifactId = data[0];
    }
    
    // Parse title (second element, if string)
    if (data.length > 1 && typeof data[1] === 'string') {
      artifact.title = data[1];
    }
    
    // Parse artifact type - could be at index 2 or another position
    let typeIndex = -1;
    for (let i = 1; i < Math.min(data.length, 5); i++) {
      if (typeof data[i] === 'number' && data[i] >= 1 && data[i] <= 10) {
        typeIndex = i;
        break;
      }
    }
    
    if (typeIndex >= 0) {
      const apiType = data[typeIndex] as number;
      // Map API response type number to ArtifactType enum
      artifact.type = this.mapApiTypeToArtifactType(apiType, data);
    }
    
    // Parse state - structure is [id, title, type, sources, state, ...]
    // State is at index 4 (after type at index 2, sources at index 3)
    // But we need to check what the actual state value means
    // State 1 = CREATING, State 2 = READY, State 3 might be something else (not necessarily FAILED)
    let stateIndex = 4;
    if (data.length > stateIndex && typeof data[stateIndex] === 'number') {
      const stateValue = data[stateIndex] as number;
      // Map state values: 1=CREATING, 2=READY, 3 might be READY in some contexts or FAILED
      // Based on user feedback, state 3 seems to mean READY, not FAILED
      if (stateValue === 1) {
        artifact.state = ArtifactState.CREATING;
      } else if (stateValue === 2 || stateValue === 3) {
        // Both 2 and 3 seem to indicate READY state
        artifact.state = ArtifactState.READY;
      } else if (stateValue === 0) {
        artifact.state = ArtifactState.UNKNOWN;
      } else {
        artifact.state = ArtifactState.FAILED;
      }
    } else {
      // Default to CREATING for new artifacts
      artifact.state = ArtifactState.CREATING;
    }
    
    // Parse sources - look for nested array structure
    for (let i = 0; i < data.length; i++) {
      if (Array.isArray(data[i]) && data[i].length > 0) {
        // Check if this looks like sources: [[[sourceId1]], [[sourceId2]]]
        if (Array.isArray(data[i][0]) && Array.isArray(data[i][0][0])) {
          artifact.sourceIds = data[i]
            .map((s: any) => Array.isArray(s) && Array.isArray(s[0]) ? s[0][0] : null)
            .filter((s: any) => typeof s === 'string');
          break;
        }
      }
    }
    
    // For audio artifacts, check if we can extract audioId
    // Audio artifacts might have the audioId as the artifactId itself, or in a specific field
    if (artifact.type === ArtifactType.AUDIO) {
      // Audio artifacts created via audio.create() have the audioId as the artifactId
      // But we should also check if there's an audioId field in the response
      // For now, audioId is typically the same as artifactId for audio artifacts
      // We can add more parsing logic here if needed
    }
    
    // For video artifacts, parse video URL from the response
    // Based on mm27.txt and terminal output: Video URL is at index 9: [null, "https://lh3.googleusercontent.com/notebooklm/..."]
    // Structure: [artifactId, title, type, sources, state, null, null, null, null, [null, "https://..."]]
    // The URL from mm27.txt: https://lh3.googleusercontent.com/notebooklm/AG60hOqh3DPoDN105kofGV60HiUp8Lsy38xhkjyB4HL0zTkueJwQGcedSusIGOqKzAkhmbTYk6Br_o-OivKfSiSd4F7Fe3ZFmXUgCgjptokzh9DjKXUQw3DK4LNV0zsxraClXNoVOkRdmswNWW4ZHUZUkFBz07S5f4o=m22-dv?authuser=0
    if (artifact.type === ArtifactType.VIDEO) {
      // First, check index 9 specifically (most common location based on mm27.txt)
      if (data.length > 9 && Array.isArray(data[9]) && data[9].length > 1) {
        if (data[9][0] === null && typeof data[9][1] === 'string' && data[9][1].startsWith('http')) {
          const videoUrl = data[9][1];
          // Match patterns from mm27.txt: lh3.googleusercontent.com/notebooklm/ or googlevideo.com
          if (videoUrl.includes('lh3.googleusercontent.com/notebooklm/') || 
              videoUrl.includes('lh3.google.com/rd-notebooklm/') ||
              videoUrl.includes('googlevideo.com/videoplayback')) {
            artifact.videoData = videoUrl;
          }
        }
      }
      
      // Fallback: search through indices 6-15 for video URL patterns
      if (!artifact.videoData) {
        for (let i = 6; i < Math.min(data.length, 16); i++) {
          if (Array.isArray(data[i]) && data[i].length > 1) {
            // Look for [null, "https://..."] pattern
            if (data[i][0] === null && typeof data[i][1] === 'string' && data[i][1].startsWith('http')) {
              const videoUrl = data[i][1];
              if (videoUrl.includes('lh3.googleusercontent.com/notebooklm/') || 
                  videoUrl.includes('lh3.google.com/rd-notebooklm/') ||
                  videoUrl.includes('googlevideo.com/videoplayback')) {
                artifact.videoData = videoUrl;
                break;
              }
            }
          } else if (typeof data[i] === 'string' && data[i].startsWith('http') && 
                     (data[i].includes('lh3.googleusercontent.com/notebooklm/') || 
                      data[i].includes('lh3.google.com/rd-notebooklm/') ||
                      data[i].includes('googlevideo.com/videoplayback'))) {
            artifact.videoData = data[i];
            break;
          }
        }
      }
    }
    
    // Only return if we have an ID
    if (artifact.artifactId) {
      return artifact;
    }
    
    return null;
  }
  
  private parseAudioCreateResponse(response: any, notebookId: string): Artifact {
    try {
      let audioId = '';
      
      if (Array.isArray(response) && response.length > 0) {
        const audioData = response[0];
        if (Array.isArray(audioData) && audioData.length > 2) {
          audioId = audioData[2] || '';
        }
      }
      
      return {
        artifactId: audioId || notebookId,
        type: ArtifactType.AUDIO,
        state: ArtifactState.CREATING,
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse audio creation response: ${(error as Error).message}`);
    }
  }
  
  private parseAudioResponse(response: any, notebookId: string): Artifact {
    try {
      const audio: Artifact = {
        artifactId: notebookId,
        type: ArtifactType.AUDIO,
        state: ArtifactState.CREATING,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        const audioData = response[0];
        if (Array.isArray(audioData)) {
          // Status
          if (audioData[0]) {
            audio.state = audioData[0] !== 'CREATING' ? ArtifactState.READY : ArtifactState.CREATING;
            audio.status = audioData[0];
          }
          
          // Audio content (base64)
          if (audioData[1]) {
            audio.audioData = audioData[1];
          }
          
          // Title
          if (audioData[2]) {
            audio.title = audioData[2];
          }
        }
      }
      
      return audio;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse audio overview: ${(error as Error).message}`);
    }
  }
  
  private parseVideoCreateResponse(response: any, notebookId: string): Artifact {
    try {
      const result: Artifact = {
        artifactId: '',
        type: ArtifactType.VIDEO,
        state: ArtifactState.CREATING,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        const videoData = response[0];
        if (Array.isArray(videoData) && videoData.length > 0) {
          // Video ID
          if (videoData[0]) {
            result.artifactId = videoData[0];
          }
          
          // Title
          if (videoData.length > 1 && videoData[1]) {
            result.title = videoData[1];
          }
          
          // Status
          if (videoData.length > 2 && typeof videoData[2] === 'number') {
            result.state = videoData[2] === 2 ? ArtifactState.READY : ArtifactState.CREATING;
          }
        }
      }
      
      return result;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse video creation response: ${(error as Error).message}`);
    }
  }
  
  private parseDownloadResponse(response: any, artifactType?: ArtifactType): QuizData | FlashcardData | any {
    if (!artifactType) {
      return response;
    }
    
    if (artifactType === ArtifactType.QUIZ) {
      return this.parseQuizData(response);
    } else if (artifactType === ArtifactType.FLASHCARDS) {
      return this.parseFlashcardData(response);
    }
    
    // For other types, return raw response
    return response;
  }
  
  /**
   * Parse quiz data from RPC response
   */
  private parseQuizData(response: any): QuizData {
    // Try to extract quiz questions from response
    // Response structure may vary, but typically contains questions array
    const questions: any[] = [];
    
    // Navigate through response structure to find questions
    let data = response;
    if (Array.isArray(response) && response.length > 0) {
      data = response[0];
    }
    
    // Look for questions in common response patterns
    if (data && typeof data === 'object') {
      // Try to find questions array
      if (Array.isArray(data.questions)) {
        data.questions.forEach((q: any) => {
          questions.push({
            question: q.question || q.text || '',
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : (q.correctIndex || 0),
            explanation: q.explanation || q.reason || undefined,
          });
        });
      } else if (Array.isArray(data)) {
        // Response might be direct array of questions
        data.forEach((item: any) => {
          if (item && typeof item === 'object') {
            questions.push({
              question: item.question || item.text || '',
              options: Array.isArray(item.options) ? item.options : [],
              correctAnswer: typeof item.correctAnswer === 'number' ? item.correctAnswer : (item.correctIndex || 0),
              explanation: item.explanation || item.reason || undefined,
            });
          }
        });
      }
    }
    
    return {
      questions: questions as any[],
      totalQuestions: questions.length,
    };
  }
  
  /**
   * Parse flashcard data from RPC response
   * BnLyuf (GET_ARTIFACT) should return CSV data for flashcards
   */
  private parseFlashcardData(response: any): FlashcardData {
    let csv = '';
    const flashcards: Array<{ question: string; answer: string }> = [];
    
    // Try to extract CSV string from response
    let data = response;
    if (Array.isArray(response) && response.length > 0) {
      data = response[0];
    }
    
    // Look for CSV in common response patterns
    if (typeof data === 'string') {
      csv = data;
    } else if (data && typeof data === 'object') {
      if (typeof data.csv === 'string') {
        csv = data.csv;
      } else if (typeof data.data === 'string') {
        csv = data.data;
      } else if (typeof data.content === 'string') {
        csv = data.content;
      }
    }
    
    // Parse CSV into flashcards array with proper quote handling
    if (csv) {
      const lines = csv.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const parsed = this.parseCSVLine(line);
        if (parsed.length >= 2) {
          flashcards.push({
            question: parsed[0],
            answer: parsed.slice(1).join(','), // Handle answers with commas
          });
        }
      }
    }
    
    return {
      csv,
      flashcards: flashcards.length > 0 ? flashcards : undefined,
    };
  }
  
  /**
   * Parse a CSV line handling quoted fields properly
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Push last field
    result.push(current.trim());
    
    return result;
  }
  
  /**
   * Save artifact data to file based on artifact type
   * Handles both Node.js (fs) and browser (Blob) environments
   */
  private async saveArtifactToFile(
    artifact: Artifact,
    data: QuizData | FlashcardData | AudioArtifact | VideoArtifact | any,
    folderPath: string
  ): Promise<string> {
    // Determine file extension and content based on artifact type
    let fileExtension: string;
    let fileName: string;
    let fileContent: string | Uint8Array;
    
    const baseFileName = artifact.title 
      ? artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : artifact.artifactId;
    
    switch (artifact.type) {
      case ArtifactType.AUDIO:
        fileExtension = '.mp3';
        fileName = `audio_${baseFileName}${fileExtension}`;
        if ((data as AudioArtifact).audioData) {
          // Decode base64 to binary
          fileContent = this.base64ToUint8Array((data as AudioArtifact).audioData);
        } else {
          throw new NotebookLMError('Audio data not found in artifact');
        }
        break;
        
      case ArtifactType.VIDEO:
        fileExtension = '.mp4';
        fileName = `video_${baseFileName}${fileExtension}`;
        if ((data as VideoArtifact).videoData) {
          const videoData = (data as VideoArtifact).videoData;
          // Check if it's base64 or URL
          if (videoData.startsWith('data:') || videoData.startsWith('http')) {
            // URL - would need to fetch, but for now treat as base64
            const base64Data = videoData.includes(',') ? videoData.split(',')[1] : videoData;
            fileContent = this.base64ToUint8Array(base64Data);
          } else {
            fileContent = this.base64ToUint8Array(videoData);
          }
        } else {
          throw new NotebookLMError('Video data not found in artifact');
        }
        break;
        
      case ArtifactType.SLIDE_DECK:
        fileExtension = '.pdf';
        fileName = `slides_${baseFileName}${fileExtension}`;
        // Slide deck data may be base64 encoded PDF or other format
        if (typeof data === 'string') {
          fileContent = this.base64ToUint8Array(data);
        } else if (data && typeof data === 'object' && (data as any).content) {
          fileContent = this.base64ToUint8Array((data as any).content);
        } else {
          // Save as JSON if structure is complex
          fileExtension = '.json';
          fileName = `slides_${baseFileName}${fileExtension}`;
          fileContent = JSON.stringify(data, null, 2);
        }
        break;
        
      case ArtifactType.QUIZ:
        fileExtension = '.json';
        fileName = `quiz_${baseFileName}${fileExtension}`;
        // Raw response - stringify as JSON
        fileContent = JSON.stringify(data, null, 2);
        break;
        
      case ArtifactType.FLASHCARDS:
        fileExtension = '.csv';
        fileName = `flashcards_${baseFileName}${fileExtension}`;
        // Raw response - extract CSV string (may be nested in response structure)
        if (typeof data === 'string') {
          fileContent = data;
        } else if (data && typeof data === 'object') {
          // Try common response patterns to find CSV string
          if (typeof (data as any).csv === 'string') {
            fileContent = (data as any).csv;
          } else if (typeof (data as any).data === 'string') {
            fileContent = (data as any).data;
          } else if (typeof (data as any).content === 'string') {
            fileContent = (data as any).content;
          } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
            fileContent = data[0];
          } else if (Array.isArray(data) && data.length > 0 && typeof (data[0] as any)?.csv === 'string') {
            fileContent = (data[0] as any).csv;
          } else {
            // Fallback: stringify if we can't find CSV
            fileContent = JSON.stringify(data, null, 2);
          }
        } else {
          fileContent = String(data || '');
        }
        break;
        
      case ArtifactType.MIND_MAP:
        fileExtension = '.json';
        fileName = `mindmap_${baseFileName}${fileExtension}`;
        fileContent = JSON.stringify(data, null, 2);
        break;
        
      case ArtifactType.INFOGRAPHIC:
        // Could be JSON or image - check data type
        if (typeof data === 'string' && (data.startsWith('data:image') || data.length > 1000)) {
          // Likely base64 image
          fileExtension = '.png';
          fileName = `infographic_${baseFileName}${fileExtension}`;
          const base64Data = data.includes(',') ? data.split(',')[1] : data;
          fileContent = this.base64ToUint8Array(base64Data);
        } else {
          fileExtension = '.json';
          fileName = `infographic_${baseFileName}${fileExtension}`;
          fileContent = JSON.stringify(data, null, 2);
        }
        break;
        
      case ArtifactType.STUDY_GUIDE:
        fileExtension = '.json';
        fileName = `studyguide_${baseFileName}${fileExtension}`;
        fileContent = JSON.stringify(data, null, 2);
        break;
        
      case ArtifactType.DOCUMENT:
        // Could be DOCUMENT or REPORT
        fileExtension = '.json';
        fileName = artifact.type === ArtifactType.DOCUMENT 
          ? `document_${baseFileName}${fileExtension}`
          : `report_${baseFileName}${fileExtension}`;
        fileContent = JSON.stringify(data, null, 2);
        break;
        
      default:
        fileExtension = '.json';
        fileName = `artifact_${baseFileName}${fileExtension}`;
        fileContent = JSON.stringify(data, null, 2);
    }
    
    // Build full file path
    const filePath = this.joinPath(folderPath, fileName);
    
    // Save file (Node.js or browser)
    await this.writeFile(filePath, fileContent);
    
    return filePath;
  }
  
  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    // Remove data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    // Handle browser and Node.js environments
    if (typeof Buffer !== 'undefined') {
      // Node.js
      return Buffer.from(base64Data, 'base64');
    } else {
      // Browser - decode base64 to binary string then convert to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }
  
  /**
   * Join path components (works in both Node.js and browser)
   */
  private joinPath(...parts: string[]): string {
    if (typeof require !== 'undefined') {
      try {
        const path = require('path');
        return path.join(...parts);
      } catch {
        // Fall through to manual join
      }
    }
    // Manual path joining for browser or when path module unavailable
    return parts.join('/').replace(/\/+/g, '/');
  }
  
  /**
   * Write file (handles both Node.js and browser)
   */
  private async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    // Check if we're in Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs/promises');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        if (typeof content === 'string') {
          await fs.writeFile(filePath, content, 'utf8');
        } else {
          await fs.writeFile(filePath, Buffer.from(content));
        }
        return;
      } catch (error) {
        // If fs fails, fall through to browser download
      }
    }
    
    // Browser environment - trigger download
    if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
      const blob = typeof content === 'string'
        ? new Blob([content], { type: 'text/plain' })
        : new Blob([content as BlobPart]);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      throw new NotebookLMError('File writing not supported in this environment. Use Node.js fs module or browser environment.');
    }
  }
}
