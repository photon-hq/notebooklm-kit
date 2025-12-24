/**
 * Generation service
 * Handles generation operations (guides, outlines, chat)
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Service for generation operations
 */
export class GenerationService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  /**
   * Generate document guides
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const guides = await client.generation.generateDocumentGuides('notebook-id');
   * ```
   */
  async generateDocumentGuides(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_DOCUMENT_GUIDES,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Generate notebook guide
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const guide = await client.generation.generateNotebookGuide('notebook-id');
   * ```
   */
  async generateNotebookGuide(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_NOTEBOOK_GUIDE,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Generate outline
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const outline = await client.generation.generateOutline('notebook-id');
   * ```
   */
  async generateOutline(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_OUTLINE,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Chat with notebook (free-form generation)
   * 
   * @param notebookId - The notebook ID
   * @param prompt - The chat prompt/question
   * @param sourceIds - Optional specific source IDs to query
   * 
   * @example
   * ```typescript
   * const response = await client.generation.chat('notebook-id', 'What are the key findings?');
   * console.log(response);
   * ```
   */
  async chat(notebookId: string, prompt: string, sourceIds?: string[]): Promise<string> {
    // Check quota before chat
    this.quota?.checkQuota('chat');
    
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_FREE_FORM_STREAMED,
      [notebookId, prompt, sourceIds || []],
      notebookId
    );
    
    const result = this.parseChatResponse(response);
    
    // Record usage after successful chat
    this.quota?.recordUsage('chat');
    
    return result;
  }
  
  /**
   * Generate report suggestions
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const suggestions = await client.generation.generateReportSuggestions('notebook-id');
   * ```
   */
  async generateReportSuggestions(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_REPORT_SUGGESTIONS,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Generate magic view
   * 
   * @param notebookId - The notebook ID
   * @param sourceIds - Source IDs to include
   * 
   * @example
   * ```typescript
   * const magicView = await client.generation.generateMagicView('notebook-id', ['source-1', 'source-2']);
   * ```
   */
  async generateMagicView(notebookId: string, sourceIds: string[]): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_DOCUMENT_GUIDES,
      [notebookId, sourceIds],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Start draft generation
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const draft = await client.generation.startDraft('notebook-id');
   * ```
   */
  async startDraft(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_START_DRAFT,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Start section generation
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const section = await client.generation.startSection('notebook-id');
   * ```
   */
  async startSection(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_START_SECTION,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  /**
   * Generate section
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const section = await client.generation.generateSection('notebook-id');
   * ```
   */
  async generateSection(notebookId: string): Promise<any> {
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_SECTION,
      [notebookId],
      notebookId
    );
    
    return response;
  }
  
  // ========================================================================
  // Response parsers
  // ========================================================================
  
  private parseChatResponse(response: any): string {
    try {
      // Response format varies - extract text content
      if (typeof response === 'string') {
        return response;
      }
      
      if (Array.isArray(response) && response.length > 0) {
        // Try to find text content in array
        const findText = (data: any): string | null => {
          if (typeof data === 'string' && data.length > 10) {
            return data;
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              const text = findText(item);
              if (text) return text;
            }
          }
          return null;
        };
        
        const text = findText(response);
        if (text) return text;
      }
      
      return '';
    } catch (error) {
      throw new NotebookLMError(`Failed to parse chat response: ${(error as Error).message}`);
    }
  }
}

