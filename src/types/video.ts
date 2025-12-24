/**
 * Video overview types
 */

/**
 * Video overview result
 */
export interface VideoOverview {
  /** Project ID */
  projectId: string;
  
  /** Video ID */
  videoId?: string;
  
  /** Video title */
  title?: string;
  
  /** Video data (URL or base64) */
  videoData?: string;
  
  /** Is video ready */
  isReady: boolean;
  
  /** Video status */
  status?: VideoStatus;
  
  /** Creation timestamp */
  createdAt?: string;
}

/**
 * Video status enum
 */
export enum VideoStatus {
  CREATING = 'CREATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Options for creating video overview
 */
export interface CreateVideoOverviewOptions {
  /** Custom instructions for video generation */
  instructions?: string;
  
  /** Source IDs to include (optional) */
  sourceIds?: string[];
}

