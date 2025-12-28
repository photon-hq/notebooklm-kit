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
   * Execute an RPC call
   */
  async call(rpcId: string, args: any[], notebookId?: string): Promise<any> {
    // Always log RPC calls
    console.log('\n🔷 RPC Call');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RPC ID:', rpcId);
    console.log('Notebook ID:', notebookId || '(none)');
    
    if (this.config.debug) {
      console.log('Args:', JSON.stringify(args, null, 2));
    } else {
      console.log('Args:', JSON.stringify(args).substring(0, 200));
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
    
    // Always log RPC response
    console.log('\n✅ RPC Response');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RPC ID:', response.id);
    
    if (this.config.debug) {
      console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 1000));
    } else {
      const dataStr = JSON.stringify(response.data);
      console.log('Data (first 300 chars):', dataStr.substring(0, 300));
      if (dataStr.length > 300) {
        console.log(`... (${dataStr.length} total characters)`);
    }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
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

