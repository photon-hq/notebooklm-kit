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
    // Audio artifacts use a different RPC method
    if (notebookId && artifactId === notebookId) {
      await this.rpc.call(
        RPC.RPC_DELETE_AUDIO_OVERVIEW,
        [artifactId],
        artifactId
      );
    } else {
    await this.rpc.call(
      RPC.RPC_DELETE_ARTIFACT,
      [artifactId]
    );
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
    
    const response = await this.rpc.call(
      RPC.RPC_GET_ARTIFACT,
      [artifactId]
    );
    
    return this.parseArtifactResponse(response);
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
   *   - `sourceIds` (string[], optional): Specific source IDs to use (if omitted, uses all sources in notebook)
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
   * - `customization.language` (string, optional): Language code (e.g., 'en', 'hi', 'ta')
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
   * - `customization.language` (string, optional): Language code (e.g., 'en', 'hi', 'ta')
   * - `instructions` (string, optional): Custom instructions for topic focus
   * 
   * **Slide Deck (`SlideDeckCustomization`):**
   * - `customization.format` (2 | 3, optional): Presentation format
   *   - `2` = Presenter slides (default)
   *   - `3` = Detailed deck
   * - `customization.language` (string, optional): Language code (e.g., 'en')
   * - `customization.length` (1 | 2 | 3, optional): Length preference
   *   - `1` = Short
   *   - `2` = Default (default)
   *   - `3` = Long
   * - `instructions` (string, optional): Used as description/theme for the presentation
   * 
   * **Infographic (`InfographicCustomization`):**
   * - `customization.language` (string, optional): Language code (e.g., 'en', 'hi', 'ta')
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
   * - `customization.language` (string, optional): Language code (default: 'en')
   * - `customization.visualStyle` (0 | 1 | 2 | 3 | 4 | 5, optional): Visual style
   *   - `0` = Auto-select (default)
   *   - `1` = Custom
   *   - `2` = Classic
   *   - `3` = Whiteboard
   *   - `4` = Kawaii
   *   - `5` = Anime
   * - `sourceIds` (string[], recommended): Specify sources to include (video requires sources)
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
   * const quiz = await client.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   title: 'Chapter 1 Quiz',
   *   instructions: 'Focus on key concepts',
   *   customization: {
   *     numberOfQuestions: 3, // More questions
   *     difficulty: 3, // Hard
   *     language: 'en',
   *   },
   * });
   * 
   * // Create flashcards with customization
   * const flashcards = await client.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
   *   instructions: 'Focus on key terminology',
   *   customization: {
   *     numberOfCards: 2, // Standard
   *     difficulty: 2, // Medium
   *     language: 'en',
   *   },
   * });
   * 
   * // Create slide deck with customization
   * const slides = await client.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
   *   title: 'Quarterly Report',
   *   instructions: 'Focus on revenue and growth metrics',
   *   customization: {
   *     format: 3, // Detailed deck
   *     language: 'en',
   *     length: 2, // Default
   *   },
   * });
   * 
   * // Create infographic with customization
   * const infographic = await client.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
   *   customization: {
   *     language: 'en',
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
   *     language: 'en',
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
   *     language: 'en',
   *     visualStyle: 0, // Auto-select
   *   },
   * });
   * 
   * // Create study guide
   * const guide = await client.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
   *   title: 'Final Exam Study Guide',
   *   instructions: 'Focus on key concepts, formulas, and important dates',
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
    
    // Audio artifacts use a different RPC method
    if (type === ArtifactType.AUDIO) {
      artifact = await this.createAudio(notebookId, options);
    } else if (type === ArtifactType.VIDEO || type === ArtifactType.QUIZ || type === ArtifactType.SLIDE_DECK || type === ArtifactType.INFOGRAPHIC) {
      // Quiz, Slides, Infographics, and Video all use R7cb6c
      artifact = await this.createR7cb6cArtifact(notebookId, type, options);
    } else {
      // Other artifacts use xpWGLf (Study Guide, Mind Map, Flashcards, Report, Document)
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
    notebookId?: string
  ): Promise<{ filePath: string; data: QuizData | FlashcardData | AudioArtifact | VideoArtifact | any }> {
    // Get the artifact first to determine its type
    const artifact = notebookId && artifactId === notebookId 
      ? await this.get(artifactId, notebookId)
      : await this.get(artifactId);
    
    // Download the data
    let data: QuizData | FlashcardData | AudioArtifact | VideoArtifact | any;
    if (notebookId && artifactId === notebookId) {
      // Audio artifacts use a different RPC method
      data = await this.downloadAudio(artifactId);
    } else {
      // Get full artifact data
      const response = await this.rpc.call(
        RPC.RPC_GET_ARTIFACT,
        [artifactId]
      );
      data = this.parseDownloadResponse(response, artifact.type);
    }
    
    // Save to file based on artifact type
    const filePath = await this.saveArtifactToFile(artifact, data, folderPath);
    
    return { filePath, data };
  }
  
  // ========================================================================
  // Private creation methods
  // ========================================================================
  
  /**
   * Maps ArtifactType enum to API type numbers
   */
  private getApiTypeNumber(artifactType: ArtifactType): number {
    switch (artifactType) {
      case ArtifactType.QUIZ:
        return 4;
      case ArtifactType.INFOGRAPHIC:
        return 7;
      case ArtifactType.SLIDE_DECK:
        return 8;
      case ArtifactType.VIDEO:
        return 3;
      default:
        return artifactType;
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
      } else if (artifactType === ArtifactType.SLIDE_DECK) {
        // Slides customization at index 15: [[instructions, language, format, length]]
        // Structure from mm9.txt: [[null,"en",1,3]]
        const slideCustom = customization as SlideDeckCustomization;
        const format = slideCustom.format ?? 2; // 2=Presenter, 3=Detailed deck
        const length = slideCustom.length ?? 2; // 1=Short, 2=Default, 3=Long
        
        (args[2] as any[])[15] = [[
          instructions || null, // Description/instructions
          slideCustom.language || 'en', // Language
          format, // Format (2=presenter, 3=detailed deck)
          length, // Length (1=short, 2=default, 3=long)
        ]];
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
        // Video customization at index 8: [null, null, [sourceIdsFlat, language, instructions]]
        // Note: Video uses simpler structure - flatten one level for index 8
        const videoCustom = customization as VideoCustomization;
        const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]); // Flatten from [[[id]]] to [[id]]
        
        (args[2] as any[])[8] = [
          null,
          null,
          [
            sourceIdsFlat, // [[id1], [id2]] format
            videoCustom.language || 'en',
            instructions,
          ],
        ];
        // Note: Video format and visualStyle are not directly supported in the current RPC structure
        // They may need to be passed via instructions
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
      
      if (Array.isArray(response)) {
        let artifactArray: any[] = [];
        
        // Response might be wrapped
        if (response[0] && Array.isArray(response[0])) {
          artifactArray = response[0];
        } else {
          artifactArray = response;
        }
        
        for (const item of artifactArray) {
          const artifact = this.parseArtifactData(item);
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
      if (Array.isArray(response) && response.length > 0) {
        const artifact = this.parseArtifactData(response[0]);
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
    
    // Parse artifact ID (first element)
    if (data[0] && typeof data[0] === 'string') {
      artifact.artifactId = data[0];
    }
    
    // Parse artifact type (second element)
    if (data.length > 1 && typeof data[1] === 'number') {
      artifact.type = data[1] as ArtifactType;
    }
    
    // Parse artifact state (third element)
    if (data.length > 2 && typeof data[2] === 'number') {
      artifact.state = data[2] as ArtifactState;
    }
    
    // Parse sources (fourth element)
    if (data.length > 3 && Array.isArray(data[3])) {
      artifact.sourceIds = data[3]
        .filter((s: any) => typeof s === 'string')
        .map((s: string) => s);
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
    
    // Parse CSV into flashcards array
    if (csv) {
      const lines = csv.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          flashcards.push({
            question: parts[0],
            answer: parts.slice(1).join(','), // Handle answers with commas
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
        fileContent = JSON.stringify(data, null, 2);
        break;
        
      case ArtifactType.FLASHCARDS:
        fileExtension = '.csv';
        fileName = `flashcards_${baseFileName}${fileExtension}`;
        fileContent = (data as FlashcardData).csv || '';
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
