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
      
      if (Array.isArray(response)) {
        for (const item of response) {
          if (Array.isArray(item) && item.length >= 2) {
            notes.push({
              noteId: item[0] || '',
              title: item[1] || '',
              content: item[2] || '',
              tags: item[3] || [],
            });
          }
        }
      }
      
      return notes;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notes list: ${(error as Error).message}`);
    }
  }
  
  private parseNoteResponse(response: any, title: string): Note {
    try {
      let noteId = '';
      
      // Extract note ID from response
      if (Array.isArray(response)) {
        const findId = (data: any): string | null => {
          if (typeof data === 'string' && data.match(/^[a-f0-9-]+$/)) {
            return data;
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              const id = findId(item);
              if (id) return id;
            }
          }
          return null;
        };
        
        noteId = findId(response) || '';
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
