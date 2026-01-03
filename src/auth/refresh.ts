/**
 * Authentication refresh utilities
 * Keeps NotebookLM sessions alive by refreshing credentials
 * Implements hybrid refresh strategy: expiration-based (primary) + time-based (fallback)
 */

import { createHash } from 'crypto';
import { NotebookLMAuthError } from '../types/common.js';
import type { Credentials } from './auth.js';

/**
 * Google Signaler API configuration
 */
const SIGNALER_API_URL = 'https://signaler-pa.clients6.google.com/punctual/v1/refreshCreds';
// Allow override via environment variable, but use default public Google API key
const SIGNALER_API_KEY = process.env.NOTEBOOKLM_SIGNALER_API_KEY || 'AIzaSyC_pzrI0AjEDXDYcg7kkq3uQEjnXV50pBM';

/**
 * Refresh client for credential refresh
 */
export class RefreshClient {
  private sapisid: string;
  private debug: boolean;
  private cookies: string;
  private onCredentialsUpdate?: (cookies: string) => void;
  
  constructor(
    cookies: string,
    debug: boolean = false,
    onCredentialsUpdate?: (cookies: string) => void
  ) {
    this.cookies = cookies;
    this.debug = debug;
    this.onCredentialsUpdate = onCredentialsUpdate;
    this.sapisid = this.extractCookieValue('SAPISID');
    
    if (!this.sapisid) {
      throw new NotebookLMAuthError('SAPISID not found in cookies');
    }
  }
  
  /**
   * Update cookies (called after refresh to keep credentials in sync)
   */
  updateCookies(cookies: string): void {
    this.cookies = cookies;
    const newSapisid = this.extractCookieValue('SAPISID');
    if (newSapisid) {
      this.sapisid = newSapisid;
    }
  }
  
