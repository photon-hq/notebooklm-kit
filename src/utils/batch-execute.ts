/**
 * Batch execute client for NotebookLM RPC calls
 * Full-fledged implementation matching nlm Go version
 */

import type {
  BatchExecuteConfig,
  RPCCall,
  RPCResponse,
} from '../types/common.js';
import { NotebookLMError as ErrorClass, NotebookLMAuthError as AuthErrorClass, NotebookLMNetworkError as NetworkErrorClass } from '../types/common.js';
import { parseChunkedResponse } from './chunked-decoder.js';
import { isErrorResponse } from './errors.js';

/**
 * Request ID generator for batchexecute requests
 */
class ReqIDGenerator {
  private base: number;
  private sequence: number = 0;
  
  constructor() {
    // Generate random 4-digit number (1000-9999)
    this.base = Math.floor(Math.random() * 9000) + 1000;
  }
  
  next(): string {
    const reqid = this.base + (this.sequence * 100000);
    this.sequence++;
    return reqid.toString();
  }
  
  reset(): void {
    this.sequence = 0;
  }
}

/**
 * Batch execute client
 */
export class BatchExecuteClient {
  private config: BatchExecuteConfig;
  
  /**
   * Update cookies (called when credentials are refreshed)
   */
  updateCookies(cookies: string): void {
    this.config.cookies = cookies;
  }
  private reqidGenerator: ReqIDGenerator;
  
