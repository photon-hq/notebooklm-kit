/**
 * RPC client for NotebookLM
 * Wraps the batch execute client with NotebookLM-specific configuration
 */

import { BatchExecuteClient } from '../utils/batch-execute.js';
import type { BatchExecuteConfig, RPCCall, RPCResponse } from '../types/common.js';

/**
 * RPC client configuration
 */
export interface RPCClientConfig {
  authToken: string;
  cookies: string;
  debug?: boolean;
  authUser?: string;
  headers?: Record<string, string>;
  urlParams?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
  retryMaxDelay?: number;
}

/**
 * NotebookLM RPC client
 */
export class RPCClient {
  private batchClient: BatchExecuteClient;
  private config: RPCClientConfig;
  
  constructor(config: RPCClientConfig) {
    this.config = config;
    
    // Build batch execute config
    const batchConfig: BatchExecuteConfig = {
      host: 'notebooklm.google.com',
      app: 'LabsTailwindUi',
      authToken: config.authToken,
      cookies: config.cookies,
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'origin': 'https://notebooklm.google.com',
        'referer': 'https://notebooklm.google.com/',
        'x-same-domain': '1',
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        ...config.headers,
      },
      urlParams: {
        // Update to January 2025 build version
        'bl': 'boq_labs-tailwind-frontend_20250129.00_p0',
        'f.sid': '-7121977511756781186',
        'hl': 'en',
        'authuser': config.authUser || '0', // Default: 0, configurable for multi-account support
        ...config.urlParams,
      },
      debug: config.debug,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      retryMaxDelay: config.retryMaxDelay,
    };
    
    this.batchClient = new BatchExecuteClient(batchConfig);
  }
  
  /**
   * Update cookies (called when credentials are refreshed)
   */
  updateCookies(cookies: string): void {
    this.config.cookies = cookies;
    // Update batch client cookies
    this.batchClient.updateCookies(cookies);
  }
  
  /**
   * Get current cookies
   */
  getCookies(): string {
    return this.config.cookies;
  }
  
  /**
   * Execute an RPC call
   */
  async call(rpcId: string, args: any[], notebookId?: string): Promise<any> {
    if (this.config.debug) {
      console.log('\n🔷 RPC Call:', rpcId);
      console.log('Args:', JSON.stringify(args, null, 2));
    }
    
    // Create request-specific URL parameters
    const urlParams: Record<string, string> = {};
    
    if (notebookId) {
      urlParams['source-path'] = `/notebook/${notebookId}`;
    } else {
      urlParams['source-path'] = '/';
    }
    
    const rpcCall: RPCCall = {
      id: rpcId,
      args,
      notebookId,
      urlParams,
    };
    
    const response = await this.batchClient.do(rpcCall);
    
    if (this.config.debug) {
      console.log('✅ RPC Response:', response.id);
      console.log('Data:', JSON.stringify(response.data, null, 2));
    }
    
    return response.data;
  }
  
  /**
   * Get the underlying batch client
   */
  getBatchClient(): BatchExecuteClient {
    return this.batchClient;
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): RPCClientConfig {
    return { ...this.config };
  }
  
  /**
   * Get the current cookies
   */
  getCookies(): string {
    return this.config.cookies;
  }
}

