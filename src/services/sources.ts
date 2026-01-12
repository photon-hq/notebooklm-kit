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
  AddSourceResult,
  SourceChunk,
} from '../types/source.js';
import { ResearchMode, SearchSourceType, SourceType, SourceStatus } from '../types/source.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Web search sub-service for sources
 * Handles web search operations (search, wait, get results, add discovered)
 */
export class WebSearchService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}

  /**
   * Search web sources (STEP 1 of multi-step workflow)
   * 
   * **Use this for multi-step workflows where you want to see results before deciding next steps.**
   * 
   * **Multi-Step Workflow (for user decision-making):**
   * 1. `search()` → Returns `sessionId` (start here - this method)
   *    - Shows you the search has started
   *    - Returns immediately with sessionId
   * 2. `getResults(sessionId)` → Returns discovered sources (you can validate/filter)
   *    - Shows you what was found
   *    - You can inspect, filter, or select which sources to add
   * 3. `addDiscovered(sessionId, selectedSources)` → Adds your selected sources
   *    - You decide which sources from step 2 to actually add
   * 
   * **Simple Alternative (RECOMMENDED for automated workflows):**
   * - Use `searchAndWait()` instead - one call, returns all results for validation
   * - Then use `addDiscovered()` to add selected sources
   * 
   * **Customization Options:**
   * - `mode: ResearchMode.FAST` - Quick search (default)
   * - `mode: ResearchMode.DEEP` - Comprehensive research (web only)
   * - `sourceType: SearchSourceType.WEB` - Search web (default)
   * - `sourceType: SearchSourceType.GOOGLE_DRIVE` - Search Google Drive (FAST mode only)
   * 
   * @param notebookId - The notebook ID
   * @param options - Search options (query, mode, sourceType)
   * @returns sessionId - Required for steps 2 and 3
   * 
   * @example
   * ```typescript
   * // Multi-step: Start search, then check results later
   * const sessionId = await client.sources.add.web.search('notebook-id', {
   *   query: 'AI research',
   *   mode: ResearchMode.DEEP,
   * });
   * 
   * // Later... check what was found
   * const results = await client.sources.add.web.getResults('notebook-id', sessionId);
   * console.log(`Found ${results.web.length} sources`);
   * 
   * // User decides which ones to add
   * const selected = results.web.filter(s => s.url.includes('arxiv.org'));
   * await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId,
   *   webSources: selected,
   * });
   * ```
   */
  async search(notebookId: string, options: SearchWebSourcesOptions): Promise<string> {
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
    
    // RPC structure from curl: [["query", sourceType], null, researchMode, notebookId]
    const response = await this.rpc.call(
      RPC.RPC_SEARCH_WEB_SOURCES,
      [
        [query, sourceType],
        null,
        mode,
        notebookId,
      ],
      notebookId
    );
    
    // Extract session ID from response
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use response as-is
      }
    }
    
    // Handle different response formats
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'string') {
        return data[0];
      }
      if (data.length > 0 && Array.isArray(data[0]) && data[0].length > 0) {
        return data[0][0];
      }
    }
    
    return data?.sessionId || data?.searchId || (typeof data === 'string' ? data : '');
  }

  /**
   * Search web sources and wait for results (SIMPLE - one call, returns results for validation)
   * 
   * **RECOMMENDED FOR SIMPLE WORKFLOWS** - One call, returns all results you can validate.
   * 
   * **What it does:**
   * - Starts search, waits for results automatically
   * - Returns all discovered sources once available (or timeout)
   * - Returns results + sessionId for validation
   * - No user decision needed during search - just wait and get results
   * 
   * **Simple Workflow:**
   * 1. `searchAndWait()` → Returns results + sessionId (this method - validates results)
   * 2. `addDiscovered(sessionId, selectedSources)` → Add your selected sources
   * 
   * **Customization Options:**
   * - `mode: ResearchMode.FAST` - Quick search (default, ~10-30 seconds)
   * - `mode: ResearchMode.DEEP` - Comprehensive research (web only, ~60-120 seconds)
   * - `sourceType: SearchSourceType.WEB` - Search web (default)
   * - `sourceType: SearchSourceType.GOOGLE_DRIVE` - Search Google Drive (FAST mode only)
   * - `timeout` - Max wait time (default: 60000ms = 60 seconds)
   * - `pollInterval` - How often to check for results (default: 2000ms = 2 seconds)
   * - `onProgress` - Callback to track progress
   * 
   * **When to use:**
   * - Automated workflows where you don't need to see intermediate steps
   * - Simple cases where you just want to search and get results
   * - When you want to validate all results before deciding which to add
   * 
   * **When NOT to use:**
   * - If you need to see results as they come in (use `search()` + `getResults()` instead)
   * - If you want to make decisions during the search process
   * 
   * @param notebookId - The notebook ID
   * @param options - Search options with waiting configuration
   * @returns WebSearchResult with sessionId, web sources, and drive sources
   * 
   * @example
   * ```typescript
   * // Simple: Search and get all results for validation
   * const result = await client.sources.add.web.searchAndWait('notebook-id', {
   *   query: 'quantum computing research',
   *   mode: ResearchMode.DEEP,  // Comprehensive search
   *   timeout: 120000,  // Wait up to 2 minutes
   *   onProgress: (status) => {
   *     console.log(`Found ${status.resultCount} results so far...`);
   *   },
   * });
   * 
   * // Validate results
   * console.log(`Found ${result.web.length} web sources`);
   * console.log(`Found ${result.drive.length} drive sources`);
   * 
   * // User decides which to add (or add all)
   * const topSources = result.web.slice(0, 10);  // Top 10
   * await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId,  // Required!
   *   webSources: topSources,
   * });
   * ```
   */
  async searchAndWait(notebookId: string, options: SearchWebAndWaitOptions): Promise<WebSearchResult> {
    const {
      query,
      sourceType = SearchSourceType.WEB,
      mode = ResearchMode.FAST,
      timeout = 60000,
      pollInterval = 2000,
      onProgress,
    } = options;
    
    // Step 1: Initiate search
    const sessionId = await this.search(notebookId, { query, sourceType, mode });
    
    // Step 2: Poll for results
    const startTime = Date.now();
    let lastResultCount = 0;
    
    while (Date.now() - startTime < timeout) {
      const results = await this.getResults(notebookId, sessionId);
      const totalCount = results.web.length + results.drive.length;
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          hasResults: totalCount > 0,
          resultCount: totalCount,
        });
      }
      
      // If we have results and count hasn't changed, assume search is complete
      if (totalCount > 0 && totalCount === lastResultCount) {
        return { ...results, sessionId };
      }
      
      lastResultCount = totalCount;
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout - return whatever results we have
    const results = await this.getResults(notebookId, sessionId);
    return { ...results, sessionId };
  }

  /**
   * Get search results (STEP 2 of multi-step workflow - returns results for validation)
   * 
   * **REQUIRES:** You must have a `sessionId` from `search()` (step 1) to use this method.
   * 
   * **What it does:**
   * - Returns discovered sources from a search session
   * - Shows you what was found so you can validate/filter/select
   * - Returns results immediately (doesn't wait - call multiple times to poll)
   * 
   * **Multi-Step Workflow:**
   * 1. `search()` → Returns `sessionId` (step 1)
   * 2. `getResults(sessionId)` → Returns discovered sources (this method - step 2)
   *    - **You can validate results here** - see what was found
   *    - **You can filter/select** - decide which sources to add
   *    - **You can call multiple times** - to poll for more results
   * 3. `addDiscovered(sessionId, selectedSources)` → Add your selected sources (step 3)
   * 
   * **Simple Alternative:**
   * - Use `searchAndWait()` to combine steps 1-2 automatically
   * 
   * **Usage Patterns:**
   * - Call once after `search()` to get initial results
   * - Call multiple times to poll for more results (results accumulate)
   * - Filter results before passing to `addDiscovered()`
   * 
   * @param notebookId - The notebook ID
   * @param sessionId - Session ID from `search()` to filter results (optional - if omitted, returns all results)
   * @returns Discovered sources (web and drive) for validation
   * 
   * @example
   * ```typescript
   * // Step 1: Start search
   * const sessionId = await client.sources.add.web.search('notebook-id', {
   *   query: 'AI research',
   * });
   * 
   * // Step 2: Get results (can call multiple times to poll)
   * let results;
   * do {
   *   await new Promise(r => setTimeout(r, 2000));  // Wait 2 seconds
   *   results = await client.sources.add.web.getResults('notebook-id', sessionId);
   *   console.log(`Found ${results.web.length} sources so far...`);
   * } while (results.web.length === 0);
   * 
   * // Validate and filter results
   * const relevant = results.web.filter(s => 
   *   s.title.includes('machine learning') || 
   *   s.url.includes('arxiv.org')
   * );
   * 
   * // Step 3: Add selected sources
   * await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId,
   *   webSources: relevant,
   * });
   * ```
   */
  async getResults(notebookId: string, sessionId?: string): Promise<{
    web: DiscoveredWebSource[];
    drive: DiscoveredDriveSource[];
  }> {
    const response = await this.rpc.call(
      RPC.RPC_GET_SEARCH_RESULTS,
      [null, null, notebookId],
      notebookId
    );
    
    // Response structure: [[[sessionId, [notebookId, [query, type], mode, [webSources]], ...]]]
    // Example: [[["0057e489-...", ["notebook-id", ["query", 1], 1, [["url", "title", "description", 1], ...]], ...]]]
    // Web sources are at session[1][3] (index 3 of the metadata array, which is the 4th element)
    
    // Handle JSON string response
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use response as-is
      }
    }
    
    // Extract the sessions array
    // Response might be: [[sessions]] or [sessions] or sessions
    let sessions: any[] = [];
    if (Array.isArray(data)) {
      if (data.length > 0 && Array.isArray(data[0])) {
        // Check if first element is an array of sessions
        if (data[0].length > 0 && Array.isArray(data[0][0])) {
          sessions = data[0]; // [[[session], ...]]
        } else {
          sessions = data; // [[session], ...]
        }
      } else {
        sessions = data; // [session, ...]
      }
    }
    
    const web: DiscoveredWebSource[] = [];
    const drive: DiscoveredDriveSource[] = [];
    
    for (const session of sessions) {
      if (!Array.isArray(session) || session.length < 2) {
        continue;
      }
      
      // session[0] = sessionId
      // session[1] = [notebookId, [query, type], mode, [webSources]]
      // Example: ["9c40da15-...", ["nit kkr", 1], 1, [[["https://...", "title", ...], ...]]]
      const currentSessionId = session[0];
      
      // Filter by sessionId if provided (normalize both to strings for comparison)
      if (sessionId) {
        const normalizedSessionId = String(sessionId).trim();
        const normalizedCurrentId = String(currentSessionId || '').trim();
        if (normalizedSessionId && normalizedCurrentId !== normalizedSessionId) {
          continue; // Skip sessions that don't match
        }
      }
      
      const metadata = session[1];
      if (Array.isArray(metadata) && metadata.length > 3) {
        // Web sources are at metadata[3] (index 3, the 4th element)
        const webSources = metadata[3];
        
        // Skip if webSources is null (search is still in progress)
        if (webSources === null || webSources === undefined) {
          continue;
        }
        
        if (Array.isArray(webSources) && webSources.length > 0) {
          // Helper function to recursively flatten arrays until we find source arrays
          const flattenSources = (arr: any[]): any[] => {
            const result: any[] = [];
            for (const item of arr) {
              if (Array.isArray(item)) {
                // Check if this array looks like a source: [url, title, ...]
                if (item.length >= 2 && typeof item[0] === 'string' && item[0].startsWith('http')) {
                  result.push(item);
                } else {
                  // Recursively flatten nested arrays
                  result.push(...flattenSources(item));
                }
              }
            }
            return result;
          };
          
          // Flatten the webSources array
          const sourcesToProcess = flattenSources(webSources);
          
          // Process all sources
          for (const source of sourcesToProcess) {
            if (Array.isArray(source) && source.length >= 2) {
              // Format: [url, title, description, typeCode?, ...]
              // Check for type indicator in the array - might be at index 3 or later
              const url = source[0];
              const title = source[1];
              
              // Check if there's a type code in the array (typically a number)
              // Common positions: index 2 or 3 might contain type info
              let detectedType: string | undefined;
              for (let i = 2; i < Math.min(source.length, 5); i++) {
                const item = source[i];
                // Type codes: 9 = YouTube, 1 = URL, etc.
                if (typeof item === 'number' && item === 9) {
                  detectedType = 'youtube';
                  break;
                } else if (typeof item === 'number' && item === 1) {
                  detectedType = 'url';
                  break;
                }
              }
              
              // Only add if URL exists, is a string, and is a valid URL
              if (url && typeof url === 'string' && url.startsWith('http')) {
                web.push({
                  url: url,
                  title: (typeof title === 'string' ? title : '') || '',
                  id: url, // Use URL as ID
                  type: detectedType, // Store detected type
                });
              }
            } else if (typeof source === 'object' && source && 'url' in source) {
              web.push({
                url: source.url,
                title: source.title || '',
                id: source.id || source.url,
                type: source.type,
              });
            }
          }
        }
      }
    }
    
    return { web, drive };
  }

  /**
   * Add discovered sources from search results (final step - adds your selected sources)
   * 
   * **REQUIRES:** You must have a `sessionId` from `search()` or `searchAndWait()`.
   * 
   * **What it does:**
   * - Adds the sources you selected from search results
   * - You decide which sources to add (from `getResults()` or `searchAndWait()`)
   * - Returns array of added source IDs for validation
   * 
   * **Workflow Patterns:**
   * 
   * **Simple Pattern:**
   * ```typescript
   * const result = await client.sources.add.web.searchAndWait(...);
   * const addedIds = await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId,
   *   webSources: result.web,  // Add all, or filter first
   * });
   * ```
   * 
   * **Multi-Step Pattern:**
   * ```typescript
   * const sessionId = await client.sources.add.web.search(...);
   * const results = await client.sources.add.web.getResults(..., sessionId);
   * const selected = results.web.filter(...);  // Your selection logic
   * const addedIds = await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId,
   *   webSources: selected,
   * });
   * ```
   * 
   * **Important:**
   * - `sessionId` must match the one from your search (from `search()` or `searchAndWait()`)
   * - You can add web sources, drive sources, or both
   * - Returns source IDs so you can validate what was added
   * 
   * @param notebookId - The notebook ID
   * @param options - Session ID and sources to add (web and/or drive)
   * @returns Array of added source IDs (for validation)
   * 
   * @example
   * ```typescript
   * // After searchAndWait() - add selected sources
   * const result = await client.sources.add.web.searchAndWait('notebook-id', {
   *   query: 'research papers',
   * });
   * 
   * // Validate results, then add top 5
   * const top5 = result.web.slice(0, 5);
   * const addedIds = await client.sources.add.web.addDiscovered('notebook-id', {
   *   sessionId: result.sessionId,
   *   webSources: top5,
   * });
   * 
   * console.log(`Added ${addedIds.length} sources:`, addedIds);
   * ```
   */
  async addDiscovered(notebookId: string, options: AddDiscoveredSourcesOptions): Promise<string[]> {
    const { sessionId, webSources = [], driveSources = [] } = options;
    
    if (webSources.length === 0 && driveSources.length === 0) {
      throw new NotebookLMError('At least one source (web or drive) must be provided');
    }
    
    // Check quota before adding sources
    const totalSources = webSources.length + driveSources.length;
    for (let i = 0; i < totalSources; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    // Build request structure
    const sourcesToAdd: any[] = [];
    
    // Add web sources
    // Regular URL format: [null, null, [url], null, null, null, null, null, null, null, 1]
    // URL goes at index 2, not index 7 (index 7 is for YouTube)
    for (const webSource of webSources) {
      const url = webSource.url || webSource.id;
      
      // Use type from response if available, otherwise detect from URL
      const isYouTube = webSource.type === 'youtube' || 
                       (url && (url.includes('youtube.com') || url.includes('youtu.be')));
      
      if (isYouTube) {
        // YouTube format: [null, null, null, null, null, null, null, [youtubeUrl], null, null, 1]
      sourcesToAdd.push([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
          [url],
        null,
        null,
          1,
        ]);
      } else {
        // Regular URL format: [null, null, [url], null, null, null, null, null, null, null, 1]
        sourcesToAdd.push([
          null,
          null,
          [url], // URL at index 2 for regular URLs
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          1,
      ]);
      }
    }
    
    // Add drive sources
    for (const driveSource of driveSources) {
      const driveArgs: any[] = [driveSource.fileId];
      if (driveSource.mimeType) {
        driveArgs.push(driveSource.mimeType);
      }
      if (driveSource.title) {
        driveArgs.push(driveSource.title);
      }
      
      sourcesToAdd.push([
        null,
        null,
        null,
        driveArgs,
        5, // Google Drive source type
      ]);
    }
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [sourcesToAdd, notebookId],
      notebookId
    );
    
    // Extract source IDs from response
    // Use same extraction logic as batch() method for consistency
    const sourceIds: string[] = [];
    const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    
    const extractIds = (data: any, depth: number = 0): void => {
      // Prevent infinite recursion
      if (depth > 10) {
        return;
      }
      
      if (typeof data === 'string') {
        // Try parsing as JSON string first (might be double-encoded)
        if (data.trim().startsWith('[') || data.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(data);
            extractIds(parsed, depth + 1);
            return;
          } catch {
            // Not JSON, continue as regular string
          }
        }
        // Check if it's a UUID
        if (uuidRegex.test(data.trim())) {
          sourceIds.push(data.trim());
        }
      } else if (Array.isArray(data)) {
        for (const item of data) {
          extractIds(item, depth + 1);
        }
      } else if (data && typeof data === 'object') {
        // Check object values and keys
        for (const key in data) {
          if (uuidRegex.test(key)) {
            sourceIds.push(key);
          }
          extractIds(data[key], depth + 1);
        }
      }
    };
    
    extractIds(response);
    
    // Remove duplicates
    const uniqueIds = Array.from(new Set(sourceIds));
    
    // Limit to expected number of sources (to avoid returning extra IDs from nested structures)
    const expectedCount = totalSources;
    const limitedIds = uniqueIds.slice(0, expectedCount);
    
    // Record usage after successful addition
    if (limitedIds.length > 0) {
      for (let i = 0; i < limitedIds.length; i++) {
        this.quota?.recordUsage('addSource', notebookId);
      }
    }
    
    return limitedIds;
  }
}

