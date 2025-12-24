/**
 * Note types
 */

/**
 * Note in a notebook
 */
export interface Note {
  /** Unique note ID */
  noteId: string;
  
  /** Note title */
  title: string;
  
  /** Note content */
  content: string;
  
  /** Note tags */
  tags?: string[];
  
  /** Creation timestamp */
  createdAt?: string;
  
  /** Last modified timestamp */
  updatedAt?: string;
  
  /** Note type */
  noteType?: NoteType[];
  
  /** Associated project ID */
  projectId?: string;
}

/**
 * Note type enum
 */
export enum NoteType {
  REGULAR = 1,
  GENERATED = 2,
}

/**
 * Options for creating a note
 */
export interface CreateNoteOptions {
  /** Note title */
  title: string;
  
  /** Initial content */
  content?: string;
  
  /** Note tags */
  tags?: string[];
  
  /** Note type */
  noteType?: NoteType[];
}

/**
 * Options for updating a note
 */
export interface UpdateNoteOptions {
  /** New title */
  title?: string;
  
  /** New content */
  content?: string;
  
  /** New tags */
  tags?: string[];
}

