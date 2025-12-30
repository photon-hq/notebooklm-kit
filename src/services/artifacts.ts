/**
 * Artifacts service
 * Handles all artifact operations (documents, presentations, audio, video, quizzes, flashcards, etc.)
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { NotebookLMError } from '../types/common.js';
import { APIError } from '../utils/errors.js';
import { ArtifactType, ArtifactState } from '../types/artifact.js';
import * as https from 'https';
import * as http from 'http';
import { createHash } from 'node:crypto';

// ========================================================================
// Types
// ========================================================================

// Re-export for backward compatibility
export { ArtifactType, ArtifactState } from '../types/artifact.js';

export enum ShareOption {
  PRIVATE = 0,
  PUBLIC = 1,
}

export interface Artifact {
  artifactId: string;
  type?: ArtifactType;
  state?: ArtifactState;
  title?: string;
  sourceIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  audioData?: string;
  videoData?: string;
  status?: string;
  duration?: number;
}

export interface AudioOverview {
  projectId: string;
  audioId?: string;
  title?: string;
  audioData?: string;
  isReady: boolean;
  state?: ArtifactState;
  duration?: number;
  createdAt?: string;
}

export interface VideoOverview {
  projectId: string;
  videoId?: string;
  title?: string;
  videoData?: string;
  isReady: boolean;
  state?: ArtifactState;
  createdAt?: string;
}

export interface CreateAudioOverviewOptions {
  instructions?: string;
  sourceIds?: string[];
  customization?: AudioCustomization;
}

export interface CreateVideoOverviewOptions {
  instructions?: string;
  sourceIds?: string[];
  customization?: VideoCustomization;
}

export interface ShareAudioResult {
  shareUrl: string;
  shareId: string;
  isPublic: boolean;
}

export interface ShareArtifactOptions {
  users?: Array<{
    email: string;
    role: 2 | 3 | 4;
  }>;
  notify?: boolean;
  accessType?: 1 | 2;
}

export interface ShareArtifactResult {
  shareUrl: string;
  success: boolean;
  notebookId: string;
  accessType: 1 | 2;
  isShared: boolean;
  users?: Array<{
    email: string;
    role: 2 | 3;
  }>;
}

export interface QuizCustomization {
  numberOfQuestions?: 1 | 2 | 3;
  difficulty?: 1 | 2 | 3;
  language?: string;
}

export interface FlashcardCustomization {
  numberOfCards?: 1 | 2 | 3;
  difficulty?: 1 | 2 | 3;
  language?: string;
}

export interface SlideDeckCustomization {
  format?: 2 | 3;
  language?: string;
  length?: 1 | 2 | 3;
}

export interface InfographicCustomization {
  language?: string;
  orientation?: 1 | 2 | 3;
  levelOfDetail?: 1 | 2 | 3;
}

export interface AudioCustomization {
  format?: 0 | 1 | 2 | 3;
  language?: string;
  length?: 1 | 2 | 3;
}

export interface VideoCustomization {
  format?: 1 | 2;
  language?: string;
  visualStyle?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  focus?: string;
  customStyleDescription?: string;
}

export interface CreateArtifactOptions {
  title?: string;
  instructions?: string;
  sourceIds?: string[];
  customization?: QuizCustomization | FlashcardCustomization | SlideDeckCustomization | InfographicCustomization | AudioCustomization | VideoCustomization;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  hint?: string;
  reasoning?: string;
  optionReasons?: string[];
}

export interface QuizData {
  questions: QuizQuestion[];
  totalQuestions: number;
}

export interface FlashcardData {
  csv: string;
  flashcards?: Array<{
    question: string;
    answer: string;
  }>;
}

export interface ParsedFlashcardData {
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
  totalCards: number;
  csv: string;
}

export interface AudioArtifact extends Artifact {
  audioData: string;
  duration?: number;
  status?: string;
}

export interface VideoArtifact extends Artifact {
  videoData: string;
  status?: string;
}

export interface InfographicImageData {
  imageUrl: string;
  imageData?: Uint8Array | ArrayBuffer;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface FetchInfographicOptions {
  downloadImage?: boolean;
  cookies?: string;
}

export interface DownloadSlidesOptions {
  googleDomainCookies?: string;
}

export interface GetVideoUrlOptions {
  cookies?: string;
  googleDomainCookies?: string;
}

export interface CreateReportOptions {
  instructions?: string;
  sourceIds?: string[];
  title?: string;
  subtitle?: string;
  language?: string;
}

export interface ReportContent {
  title: string;
  content: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

/**
 * Service for artifact operations
 */
class VideoService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateVideoOverviewOptions = {}): Promise<VideoOverview> {
    const artifact = await this.artifactsService.create(notebookId, ArtifactType.VIDEO, {
      instructions: options.instructions,
      sourceIds: options.sourceIds,
      customization: options.customization,
    });
    return {
      projectId: notebookId,
      videoId: artifact.artifactId,
      title: artifact.title,
      videoData: artifact.videoData,
      isReady: artifact.state === ArtifactState.READY,
      state: artifact.state,
    };
  }
}

class AudioService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateAudioOverviewOptions = {}): Promise<AudioOverview> {
    const artifact = await this.artifactsService.create(notebookId, ArtifactType.AUDIO, {
      instructions: options.instructions,
      sourceIds: options.sourceIds,
      customization: options.customization,
    });
    return {
      projectId: notebookId,
      audioId: artifact.artifactId,
      title: artifact.title,
      audioData: artifact.audioData,
      isReady: artifact.state === ArtifactState.READY,
      state: artifact.state,
      duration: artifact.duration,
    };
  }
}

class InfographicService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.INFOGRAPHIC, options);
  }
}

class MindMapService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.MIND_MAP, options);
  }
}

class ReportService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.REPORT, options);
  }
}

class FlashcardService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.FLASHCARDS, options);
  }
}

class QuizService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.QUIZ, options);
  }
}

class SlideService {
  constructor(private artifactsService: ArtifactsService) {}
  
  async create(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.artifactsService.create(notebookId, ArtifactType.SLIDE_DECK, options);
  }
}

export class ArtifactsService {
  public readonly video: VideoService;
  public readonly audio: AudioService;
  public readonly infographic: InfographicService;
  public readonly mindmap: MindMapService;
  public readonly report: ReportService;
  public readonly flashcard: FlashcardService;
  public readonly quiz: QuizService;
  public readonly slide: SlideService;
  
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {
    this.video = new VideoService(this);
    this.audio = new AudioService(this);
    this.infographic = new InfographicService(this);
    this.mindmap = new MindMapService(this);
    this.report = new ReportService(this);
    this.flashcard = new FlashcardService(this);
    this.quiz = new QuizService(this);
    this.slide = new SlideService(this);
  }
  
