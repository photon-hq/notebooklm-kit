/**
 * Main NotebookLM Client
 * Provides high-level interface for NotebookLM operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import { NotebooksService } from '../services/notebooks.js';
import { SourcesService } from '../services/sources.js';
import { NotesService } from '../services/notes.js';
import { ArtifactsService } from '../services/artifacts.js';
import { GenerationService } from '../services/generation.js';
import { NotebookLanguageService } from '../services/notebook-language.js';
import { AutoRefreshManager, defaultAutoRefreshConfig } from '../auth/refresh.js';
import { getCredentials, type Credentials } from '../auth/auth.js';
import { QuotaManager } from '../utils/quota.js';
import type { NotebookLMConfig } from '../types/common.js';

/**
 * NotebookLM Client
 * 
 * Main entry point for interacting with Google NotebookLM API.
 * Provides a simple, organized interface to all NotebookLM features.
 * 
 * **Features:**
 * - **Notebooks:** Create, list, update, delete notebooks
 * - **Sources:** Add URLs, text, files, YouTube videos, Google Drive files, web search
 * - **Notes:** Create and manage notes within notebooks
 * - **Artifacts:** Generate quizzes, flashcards, study guides, mind maps, infographics, slides, reports, audio, video
 * - **Generation:** Chat with notebooks, generate guides, outlines, and reports
 * - **Auto-Refresh:** Automatically keeps sessions alive (enabled by default)
 * - **Quota Management:** Tracks and enforces NotebookLM usage limits
 * 
 * **Usage:**
 * ```typescript
 * const sdk = new NotebookLMClient({
 *   authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
 *   cookies: process.env.NOTEBOOKLM_COOKIES!,
 * });
 * 
 * // Access services
 * const notebooks = await sdk.notebooks.list();
 * const notebook = await sdk.notebooks.create({ title: 'My Research' });
 * await sdk.sources.addFromURL(notebook.projectId, { url: 'https://example.com' });
 * const response = await sdk.generation.chat(notebook.projectId, 'Summarize this');
 * ```
 * 
 * **Service Organization:**
 * - `sdk.notebooks` - Notebook/project operations
 * - `sdk.sources` - Source management (URLs, files, YouTube, Drive, web search)
 * - `sdk.notes` - Note operations
 * - `sdk.artifacts` - Artifact creation and management
 * - `sdk.generation` - Chat and content generation
 * 
 * **Auto-Refresh:**
 * Credentials are automatically refreshed every 10 minutes (configurable) to keep sessions alive.
 * Set `autoRefresh: false` to disable, or customize with `autoRefresh: { interval: 5 * 60 * 1000 }`.
 * 
 * **Quota Management:**
 * The SDK automatically tracks and enforces NotebookLM limits (100 notebooks, 50 chats/day, etc.).
 * Use `sdk.getUsage()` to check current usage and `sdk.getRemaining('chats')` for remaining quota.
 * 
 * **Cleanup:**
 * Always call `sdk.dispose()` when done to stop auto-refresh and clean up resources.
 */
export class NotebookLMClient {
  private rpcClient?: RPCClient;
  private refreshManager?: AutoRefreshManager;
  private quotaManager: QuotaManager;
  private config: NotebookLMConfig;
  private credentials?: Credentials;
  private initialized: boolean = false;
  
  private _notebooks?: NotebooksService;
  private _sources?: SourcesService;
  private _notes?: NotesService;
  private _artifacts?: ArtifactsService;
  private _generation?: GenerationService;
  private _notebookLanguage?: NotebookLanguageService;
  
  /**
   * Notebook operations
   * Create, list, get, update, delete notebooks
   * 
   * @example
   * ```typescript
   * const notebooks = await sdk.notebooks.list();
   * const notebook = await sdk.notebooks.create({ title: 'Research', emoji: '📚' });
   * await sdk.notebooks.update(notebook.projectId, { title: 'Updated Title' });
   * ```
   */
  get notebooks(): NotebooksService {
    if (!this._notebooks) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._notebooks;
  }
  
  /**
   * Source operations
   * Add sources from URLs, text, files, YouTube, Google Drive, web search
   * 
   * @example
   * ```typescript
   * await sdk.sources.addFromURL('notebook-id', { url: 'https://example.com' });
   * await sdk.sources.addFromText('notebook-id', { title: 'Notes', content: '...' });
   * await sdk.sources.addYouTube('notebook-id', { urlOrId: 'video-id' });
   * ```
   */
  get sources(): SourcesService {
    if (!this._sources) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._sources;
  }
  
