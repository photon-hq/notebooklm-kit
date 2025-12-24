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
  private reqidGenerator: ReqIDGenerator;
  
  constructor(config: BatchExecuteConfig) {
    // Set default retry configuration
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryMaxDelay: config.retryMaxDelay ?? 10000,
      ...config,
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
    
    if (this.config.debug) {
      console.log('\n=== BatchExecute Request ===');
      console.log('URL:', url.toString());
    }
    
    // Build request body
    const envelope = rpcs.map(rpc => this.buildRPCData(rpc));
    const reqBody = JSON.stringify([envelope]);
    
    // Build form data
    const formData = new URLSearchParams();
    formData.set('f.req', reqBody);
    formData.set('at', this.config.authToken);
    
    if (this.config.debug) {
      console.log('\nRequest Body (first 500 chars):', reqBody.substring(0, 500));
      console.log('\nAuth Token:', this.maskSensitiveValue(this.config.authToken));
    }
    
    // Execute request with retry logic
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      if (attempt > 0) {
        // Calculate retry delay with exponential backoff
        const multiplier = Math.pow(2, attempt - 1);
        let delay = this.config.retryDelay! * multiplier;
        if (delay > this.config.retryMaxDelay!) {
          delay = this.config.retryMaxDelay!;
        }
        
        if (this.config.debug) {
          console.log(`\nRetrying request (attempt ${attempt}/${this.config.maxRetries}) after ${delay}ms...`);
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
        
        if (this.config.debug) {
          console.log('\nRequest Headers:');
          for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === 'cookie') {
              console.log(`${key}: ${this.maskCookieValues(value)}`);
            } else {
              console.log(`${key}: ${value}`);
            }
          }
        }
        
        // Make the request
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: formData.toString(),
        });
        
        if (this.config.debug) {
          console.log('\nResponse Status:', response.status, response.statusText);
        }
        
        // Check if we should retry based on status
        if (this.isRetryableStatus(response.status) && attempt < this.config.maxRetries!) {
          lastError = new Error(`Server returned status ${response.status}`);
          continue;
        }
        
        // Check for auth errors
        if (response.status === 401) {
          throw new AuthErrorClass('Authentication failed. Please check your credentials.');
        }
        
        // Check for other error statuses
        if (!response.ok) {
          throw new ErrorClass(
            `Request failed: ${response.status} ${response.statusText}`,
            response.status
          );
        }
        
        // Read response body
        const body = await response.text();
        
        if (this.config.debug) {
          console.log('\nRaw Response Body (first 1000 chars):', body.substring(0, 1000));
        }
        
        // Decode response
        const responses = this.decodeResponse(body);
        
        if (responses.length === 0) {
          throw new ErrorClass('No valid responses found in server response');
        }
        
        // Check for API errors in first response
        const firstResponse = responses[0];
        const apiError = isErrorResponse(firstResponse);
        if (apiError) {
          if (this.config.debug) {
            console.log('Detected API error:', apiError.message);
          }
          throw apiError;
        }
        
        return firstResponse;
        
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (error instanceof ErrorClass && 'isRetryable' in error) {
          const retryable = (error as any).isRetryable?.() ?? false;
          if (retryable && attempt < this.config.maxRetries!) {
            continue;
          }
        }
        
        if (this.isRetryableError(error as Error) && attempt < this.config.maxRetries!) {
          continue;
        }
        
        // Non-retryable error or max retries reached
        throw error;
      }
    }
    
    // All retries failed
    throw new NetworkErrorClass(`All retry attempts failed: ${lastError?.message}`, lastError || undefined);
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
