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
      maxRetries: config.maxRetries ?? 1,
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
    
    // Always log batch execute calls (not just in debug mode)
    console.log('\n📡 BatchExecute Request');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('URL:', url.toString());
    
    if (this.config.debug) {
      console.log('Full URL:', url.toString());
    }
    
    // Build request body
    const envelope = rpcs.map(rpc => this.buildRPCData(rpc));
    const reqBody = JSON.stringify([envelope]);
    
    // Build form data
    const formData = new URLSearchParams();
    formData.set('f.req', reqBody);
    formData.set('at', this.config.authToken);
    
    // Always log request details
    console.log('RPC IDs:', rpcs.map(r => r.id).join(', '));
    console.log('Request ID:', url.searchParams.get('_reqid'));
    console.log('Auth Token:', this.maskSensitiveValue(this.config.authToken));
    
    if (this.config.debug) {
      console.log('\nRequest Body (first 500 chars):', reqBody.substring(0, 500));
      console.log('Full Request Body:', reqBody);
    } else {
      console.log('Request Body (first 200 chars):', reqBody.substring(0, 200));
    }
    
    // Execute request with retry logic
    let lastError: Error | null = null;
    let lastResponseStatus: number | undefined;
    let lastResponseBody: string | undefined;
    
    // Ensure maxRetries is a valid number
    const maxRetries = this.config.maxRetries ?? 1;
    const retryDelay = this.config.retryDelay ?? 1000;
    const retryMaxDelay = this.config.retryMaxDelay ?? 10000;
    
    console.log('Retry Configuration:');
    console.log('  maxRetries:', maxRetries);
    console.log('  retryDelay:', retryDelay, 'ms');
    console.log('  retryMaxDelay:', retryMaxDelay, 'ms');
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.log(`\n🔄 Attempt ${attempt + 1}/${maxRetries + 1}`);
      if (attempt > 0) {
        // Calculate retry delay with exponential backoff
        const multiplier = Math.pow(2, attempt - 1);
          let delay = retryDelay * multiplier;
          if (delay > retryMaxDelay) {
            delay = retryMaxDelay;
        }
        
          console.log(`⏳ Waiting ${delay}ms before retry...`);
        
        await this.sleep(delay);
      }
      
      try {
        // Parse and validate cookies
        const cookieParts = this.config.cookies.split(';').map(c => c.trim()).filter(c => c);
        const cookieMap: Record<string, string> = {};
        cookieParts.forEach(cookie => {
          const [name, ...valueParts] = cookie.split('=');
          if (name && valueParts.length > 0) {
            cookieMap[name] = valueParts.join('=');
          }
        });
        
        // Check for required cookies
        const requiredCookies = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
        // Critical HttpOnly cookies (must be manually extracted from DevTools)
        const criticalHttpOnlyCookies = [
          '__Secure-1PSID',
          '__Secure-3PSID',
          'OSID',
          '__Secure-OSID',
          '__Secure-ENID',
          '__Secure-BUCKET',
          '__Secure-1PSIDTS',
          '__Secure-3PSIDTS',
          '__Secure-1PSIDCC',
          '__Secure-3PSIDCC',
          'AEC',
          'NID'
        ];
        
        const missingRequired = requiredCookies.filter(name => !cookieMap[name]);
        const missingCritical = criticalHttpOnlyCookies.filter(name => !cookieMap[name]);
        
        console.log('\n🍪 Cookie Analysis:');
        console.log('  Total cookies:', cookieParts.length);
        console.log('\n  Required cookies:');
        requiredCookies.forEach(name => {
          const present = cookieMap[name] ? '✅' : '❌';
          console.log(`    ${present} ${name}`);
        });
        console.log('\n  Critical HttpOnly cookies (must extract from DevTools):');
        criticalHttpOnlyCookies.forEach(name => {
          const present = cookieMap[name] ? '✅' : '❌';
          console.log(`    ${present} ${name}`);
        });
        
        if (missingRequired.length > 0) {
          console.error(`\n⚠️  Missing required cookies: ${missingRequired.join(', ')}`);
        }
        
        if (missingCritical.length > 0) {
          console.error(`\n⚠️  Missing critical HttpOnly cookies: ${missingCritical.join(', ')}`);
          console.error('   These cookies are HttpOnly and cannot be accessed via JavaScript.');
          console.error('   You must manually copy them from Chrome DevTools:');
          console.error('   1. Open DevTools (F12) → Application → Cookies → https://notebooklm.google.com');
          console.error('   2. Copy the cookie values and add them to your NOTEBOOKLM_COOKIES string');
          console.error('   3. The most critical ones are: __Secure-1PSID, __Secure-3PSID, OSID, __Secure-OSID');
        }
        
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
        } else {
          // Always show masked cookie header
          console.log('\nCookie Header (masked):', this.maskCookieValues(this.config.cookies));
        }
        
        // Make the request
        console.log('\n📤 Making HTTP Request');
        console.log('URL:', url.toString());
        console.log('Method: POST');
        
        let response: Response;
        try {
          response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: formData.toString(),
        });
        } catch (fetchError) {
          console.error('\n❌ Fetch Error (Network/Connection)');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Error type:', fetchError?.constructor?.name || typeof fetchError);
          console.error('Error message:', (fetchError as Error)?.message || String(fetchError));
          if (fetchError instanceof Error && fetchError.stack) {
            console.error('Stack trace:', fetchError.stack);
          }
          console.error('URL:', url.toString());
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        lastResponseStatus = response.status;
        
        // Always log response status and headers
        console.log('\n📥 BatchExecute Response');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Status:', response.status, response.statusText);
        console.log('Status OK:', response.ok);
        
        if (this.config.debug) {
          console.log('Response Headers:');
          response.headers.forEach((value, key) => {
            console.log(`  ${key}: ${value}`);
          });
        }
        
        // Read response body first (before checking status)
        let body: string;
        try {
          body = await response.text();
          lastResponseBody = body;
        } catch (readError) {
          console.error('\n❌ Error Reading Response Body');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Error type:', readError?.constructor?.name || typeof readError);
          console.error('Error message:', (readError as Error)?.message || String(readError));
          if (readError instanceof Error && readError.stack) {
            console.error('Stack trace:', readError.stack);
          }
          console.error('Response status:', response.status);
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          lastError = readError instanceof Error ? readError : new Error(String(readError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        if (this.config.debug) {
          console.log('Response Body (first 1000 chars):', body.substring(0, 1000));
          console.log('Full Response Body:', body);
        } else {
          console.log('Response Body (first 300 chars):', body.substring(0, 300));
        }
        
        // Check if we should retry based on status
        if (this.isRetryableStatus(response.status) && attempt < maxRetries) {
          lastError = new Error(`Server returned status ${response.status}: ${response.statusText}`);
          console.log(`Server returned retryable status ${response.status}, will retry...`);
          continue;
        }
        
        // Check for auth errors (401 - do not retry, credentials are invalid)
        if (response.status === 401) {
          console.error('\n❌ Authentication Error (401) - Not Retrying');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Status: 401 Unauthorized');
          console.error('This indicates your auth token or cookies are invalid/expired.');
          console.error('Please refresh your credentials and try again.');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          throw new AuthErrorClass('Authentication failed. Please check your credentials.');
        }
        
        // Check for other error statuses
        if (!response.ok) {
          const errorMsg = body ? `Request failed: ${response.status} ${response.statusText}. Response: ${body.substring(0, 200)}` : `Request failed: ${response.status} ${response.statusText}`;
          throw new ErrorClass(errorMsg, response.status);
        }
        
        // Decode response
        let responses: RPCResponse[];
        try {
          responses = this.decodeResponse(body);
        } catch (decodeError) {
          console.error('\n❌ Error Decoding Response');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Error type:', decodeError?.constructor?.name || typeof decodeError);
          console.error('Error message:', (decodeError as Error)?.message || String(decodeError));
          if (decodeError instanceof Error && decodeError.stack) {
            console.error('Stack trace:', decodeError.stack);
          }
          console.error('Response status:', response.status);
          console.error('Response body length:', body.length);
          if (this.config.debug) {
            console.error('Response body:', body);
          } else {
            console.error('Response body (first 1000 chars):', body.substring(0, 1000));
          }
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          lastError = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
          if (this.isRetryableError(lastError) && attempt < maxRetries) {
            continue;
          }
          throw lastError;
        }
        
        if (responses.length === 0) {
          console.error('❌ No valid responses found in server response');
          throw new ErrorClass('No valid responses found in server response');
        }
        
        // Always log decoded response count
        console.log(`Decoded ${responses.length} response(s)`);
        
        // Check for API errors in first response
        const firstResponse = responses[0];
        const apiError = isErrorResponse(firstResponse);
        if (apiError) {
          console.error('❌ API Error detected:', apiError.message);
          if (this.config.debug) {
            console.error('Error details:', JSON.stringify(apiError, null, 2));
          }
          throw apiError;
        }
        
        // Log success
        console.log('✅ BatchExecute successful');
        if (this.config.debug) {
          console.log('Response data (first 500 chars):', JSON.stringify(firstResponse.data, null, 2).substring(0, 500));
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        return firstResponse;
        
      } catch (error) {
        // Ensure we have an Error object
        if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error(String(error) || 'Unknown error');
        }
        
        // Always log errors with full details
        console.error('\n❌ BatchExecute Error (Attempt ' + (attempt + 1) + '/' + (maxRetries + 1) + ')');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Error type:', error?.constructor?.name || typeof error);
        console.error('Error message:', (error as Error)?.message || String(error));
        
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:');
          console.error(error.stack);
        }
        
        if (error instanceof Error && 'cause' in error && error.cause) {
          console.error('Error cause:', error.cause);
        }
        
        if (lastResponseStatus !== undefined) {
          console.error('Response status:', lastResponseStatus);
        } else {
          console.error('Response status: (no response received)');
        }
        
        if (lastResponseBody !== undefined) {
          console.error('Response body length:', lastResponseBody.length);
          if (this.config.debug) {
            console.error('Full response body:', lastResponseBody);
          } else {
            console.error('Response body (first 1000 chars):', lastResponseBody.substring(0, 1000));
            if (lastResponseBody.length > 1000) {
              console.error(`... (${lastResponseBody.length - 1000} more characters)`);
            }
          }
        } else {
          console.error('Response body: (no response body received)');
        }
        
        if (this.config.debug) {
          console.error('Full error object:', error);
          if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error properties:', Object.keys(error));
          }
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
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
      console.error('Last response status:', lastResponseStatus);
    } else {
      console.error('No response status received');
    }
    
    if (lastResponseBody !== undefined) {
      console.error('Last response body length:', lastResponseBody.length);
      if (lastResponseBody.length < 1000) {
        errorMessage += ` - Response: ${lastResponseBody}`;
        console.error('Last response body:', lastResponseBody);
      } else {
        console.error('Last response body (first 1000 chars):', lastResponseBody.substring(0, 1000));
        errorMessage += ` - Response: ${lastResponseBody.substring(0, 500)}...`;
      }
    } else {
      console.error('No response body received');
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
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
