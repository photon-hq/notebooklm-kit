/**
 * Common types used throughout the NotebookLM SDK
 */

/**
 * Configuration for the NotebookLM client
 */
export interface NotebookLMConfig {
  /** Authentication token (SAPISID or __Secure-1PSID from cookies) */
  authToken: string;
  
  /** Cookie string from NotebookLM session */
  cookies: string;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Google account user index (0, 1, 2, etc.) - for multi-account support 
   * Default: '0' 
   * Use '1' or '2' if you have multiple Google accounts signed in
   */
  authUser?: string;
  
  /** Custom HTTP headers */
  headers?: Record<string, string>;
  
  /** Custom URL parameters */
  urlParams?: Record<string, string>;
  
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  
  /** Initial delay between retries (ms) */
  retryDelay?: number;
  
  /** Maximum delay between retries (ms) */
  retryMaxDelay?: number;
  
  /** Request timeout (ms) */
  timeout?: number;
  
  /** Auto-refresh credentials to keep session alive */
  autoRefresh?: boolean | {
    /** Enable auto-refresh */
    enabled: boolean;
    /** Refresh interval in ms (default: 10 minutes) */
    interval?: number;
    /** Google session ID (will be extracted if not provided) */
    gsessionId?: string;
  };
  
  /** Enable client-side quota tracking and enforcement (default: true) */
  enforceQuotas?: boolean;
}

/**
 * RPC call representation
 */
export interface RPCCall {
  /** RPC endpoint ID */
  id: string;
  
  /** Arguments for the call */
  args: any[];
  
  /** Optional notebook ID for context */
  notebookId?: string;
  
  /** Request-specific URL parameters */
  urlParams?: Record<string, string>;
}

/**
 * RPC response
 */
export interface RPCResponse {
  /** Response index */
  index: number;
  
  /** RPC ID */
  id: string;
  
  /** Response data */
  data: any;
  
  /** Error message if any */
  error?: string;
}

/**
 * Batch execute configuration
 */
export interface BatchExecuteConfig {
  host: string;
  app: string;
  authToken: string;
  cookies: string;
  headers: Record<string, string>;
  urlParams: Record<string, string>;
  debug?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  retryMaxDelay?: number;
}

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Error class for NotebookLM API errors
 */
export class NotebookLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'NotebookLMError';
    Object.setPrototypeOf(this, NotebookLMError.prototype);
  }
}

/**
 * Authentication error
 */
export class NotebookLMAuthError extends NotebookLMError {
  constructor(message: string = 'Authentication failed. Please check your credentials.') {
    super(message, 401);
    this.name = 'NotebookLMAuthError';
    Object.setPrototypeOf(this, NotebookLMAuthError.prototype);
  }
}

/**
 * Network error
 */
export class NotebookLMNetworkError extends NotebookLMError {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NotebookLMNetworkError';
    Object.setPrototypeOf(this, NotebookLMNetworkError.prototype);
  }
}

/**
 * Parse error
 */
export class NotebookLMParseError extends NotebookLMError {
  constructor(message: string, public readonly rawData?: string) {
    super(message);
    this.name = 'NotebookLMParseError';
    Object.setPrototypeOf(this, NotebookLMParseError.prototype);
  }
}

