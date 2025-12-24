/**
 * Error handling utilities for NotebookLM API
 * Comprehensive error code dictionary and error detection
 */

import { NotebookLMError } from '../types/common.js';

/**
 * Error type categories
 */
export enum ErrorType {
  UNKNOWN = 'Unknown',
  AUTHENTICATION = 'Authentication',
  AUTHORIZATION = 'Authorization',
  RATE_LIMIT = 'RateLimit',
  NOT_FOUND = 'NotFound',
  INVALID_INPUT = 'InvalidInput',
  SERVER_ERROR = 'ServerError',
  NETWORK_ERROR = 'NetworkError',
  PERMISSION_DENIED = 'PermissionDenied',
  RESOURCE_EXHAUSTED = 'ResourceExhausted',
  UNAVAILABLE = 'Unavailable',
}

/**
 * Error code definition
 */
export interface ErrorCode {
  code: number;
  type: ErrorType;
  message: string;
  description: string;
  retryable: boolean;
}

/**
 * API error with context
 */
export class APIError extends NotebookLMError {
  constructor(
    message: string,
    public readonly errorCode?: ErrorCode,
    public readonly httpStatus?: number,
    public readonly rawResponse?: string
  ) {
    super(message, httpStatus);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
  
  isRetryable(): boolean {
    if (this.errorCode) {
      return this.errorCode.retryable;
    }
    
    // HTTP errors that are retryable
    if (this.httpStatus) {
      return [429, 500, 502, 503, 504].includes(this.httpStatus);
    }
    
    return false;
  }
}

/**
 * Error code dictionary
 * Maps numeric error codes to their definitions
 */
const errorCodeDictionary: Record<number, ErrorCode> = {
  // Authentication errors
  277566: {
    code: 277566,
    type: ErrorType.AUTHENTICATION,
    message: 'Authentication required',
    description: 'The request requires user authentication. Please check your credentials.',
    retryable: false,
  },
  277567: {
    code: 277567,
    type: ErrorType.AUTHENTICATION,
    message: 'Authentication token expired',
    description: 'The authentication token has expired. Please get fresh credentials.',
    retryable: false,
  },
  80620: {
    code: 80620,
    type: ErrorType.AUTHORIZATION,
    message: 'Access denied',
    description: 'Access to the requested resource is denied. Check your permissions.',
    retryable: false,
  },
  
  // Rate limiting
  324934: {
    code: 324934,
    type: ErrorType.RATE_LIMIT,
    message: 'Rate limit exceeded',
    description: 'Too many requests have been sent. Please wait before making more requests.',
    retryable: true,
  },
  
  // Resource not found
  143: {
    code: 143,
    type: ErrorType.NOT_FOUND,
    message: 'Resource not found',
    description: 'The requested resource could not be found. It may have been deleted or you may not have access to it.',
    retryable: false,
  },
  
  // gRPC-style error codes
  1: {
    code: 1,
    type: ErrorType.INVALID_INPUT,
    message: 'Invalid request',
    description: 'The request contains invalid parameters or data.',
    retryable: false,
  },
  2: {
    code: 2,
    type: ErrorType.SERVER_ERROR,
    message: 'Internal server error',
    description: 'An internal server error occurred. Please try again later.',
    retryable: true,
  },
  3: {
    code: 3,
    type: ErrorType.UNAVAILABLE,
    message: 'Service unavailable',
    description: 'The service is temporarily unavailable. Please try again later.',
    retryable: true,
  },
  4: {
    code: 4,
    type: ErrorType.PERMISSION_DENIED,
    message: 'Permission denied',
    description: 'You do not have permission to access this resource.',
    retryable: false,
  },
  5: {
    code: 5,
    type: ErrorType.NOT_FOUND,
    message: 'Not found',
    description: 'The requested item was not found.',
    retryable: false,
  },
  6: {
    code: 6,
    type: ErrorType.INVALID_INPUT,
    message: 'Invalid argument',
    description: 'One or more arguments are invalid.',
    retryable: false,
  },
  7: {
    code: 7,
    type: ErrorType.PERMISSION_DENIED,
    message: 'Permission denied',
    description: 'The caller does not have permission to execute the specified operation.',
    retryable: false,
  },
  8: {
    code: 8,
    type: ErrorType.RESOURCE_EXHAUSTED,
    message: 'Resource exhausted',
    description: 'Some resource has been exhausted (quota, disk space, etc.).',
    retryable: true,
  },
  9: {
    code: 9,
    type: ErrorType.INVALID_INPUT,
    message: 'Failed precondition',
    description: "Operation was rejected because the system is not in a state required for the operation's execution.",
    retryable: false,
  },
  10: {
    code: 10,
    type: ErrorType.SERVER_ERROR,
    message: 'Aborted',
    description: 'The operation was aborted due to a concurrency issue.',
    retryable: true,
  },
  11: {
    code: 11,
    type: ErrorType.INVALID_INPUT,
    message: 'Out of range',
    description: 'Operation was attempted past the valid range.',
    retryable: false,
  },
  12: {
    code: 12,
    type: ErrorType.SERVER_ERROR,
    message: 'Unimplemented',
    description: 'Operation is not implemented or not supported/enabled.',
    retryable: false,
  },
  13: {
    code: 13,
    type: ErrorType.SERVER_ERROR,
    message: 'Internal error',
    description: "Internal errors that shouldn't be exposed to clients.",
    retryable: true,
  },
  14: {
    code: 14,
    type: ErrorType.UNAVAILABLE,
    message: 'Unavailable',
    description: 'The service is currently unavailable.',
    retryable: true,
  },
  15: {
    code: 15,
    type: ErrorType.SERVER_ERROR,
    message: 'Data loss',
    description: 'Unrecoverable data loss or corruption.',
    retryable: false,
  },
  16: {
    code: 16,
    type: ErrorType.AUTHENTICATION,
    message: 'Unauthenticated',
    description: 'The request does not have valid authentication credentials.',
    retryable: false,
  },
  
  // HTTP status codes
  400: {
    code: 400,
    type: ErrorType.INVALID_INPUT,
    message: 'Bad Request',
    description: 'The request is malformed or contains invalid parameters.',
    retryable: false,
  },
  401: {
    code: 401,
    type: ErrorType.AUTHENTICATION,
    message: 'Unauthorized',
    description: 'Authentication is required to access this resource.',
    retryable: false,
  },
  403: {
    code: 403,
    type: ErrorType.PERMISSION_DENIED,
    message: 'Forbidden',
    description: 'Access to this resource is forbidden.',
    retryable: false,
  },
  404: {
    code: 404,
    type: ErrorType.NOT_FOUND,
    message: 'Not Found',
    description: 'The requested resource was not found.',
    retryable: false,
  },
  429: {
    code: 429,
    type: ErrorType.RATE_LIMIT,
    message: 'Too Many Requests',
    description: 'Rate limit exceeded. Please wait before making more requests.',
    retryable: true,
  },
  500: {
    code: 500,
    type: ErrorType.SERVER_ERROR,
    message: 'Internal Server Error',
    description: 'An internal server error occurred.',
    retryable: true,
  },
  502: {
    code: 502,
    type: ErrorType.SERVER_ERROR,
    message: 'Bad Gateway',
    description: 'The server received an invalid response from an upstream server.',
    retryable: true,
  },
  503: {
    code: 503,
    type: ErrorType.UNAVAILABLE,
    message: 'Service Unavailable',
    description: 'The service is temporarily unavailable.',
    retryable: true,
  },
  504: {
    code: 504,
    type: ErrorType.SERVER_ERROR,
    message: 'Gateway Timeout',
    description: 'The server did not receive a timely response from an upstream server.',
    retryable: true,
  },
};

/**
 * Get error code definition
 */
export function getErrorCode(code: number): ErrorCode | null {
  return errorCodeDictionary[code] || null;
}

/**
 * Check if response contains an error
 */
export function isErrorResponse(response: any): APIError | null {
  if (!response) {
    return null;
  }
  
  // Check explicit error field
  if (response.error) {
    return new APIError(response.error);
  }
  
  // Check if data is null (often indicates auth issue)
  if (response.data === null || response.data === undefined) {
    return null; // null data is not necessarily an error
  }
  
  const data = response.data;
  
  // Handle numeric error codes
  if (typeof data === 'number') {
    const code = data;
    // Skip success codes
    if (code === 0 || code === 1) {
      return null;
    }
    
    const errorCode = getErrorCode(code);
    if (errorCode) {
      return new APIError(errorCode.message, errorCode);
    }
    
    return new APIError(`Unknown error code: ${code}`);
  }
  
  // Handle array responses
  if (Array.isArray(data) && data.length > 0) {
    const firstEl = data[0];
    if (typeof firstEl === 'number') {
      const code = firstEl;
      // Skip success codes
      if (code === 0 || code === 1) {
        return null;
      }
      
      const errorCode = getErrorCode(code);
      if (errorCode) {
        return new APIError(errorCode.message, errorCode);
      }
    }
  }
  
  // Handle object responses
  if (typeof data === 'object' && data !== null) {
    if ('error' in data && data.error) {
      return new APIError(String(data.error));
    }
    
    if ('error_code' in data && typeof data.error_code === 'number') {
      const errorCode = getErrorCode(data.error_code);
      if (errorCode) {
        return new APIError(errorCode.message, errorCode);
      }
    }
  }
  
  // Handle string responses
  if (typeof data === 'string') {
    const trimmed = data.trim();
    const code = parseInt(trimmed, 10);
    
    if (!isNaN(code) && code !== 0 && code !== 1) {
      const errorCode = getErrorCode(code);
      if (errorCode) {
        return new APIError(errorCode.message, errorCode);
      }
    }
  }
  
  return null;
}

/**
 * Add custom error code
 */
export function addErrorCode(code: number, errorCode: ErrorCode): void {
  errorCodeDictionary[code] = errorCode;
}

/**
 * Get all registered error codes
 */
export function listErrorCodes(): Record<number, ErrorCode> {
  return { ...errorCodeDictionary };
}

