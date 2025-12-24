/**
 * Sources service
 * Handles source operations (add URLs, files, text, Google Drive, YouTube, etc.)
 * 
 * WORKFLOW USAGE NOTES:
 * - Individual add methods (addFromURL, addFromText, etc.) return immediately after source is queued
 * - Use pollProcessing() to check if sources are ready, or use workflow functions that handle waiting
 * - For web search: Use searchWebAndWait() to get results, then addDiscovered() to add them
 * - For batch operations: Use addBatch() to add multiple sources efficiently
 * - All add methods check quota before adding and record usage after success
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type {
  Source,
  AddSourceFromURLOptions,
  AddSourceFromTextOptions,
  AddSourceFromFileOptions,
  SourceProcessingStatus,
  SourceContent,
  SourceFreshness,
  DiscoveredWebSource,
  DiscoveredDriveSource,
  SearchWebSourcesOptions,
  AddDiscoveredSourcesOptions,
  AddGoogleDriveSourceOptions,
  AddYouTubeSourceOptions,
  BatchAddSourcesOptions,
  SearchWebAndWaitOptions,
  WebSearchResult,
} from '../types/source.js';
import { ResearchMode, SearchSourceType } from '../types/source.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Service for source operations
 */
export class SourcesService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  // ========================================================================
  // Individual Source Addition Methods
  // ========================================================================
  
  /**
   * Add a source from URL
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued (does not wait for processing)
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions like addSourceAndWait() that handle waiting automatically
   * - Automatically detects YouTube URLs and routes to addYouTube()
   * 
   * @param notebookId - The notebook ID
   * @param options - URL and optional title
   * 
   * @example
   * ```typescript
   * // Add a regular URL
   * const sourceId = await client.sources.addFromURL('notebook-id', {
   *   url: 'https://example.com/article',
   * });
   * 
   * // Check if ready (manual polling)
   * let status;
   * do {
   *   status = await client.sources.pollProcessing('notebook-id');
   *   await new Promise(r => setTimeout(r, 2000));
   * } while (!status.allReady);
   * ```
   */
  async addFromURL(notebookId: string, options: AddSourceFromURLOptions): Promise<string> {
    const { url } = options;
    
    // Check quota before adding source
    this.quota?.checkQuota('addSource', notebookId);
    
    // Check if it's a YouTube URL
    if (this.isYouTubeURL(url)) {
      return this.addYouTube(notebookId, { urlOrId: url });
    }
    
    // Regular URL
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            null,
            [url],
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    // Record usage after successful addition
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }
  
  /**
   * Add a source from text (copied text)
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * 
   * @param notebookId - The notebook ID
   * @param options - Text content and title
   * 
   * @example
   * ```typescript
   * const sourceId = await client.sources.addFromText('notebook-id', {
   *   title: 'My Notes',
   *   content: 'This is my research content...',
   * });
   * ```
   */
  async addFromText(notebookId: string, options: AddSourceFromTextOptions): Promise<string> {
    const { title, content } = options;
    
    // Validate text length
    this.quota?.validateTextSource(content);
    
    // Check quota before adding source
    this.quota?.checkQuota('addSource', notebookId);
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            [title, content],
            null,
            2, // text source type
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    // Record usage after successful addition
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }
  
  /**
   * Add a source from uploaded file
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after file is uploaded and queued
   * - File processing may take longer than URLs/text
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * 
   * @param notebookId - The notebook ID
   * @param options - File content, name, and MIME type
   * 
   * @example
   * ```typescript
   * // From Buffer (Node.js)
   * const fileBuffer = await fs.readFile('document.pdf');
   * const sourceId = await client.sources.addFromFile('notebook-id', {
   *   content: fileBuffer,
   *   fileName: 'document.pdf',
   *   mimeType: 'application/pdf',
   * });
   * 
   * // From base64 string
   * const sourceId = await client.sources.addFromFile('notebook-id', {
   *   content: base64String,
   *   fileName: 'document.pdf',
   * });
   * ```
   */
  async addFromFile(notebookId: string, options: AddSourceFromFileOptions): Promise<string> {
    const { content, fileName, mimeType = 'application/octet-stream' } = options;
    
    // Validate file size and check quota
    let sizeBytes: number;
    let base64Content: string;
    
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
      sizeBytes = content.length;
      base64Content = content.toString('base64');
    } else if (typeof content === 'string') {
      // Already base64
      base64Content = content;
      // Estimate size from base64 (base64 is ~33% larger than binary)
      sizeBytes = Math.floor((content.length * 3) / 4);
    } else {
      throw new NotebookLMError('Invalid content type for file');
    }
    
    this.quota?.validateFileSize(sizeBytes);
    this.quota?.checkQuota('addSource', notebookId);
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            base64Content,
            fileName,
            mimeType,
            'base64',
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    // Record usage after successful addition
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }
  
  /**
   * Add a YouTube video source
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued
   * - YouTube videos may take longer to process than URLs/text
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * 
   * @param notebookId - The notebook ID
   * @param options - YouTube URL or video ID
   * 
   * @example
   * ```typescript
   * // From YouTube URL
   * const sourceId = await client.sources.addYouTube('notebook-id', {
   *   urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
   * });
   * 
   * // From video ID
   * const sourceId = await client.sources.addYouTube('notebook-id', {
   *   urlOrId: 'dQw4w9WgXcQ',
   * });
   * ```
   */
  async addYouTube(notebookId: string, options: AddYouTubeSourceOptions): Promise<string> {
    const { urlOrId } = options;
    
    // Check quota before adding source
    this.quota?.checkQuota('addSource', notebookId);
    
    // Extract video ID if URL provided
    const videoId = this.isYouTubeURL(urlOrId) 
      ? this.extractYouTubeVideoId(urlOrId)
      : urlOrId;
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            null,
            videoId,
            null,
            4, // YouTube source type
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    // Record usage after successful addition
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }
  
  /**
   * Add a Google Drive source directly (by file ID)
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * - For searching Drive files first, use searchWeb() with sourceType: GOOGLE_DRIVE
   * 
   * @param notebookId - The notebook ID
   * @param options - Google Drive file ID and optional metadata
   * 
   * @example
   * ```typescript
   * // Add Drive file directly
   * const sourceId = await client.sources.addGoogleDrive('notebook-id', {
   *   fileId: '1a2b3c4d5e6f7g8h9i0j',
   *   title: 'My Document',
   * });
   * ```
   */
  async addGoogleDrive(notebookId: string, options: AddGoogleDriveSourceOptions): Promise<string> {
    const { fileId, mimeType } = options;
    
    // Check quota before adding source
    this.quota?.checkQuota('addSource', notebookId);
    
    // Build request for Google Drive source
    // Format: [fileId, mimeType?, title?]
    const driveArgs: any[] = [fileId];
    if (mimeType) {
      driveArgs.push(mimeType);
    }
    if (options.title) {
      driveArgs.push(options.title);
    }
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            null,
            null,
            driveArgs,
            5, // Google Drive source type
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    // Record usage after successful addition
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }
  
  // ========================================================================
  // Web Search & Discovery Methods
  // ========================================================================
  
  /**
   * Search web sources (initiate search, returns sessionId)
   * 
   * WORKFLOW USAGE - Part 1 of 2:
   * 1. Call searchWeb() to initiate search → get sessionId
   * 2. Call getSearchResults() to get discovered sources
   * 3. Call addDiscovered() with sessionId to add selected sources
   * 
   * OR use searchWebAndWait() for a complete workflow that waits for results
   * 
   * @param notebookId - The notebook ID
   * @param options - Search options
   * 
   * @example
   * ```typescript
   * // Fast web search
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'AI research',
   *   sourceType: SearchSourceType.WEB,
   *   mode: ResearchMode.FAST,
   * });
   * 
   * // Deep research (web only)
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'Machine learning',
   *   mode: ResearchMode.DEEP,
   * });
   * 
   * // Google Drive search
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'presentation',
   *   sourceType: SearchSourceType.GOOGLE_DRIVE,
   * });
   * ```
   */
  async searchWeb(notebookId: string, options: SearchWebSourcesOptions): Promise<string> {
    const {
      query,
      sourceType = SearchSourceType.WEB,
      mode = ResearchMode.FAST,
    } = options;
    
    // Validate: Deep research only works for web sources
    if (mode === ResearchMode.DEEP && sourceType !== SearchSourceType.WEB) {
      throw new NotebookLMError('Deep research mode is only available for web sources');
    }
    
    // Validate: Drive only supports fast mode
    if (sourceType === SearchSourceType.GOOGLE_DRIVE && mode !== ResearchMode.FAST) {
      throw new NotebookLMError('Google Drive search only supports fast research mode');
    }
    
    const response = await this.rpc.call(
      RPC.RPC_SEARCH_WEB_SOURCES,
      [
        [query, sourceType], // [query, source_type]
        null,                // null
        mode,                // research_mode: 1=Fast, 2=Deep
        notebookId,
      ],
      notebookId
    );
    
    // Extract session ID from response
    const data = Array.isArray(response) ? response[0] : response;
    return data?.[0] || data?.sessionId || data?.searchId || '';
  }
  
  /**
   * Search web sources and wait for results (complete workflow)
   * 
   * WORKFLOW USAGE:
   * - This is a complete workflow that combines searchWeb() + getSearchResults() with polling
   * - Returns results once they're available (or timeout)
   * - Use the returned sessionId with addDiscovered() to add sources
   * - This is the recommended method for web search workflows
   * 
   * @param notebookId - The notebook ID
   * @param options - Search options with waiting configuration
   * 
   * @example
   * ```typescript
   * // Search and wait for results
   * const result = await client.sources.searchWebAndWait('notebook-id', {
   *   query: 'AI research',
   *   mode: ResearchMode.DEEP,
   *   timeout: 60000, // Wait up to 60 seconds
   *   onProgress: (status) => {
   *     console.log(`Has results: ${status.hasResults}, Count: ${status.resultCount}`);
   *   },
   * });
   * 
   * // Then add selected sources
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId,
   *   webSources: result.web.slice(0, 5), // Add first 5
   * });
   * ```
   */
  async searchWebAndWait(notebookId: string, options: SearchWebAndWaitOptions): Promise<WebSearchResult> {
    const {
      timeout = 30000,
      pollInterval = 2000,
      onProgress,
      ...searchOptions
    } = options;
    
    // Step 1: Initiate search
    const sessionId = await this.searchWeb(notebookId, searchOptions);
    
    if (!sessionId) {
      throw new NotebookLMError('Failed to initiate search - no sessionId returned');
    }
    
    // Step 2: Poll for results
    const startTime = Date.now();
    let results: { web: DiscoveredWebSource[]; drive: DiscoveredDriveSource[] } = { web: [], drive: [] };
    
    while (Date.now() - startTime < timeout) {
      results = await this.getSearchResults(notebookId);
      
      const hasResults = results.web.length > 0 || results.drive.length > 0;
      const resultCount = results.web.length + results.drive.length;
      
      if (onProgress) {
        onProgress({ hasResults, resultCount });
      }
      
      if (hasResults) {
        return { sessionId, ...results };
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout reached - return whatever we have
    return { sessionId, ...results };
  }
  
  /**
   * Get search results (use after searchWeb)
   * 
   * WORKFLOW USAGE - Part 2 of 3:
   * 1. searchWeb() → get sessionId
   * 2. getSearchResults() → get discovered sources (this method)
   * 3. addDiscovered() → add selected sources
   * 
   * OR use searchWebAndWait() which combines steps 1-2
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const sessionId = await client.sources.searchWeb('notebook-id', { query: 'AI' });
   * const results = await client.sources.getSearchResults('notebook-id');
   * console.log(`Found ${results.web.length} web sources and ${results.drive.length} drive sources`);
   * ```
   */
  async getSearchResults(notebookId: string): Promise<{
    web: DiscoveredWebSource[];
    drive: DiscoveredDriveSource[];
  }> {
    const response = await this.rpc.call(
      RPC.RPC_GET_SEARCH_RESULTS,
      [null, null, notebookId],
      notebookId
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    const sources = data?.[0] || [];
    
    if (!Array.isArray(sources)) {
      return { web: [], drive: [] };
    }
    
    const web: DiscoveredWebSource[] = [];
    const drive: DiscoveredDriveSource[] = [];
    
    for (const source of sources) {
      if (Array.isArray(source)) {
        const sourceType = source[1] || source[2];
        
        if (sourceType === SearchSourceType.WEB || sourceType === 1) {
          web.push({
            url: (source[0] as string) || '',
            title: (source[1] as string) || (source[2] as string) || '',
            id: (source[3] as string),
          });
        } else if (sourceType === SearchSourceType.GOOGLE_DRIVE || sourceType === 5) {
          drive.push({
            fileId: (source[0] as string) || '',
            mimeType: (source[1] as string) || '',
            title: (source[2] as string) || '',
            id: (source[3] as string),
          });
        }
      } else if (typeof source === 'object') {
        if (source.url) {
          web.push({
            url: source.url,
            title: source.title || '',
            id: source.id,
          });
        } else if (source.fileId) {
          drive.push({
            fileId: source.fileId,
            mimeType: source.mimeType || '',
            title: source.title || '',
            id: source.id,
          });
        }
      }
    }
    
    return { web, drive };
  }
  
  /**
   * Add discovered sources from search results
   * 
   * WORKFLOW USAGE - Part 3 of 3:
   * 1. searchWeb() → get sessionId
   * 2. getSearchResults() → get discovered sources
   * 3. addDiscovered() → add selected sources (this method)
   * 
   * OR use searchWebAndWait() + addDiscovered() for a simpler workflow
   * 
   * @param notebookId - The notebook ID
   * @param options - Session ID and sources to add
   * 
   * @example
   * ```typescript
   * const result = await client.sources.searchWebAndWait('notebook-id', {
   *   query: 'AI research',
   *   mode: ResearchMode.DEEP,
   * });
   * 
   * // Add selected web sources
   * const added = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId,
   *   webSources: result.web.slice(0, 3), // Add first 3 web sources
   * });
   * ```
   */
  async addDiscovered(notebookId: string, options: AddDiscoveredSourcesOptions): Promise<string[]> {
    const { sessionId, webSources = [], driveSources = [] } = options;
    
    // Check quota before adding sources
    const totalSources = webSources.length + driveSources.length;
    for (let i = 0; i < totalSources; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    // Build request arguments
    const webArgs = webSources.map(src => [src.url, src.title]);
    const driveArgs = driveSources.map(src => [src.fileId, src.mimeType, src.title]);
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_DISCOVERED_SOURCES,
      [
        notebookId,
        sessionId,
        webArgs.length > 0 ? webArgs : null,
        driveArgs.length > 0 ? driveArgs : null,
      ],
      notebookId
    );
    
    const addedIds: string[] = [];
    const data = Array.isArray(response) ? response[0] : response;
    const sources = data?.[0] || [];
    
    if (Array.isArray(sources)) {
      for (const source of sources) {
        const sourceId = source?.[0] || source?.id || '';
        if (sourceId) {
          addedIds.push(sourceId);
          this.quota?.recordUsage('addSource', notebookId);
        }
      }
    }
    
    return addedIds;
  }
  
  // ========================================================================
  // Batch Operations
  // ========================================================================
  
  /**
   * Add multiple sources in batch
   * 
   * WORKFLOW USAGE:
   * - Efficiently adds multiple sources of different types in one call
   * - Optionally waits for all sources to be processed
   * - Use this for adding multiple sources at once instead of individual calls
   * - All sources are added in parallel (server-side)
   * 
   * @param notebookId - The notebook ID
   * @param options - Batch addition options
   * 
   * @example
   * ```typescript
   * // Add multiple sources without waiting
   * const sourceIds = await client.sources.addBatch('notebook-id', {
   *   sources: [
   *     { type: 'url', url: 'https://example.com/article1' },
   *     { type: 'url', url: 'https://example.com/article2' },
   *     { type: 'text', title: 'Notes', content: 'My research notes...' },
   *     { type: 'youtube', urlOrId: 'https://youtube.com/watch?v=...' },
   *   ],
   * });
   * 
   * // Add and wait for processing
   * const sourceIds = await client.sources.addBatch('notebook-id', {
   *   sources: [...],
   *   waitForProcessing: true,
   *   timeout: 300000, // 5 minutes
   *   onProgress: (ready, total) => {
   *     console.log(`${ready}/${total} sources ready`);
   *   },
   * });
   * ```
   */
  async addBatch(notebookId: string, options: BatchAddSourcesOptions): Promise<string[]> {
    const {
      sources,
      waitForProcessing = false,
      timeout = 300000,
      pollInterval = 2000,
      onProgress,
    } = options;
    
    if (sources.length === 0) {
      return [];
    }
    
    // Check quota for all sources
    for (let i = 0; i < sources.length; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    // Add all sources
    const addPromises = sources.map(source => {
      switch (source.type) {
        case 'url':
          return this.addFromURL(notebookId, { url: source.url, title: source.title });
        case 'text':
          return this.addFromText(notebookId, { title: source.title, content: source.content });
        case 'file':
          return this.addFromFile(notebookId, {
            content: source.content,
            fileName: source.fileName,
            mimeType: source.mimeType,
          });
        case 'youtube':
          return this.addYouTube(notebookId, { urlOrId: source.urlOrId, title: source.title });
        case 'gdrive':
          return this.addGoogleDrive(notebookId, {
            fileId: source.fileId,
            title: source.title,
            mimeType: source.mimeType,
          });
        default:
          throw new NotebookLMError(`Unsupported source type: ${(source as any).type}`);
      }
    });
    
    const sourceIds = await Promise.all(addPromises);
    
    // Wait for processing if requested
    if (waitForProcessing) {
      const startTime = Date.now();
      const total = sourceIds.length;
      
      while (Date.now() - startTime < timeout) {
        const status = await this.pollProcessing(notebookId);
        
        if (onProgress) {
          const ready = total - status.processing.length;
          onProgress(ready, total);
        }
        
        if (status.allReady) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    return sourceIds;
  }
  
  // ========================================================================
  // Source Management Methods
  // ========================================================================
  
  /**
   * Delete sources
   * 
   * @param notebookId - The notebook ID
   * @param sourceIds - Source IDs to delete
   */
  async delete(notebookId: string, sourceIds: string | string[]): Promise<void> {
    const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
    
    await this.rpc.call(
      RPC.RPC_DELETE_SOURCES,
      [ids],
      notebookId
    );
  }
  
  /**
   * Update source metadata
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - The source ID
   * @param updates - Updates to apply
   */
  async update(notebookId: string, sourceId: string, updates: Partial<Source>): Promise<void> {
    await this.rpc.call(
      RPC.RPC_MUTATE_SOURCE,
      [sourceId, updates],
      notebookId
    );
  }
  
  /**
   * Refresh a source (re-fetch content)
   * 
   * WORKFLOW USAGE:
   * - Use this to update source content if the original URL has changed
   * - Returns immediately, use pollProcessing() to check if refresh is complete
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - The source ID
   */
  async refresh(notebookId: string, sourceId: string): Promise<void> {
    await this.rpc.call(
      RPC.RPC_REFRESH_SOURCE,
      [sourceId],
      notebookId
    );
  }
  
  /**
   * Poll source processing status
   * 
   * WORKFLOW USAGE:
   * - Call this repeatedly to check if sources are ready
   * - Use in loops with setTimeout for manual polling
   * - Or use workflow functions that handle polling automatically
   * - This is a single check - does not wait or retry
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * // Manual polling
   * let status;
   * do {
   *   status = await client.sources.pollProcessing('notebook-id');
   *   if (!status.allReady) {
   *     await new Promise(r => setTimeout(r, 2000)); // Wait 2s
   *   }
   * } while (!status.allReady);
   * ```
   */
  async pollProcessing(notebookId: string): Promise<SourceProcessingStatus> {
    const response = await this.rpc.call(
      RPC.RPC_POLL_SOURCE_PROCESSING,
      [notebookId, null, [2], null, 1],
      notebookId
    );
    
    // Parse response to extract processing status
    const data = Array.isArray(response) ? response[0] : response;
    const sources = data?.[0] || [];
    
    const processing: string[] = [];
    let allReady = true;
    
    if (Array.isArray(sources)) {
      for (const source of sources) {
        if (source && typeof source === 'object') {
          const sourceId = source[0] || source.id || '';
          const status = source[1] || source.status || 0;
          
          if (status !== 2) { // 2 = ready
            allReady = false;
            if (sourceId) processing.push(sourceId);
          }
        }
      }
    }
    
    return { allReady, processing };
  }
  
  /**
   * Select/prepare source for viewing
   * 
   * WORKFLOW USAGE:
   * - REQUIRED: Must call this before loadContent() for reliable content loading
   * - NotebookLM requires sources to be selected before they can be loaded
   * - Use in sequence: selectSource() → loadContent()
   * 
   * @param sourceId - The source ID
   * 
   * @example
   * ```typescript
   * // REQUIRED: select first, then load
   * await client.sources.selectSource('source-id');
   * const content = await client.sources.loadContent('source-id');
   * console.log(content.text);
   * ```
   */
  async selectSource(sourceId: string): Promise<void> {
    await this.rpc.call(
      RPC.RPC_LOAD_SOURCE,
      [[sourceId], [2], [2]]
    );
  }
  
  /**
   * Load source content
   * 
   * WORKFLOW USAGE:
   * - REQUIRED: Must call selectSource() first before calling this method
   * - Returns full text content of the source
   * - Use this to read source content after it's ready
   * 
   * @param sourceId - The source ID
   * 
   * @example
   * ```typescript
   * // REQUIRED: select first, then load
   * await client.sources.selectSource('source-id');
   * const content = await client.sources.loadContent('source-id');
   * console.log(content.text);
   * ```
   */
  async loadContent(sourceId: string): Promise<SourceContent> {
    const response = await this.rpc.call(
      RPC.RPC_LOAD_SOURCE_CONTENT,
      [[[sourceId]]]
    );
    
    // Parse response - extract text content
    const data = Array.isArray(response) ? response[0] : response;
    const text = data?.[0]?.[0]?.[0] || data?.text || '';
    const metadata = data?.[0]?.[0]?.[1] || data?.metadata;
    
    return { text, metadata };
  }
  
  /**
   * Check source freshness
   * 
   * WORKFLOW USAGE:
   * - Use this to check if source content is up-to-date
   * - Can be used before refresh() to determine if refresh is needed
   * 
   * @param sourceId - The source ID
   */
  async checkFreshness(sourceId: string): Promise<SourceFreshness> {
    const response = await this.rpc.call(
      RPC.RPC_CHECK_SOURCE_FRESHNESS,
      [sourceId]
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    const isFresh = data?.[0] === true || data?.isFresh === true;
    const lastChecked = data?.[1] ? new Date(data[1]) : undefined;
    
    return { isFresh, lastChecked };
  }
  
  /**
   * Add deep research report
   * 
   * WORKFLOW USAGE:
   * - Creates a deep research report as a source (monthly limit: 10)
   * - Returns immediately, use pollProcessing() to check if ready
   * - This is different from searchWeb() with DEEP mode
   * 
   * @param notebookId - The notebook ID
   * @param query - Research query
   */
  async addDeepResearch(notebookId: string, query: string): Promise<string> {
    // Check monthly quota
    this.quota?.checkQuota('deepResearch');
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_DEEP_RESEARCH_REPORT,
      [notebookId, query],
      notebookId
    );
    
    const data = Array.isArray(response) ? response[0] : response;
    const sourceId = data?.[0] || data?.sourceId || '';
    
    // Record usage after successful creation
    if (sourceId) {
      this.quota?.recordUsage('deepResearch');
    }
    
    return sourceId;
  }
  
  /**
   * Act on multiple sources (bulk action)
   * 
   * WORKFLOW USAGE:
   * - Use this for bulk operations on multiple sources
   * - Different from update() which works on a single source
   * - Supports various AI-powered content transformation actions
   * 
   * @param notebookId - The notebook ID
   * @param action - Action to perform (see supported actions below)
   * @param sourceIds - Array of source IDs to act on
   * 
   * @example
   * ```typescript
   * // Rephrase content from multiple sources
   * await client.sources.actOn('notebook-id', 'rephrase', ['source-1', 'source-2']);
   * 
   * // Generate study guide from sources
   * await client.sources.actOn('notebook-id', 'study_guide', ['source-1']);
   * 
   * // Create interactive mindmap
   * await client.sources.actOn('notebook-id', 'interactive_mindmap', ['source-1', 'source-2']);
   * ```
   * 
   * **Supported Actions:**
   * - `rephrase` - Rephrase content from sources
   * - `expand` - Expand content from sources
   * - `summarize` - Summarize content from sources
   * - `critique` - Critique content from sources
   * - `brainstorm` - Brainstorm ideas from sources
   * - `verify` - Verify information from sources
   * - `explain` - Explain concepts from sources
   * - `outline` - Create outline from sources
   * - `study_guide` - Generate study guide from sources
   * - `faq` - Generate FAQ from sources
   * - `briefing_doc` - Create briefing document from sources
   * - `interactive_mindmap` - Generate interactive mindmap from sources
   * - `timeline` - Create timeline from sources
   * - `table_of_contents` - Generate table of contents from sources
   */
  async actOn(notebookId: string, action: string, sourceIds: string[]): Promise<void> {
    if (sourceIds.length === 0) {
      throw new NotebookLMError('At least one source ID is required');
    }
    
    await this.rpc.call(
      RPC.RPC_ACT_ON_SOURCES,
      [notebookId, action, sourceIds],
      notebookId
    );
  }
  
  // ========================================================================
  // Helper methods
  // ========================================================================
  
  private isYouTubeURL(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }
  
  private extractYouTubeVideoId(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // youtu.be format
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.substring(1);
      }
      
      // youtube.com/watch format
      if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;
      }
      
      throw new Error('Unsupported YouTube URL format');
    } catch (error) {
      throw new NotebookLMError(`Invalid YouTube URL: ${(error as Error).message}`);
    }
  }
  
  private extractSourceId(response: any): string {
    try {
      // Try different response formats
      const findId = (data: any, depth: number = 0): string | null => {
        if (depth > 5) return null; // Prevent infinite recursion
        
        if (typeof data === 'string' && data.match(/^[a-f0-9-]+$/)) {
          return data;
        }
        
        if (Array.isArray(data)) {
          for (const item of data) {
            const id = findId(item, depth + 1);
            if (id) return id;
          }
        }
        
        return null;
      };
      
      const sourceId = findId(response);
      
      if (!sourceId) {
        throw new Error('Could not extract source ID from response');
      }
      
      return sourceId;
    } catch (error) {
      throw new NotebookLMError(`Failed to extract source ID: ${(error as Error).message}`);
    }
  }
}