  /**
   * Note operations
   * Create, list, update, delete notes within notebooks
   * 
   * @example
   * ```typescript
   * const notes = await sdk.notes.list('notebook-id');
   * const note = await sdk.notes.create('notebook-id', { title: 'Note', content: '...' });
   * ```
   */
  get notes(): NotesService {
    if (!this._notes) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._notes;
  }
  
  /**
   * Artifact operations
   * Create and manage artifacts: quizzes, flashcards, study guides, mind maps,
   * infographics, slide decks, reports, audio overviews, video overviews
   * 
   * @example
   * ```typescript
   * const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   instructions: 'Create 10 questions',
   * });
   * const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
   *   instructions: 'Focus on key findings',
   * });
   * ```
   */
  get artifacts(): ArtifactsService {
    if (!this._artifacts) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._artifacts;
  }
  
  /**
   * Generation operations
   * Chat with notebooks, generate guides, outlines, reports
   * 
   * @example
   * ```typescript
   * const response = await sdk.generation.chat('notebook-id', 'What are the key findings?');
   * const guide = await sdk.generation.generateNotebookGuide('notebook-id');
   * ```
   */
  get generation(): GenerationService {
    if (!this._generation) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._generation;
  }
  
  /**
   * Notebook language operations
   * Get and set the notebook's default output language
   * 
   * The notebook's default output language is used as the default for:
   * - Artifact creation (audio, video, report, infographics, slide decks)
   * - Chat responses
   * - All other notebook operations
   * 
   * @example
   * ```typescript
   * import { NotebookLMLanguage } from 'notebooklm-kit';
   * 
   * // Get current default language
   * const language = await sdk.notebookLanguage.get('notebook-id');
   * 
   * // Set default language to German
   * await sdk.notebookLanguage.set('notebook-id', NotebookLMLanguage.GERMAN);
   * 
   * // Now all artifacts will default to German unless overridden
   * const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
   *   // language will default to German
   * });
   * ```
   */
  get notebookLanguage(): NotebookLanguageService {
    if (!this._notebookLanguage) {
      throw new Error('SDK not initialized. Call await sdk.connect() first.');
    }
    return this._notebookLanguage;
  }
  
  /**
   * Create a new NotebookLM client
   * 
   * **Auto-Refresh Configuration:**
   * 
   * The SDK automatically keeps your session alive by refreshing credentials periodically.
   * This prevents session expiration during long-running operations.
   * 
   * - **Default behavior:** Auto-refresh is enabled by default with a 10-minute interval
   * - **Custom interval:** Set `autoRefresh: { enabled: true, interval: 5 * 60 * 1000 }` for 5 minutes
   * - **Disable:** Set `autoRefresh: false` to disable automatic refresh
   * - **Initial refresh:** Credentials are refreshed immediately when the client is created
   * - **Background refresh:** Subsequent refreshes happen automatically at the configured interval
   * 
   * **Refresh Intervals:**
   * - Recommended: 5-10 minutes (300,000 - 600,000 ms)
   * - Minimum: 1 minute (60,000 ms) - not recommended as it may be too frequent
   * - Maximum: 30 minutes (1,800,000 ms) - sessions may expire before refresh
   * 
   * **Example configurations:**
   * ```typescript
   * // Default: Auto-refresh enabled, 10-minute interval
   * const client = new NotebookLMClient({
   *   authToken: '...',
   *   cookies: '...',
   * });
   * 
   * // Custom 5-minute interval
   * const client = new NotebookLMClient({
   *   authToken: '...',
   *   cookies: '...',
   *   autoRefresh: {
   *     enabled: true,
   *     interval: 5 * 60 * 1000, // 5 minutes
   *   },
   * });
   * 
   * // Disable auto-refresh
   * const client = new NotebookLMClient({
   *   authToken: '...',
   *   cookies: '...',
   *   autoRefresh: false,
   * });
   * ```
   * 
   * @param config - Client configuration
   * 
   * @example
   * ```typescript
   * const client = new NotebookLMClient({
   *   authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
   *   cookies: process.env.NOTEBOOKLM_COOKIES!,
   * });
   * 
   * const notebooks = await client.notebooks.list();
   * ```
   */
  constructor(config: NotebookLMConfig = {}) {
    // Auto-enable debug mode from environment variable if not explicitly set
    // Supports: NOTEBOOKLM_DEBUG=true, DEBUG=true, or NODE_ENV=development
    const envDebug = process.env.NOTEBOOKLM_DEBUG === 'true' || 
                     process.env.DEBUG === 'true' || 
                     process.env.NODE_ENV === 'development';
    
    // Store config for lazy initialization
    // If debug is not explicitly set in config, use environment variable
    this.config = {
      ...config,
      debug: config.debug !== undefined ? config.debug : envDebug,
    };
    this.quotaManager = new QuotaManager(
      config.enforceQuotas === true, // Default to false
      config.plan || 'standard' // Default to standard plan
    );
    
    // Services will be initialized when connect() is called
  }
  