  /**
   * List all artifacts for a notebook
   * 
   * **What it does:** Retrieves a list of all artifacts (quizzes, flashcards, study guides, 
   * mind maps, infographics, slide decks, reports, audio, video) associated with a notebook.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook to list artifacts from
   * - `options` (object, optional): Filtering options
   *   - `type` (ArtifactType, optional): Filter by artifact type
   *   - `state` (ArtifactState, optional): Filter by artifact state
   * 
   * **Output:** Returns an array of `Artifact` objects, each containing:
   * - `artifactId`: Unique identifier for the artifact
   * - `type`: Artifact type (QUIZ, FLASHCARDS, REPORT, MIND_MAP, INFOGRAPHIC, SLIDE_DECK, AUDIO, VIDEO, etc.)
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
   * @param options - Filtering options
   * 
   * @example
   * ```typescript
   * // List all artifacts
   * const artifacts = await client.artifacts.list('notebook-id');
   * 
   * // Filter by type
   * const quizzes = await client.artifacts.list('notebook-id', { type: ArtifactType.QUIZ });
   * 
   * // Filter by state
   * const ready = await client.artifacts.list('notebook-id', { state: ArtifactState.READY });
   * 
   * // Filter by both type and state
   * const readyQuizzes = await client.artifacts.list('notebook-id', { 
   *   type: ArtifactType.QUIZ, 
   *   state: ArtifactState.READY 
   * });
   * ```
   */
  async list(notebookId: string, options?: { type?: ArtifactType; state?: ArtifactState }): Promise<Artifact[]> {
    const response = await this.rpc.call(
      RPC.RPC_LIST_ARTIFACTS,
      [
        [2], // filter parameter - 2 for all artifacts
        notebookId,
      ],
      notebookId
    );
    
    let artifacts = this.parseListResponse(response);
    
    // Apply filters if provided
    if (options) {
      if (options.type !== undefined) {
        artifacts = artifacts.filter(a => a.type === options.type);
      }
      if (options.state !== undefined) {
        artifacts = artifacts.filter(a => a.state === options.state);
      }
    }
    
    return artifacts;
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
        const artifact = await this.get(artifactId, notebookId);
        if (artifact.type === ArtifactType.VIDEO) {
          // Video artifacts also use V5N4be with same structure
          await this.rpc.call(
            RPC.RPC_DELETE_AUDIO_OVERVIEW, // V5N4be - used for both audio and video
            [[2], artifactId],
            artifactId
          );
        } else {
          // Other artifacts (QUIZ, FLASHCARDS, REPORT, MIND_MAP, INFOGRAPHIC, SLIDE_DECK) use WxBZtb
          await this.rpc.call(
            RPC.RPC_DELETE_ARTIFACT,
            [artifactId]
          );
        }
      } catch (error) {
        // If we can't get artifact, fall back to standard delete
        // This works for all artifact types except audio/video
        await this.rpc.call(
          RPC.RPC_DELETE_ARTIFACT,
          [artifactId]
        );
      }
    }
  }
  
  /**
   * Share an artifact
   * 
   * **What it does:** Shares an artifact (or the notebook containing the artifact) with specific users 
   * or makes it publicly accessible via a shareable link. Works for all artifact types. Artifacts are 
   * shared at the notebook level, so sharing an artifact shares the entire notebook.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook containing the artifact
   * - `options` (object, optional): Sharing options:
   *   - `users` (array, optional): Array of users to share with:
   *     - `email` (string, required): User email address
   *     - `role` (number, required): User role - 2=editor, 3=viewer, 4=remove
   *   - `notify` (boolean, optional): Send notification to users (default: true, only used when users are provided)
   *   - `accessType` (number, optional): Access type - 1=anyone with link, 2=restricted (default: 2)
   * 
   * **Output:** Returns a `ShareArtifactResult` object containing:
   * - `shareUrl`: Shareable URL for the notebook
   * - `success`: Whether the share operation succeeded
   * - `notebookId`: The notebook ID that was shared
   * - `accessType`: Access type (1=anyone with link, 2=restricted)
   * - `isShared`: Whether the notebook is shared
   * - `users`: Array of users with access (if users were shared)
   * 
   * **Note:**
   * - Artifacts are shared at the notebook level - sharing an artifact shares the entire notebook
   * - Must provide either `users` array or `accessType=1` (anyone with link)
   * - User roles: 2=editor, 3=viewer, 4=remove (removes user access)
   * 
   * @param notebookId - The notebook ID containing the artifact
   * @param options - Sharing options
   * 
   * @example
   * ```typescript
   * // Share with specific users
   * const result = await client.artifacts.share('notebook-id', {
   *   users: [
   *     { email: 'user@example.com', role: 3 }, // viewer
   *     { email: 'editor@example.com', role: 2 } // editor
   *   ],
   *   notify: true
   * });
   * console.log(`Shared! URL: ${result.shareUrl}`);
   * 
   * // Share publicly (anyone with link)
   * const publicResult = await client.artifacts.share('notebook-id', {
   *   accessType: 1
   * });
   * console.log(`Public share URL: ${publicResult.shareUrl}`);
   * 
   * // Remove user access
   * await client.artifacts.share('notebook-id', {
   *   users: [{ email: 'user@example.com', role: 4 }] // remove
   * });
   * ```
   */
  async share(notebookId: string, options: ShareArtifactOptions = {}): Promise<ShareArtifactResult> {
    if (!notebookId || typeof notebookId !== 'string') {
      throw new APIError('Invalid notebook ID format', undefined, 400);
    }
    
    const trimmedNotebookId = notebookId.trim();
    
    const accessType = options.accessType || 2;
    const hasUserChanges = options.users && options.users.length > 0;
    const notify = hasUserChanges ? (options.notify !== false ? 1 : 0) : 0;
    
    if (!options.users && accessType !== 1) {
      throw new APIError('At least one sharing option (users or accessType=1 for anyone with link) must be provided', undefined, 400);
    }
    
    let args: any[];
    if (options.users && options.users.length > 0) {
      const users: any[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const user of options.users) {
        if (!user.email || typeof user.email !== 'string') {
          throw new APIError('Invalid user email format', undefined, 400);
        }
        
        if (!emailRegex.test(user.email.trim())) {
          throw new APIError(`Invalid email address: ${user.email}`, undefined, 400);
        }
        
        if (![2, 3, 4].includes(user.role)) {
          throw new APIError('Invalid user role. Must be 2 (editor), 3 (viewer), or 4 (remove)', undefined, 400);
        }
        users.push([user.email.trim(), null, user.role]);
      }
      args = [[trimmedNotebookId, users, notify, null, [accessType]]];
    } else if (accessType === 1) {
      args = [[trimmedNotebookId, null, [1], notify, null, [accessType]]];
    } else {
      throw new APIError('Invalid share options', undefined, 400);
    }
    
    const response = await this.rpc.call(
      RPC.RPC_SHARE_PROJECT,
      args,
      trimmedNotebookId
    );
    
    let shareUrl = '';
    let success = false;
    
    if (Array.isArray(response)) {
      if (response.length === 0) {
        success = true;
        shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      } else {
        const data = response[0];
        if (Array.isArray(data)) {
          shareUrl = data[0] || '';
          success = data[1] === true || (data.length > 0 && data[0] !== null);
        } else if (typeof data === 'string') {
          shareUrl = data;
          success = true;
        } else if (data?.shareUrl) {
          shareUrl = data.shareUrl;
          success = data.success !== false;
        } else {
          shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
          success = true;
        }
      }
    } else if (response && typeof response === 'object') {
      shareUrl = response.shareUrl || `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      success = response.success !== false;
    } else {
      shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      success = true;
    }
    
    if (!shareUrl) {
      shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
    }
    
    if (!success) {
      return {
        shareUrl,
        success: false,
        notebookId: trimmedNotebookId,
        accessType,
        isShared: false,
      };
    }
    
    return {
      shareUrl,
      success: true,
      notebookId: trimmedNotebookId,
      accessType,
      isShared: accessType === 1 || !!(options.users && options.users.length > 0),
    };
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
   * - `options` (object, optional): Additional options
   *   - For reports: `exportToDocs?: boolean` or `exportToSheets?: boolean` - Export report to Google Docs/Sheets and return URL
   * 
   * **Output:** Returns an `Artifact` object containing:
   * - `artifactId`: Unique identifier
   * - `type`: Artifact type (QUIZ, FLASHCARDS, REPORT, MIND_MAP, INFOGRAPHIC, SLIDE_DECK, AUDIO, VIDEO, etc.)
   * - `state`: Current state - check this to see if artifact is ready:
   *   - `CREATING`: Artifact is still being generated
   *   - `READY`: Artifact is complete and ready to use
   *   - `FAILED`: Artifact creation failed
   * - `title`: Display name
   * - `sourceIds`: Source IDs used in creation
   * - `createdAt`, `updatedAt`: Timestamps
   * - For QUIZ: Returns `Artifact + QuizData` (questions, options, correct answers, explanations)
   * - For FLASHCARDS: Returns `Artifact + FlashcardData` (flashcards array, CSV, totalCards)
   * - For AUDIO: Returns `Artifact + audioData` (base64 audio data)
   * - For VIDEO: Returns `Artifact + { url: string }` (video URL)
   * - For SLIDE_DECK: Returns `Artifact + { url: string }` (PDF URL)
   * - For INFOGRAPHIC: Returns `Artifact + InfographicImageData`
   * - For REPORT: Returns `Artifact + ReportContent` or `Artifact + { exportUrl: string }` if export options provided
   * - For MIND_MAP: Returns `Artifact + { experimental: true }`
   * 
   * **Next steps:**
   * - Check `state` field - if `CREATING`, wait and poll again using `get()`
   * - If `READY`, the full data is automatically included in the response
   * - For reports with export options, the export URL is returned instead of content
   * 
   * @param artifactId - The artifact ID
   * @param notebookId - Optional notebook ID (for audio artifacts)
   * @param options - Additional options (export options for reports)
   * 
   * @example
   * ```typescript
   * // Get artifact details
   * const artifact = await client.artifacts.get('artifact-id', 'notebook-id');
   * 
   * // Get quiz with full data
   * const quiz = await client.artifacts.get('quiz-id', 'notebook-id');
   * console.log(`Quiz has ${quiz.totalQuestions} questions`);
   * 
   * // Get report and export to Google Docs
   * const report = await client.artifacts.get('report-id', 'notebook-id', { exportToDocs: true });
   * console.log('Google Docs URL:', report.exportUrl);
   * 
   * // Get audio artifact (requires notebook ID)
   * const audio = await client.artifacts.get('notebook-id', 'notebook-id');
   * ```
   */
  async get(artifactId: string, notebookId?: string, options?: { exportToDocs?: boolean; exportToSheets?: boolean }): Promise<Artifact | QuizData | FlashcardData | AudioArtifact | VideoArtifact | any> {
    let artifact: Artifact;
    
    if (notebookId && artifactId === notebookId) {
      const response = await this.rpc.call(
        RPC.RPC_GET_AUDIO_OVERVIEW,
        [artifactId, 1],
        artifactId
      );
      artifact = this.parseAudioResponse(response, artifactId);
    } else {
      try {
        const response = await this.rpc.call(
          RPC.RPC_GET_ARTIFACT,
          [artifactId],
          notebookId
        );
        artifact = this.parseArtifactResponse(response);
      } catch (error: any) {
        if (notebookId && (error?.message?.includes('400') || error?.statusCode === 400)) {
          const artifacts = await this.list(notebookId);
          const found = artifacts.find(a => a.artifactId === artifactId);
          if (found) {
            artifact = found;
          } else {
            throw new NotebookLMError(
              `Artifact ${artifactId} not found. RPC_GET_ARTIFACT failed and artifact not found in list.`,
              error
            );
          }
        } else {
          throw error;
        }
      }
    }
    
    // Validate export options - only allowed for REPORT artifacts
    if (options && (options.exportToDocs || options.exportToSheets)) {
      if (artifact.type !== ArtifactType.REPORT) {
        throw new NotebookLMError(
          `Export options (exportToDocs, exportToSheets) are only available for REPORT artifacts. ` +
          `This artifact is of type ${artifact.type}.`
        );
      }
      if (!notebookId) {
        throw new NotebookLMError('notebookId is required when using export options for reports');
      }
    }
    
    if (artifact.state === ArtifactState.READY && notebookId) {
      try {
        if (artifact.type === ArtifactType.QUIZ) {
          const quizData = await fetchQuizData(this.rpc, artifactId, notebookId);
          return { ...artifact, ...quizData };
        } else if (artifact.type === ArtifactType.FLASHCARDS) {
          const flashcardData = await fetchFlashcardData(this.rpc, artifactId, notebookId);
          return { ...artifact, ...flashcardData };
        } else if (artifact.type === ArtifactType.AUDIO && artifactId === notebookId) {
          const audioData = await downloadAudioFile(this.rpc, artifactId, notebookId);
          return { ...artifact, ...audioData };
        } else if (artifact.type === ArtifactType.INFOGRAPHIC) {
          const infographicData = await fetchInfographic(this.rpc, artifactId, notebookId);
          return { ...artifact, ...infographicData };
        } else if (artifact.type === ArtifactType.REPORT) {
          if (options?.exportToDocs) {
            const docUrl = await reportToDocs(this.rpc, artifactId, notebookId, artifact.title);
            return { ...artifact, exportUrl: docUrl };
          } else if (options?.exportToSheets) {
            const sheetUrl = await reportToSheets(this.rpc, artifactId, notebookId, artifact.title);
            return { ...artifact, exportUrl: sheetUrl };
          } else {
            const reportContent = await getReportContent(this.rpc, artifactId, notebookId);
            return { ...artifact, content: reportContent };
          }
        } else if (artifact.type === ArtifactType.VIDEO) {
          const videoUrl = (artifact as VideoArtifact).videoData;
          if (videoUrl) {
            try {
              const finalVideoUrl = await getVideoUrl(this.rpc, notebookId, {});
              return { ...artifact, url: finalVideoUrl };
            } catch (error) {
              // If getVideoUrl fails, return the initial URL
              return { ...artifact, url: videoUrl };
            }
          }
        } else if (artifact.type === ArtifactType.SLIDE_DECK) {
          let pdfUrl = extractPdfUrl(artifact);
          if (!pdfUrl) {
            try {
              const artifactsListResponse = await this.rpc.call(RPC.RPC_LIST_ARTIFACTS, [[2], notebookId], notebookId);
              pdfUrl = extractPdfUrl(artifactsListResponse);
              if (!pdfUrl && Array.isArray(artifactsListResponse)) {
                for (const artifactEntry of artifactsListResponse) {
                  if (Array.isArray(artifactEntry) && artifactEntry.length > 0) {
                    const entryId = artifactEntry[0];
                    if (entryId === artifactId) {
                      pdfUrl = extractPdfUrl(artifactEntry);
                      if (pdfUrl) break;
                    }
                  }
                }
              }
            } catch (error) {
              // If list fetch fails, continue without URL
            }
          }
          if (pdfUrl) {
            return { ...artifact, url: normalizePdfUrl(pdfUrl) };
          }
        } else if (artifact.type === ArtifactType.MIND_MAP) {
          return { ...artifact, experimental: true };
        }
      } catch (error) {
        // If download fails, return metadata only
      }
    }
    
    return artifact;
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
   *   - `ArtifactType.REPORT` - Comprehensive report/document
   *   - `ArtifactType.MIND_MAP` - Visual concept mapping
   *   - `ArtifactType.INFOGRAPHIC` - Visual data summary
   *   - `ArtifactType.SLIDE_DECK` - Presentation slides
   *   - `ArtifactType.AUDIO` - Audio overview (podcast-style)
   *   - `ArtifactType.VIDEO` - Video overview
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
     *     - **For Report**: Optional - omit to use all sources, or specify to use only selected sources
     *     - **For Mind Map**: Optional - omit to use all sources, or specify to use only selected sources
   *   - `customization` (object, optional): Type-specific customization options (see below)
   * 
   * **Customization Options by Type:**
   * 
   * **Note:** Customization is only supported for the following artifact types:
   * Quiz, Flashcards, Slide Deck, Infographic, Audio, Video.
   * 
   * Other artifact types (Mind Map, Report) do not support customization.
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
   * **Mind Map, Report:**
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
   * // Using sub-services (recommended)
   * const quiz = await client.artifacts.quiz.create('notebook-id', {
   *   title: 'Chapter 1 Quiz',
   *   instructions: 'Create 10 multiple choice questions covering key concepts',
   *   customization: {
   *     numberOfQuestions: 3,
   *     difficulty: 2,
   *     language: 'en',
   *   },
   * });
   * 
   * const flashcards = await client.artifacts.flashcard.create('notebook-id', {
   *   instructions: 'Focus on key terminology and definitions',
   * });
   * 
   * const video = await client.artifacts.video.create('notebook-id', {
   *   instructions: 'Create an engaging video overview',
   *   sourceIds: ['source-id-1', 'source-id-2'],
   *   customization: {
   *     format: 1,
   *     visualStyle: 0,
   *   },
   * });
   * 
   * // Using main create() method (also supported)
   * const quiz2 = await client.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   title: 'Chapter 1 Quiz',
   *   instructions: 'Create 10 multiple choice questions covering key concepts',
   * });
   * console.log(`Quiz ID: ${quiz2.artifactId}, State: ${quiz2.state}`);
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
   * // Create report (uses all sources)
   * const report = await client.artifacts.report.create('notebook-id', {
   *   title: 'Final Report',
   *   instructions: 'Focus on key concepts, formulas, and important dates',
   * });
   * 
   * // Create report from specific sources
   * const reportFromSelected = await client.artifacts.report.create('notebook-id', {
   *   title: 'Chapter 1-3 Report',
   *   instructions: 'Focus on chapters 1-3',
   *   sourceIds: ['source-id-1', 'source-id-2', 'source-id-3'],
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
      // Other artifacts use xpWGLf (Report)
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
   * - ⚠️ **Experimental**: Download not implemented. Use `get()` to retrieve the video URL.
   * - The video URL is available in `artifact.url` field from `get()` method.
   * 
   * **Slide Deck:**
   * - ⚠️ **Experimental**: Download not implemented. Use `get()` to retrieve the PDF URL.
   * - The PDF URL is available in `artifact.url` field from `get()` method.
   * 
   * **Quiz:**
   * - Format: JSON file
   * - Filename: `quiz_<artifactId>_<timestamp>.json`
   * - Content: Complete artifact data including questions, options, correct answers, explanations, and metadata
   * 
   * **Flashcards:**
   * - Format: JSON file
   * - Filename: `flashcard_<artifactId>_<timestamp>.json`
   * - Content: Complete artifact data including flashcards array, CSV, totalCards, and metadata
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
   * // Video and Slides: Download not available (experimental)
   * // Use get() to retrieve URLs instead:
   * const video = await client.artifacts.get('video-id', 'notebook-id');
   * console.log('Video URL:', video.url);
   * 
   * const slides = await client.artifacts.get('slide-id', 'notebook-id');
   * console.log('PDF URL:', slides.url);
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
    if (!notebookId) {
      throw new NotebookLMError('notebookId is required for download');
    }
    
    // Get full artifact data using get()
    const artifact = await this.get(artifactId, notebookId);
    
    // Handle different artifact types
    if (artifact.type === ArtifactType.QUIZ || artifact.type === ArtifactType.FLASHCARDS) {
      // Quiz and Flashcard: Save as JSON with all data
      const fsModule: any = await import('fs/promises' as any).catch(() => null);
      if (!fsModule?.writeFile) {
        throw new NotebookLMError('File system access not available');
      }
      
      const pathModule = await import('path');
      const baseFileName = artifact.title 
        ? artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : artifactId;
      const fileName = `${artifact.type === ArtifactType.QUIZ ? 'quiz' : 'flashcard'}_${baseFileName}_${Date.now()}.json`;
      const filePath = pathModule.join(folderPath, fileName);
      
      // Ensure directory exists
      await fsModule.mkdir(folderPath, { recursive: true });
      
      // Save as JSON with all artifact data
      const jsonData = JSON.stringify(artifact, null, 2);
      await fsModule.writeFile(filePath, jsonData, 'utf-8');
      
      return { filePath, data: artifact };
      
    } else if (artifact.type === ArtifactType.AUDIO) {
      // Audio: Use existing download functionality
      const audioData = await downloadAudioFile(this.rpc, artifactId, notebookId);
      const fsModule: any = await import('fs/promises' as any).catch(() => null);
      if (!fsModule?.writeFile) {
        throw new NotebookLMError('File system access not available');
      }
      
      const pathModule = await import('path');
      const baseFileName = artifact.title 
        ? artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : artifactId;
      const fileName = `audio_${baseFileName}_${Date.now()}.mp3`;
      const filePath = pathModule.join(folderPath, fileName);
      
      await fsModule.mkdir(folderPath, { recursive: true });
      await audioData.saveToFile(filePath);
      
      return { filePath, data: audioData };
      
    } else if (artifact.type === ArtifactType.VIDEO || artifact.type === ArtifactType.SLIDE_DECK) {
      // Video and Slides: Experimental - URLs are available but download not implemented
      throw new NotebookLMError(
        `Download for ${artifact.type === ArtifactType.VIDEO ? 'video' : 'slide deck'} artifacts is experimental. ` +
        `Use get() to retrieve the URL instead. ` +
        `Video/Slide URLs are available in the artifact.url field.`
      );
    } else {
      // Other artifact types: Save raw data
      const fsModule: any = await import('fs/promises' as any).catch(() => null);
      if (!fsModule?.writeFile) {
        throw new NotebookLMError('File system access not available');
      }
      
      const pathModule = await import('path');
      const baseFileName = artifact.title 
        ? artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : artifactId;
      const fileName = `artifact_${baseFileName}_${Date.now()}.json`;
      const filePath = pathModule.join(folderPath, fileName);
      
      await fsModule.mkdir(folderPath, { recursive: true });
      const jsonData = JSON.stringify(artifact, null, 2);
      await fsModule.writeFile(filePath, jsonData, 'utf-8');
      
      return { filePath, data: artifact };
    }
  }
  
  // ========================================================================
  // Private creation methods
  // ========================================================================
  
  private getApiTypeNumber(artifactType: ArtifactType): number {
    switch (artifactType) {
      case ArtifactType.QUIZ:
        return 4;
      case ArtifactType.FLASHCARDS:
        return 4;
      case ArtifactType.INFOGRAPHIC:
        return 7;
      case ArtifactType.SLIDE_DECK:
        return 8;
      case ArtifactType.VIDEO:
        return 3;
      case ArtifactType.AUDIO:
        return 1;
      case ArtifactType.REPORT:
        return 1;
      case ArtifactType.MIND_MAP:
        return 0;
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
    
    // Type 3 in API response can be VIDEO (we check for video-specific patterns)
    // If not video, defaults to REPORT
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
      
      // Default to REPORT if no video patterns found
      return ArtifactType.REPORT;
    }
    
    // For other types, map based on known patterns
    switch (apiType) {
      case 1:
        // Type 1 can be REPORT or AUDIO - check for audio patterns
        const searchForAudioPattern = (obj: any, depth: number = 0): boolean => {
          if (depth > 10) return false;
          
          if (typeof obj === 'string') {
            if (obj.includes('lh3.googleusercontent.com/notebooklm/') ||
                obj.includes('lh3.google.com/rd-notebooklm/') ||
                obj.includes('=m140') ||
                obj.includes('=m140-dv') ||
                (obj.includes('lh3.googleusercontent.com/notebooklm/') && !obj.includes('=m22')) ||
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
        
        let isAudio = searchForAudioPattern(artifactData);
        
        if (!isAudio) {
          try {
            const stringified = JSON.stringify(artifactData);
            isAudio = searchForAudioPattern(stringified);
          } catch {
          }
        }
        
        if (isAudio) {
          return ArtifactType.AUDIO;
        }
        
        return ArtifactType.REPORT;
      case 2:
      case 3:
      case 4:
        return ArtifactType.REPORT;
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
   * Parse video creation response into VideoOverview
   * Used by createVideo method to return VideoOverview instead of Artifact
   */
  private parseCreateResponse(response: any, notebookId: string): VideoOverview {
    try {
      const result: VideoOverview = {
        projectId: notebookId,
        isReady: false,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        const videoData = response[0];
        if (Array.isArray(videoData) && videoData.length > 0) {
          if (videoData[0]) {
            result.videoId = videoData[0];
          }
          
          if (videoData.length > 1 && videoData[1]) {
            result.title = videoData[1];
          }
          
          if (videoData.length > 2 && typeof videoData[2] === 'number') {
            result.state = videoData[2] === 2 ? ArtifactState.READY : ArtifactState.CREATING;
            result.isReady = videoData[2] === 2;
          }
          
          if (videoData.length > 3 && videoData[3]) {
            result.videoData = videoData[3];
          }
        }
      }
      
      return result;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse video creation response: ${(error as Error).message}`);
    }
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
      case ArtifactType.REPORT:
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
        
      case ArtifactType.REPORT:
        fileExtension = '.json';
        fileName = `report_${baseFileName}${fileExtension}`;
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

