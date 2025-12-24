/**
 * Notebook/Project types
 */

import type { Source } from './source.js';

/**
 * NotebookLM Project (Notebook)
 */
export interface Notebook {
  /** Unique project ID */
  projectId: string;
  
  /** Project title */
  title: string;
  
  /** Project emoji */
  emoji?: string;
  
  /** Project sources */
  sources?: Source[];
  
  /** Project metadata */
  metadata?: Record<string, any>;
  
  /** Creation timestamp */
  createdAt?: string;
  
  /** Last modified timestamp */
  updatedAt?: string;
  
  /** Project description */
  description?: string;
  
  /** Project owner */
  owner?: string;
  
  /** Sharing settings */
  sharing?: SharingSettings;
}

/**
 * Sharing settings for a project
 */
export interface SharingSettings {
  /** Is project shared */
  isShared?: boolean;
  
  /** Share URL */
  shareUrl?: string;
  
  /** Share ID */
  shareId?: string;
  
  /** Public access */
  publicAccess?: boolean;
  
  /** Allowed users */
  allowedUsers?: string[];
}

/**
 * Options for creating a notebook
 */
export interface CreateNotebookOptions {
  /** Notebook title */
  title: string;
  
  /** Notebook emoji (optional) */
  emoji?: string;
  
  /** Initial description (optional) */
  description?: string;
}

/**
 * Options for updating a notebook
 */
export interface UpdateNotebookOptions {
  /** New title */
  title?: string;
  
  /** New emoji */
  emoji?: string;
  
  /** New description */
  description?: string;
  
  /** Other metadata updates */
  metadata?: Record<string, any>;
}