  /**
   * Get current cookies
   */
  getCookies(): string {
    return this.cookies;
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
    
    // Request body - verified from actual NotebookLM API calls
    const requestBody = JSON.stringify(['8hcNI0LV']);
    
    if (this.debug) {
      console.log('=== Credential Refresh Request ===');
      console.log('URL:', url.toString());
      console.log('Authorization:', `SAPISIDHASH ${timestamp}_${authHash.substring(0, 10)}...`);
      console.log('Request Body:', requestBody);
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
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
    
    // Check for updated cookies in response headers (Set-Cookie)
    // Note: Google may update cookies server-side without returning them
    // We update our cookies if Set-Cookie headers are present
    const setCookieHeaders = response.headers.get('set-cookie');
    if (setCookieHeaders && this.onCredentialsUpdate) {
      // Cookies may have been updated server-side
      // The refresh API typically doesn't return new cookies, but we notify
      // the callback in case credentials need to be refreshed from the browser
      if (this.debug) {
        console.log('Cookie update detected in response');
      }
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
 * Parse auth token to extract expiration time
 * Token format: "tokenValue:timestamp" where timestamp is Unix milliseconds
 * Expiry: timestamp + 1 hour
 */
export function parseAuthToken(token: string): { tokenValue: string; expiryTime: Date } {
  const parts = token.split(':');
  if (parts.length !== 2) {
    throw new NotebookLMAuthError('Invalid token format - expected "token:timestamp"');
  }
  
  const tokenValue = parts[0];
  const timestamp = parseInt(parts[1], 10);
  
  if (isNaN(timestamp)) {
    throw new NotebookLMAuthError('Invalid timestamp in token');
  }
  
  // Convert milliseconds to Date, add 1 hour for expiry
  const expiryTime = new Date(timestamp + 3600000); // + 1 hour in ms
  
  return { tokenValue, expiryTime };
}

/**
 * Extract gsessionid from NotebookLM page
 */
export async function extractGSessionId(cookies: string): Promise<string | null> {
  try {
  const response = await fetch('https://notebooklm.google.com/', {
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    },
  });
  
  if (!response.ok) {
      return null; // Return null instead of throwing - gsessionId is optional
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
  
    return null; // Not found, but not critical
  } catch (error) {
    return null; // Return null on error - gsessionId is optional
  }
}

/**
 * Auto-refresh configuration
 */
export interface AutoRefreshConfig {
  /** Enable auto-refresh */
  enabled: boolean;
  
  /** Refresh strategy: 'auto' | 'time' | 'expiration' */
  strategy?: 'auto' | 'time' | 'expiration';
  
  /** Refresh interval for time-based strategy (ms) - default: 10 minutes */
  interval?: number;
  
  /** Refresh ahead time for expiration-based strategy (ms) - default: 5 minutes before expiry */
  refreshAhead?: number;
  
  /** Check interval for expiration-based strategy (ms) - default: 1 minute */
  checkInterval?: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Google session ID (will be extracted if not provided) */
  gsessionId?: string;
  
  /** Auth token (for expiration-based refresh) */
  authToken?: string;
  
  /** Callback when credentials are updated after refresh */
  onCredentialsUpdate?: (credentials: Credentials) => void;
}

/**
 * Default auto-refresh configuration
 */
export function defaultAutoRefreshConfig(): AutoRefreshConfig {
  return {
    enabled: true,
    strategy: 'auto', // Auto: expiration-based primary, time-based fallback
    interval: 10 * 60 * 1000, // 10 minutes (time-based fallback)
    refreshAhead: 5 * 60 * 1000, // 5 minutes before expiry (expiration-based)
    checkInterval: 60 * 1000, // Check every 1 minute (expiration-based)
    debug: false,
  };
}

/**
 * Auto-refresh manager
 * Automatically refreshes credentials in the background
 * Supports three strategies: 'auto' (expiration-based + time-based fallback), 'time', 'expiration'
 */
export class AutoRefreshManager {
  private refreshClient: RefreshClient;
  private timeIntervalId: NodeJS.Timeout | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private gsessionId?: string | null;
  private authToken?: string;
  private lastRefreshTime: number = 0;
  
  constructor(
    cookies: string,
    private config: AutoRefreshConfig
  ) {
    const onUpdate = (updatedCookies: string) => {
      // Update refresh client cookies
      this.refreshClient.updateCookies(updatedCookies);
      
      // Notify callback if provided
      if (config.onCredentialsUpdate) {
        config.onCredentialsUpdate({
          authToken: this.authToken || '',
          cookies: updatedCookies,
        });
      }
    };
    
    this.refreshClient = new RefreshClient(cookies, config.debug, onUpdate);
    this.authToken = config.authToken;
  }
  
  /**
   * Update auth token (for expiration-based refresh)
   */
  updateAuthToken(authToken: string): void {
    this.authToken = authToken;
  }
  
  /**
   * Update cookies
   */
  updateCookies(cookies: string): void {
    this.refreshClient.updateCookies(cookies);
  }
  
  /**
   * Start auto-refresh
   * 
   * @example
   * ```typescript
   * const manager = new AutoRefreshManager(cookies, {
   *   enabled: true,
   *   strategy: 'auto', // or 'time' or 'expiration'
   *   interval: 10 * 60 * 1000, // 10 minutes (time-based)
   *   refreshAhead: 5 * 60 * 1000, // 5 minutes before expiry (expiration-based)
   * });
   * 
   * await manager.start();
   * ```
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Auto-refresh manager already running');
    }
    
    const strategy = this.config.strategy || 'auto';
    const interval = this.config.interval || 10 * 60 * 1000;
    const refreshAhead = this.config.refreshAhead || 5 * 60 * 1000;
    const checkInterval = this.config.checkInterval || 60 * 1000;
    
    // Extract gsessionId if not provided (optional, but recommended)
    if (!this.config.gsessionId) {
      this.gsessionId = await extractGSessionId(this.refreshClient.getCookies());
      if (!this.gsessionId && this.config.debug) {
        console.log('Note: gsessionId not found, refresh will continue without it');
      }
    } else {
      this.gsessionId = this.config.gsessionId;
    }
    
    // Do initial refresh to verify credentials work
    try {
      await this.performRefresh();
      this.lastRefreshTime = Date.now();
      
      if (this.config.debug) {
        console.log('Initial credential refresh successful');
      }
    } catch (error) {
      if (this.config.debug) {
        console.warn('Initial refresh failed, continuing anyway:', (error as Error).message);
      }
      // Don't throw - allow refresh to continue and retry later
    }
    
    this.running = true;
    
    // Start expiration-based checking (if enabled in 'auto' or 'expiration' mode)
    if (strategy === 'expiration' || strategy === 'auto') {
      if (this.authToken) {
        this.checkIntervalId = setInterval(() => {
          this.checkAndRefreshExpiration(refreshAhead).catch(err => {
            if (this.config.debug) {
              console.error('Expiration check failed:', err);
            }
            // In 'auto' mode, fallback to time-based if expiration check fails
            if (strategy === 'auto' && !this.timeIntervalId) {
              if (this.config.debug) {
                console.log('Falling back to time-based refresh due to expiration check failure');
              }
            }
          });
        }, checkInterval);
        
        if (this.config.debug) {
          const modeText = strategy === 'auto' ? 'auto (expiration-based primary)' : 'expiration-based';
          console.log(`Auto-refresh started (${modeText}, checking every ${checkInterval}ms)`);
        }
      } else if (strategy === 'expiration') {
        throw new Error('Auth token required for expiration-based strategy');
      } else if (this.config.debug && strategy === 'auto') {
        console.log('Note: Auth token not provided, using time-based refresh only');
      }
    }
    
    // Start time-based refresh (if enabled in 'auto' or 'time' mode, or as fallback)
    if (strategy === 'time' || strategy === 'auto') {
      this.timeIntervalId = setInterval(async () => {
        try {
          await this.performRefresh();
          this.lastRefreshTime = Date.now();
          
          if (this.config.debug) {
            const modeText = strategy === 'auto' ? 'time-based (fallback)' : 'time-based';
            console.log(`Credentials refreshed (${modeText})`);
        }
      } catch (error) {
        if (this.config.debug) {
            console.error('Time-based refresh failed:', (error as Error).message);
        }
      }
      }, interval);
      
      if (this.config.debug && strategy === 'time') {
        console.log(`Auto-refresh started (time-based, interval: ${interval}ms)`);
      } else if (this.config.debug && strategy === 'auto') {
        console.log(`Time-based fallback enabled (interval: ${interval}ms)`);
      }
    }
  }
  
  /**
   * Check if token needs refresh based on expiration
   */
  private async checkAndRefreshExpiration(refreshAhead: number): Promise<void> {
    if (!this.authToken) {
      return; // Can't check expiration without token
    }
    
    try {
      const { expiryTime } = parseAuthToken(this.authToken);
      const timeUntilExpiry = expiryTime.getTime() - Date.now();
      
      if (timeUntilExpiry > refreshAhead) {
        // Token still valid, no refresh needed
        if (this.config.debug && timeUntilExpiry < refreshAhead * 2) {
          // Only log when getting close to refresh time
          const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
          console.log(`Token valid for ${minutesUntilExpiry} more minutes, no refresh needed`);
        }
        return;
      }
      
      // Token expiring soon, refresh now
      if (this.config.debug) {
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);
        console.log(`Token expiring in ${minutesUntilExpiry} minutes, refreshing now...`);
      }
      
      await this.performRefresh();
      this.lastRefreshTime = Date.now();
      
      if (this.config.debug) {
        console.log('Credentials refreshed (expiration-based)');
      }
    } catch (error) {
      // Token parsing failed, fall back to time-based if hybrid
    if (this.config.debug) {
        console.warn('Failed to parse token for expiration check:', (error as Error).message);
      }
      throw error;
    }
  }
  
  /**
   * Perform actual refresh operation
   */
  private async performRefresh(): Promise<void> {
    await this.refreshClient.refreshCredentials(this.gsessionId || undefined);
  }
  
  /**
   * Stop auto-refresh
   */
  stop(): void {
    if (this.timeIntervalId) {
      clearInterval(this.timeIntervalId);
      this.timeIntervalId = null;
    }
    
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
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
    await this.performRefresh();
    this.lastRefreshTime = Date.now();
  }
  
  /**
   * Get last refresh time
   */
  getLastRefreshTime(): number {
    return this.lastRefreshTime;
  }
}

