/**
 * Main NotebookLM Client
 * Provides high-level interface for NotebookLM operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import { NotebooksService } from '../services/notebooks.js';
import { SourcesService } from '../services/sources.js';
import { NotesService } from '../services/notes.js';
import { AudioService } from '../services/audio.js';
import { VideoService } from '../services/video.js';
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
  
  /** Audio overview operations */
  public readonly audio: AudioService;
  
  /** Video overview operations */
  public readonly video: VideoService;
  
  /** Artifact operations */
  public readonly artifacts: ArtifactsService;
  
  /** Generation operations (guides, outlines, chat) */
  public readonly generation: GenerationService;
  
  /**
   * Create a new NotebookLM client
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
    this.audio = new AudioService(this.rpcClient, this.quotaManager);
    this.video = new VideoService(this.rpcClient, this.quotaManager);
    this.artifacts = new ArtifactsService(this.rpcClient, this.quotaManager);
    this.generation = new GenerationService(this.rpcClient, this.quotaManager);
    
    // Setup auto-refresh if enabled
    if (config.autoRefresh) {
      const refreshConfig = typeof config.autoRefresh === 'boolean'
        ? defaultAutoRefreshConfig()
        : {
            enabled: config.autoRefresh.enabled,
            interval: config.autoRefresh.interval || 10 * 60 * 1000,
            gsessionId: config.autoRefresh.gsessionId,
            debug: config.debug,
          };
      
      this.refreshManager = new AutoRefreshManager(config.cookies, refreshConfig);
      
      // Start auto-refresh asynchronously (don't block constructor)
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