  constructor(config: BatchExecuteConfig) {
    // Get retry config from env vars or config, with very low defaults
    const getEnvNumber = (key: string, defaultValue: number): number => {
      try {
        const value = process.env[key];
        if (value) {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      } catch {
        // Ignore env access errors
      }
      return defaultValue;
    };
    
    // Set default retry configuration (very conservative - most requests succeed on first try)
    // Defaults: 1 retry, 1s delay, 5s max delay
    const maxRetries = config.maxRetries ?? getEnvNumber('NOTEBOOKLM_MAX_RETRIES', 1);
    const retryDelay = config.retryDelay ?? getEnvNumber('NOTEBOOKLM_RETRY_DELAY', 1000);
    const retryMaxDelay = config.retryMaxDelay ?? getEnvNumber('NOTEBOOKLM_RETRY_MAX_DELAY', 5000);
    
    this.config = {
      ...config,
      maxRetries,
      retryDelay,
      retryMaxDelay,
    };
    
    this.reqidGenerator = new ReqIDGenerator();
  }
  
  /**
   * Execute a single RPC call
   */
  async do(rpc: RPCCall): Promise<RPCResponse> {
    return this.execute([rpc]);
  }
  
  /**
   * Execute one or more RPC calls
   */
  async execute(rpcs: RPCCall[]): Promise<RPCResponse> {
    const protocol = 'https';
    const baseUrl = `${protocol}://${this.config.host}/_/${this.config.app}/data/batchexecute`;
    
    // Build URL with query parameters
    const url = new URL(baseUrl);
    url.searchParams.set('rpcids', rpcs.map(r => r.id).join(','));
    url.searchParams.set('_reqid', this.reqidGenerator.next());
    
    // Add URL parameters from config
    for (const [key, value] of Object.entries(this.config.urlParams)) {
      url.searchParams.set(key, value);
    }
    
    // Add request-specific URL parameters from first RPC
    if (rpcs[0].urlParams) {
      for (const [key, value] of Object.entries(rpcs[0].urlParams)) {
        url.searchParams.set(key, value);
      }
    }
    
    // Build request body
    const envelope = rpcs.map(rpc => this.buildRPCData(rpc));
    const reqBody = JSON.stringify([envelope]);
    
    // Build form data
    const formData = new URLSearchParams();
    formData.set('f.req', reqBody);
    formData.set('at', this.config.authToken);
    
    if (this.config.debug) {
      console.log('\n📡 BatchExecute Request');
      console.log('URL:', url.toString());
      console.log('RPC IDs:', rpcs.map(r => r.id).join(', '));
      console.log('Request Body:', reqBody);
    }
    
    // Execute request with retry logic
    let lastError: Error | null = null;
    let lastResponseStatus: number | undefined;
    let lastResponseBody: string | undefined;
    
    // Use configured retry values (guaranteed to be defined after constructor)
    const maxRetries = this.config.maxRetries!;
    const retryDelay = this.config.retryDelay!;
    const retryMaxDelay = this.config.retryMaxDelay!;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 && this.config.debug) {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries}`);
      }
      if (attempt > 0) {
        // Calculate retry delay with exponential backoff
        const multiplier = Math.pow(2, attempt - 1);
          let delay = retryDelay * multiplier;
          if (delay > retryMaxDelay) {
            delay = retryMaxDelay;
        }
        await this.sleep(delay);
      }
      
      try {
        // Create request headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Cookie': this.config.cookies,
          ...this.config.headers,
        };
        
        let response: Response;
        try {
          response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: formData.toString(),
        });
        } catch (fetchError) {
          const errorMsg = (fetchError as Error)?.message || String(fetchError);
          if (this.config.debug) {
            console.error('\n❌ Fetch Error:', errorMsg);
          console.error('URL:', url.toString());
          }
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        lastResponseStatus = response.status;
        
        // Read response body first (before checking status)
        let body: string;
        try {
          body = await response.text();
          lastResponseBody = body;
        } catch (readError) {
          const errorMsg = (readError as Error)?.message || String(readError);
          if (this.config.debug) {
            console.error('\n❌ Error Reading Response Body:', errorMsg);
          console.error('Response status:', response.status);
          }
          lastError = readError instanceof Error ? readError : new Error(String(readError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        if (this.config.debug) {
          console.log('Response Status:', response.status, response.statusText);
          console.log('Response Body:', body);
        }
        
        // Check if we should retry based on status
        if (this.isRetryableStatus(response.status) && attempt < maxRetries) {
          lastError = new Error(`Server returned status ${response.status}: ${response.statusText}`);
          if (this.config.debug) {
            console.log(`Retryable status ${response.status}, retrying...`);
          }
          continue;
        }
        
        // Check for auth errors (401 - do not retry, credentials are invalid)
        if (response.status === 401) {
          throw new AuthErrorClass('Authentication failed (401). Please check your credentials.');
        }
        
        // Check for other error statuses
        if (!response.ok) {
          throw new ErrorClass(`Request failed: ${response.status} ${response.statusText}`, response.status);
        }
        
        // Decode response
        let responses: RPCResponse[];
        try {
          responses = this.decodeResponse(body);
        } catch (decodeError) {
          const errorMsg = (decodeError as Error)?.message || String(decodeError);
          if (this.config.debug) {
            console.error('\n❌ Error Decoding Response:', errorMsg);
            console.error('Response status:', response.status);
            console.error('Response body:', body);
          }
          lastError = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        if (responses.length === 0) {
          throw new ErrorClass('No valid responses found in server response');
        }
        
        // Check for API errors in first response
        const firstResponse = responses[0];
        const apiError = isErrorResponse(firstResponse);
        if (apiError) {
          throw apiError;
        }
        
        // Log success only in debug mode
        if (this.config.debug) {
          console.log('✅ BatchExecute successful');
        }
        
        return firstResponse;
        
      } catch (error) {
        // Ensure we have an Error object
        if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error(String(error) || 'Unknown error');
        }
        
        // Log error (simplified)
        const errorMsg = (error as Error)?.message || String(error);
        if (this.config.debug) {
          console.error(`\n❌ Error (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMsg);
          if (lastResponseStatus !== undefined) {
            console.error('Response status:', lastResponseStatus);
          }
        }
        
        // Check if error is retryable
        if (error instanceof ErrorClass && 'isRetryable' in error) {
          const retryable = (error as any).isRetryable?.() ?? false;
          if (retryable && attempt < maxRetries) {
            console.log('Error is retryable, will retry...');
            continue;
          }
        }
        
        if (this.isRetryableError(error as Error) && attempt < maxRetries) {
          console.log('Error is retryable, will retry...');
          continue;
        }
        