// ========================================================================
// Standalone Functions
// ========================================================================

export async function downloadAudioFile(
  rpc: RPCClient,
  audioId: string,
  notebookId?: string
): Promise<{
  audioData: Uint8Array;
  audioUrl: string | null;
  saveToFile: (path: string) => Promise<void>;
}> {
  if (!audioId) {
    throw new NotebookLMError('Audio ID is required');
  }
  try {
    let audioData: Uint8Array | null = null;
    let audioUrl: string | null = null;
    if (notebookId) {
      const requestTypes = [1, 0, 2, 3];
      for (const requestType of requestTypes) {
        try {
          const audioOverview = await rpc.call(
            RPC.RPC_GET_AUDIO_OVERVIEW,
            [notebookId, requestType],
            notebookId
          );
          let parsedResponse = audioOverview;
          if (typeof audioOverview === 'string') {
            try {
              parsedResponse = JSON.parse(audioOverview);
            } catch {
              parsedResponse = audioOverview;
            }
          }
          if (!audioUrl) {
            audioUrl = parseAudioDownloadResponse(parsedResponse, audioId);
          }
          if (!audioData) {
            if (Array.isArray(parsedResponse)) {
              if (parsedResponse.length > 0 && Array.isArray(parsedResponse[0])) {
                const audioDataArray = parsedResponse[0];
                if (audioDataArray.length > 1 && typeof audioDataArray[1] === 'string') {
                  const candidate = audioDataArray[1];
                  if (candidate.length > 1000) {
                    const base64Data = extractBase64AudioData([candidate]);
                    if (base64Data) {
                      audioData = decodeBase64ToUint8Array(base64Data);
                      break;
                    }
                  }
                }
              }
              const base64Data = extractBase64AudioData(parsedResponse);
              if (base64Data) {
                audioData = decodeBase64ToUint8Array(base64Data);
                break;
              }
            } else {
              const base64Data = extractBase64AudioData(parsedResponse);
              if (base64Data) {
                audioData = decodeBase64ToUint8Array(base64Data);
                break;
              }
            }
          }
          if (audioData || audioUrl) {
            break;
          }
        } catch {
          continue;
        }
      }
    }
    if (!audioData) {
      try {
        const response = await rpc.call(
          RPC.RPC_GET_AUDIO_DOWNLOAD,
          [
            [null, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]],
            audioId,
            [[[0, 1000]]]
          ],
          notebookId
        );
        audioUrl = parseAudioDownloadResponse(response, audioId);
        if (audioUrl) {
          try {
            audioData = await downloadAudioFromUrl(audioUrl, rpc.getCookies());
          } catch (urlError: any) {
            console.warn(`URL download failed, trying base64 extraction: ${urlError.message}`);
            const base64Data = extractBase64AudioData(response);
            if (base64Data) {
              audioData = decodeBase64ToUint8Array(base64Data);
            } else {
              throw urlError;
            }
          }
        } else {
          const base64Data = extractBase64AudioData(response);
          if (base64Data) {
            audioData = decodeBase64ToUint8Array(base64Data);
          }
        }
      } catch (error: any) {
        throw new NotebookLMError(`Failed to download audio: ${error.message}`);
      }
    }
    if (!audioData) {
      throw new NotebookLMError(`Failed to extract audio data. Audio may not be ready yet.`);
    }
    return {
      audioData,
      audioUrl,
      saveToFile: async (path: string) => {
        try {
          const fsModule: any = await import('fs/promises' as any).catch(() => null);
          if (fsModule?.writeFile) {
            await fsModule.writeFile(path, audioData);
            return;
          }
        } catch {
        }
        if (typeof Blob !== 'undefined') {
          const buffer = new ArrayBuffer(audioData.length);
          const view = new Uint8Array(buffer);
          view.set(audioData);
          const blob = new Blob([buffer], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = path;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          throw new NotebookLMError('Cannot save file: unsupported environment');
        }
      },
    };
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to download audio file for audio ID ${audioId}: ${error.message}`
    );
  }
}

function extractBase64AudioData(response: any): string | null {
  let data = response;
  if (typeof response === 'string') {
    try {
      data = JSON.parse(response);
    } catch {
      if (response.length > 100 && /^[A-Za-z0-9+/=]+$/.test(response)) {
        return response;
      }
      return null;
    }
  }
  function findBase64(obj: any, depth: number = 0): string | null {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
        const decoded = atob(obj.substring(0, 100));
        if (decoded.includes('RIFF') || decoded.includes('ID3') || decoded.includes('fLaC') ||
            decoded.includes('OggS') || decoded.includes('ftyp')) {
          return obj;
        }
      }
    } else if (Array.isArray(obj)) {
      if (obj.length >= 3 && Array.isArray(obj[2]) && obj[2].length >= 2) {
        const candidate = obj[2][1];
        if (typeof candidate === 'string' && candidate.length > 1000) {
          const result = findBase64(candidate, depth + 1);
          if (result) return result;
        }
      }
      for (const item of obj) {
        const result = findBase64(item, depth + 1);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = findBase64(obj[key], depth + 1);
        if (result) return result;
      }
    }
    return null;
  }
  return findBase64(data);
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function parseAudioDownloadResponse(response: any, audioId?: string): string | null {
  function findUrl(obj: any, depth: number = 0): string | null {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.includes('lh3.googleusercontent.com/notebooklm/') ||
          obj.includes('googlevideo.com/') ||
          obj.includes('googleusercontent.com/notebooklm/')) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const url = findUrl(item, depth + 1);
        if (url) return url;
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const url = findUrl(obj[key], depth + 1);
        if (url) return url;
      }
    }
    return null;
  }
  return findUrl(response);
}

function downloadAudioFromUrl(url: string, cookies: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Cookie': cookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = httpModule.request(options, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadAudioFromUrl(res.headers.location, cookies)
            .then(resolve)
            .catch(reject);
        }
        reject(new NotebookLMError(`Failed to download audio: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        const audioData = Buffer.concat(chunks);
        resolve(new Uint8Array(audioData));
      });
      res.on('error', (error: Error) => {
        reject(new NotebookLMError(`Error downloading audio: ${error.message}`));
      });
    });
    req.on('error', (error: Error) => {
      reject(new NotebookLMError(`Request error: ${error.message}`));
    });
    req.end();
  });
}

