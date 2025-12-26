/**
 * Notebooks service
 * Handles notebook/project operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { Notebook, CreateNotebookOptions, UpdateNotebookOptions } from '../types/notebook.js';
import { NotebookLMError } from '../types/common.js';
import { createChunkedParser } from '../utils/chunked-parser.js';

/**
 * Service for notebook operations
 */
export class NotebooksService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  /**
   * List recently viewed notebooks
   * 
   * @example
   * ```typescript
   * const notebooks = await client.notebooks.list();
   * console.log(`Found ${notebooks.length} notebooks`);
   * ```
   */
  async list(): Promise<Notebook[]> {
    // RPC structure: [null, 1, null, [2]]
    const response = await this.rpc.call(RPC.RPC_LIST_RECENTLY_VIEWED_PROJECTS, [null, 1, null, [2]]);
    
    // Parse response - handle NotebookLM's complex response format
    return this.parseListResponse(response);
  }
  
  /**
   * Get a specific notebook by ID
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const notebook = await client.notebooks.get('notebook-id');
   * console.log(`Notebook: ${notebook.title}`);
   * ```
   */
  async get(notebookId: string): Promise<Notebook> {
    // RPC structure: [notebookId, null, [2], null, 0]
    const response = await this.rpc.call(
      RPC.RPC_GET_PROJECT,
      [notebookId, null, [2], null, 0],
      notebookId
    );
    
    return this.parseGetResponse(response, notebookId);
  }
  
  /**
   * Create a new notebook
   * 
   * @param options - Options for creating the notebook
   * 
   * @example
   * ```typescript
   * const notebook = await client.notebooks.create({
   *   title: 'My Research Notes',
   *   emoji: '📚',
   * });
   * console.log(`Created notebook: ${notebook.projectId}`);
   * ```
   */
  async create(options: CreateNotebookOptions): Promise<Notebook> {
    const { title = '', emoji = '📄' } = options;
    
    // Check quota before creating
    this.quota?.checkQuota('createNotebook');
    
    // RPC structure: [title, null, null, [2], [1, null, null, null, null, null, null, null, null, [1]]]
    // The last array [1, null, null, null, null, null, null, null, null, [1]] appears to be default settings
    const response = await this.rpc.call(
      RPC.RPC_CREATE_PROJECT,
      [title, null, null, [2], [1, null, null, null, null, null, null, null, null, [1]]]
    );
    
    const notebook = this.parseCreateResponse(response, title, emoji);
    
    // Record usage after successful creation
    this.quota?.recordUsage('createNotebook');
    
    return notebook;
  }
  
  /**
   * Update a notebook
   * 
   * @param notebookId - The notebook ID
   * @param options - Update options
   * 
   * @example
   * ```typescript
   * const notebook = await client.notebooks.update('notebook-id', {
   *   title: 'Updated Title',
   *   emoji: '🔬',
   * });
   * ```
   */
  async update(notebookId: string, options: UpdateNotebookOptions): Promise<Notebook> {
    // Build the update structure based on observed RPC format:
    // Structure: [notebookId, [[null, null, null, [null, title]]]]
    // Based on curl example: ["6767b030-...", [[null, null, null, [null, "test101"]]]]
    
    // For title updates, the structure is: [[null, null, null, [null, title]]]
    const updateArray: any[] = [null, null, null, null];
    
    if (options.title !== undefined) {
      // Title goes at index 3: [null, title]
      updateArray[3] = [null, options.title];
    } else {
      // If no title is provided, we still need the structure but with null at index 3
      updateArray[3] = null;
    }
    
    // Note: Emoji updates structure is not yet confirmed from RPC examples
    // For now, we support title updates. Emoji updates may require a different structure
    // or separate RPC call - this will be implemented once we have the correct format
    
    // Build the nested array structure: [[null, null, null, [null, title]]]
    const updates = [updateArray];
    
    const response = await this.rpc.call(
      RPC.RPC_MUTATE_PROJECT,
      [notebookId, updates],
      notebookId
    );
    
    return this.parseGetResponse(response, notebookId);
  }
  
  /**
   * Delete one or more notebooks
   * 
   * @param notebookIds - Array of notebook IDs to delete
   * 
   * @example
   * ```typescript
   * await client.notebooks.delete(['notebook-id-1', 'notebook-id-2']);
   * ```
   */
  async delete(notebookIds: string | string[]): Promise<void> {
    const ids = Array.isArray(notebookIds) ? notebookIds : [notebookIds];
    
    await this.rpc.call(
      RPC.RPC_DELETE_PROJECTS,
      [ids]
    );
  }
  
  /**
   * Remove notebook from recently viewed list
   * 
   * @param notebookId - The notebook ID
   */
  async removeFromRecentlyViewed(notebookId: string): Promise<void> {
    await this.rpc.call(
      RPC.RPC_REMOVE_RECENTLY_VIEWED,
      [notebookId]
    );
  }
  
  /**
   * Get project sharing details
   * Get project sharing information (different from GetProject)
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const details = await client.notebooks.getSharingDetails('notebook-id');
   * console.log(`Is shared: ${details.isShared}`);
   * ```
   */
  async getSharingDetails(notebookId: string): Promise<{
    isShared: boolean;
    shareUrl?: string;
    permissions?: any;
  }> {
    const response = await this.rpc.call(
      RPC.RPC_GET_PROJECT_DETAILS,
      [notebookId],
      notebookId
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    return {
      isShared: data?.[0] === true || data?.isShared === true,
      shareUrl: data?.[1] || data?.shareUrl,
      permissions: data?.[2] || data?.permissions,
    };
  }
  
  /**
   * Share project
   * Share a notebook/project
   * 
   * @param notebookId - The notebook ID
   * @param settings - Sharing settings
   * 
   * @example
   * ```typescript
   * const result = await client.notebooks.share('notebook-id', {
   *   public: true,
   *   allowComments: false,
   * });
   * console.log(`Share URL: ${result.shareUrl}`);
   * ```
   */
  async share(notebookId: string, settings: {
    public?: boolean;
    allowComments?: boolean;
    allowCopy?: boolean;
  } = {}): Promise<{ shareUrl: string; success: boolean }> {
    const response = await this.rpc.call(
      RPC.RPC_SHARE_PROJECT,
      [notebookId, settings],
      notebookId
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    return {
      shareUrl: data?.[0] || data?.shareUrl || '',
      success: data?.[1] === true || data?.success === true,
    };
  }
  
  /**
   * Get project analytics
   * Get analytics/statistics for a project
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const analytics = await client.notebooks.getAnalytics('notebook-id');
   * console.log(`Views: ${analytics.views}`);
   * ```
   */
  async getAnalytics(notebookId: string): Promise<{
    views?: number;
    shares?: number;
    lastAccessed?: Date;
    [key: string]: any;
  }> {
    const response = await this.rpc.call(
      RPC.RPC_GET_PROJECT_ANALYTICS,
      [notebookId],
      notebookId
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    return {
      views: data?.[0] || data?.views,
      shares: data?.[1] || data?.shares,
      lastAccessed: data?.[2] ? new Date(data[2]) : undefined,
      ...data,
    };
  }
  
  /**
   * Submit feedback
   * Submit user feedback for a project
   * 
   * @param notebookId - The notebook ID
   * @param feedback - Feedback content
   * 
   * @example
   * ```typescript
   * await client.notebooks.submitFeedback('notebook-id', {
   *   rating: 5,
   *   comment: 'Great tool!',
   * });
   * ```
   */
  async submitFeedback(notebookId: string, feedback: {
    rating?: number;
    comment?: string;
    category?: string;
  }): Promise<void> {
    await this.rpc.call(
      RPC.RPC_SUBMIT_FEEDBACK,
      [notebookId, feedback],
      notebookId
    );
  }
  
  /**
   * List featured projects
   * List featured/public projects
   * 
   * @example
   * ```typescript
   * const featured = await client.notebooks.listFeatured();
   * console.log(`Found ${featured.length} featured projects`);
   * ```
   */
  async listFeatured(): Promise<Notebook[]> {
    const response = await this.rpc.call(
      RPC.RPC_LIST_FEATURED_PROJECTS,
      []
    );
    
    return this.parseListResponse(response);
  }
  
  // ========================================================================
  // Response parsers
  // ========================================================================
  
  private parseListResponse(response: any): Notebook[] {
    try {
      // Try direct array parsing first
      if (Array.isArray(response)) {
        let projectsData: any[] = [];
        
        // Try to find the projects array
        if (response[0] && Array.isArray(response[0])) {
          projectsData = response[0];
        } else {
          projectsData = response;
        }
        
        const notebooks: Notebook[] = [];
        
        for (const item of projectsData) {
          if (!Array.isArray(item) || item.length < 3) {
            continue;
          }
          
          const notebook: Notebook = {
            projectId: item[2] || '',
            title: item[0] || '',
            emoji: item[3] || '📄',
          };
          
          if (notebook.projectId) {
            notebooks.push(notebook);
          }
        }
        
        if (notebooks.length > 0) {
          return notebooks;
        }
      }
      
      // If array parsing didn't work, try chunked parser
      if (typeof response === 'string') {
        const parser = createChunkedParser(response, false);
        const projects = parser.parseListProjectsResponse();
        return projects.map((p: any) => ({
          projectId: p.projectId || '',
          title: p.title || '',
          emoji: p.emoji || '📄',
        }));
      }
      
      // Convert to string and try chunked parser
      const responseStr = JSON.stringify(response);
      const parser = createChunkedParser(responseStr, false);
      const projects = parser.parseListProjectsResponse();
      return projects.map((p: any) => ({
        projectId: p.projectId || '',
        title: p.title || '',
        emoji: p.emoji || '📄',
      }));
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notebooks list: ${(error as Error).message}`);
    }
  }
  
  private parseGetResponse(response: any, notebookId: string): Notebook {
    try {
      // Handle JSON string response
      let parsedResponse = response;
      if (typeof response === 'string') {
        parsedResponse = JSON.parse(response);
      }
      
      // Handle nested array structure: [[title, null, projectId, ...]]
      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        let data = parsedResponse;
        
        // If first element is an array, it's nested: [[title, null, projectId, ...]]
        if (Array.isArray(parsedResponse[0])) {
          data = parsedResponse[0];
        }
        
        // Extract title (index 0) and emoji (index 1, usually null, so we use default)
        return {
          projectId: notebookId,
          title: data[0] || '',
          emoji: data[1] || '📄',
          sources: [], // Parse sources if included
        };
      }
      
      return {
        projectId: notebookId,
        title: '',
        emoji: '📄',
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notebook data: ${(error as Error).message}`);
    }
  }
  
  private parseCreateResponse(response: any, title: string, emoji: string): Notebook {
    try {
      // Extract project ID from response
      let projectId = '';
      
      // Response might be a JSON string that needs parsing
      let parsedResponse = response;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          // If parsing fails, use original response
          parsedResponse = response;
        }
      }
      
      if (Array.isArray(parsedResponse)) {
        // Response structure: ["title", null, "projectId", ...]
        // Project ID is typically at index 2
        if (parsedResponse.length > 2 && typeof parsedResponse[2] === 'string') {
          projectId = parsedResponse[2];
        } else {
        // Try to find the project ID in the response
        const findId = (data: any): string | null => {
            if (typeof data === 'string' && data.match(/^[a-f0-9-]{36}$/)) {
            return data;
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              const id = findId(item);
              if (id) return id;
            }
          }
          return null;
        };
        
          projectId = findId(parsedResponse) || '';
        }
      }
      
      if (!projectId) {
        throw new Error('Could not extract project ID from response');
      }
      
      return {
        projectId,
        title,
        emoji,
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse created notebook: ${(error as Error).message}`);
    }
  }
}

