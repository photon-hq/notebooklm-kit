/**
 * Note types
 */

/**
 * Note in a notebook
 */
export interface Note {
  noteId: string; // Unique note ID
  title: string; // Note title
  content: string; // Note content
  tags?: string[]; // Note tags
  createdAt?: string; // Creation timestamp
  updatedAt?: string; // Last modified timestamp
  noteType?: NoteType[]; // Note type
  projectId?: string; // Associated project ID
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
  title: string; // Note title
  content?: string; // Initial content
  tags?: string[]; // Note tags
  noteType?: NoteType[]; // Note type
}

/**
 * Options for updating a note
 */
export interface UpdateNoteOptions {
  title?: string; // New title
  content?: string; // New content
  tags?: string[]; // New tags
}