  /**
   * Connect / Initialize the client
   * Loads credentials (from config, env, saved, or auto-login) and sets up services
   * This must be called before using any services
   * 
   * @example
   * ```typescript
   * const sdk = new NotebookLMClient({});
   * await sdk.connect();
   * const notebooks = await sdk.notebooks.list();
   * ```
   */
  async connect(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // Get credentials (from config, env, saved, or auto-login)
    const credentials = await getCredentials(
      {
        authToken: this.config.authToken,
        cookies: this.config.cookies,
      },
      {
        email: this.config.auth?.email,
        password: this.config.auth?.password,
        headless: this.config.auth?.headless ?? true,
        debug: this.config.debug,
      }
    );
    
    this.credentials = credentials;
    
    // Create RPC client with credentials
    this.rpcClient = new RPCClient({
      authToken: credentials.authToken,
      cookies: credentials.cookies,
      debug: this.config.debug,
      authUser: this.config.authUser,
      headers: this.config.headers,
      urlParams: this.config.urlParams,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      retryMaxDelay: this.config.retryMaxDelay,
    });
    
    // Create services
    this._notebooks = new NotebooksService(this.rpcClient, this.quotaManager);
    this._sources = new SourcesService(this.rpcClient, this.quotaManager);
    this._notes = new NotesService(this.rpcClient, this.quotaManager);
    this._artifacts = new ArtifactsService(this.rpcClient, this.quotaManager);
    this._generation = new GenerationService(this.rpcClient, this.quotaManager);
    this._notebookLanguage = new NotebookLanguageService(this.rpcClient);
    
    // Setup auto-refresh if enabled
    if (this.config.autoRefresh !== false) {
      const autoRefreshConfig = this.config.autoRefresh;
      const refreshConfig = typeof autoRefreshConfig === 'boolean' || autoRefreshConfig === undefined
        ? defaultAutoRefreshConfig()
        : {
            enabled: autoRefreshConfig.enabled !== false,
            strategy: autoRefreshConfig.strategy || 'auto',
            interval: autoRefreshConfig.interval || 10 * 60 * 1000,
            refreshAhead: autoRefreshConfig.refreshAhead || 5 * 60 * 1000,
            checkInterval: autoRefreshConfig.checkInterval || 60 * 1000,
            gsessionId: autoRefreshConfig.gsessionId,
            authToken: credentials.authToken,
            debug: this.config.debug,
            onCredentialsUpdate: (updated: Credentials) => {
              // Update credentials and RPC client when refreshed
              this.credentials = updated;
              if (this.rpcClient) {
                this.rpcClient.updateCookies(updated.cookies);
              }
            },
          };
      
      this.refreshManager = new AutoRefreshManager(credentials.cookies, refreshConfig);
      
      // Start auto-refresh asynchronously
      this.refreshManager.start().catch(error => {
        if (this.config.debug) {
          console.error('Failed to start auto-refresh:', error.message);
        }
      });
    }
    
    this.initialized = true;
  }
  
  /**
   * Ensure client is connected (called before operations)
   */
  private async ensureConnected(): Promise<void> {
    if (!this.initialized) {
      await this.connect();
    }
  }
  
  /**
   * Get RPC client (ensures connection)
   */
  private async getRPCClientInternal(): Promise<RPCClient> {
    await this.ensureConnected();
    if (!this.rpcClient) {
      throw new Error('RPC client not initialized');
    }
    return this.rpcClient;
  }
  
  // ========================================================================
  // Advanced Access Methods
  // ========================================================================
  
  /**
   * Get the underlying RPC client
   * For advanced use cases where you need direct RPC access
   * 
   * @returns The RPC client instance
   */
  async getRPCClient(): Promise<RPCClient> {
    return this.getRPCClientInternal();
  }
  
  /**
   * Execute a raw RPC call
   * For advanced use cases where you need to call an RPC method directly
   * 
   * @param rpcId - The RPC method ID (e.g., from RPCMethods)
   * @param args - Arguments for the RPC call
   * @param notebookId - Optional notebook ID for context
   * @returns The RPC response
   * 
   * @example
   * ```typescript
   * import { RPCMethods } from 'notebooklm-kit';
   * 
   * const response = await sdk.rpc(
   *   RPCMethods.RPC_LIST_PROJECTS,
   *   []
   * );
   * ```
   */
  async rpc(rpcId: string, args: any[], notebookId?: string): Promise<any> {
    const rpc = await this.getRPCClientInternal();
    return rpc.call(rpcId, args, notebookId);
  }
  
