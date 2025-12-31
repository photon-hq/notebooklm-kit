/**
 * Common types used throughout the NotebookLM SDK
 */

/**
 * Configuration for the NotebookLM client
 */
export interface NotebookLMConfig {
  /** Authentication token (optional - can be provided via env, saved credentials, or auto-login) */
  authToken?: string;
  
  /** Cookie string from NotebookLM session (optional - can be provided via env, saved credentials, or auto-login) */
  cookies?: string;
  
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
    enabled?: boolean;
    /** Refresh strategy: 'auto' | 'time' | 'expiration' (default: 'auto') */
    strategy?: 'auto' | 'time' | 'expiration';
    /** Refresh interval for time-based strategy (ms) - default: 10 minutes */
    interval?: number;
    /** Refresh ahead time for expiration-based strategy (ms) - default: 5 minutes before expiry */
    refreshAhead?: number;
    /** Check interval for expiration-based strategy (ms) - default: 1 minute */
    checkInterval?: number;
    /** Google session ID (optional, will be extracted if not provided) */
    gsessionId?: string;
  };
  
  /** Auto-login configuration (if credentials not provided) */
  auth?: {
    /** Google email for auto-login */
    email?: string;
    /** Google password for auto-login */
    password?: string;
    /** Enable headless mode for browser (default: true) */
    headless?: boolean;
  };
  
  /** Enable client-side quota tracking and enforcement (default: false) */
  enforceQuotas?: boolean;
  
  /** NotebookLM plan for quota limits (default: 'standard') */
  plan?: 'standard' | 'plus' | 'pro' | 'ultra';
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