export async function fetchQuizData(
  rpc: RPCClient,
  quizId: string,
  notebookId?: string
): Promise<QuizData> {
  if (!quizId) {
    throw new NotebookLMError('Quiz ID is required');
  }
  try {
    const response = await rpc.call(
      RPC.RPC_GET_QUIZ_DATA,
      [quizId],
      notebookId
    );
    return parseQuizResponse(response, quizId);
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to fetch quiz data for quiz ID ${quizId}: ${error.message}`,
      error
    );
  }
}

function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x2f;/g, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseQuizResponse(response: any, quizId?: string): QuizData {
  const originalResponse = response;
  let parsed: any = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      throw new NotebookLMError(
        `Failed to parse quiz response as JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new NotebookLMError(
      `Unexpected response structure: expected array with at least one element, got ${typeof parsed}`
    );
  }
  const dataArray = parsed[0];
  if (!Array.isArray(dataArray)) {
    throw new NotebookLMError(
      `Unexpected response structure: first element should be an array, got ${typeof dataArray}`
    );
  }
  let quizArray: any[] = [];
  function extractQuizFromHtmlString(htmlString: string): any[] | null {
    if (htmlString.includes('\\u003c')) {
      htmlString = htmlString
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0022/g, '"')
        .replace(/\\u0027/g, "'")
        .replace(/\\u0026/g, '&')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }
    const quizPatterns = [
      /&quot;quiz&quot;\s*:\s*\[/,
      /"quiz"\s*:\s*\[/,
    ];
    let quizMatch: RegExpMatchArray | null = null;
    for (let i = 0; i < quizPatterns.length; i++) {
      const match = htmlString.match(quizPatterns[i]);
      if (match && match.index !== undefined) {
        quizMatch = match;
        break;
      }
    }
    if (quizMatch && quizMatch.index !== undefined) {
      let jsonStartIndex = -1;
      let braceCount = 0;
      for (let i = quizMatch.index; i >= 0; i--) {
        const char = htmlString[i];
        if (char === '}') {
          braceCount++;
        } else if (char === '{') {
          if (braceCount === 0) {
            jsonStartIndex = i;
            break;
          }
          braceCount--;
        }
      }
      if (jsonStartIndex >= 0) {
        braceCount = 0;
        let jsonEndIndex = -1;
        for (let i = jsonStartIndex; i < htmlString.length; i++) {
          const char = htmlString[i];
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }
        if (jsonEndIndex > jsonStartIndex) {
          try {
            let jsonString = htmlString.substring(jsonStartIndex, jsonEndIndex)
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/');
            const jsonParsed = JSON.parse(jsonString);
            if (Array.isArray(jsonParsed.quiz)) {
              return jsonParsed.quiz;
            }
          } catch (e) {
          }
        }
      }
    }
    let dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*"([\s\S]*?)"\s*>/);
    if (!dataAppDataMatch) {
      dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*'([\s\S]*?)'\s*>/);
    }
    if (dataAppDataMatch && dataAppDataMatch[1]) {
      try {
        let jsonString = dataAppDataMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .trim();
        const jsonParsed = JSON.parse(jsonString);
        if (Array.isArray(jsonParsed.quiz)) {
          return jsonParsed.quiz;
        }
      } catch (e) {
      }
    }
    return null;
  }
  function searchForHtmlString(obj: any, depth: number = 0): any[] | null {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.includes('data-app-data') || obj.includes('<!doctype html') ||
          obj.includes('<app-root') || obj.includes('\\u003c!doctype') ||
          obj.includes('&quot;quiz&quot;') || obj.includes('"quiz"')) {
        const result = extractQuizFromHtmlString(obj);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = searchForHtmlString(item, depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = searchForHtmlString(obj[key], depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    }
    return null;
  }
  const foundQuiz = searchForHtmlString(dataArray);
  if (foundQuiz && foundQuiz.length > 0) {
    quizArray = foundQuiz;
  } else {
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      if (typeof item === 'string') {
        const result = extractQuizFromHtmlString(item);
        if (result && result.length > 0) {
          quizArray = result;
          break;
        }
      }
      if (typeof item === 'string' && item.includes('"quiz"')) {
        try {
          const jsonParsed = JSON.parse(item);
          if (jsonParsed && typeof jsonParsed === 'object') {
            if (Array.isArray(jsonParsed.quiz)) {
              quizArray = jsonParsed.quiz;
              break;
            }
            const found = findQuizArray(jsonParsed);
            if (found.length > 0) {
              quizArray = found;
              break;
            }
          }
        } catch (e) {
          const jsonMatch = item.match(/\{[\s\S]*"quiz"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const jsonParsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(jsonParsed.quiz)) {
                quizArray = jsonParsed.quiz;
                break;
              }
            } catch (e2) {
            }
          }
        }
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if ('quiz' in item && Array.isArray((item as any).quiz)) {
          quizArray = (item as any).quiz;
          break;
        }
        const found = findQuizArray(item);
        if (found.length > 0) {
          quizArray = found;
          break;
        }
      }
      if (Array.isArray(item) && item.length > 0) {
        const firstItem = item[0];
        if (firstItem && typeof firstItem === 'object' && 'question' in firstItem) {
          quizArray = item;
          break;
        }
        const found = findQuizArray(item);
        if (found.length > 0) {
          quizArray = found;
          break;
        }
      }
    }
  }
  if (quizArray.length === 0) {
    quizArray = findQuizArray(dataArray);
  }
  const questions: QuizQuestion[] = [];
  for (const item of quizArray) {
    if (Array.isArray(item) && item.length > 0) {
      const questionData = item;
      if (questionData.length >= 3) {
        const question: QuizQuestion = {
          question: String(questionData[0] || ''),
          options: Array.isArray(questionData[1])
            ? questionData[1].map((opt: any) => String(opt || ''))
            : [],
          correctAnswer: Number(questionData[2]) || 0,
          explanation: questionData[3] ? String(questionData[3]) : undefined,
        };
        if (question.question && question.options.length > 0) {
          questions.push(question);
        }
      }
    } else if (item && typeof item === 'object') {
      let options: string[] = [];
      let optionReasons: string[] | undefined = [];
      let correctAnswerFromOptions: number | null = null;
      if (item.answerOptions && Array.isArray(item.answerOptions) && item.answerOptions.length > 0) {
        optionReasons = [];
        options = item.answerOptions.map((opt: any) => {
          if (typeof opt === 'object' && opt !== null) {
            const optText = opt.text ? decodeHtmlEntities(String(opt.text)) : String(opt || '');
            if (opt.rationale !== undefined && opt.rationale !== null && String(opt.rationale).trim() !== '') {
              optionReasons!.push(decodeHtmlEntities(String(opt.rationale)));
            } else {
              optionReasons!.push('');
            }
            return optText;
          }
          optionReasons!.push('');
          return decodeHtmlEntities(String(opt || ''));
        });
        const foundCorrectIndex = item.answerOptions.findIndex((opt: any) =>
          typeof opt === 'object' && opt !== null && opt.isCorrect === true
        );
        if (foundCorrectIndex !== -1) {
          correctAnswerFromOptions = foundCorrectIndex;
        }
      } else if (item.options && Array.isArray(item.options)) {
        options = item.options.map((opt: any) => decodeHtmlEntities(String(opt || '')));
      }
      const correctAnswer = correctAnswerFromOptions !== null
        ? correctAnswerFromOptions
        : typeof item.correctAnswer === 'number'
        ? item.correctAnswer
        : typeof item.correctIndex === 'number'
        ? item.correctIndex
        : 0;
      let reasoning: string | undefined = undefined;
      if (item.answerOptions && Array.isArray(item.answerOptions) && correctAnswer >= 0 && correctAnswer < item.answerOptions.length) {
        const correctOption = item.answerOptions[correctAnswer];
        if (correctOption && typeof correctOption === 'object' && correctOption !== null) {
          if (correctOption.rationale !== undefined && correctOption.rationale !== null && String(correctOption.rationale).trim() !== '') {
            reasoning = decodeHtmlEntities(String(correctOption.rationale));
          }
        }
      }
      if (!reasoning || reasoning.trim() === '') {
        if (item.explanation !== undefined && item.explanation !== null && String(item.explanation).trim() !== '') {
          reasoning = decodeHtmlEntities(String(item.explanation));
        } else if (item.rationale !== undefined && item.rationale !== null && String(item.rationale).trim() !== '') {
          reasoning = decodeHtmlEntities(String(item.rationale));
        }
      }
      let hint: string | undefined = undefined;
      if (item.hint !== undefined && item.hint !== null) {
        hint = decodeHtmlEntities(String(item.hint));
      } else if (item.hintText !== undefined && item.hintText !== null) {
        hint = decodeHtmlEntities(String(item.hintText));
      }
      if (optionReasons && optionReasons.length > 0) {
        const hasAnyRationale = optionReasons.some(r => r && r.trim().length > 0);
        if (!hasAnyRationale) {
          optionReasons = undefined;
        }
      } else {
        optionReasons = undefined;
      }
      const questionText = decodeHtmlEntities(String(item.question || ''));
      const question: QuizQuestion = {
        question: questionText,
        options,
        correctAnswer,
        explanation: reasoning,
        reasoning,
        hint,
        optionReasons,
      };
      if (question.question && question.options.length > 0) {
        questions.push(question);
      }
    }
  }
  if (questions.length === 0) {
    let responsePreview: string;
    const responseType = typeof originalResponse;
    if (responseType === 'string') {
      responsePreview = (originalResponse as string).substring(0, 500);
    } else if (Array.isArray(originalResponse)) {
      responsePreview = `Array with ${originalResponse.length} items, first item type: ${typeof originalResponse[0]}`;
      if (originalResponse.length > 0 && Array.isArray(originalResponse[0])) {
        responsePreview += `, first element is array with ${originalResponse[0].length} items`;
      }
    } else if (originalResponse && typeof originalResponse === 'object') {
      responsePreview = `Object with keys: ${Object.keys(originalResponse).slice(0, 10).join(', ')}`;
    } else {
      responsePreview = String(originalResponse);
    }
    throw new NotebookLMError(
      `No valid questions found in quiz response. ` +
      `Response type: ${responseType}, Preview: ${responsePreview}. ` +
      `Quiz array found: ${quizArray.length} items. ` +
      `The quiz data might be in a different format or location than expected. ` +
      `If this is a flashcard artifact, use the flashcard fetching function instead.`
    );
  }
  return {
    questions,
    totalQuestions: questions.length,
  };
}

function findQuizArray(obj: any, depth: number = 0): any[] {
  if (depth > 15) {
    return [];
  }
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      const firstItem = obj[0];
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        if ('question' in firstItem && 'answerOptions' in firstItem) {
          return obj;
        }
      }
      if (Array.isArray(firstItem) && firstItem.length >= 3) {
        return obj;
      }
      for (const item of obj) {
        if (Array.isArray(item)) {
          const found = findQuizArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          if (Array.isArray(item.quiz)) {
            return item.quiz;
          }
          const found = findQuizArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (typeof item === 'string' && item.includes('"quiz"')) {
          try {
            const jsonParsed = JSON.parse(item);
            if (Array.isArray(jsonParsed.quiz)) {
              return jsonParsed.quiz;
            }
          } catch (e) {
          }
        }
      }
    }
  } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      if (key === 'quiz' && Array.isArray(obj[key])) {
        return obj[key];
      }
      if (Array.isArray(obj[key])) {
        const found = findQuizArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (obj[key] && typeof obj[key] === 'object') {
        const found = findQuizArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (typeof obj[key] === 'string' && obj[key].includes('"quiz"')) {
        try {
          const jsonParsed = JSON.parse(obj[key]);
          if (Array.isArray(jsonParsed.quiz)) {
            return jsonParsed.quiz;
          }
        } catch (e) {
        }
      }
    }
  }
  return [];
}

