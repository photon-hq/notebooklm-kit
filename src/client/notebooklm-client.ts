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
import { AutoRefreshManager, defaultAutoRefreshConfig } from '../auth/refresh.js';
import { QuotaManager } from '../utils/quota.js';
import type { NotebookLMConfig } from '../types/common.js';

/**
 * NotebookLM Client
 * Main entry point for interacting with NotebookLM API
 */
export class NotebookLMClient {
  private rpcClient: RPCClient;
  private refreshManager?: AutoRefreshManager;
  private quotaManager: QuotaManager;
  
  /** Notebook operations */
  public readonly notebooks: NotebooksService;
  
  /** Source operations */
  public readonly sources: SourcesService;
  
  /** Note operations */
  public readonly notes: NotesService;
  
  /** Artifact operations (includes audio, video, quizzes, flashcards, etc.) */
  public readonly artifacts: ArtifactsService;
  
  /** Generation operations (guides, outlines, chat) */
  public readonly generation: GenerationService;
  
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
  constructor(config: NotebookLMConfig) {
    // Validate required fields
    if (!config.authToken) {
      throw new Error('authToken is required. Set NOTEBOOKLM_AUTH_TOKEN environment variable or pass it in config.');
    }
    
    if (!config.cookies) {
      throw new Error('cookies is required. Set NOTEBOOKLM_COOKIES environment variable or pass it in config.');
    }
    
    // Create RPC client
    this.rpcClient = new RPCClient({
      authToken: config.authToken,
      cookies: config.cookies,
      debug: config.debug,
      headers: config.headers,
      urlParams: config.urlParams,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      retryMaxDelay: config.retryMaxDelay,
    });
    
    // Initialize quota manager (enabled by default)
    this.quotaManager = new QuotaManager(config.enforceQuotas !== false);
    
    // Initialize services with quota manager
    this.notebooks = new NotebooksService(this.rpcClient, this.quotaManager);
    this.sources = new SourcesService(this.rpcClient, this.quotaManager);
    this.notes = new NotesService(this.rpcClient, this.quotaManager);
    this.artifacts = new ArtifactsService(this.rpcClient, this.quotaManager);
    this.generation = new GenerationService(this.rpcClient, this.quotaManager);
    
    // Setup auto-refresh if enabled
    // Default: enabled with 10-minute interval
    // Set autoRefresh: false to disable, or configure custom interval
    if (config.autoRefresh !== false) {
      const autoRefreshConfig = config.autoRefresh;
      const refreshConfig = typeof autoRefreshConfig === 'boolean' || autoRefreshConfig === undefined
        ? defaultAutoRefreshConfig()
        : {
            enabled: autoRefreshConfig.enabled !== false,
            interval: autoRefreshConfig.interval || 10 * 60 * 1000, // Default: 10 minutes
            gsessionId: autoRefreshConfig.gsessionId,
            debug: config.debug,
          };
      
      this.refreshManager = new AutoRefreshManager(config.cookies, refreshConfig);
      
      // Start auto-refresh asynchronously (don't block constructor)
      // Initial refresh happens immediately, then periodic refreshes at configured interval
      this.refreshManager.start().catch(error => {
        if (config.debug) {
          console.error('Failed to start auto-refresh:', error.message);
        }
      });
    }
  }
  
  /**
   * Get the underlying RPC client
   * For advanced use cases where you need direct RPC access
   */
  getRPCClient(): RPCClient {
    return this.rpcClient;
  }
  
  /**
   * Execute a raw RPC call
   * For advanced use cases where you need to call an RPC method directly
   * 
   * @param rpcId - The RPC method ID
   * @param args - Arguments for the RPC call
   * @param notebookId - Optional notebook ID for context
   */
  async rpc(rpcId: string, args: any[], notebookId?: string): Promise<any> {
    return this.rpcClient.call(rpcId, args, notebookId);
  }
  
  /**
   * Get the refresh manager (if auto-refresh is enabled)
   */
  getRefreshManager(): AutoRefreshManager | undefined {
    return this.refreshManager;
  }
  
  /**
   * Manually refresh credentials
   * Useful for keeping long-running sessions alive
   * 
   * @example
   * ```typescript
   * await client.refreshCredentials();
   * ```
   */
  async refreshCredentials(): Promise<void> {
    if (this.refreshManager) {
      await this.refreshManager.refresh();
    } else {
      throw new Error('Auto-refresh not enabled. Set autoRefresh: true in config.');
    }
  }
  
  /**
   * Get quota manager
   */
  getQuotaManager(): QuotaManager {
    return this.quotaManager;
  }
  
  /**
   * Get current usage statistics
   * 
   * @example
   * ```typescript
   * const usage = client.getUsage();
   * console.log(`Chats: ${usage.daily.chats}/50`);
   * console.log(`Audio: ${usage.daily.audioOverviews}/3`);
   * console.log(`Artifacts created: ${usage.daily.createReport || 0}`);
   * ```
   */
  getUsage() {
    return this.quotaManager.getUsage();
  }
  
  /**
   * Get remaining quota for a resource
   * 
   * @example
   * ```typescript
   * const remaining = client.getRemaining('chats');
   * console.log(`${remaining} chats remaining today`);
   * ```
   */
  getRemaining(resource: string): number {
    return this.quotaManager.getRemaining(resource);
  }
  
  /**
   * Dispose of the client and stop auto-refresh
   * Call this when you're done with the client to clean up resources
   */
  dispose(): void {
    if (this.refreshManager) {
      this.refreshManager.stop();
    }
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

