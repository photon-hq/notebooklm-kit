/**
 * Notes service
 * Handles note operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { Note, CreateNoteOptions, UpdateNoteOptions } from '../types/note.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Service for note operations
 */
export class NotesService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  /**
   * Get notes for a notebook
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const notes = await client.notes.list('notebook-id');
   * console.log(`Found ${notes.length} notes`);
   * ```
   */
  async list(notebookId: string): Promise<Note[]> {
    const response = await this.rpc.call(
      RPC.RPC_GET_NOTES,
      [notebookId],
      notebookId
    );
    
    return this.parseListResponse(response);
  }
  
  /**
   * Create a new note
   * 
   * @param notebookId - The notebook ID
   * @param options - Note options
   * 
   * @example
   * ```typescript
   * const note = await client.notes.create('notebook-id', {
   *   title: 'My Note',
   *   content: 'Note content here',
   * });
   * ```
   */
  async create(notebookId: string, options: CreateNoteOptions): Promise<Note> {
    const { title, content = '', noteType = [1], tags = [] } = options;
    
    // Format: [notebookId, content, [noteType], null, title]
    const request = [
      notebookId,
      content,
      noteType,
      null,
      title
    ];
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_NOTE,
      request,
      notebookId
    );
    
    return this.parseNoteResponse(response, title);
  }
  
  /**
   * Update a note
   * 
   * @param notebookId - The notebook ID
   * @param noteId - The note ID
   * @param options - Update options
   * 
   * @example
   * ```typescript
   * const note = await client.notes.update('notebook-id', 'note-id', {
   *   title: 'Updated Title',
   *   content: 'Updated content',
   * });
   * ```
   */
  async update(notebookId: string, noteId: string, options: UpdateNoteOptions): Promise<Note> {
    // Format: [notebookId, noteId, [[[content, title, tags, 0]]]]
    // Note: content and title must always be provided (can be empty string)
    // The 0 at the end is always 0
    const content = options.content ?? '';
    const title = options.title ?? '';
    const tags = options.tags || [];
    
    const request = [
      notebookId,
      noteId,
      [[[content, title, tags, 0]]]
    ];
    
    const response = await this.rpc.call(
      RPC.RPC_MUTATE_NOTE,
      request,
      notebookId
    );
    
    return this.parseNoteResponse(response, title || '');
  }
  
  /**
   * Delete notes
   * 
   * @param notebookId - The notebook ID
   * @param noteIds - Note IDs to delete
   * 
   * @example
   * ```typescript
   * await client.notes.delete('notebook-id', ['note-id-1', 'note-id-2']);
   * ```
   */
  async delete(notebookId: string, noteIds: string | string[]): Promise<void> {
    const ids = Array.isArray(noteIds) ? noteIds : [noteIds];
    
    // Format: [notebookId, null, [noteIds]]
    const request = [
      notebookId,
      null,
      ids
    ];
    
    await this.rpc.call(
      RPC.RPC_DELETE_NOTES,
      request,
      notebookId
    );
  }
  
  // ========================================================================
  // Response parsers
  // ========================================================================
  
  private parseListResponse(response: any): Note[] {
    try {
      const notes: Note[] = [];
      
      // Parse JSON string if response is a string
      let parsedResponse = response;
      if (typeof response === 'string') {
        // Check if it's a JSON string (starts with [ or {)
        if (response.trim().startsWith('[') || response.trim().startsWith('{')) {
          try {
            parsedResponse = JSON.parse(response);
          } catch (e) {
            // If parsing fails, return empty array
            if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
              console.warn('Failed to parse notes list response as JSON:', response);
            }
            return [];
          }
        }
      }
      
      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        // Response structure: [[notes_array], [timestamp]]
        // The first element is the array of notes
        const notesArray = parsedResponse[0];
        
        if (Array.isArray(notesArray)) {
          for (const noteItem of notesArray) {
            if (!Array.isArray(noteItem) || noteItem.length < 2) {
              continue;
            }
            
            // Structure: [noteId, [noteId, content, metadata, null, title]]
            // noteItem[0] = noteId (outer)
            // noteItem[1] = [noteId, content, metadata, null, title] (details array)
            const noteId = typeof noteItem[0] === 'string' ? noteItem[0] : '';
            const details = Array.isArray(noteItem[1]) ? noteItem[1] : [];
            
            if (!noteId || !noteId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
              continue; // Skip if noteId is not valid
            }
            
            // Skip deleted notes - if details array is empty or too short, the note is likely deleted
            if (!details || details.length < 2) {
              continue; // Deleted notes have empty or minimal details
            }
            
            // Extract from details array: [noteId, content, metadata, null, title]
            const content = details.length > 1 && typeof details[1] === 'string' ? details[1] : '';
            const metadata = details.length > 2 && Array.isArray(details[2]) ? details[2] : null;
            const title = details.length > 4 && typeof details[4] === 'string' ? details[4] : '';
            
            // Skip deleted notes - if there's no metadata and no title/content, it's likely deleted
            if (!metadata && !title && !content) {
              continue; // Deleted notes have no metadata, title, or content
            }
            
            // Skip mind maps - they have metadata[3] === 5 or content is JSON mind map structure
            if (metadata && Array.isArray(metadata) && metadata.length > 3 && metadata[3] === 5) {
              continue; // This is a mind map, skip it
            }
            
            // Also check if content is a JSON mind map structure (starts with {"name": and has "children")
            if (content && typeof content === 'string') {
              const trimmedContent = content.trim();
              if (trimmedContent.startsWith('{"name":') && trimmedContent.includes('"children"')) {
                continue; // This is a mind map, skip it
              }
            }
            
            // Extract tags from metadata if available
            // Metadata structure: [noteType, projectId, timestamp, ...]
            // Tags might be in a different position, but for now we'll extract what we can
            let tags: string[] = [];
            if (Array.isArray(metadata) && metadata.length > 4 && Array.isArray(metadata[4])) {
              // Tags might be in metadata[4] as an array of arrays: [[tagId], [tagId], ...]
              tags = metadata[4]
                .filter((tag: any) => Array.isArray(tag) && tag.length > 0 && typeof tag[0] === 'string')
                .map((tag: any) => tag[0]);
            }
            
            // Build note object with metadata
            const note: Note = {
              noteId,
              title,
              content,
              tags,
            };
            
            // Add metadata if available
            if (metadata) {
              // Extract noteType from metadata[0]
              if (typeof metadata[0] === 'number') {
                note.noteType = [metadata[0] as any];
              }
              
              // Extract projectId from metadata[1] if it's a string
              if (typeof metadata[1] === 'string') {
                note.projectId = metadata[1];
              }
              
              // Extract timestamps if available
              if (Array.isArray(metadata[2]) && metadata[2].length >= 2) {
                // Convert timestamp [seconds, nanoseconds] to ISO string
                const seconds = metadata[2][0];
                const nanoseconds = metadata[2][1];
                if (typeof seconds === 'number') {
                  const date = new Date(seconds * 1000 + (nanoseconds || 0) / 1000000);
                  note.updatedAt = date.toISOString();
                  note.createdAt = date.toISOString(); // Use same timestamp for both if only one available
                }
              }
            }
            
            notes.push(note);
          }
        }
      }
      
      // Debug logging if no notes found
      if (notes.length === 0 && (process.env.DEBUG || process.env.NODE_ENV === 'development')) {
        console.warn('No notes parsed from response. Original response:', typeof response === 'string' ? response.substring(0, 200) + '...' : JSON.stringify(response).substring(0, 200) + '...');
        console.warn('Parsed response structure (first 500 chars):', JSON.stringify(parsedResponse).substring(0, 500) + '...');
      }
      
      return notes;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notes list: ${(error as Error).message}`);
    }
  }
  
  private parseNoteResponse(response: any, title: string): Note {
    try {
      let noteId = '';
      
      // Parse JSON string if response is a string
      let parsedResponse = response;
      if (typeof response === 'string') {
        // Check if it's a JSON string (starts with [ or {)
        if (response.trim().startsWith('[') || response.trim().startsWith('{')) {
          try {
            parsedResponse = JSON.parse(response);
          } catch (e) {
            // If parsing fails, check if it's just the note ID
            if (response.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
              noteId = response;
            }
          }
        } else if (response.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          // Simple string that's just the note ID
          noteId = response;
        }
      }
      
      // If we already found the note ID, skip further parsing
      if (!noteId) {
        // Check if parsed response is an array with note ID as first element (similar to list format)
        if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
          // Pattern 1: [[noteId, content, metadata, null, title], ...] - create note response format
          if (Array.isArray(parsedResponse[0]) && parsedResponse[0].length > 0) {
            const firstItem = parsedResponse[0];
            // Note ID is at index 0: [noteId, content, ...]
            if (typeof firstItem[0] === 'string' && firstItem[0].match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
              noteId = firstItem[0];
            }
          }
          // Pattern 2: [noteId, ...] - single note array
          else if (typeof parsedResponse[0] === 'string' && parsedResponse[0].match(/^[a-f0-9-]{8,}$/i)) {
            noteId = parsedResponse[0];
          }
        }
      }
      
      // If still not found, use recursive search on parsed response
      if (!noteId) {
        // Extract note ID from response
        // The response can be in various formats, so we need to search recursively
        const findId = (data: any, depth = 0): string | null => {
        // Prevent infinite recursion
        if (depth > 10) return null;
        
        // Check if it's a UUID-like string (with or without dashes)
        if (typeof data === 'string') {
          // Match UUID format: 8-4-4-4-12 hex digits
          const uuidMatch = data.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
          if (uuidMatch) {
            return uuidMatch[0];
          }
          // Also check for hex strings that might be IDs (at least 8 characters, typical UUID length)
          if (data.match(/^[a-f0-9]{8,}$/i) && data.length <= 36) {
            return data;
          }
        }
        
        // If it's an array, search recursively
        if (Array.isArray(data)) {
          // Check first element if it's a string (common pattern: [noteId, ...])
          if (data.length > 0 && typeof data[0] === 'string' && data[0].match(/^[a-f0-9-]{8,}$/i)) {
            return data[0];
          }
          // Otherwise search all items
          for (const item of data) {
            const id = findId(item, depth + 1);
            if (id) return id;
          }
        }
        
        // If it's an object, search its values
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // Check common ID field names first
          const idFields = ['id', 'noteId', 'note_id', 'noteID'];
          for (const field of idFields) {
            if (data[field] && typeof data[field] === 'string') {
              const id = findId(data[field], depth + 1);
              if (id) return id;
            }
          }
          // Then search all values recursively
          for (const key in data) {
            const id = findId(data[key], depth + 1);
            if (id) return id;
          }
        }
        
          return null;
        };
        
        noteId = findId(parsedResponse) || '';
      }
      
      // If note ID is still empty, log the response structure for debugging
      // (only in development - check for NODE_ENV or DEBUG env var)
      if (!noteId && (process.env.DEBUG || process.env.NODE_ENV === 'development')) {
        console.warn('Note ID not found in response. Original response:', typeof response === 'string' ? response : JSON.stringify(response));
        console.warn('Parsed response structure:', JSON.stringify(parsedResponse, null, 2));
      }
      
      return {
        noteId,
        title,
        content: '',
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse note response: ${(error as Error).message}`);
    }
  }
}