  // ========================================================================
  // Auto-Refresh Methods
  // ========================================================================
  
  /**
   * Get the refresh manager (if auto-refresh is enabled)
   * 
   * @returns The auto-refresh manager, or undefined if disabled
   */
  getRefreshManager(): AutoRefreshManager | undefined {
    return this.refreshManager;
  }
  
  /**
   * Manually refresh credentials
   * Useful for keeping long-running sessions alive or testing refresh functionality
   * 
   * @throws Error if auto-refresh is not enabled
   * 
   * @example
   * ```typescript
   * // Manual refresh
   * await sdk.refreshCredentials();
   * 
   * // Check if refresh is running
   * const manager = sdk.getRefreshManager();
   * if (manager?.isRunning()) {
   *   console.log('Auto-refresh is active');
   * }
   * ```
   */
  async refreshCredentials(): Promise<void> {
    if (this.refreshManager) {
      await this.refreshManager.refresh();
    } else {
      throw new Error('Auto-refresh not enabled. Set autoRefresh: true in config.');
    }
  }
  
  // ========================================================================
  // Quota Management Methods
  // ========================================================================
  
  /**
   * Get quota manager
   * For advanced quota management and custom tracking
   * 
   * @returns The quota manager instance
   */
  getQuotaManager(): QuotaManager {
    return this.quotaManager;
  }
  
  /**
   * Get current usage statistics
   * Returns daily and monthly usage for all tracked resources
   * 
   * @returns Usage data including daily chats, audio, video, artifacts, etc.
   * 
   * @example
   * ```typescript
   * const usage = sdk.getUsage();
   * console.log(`Chats: ${usage.daily.chats}/50`);
   * console.log(`Audio: ${usage.daily.audioOverviews}/3`);
   * console.log(`Video: ${usage.daily.videoOverviews}/3`);
   * console.log(`Quizzes: ${usage.daily.quizzes}/10`);
   * console.log(`Flashcards: ${usage.daily.flashcards}/10`);
   * console.log(`Reports: ${usage.daily.reports}/10`);
   * console.log(`Notebooks: ${usage.notebooks.total}/100`);
   * ```
   */
  getUsage() {
    return this.quotaManager.getUsage();
  }
  
  /**
   * Get remaining quota for a resource
   * 
   * @param resource - Resource name: 'chats', 'audioOverviews', 'videoOverviews', 
   *                   'quizzes', 'flashcards', 'reports', 'createNotebook', etc.
   * @returns Number of remaining uses for the resource
   * 
   * @example
   * ```typescript
   * const remainingChats = sdk.getRemaining('chats');
   * const remainingAudio = sdk.getRemaining('audioOverviews');
   * 
   * console.log(`${remainingChats} chats remaining today`);
   * console.log(`${remainingAudio} audio overviews remaining today`);
   * 
   * if (remainingChats === 0) {
   *   console.log('Daily chat limit reached');
   * }
   * ```
   */
  getRemaining(resource: string): number {
    return this.quotaManager.getRemaining(resource);
  }
  
  // ========================================================================
  // Cleanup Methods
  // ========================================================================
  
  /**
   * Dispose of the client and stop auto-refresh
   * Call this when you're done with the client to clean up resources.
   * This stops the background auto-refresh timer.
   * 
   * @example
   * ```typescript
   * const sdk = new NotebookLMClient({ ... });
   * await sdk.connect();
   * 
   * // Use the client...
   * await sdk.notebooks.list();
   * 
   * // Clean up when done
   * sdk.dispose();
   * ```
   */
  dispose(): void {
    if (this.refreshManager) {
      this.refreshManager.stop();
      this.refreshManager = undefined;
    }
    this.initialized = false;
  }
}

/**
 * Create a NotebookLM client with environment variables
 * Reads NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES from environment
 * Note: Only works in Node.js environment
 * 
 * @example
 * ```typescript
 * const client = createNotebookLMClient();
 * const notebooks = await client.notebooks.list();
 * ```
 */
export function createNotebookLMClient(config?: Partial<NotebookLMConfig>): NotebookLMClient {
  // Safe access to process.env for Node.js environments
  const getEnv = (key: string): string => {
    try {
      // Use globalThis to safely access process in Node.js
      const proc = (globalThis as any).process;
      return (proc?.env?.[key] as string) || '';
    } catch {
      return '';
    }
  };
  
  const authToken = config?.authToken || getEnv('NOTEBOOKLM_AUTH_TOKEN');
  const cookies = config?.cookies || getEnv('NOTEBOOKLM_COOKIES');
  
  return new NotebookLMClient({
    authToken,
    cookies,
    ...config,
  });
}

