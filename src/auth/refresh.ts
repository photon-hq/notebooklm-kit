/**
 * Authentication refresh utilities
 * Keeps NotebookLM sessions alive by refreshing credentials
 */

import { createHash } from 'crypto';
import { NotebookLMAuthError } from '../types/common.js';

/**
 * Google Signaler API configuration
 */
const SIGNALER_API_URL = 'https://signaler-pa.clients6.google.com/punctual/v1/refreshCreds';
const SIGNALER_API_KEY = 'AIzaSyC_pzrI0AjEDXDYcg7kkq3uQEjnXV50pBM';

/**
 * Refresh client for credential refresh
 */
export class RefreshClient {
  private sapisid: string;
  private debug: boolean;
  
  constructor(
    private cookies: string,
    debug: boolean = false
  ) {
    this.debug = debug;
    this.sapisid = this.extractCookieValue('SAPISID');
    
    if (!this.sapisid) {
      throw new NotebookLMAuthError('SAPISID not found in cookies');
    }
  }
  
  /**
   * Refresh credentials
   * 
   * @param gsessionId - Google session ID (optional)
   * 
   * @example
   * ```typescript
   * const refreshClient = new RefreshClient(cookies);
   * await refreshClient.refreshCredentials();
   * ```
   */
  async refreshCredentials(gsessionId?: string): Promise<void> {
    const url = new URL(SIGNALER_API_URL);
    url.searchParams.set('key', SIGNALER_API_KEY);
    
    if (gsessionId) {
      url.searchParams.set('gsessionid', gsessionId);
    }
    
    // Generate SAPISIDHASH for authorization
    const timestamp = Math.floor(Date.now() / 1000);
    const authHash = this.generateSAPISIDHASH(timestamp);
    
    // Request body
    const requestBody = JSON.stringify(['tZf5V3ry']);
    
    if (this.debug) {
      console.log('=== Credential Refresh Request ===');
      console.log('URL:', url.toString());
      console.log('Authorization:', `SAPISIDHASH ${timestamp}_${authHash.substring(0, 10)}...`);
    }
    
    // Make request
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Authorization': `SAPISIDHASH ${timestamp}_${authHash}`,
        'Content-Type': 'application/json+protobuf',
        'Cookie': this.cookies,
        'Origin': 'https://notebooklm.google.com',
        'Referer': 'https://notebooklm.google.com/',
        'X-Goog-AuthUser': '0',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      },
      body: requestBody,
    });
    
    if (this.debug) {
      console.log('=== Credential Refresh Response ===');
      console.log('Status:', response.status, response.statusText);
    }
    
    if (!response.ok) {
      const body = await response.text();
      throw new NotebookLMAuthError(`Refresh failed with status ${response.status}: ${body}`);
    }
    
    if (this.debug) {
      console.log('Credentials refreshed successfully');
    }
  }
  
  /**
   * Generate SAPISIDHASH
   * Format: SHA1(timestamp + " " + SAPISID + " " + origin)
   */
  private generateSAPISIDHASH(timestamp: number): string {
    const origin = 'https://notebooklm.google.com';
    const data = `${timestamp} ${this.sapisid} ${origin}`;
    
    const hash = createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
  }
  
  /**
   * Extract cookie value by name
   */
  private extractCookieValue(name: string): string {
    const parts = this.cookies.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith(`${name}=`)) {
        return trimmed.substring(name.length + 1);
      }
    }
    return '';
  }
}

/**
 * Extract gsessionid from NotebookLM page
 */
export async function extractGSessionId(cookies: string): Promise<string> {
  const response = await fetch('https://notebooklm.google.com/', {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    },
  });
  
  if (!response.ok) {
    throw new NotebookLMAuthError(`Failed to fetch NotebookLM page: ${response.status}`);
  }
  
  const body = await response.text();
  
  // Look for gsessionid in the page
  const patterns = [
    /"gsessionid"\s*:\s*"([^"]+)"/,
    /gsessionid\s*=\s*['"]([^'"]+)['"]/,
  ];
  
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  throw new NotebookLMAuthError('gsessionid not found in page');
}

/**
 * Auto-refresh configuration
 */
export interface AutoRefreshConfig {
  /** Enable auto-refresh */
  enabled: boolean;
  
  /** Refresh interval (ms) */
  interval: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Google session ID (will be extracted if not provided) */
  gsessionId?: string;
}

/**
 * Default auto-refresh configuration
 */
export function defaultAutoRefreshConfig(): AutoRefreshConfig {
  return {
    enabled: true,
    interval: 10 * 60 * 1000, // 10 minutes
    debug: false,
  };
}

/**
 * Auto-refresh manager
 * Automatically refreshes credentials in the background
 */
export class AutoRefreshManager {
  private refreshClient: RefreshClient;
  private intervalId: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private gsessionId?: string;
  
  constructor(
    cookies: string,
    private config: AutoRefreshConfig
  ) {
    this.refreshClient = new RefreshClient(cookies, config.debug);
  }
  
  /**
   * Start auto-refresh
   * 
   * @example
   * ```typescript
   * const manager = new AutoRefreshManager(cookies, {
   *   enabled: true,
   *   interval: 10 * 60 * 1000, // 10 minutes
   * });
   * 
   * await manager.start();
   * ```
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Auto-refresh manager already running');
    }
    
    // Extract gsessionId if not provided
    if (!this.config.gsessionId) {
      try {
        this.gsessionId = await extractGSessionId(this.refreshClient['cookies']);
      } catch (error) {
        if (this.config.debug) {
          console.log('Failed to extract gsessionId, continuing without it:', (error as Error).message);
        }
      }
    } else {
      this.gsessionId = this.config.gsessionId;
    }
    
    // Do initial refresh
    try {
      await this.refreshClient.refreshCredentials(this.gsessionId);
      
      if (this.config.debug) {
        console.log('Initial credential refresh successful');
      }
    } catch (error) {
      throw new NotebookLMAuthError(`Initial refresh failed: ${(error as Error).message}`);
    }
    
    // Start periodic refresh
    this.running = true;
    this.intervalId = setInterval(async () => {
      try {
        await this.refreshClient.refreshCredentials(this.gsessionId);
        
        if (this.config.debug) {
          console.log('Credentials refreshed successfully');
        }
      } catch (error) {
        if (this.config.debug) {
          console.error('Auto-refresh failed:', (error as Error).message);
        }
      }
    }, this.config.interval);
    
    if (this.config.debug) {
      console.log(`Auto-refresh started with ${this.config.interval}ms interval`);
    }
  }
  
  /**
   * Stop auto-refresh
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.running = false;
    
    if (this.config.debug) {
      console.log('Auto-refresh stopped');
    }
  }
  
  /**
   * Check if auto-refresh is running
   */
  isRunning(): boolean {
    return this.running;
  }
  
  /**
   * Manually trigger a refresh
   */
  async refresh(): Promise<void> {
    await this.refreshClient.refreshCredentials(this.gsessionId);
  }
}