        // Non-retryable error or max retries reached
        throw error;
      }
    }
    
    // All retries failed - build comprehensive error message
    console.error('\n❌ All Retry Attempts Failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Total attempts:', maxRetries + 1);
    
    let errorMessage = 'Unknown error';
    if (lastError) {
      errorMessage = lastError.message || lastError.toString() || String(lastError) || 'Unknown error';
      console.error('Last error message:', errorMessage);
      if (lastError.stack) {
        console.error('Last error stack:', lastError.stack);
      }
    } else {
      console.error('No error object captured');
    }
    
    if (lastResponseStatus !== undefined) {
      errorMessage += ` (HTTP ${lastResponseStatus})`;
    }
    
    if (lastResponseBody !== undefined && lastResponseBody.length < 500) {
      errorMessage += ` - ${lastResponseBody}`;
    }
    
    throw new NetworkErrorClass(`All retry attempts failed: ${errorMessage}`, lastError || undefined);
  }
  
  /**
   * Build RPC data array
   */
  private buildRPCData(rpc: RPCCall): any[] {
    const argsJSON = JSON.stringify(rpc.args);
    
    return [
      rpc.id,
      argsJSON,
      null,
      'generic',
    ];
  }
  
  /**
   * Decode batchexecute response
   */
  private decodeResponse(raw: string): RPCResponse[] {
    // Remove the standard prefix
    raw = raw.trim().replace(/^\)\]\}'/, '');
    
    if (!raw) {
      throw new ErrorClass('Empty response after trimming prefix');
    }
    
    // Check if response starts with a digit (chunked format)
    if (/^\d/.test(raw)) {
      return parseChunkedResponse(raw, this.config.debug);
    }
    
    // Try to parse as regular JSON array
    let responses: any[][];
    try {
      responses = JSON.parse(raw);
    } catch (error) {
      // Try parsing as numeric error code
      const trimmed = raw.trim();
      const code = parseInt(trimmed, 10);
      
      if (!isNaN(code) && trimmed.length <= 10) {
        // Single numeric error code
        return [{
          index: 0,
          id: 'numeric',
          data: code,
        }];
      }
      
      // Try to parse as single array
      try {
        const singleArray = JSON.parse(raw);
        if (Array.isArray(singleArray)) {
          responses = [singleArray];
        } else {
          throw error;
        }
      } catch {
        throw new ErrorClass(`Failed to parse response: ${(error as Error).message}`);
      }
    }
    
    const result: RPCResponse[] = [];
    
    for (const rpcData of responses) {
      if (rpcData.length < 7) {
        continue;
      }
      
      const rpcType = rpcData[0];
      if (rpcType !== 'wrb.fr') {
        continue;
      }
      
      const id = rpcData[1] as string;
      const response: RPCResponse = {
        id,
        index: 0,
        data: null,
      };
      
      // Try position 2 first for data
      let responseData: any = null;
      
      if (rpcData[2] !== null) {
        if (typeof rpcData[2] === 'string') {
          response.data = rpcData[2];
          responseData = rpcData[2];
        } else {
          responseData = rpcData[2];
        }
      }
      
      // If position 2 is null/empty, try position 5
      if (responseData === null && rpcData.length > 5 && rpcData[5] !== null) {
        responseData = rpcData[5];
      }
      
      // Convert responseData to final form
      if (responseData !== null && response.data === null) {
        response.data = responseData;
      }
      
      // Parse index
      if (rpcData[6] === 'generic') {
        response.index = 0;
      } else if (typeof rpcData[6] === 'string') {
        response.index = parseInt(rpcData[6], 10) || 0;
      }
      
      result.push(response);
    }
    
    if (result.length === 0) {
      throw new ErrorClass('No valid responses found in parsed data');
    }
    
    return result;
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    const retryablePatterns = [
      'connection refused',
      'connection reset',
      'timeout',
      'tls handshake',
      'econnreset',
      'enotfound',
      'network',
      'temporary failure',
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
  
  /**
   * Check if HTTP status is retryable
   */
  private isRetryableStatus(statusCode: number): boolean {
    return [429, 500, 502, 503, 504].includes(statusCode);
  }
  
  /**
   * Mask sensitive value for logging
   */
  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    } else if (value.length <= 16) {
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    } else {
      return value.substring(0, 3) + '*'.repeat(value.length - 6) + value.substring(value.length - 3);
    }
  }
  
  /**
   * Mask cookie values for logging
   */
  private maskCookieValues(cookies: string): string {
    const parts = cookies.split(';');
    const masked = parts.map(part => {
      const trimmed = part.trim();
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const name = trimmed.substring(0, equalIndex);
        const value = trimmed.substring(equalIndex + 1);
        return `${name}=${this.maskSensitiveValue(value)}`;
      }
      return trimmed;
    });
    
    return masked.join('; ');
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current config
   */
  getConfig(): BatchExecuteConfig {
    return { ...this.config };
  }
}