export async function fetchFlashcardData(
  rpc: RPCClient,
  flashcardId: string,
  notebookId?: string
): Promise<ParsedFlashcardData> {
  if (!flashcardId) {
    throw new NotebookLMError('Flashcard ID is required');
  }
  try {
    const response = await rpc.call(
      RPC.RPC_GET_QUIZ_DATA,
      [flashcardId],
      notebookId
    );
    return parseFlashcardResponse(response, flashcardId);
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to fetch flashcard data for flashcard ID ${flashcardId}: ${error.message}`,
      error
    );
  }
}

function parseFlashcardResponse(response: any, flashcardId?: string): ParsedFlashcardData {
  const originalResponse = response;
  let parsed: any = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      throw new NotebookLMError(
        `Failed to parse flashcard response as JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new NotebookLMError(
      `Unexpected response structure: expected array with at least one element, got ${typeof parsed}`
    );
  }
  const dataArray = parsed[0];
  if (!Array.isArray(dataArray)) {
    throw new NotebookLMError(
      `Unexpected response structure: first element should be an array, got ${typeof dataArray}`
    );
  }
  let flashcardsArray: any[] = [];
  function extractFlashcardsFromHtmlString(htmlString: string): any[] | null {
    if (htmlString.includes('\\u003c')) {
      htmlString = htmlString
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0022/g, '"')
        .replace(/\\u0027/g, "'")
        .replace(/\\u0026/g, '&')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }
    const flashcardPatterns = [
      /&quot;flashcards&quot;\s*:\s*\[/,
      /"flashcards"\s*:\s*\[/,
    ];
    let flashcardMatch: RegExpMatchArray | null = null;
    for (let i = 0; i < flashcardPatterns.length; i++) {
      const match = htmlString.match(flashcardPatterns[i]);
      if (match && match.index !== undefined) {
        flashcardMatch = match;
        break;
      }
    }
    if (flashcardMatch && flashcardMatch.index !== undefined) {
      let jsonStartIndex = -1;
      let braceCount = 0;
      for (let i = flashcardMatch.index; i >= 0; i--) {
        const char = htmlString[i];
        if (char === '}') {
          braceCount++;
        } else if (char === '{') {
          if (braceCount === 0) {
            jsonStartIndex = i;
            break;
          }
          braceCount--;
        }
      }
      if (jsonStartIndex >= 0) {
        braceCount = 0;
        let jsonEndIndex = -1;
        for (let i = jsonStartIndex; i < htmlString.length; i++) {
          const char = htmlString[i];
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }
        if (jsonEndIndex > jsonStartIndex) {
          try {
            let jsonString = htmlString.substring(jsonStartIndex, jsonEndIndex)
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/');
            const jsonParsed = JSON.parse(jsonString);
            if (Array.isArray(jsonParsed.flashcards)) {
              return jsonParsed.flashcards;
            }
          } catch (e) {
          }
        }
      }
    }
    let dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*"([\s\S]*?)"\s*>/);
    if (!dataAppDataMatch) {
      dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*'([\s\S]*?)'\s*>/);
    }
    if (dataAppDataMatch && dataAppDataMatch[1]) {
      try {
        let jsonString = dataAppDataMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .trim();
        const jsonParsed = JSON.parse(jsonString);
        if (Array.isArray(jsonParsed.flashcards)) {
          return jsonParsed.flashcards;
        }
      } catch (e) {
      }
    }
    return null;
  }
  function searchForHtmlString(obj: any, depth: number = 0): any[] | null {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.includes('data-app-data') || obj.includes('<!doctype html') ||
          obj.includes('<app-root') || obj.includes('\\u003c!doctype') ||
          obj.includes('&quot;flashcards&quot;') || obj.includes('"flashcards"')) {
        const result = extractFlashcardsFromHtmlString(obj);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = searchForHtmlString(item, depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = searchForHtmlString(obj[key], depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    }
    return null;
  }
  const foundFlashcards = searchForHtmlString(dataArray);
  if (foundFlashcards && foundFlashcards.length > 0) {
    flashcardsArray = foundFlashcards;
  } else {
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      if (typeof item === 'string') {
        const result = extractFlashcardsFromHtmlString(item);
        if (result && result.length > 0) {
          flashcardsArray = result;
          break;
        }
      }
      if (typeof item === 'string' && item.includes('"flashcards"')) {
        try {
          const jsonParsed = JSON.parse(item);
          if (jsonParsed && typeof jsonParsed === 'object') {
            if (Array.isArray(jsonParsed.flashcards)) {
              flashcardsArray = jsonParsed.flashcards;
              break;
            }
            const found = findFlashcardsArray(jsonParsed);
            if (found.length > 0) {
              flashcardsArray = found;
              break;
            }
          }
        } catch (e) {
          const jsonMatch = item.match(/\{[\s\S]*"flashcards"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const jsonParsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(jsonParsed.flashcards)) {
                flashcardsArray = jsonParsed.flashcards;
                break;
              }
            } catch (e2) {
            }
          }
        }
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if ('flashcards' in item && Array.isArray((item as any).flashcards)) {
          flashcardsArray = (item as any).flashcards;
          break;
        }
        const found = findFlashcardsArray(item);
        if (found.length > 0) {
          flashcardsArray = found;
          break;
        }
      }
      if (Array.isArray(item) && item.length > 0) {
        const firstItem = item[0];
        if (firstItem && typeof firstItem === 'object' && ('f' in firstItem || 'front' in firstItem)) {
          flashcardsArray = item;
          break;
        }
        const found = findFlashcardsArray(item);
        if (found.length > 0) {
          flashcardsArray = found;
          break;
        }
      }
    }
  }
  if (flashcardsArray.length === 0) {
    flashcardsArray = findFlashcardsArray(dataArray);
  }
  const flashcards: Array<{ question: string; answer: string }> = [];
  for (const item of flashcardsArray) {
    if (item && typeof item === 'object') {
      const frontText = item.f !== undefined ? item.f : (item.front !== undefined ? item.front : item.question);
      const backText = item.b !== undefined ? item.b : (item.back !== undefined ? item.back : item.answer);
      if (frontText !== undefined && backText !== undefined) {
        const question = decodeHtmlEntities(String(frontText));
        const answer = decodeHtmlEntities(String(backText));
        if (question.trim() && answer.trim()) {
          flashcards.push({ question, answer });
        }
      }
    } else if (Array.isArray(item) && item.length >= 2) {
      const question = decodeHtmlEntities(String(item[0] || ''));
      const answer = decodeHtmlEntities(String(item[1] || ''));
      if (question.trim() && answer.trim()) {
        flashcards.push({ question, answer });
      }
    }
  }
  if (flashcards.length === 0) {
    let responsePreview: string;
    const responseType = typeof originalResponse;
    if (responseType === 'string') {
      responsePreview = (originalResponse as string).substring(0, 500);
    } else if (Array.isArray(originalResponse)) {
      responsePreview = `Array with ${originalResponse.length} items, first item type: ${typeof originalResponse[0]}`;
      if (originalResponse.length > 0 && Array.isArray(originalResponse[0])) {
        responsePreview += `, first element is array with ${originalResponse[0].length} items`;
      }
    } else if (originalResponse && typeof originalResponse === 'object') {
      responsePreview = `Object with keys: ${Object.keys(originalResponse).slice(0, 10).join(', ')}`;
    } else {
      responsePreview = String(originalResponse);
    }
    throw new NotebookLMError(
      `No valid flashcards found in flashcard response. ` +
      `Response type: ${responseType}, Preview: ${responsePreview}. ` +
      `Flashcard array found: ${flashcardsArray.length} items. ` +
      `The flashcard data might be in a different format or location than expected. ` +
      `If this is a quiz artifact, use the quiz fetching function instead.`
    );
  }
  const csvLines = flashcards.map(card => {
    const escapeCSV = (text: string): string => {
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    return `${escapeCSV(card.question)},${escapeCSV(card.answer)}`;
  });
  const csv = csvLines.join('\n');
  return {
    flashcards,
    totalCards: flashcards.length,
    csv,
  };
}

function findFlashcardsArray(obj: any, depth: number = 0): any[] {
  if (depth > 15) {
    return [];
  }
  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      const firstItem = obj[0];
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        if (('f' in firstItem || 'front' in firstItem) && ('b' in firstItem || 'back' in firstItem)) {
          return obj;
        }
      }
      if (Array.isArray(firstItem) && firstItem.length >= 2) {
        return obj;
      }
      for (const item of obj) {
        if (Array.isArray(item)) {
          const found = findFlashcardsArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          if (Array.isArray(item.flashcards)) {
            return item.flashcards;
          }
          const found = findFlashcardsArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (typeof item === 'string' && item.includes('"flashcards"')) {
          try {
            const jsonParsed = JSON.parse(item);
            if (Array.isArray(jsonParsed.flashcards)) {
              return jsonParsed.flashcards;
            }
          } catch (e) {
          }
        }
      }
    }
  } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      if (key === 'flashcards' && Array.isArray(obj[key])) {
        return obj[key];
      }
      if (Array.isArray(obj[key])) {
        const found = findFlashcardsArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (obj[key] && typeof obj[key] === 'object') {
        const found = findFlashcardsArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (typeof obj[key] === 'string' && obj[key].includes('"flashcards"')) {
        try {
          const jsonParsed = JSON.parse(obj[key]);
          if (Array.isArray(jsonParsed.flashcards)) {
            return jsonParsed.flashcards;
          }
        } catch (e) {
        }
      }
    }
  }
  return [];
}

export async function fetchInfographic(
  rpc: RPCClient,
  infographicId: string,
  notebookId?: string,
  options: FetchInfographicOptions = {}
): Promise<InfographicImageData> {
  if (!infographicId) throw new NotebookLMError('Infographic ID is required');
  let response: any;
  let imageUrl: string | null = null;
  try {
    response = await rpc.call(RPC.RPC_GET_ARTIFACT, [infographicId], notebookId);
    imageUrl = extractImageUrlFromResponse(response);
  } catch (error: any) {
    const is400Error = error.message?.includes('400') || error.message?.includes('Bad Request') || (error instanceof NotebookLMError && error.message?.includes('400'));
    if (is400Error && notebookId) {
      try {
        const listResponse = await rpc.call(RPC.RPC_LIST_ARTIFACTS, [[2], notebookId], notebookId);
        const artifact = findArtifactInListResponse(listResponse, infographicId);
        if (artifact) {
          imageUrl = extractImageUrlFromResponse(artifact);
        } else {
          throw new NotebookLMError(`Infographic ${infographicId} not found in list response`);
        }
      } catch (listError: any) {
        throw new NotebookLMError(`Failed to fetch infographic for ID ${infographicId}: RPC_GET_ARTIFACT failed (400) and list fallback also failed: ${listError.message}`, error);
      }
    } else {
      throw new NotebookLMError(`Failed to fetch infographic for ID ${infographicId}: ${error.message}`, error);
    }
  }
  if (!imageUrl) throw new NotebookLMError(`No image URL found in infographic response for ID ${infographicId}`);
  try {
    const urlObj = new URL(imageUrl);
    if (!urlObj.searchParams.has('authuser')) {
      urlObj.searchParams.set('authuser', '0');
      imageUrl = urlObj.toString();
    }
  } catch (urlError) {
    console.warn(`Warning: Could not parse image URL: ${imageUrl}`);
  }
  const dimensions = parseDimensionsFromUrl(imageUrl);
  const result: InfographicImageData = { imageUrl, mimeType: 'image/png', ...dimensions };
  if (options.downloadImage) {
    const cookies = options.cookies || rpc.getCookies();
    if (!cookies || !cookies.trim()) {
      throw new NotebookLMError('Cookies are required for downloading infographic images. Please provide cookies in the options or ensure the RPC client has cookies configured.');
    }
    const imageData = await downloadImageFromUrl(imageUrl, cookies);
    result.imageData = imageData;
  }
  return result;
}

