/**
 * Artifacts service
 * Handles artifact operations (documents, presentations, etc.)
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { Artifact, ArtifactType, ArtifactState, CreateArtifactOptions } from '../types/artifact.js';
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
   * List artifacts for a project
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const artifacts = await client.artifacts.list('notebook-id');
   * console.log(`Found ${artifacts.length} artifacts`);
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
   * @param artifactId - The artifact ID
   * @param newTitle - New title
   * 
   * @example
   * ```typescript
   * const artifact = await client.artifacts.rename('artifact-id', 'New Title');
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
   * @param artifactId - The artifact ID
   * 
   * @example
   * ```typescript
   * await client.artifacts.delete('artifact-id');
   * ```
   */
  async delete(artifactId: string): Promise<void> {
    await this.rpc.call(
      RPC.RPC_DELETE_ARTIFACT,
      [artifactId]
    );
  }
  
  /**
   * Get an artifact
   * 
   * @param artifactId - The artifact ID
   * 
   * @example
   * ```typescript
   * const artifact = await client.artifacts.get('artifact-id');
   * ```
   */
  async get(artifactId: string): Promise<Artifact> {
    const response = await this.rpc.call(
      RPC.RPC_GET_ARTIFACT,
      [artifactId]
    );
    
    return this.parseArtifactResponse(response);
  }
  
  /**
   * Update artifact
   * Update artifact content or metadata
   * 
   * @param artifactId - The artifact ID
   * @param updates - Fields to update
   * 
   * @example
   * ```typescript
   * const artifact = await client.artifacts.update('artifact-id', {
   *   title: 'Updated Title',
   *   content: 'New content...',
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
   * Create a study guide artifact
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const guide = await client.artifacts.createStudyGuide('notebook-id', {
   *   title: 'Exam Study Guide',
   *   instructions: 'Focus on key concepts',
   * });
   * ```
   */
  async createStudyGuide(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    this.quota?.checkQuota('createReport'); // Study guides use report quota
    const artifact = await this.createArtifact(notebookId, 4, options);
    this.quota?.recordUsage('createReport');
    return artifact;
  }
  
  /**
   * Create a quiz artifact
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const quiz = await client.artifacts.createQuiz('notebook-id', {
   *   instructions: 'Create 10 multiple choice questions',
   * });
   * ```
   */
  async createQuiz(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    this.quota?.checkQuota('createQuiz');
    const artifact = await this.createArtifact(notebookId, 5, options);
    this.quota?.recordUsage('createQuiz');
    return artifact;
  }
  
  /**
   * Create flashcards artifact
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const flashcards = await client.artifacts.createFlashcards('notebook-id', {
   *   instructions: 'Focus on terminology',
   * });
   * ```
   */
  async createFlashcards(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    this.quota?.checkQuota('createFlashcards');
    const artifact = await this.createArtifact(notebookId, 6, options);
    this.quota?.recordUsage('createFlashcards');
    return artifact;
  }
  
  /**
   * Create a mind map artifact
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const mindMap = await client.artifacts.createMindMap('notebook-id', {
   *   title: 'Concept Map',
   * });
   * ```
   */
  async createMindMap(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.createArtifact(notebookId, 7, options); // Type 7 = Mind Map
  }
  
  /**
   * Create an infographic artifact (BETA)
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const infographic = await client.artifacts.createInfographic('notebook-id', {
   *   instructions: 'Visual summary of data',
   * });
   * ```
   */
  async createInfographic(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.createArtifact(notebookId, 8, options); // Type 8 = Infographic
  }
  
  /**
   * Create a slide deck artifact (BETA)
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const slideDeck = await client.artifacts.createSlideDeck('notebook-id', {
   *   title: 'Presentation',
   *   instructions: 'Create 10 slides',
   * });
   * ```
   */
  async createSlideDeck(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    return this.createArtifact(notebookId, 9, options); // Type 9 = Slide Deck
  }
  
  /**
   * Create a report artifact
   * 
   * @param notebookId - The notebook ID
   * @param options - Creation options
   * 
   * @example
   * ```typescript
   * const report = await client.artifacts.createReport('notebook-id', {
   *   title: 'Research Report',
   *   customization: {
   *     language: 'en',
   *     tone: 'professional',
   *   },
   * });
   * ```
   */
  async createReport(notebookId: string, options: CreateArtifactOptions = {}): Promise<Artifact> {
    this.quota?.checkQuota('createReport');
    const artifact = await this.createArtifact(notebookId, 1, options);
    this.quota?.recordUsage('createReport');
    return artifact;
  }
  
  /**
   * Create an artifact with specified type
   * 
   * @private
   */
  private async createArtifact(
    notebookId: string,
    artifactType: number,
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
    
    // Add customization if specified
    if (customization) {
      args.push({
        language: customization.language,
        tone: customization.tone,
        length: customization.length,
        focusAreas: customization.focusAreas,
      });
    }
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_ARTIFACT,
      args,
      notebookId
    );
    
    return this.parseArtifactResponse(response);
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
}