/**
 * Add sources sub-service
 * Handles adding sources of various types (URL, text, file, YouTube, Google Drive, batch)
 */
export class AddSourcesService {
  public readonly web: WebSearchService;

  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {
    this.web = new WebSearchService(rpc, quota);
  }

  /**
   * Count words in text (approximation)
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Chunk text by word count to fit within limits
   */
  private chunkTextByWords(text: string, maxWords: number): string[] {
    const words = text.trim().split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(' ');
      chunks.push(chunk);
    }
    
    return chunks;
  }

  /**
   * Chunk buffer by size (for binary files)
   */
  private chunkBufferBySize(buffer: Buffer, maxSizeBytes: number): Buffer[] {
    const chunks: Buffer[] = [];
    
    for (let i = 0; i < buffer.length; i += maxSizeBytes) {
      chunks.push(buffer.slice(i, i + maxSizeBytes));
    }
    
    return chunks;
  }

  /**
   * Extract text from common text-based file types
   * Returns null if file type is not text-based or extraction fails
   */
  private async extractTextFromFile(
    content: Buffer | string,
    fileName: string,
    mimeType?: string
  ): Promise<string | null> {
    try {
      let buffer: Buffer;
      
      if (Buffer.isBuffer(content)) {
        buffer = content;
      } else if (typeof content === 'string') {
        // Assume base64
        buffer = Buffer.from(content, 'base64');
      } else {
        return null;
      }
      
      // Check file extension and MIME type
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const isTextFile = 
        ['txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h'].includes(ext) ||
        mimeType?.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml';
      
      if (isTextFile) {
        // Try to decode as UTF-8 text
        try {
          return buffer.toString('utf-8');
        } catch {
          return null;
        }
      }
      
      // For PDFs, we'd need a PDF library (like pdf-parse)
      // For now, return null to indicate we can't extract text
      if (ext === 'pdf' || mimeType === 'application/pdf') {
        // PDF text extraction requires a library - return null
        // Users can install pdf-parse and extract text themselves if needed
        return null;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // Helper method to extract source ID from response
  private extractSourceId(response: any): string {
    try {
      let parsedResponse = response;
      if (typeof response === 'string' && (response.startsWith('[') || response.startsWith('{'))) {
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          // If parsing fails, continue with original response
        }
      }
      
      const findId = (data: any, depth: number = 0): string | null => {
        if (depth > 5) return null;
        
        if (typeof data === 'string' && data.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          return data;
        }
        
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

  /**
   * Add a URL source
   */
  async url(notebookId: string, options: AddSourceFromURLOptions): Promise<string> {
    const { url, title } = options;
    
    if (!url || typeof url !== 'string') {
      throw new NotebookLMError('URL is required and must be a string');
    }
    
    this.quota?.checkQuota('addSource', notebookId);
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            null,
            null,
            [url],
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    // If a custom title was provided, update the source with it
    // (The API uses the website's title by default, but we can override it)
    if (title && typeof title === 'string' && title.trim().length > 0) {
      try {
        // RPC structure for updating source title: [null, ["sourceId"], [[["title"]]]]
        await this.rpc.call(
          RPC.RPC_MUTATE_SOURCE,
          [
            null,
            [sourceId],
            [[[title.trim()]]],
          ],
          notebookId
        );
      } catch (error) {
        // If update fails, log a warning but don't fail the whole operation
        // The source was still added successfully, just without the custom title
        console.warn(`Warning: Failed to update source title: ${(error as Error).message}`);
      }
    }
    
    return sourceId;
  }

  /**
   * Add a text source (with auto-chunking support)
   */
  async text(notebookId: string, options: AddSourceFromTextOptions): Promise<string | AddSourceResult> {
    const { content, title } = options;
    
    if (!content || typeof content !== 'string') {
      throw new NotebookLMError('Content is required and must be a string');
    }
    
    // Get limits from quota manager
    const maxWords = this.quota?.getLimits().wordsPerSource || 500000;
    const wordCount = this.countWords(content);
    
    // If within limits, add normally
    if (wordCount <= maxWords) {
      this.quota?.checkQuota('addSource', notebookId);
      
      // Text format: [null, [title, content], null, 2, ...]
      // Index 1 = [title, content], Index 3 = type code 2
      const textData = title ? [title, content] : [null, content];
      
      const response = await this.rpc.call(
        RPC.RPC_ADD_SOURCES,
        [
          [
            [
              null,
              textData,
              null,
              2,
              null,
              null,
              null,
              null,
              null,
              null,
              1,
            ],
          ],
          notebookId,
        ],
        notebookId
      );
      
      const sourceId = this.extractSourceId(response);
      
      if (sourceId) {
        this.quota?.recordUsage('addSource', notebookId);
      }
      
      return sourceId;
    }
    
    // Auto-chunk: Split text into chunks
    const chunks = this.chunkTextByWords(content, maxWords);
    const chunkCount = chunks.length;
    
    // Check quota for all chunks
    for (let i = 0; i < chunkCount; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    // Upload chunks in parallel
    const uploadPromises = chunks.map(async (chunk, index) => {
      const chunkTitle = title ? `${title} (Part ${index + 1}/${chunkCount})` : `Text Source (Part ${index + 1}/${chunkCount})`;
      const textData = [chunkTitle, chunk];
      
      const response = await this.rpc.call(
        RPC.RPC_ADD_SOURCES,
        [
          [
            [
              null,
              textData,
              null,
              2,
              null,
              null,
              null,
              null,
              null,
              null,
              1,
            ],
          ],
          notebookId,
        ],
        notebookId
      );
      
      const sourceId = this.extractSourceId(response);
      
      if (sourceId) {
        this.quota?.recordUsage('addSource', notebookId);
      }
      
      return {
        sourceId,
        chunkIndex: index,
        wordStart: index * maxWords + 1,
        wordEnd: Math.min((index + 1) * maxWords, wordCount),
      };
    });
    
    const results = await Promise.all(uploadPromises);
    const sourceIds = results.map(r => r.sourceId).filter((id): id is string => !!id);
    const chunkMetadata: SourceChunk[] = results.map(r => ({
      sourceId: r.sourceId,
      fileName: title || 'text-source',
      chunkIndex: r.chunkIndex,
      wordStart: r.wordStart,
      wordEnd: r.wordEnd,
    }));
    
    return {
      wasChunked: true,
      totalWords: wordCount,
      sourceIds,
      chunks: chunkMetadata,
      allSourceIds: sourceIds,
    };
  }

  /**
   * Add a file source (with auto-chunking support)
   */
  async file(notebookId: string, options: AddSourceFromFileOptions): Promise<string | AddSourceResult> {
    const { fileName, content, mimeType } = options;
    
    if (!fileName || typeof fileName !== 'string') {
      throw new NotebookLMError('File name is required and must be a string');
    }
    
    if (!content) {
      throw new NotebookLMError('File content is required');
    }
    
    // Get limits from quota manager
    const maxSizeMB = this.quota?.getLimits().fileSizeMB || 200;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const maxWords = this.quota?.getLimits().wordsPerSource || 500000;
    
    let buffer: Buffer;
    let sizeBytes: number;
    
    if (Buffer.isBuffer(content)) {
      buffer = content;
      sizeBytes = content.length;
    } else if (typeof content === 'string') {
      // Assume base64
      buffer = Buffer.from(content, 'base64');
      sizeBytes = Math.floor((content.length * 3) / 4);
    } else {
      throw new NotebookLMError('Invalid content type for file');
    }
    
    // Try to extract text for text-based files (to check word count)
    const extractedText = await this.extractTextFromFile(buffer, fileName, mimeType);
    const isTextBased = extractedText !== null;
    let wordCount = 0;
    
    if (isTextBased && extractedText) {
      wordCount = this.countWords(extractedText);
    }
    
    // Check if chunking is needed
    const needsSizeChunking = sizeBytes > maxSizeBytes;
    const needsWordChunking = isTextBased && wordCount > maxWords;
    
    // If within limits, add normally
    if (!needsSizeChunking && !needsWordChunking) {
      this.quota?.validateFileSize(sizeBytes);
      this.quota?.checkQuota('addSource', notebookId);
      
      const base64Content = buffer.toString('base64');
      
      const response = await this.rpc.call(
        RPC.RPC_UPLOAD_FILE_BY_FILENAME,
        [
          [
            [fileName, 13],
          ],
          notebookId,
          [2],
          [1, null, null, null, null, null, null, null, null, null, [1]],
        ],
        notebookId
      );
      
      const sourceId = this.extractSourceId(response);
      
      if (sourceId) {
        this.quota?.recordUsage('addSource', notebookId);
      }
      
      return sourceId;
    }
    
    // Auto-chunk needed
    let chunks: Array<{ buffer: Buffer; wordStart?: number; wordEnd?: number; sizeBytes: number }>;
    let chunkCount: number;
    
    if (needsWordChunking && isTextBased && extractedText) {
      // Chunk by words (for text-based files)
      const textChunks = this.chunkTextByWords(extractedText, maxWords);
      chunkCount = textChunks.length;
      
      // Convert text chunks back to buffers
      chunks = textChunks.map((textChunk, index) => {
        const chunkBuffer = Buffer.from(textChunk, 'utf-8');
        return {
          buffer: chunkBuffer,
          wordStart: index * maxWords + 1,
          wordEnd: Math.min((index + 1) * maxWords, wordCount),
          sizeBytes: chunkBuffer.length,
        };
      });
    } else if (needsSizeChunking) {
      // Chunk by size (for binary files or files that exceed size limit)
      const bufferChunks = this.chunkBufferBySize(buffer, maxSizeBytes);
      chunkCount = bufferChunks.length;
      
      chunks = bufferChunks.map((chunkBuffer, index) => ({
        buffer: chunkBuffer,
        sizeBytes: chunkBuffer.length,
      }));
    } else {
      // Should not reach here, but handle gracefully
      throw new NotebookLMError('Unexpected chunking scenario');
    }
    
    // Check quota for all chunks
    for (let i = 0; i < chunkCount; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    // Upload chunks in parallel
    const uploadPromises = chunks.map(async (chunk, index) => {
      const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      const ext = fileName.split('.').pop() || '';
      const chunkFileName = `${baseName}_part${index + 1}_of_${chunkCount}.${ext}`;
      const base64Content = chunk.buffer.toString('base64');
      
      const response = await this.rpc.call(
        RPC.RPC_UPLOAD_FILE_BY_FILENAME,
        [
          [
            [chunkFileName, 13],
          ],
          notebookId,
          [2],
          [1, null, null, null, null, null, null, null, null, null, [1]],
        ],
        notebookId
      );
      
      const sourceId = this.extractSourceId(response);
      
      if (sourceId) {
        this.quota?.recordUsage('addSource', notebookId);
      }
      
      return {
        sourceId,
        chunkIndex: index,
        fileName: chunkFileName,
        wordStart: chunk.wordStart,
        wordEnd: chunk.wordEnd,
        sizeBytes: chunk.sizeBytes,
      };
    });
    
    const results = await Promise.all(uploadPromises);
    const sourceIds = results.map(r => r.sourceId).filter((id): id is string => !!id);
    const chunkMetadata: SourceChunk[] = results.map(r => ({
      sourceId: r.sourceId,
      fileName: r.fileName,
      chunkIndex: r.chunkIndex,
      wordStart: r.wordStart,
      wordEnd: r.wordEnd,
      sizeBytes: r.sizeBytes,
    }));
    
    return {
      wasChunked: true,
      totalWords: isTextBased ? wordCount : undefined,
      totalSizeBytes: sizeBytes,
      sourceIds,
      chunks: chunkMetadata,
      allSourceIds: sourceIds,
    };
  }

  /**
   * Add a YouTube video source
   */
  async youtube(notebookId: string, options: AddYouTubeSourceOptions): Promise<string> {
    const { urlOrId } = options;
    
    this.quota?.checkQuota('addSource', notebookId);
    
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
            [youtubeUrl],
            null,
            null,
            1,
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }

  /**
   * Add a Google Drive source
   * 
   * @deprecated This method is deprecated. Use `batch()` with `type: 'gdrive'` instead.
   */
  async drive(notebookId: string, options: AddGoogleDriveSourceOptions): Promise<string> {
    console.warn(
      '⚠️  WARNING: sources.add.drive() is deprecated. ' +
      'Use add.batch() with type: \'gdrive\' instead.'
    );
    const { fileId, mimeType } = options;
    
    this.quota?.checkQuota('addSource', notebookId);
    
    // Google Drive format: [fileId, mimeType, 1, title] at index 0
    // Structure: [[fileId, mimeType, 1, title], null, null, null, null, null, null, null, null, null, 1]
    const driveArgs: any[] = [fileId];
    if (mimeType) {
      driveArgs.push(mimeType);
    }
    // Always add 1 after fileId (and mimeType if present)
    driveArgs.push(1);
    if (options.title) {
      driveArgs.push(options.title);
    }
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      [
        [
          [
            driveArgs,  // Index 0: [fileId, mimeType?, 1, title?]
            null,       // Index 1
            null,       // Index 2
            null,       // Index 3
            null,       // Index 4
            null,       // Index 5
            null,       // Index 6
            null,       // Index 7
            null,       // Index 8
            null,       // Index 9
            1,          // Index 10
          ],
        ],
        notebookId,
      ],
      notebookId
    );
    
    const sourceId = this.extractSourceId(response);
    
    if (sourceId) {
      this.quota?.recordUsage('addSource', notebookId);
    }
    
    return sourceId;
  }

  /**
   * Add multiple sources in a batch
   */
  async batch(notebookId: string, options: BatchAddSourcesOptions): Promise<string[]> {
    const { sources } = options;
    
    if (!sources || sources.length === 0) {
      throw new NotebookLMError('At least one source is required for batch add');
    }
    
    // Check quota for all sources
    for (let i = 0; i < sources.length; i++) {
      this.quota?.checkQuota('addSource', notebookId);
    }
    
    const sourcesToAdd: any[] = [];
    
    for (const source of sources) {
      if (source.type === 'url') {
        // Always treat as regular URL when type is explicitly 'url'
        // Regular URL format - URL at index 2
        sourcesToAdd.push([
          null,
          null,
          [source.url],
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          1,
        ]);
      } else if (source.type === 'text') {
        // Text format: [null, [title, content], null, 2, ...]
        // Index 1 = [title, content], Index 3 = type code 2
        const textData = source.title ? [source.title, source.content] : [null, source.content];
        sourcesToAdd.push([
          null,
          textData,
          null,
          2,
          null,
          null,
          null,
          null,
          null,
          null,
          1,
        ]);
      } else if (source.type === 'gdrive') {
        // Google Drive format: [fileId, mimeType, 1, title] at index 0
        // Structure: [[fileId, mimeType, 1, title], null, null, null, null, null, null, null, null, null, 1]
        // Based on curl: ["1kVJu1NZmhCHoQRWS1RmldOkC4n4f6WNST_N4upJuba4","application/vnd.google-apps.document",1,"Test Document"]
        // Always include all 4 elements: fileId, mimeType (or null), 1, title (or null)
        const driveArgs: any[] = [
          source.fileId,
          source.mimeType || null,  // Always include mimeType position (null if not provided)
          1,
          source.title || null,     // Always include title position (null if not provided)
        ];
        sourcesToAdd.push([
          driveArgs,  // Index 0: [fileId, mimeType, 1, title]
          null,       // Index 1
          null,       // Index 2
          null,       // Index 3
          null,       // Index 4
          null,       // Index 5
          null,       // Index 6
          null,       // Index 7
          null,       // Index 8
          null,       // Index 9
          1,          // Index 10
        ]);
      } else if (source.type === 'youtube') {
        const youtubeUrl = this.isYouTubeURL(source.urlOrId) 
          ? source.urlOrId
          : `https://www.youtube.com/watch?v=${source.urlOrId}`;
        sourcesToAdd.push([
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          [youtubeUrl],
          null,
          null,
          1,
        ]);
      }
    }
    
    // Check if all sources are Google Drive - they require a different RPC structure
    const allGDrive = sources.every(s => s.type === 'gdrive');
    
    let rpcArgs: any[];
    if (allGDrive) {
      // Google Drive sources require extended RPC structure:
      // Wrap the entire sourcesToAdd array in an extra array layer
      // [[sourcesToAdd], notebookId, [2], [1, null, ..., null, [1]]]
      // Based on curl: [[source1, source2, source3]], notebookId, [2], [1, null, ..., null, [1]]
      rpcArgs = [
        [sourcesToAdd], // Wrap sourcesToAdd in an extra array layer
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]]
      ];
    } else {
      // For mixed or non-GDrive sources, use standard structure
      rpcArgs = [sourcesToAdd, notebookId];
    }
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_SOURCES,
      rpcArgs,
      notebookId
    );
    
    // Extract all source IDs from response
    // Response can be:
    // - Array of arrays: [[id1], [id2], ...] 
    // - Array of IDs: [id1, id2, ...]
    // - Single ID string
    // - Nested structure
    const sourceIds: string[] = [];
    const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    
    const extractIds = (data: any, depth: number = 0): void => {
      if (depth > 10) return; // Prevent infinite recursion
      
      if (typeof data === 'string') {
        // Try parsing JSON string
        if ((data.startsWith('[') || data.startsWith('{'))) {
          try {
            const parsed = JSON.parse(data);
            extractIds(parsed, depth + 1);
            return;
          } catch {
            // Not JSON, continue as regular string
          }
        }
        // Check if it's a UUID
        if (uuidRegex.test(data.trim())) {
          sourceIds.push(data.trim());
        }
      } else if (Array.isArray(data)) {
        for (const item of data) {
          extractIds(item, depth + 1);
        }
      } else if (data && typeof data === 'object') {
        // Check object values and keys
        for (const key in data) {
          if (uuidRegex.test(key)) {
            sourceIds.push(key);
          }
          extractIds(data[key], depth + 1);
        }
      }
    };
    
    extractIds(response);
    
    // Remove duplicates
    const uniqueIds = Array.from(new Set(sourceIds));
    
    // Limit to expected number of sources (to avoid returning extra IDs from nested structures)
    // Since sources are added in order, take the first N where N = number of sources added
    const expectedCount = sources.length;
    const limitedIds = uniqueIds.slice(0, expectedCount);
    
    // Record usage after successful addition
    if (limitedIds.length > 0) {
      for (let i = 0; i < limitedIds.length; i++) {
        this.quota?.recordUsage('addSource', notebookId);
      }
    }
    
    return limitedIds;
  }

  private isYouTubeURL(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }
}

/**
 * Service for source operations
 */
export class SourcesService {
  public readonly add: AddSourcesService;

  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {
    this.add = new AddSourcesService(rpc, quota);
  }
  
  // ========================================================================
  // Source Listing Methods
  // ========================================================================
  
  /**
   * List all sources in a notebook
   * 
   * **What it does:** Retrieves a list of all sources (URLs, text, files, YouTube videos, 
   * Google Drive files, etc.) associated with a notebook.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook to list sources from
   * 
   * **Output:** Returns an array of `Source` objects, each containing:
   * - `sourceId`: Unique identifier for the source
   * - `title`: Source title/name
   * - `type`: Source type (URL, TEXT, FILE, YOUTUBE_VIDEO, GOOGLE_DRIVE, etc.)
   * - `url`: Source URL (for URL/YouTube sources)
   * - `createdAt`: Creation timestamp
   * - `updatedAt`: Last modified timestamp
   * - `status`: Processing status (PROCESSING, READY, FAILED)
   * - `metadata`: Additional metadata (file size, MIME type, etc.)
   * 
   * **Note:** 
   * - Sources are extracted from the notebook response (same RPC as `notebooks.get()`)
   * - This method efficiently reuses the notebook data without requiring a separate RPC call
   * - Processing status is inferred from the source metadata
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * // List all sources
   * const sources = await client.sources.list('notebook-id');
   * console.log(`Found ${sources.length} sources`);
   * 
   * // Filter by type
   * const pdfs = sources.filter(s => s.type === SourceType.FILE);
   * const urls = sources.filter(s => s.type === SourceType.URL);
   * 
   * // Check processing status
   * const ready = sources.filter(s => s.status === SourceStatus.READY);
   * const processing = sources.filter(s => s.status === SourceStatus.PROCESSING);
   * 
   * // Get source details
   * sources.forEach(source => {
   *   console.log(`${source.title} (${source.type}) - ${source.status}`);
   * });
   * ```
   */
  async list(notebookId: string): Promise<Source[]> {
    if (!notebookId || typeof notebookId !== 'string') {
      throw new NotebookLMError('Invalid notebook ID format');
    }
    
    // Call RPC_GET_PROJECT to get notebook data (includes sources)
    const response = await this.rpc.call(
      RPC.RPC_GET_PROJECT,
      [notebookId, null, [2], null, 0],
      notebookId
    );
    
    return this.parseSourcesFromResponse(response);
  }
  
  /**
   * Parse sources from notebook response
   * 
   * Source structure in response:
   * [
   *   ["source-id"],
   *   "filename.pdf",
   *   [null, fileSize, [timestamp], ["processed-id", timestamp], type_code, null, 1],
   *   [null, 2]
   * ]
   * 
   * Type codes:
   * - 1 = Google Drive
   * - 2 = Text
   * - 3 = File/PDF
   * - 4 = Text note
   * - 5 = URL
   * - 8 = Mind map note
   * - 9 = YouTube
   * - 10 = Video file
   * - 13 = Image
   * - 14 = PDF from Drive
   */
  private parseSourcesFromResponse(response: any): Source[] {
    try {
      let parsedResponse = response;
      if (typeof response === 'string') {
        parsedResponse = JSON.parse(response);
      }
      
      if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
        return [];
      }
      
      let data = parsedResponse;
      
      // Handle nested array structure
      if (Array.isArray(parsedResponse[0])) {
        data = parsedResponse[0];
      }
      
      // Sources are in data[1]
      if (!Array.isArray(data[1])) {
        return [];
      }
      
      const sources: Source[] = [];
      
      for (const sourceData of data[1]) {
        if (!Array.isArray(sourceData) || sourceData.length === 0) {
          continue;
        }
        
        // Extract source ID from [0][0]
        let sourceId: string | undefined;
        if (Array.isArray(sourceData[0]) && sourceData[0].length > 0) {
          sourceId = sourceData[0][0];
        } else if (typeof sourceData[0] === 'string') {
          sourceId = sourceData[0];
        }
        
        if (!sourceId || typeof sourceId !== 'string') {
          continue;
        }
        
        // Extract title from [1]
        const title = typeof sourceData[1] === 'string' ? sourceData[1] : 'Untitled';
        
        // Extract metadata from [2]
        const metadata = Array.isArray(sourceData[2]) ? sourceData[2] : [];
        
        // Parse type code from metadata[4]
        const typeCode = metadata[4];
        const sourceType = this.mapTypeCodeToSourceType(typeCode);
        
        // Parse timestamps
        let createdAt: string | undefined;
        let updatedAt: string | undefined;
        
        // Creation timestamp from metadata[2] = [seconds, nanoseconds]
        if (Array.isArray(metadata[2]) && metadata[2].length >= 2) {
          const [seconds, nanoseconds] = metadata[2];
          if (typeof seconds === 'number') {
            const timestamp = seconds * 1000 + (nanoseconds || 0) / 1000000;
            createdAt = new Date(timestamp).toISOString();
          }
        }
        
        // Updated/processed timestamp from metadata[3] = ["processed-id", timestamp]
        if (Array.isArray(metadata[3]) && metadata[3].length >= 2) {
          const timestamp = metadata[3][1];
          if (Array.isArray(timestamp) && timestamp.length >= 2) {
            const [seconds, nanoseconds] = timestamp;
            if (typeof seconds === 'number') {
              const ts = seconds * 1000 + (nanoseconds || 0) / 1000000;
              updatedAt = new Date(ts).toISOString();
            }
          } else if (typeof timestamp === 'number') {
            updatedAt = new Date(timestamp).toISOString();
          }
        }
        
        // If no updatedAt, use createdAt
        if (!updatedAt && createdAt) {
          updatedAt = createdAt;
        }
        
        // Parse URL (for URL/YouTube sources) from metadata[6] or title
        let url: string | undefined;
        if (sourceType === SourceType.URL || sourceType === SourceType.YOUTUBE_VIDEO) {
          // Check metadata[6] for URL array
          if (Array.isArray(metadata[6]) && metadata[6].length > 0) {
            url = metadata[6][0];
          } else if (title.startsWith('http://') || title.startsWith('https://')) {
            url = title;
          }
        }
        
        // Parse file size from metadata[1]
        const fileSize = typeof metadata[1] === 'number' ? metadata[1] : undefined;
        
        // Determine processing status
        // If metadata[3] exists (processed info), source is likely ready
        // If metadata[6] === 1, source is processed
        let status: SourceStatus = SourceStatus.UNKNOWN;
        if (metadata[3] && Array.isArray(metadata[3]) && metadata[3].length > 0) {
          status = SourceStatus.READY;
        } else if (metadata[6] === 1) {
          status = SourceStatus.READY;
        } else if (sourceId && !metadata[3]) {
          // Has ID but no processed info - might be processing
          status = SourceStatus.PROCESSING;
        }
        
        // Build metadata object
        const sourceMetadata: Record<string, any> = {};
        if (fileSize !== undefined) {
          sourceMetadata.fileSize = fileSize;
        }
        
        // Extract MIME type or additional info if available
        if (metadata.length > 7 && Array.isArray(metadata[7])) {
          // Sometimes additional metadata is in nested arrays
          if (metadata[7].length > 2 && typeof metadata[7][2] === 'string') {
            sourceMetadata.mimeType = metadata[7][2];
          }
        }
        
        sources.push({
          sourceId,
          title,
          type: sourceType,
          url,
          createdAt,
          updatedAt,
          status,
          metadata: Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
        });
      }
      
      return sources;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse sources: ${(error as Error).message}`);
    }
  }
  
  /**
   * Map type code from API response to SourceType enum
   * 
   * **What this does:**
   * The NotebookLM API returns sources with numeric type codes in the metadata array.
   * This function converts those internal API codes to our public SourceType enum.
   * 
   * **Where the type code comes from:**
   * In the API response, each source has this structure:
   * ```
   * [
   *   ["source-id"],                    // [0] = source ID
   *   "filename.pdf",                   // [1] = title
   *   [null, 602, [...], [...], 3, ...], // [2] = metadata array
   *                                     //      [2][4] = type code (the number we map)
   * ]
   * ```
   * 
   * **Type Code Examples from Real API Responses:**
   * - `3` = PDF file: `["fnz offer.pdf", [null, 602, [...], [...], 3, ...]`
   * - `5` = URL: `["AI SDK", [null, 571, [...], [...], 5, ..., ["https://ai-sdk.dev/"]]`
   * - `9` = YouTube: `["Building an iMessage AI Chatbot", [null, 793, [...], [...], 9, [...]]`
   * - `4` = Text note: `["A Pussycat's Discourse", [null, 1, [...], [...], 4, ...]`
   * - `1` = Google Drive: `["offer_letter_photon", [[...], 492, [...], [...], 1, ...]`
   * - `13` = Image: `["Screenshot 2025-12-28.png", [null, 0, [...], [...], 13, ...]`
   * 
   * **Mapping:**
   * Each API type code maps to a specific SourceType enum value to preserve the distinction
   * between different file types (PDF, video, image, etc.).
   * 
   * @param typeCode - The numeric type code from API response metadata[4]
   * @returns The corresponding SourceType enum value
   */
  private mapTypeCodeToSourceType(typeCode: any): SourceType {
    if (typeof typeCode !== 'number') {
      return SourceType.UNKNOWN;
    }
    
    switch (typeCode) {
      case 1:
        return SourceType.GOOGLE_DRIVE;    // Google Drive file
      case 2:
        return SourceType.TEXT;            // Regular text source
      case 3:
        return SourceType.PDF;             // PDF file
      case 4:
        return SourceType.TEXT_NOTE;       // Text note
      case 5:
        return SourceType.URL;             // Web URL
      case 8:
        return SourceType.MIND_MAP_NOTE;  // Mind map note
      case 9:
        return SourceType.YOUTUBE_VIDEO;   // YouTube video
      case 10:
        return SourceType.VIDEO_FILE;      // Video file (uploaded)
      case 13:
        return SourceType.IMAGE;           // Image file
      case 14:
        return SourceType.PDF_FROM_DRIVE;  // PDF from Google Drive
      default:
        return SourceType.UNKNOWN;         // Unknown/unsupported type
    }
  }
  
  /**
   * Get source(s) from a notebook
   * 
   * **What it does:** 
   * - If `sourceId` is provided: Returns a single source by ID
   * - If `sourceId` is not provided: Returns all sources (same as `list()`)
   * 
   * **Input:**
   * - `notebookId` (string, required): The notebook ID
   * - `sourceId` (string, optional): The source ID to get. If omitted, returns all sources.
   * 
   * **Output:** 
   * - If `sourceId` provided: Returns a single `Source` object
   * - If `sourceId` omitted: Returns an array of `Source` objects
   * 
   * @param notebookId - The notebook ID
   * @param sourceId - Optional source ID to get a single source
   * 
   * @example
   * ```typescript
   * // Get all sources
   * const allSources = await client.sources.get('notebook-id');
   * 
   * // Get a specific source
   * const source = await client.sources.get('notebook-id', 'source-id');
   * console.log(source.title);
   * ```
   */
  async get(notebookId: string, sourceId?: string): Promise<Source | Source[]> {
    if (!notebookId || typeof notebookId !== 'string') {
      throw new NotebookLMError('Invalid notebook ID format');
    }
    
    // Get all sources
    const allSources = await this.list(notebookId);
    
    // If sourceId provided, return single source
    if (sourceId) {
      const source = allSources.find(s => s.sourceId === sourceId);
      if (!source) {
        throw new NotebookLMError(`Source not found: ${sourceId}`);
      }
      return source;
    }
    
    // Return all sources
    return allSources;
  }
  
  // ========================================================================
  // Individual Source Addition Methods (DEPRECATED - Use sources.add.* instead)
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
   * **Auto-Chunking:** If the text exceeds 500,000 words, it will be automatically
   * split into chunks and uploaded in parallel. Returns `AddSourceResult` with chunk metadata.
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued (or chunks are uploaded)
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * - If chunked, returns `AddSourceResult` with `wasChunked: true` and chunk metadata
   * 
   * @param notebookId - The notebook ID
   * @param options - Text content and title
   * @returns Source ID (string) if not chunked, or `AddSourceResult` if chunked
   * 
   * @example
   * ```typescript
   * // Single source (within limits)
   * const sourceId = await client.sources.addFromText('notebook-id', {
   *   title: 'My Notes',
   *   content: 'This is my research content...',
   * });
   * 
   * // Large text (auto-chunked)
   * const result = await client.sources.addFromText('notebook-id', {
   *   title: 'Large Document',
   *   content: veryLongText, // > 500k words
   * });
   * if (result.wasChunked) {
   *   console.log(`Uploaded ${result.chunks.length} chunks`);
   *   console.log(`Source IDs: ${result.allSourceIds.join(', ')}`);
   * }
   * ```
   */
  async addFromText(notebookId: string, options: AddSourceFromTextOptions): Promise<string | AddSourceResult> {
    const result = await this.add.text(notebookId, options);
    
    // If it's a string (single source), return as-is for backward compatibility
    if (typeof result === 'string') {
      return result;
    }
    
    // If it's AddSourceResult (chunked), return it
    return result;
  }
  
  /**
   * Add a source from uploaded file
   * 
   * **Auto-Chunking:** If the file exceeds 200MB or contains more than 500,000 words (for text-based files),
   * it will be automatically split into chunks and uploaded in parallel. Returns `AddSourceResult` with chunk metadata.
   * 
   * **Chunking Behavior:**
   * - Text-based files (txt, md, csv, json, etc.): Chunked by word count (500k words per chunk)
   * - Binary files: Chunked by size (200MB per chunk)
   * - PDFs: Note that PDF text extraction requires a PDF library. For now, PDFs are chunked by size only.
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after file is uploaded and queued (or chunks are uploaded)
   * - File processing may take longer than URLs/text
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * - If chunked, returns `AddSourceResult` with `wasChunked: true` and chunk metadata
   * 
   * @param notebookId - The notebook ID
   * @param options - File content, name, and MIME type
   * @returns Source ID (string) if not chunked, or `AddSourceResult` if chunked
   * 
   * @example
   * ```typescript
   * // From Buffer (Node.js) - single file
   * const fileBuffer = await fs.readFile('document.pdf');
   * const sourceId = await client.sources.addFromFile('notebook-id', {
   *   content: fileBuffer,
   *   fileName: 'document.pdf',
   *   mimeType: 'application/pdf',
   * });
   * 
   * // Large file (auto-chunked)
   * const result = await client.sources.addFromFile('notebook-id', {
   *   content: largeFileBuffer, // > 200MB or > 500k words
   *   fileName: 'large-document.pdf',
   * });
   * if (result.wasChunked) {
   *   console.log(`Uploaded ${result.chunks.length} chunks`);
   *   result.chunks.forEach(chunk => {
   *     console.log(`Chunk ${chunk.chunkIndex + 1}: ${chunk.sourceId}`);
   *   });
   * }
   * ```
   */
  async addFromFile(notebookId: string, options: AddSourceFromFileOptions): Promise<string | AddSourceResult> {
    const result = await this.add.file(notebookId, options);
    
    // If it's a string (single source), return as-is for backward compatibility
    if (typeof result === 'string') {
      return result;
    }
    
    // If it's AddSourceResult (chunked), return it
    return result;
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
   * @deprecated This method is deprecated. Use `addBatch()` with `type: 'gdrive'` instead.
   * 
   * WORKFLOW USAGE:
   * - Returns immediately after source is queued
   * - Use pollProcessing() to check if source is ready
   * - Or use workflow functions that handle waiting automatically
   * - For searching Drive files first, use searchWeb() with sourceType: GOOGLE_DRIVE
   * 
   * **Note:** This method is deprecated. Use `addBatch()` with `type: 'gdrive'` instead.
   * 
   * @param notebookId - The notebook ID
   * @param options - Google Drive file ID and optional metadata
   * 
   * @example
   * ```typescript
   * // DEPRECATED: Use addBatch() instead
   * const sourceId = await client.sources.addGoogleDrive('notebook-id', {
   *   fileId: '1a2b3c4d5e6f7g8h9i0j',
   *   mimeType: 'application/vnd.google-apps.document',
   *   title: 'My Document',
   * });
   * 
   * // RECOMMENDED: Use addBatch() instead
   * const sourceIds = await client.sources.addBatch('notebook-id', {
   *   sources: [{
   *     type: 'gdrive',
   *     fileId: '1a2b3c4d5e6f7g8h9i0j',
   *     mimeType: 'application/vnd.google-apps.document',
   *     title: 'My Document',
   *   }],
   * });
   * ```
   * 
   * **Note:** For finding Drive files, use `searchWeb()` with `sourceType: SearchSourceType.GOOGLE_DRIVE`
   * to search your Drive, then use `addDiscovered()` to add the found files.
   */
  async addGoogleDrive(notebookId: string, options: AddGoogleDriveSourceOptions): Promise<string> {
    console.warn(
      '⚠️  WARNING: sources.addGoogleDrive() is deprecated. ' +
      'Use addBatch() with type: \'gdrive\' instead.'
    );
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
   * **NOTE: For most use cases, use `searchWebAndWait()` instead, which handles the complete workflow automatically.**
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
   * **Simplified Alternative (RECOMMENDED):**
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
    
    // RPC structure from curl: [["query", sourceType], null, researchMode, notebookId]
    // Example: [["photon-hq", 1], null, 1, "notebook-id"]
    const response = await this.rpc.call(
      RPC.RPC_SEARCH_WEB_SOURCES,
      [
        [query, sourceType], // [query, source_type] - 1=WEB, 2=GOOGLE_DRIVE
        null,                // null
        mode,                // research_mode: 1=Fast, 2=Deep
        notebookId,
      ],
      notebookId
    );
    
    // Extract session ID from response
    // Response might be a JSON string like "[\"sessionId\"]" or an array
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use response as-is
      }
    }
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // If it's ["sessionId"], return the first element
      if (data.length > 0 && typeof data[0] === 'string') {
        return data[0];
      }
      // If it's [["sessionId"]], return the nested first element
      if (data.length > 0 && Array.isArray(data[0]) && data[0].length > 0) {
        return data[0][0];
      }
    }
    
    return data?.sessionId || data?.searchId || (typeof data === 'string' ? data : '');
  }
  
  /**
   * Search web sources and wait for results (complete workflow)
   * 
   * **RECOMMENDED METHOD** - Use this instead of `searchWeb()` + `getSearchResults()` manually.
   * 
   * WORKFLOW USAGE:
   * - This is a complete workflow that combines searchWeb() + getSearchResults() with polling
   * - Returns results once they're available (or timeout)
   * - Use the returned sessionId with addDiscovered() to add sources
   * - This is the recommended method for web search workflows
   * - Automatically filters results by sessionId to avoid mixing with previous searches
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
    let lastResultCount = 0;
    let stableCount = 0; // Count consecutive polls with same result count
    
    while (Date.now() - startTime < timeout) {
      results = await this.getSearchResults(notebookId, sessionId);
      
      const hasResults = results.web.length > 0 || results.drive.length > 0;
      const resultCount = results.web.length + results.drive.length;
      
      if (onProgress) {
        onProgress({ hasResults, resultCount });
      }
      
      // If we have results, check if they're stable (same count for 2 consecutive polls)
      // This indicates search is complete
      if (hasResults) {
        if (resultCount === lastResultCount && resultCount > 0) {
          stableCount++;
          // If results are stable for 2 polls, consider search complete
          if (stableCount >= 2) {
            return { sessionId, ...results };
          }
        } else {
          stableCount = 0; // Reset if count changed
        }
        lastResultCount = resultCount;
      } else {
        stableCount = 0;
        lastResultCount = 0;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout reached - return whatever we have (even if empty)
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
   * **Filtering:** If `sessionId` is provided, only results from that session will be returned.
   * Otherwise, results from all sessions will be returned (may include previous searches).
   * 
   * @param notebookId - The notebook ID (must match the notebookId used in step 1)
   * @param sessionId - Optional session ID to filter results to only this search session
   * @returns Discovered sources (web and/or drive)
   * 
   * @example
   * ```typescript
   * // STEP 1: Initiate search first
   * const sessionId = await client.sources.searchWeb('notebook-id', { query: 'AI' });
   * 
   * // STEP 2: Get results (only works after step 1)
   * // Option 1: Get all results (may include previous searches)
   * const results = await client.sources.getSearchResults('notebook-id');
   * 
   * // Option 2: Get results only from current search (recommended)
   * const results = await client.sources.getSearchResults('notebook-id', sessionId);
   * console.log(`Found ${results.web.length} web sources and ${results.drive.length} drive sources`);
   * 
   * // STEP 3: Add selected sources
   * const addedIds = await client.sources.addDiscovered('notebook-id', {
   *   sessionId: sessionId,
   *   webSources: results.web,
   * });
   * ```
   */
  async getSearchResults(notebookId: string, sessionId?: string): Promise<{
    web: DiscoveredWebSource[];
    drive: DiscoveredDriveSource[];
  }> {
    const response = await this.rpc.call(
      RPC.RPC_GET_SEARCH_RESULTS,
      [null, null, notebookId],
      notebookId
    );
    
    // Response structure: [[[sessionId, [notebookId, [query, type], mode, [webSources]], ...]]]
    // Example: [[["0057e489-...", ["notebook-id", ["query", 1], 1, [["url", "title", "description", 1], ...]], ...]]]
    // Web sources are at session[1][4] (index 4 of the metadata array, which is the 5th element)
    
    // Handle JSON string response
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use response as-is
      }
    }
    
    // Extract the sessions array
    // Response might be: [[sessions]] or [sessions] or sessions
    let sessions: any[] = [];
    if (Array.isArray(data)) {
      if (data.length > 0 && Array.isArray(data[0])) {
        // Check if first element is an array of sessions
        if (data[0].length > 0 && Array.isArray(data[0][0])) {
          sessions = data[0]; // [[[session], ...]]
        } else {
          sessions = data; // [[session], ...]
        }
      } else {
        sessions = data; // [session, ...]
      }
    }
    
    const web: DiscoveredWebSource[] = [];
    const drive: DiscoveredDriveSource[] = [];
    
    for (const session of sessions) {
      if (!Array.isArray(session) || session.length < 2) {
        continue;
      }
      
      // session[0] = sessionId
      // session[1] = [notebookId, [query, type], mode, [webSources]]
      // Example: ["9c40da15-...", ["nit kkr", 1], 1, [[["https://...", "title", ...], ...]]]
      const currentSessionId = session[0];
      
      // Filter by sessionId if provided (normalize both to strings for comparison)
      if (sessionId) {
        const normalizedSessionId = String(sessionId).trim();
        const normalizedCurrentId = String(currentSessionId || '').trim();
        if (normalizedSessionId && normalizedCurrentId !== normalizedSessionId) {
          continue; // Skip sessions that don't match
        }
      }
      
      const metadata = session[1];
      if (Array.isArray(metadata) && metadata.length > 3) {
        // Web sources are at metadata[3] (index 3, the 4th element)
        const webSources = metadata[3];
        
        // Skip if webSources is null (search is still in progress)
        if (webSources === null || webSources === undefined) {
          continue;
        }
        
        if (Array.isArray(webSources) && webSources.length > 0) {
          // Helper function to recursively flatten arrays until we find source arrays
          const flattenSources = (arr: any[]): any[] => {
            const result: any[] = [];
            for (const item of arr) {
              if (Array.isArray(item)) {
                // Check if this array looks like a source: [url, title, ...]
                if (item.length >= 2 && typeof item[0] === 'string' && item[0].startsWith('http')) {
                  result.push(item);
                } else {
                  // Recursively flatten nested arrays
                  result.push(...flattenSources(item));
                }
              }
            }
            return result;
          };
          
          // Flatten the webSources array
          const sourcesToProcess = flattenSources(webSources);
          
          // Process all sources
          for (const source of sourcesToProcess) {
            if (Array.isArray(source) && source.length >= 2) {
              // Format: [url, title, description, typeCode?, ...]
              // Check for type indicator in the array - might be at index 3 or later
              const url = source[0];
              const title = source[1];
              
              // Check if there's a type code in the array (typically a number)
              // Common positions: index 2 or 3 might contain type info
              let detectedType: string | undefined;
              for (let i = 2; i < Math.min(source.length, 5); i++) {
                const item = source[i];
                // Type codes: 9 = YouTube, 1 = URL, etc.
                if (typeof item === 'number' && item === 9) {
                  detectedType = 'youtube';
                  break;
                } else if (typeof item === 'number' && item === 1) {
                  detectedType = 'url';
                  break;
                }
              }
              
              // Only add if URL exists, is a string, and is a valid URL
              if (url && typeof url === 'string' && url.startsWith('http')) {
                web.push({
                  url: url,
                  title: (typeof title === 'string' ? title : '') || '',
                  id: url, // Use URL as ID
                  type: detectedType, // Store detected type
                });
              }
            } else if (typeof source === 'object' && source && 'url' in source) {
              web.push({
                url: source.url,
                title: source.title || '',
                id: source.id || source.url,
                type: source.type,
              });
            }
          }
        }
      }
      
      // Drive sources might be at a different index, need to check structure
      // For now, we'll parse drive sources if they exist in the same structure
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
    
    // RPC structure from curl: [null, [1], sessionId, notebookId, [[null, null, [url, title], null, null, null, null, null, null, null, 2]]]
    // Each web source: [null, null, [url, title], null, null, null, null, null, null, null, 2]
    const webSourceArgs = webSources.map(src => [
      null,
      null,
      [src.url, src.title],
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      2, // Type indicator for web source
    ]);
    
    // Drive sources structure (if needed in future)
    const driveSourceArgs = driveSources.map(src => [
      null,
      null,
      [src.fileId, src.title],
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      1, // Type indicator for drive source (if different)
    ]);
    
    const allSources = [...webSourceArgs, ...driveSourceArgs];
    
    const response = await this.rpc.call(
      RPC.RPC_ADD_DISCOVERED_SOURCES,
      [
        null,           // null
        [1],            // [1] - flag
        sessionId,      // session ID from searchWeb
        notebookId,     // notebook ID
        allSources,     // array of source arrays
      ],
      notebookId
    );
    
    const addedIds: string[] = [];
    
    // Handle JSON string response
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // If parsing fails, use response as-is
      }
    }
    
    // Response structure: [[[[sourceId], title, [...metadata...], [null, 2]]]]
    // Example: [[[[\"435170a5-...\"], \"Title\", [...], [null, 2]]]]
    // We need to extract sourceId from the nested structure
    
    // Helper function to recursively find source IDs
    const extractSourceIds = (arr: any): string[] => {
      const ids: string[] = [];
      
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (Array.isArray(item)) {
            // Check if first element is a UUID-like string (source ID)
            if (item.length > 0 && typeof item[0] === 'string' && 
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item[0])) {
              ids.push(item[0]);
            } else {
              // Recursively search nested arrays
              ids.push(...extractSourceIds(item));
            }
          } else if (typeof item === 'string' && 
                     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
            // Direct UUID string
            ids.push(item);
          }
        }
      }
      
      return ids;
    };
    
    // Extract source IDs from the response
    const extractedIds = extractSourceIds(data);
    
    // Remove duplicates and add to result
    const uniqueIds = [...new Set(extractedIds)];
    for (const sourceId of uniqueIds) {
      if (sourceId) {
        addedIds.push(sourceId);
        this.quota?.recordUsage('addSource', notebookId);
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
    
    // Add all sources (may return string or AddSourceResult for text/file)
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
    
    const results = await Promise.all(addPromises);
    
    // Extract source IDs from results (handle both string and AddSourceResult)
    const sourceIds: string[] = [];
    for (const result of results) {
      if (typeof result === 'string') {
        sourceIds.push(result);
      } else if (result && typeof result === 'object' && 'allSourceIds' in result) {
        // Chunked result - add all source IDs
        sourceIds.push(...(result.allSourceIds || []));
      } else if (result && typeof result === 'object' && 'sourceId' in result) {
        // Single source ID in result object
        if (result.sourceId) {
          sourceIds.push(result.sourceId);
        }
      }
    }
    
    // Wait for processing if requested
    if (waitForProcessing) {
      const startTime = Date.now();
      const total = sourceIds.length;
      
      while (Date.now() - startTime < timeout) {
        const status = await this.status(notebookId);
        
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
  /**
   * Get source processing status
   * 
   * **What it does:** Checks the processing status of all sources in a notebook.
   * Returns information about which sources are still processing and whether all sources are ready.
   * 
   * **Input:**
   * - `notebookId` (string, required): The notebook ID
   * 
   * **Output:** Returns a `SourceProcessingStatus` object containing:
   * - `allReady` (boolean): Whether all sources are ready
   * - `processing` (string[]): Array of source IDs that are still processing
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * // Check processing status
   * const status = await client.sources.status('notebook-id');
   * 
   * if (status.allReady) {
   *   console.log('All sources are ready!');
   * } else {
   *   console.log(`Still processing: ${status.processing.length} sources`);
   *   console.log('Processing IDs:', status.processing);
   * }
   * ```
   */
  async status(notebookId: string): Promise<SourceProcessingStatus> {
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
   * @deprecated This method is deprecated. It's only used with loadContent(), 
   * which is also deprecated due to "Service unavailable" errors.
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
    console.warn(
      '⚠️  WARNING: sources.selectSource() is deprecated. ' +
      'It\'s only used with loadContent(), which is also deprecated due to API reliability issues.'
    );
    // RPC structure from curl: [["sourceId"], [2], [2]]
    await this.rpc.call(
      RPC.RPC_LOAD_SOURCE,
      [[sourceId], [2], [2]]
    );
  }
  
  /**
   * Load source content
   * 
   * @deprecated This method is deprecated and may not work reliably.
   * The API endpoint returns "Service unavailable" errors.
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
    console.warn(
      '⚠️  WARNING: sources.loadContent() is deprecated and may not work reliably. ' +
      'The API endpoint returns "Service unavailable" errors.'
    );
    // RPC structure from curl: [[[["sourceId"]]]]
    // Note: Must call selectSource() first before calling this method
    const response = await this.rpc.call(
      RPC.RPC_LOAD_SOURCE_CONTENT,
      [[[[sourceId]]]]
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
   * @deprecated This method is deprecated and may not work reliably.
   * The API endpoint returns "Service unavailable" errors.
   * 
   * WORKFLOW USAGE:
   * - Use this to check if source content is up-to-date
   * - Can be used before refresh() to determine if refresh is needed
   * 
   * @param sourceId - The source ID
   */
  async checkFreshness(sourceId: string): Promise<SourceFreshness> {
    console.warn(
      '⚠️  WARNING: sources.checkFreshness() is deprecated and may not work reliably. ' +
      'The API endpoint returns "Service unavailable" errors.'
    );
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
   * @deprecated This method is deprecated and may not work reliably.
   * The API endpoint may return "Service unavailable" errors.
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
    console.warn(
      '⚠️  WARNING: sources.addDeepResearch() is deprecated and may not work reliably. ' +
      'The API endpoint may return "Service unavailable" errors.'
    );
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
   * @deprecated This method is deprecated and may not work reliably. 
   * The RPC endpoint returns "Service unavailable" errors.
   * 
   * WORKFLOW USAGE:
   * - Use this for bulk operations on multiple sources
   * - Different from update() which works on a single source
   * - Supports various AI-powered content transformation actions
   * 
   * **Note:** This method is deprecated due to API reliability issues.
   * Consider using artifact creation methods (e.g., `sdk.artifacts.create()`) 
   * for similar functionality.
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
    console.warn(
      '⚠️  WARNING: sources.actOn() is deprecated and may not work reliably. ' +
      'The API endpoint returns "Service unavailable" errors. ' +
      'Consider using artifact creation methods instead.'
    );
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
