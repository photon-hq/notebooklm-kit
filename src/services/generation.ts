/**
 * Generation service
 * Handles generation operations (guides, chat)
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
   * @param sourceId - Optional specific source ID to generate guides for (if not provided, generates for all sources)
   * 
   * @example
   * ```typescript
   * // Generate guides for all sources in the notebook
   * const guides = await client.generation.generateDocumentGuides('notebook-id');
   * 
   * // Generate guides for a specific source
   * const guides = await client.generation.generateDocumentGuides('notebook-id', 'source-id');
   * ```
   */
  async generateDocumentGuides(notebookId: string, sourceId?: string): Promise<any> {
    let request: any[];
    
    if (sourceId) {
      // Format for specific source: [[[["sourceId"]]]]
      request = [[[[sourceId]]]];
    } else {
      // Format for all sources: [notebookId]
      request = [notebookId];
    }
    
    const response = await this.rpc.call(
      RPC.RPC_GENERATE_DOCUMENT_GUIDES,
      request,
      notebookId
    );
    
    return response;
  }

  /**
   * Set chat configuration
   * 
   * @param notebookId - The notebook ID
   * @param config - Chat configuration options
   * @param config.type - Configuration type: 'default' | 'custom' | 'learning-guide'
   * @param config.customText - Custom prompt text (required if type is 'custom')
   * @param config.responseLength - Response length: 'default' | 'shorter' | 'longer'
   * 
   * @example
   * ```typescript
   * // Set default configuration
   * await client.generation.setChatConfig('notebook-id', { type: 'default', responseLength: 'default' });
   * 
   * // Set custom configuration
   * await client.generation.setChatConfig('notebook-id', { 
   *   type: 'custom', 
   *   customText: 'respond as phd student',
   *   responseLength: 'default' 
   * });
   * 
   * // Set learning guide configuration
   * await client.generation.setChatConfig('notebook-id', { type: 'learning-guide', responseLength: 'default' });
   * ```
   */
  async setChatConfig(
    notebookId: string,
    config: {
      type: 'default' | 'custom' | 'learning-guide';
      customText?: string;
      responseLength: 'default' | 'shorter' | 'longer';
    }
  ): Promise<any> {
    // Map config type to numeric value
    // 1 = default, 2 = custom, 3 = learning guide
    let configType: number;
    if (config.type === 'default') {
      configType = 1;
    } else if (config.type === 'custom') {
      configType = 2;
      if (!config.customText) {
        throw new NotebookLMError('customText is required when type is "custom"');
      }
    } else if (config.type === 'learning-guide') {
      configType = 3;
    } else {
      throw new NotebookLMError(`Invalid config type: ${config.type}`);
    }

    // Map response length to numeric value
    // 1 = default, 2 = shorter, 4 = longer, 5 = shorter (for custom)
    let responseLength: number;
    if (config.responseLength === 'default') {
      responseLength = 1;
    } else if (config.responseLength === 'shorter') {
      responseLength = config.type === 'custom' ? 5 : 2;
    } else if (config.responseLength === 'longer') {
      responseLength = 4;
    } else {
      throw new NotebookLMError(`Invalid response length: ${config.responseLength}`);
    }

    // Build config array
    // Format: [[config_type, custom_text], [response_length]]
    const configArray: any[] = [];
    if (config.type === 'custom' && config.customText) {
      configArray.push([configType, config.customText]);
    } else {
      configArray.push([configType]);
    }
    configArray.push([responseLength]);

    // Build full request: [notebookId, [[null,null,null,null,null,null,null, configArray]]]
    const request = [
      notebookId,
      [[null, null, null, null, null, null, null, configArray]]
    ];

    const response = await this.rpc.call(
      RPC.RPC_SET_CHAT_CONFIG,
      request,
      notebookId
    );

    return response;
  }

  /**
   * Chat with notebook (free-form generation with source selection and conversation history)
   * Based on GenerateFreeFormStreamed endpoint from mm41.txt and mm42.txt
   * 
   * @param notebookId - The notebook ID
   * @param prompt - The chat prompt/question
   * @param options - Optional chat options
   * @param options.sourceIds - Optional specific source IDs to query (if not provided, uses all sources)
   * @param options.conversationHistory - Optional conversation history array for follow-up messages
   * @param options.conversationId - Optional conversation ID for continuing a conversation (auto-generated if not provided)
   * 
   * @example
   * ```typescript
   * // First message - chat with all sources
   * const response1 = await client.generation.chat('notebook-id', 'What are the key findings?');
   * 
   * // Follow-up message with conversation history
   * const response2 = await client.generation.chat('notebook-id', 'Tell me more', {
   *   conversationHistory: [
   *     { message: 'What are the key findings?', role: 'user' },
   *     { message: response1, role: 'assistant' }
   *   ],
   *   conversationId: 'conversation-id-from-first-call'
   * });
   * 
   * // Chat with specific sources
   * const response = await client.generation.chat('notebook-id', 'Summarize these sources', {
   *   sourceIds: ['source-id-1', 'source-id-2']
   * });
   * ```
   */
  async chat(
    notebookId: string,
    prompt: string,
    options?: {
      sourceIds?: string[];
      conversationHistory?: Array<{ message: string; role: 'user' | 'assistant' }>;
      conversationId?: string;
    }
  ): Promise<string> {
    // Check quota before chat
    this.quota?.checkQuota('chat');

    // Generate conversation ID if not provided
    const convId = options?.conversationId || this.generateConversationId();

    // Build source IDs array - each source ID wrapped in double arrays
    // Format: [[["source-id-1"]], [["source-id-2"]], ...]
    const sourcesArray: string[][][] = (options?.sourceIds || []).map(id => [[id]]);

    // Build conversation history array if provided
    // Format: [[message, null, role], ...] where role is 1 for user, 2 for assistant
    let conversationHistory: any[] | null = null;
    if (options?.conversationHistory && options.conversationHistory.length > 0) {
      conversationHistory = options.conversationHistory.map(msg => [
        msg.message,
        null,
        msg.role === 'user' ? 1 : 2
      ]);
    }

    // Build the inner request array
    // Format for first message: [sourcesArray, prompt, null, [2, null, [1]], conversationId]
    // Format with history: [sourcesArray, prompt, conversationHistory, [2, null, [1]], conversationId]
    const innerRequest: any[] = [
      sourcesArray,
      prompt,
      conversationHistory || null,
      [2, null, [1]],
      convId
    ];

    // Build the full request: [null, JSON.stringify(innerRequest)]
    const request = [null, JSON.stringify(innerRequest)];

    const response = await this.rpc.call(
      RPC.RPC_GENERATE_FREE_FORM_STREAMED,
      request,
      notebookId
    );

    const result = this.parseChatResponse(response);

    // Record usage after successful chat
    this.quota?.recordUsage('chat');

    return result;
  }

  /**
   * Delete chat history
   * 
   * @param notebookId - The notebook ID
   * @param conversationId - The conversation ID to delete
   * 
   * @example
   * ```typescript
   * await client.generation.deleteChatHistory('notebook-id', 'conversation-id');
   * ```
   */
  async deleteChatHistory(notebookId: string, conversationId: string): Promise<any> {
    // Format: [[], conversationId, null, 1]
    const request = [[], conversationId, null, 1];

    const response = await this.rpc.call(
      RPC.RPC_DELETE_CHAT_HISTORY,
      request,
      notebookId
    );

    return response;
  }

  /**
   * Generate a conversation ID (UUID v4)
   */
  private generateConversationId(): string {
    // Generate a UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
