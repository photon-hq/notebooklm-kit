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
    
    // Files use o4cbdc RPC with structure: [[[fileName, 13]], notebookId, [2], [1,null,...,[1]]]
    // The number 13 is the file type indicator
    // Note: Files may need to be uploaded via a separate endpoint first, then referenced by filename
    // For now, we'll try using o4cbdc with just the filename
    const response = await this.rpc.call(
      RPC.RPC_UPLOAD_FILE_BY_FILENAME,
      [
        [
          [fileName, 13], // [filename, fileType] where 13 = file upload
        ],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
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
    
    // Use the full URL (not just video ID) - based on RPC examples
    // Structure: [null, null, null, null, null, null, null, [url], null, null, 1]
    const youtubeUrl = this.isYouTubeURL(urlOrId) 
      ? urlOrId
      : `https://www.youtube.com/watch?v=${urlOrId}`;
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            [youtubeUrl], // URL at index 7 as an array
            null,
            null,
            1, // YouTube source type indicator
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
   * // Add Drive file directly with file ID
   * const sourceId = await client.sources.addGoogleDrive('notebook-id', {
   *   fileId: '1a2b3c4d5e6f7g8h9i0j',
   *   mimeType: 'application/vnd.google-apps.document',
   *   title: 'My Document',
   * });
   * 
   * // Add Drive file with just file ID (mimeType will be inferred if not provided)
   * const sourceId = await client.sources.addGoogleDrive('notebook-id', {
   *   fileId: '1a2b3c4d5e6f7g8h9i0j',
   * });
   * ```
   * 
   * **Note:** For finding Drive files, use `searchWeb()` with `sourceType: SearchSourceType.GOOGLE_DRIVE`
   * to search your Drive, then use `addDiscovered()` to add the found files.
   */
  async addGoogleDrive(notebookId: string, options: AddGoogleDriveSourceOptions): Promise<string> {
    const { fileId, mimeType } = options;
    
    // Check quota before adding source
    this.quota?.checkQuota('addSource', notebookId);
    
    // Build request for Google Drive source
    // Format: [fileId, mimeType?, title?]
    // Note: The backend may accept [fileId, mimeType, 1, title] format as well,
    // but the current flexible format works correctly
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
   * **IMPORTANT: This is STEP 1 of a 3-step sequential workflow.**
   * 
   * You must complete the steps in order - you cannot skip to step 2 or 3 without completing step 1 first.
   * 
   * **Complete Workflow (3 steps):**
   * 1. `searchWeb()` → Returns `sessionId` (start here - this method)
   * 2. `getSearchResults()` → Returns discovered sources (requires step 1)
   * 3. `addDiscovered()` → Adds selected sources (requires sessionId from step 1)
   * 
   * **Simplified Alternative:**
   * - Use `searchWebAndWait()` instead - it combines steps 1-2 with automatic polling
   * - Then use `addDiscovered()` to add sources (step 3)
   * 
   * @param notebookId - The notebook ID
   * @param options - Search options
   * @returns sessionId - Required for steps 2 and 3
   * 
   * @example
   * ```typescript
   * // STEP 1: Initiate search (you must start here)
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'AI research',
   *   sourceType: SearchSourceType.WEB,
   *   mode: ResearchMode.FAST,
   * });
   * 
   * // STEP 2: Get results (requires sessionId from step 1)
   * const results = await client.sources.getSearchResults('notebook-id');
   * 
   * // STEP 3: Add selected sources (requires sessionId from step 1)
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: sessionId,
   *   webSources: results.web.slice(0, 5),
   * });
   * ```
   * 
   * @example
   * ```typescript
   * // Deep research (web sources only - DEEP mode not available for Drive)
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'Machine learning',
   *   mode: ResearchMode.DEEP, // Only for WEB sources
   * });
   * 
   * // Google Drive search (FAST mode only)
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'presentation',
   *   sourceType: SearchSourceType.GOOGLE_DRIVE, // FAST mode only
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
   * Get search results (STEP 2 of 3-step workflow)
   * 
   * **REQUIRES:** You must call `searchWeb()` first (step 1) before calling this method.
   * 
   * This method retrieves the search results from a previously initiated search.
   * The search was started by `searchWeb()` in step 1.
   * 
   * **Complete Workflow (3 steps):**
   * 1. `searchWeb()` → Returns `sessionId` (required first step)
   * 2. `getSearchResults()` → Returns discovered sources (this method - step 2)
   * 3. `addDiscovered()` → Adds selected sources (requires sessionId from step 1)
   * 
   * **Note:** If you haven't called `searchWeb()` yet, you'll get empty results.
   * Use `searchWebAndWait()` if you want to combine steps 1-2 automatically.
   * 
   * @param notebookId - The notebook ID (must match the notebookId used in step 1)
   * @returns Discovered sources (web and/or drive)
   * 
   * @example
   * ```typescript
   * // STEP 1: Initiate search first
   * const sessionId = await client.sources.searchWeb('notebook-id', { query: 'AI' });
   * 
   * // STEP 2: Get results (only works after step 1)
   * const results = await client.sources.getSearchResults('notebook-id');
   * console.log(`Found ${results.web.length} web sources and ${results.drive.length} drive sources`);
   * 
   * // STEP 3: Add selected sources
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: sessionId,
   *   webSources: results.web,
   * });
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
   * Add discovered sources from search results (STEP 3 of 3-step workflow)
   * 
   * **REQUIRES:** You must have a `sessionId` from `searchWeb()` (step 1) to use this method.
   * 
   * This is the final step - it adds the selected discovered sources to your notebook.
   * 
   * **Complete Workflow (3 steps):**
   * 1. `searchWeb()` → Returns `sessionId` (required first step)
   * 2. `getSearchResults()` → Returns discovered sources (optional - if you need to filter/select)
   * 3. `addDiscovered()` → Adds selected sources (this method - final step)
   * 
   * **Simplified Alternative:**
   * - Use `searchWebAndWait()` to combine steps 1-2, then use this method for step 3
   * 
   * @param notebookId - The notebook ID
   * @param options - Session ID (from step 1) and sources to add
   * @returns Array of added source IDs
   * 
   * @example
   * ```typescript
   * // Option 1: Complete 3-step workflow
   * const sessionId = await client.sources.searchWeb('notebook-id', {
   *   query: 'AI research',
   *   mode: ResearchMode.DEEP,
   * });
   * const results = await client.sources.getSearchResults('notebook-id');
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: sessionId, // Required: from step 1
   *   webSources: results.web.slice(0, 5), // Add first 5 web sources
   * });
   * 
   * // Option 2: Simplified workflow (recommended)
   * const result = await client.sources.searchWebAndWait('notebook-id', {
   *   query: 'AI research',
   *   mode: ResearchMode.DEEP,
   * });
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId, // From searchWebAndWait
   *   webSources: result.web.slice(0, 5),
   *   driveSources: result.drive.slice(0, 2), // Can also add Drive sources
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
   * - All source types are supported EXCEPT web sources (which come from search)
   * - Optionally waits for all sources to be processed
   * - Use this for adding multiple sources at once instead of individual calls
   * - All sources are added in parallel (server-side)
   * 
   * **Supported Source Types:**
   * - `url` - Regular URLs (via `addFromURL()`)
   * - `text` - Text content (via `addFromText()`)
   * - `file` - File uploads (via `addFromFile()`)
   * - `youtube` - YouTube videos (via `addYouTube()`)
   * - `gdrive` - Google Drive files (via `addGoogleDrive()`)
   * 
   * **NOT Supported:**
   * - Web sources from search - Use `searchWebAndWait()` + `addDiscovered()` instead
   * 
   * @param notebookId - The notebook ID
   * @param options - Batch addition options
   * @returns Array of source IDs for all added sources
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
   *     { type: 'gdrive', fileId: '1a2b3c4d5e6f7g8h9i0j', mimeType: 'application/pdf' },
   *   ],
   * });
   * 
   * // Add and wait for processing
   * const sourceIds = await client.sources.addBatch('notebook-id', {
   *   sources: [
   *     { type: 'url', url: 'https://example.com/article' },
   *     { type: 'text', title: 'Notes', content: 'Content...' },
   *   ],
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
   * Delete a source from a notebook
   * 
   * WORKFLOW USAGE:
   * - Permanently removes a source from the notebook
   * - This action cannot be undone
   * - To delete multiple sources, call this method multiple times
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - The source ID to delete
   * 
   * @example
   * ```typescript
   * // Delete a single source
   * await client.sources.delete('notebook-id', 'source-id-123');
   * 
   * // Delete multiple sources (call multiple times)
   * await client.sources.delete('notebook-id', 'source-id-1');
   * await client.sources.delete('notebook-id', 'source-id-2');
   * await client.sources.delete('notebook-id', 'source-id-3');
   * ```
   */
  async delete(notebookId: string, sourceId: string): Promise<void> {
    // RPC structure: [[["sourceId"]], [2]]
    // The source ID must be triple-nested: [[["sourceId"]]], then [2] as a separate element
    const formattedIds: any[] = [[[sourceId]]];
    formattedIds.push([2]);
    
    await this.rpc.call(
      RPC.RPC_DELETE_SOURCES,
      formattedIds,
      notebookId
    );
  }
  
  /**
   * Update source metadata
   * 
   * WORKFLOW USAGE:
   * - Updates source properties like title, metadata, etc.
   * - This updates the source information, not the content itself
   * - To refresh content, use `refresh()` instead
   * - Returns immediately (no waiting required)
   * 
   * **Common Updates:**
   * - `title` - Change the source title/name
   * - `metadata` - Update custom metadata
   * - Other source properties as defined in the Source interface
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - The source ID to update
   * @param updates - Partial Source object with fields to update
   * 
   * @example
   * ```typescript
   * // Update source title
   * await client.sources.update('notebook-id', 'source-id', {
   *   title: 'Updated Source Title',
   * });
   * 
   * // Update metadata
   * await client.sources.update('notebook-id', 'source-id', {
   *   metadata: {
   *     category: 'research',
   *     priority: 'high',
   *   },
   * });
   * ```
   */
  async update(notebookId: string, sourceId: string, updates: Partial<Source>): Promise<void> {
    // RPC structure: [null, ["sourceId"], [[["title"]]]]
    // Based on mm1.txt: [null, ["cfb47db0-..."], [[["1234"]]]]
    // The title must be triple-nested: [[["title"]]]
    const title = updates.title;
    if (!title) {
      throw new NotebookLMError('Title is required for source update');
    }
    
    const args: any[] = [
      null,
      [sourceId],
      [[[title]]],
    ];
    
    await this.rpc.call(
      RPC.RPC_MUTATE_SOURCE,
      args,
      notebookId
    );
  }
  
  /**
   * Refresh a source (re-fetch and reprocess content)
   * 
   * @deprecated This method is deprecated and may not work correctly. The RPC structure is not fully validated.
   * 
   * WORKFLOW USAGE:
   * - Re-fetches source content from the original URL/file
   * - Useful when the source content has been updated externally
   * - Returns immediately after refresh is queued
   * - Use `pollProcessing()` to check when refresh is complete
   * - Processing status will show as "processing" until refresh completes
   * 
   * **When to use:**
   * - Source URL content has been updated
   * - Google Drive file has been modified
   * - You want to ensure source content is up-to-date
   * - Use `checkFreshness()` first to see if refresh is needed
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - The source ID to refresh
   * 
   * @example
   * ```typescript
   * // Check if refresh is needed first (optional)
   * const freshness = await client.sources.checkFreshness('source-id');
   * if (!freshness.isFresh) {
   *   // Refresh the source
   *   await client.sources.refresh('notebook-id', 'source-id');
   *   
   *   // Wait for refresh to complete
   *   let status;
   *   do {
   *     status = await client.sources.pollProcessing('notebook-id');
   *     await new Promise(r => setTimeout(r, 2000));
   *   } while (!status.allReady);
   * }
   * ```
   */
  async refresh(notebookId: string, sourceId: string): Promise<void> {
    console.warn('⚠️  sources.refresh() is deprecated and may not work correctly. The RPC structure is not fully validated.');
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
   * Add deep research report as a source
   * 
   * WORKFLOW USAGE:
   * - Creates an AI-generated deep research report on a topic and adds it as a source
   * - Monthly quota limit: 10 reports per month
   * - Returns immediately after research is queued
   * - Use `pollProcessing()` to check when the research report is ready
   * - Once ready, the report appears as a source in your notebook
   * 
   * **Important Notes:**
   * - This is DIFFERENT from `searchWeb()` with `ResearchMode.DEEP`
   *   - `searchWeb(..., mode: ResearchMode.DEEP)` - Searches web and finds relevant sources
   *   - `addDeepResearch()` - Creates a complete research report as a source itself
   * - Monthly limit: 10 reports per month (enforced by quota system)
   * - The generated report becomes a source that can be used for chat, artifacts, etc.
   * - Processing can take several minutes for comprehensive research
   * 
   * **Use Cases:**
   * - Need a comprehensive research report on a complex topic
   * - Want AI-generated analysis compiled into a single source
   * - Starting research on a new domain and need foundational content
   * 
   * @param notebookId - The notebook ID
   * @param query - Research query/question (what you want researched)
   * @returns Source ID of the generated research report
   * 
   * @example
   * ```typescript
   * // Create a deep research report
   * const sourceId = await client.sources.addDeepResearch('notebook-id', 
   *   'Latest developments in quantum computing and their applications'
   * );
   * 
   * // Wait for research report to be ready
   * let status;
   * do {
   *   status = await client.sources.pollProcessing('notebook-id');
   *   if (!status.allReady) {
   *     console.log('Research report still being generated...');
   *     await new Promise(r => setTimeout(r, 5000)); // Wait 5s between checks
   *   }
   * } while (!status.allReady);
   * 
   * console.log(`Research report ready! Source ID: ${sourceId}`);
   * ```
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
      // Handle JSON string responses (common in batch operations)
      let parsedResponse = response;
      if (typeof response === 'string' && (response.startsWith('[') || response.startsWith('{'))) {
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          // If parsing fails, continue with original response
        }
      }
      
      // Try different response formats
      const findId = (data: any, depth: number = 0): string | null => {
        if (depth > 5) return null; // Prevent infinite recursion
        
        // Check if this is a UUID string
        if (typeof data === 'string' && data.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          return data;
        }
        
        // Check if this is a JSON string containing arrays/objects
        if (typeof data === 'string' && (data.startsWith('[') || data.startsWith('{'))) {
          try {
            const parsed = JSON.parse(data);
            const id = findId(parsed, depth + 1);
            if (id) return id;
          } catch {
            // Continue searching
          }
        }
        
        if (Array.isArray(data)) {
          for (const item of data) {
            const id = findId(item, depth + 1);
            if (id) return id;
          }
        }
        
        if (data && typeof data === 'object') {
          for (const key in data) {
            const id = findId(data[key], depth + 1);
            if (id) return id;
          }
        }
        
        return null;
      };
      
      const sourceId = findId(parsedResponse);
      
      if (!sourceId) {
        throw new Error('Could not extract source ID from response');
      }
      
      return sourceId;
    } catch (error) {
      throw new NotebookLMError(`Failed to extract source ID: ${(error as Error).message}`);
    }
  }
}
