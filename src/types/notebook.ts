/**
 * Notebook/Project types
 */

import type { Source } from './source.js';

/**
 * NotebookLM Project (Notebook)
 */
export interface Notebook {
  projectId: string; /** Unique project ID */
  title: string; /** Project title */
  emoji?: string; /** Project emoji */
  sources?: Source[]; /** Project sources */
  metadata?: Record<string, any>; /** Project metadata */
  createdAt?: string; /** Creation timestamp */
  updatedAt?: string; /** Last modified timestamp */
  description?: string; /** Project description */
  owner?: string; /** Project owner */
  sharing?: SharingSettings; /** Sharing settings */
  sourceCount?: number; /** Number of sources in the notebook */
  lastAccessed?: string; /** Last accessed timestamp */
}

/**
 * Sharing settings for a project
 */
export interface SharingSettings {
  isShared?: boolean; /** Is project shared */
  shareUrl?: string; /** Share URL */
  shareId?: string; /** Share ID */
  publicAccess?: boolean; /** Public access */
  allowedUsers?: string[]; /** Allowed users */
}

/**
 * Options for creating a notebook
 */
export interface CreateNotebookOptions {
  title?: string; /** Notebook title (optional, auto-generated if empty) */
  description?: string; /** Initial description (optional) */
  emoji?: string; /** Notebook emoji (optional) */
}

/**
 * Options for updating a notebook
 */
export interface UpdateNotebookOptions {
  title?: string; /** New title */
  description?: string; /** New description */
  emoji?: string; /** New emoji */
  metadata?: Record<string, any>; /** Other metadata updates */
}

/**
 * Options for sharing a notebook
 */
export interface ShareNotebookOptions {
  users?: Array<{ /** Users to share with (supports multiple users) */
    email: string; /** User email */
    role: 2 | 3 | 4; /** User role: 2=editor, 3=viewer, 4=remove */
  }>;
  notify?: boolean; /** Notify users when adding/removing/updating permissions (default: true, only used when users are provided) */
  accessType?: 1 | 2; /** Access type: 1=anyone with link, 2=restricted (default: 2) */
}

/**
 * Result of sharing a notebook
 */
export interface ShareNotebookResult {
  shareUrl: string; /** Share URL (always present) */
  success: boolean; /** Whether the share operation succeeded */
  notebookId: string; /** The notebook ID that was shared */
  accessType: 1 | 2; /** Access type: 1=anyone with link, 2=restricted */
  isShared: boolean; /** Whether the notebook is shared (true if shared with users or link enabled) */
  users?: Array<{ /** Users with access (only present if users were shared) */
    email: string; /** User email */
    role: 2 | 3; /** User role: 2=editor, 3=viewer */
  }>;
}

/**
 * Result of deleting notebook(s)
 */
export interface DeleteNotebookResult {
  deleted: string[]; /** Array of deleted notebook IDs */
  count: number; /** Number of notebooks deleted */
}