function findArtifactInListResponse(listResponse: any, artifactId: string): any | null {
  try {
    let data = listResponse;
    if (typeof listResponse === 'string') {
      try {
        data = JSON.parse(listResponse);
      } catch {
        data = listResponse;
      }
    }
    if (!Array.isArray(data)) return null;
    let unwrappedData: any = data;
    while (Array.isArray(unwrappedData) && unwrappedData.length > 0 && Array.isArray(unwrappedData[0])) {
      const firstItem = unwrappedData[0];
      if (Array.isArray(firstItem) && firstItem.length > 0 && typeof firstItem[0] === 'string' && firstItem[0].length > 10) break;
      unwrappedData = unwrappedData[0];
    }
    const artifactArray: any[] = Array.isArray(unwrappedData) ? unwrappedData : [];
    for (const item of artifactArray) {
      let artifactData = item;
      if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
        artifactData = item[0];
      }
      if (Array.isArray(artifactData) && artifactData.length > 0 && artifactData[0] === artifactId) {
        return artifactData;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function extractImageUrlFromResponse(response: any): string | null {
  function findImageUrl(obj: any, depth: number = 0): string | null {
    if (depth > 15) return null;
    if (typeof obj === 'string') {
      if ((obj.includes('lh3.googleusercontent.com') || obj.includes('lh3.google.com/rd-notebooklm')) && (obj.includes('notebooklm') || obj.includes('rd-notebooklm'))) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const url = findImageUrl(item, depth + 1);
        if (url) return url;
      }
    } else if (obj && typeof obj === 'object') {
      const urlFields = ['imageUrl', 'url', 'image_url', 'src', 'data', 'content', 'image'];
      for (const field of urlFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const url = findImageUrl(obj[field], depth + 1);
          if (url) return url;
        }
      }
      for (const key in obj) {
        const url = findImageUrl(obj[key], depth + 1);
        if (url) return url;
      }
    }
    return null;
  }
  let parsed: any = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      const urlMatch = response.match(/https:\/\/lh3\.(googleusercontent\.com|google\.com\/rd-notebooklm)\/[^\s"']+/);
      if (urlMatch) return urlMatch[0];
    }
  }
  return findImageUrl(parsed);
}

function parseDimensionsFromUrl(url: string): { width?: number; height?: number } {
  const dimensions: { width?: number; height?: number } = {};
  const widthMatch = url.match(/[=-]w(\d+)/);
  const heightMatch = url.match(/[=-]h(\d+)/);
  if (widthMatch) dimensions.width = parseInt(widthMatch[1], 10);
  if (heightMatch) dimensions.height = parseInt(heightMatch[1], 10);
  return dimensions;
}

async function downloadImageFromUrl(url: string, cookies: string): Promise<Uint8Array | ArrayBuffer> {
  // Pre-authenticate if cookies available
  if (cookies && cookies.trim()) {
    try {
      await preAuthenticateForDownload(cookies);
    } catch {
      // Don't fail if pre-auth fails
    }
  }
  
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  if (isNode) {
    return downloadWithNodeHttp(url, cookies);
  } else {
    return downloadWithFetch(url, cookies);
  }
}

async function downloadWithNodeHttp(url: string, cookies?: string): Promise<Uint8Array | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = {
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
      'Referer': 'https://notebooklm.google.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'sec-fetch-dest': 'image',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'cross-site',
    };
    if (cookies && cookies.trim()) {
      headers['Cookie'] = cookies;
      headers['sec-fetch-storage-access'] = 'active';
    }
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    };
    const req = client.request(options, (res: any) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadImageFromUrl(res.headers.location, cookies || '').then(resolve).catch(reject);
        }
        reject(new NotebookLMError(`Failed to download image: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
      res.on('error', (error: Error) => reject(new NotebookLMError(`Error downloading image: ${error.message}`)));
    });
    req.on('error', (error: Error) => reject(new NotebookLMError(`Request error: ${error.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new NotebookLMError('Request timeout'));
    });
    req.end();
  });
}

async function downloadWithFetch(url: string, cookies?: string): Promise<Uint8Array | ArrayBuffer> {
  const headers: Record<string, string> = {
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
    'Referer': 'https://notebooklm.google.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  };
  if (url.includes('rd-notebooklm') || url.includes('notebooklm')) {
    headers['Origin'] = 'https://notebooklm.google.com';
  }
  if (cookies && cookies.trim()) {
    headers['Cookie'] = cookies;
    headers['sec-fetch-storage-access'] = 'active';
  }
  const response = await fetch(url, { method: 'GET', headers, redirect: 'follow' });
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    if (response.status === 403) {
      errorMessage += `. Authentication required${cookies ? ' (cookies may be invalid)' : ' (no cookies provided)'}`;
    }
    throw new NotebookLMError(errorMessage);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(arrayBuffer);
  }
  return arrayBuffer;
}

export async function downloadSlidesFile(
  rpc: RPCClient,
  slideId: string,
  notebookId: string,
  options: DownloadSlidesOptions = {}
): Promise<{
  slidesData: Uint8Array;
  pdfUrl: string;
  saveToFile: (path: string) => Promise<void>;
}> {
  if (!slideId) throw new NotebookLMError('Slide ID is required');
  if (!notebookId) throw new NotebookLMError('Notebook ID is required');
  try {
    const artifactsService = new ArtifactsService(rpc);
    const artifacts = await artifactsService.list(notebookId);
    const slideArtifact = artifacts.find(a => a.artifactId === slideId && a.type === ArtifactType.SLIDE_DECK);
    if (!slideArtifact) {
      throw new NotebookLMError(`No slide deck found for slide ID ${slideId}. Make sure the slide deck exists in the notebook.`);
    }
    let pdfUrl: string | null = null;
    try {
      const artifactsListResponse = await rpc.call(RPC.RPC_LIST_ARTIFACTS, [[2], notebookId], notebookId);
      pdfUrl = extractPdfUrl(artifactsListResponse);
      if (!pdfUrl && Array.isArray(artifactsListResponse)) {
        for (const artifactEntry of artifactsListResponse) {
          if (Array.isArray(artifactEntry) && artifactEntry.length > 0) {
            const artifactId = artifactEntry[0];
            if (artifactId === slideId) {
              pdfUrl = extractPdfUrl(artifactEntry);
              if (pdfUrl) break;
            }
          }
        }
      }
    } catch (error) {
    }
    if (!pdfUrl) {
      try {
        const artifactDetails = await artifactsService.get(slideId, notebookId);
        pdfUrl = extractPdfUrl(artifactDetails);
      } catch (error) {
      }
    }
    if (!pdfUrl) {
      throw new NotebookLMError(`No PDF download URL found for slide ID ${slideId}. The slide deck may not be ready yet. Please check that the slide deck is in READY state.`);
    }
    pdfUrl = normalizePdfUrl(pdfUrl);
    const rpcCookies = rpc.getCookies();
    let finalCookies = rpcCookies;
    if (options.googleDomainCookies) {
      const cookieMap = new Map<string, string>();
      if (options.googleDomainCookies) {
        options.googleDomainCookies.split(';').forEach(c => {
          const [name, ...valueParts] = c.trim().split('=');
          if (name && valueParts.length > 0) {
            cookieMap.set(name, valueParts.join('='));
          }
        });
      }
      if (rpcCookies) {
        rpcCookies.split(';').forEach(c => {
          const [name, ...valueParts] = c.trim().split('=');
          if (name && valueParts.length > 0) {
            cookieMap.set(name, valueParts.join('='));
          }
        });
      }
      finalCookies = Array.from(cookieMap.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
    }
    if (!finalCookies || !finalCookies.trim()) {
      throw new NotebookLMError('Cookies are required for downloading PDF. Please ensure the RPC client has cookies configured or provide googleDomainCookies in options.');
    }
    const slidesData = await downloadPdfFromUrl(pdfUrl, finalCookies);
    return {
      slidesData,
      pdfUrl,
      saveToFile: async (path: string) => {
        try {
          const fsModule: any = await import('fs/promises' as any).catch(() => null);
          if (fsModule?.writeFile) {
            await fsModule.writeFile(path, slidesData);
            return;
          }
        } catch {
        }
        if (typeof Blob !== 'undefined') {
          const buffer = new ArrayBuffer(slidesData.length);
          const view = new Uint8Array(buffer);
          view.set(slidesData);
          const blob = new Blob([buffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = path;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          throw new NotebookLMError('Cannot save file: unsupported environment');
        }
      },
    };
  } catch (error: any) {
    throw new NotebookLMError(`Failed to download slide deck file for slide ID ${slideId}: ${error.message}`);
  }
}

function normalizePdfUrl(url: string): string {
  if (!url) return url;
  let normalized = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\=/g, '=').replace(/\\&/g, '&');
  if (!normalized.includes('authuser=')) {
    if (normalized.includes('?')) {
      normalized += '&authuser=0';
    } else {
      normalized += '?authuser=0';
    }
  }
  return normalized;
}

function extractPdfUrl(artifact: any): string | null {
  if (!artifact) return null;
  const artifactString = JSON.stringify(artifact);
  const urlPattern = /https?:\/\/contribution\.usercontent\.google\.com\/download[^\s"',\]\}]+/g;
  const matches = artifactString.match(urlPattern);
  if (matches && matches.length > 0) {
    return matches[0];
  }
  const searchForPdfUrl = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.includes('contribution.usercontent.google.com/download')) {
        const urlMatch = obj.match(/https?:\/\/[^\s"',\]\}]+contribution\.usercontent\.google\.com\/download[^\s"',\]\}]+/);
        if (urlMatch) return urlMatch[0];
        if (obj.startsWith('http://') || obj.startsWith('https://')) return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForPdfUrl(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      const priorityKeys = ['url', 'downloadUrl', 'pdfUrl', 'fileUrl', 'download', 'pdf', 'file'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const found = searchForPdfUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      for (const key in obj) {
        if (key.toLowerCase().includes('url') || key.toLowerCase().includes('download') || key.toLowerCase().includes('pdf') || key.toLowerCase().includes('file')) {
          const found = searchForPdfUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      for (const value of Object.values(obj)) {
        const found = searchForPdfUrl(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return searchForPdfUrl(artifact);
}

function downloadPdfFromUrl(url: string, cookies: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Cookie': cookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Referer': 'https://notebooklm.google.com/',
        'Origin': 'https://notebooklm.google.com',
      },
    };
    const req = httpModule.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const location = res.headers.location;
        const redirectUrl = location.startsWith('http') ? location : `${urlObj.protocol}//${urlObj.hostname}${location}`;
        return downloadPdfFromUrl(redirectUrl, cookies).then(resolve).catch(reject);
      }
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403) {
          const errorChunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => errorChunks.push(chunk));
          res.on('end', () => {
            const responseBuffer = Buffer.concat(errorChunks);
            const responseText = responseBuffer.toString('utf-8');
            const location = res.headers.location || '';
            if (location) {
              reject(new NotebookLMError(`Authentication required. The PDF download URL requires valid Google authentication cookies. HTTP ${res.statusCode}. Redirected to: ${location}`));
            } else {
              reject(new NotebookLMError(`Failed to download PDF: HTTP ${res.statusCode}. This may indicate an authentication issue.`));
            }
          });
          return;
        }
        reject(new NotebookLMError(`Failed to download PDF: HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const pdfData = Buffer.concat(chunks);
        if (pdfData.length > 0 && pdfData[0] !== 0x25) {
          const text = pdfData.toString('utf-8', 0, Math.min(500, pdfData.length));
          if (text.includes('Sign in') || text.includes('accounts.google.com') || text.includes('<html')) {
            reject(new NotebookLMError(`Authentication required. The PDF download URL requires valid Google authentication cookies. Received HTML sign-in page instead of PDF.`));
            return;
          }
        }
        resolve(new Uint8Array(pdfData));
      });
      res.on('error', (error: Error) => reject(new NotebookLMError(`Error downloading PDF: ${error.message}`)));
    });
    req.on('error', (error: Error) => reject(new NotebookLMError(`Request error: ${error.message}`)));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new NotebookLMError('PDF download request timed out'));
    });
    req.end();
  });
}

export async function createReport(
  rpc: RPCClient,
  notebookId: string,
  options: CreateReportOptions = {}
): Promise<{
  artifactId: string;
  state: ArtifactState;
  title?: string;
}> {
  if (!notebookId) throw new NotebookLMError('Notebook ID is required');
  const { instructions = '', sourceIds = [], title = 'Briefing Doc', subtitle = 'Key insights and important quotes', language = 'en' } = options;
  try {
    const formattedSourceIds = sourceIds.map(id => [[id]]);
    const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]);
    const args: any[] = [
      [2],
      notebookId,
      [null, null, 2, formattedSourceIds, null, null, null, [null, [title, subtitle, null, sourceIdsFlat, language, instructions]]],
    ];
    const response = await rpc.call(RPC.RPC_CREATE_REPORT, args, notebookId);
    const artifactId = extractArtifactIdFromResponse(response);
    if (!artifactId) {
      throw new NotebookLMError('Failed to extract artifact ID from report creation response');
    }
    return { artifactId, state: ArtifactState.CREATING, title };
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(`Failed to create report: ${errorMessage}`);
  }
}

function extractArtifactIdFromResponse(response: any): string | null {
  if (!response) return null;
  const searchForArtifactId = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(obj)) return obj;
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForArtifactId(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      if (obj.artifactId) return obj.artifactId;
      if (obj.id) return obj.id;
      for (const value of Object.values(obj)) {
        const found = searchForArtifactId(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return searchForArtifactId(response);
}

export async function reportToDocs(
  rpc: RPCClient,
  reportId: string,
  notebookId: string,
  title?: string
): Promise<string> {
  if (!reportId) throw new NotebookLMError('Report ID is required');
  if (!notebookId) throw new NotebookLMError('Notebook ID is required');
  try {
    if (!title) {
      const artifactsService = new ArtifactsService(rpc);
      const report = await artifactsService.get(reportId, notebookId);
      title = report.title || 'Report';
    }
    const args: any[] = [null, reportId, null, title, 1];
    const response = await rpc.call(RPC.RPC_EXPORT_REPORT, args, notebookId);
    const docUrl = extractExportUrlFromResponse(response);
    if (!docUrl) {
      throw new NotebookLMError('Failed to extract Google Docs URL from export response');
    }
    return docUrl;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(`Failed to export report to Google Docs: ${errorMessage}`);
  }
}

export async function reportToSheets(
  rpc: RPCClient,
  reportId: string,
  notebookId: string,
  title?: string
): Promise<string> {
  if (!reportId) throw new NotebookLMError('Report ID is required');
  if (!notebookId) throw new NotebookLMError('Notebook ID is required');
  try {
    if (!title) {
      const artifactsService = new ArtifactsService(rpc);
      const report = await artifactsService.get(reportId, notebookId);
      title = report.title || 'Report';
    }
    const args: any[] = [null, reportId, null, title, 2];
    const response = await rpc.call(RPC.RPC_EXPORT_REPORT, args, notebookId);
    const sheetUrl = extractExportUrlFromResponse(response);
    if (!sheetUrl) {
      throw new NotebookLMError('Failed to extract Google Sheets URL from export response');
    }
    return sheetUrl;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(`Failed to export report to Google Sheets: ${errorMessage}`);
  }
}

export async function getReportContent(
  rpc: RPCClient,
  reportId: string,
  notebookId: string
): Promise<ReportContent> {
  if (!reportId) throw new NotebookLMError('Report ID is required');
  if (!notebookId) throw new NotebookLMError('Notebook ID is required');
  try {
    const artifactsService = new ArtifactsService(rpc);
    let artifactTitle = 'Report';
    try {
      const artifact = await artifactsService.get(reportId, notebookId);
      artifactTitle = artifact.title || 'Report';
    } catch {
      const artifacts = await artifactsService.list(notebookId);
      const reportArtifact = artifacts.find(a => a.artifactId === reportId);
      if (reportArtifact) {
        artifactTitle = reportArtifact.title || 'Report';
      }
    }
    const listResponse = await rpc.call(RPC.RPC_LIST_ARTIFACTS, [[2], notebookId], notebookId);
    const reportEntry = findReportEntryInListResponse(listResponse, reportId);
    if (!reportEntry) {
      throw new NotebookLMError(`Report ${reportId} not found in artifacts list. Make sure the report exists and is in READY state.`);
    }
    const reportContent = extractReportContentFromResponse(reportEntry, artifactTitle);
    if (!reportContent) {
      throw new NotebookLMError(`Failed to extract report content for report ID ${reportId}. The report data structure may be incomplete. Make sure the report is in READY state.`);
    }
    return reportContent;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(`Failed to get report content for report ID ${reportId}: ${errorMessage}`);
  }
}

function findReportEntryInListResponse(listResponse: any, reportId: string): any | null {
  if (!Array.isArray(listResponse) || listResponse.length === 0) return null;
  const searchRecursive = (data: any): any | null => {
    if (Array.isArray(data)) {
      for (const item of data) {
        if (Array.isArray(item) && typeof item[0] === 'string' && item[0] === reportId) {
          if (item.includes(2) || item.some((val: any) => val === 2)) {
            return item;
          }
        }
        const found = searchRecursive(item);
        if (found) return found;
      }
    }
    return null;
  };
  return searchRecursive(listResponse);
}

function extractReportContentFromResponse(response: any, defaultTitle: string): ReportContent | null {
  if (!response) return null;
  const searchForReport = (obj: any, depth = 0): ReportContent | null => {
    if (depth > 20) return null;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if (obj.tailored_report) {
        const report = obj.tailored_report;
        if (report.title || report.content) {
          return { title: report.title || defaultTitle, content: report.content || '', sections: report.sections || [] };
        }
      }
      if (typeof obj.title === 'string' && typeof obj.content === 'string') {
        return { title: obj.title || defaultTitle, content: obj.content || '', sections: obj.sections || [] };
      }
      for (const value of Object.values(obj)) {
        const found = searchForReport(value, depth + 1);
        if (found) return found;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForReport(item, depth + 1);
        if (found) return found;
      }
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        if (typeof item === 'string' && item.length > 10) {
          if (i + 1 < obj.length && typeof obj[i + 1] === 'string' && obj[i + 1].length > 50) {
            return { title: item || defaultTitle, content: obj[i + 1] || '', sections: [] };
          }
        }
      }
    } else if (typeof obj === 'string') {
      if ((obj.startsWith('{') || obj.startsWith('[')) && obj.length > 10) {
        try {
          const parsed = JSON.parse(obj);
          const found = searchForReport(parsed, depth + 1);
          if (found) return found;
        } catch {
        }
      }
    }
    return null;
  };
  return searchForReport(response);
}

function extractExportUrlFromResponse(response: any): string | null {
  if (!response) return null;
  const responseString = JSON.stringify(response);
  const docsPattern = /https?:\/\/docs\.google\.com\/document\/d\/[^\s"',\]\}]+/g;
  const sheetsPattern = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/[^\s"',\]\}]+/g;
  const docsMatch = responseString.match(docsPattern);
  if (docsMatch && docsMatch[0]) return docsMatch[0];
  const sheetsMatch = responseString.match(sheetsPattern);
  if (sheetsMatch && sheetsMatch[0]) return sheetsMatch[0];
  const searchForUrl = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null;
    if (typeof obj === 'string') {
      if (obj.includes('docs.google.com/document/') || obj.includes('docs.google.com/spreadsheets/')) {
        const urlMatch = obj.match(/https?:\/\/docs\.google\.com\/(document|spreadsheets)\/d\/[^\s"',\]\}]+/);
        if (urlMatch) return urlMatch[0];
        if (obj.startsWith('http://') || obj.startsWith('https://')) return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForUrl(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      const priorityKeys = ['url', 'documentUrl', 'sheetUrl', 'exportUrl', 'link', 'href'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const found = searchForUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      for (const key in obj) {
        if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link') || key.toLowerCase().includes('href')) {
          const found = searchForUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      for (const value of Object.values(obj)) {
        const found = searchForUrl(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return searchForUrl(response);
}

export function formatReportAsMarkdown(report: ReportContent): string {
  let markdown = `# ${report.title}\n\n`;
  if (report.content) markdown += `${report.content}\n\n`;
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      markdown += `## ${section.title}\n\n${section.content}\n\n`;
    }
  }
  return markdown;
}

export function formatReportAsText(report: ReportContent): string {
  let text = `${report.title}\n${'='.repeat(report.title.length)}\n\n`;
  if (report.content) text += `${report.content}\n\n`;
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      text += `${section.title}\n${'-'.repeat(section.title.length)}\n\n${section.content}\n\n`;
    }
  }
  return text;
}

export function formatReportAsHTML(report: ReportContent): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
    h2 { color: #5f6368; margin-top: 30px; }
    p { margin-bottom: 15px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
`;
  if (report.content) html += `  <div>${formatTextAsHTML(report.content)}</div>\n`;
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      html += `  <h2>${escapeHtml(section.title)}</h2>\n  <div>${formatTextAsHTML(section.content)}</div>\n`;
    }
  }
  html += `</body>
</html>`;
  return html;
}

export function formatReportAsJSON(report: ReportContent): string {
  return JSON.stringify(report, null, 2);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatTextAsHTML(text: string): string {
  return escapeHtml(text).split('\n').map((line) => line.trim() ? `<p>${line}</p>` : '<br>').join('\n');
}

// ========================================================================
// Video helper functions
// ========================================================================

/**
 * Get video URL by following redirects
 */
async function getVideoUrl(
  rpc: RPCClient,
  notebookId: string,
  options: GetVideoUrlOptions = {}
): Promise<string> {
  const { cookies, googleDomainCookies } = options;
  const rpcCookies = rpc.getCookies();
  const notebooklmCookies = cookies || rpcCookies;
  
  const artifactsService = new ArtifactsService(rpc);
  const artifacts = await artifactsService.list(notebookId);
  const videoArtifact = artifacts.find(a => 
    a.type === ArtifactType.VIDEO && a.videoData
  );
  
  if (!videoArtifact || !videoArtifact.videoData) {
    throw new NotebookLMError(
      'No video URL found in artifacts. Make sure a video has been created for this notebook.'
    );
  }
  
  let downloadUrl = videoArtifact.videoData;
  
  try {
    const urlObj = new URL(downloadUrl);
    if (!urlObj.searchParams.has('authuser')) {
      urlObj.searchParams.set('authuser', '0');
      downloadUrl = urlObj.toString();
    }
  } catch (urlError) {
    // Continue with original URL
  }
  
  const cookieStrings: string[] = [];
  if (googleDomainCookies && googleDomainCookies.trim()) {
    cookieStrings.push(googleDomainCookies);
  }
  if (notebooklmCookies && notebooklmCookies.trim()) {
    cookieStrings.push(notebooklmCookies);
  }
  
  const finalCookies = mergeCookies(cookieStrings);
  
  if (!finalCookies || !finalCookies.trim()) {
    throw new NotebookLMError(
      'Cookies are required for getting final video URL. ' +
      'Please provide cookies in the options or ensure the RPC client has cookies configured.'
    );
  }
  
  return followRedirectsToFinalUrl(downloadUrl, finalCookies);
}

/**
 * Merge cookies from multiple strings (later cookies override earlier ones)
 */
function mergeCookies(cookieStrings: string[]): string {
  const cookieMap = new Map<string, string>();
  
  cookieStrings.forEach(cookieString => {
    if (!cookieString || !cookieString.trim()) {
      return;
    }
    
    const cookies = cookieString.split(';').map(c => c.trim()).filter(Boolean);
    
    cookies.forEach(cookie => {
      const [name, ...valueParts] = cookie.split('=');
      if (name && valueParts.length > 0) {
        const value = valueParts.join('=');
        cookieMap.set(name.trim(), value);
      }
    });
  });
  
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Normalize redirect URL
 */
function normalizeRedirectUrl(location: string, baseUrl: string): string {
  let normalized = decodeURIComponent(location);
  
  if (normalized.startsWith('//')) {
    const baseUrlObj = new URL(baseUrl);
    normalized = baseUrlObj.protocol + normalized;
  } else if (normalized.startsWith('/')) {
    const baseUrlObj = new URL(baseUrl);
    normalized = baseUrlObj.protocol + '//' + baseUrlObj.hostname + normalized;
  } else if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    if (normalized.includes('/') && !normalized.includes('://')) {
      const baseUrlObj = new URL(baseUrl);
      if (baseUrlObj.hostname.includes('google.com') || baseUrlObj.hostname.includes('googleusercontent.com')) {
        normalized = baseUrlObj.protocol + '//lh3.google.com/' + normalized;
      } else {
        normalized = new URL(normalized, baseUrl).toString();
      }
    } else {
      normalized = new URL(normalized, baseUrl).toString();
    }
  }
  
  try {
    const urlObj = new URL(normalized);
    const pathParts = urlObj.pathname.split('%3F');
    if (pathParts.length > 1) {
      urlObj.pathname = pathParts[0];
      const queryPart = pathParts.slice(1).join('%3F');
      const queryParams = new URLSearchParams(queryPart);
      queryParams.forEach((value, key) => {
        urlObj.searchParams.set(key, value);
      });
    }
    
    if (normalized.includes('%3F') && !normalized.includes('?')) {
      normalized = normalized.replace('%3F', '?');
      return new URL(normalized).toString();
    }
    
    return urlObj.toString();
  } catch (urlError) {
    if (normalized.includes('%3F') && !normalized.includes('?')) {
      normalized = normalized.replace('%3F', '?');
    }
    
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      const baseUrlObj = new URL(baseUrl);
      if (normalized.startsWith('//')) {
        normalized = baseUrlObj.protocol + normalized;
      } else if (normalized.startsWith('/')) {
        normalized = baseUrlObj.protocol + '//' + baseUrlObj.hostname + normalized;
      } else {
        normalized = baseUrlObj.protocol + '//lh3.google.com/' + normalized;
      }
    }
    
    try {
      return new URL(normalized).toString();
    } catch (e) {
      return normalized;
    }
  }
}

/**
 * Follow redirects to get final video URL
 */
async function followRedirectsToFinalUrl(
  url: string,
  cookies: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Encoding': 'identity;q=1, *;q=0',
      'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
      'Range': 'bytes=0-',
      'Referer': 'https://notebooklm.google.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-fetch-dest': 'video',
      'sec-fetch-site': 'cross-site',
    };
    
    if (url.includes('rd-notebooklm') || url.includes('notebooklm')) {
      headers['sec-fetch-mode'] = 'no-cors';
      headers['Priority'] = 'i';
      if (!url.includes('lh3.google.com/rd-notebooklm')) {
        headers['sec-fetch-storage-access'] = 'active';
      }
    } else if (url.includes('googlevideo.com')) {
      headers['sec-fetch-mode'] = 'no-cors';
      headers['sec-fetch-storage-access'] = 'active';
    }
    
    let accumulatedCookies = cookies || '';
    
    const followRedirects = (currentUrl: string, redirectCount: number = 0): void => {
      if (currentUrl.includes('googlevideo.com/videoplayback')) {
        resolve(currentUrl);
        return;
      }
      
      if (redirectCount > 10) {
        reject(new NotebookLMError('Too many redirects (max 10)'));
        return;
      }
      
      const reqUrl = new URL(currentUrl);
      const reqClient = reqUrl.protocol === 'https:' ? https : http;
      
      const stepHeaders: Record<string, string> = { ...headers };
      
      const isFirstRequest = redirectCount === 0;
      const isInitialNotebooklm = isFirstRequest && 
                                   reqUrl.hostname === 'lh3.googleusercontent.com' && 
                                   reqUrl.pathname.includes('/notebooklm/') &&
                                   !reqUrl.pathname.includes('/rd-notebooklm/');
      const hasRdNotebooklm = reqUrl.pathname.includes('/rd-notebooklm/');
      const needsCookies = !isInitialNotebooklm && 
                          (hasRdNotebooklm || redirectCount > 0);
      
      if (!needsCookies) {
        delete stepHeaders['Cookie'];
      }
      
      if (needsCookies && accumulatedCookies && accumulatedCookies.trim()) {
        stepHeaders['Cookie'] = accumulatedCookies;
      }
      
      if (hasRdNotebooklm || reqUrl.pathname.includes('/notebooklm/')) {
        stepHeaders['sec-fetch-mode'] = 'no-cors';
        stepHeaders['Priority'] = 'i';
        if (reqUrl.hostname === 'lh3.google.com' && reqUrl.pathname.includes('/rd-notebooklm/')) {
          delete stepHeaders['sec-fetch-storage-access'];
        } else {
          stepHeaders['sec-fetch-storage-access'] = 'active';
        }
      } else if (reqUrl.hostname.includes('googlevideo.com')) {
        stepHeaders['sec-fetch-mode'] = 'no-cors';
        stepHeaders['sec-fetch-storage-access'] = 'active';
      }
      
      if (!stepHeaders['range']) {
        stepHeaders['range'] = 'bytes=0-';
      }
      
      const reqOptions = {
        hostname: reqUrl.hostname,
        port: reqUrl.port || (reqUrl.protocol === 'https:' ? 443 : 80),
        path: reqUrl.pathname + reqUrl.search,
        method: 'GET',
        headers: stepHeaders,
      };
      
      const req = reqClient.request(reqOptions, (res) => {
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          const setCookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
          const newCookies = setCookieArray.map(cookie => {
            return cookie.split(';')[0].trim();
          }).filter(Boolean);
          
          if (newCookies.length > 0) {
            const existingCookieMap = new Map<string, string>();
            if (accumulatedCookies) {
              accumulatedCookies.split(';').forEach(c => {
                const [name, ...valueParts] = c.trim().split('=');
                if (name) {
                  existingCookieMap.set(name, valueParts.join('='));
                }
              });
            }
            
            newCookies.forEach(cookie => {
              const [name, ...valueParts] = cookie.split('=');
              if (name) {
                existingCookieMap.set(name, valueParts.join('='));
              }
            });
            
            accumulatedCookies = Array.from(existingCookieMap.entries())
              .map(([name, value]) => `${name}=${value}`)
              .join('; ');
          }
        }
        
        res.on('end', () => {
          const location = res.headers.location;
          
          if (location) {
            const redirectUrl = normalizeRedirectUrl(location, currentUrl);
            
            if (redirectUrl.includes('googlevideo.com/videoplayback')) {
              resolve(redirectUrl);
              return;
            }
            
            if (redirectUrl.includes('accounts.google.com') ||
                redirectUrl.includes('ServiceLogin') || 
                redirectUrl.includes('InteractiveLogin')) {
              reject(new NotebookLMError(
                'Authentication failed: Cookies expired or invalid session.'
              ));
              return;
            }
            
            followRedirects(redirectUrl, redirectCount + 1);
            return;
          }
          
          const statusCode = res.statusCode || 0;
          if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
            res.destroy();
            req.destroy();
            reject(new NotebookLMError(
              `Got redirect status ${statusCode} but no location header`
            ));
            return;
          }
          
          if (currentUrl.includes('googlevideo.com/videoplayback') && 
              (statusCode === 200 || statusCode === 206)) {
            res.destroy();
            req.destroy();
            resolve(currentUrl);
            return;
          }
          
          if (statusCode === 200 || statusCode === 206) {
            res.destroy();
            req.destroy();
            reject(new NotebookLMError(
              `Got ${statusCode} response but no location header and URL is not googlevideo.com: ${currentUrl}`
            ));
            return;
          }
          
          res.destroy();
          req.destroy();
          reject(new NotebookLMError(
            `Unexpected status ${statusCode} when following redirects`
          ));
        });
        
        res.on('error', (err) => {
          reject(err);
        });
      });
      
      req.on('error', (error) => {
        reject(new NotebookLMError(`Error following redirects: ${error.message}`));
      });
      
      req.end();
    };
    
    followRedirects(url, 0);
  });
}

/**
 * Extract video URL from artifacts list response
 */
function extractVideoUrlFromArtifacts(artifactsResponse: any): string | null {
  if (!Array.isArray(artifactsResponse)) {
    return null;
  }
  
  const findVideoUrl = (arr: any): string | null => {
    if (Array.isArray(arr)) {
      if (arr.length > 9 && Array.isArray(arr[9]) && arr[9].length > 1) {
        if (arr[9][0] === null && typeof arr[9][1] === 'string' && arr[9][1].startsWith('http')) {
          const url = arr[9][1];
          if (url.includes('lh3.googleusercontent.com/notebooklm/') || 
              url.includes('lh3.google.com/rd-notebooklm/') ||
              url.includes('googlevideo.com/videoplayback')) {
            return url;
          }
        }
      }
      
      for (const item of arr) {
        const found = findVideoUrl(item);
        if (found) return found;
      }
    }
    return null;
  };
  
  return findVideoUrl(artifactsResponse);
}

/**
 * Download video file from URL
 */
function downloadVideoFromUrl(
  url: string,
  cookies: string,
  googleDomainCookies?: string
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    let finalCookies = cookies;
    if (googleDomainCookies) {
      const cookieMap = new Map<string, string>();
      
      googleDomainCookies.split(';').forEach(c => {
        const [name, ...valueParts] = c.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name, valueParts.join('='));
        }
      });
      
      cookies.split(';').forEach(c => {
        const [name, ...valueParts] = c.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name, valueParts.join('='));
        }
      });
      
      finalCookies = Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }
    
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Cookie': finalCookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Range': 'bytes=0-',
      },
    };
    
    const req = httpModule.request(options, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadVideoFromUrl(res.headers.location, cookies, googleDomainCookies)
            .then(resolve)
            .catch(reject);
        }
        reject(new NotebookLMError(`Failed to download video: HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const videoData = Buffer.concat(chunks);
        resolve(new Uint8Array(videoData));
      });
      
      res.on('error', (error: Error) => {
        reject(new NotebookLMError(`Error downloading video: ${error.message}`));
      });
    });
    
    req.on('error', (error: Error) => {
      reject(new NotebookLMError(`Request error: ${error.message}`));
    });
    
    req.end();
  });
}

// ========================================================================
// Infographic authentication helpers
// ========================================================================

/**
 * Extract SAPISID from cookies
 */
function extractSAPISID(cookies: string): string | null {
  const parts = cookies.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('SAPISID=')) {
      return trimmed.substring('SAPISID='.length);
    }
  }
  return null;
}

/**
 * Generate SAPISIDHASH for authorization
 */
function generateSAPISIDHASH(sapisid: string, timestamp: number): string {
  const origin = 'https://notebooklm.google.com';
  const data = `${timestamp} ${sapisid} ${origin}`;
  const hash = createHash('sha1');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Pre-authenticate by calling play.google.com/log
 */
async function preAuthenticateForDownload(cookies: string): Promise<void> {
  const sapisid = extractSAPISID(cookies);
  if (!sapisid) {
    return;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const authHash = generateSAPISIDHASH(sapisid, timestamp);
    const authString = `SAPISIDHASH+${authHash}+SAPISID1PHASH+${authHash}+SAPISID3PHASH+${authHash}`;
    const encodedAuth = authString.replace(/\+/g, '%2B');
    const logUrl = `https://play.google.com/log?hasfast=true&auth=${encodedAuth}&authuser=0&format=json`;
    
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    
    if (isNode) {
      const urlObj = new URL(logUrl);
      const currentTimestamp = Date.now();
      const currentTimestampSec = Math.floor(currentTimestamp / 1000);
      const requestBody = `[[1,null,null,null,null,null,null,null,null,null,[null,null,null,null,"en",null,"boq_labs-tailwind-frontend_20250129.00_p0",null,[[["Microsoft Edge","143"],["Chromium","143"],["Not A(Brand","24"]],0,"macOS","15.2.0","arm","","143.0.3650.96"],[3,1]]],2090,[["${currentTimestamp}",null,null,null,null,null,null,null,null,null,null,null,null,null,-19800,[null,[""]],null,null,null,null,1,null,null,"[[[${currentTimestampSec},0,0],1],null,null,[1,null,3,null,null,null,null,null,null,null,null,null,null,[[1]],[{}]],null,null,null,null,[]]"]],"${currentTimestamp}",null,null,null,null,null,null,null,null,null,null,null,null,null,[[null,[null,null,null,null,null,null,null,null,null,null,null,null,96797242]],9]]]`;
      
      await new Promise<void>((resolve) => {
        const req = https.request({
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cookie': cookies,
            'Origin': 'https://notebooklm.google.com',
            'Referer': 'https://notebooklm.google.com/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          },
        }, (res: any) => {
          res.on('end', () => resolve());
        });
        
        req.on('error', () => resolve());
        req.setTimeout(5000, () => {
          req.destroy();
          resolve();
        });
        
        req.write(requestBody);
        req.end();
      });
    } else {
      try {
        await fetch(logUrl, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cookie': cookies,
            'Origin': 'https://notebooklm.google.com',
            'Referer': 'https://notebooklm.google.com/',
          },
          body: '[]',
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Don't fail if pre-auth fails
      }
    }
  } catch {
    // Don't fail if pre-auth fails
  }
}
