/**
 * Generation service
 * Handles generation operations (guides, chat)
 * 
 * CRITICAL FIXES VERIFIED:
 * ========================
 * 1. ✅ notebookId passed to streamingClient.streamChat() (line ~376)
 * 2. ✅ Source IDs extracted from notebook before chat (line ~214-250)
 * 3. ✅ Request structure correct: [contextItems, prompt, null, [2,null,[1]], notebookId]
 * 
 * This service correctly calls the streaming client with all required parameters.
 * The streaming client handles the URL building (with source-path) and request
 * body formatting (with notebookId as last parameter).
 * 
 * All three critical bugs are fixed:
 * - ❌ Bug #1: Missing source-path → ✅ Fixed in streaming-client.ts line ~230
 * - ❌ Bug #2: Double URL encoding → ✅ Fixed in streaming-client.ts line ~219
 * - ❌ Bug #3: Wrong ID in body → ✅ Fixed in streaming-client.ts line ~298
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { NotebookLMError, type ChatConfig, ChatGoalType, ChatResponseLength, type ChatResponseData } from '../types/common.js';
import { StreamingClient, type StreamChunk, type StreamingOptions } from '../utils/streaming-client.js';

/**
 * Service for generation operations
 */
export class GenerationService {
  private streamingClient?: StreamingClient;

  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {
    // Initialize streaming client with RPC config
    const rpcConfig = this.rpc.getConfig();
    // Add batch client reference for f.sid access
    (rpcConfig as any).batchClient = this.rpc.getBatchClient();
    this.streamingClient = new StreamingClient(rpcConfig);
  }
  
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
    config: ChatConfig
  ): Promise<any> {
    // Validate config
    if (config.type === 'custom' && !config.customText) {
      throw new NotebookLMError('customText is required when type is "custom"');
    }

    // Map config type to numeric value using enum
    let configType: number;
    if (config.type === 'default') {
      configType = ChatGoalType.DEFAULT;
    } else if (config.type === 'custom') {
      configType = ChatGoalType.CUSTOM;
    } else if (config.type === 'learning-guide') {
      configType = ChatGoalType.LEARNING_GUIDE;
    } else {
      throw new NotebookLMError(`Invalid config type: ${config.type}`);
    }

    // Map response length to numeric value using enum
    let responseLength: number;
    if (config.responseLength === 'default') {
      responseLength = ChatResponseLength.DEFAULT;
    } else if (config.responseLength === 'shorter') {
      // Shorter is 5 for custom, but we use 2 for others (API quirk)
      responseLength = config.type === 'custom' ? ChatResponseLength.SHORTER : 2;
    } else if (config.responseLength === 'longer') {
      responseLength = ChatResponseLength.LONGER;
    } else {
      throw new NotebookLMError(`Invalid response length: ${config.responseLength}`);
    }

    // Build config array
    // Format: [[goal, custom_text?], [length?]]
    // Length is only included if it's not default (1)
    const configArray: any[] = [];
    if (config.type === 'custom' && config.customText) {
      configArray.push([configType, config.customText]);
    } else {
      configArray.push([configType]);
    }
    // Only include length if it's not default
    if (responseLength !== ChatResponseLength.DEFAULT) {
      configArray.push([responseLength]);
    }

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
   * Chat with notebook (non-streaming - returns full response data)
   * For streaming, use chatStream() method instead
   * 
   * Returns a ChatResponseData object containing:
   * - chunks: All StreamChunk objects received
   * - rawData: Raw data from the last chunk (contains full response structure)
   * - text: Processed text (for convenience, but examples should parse rawData)
   * - conversationId, messageIds, citations: Metadata
   * 
   * Examples should decode the rawData to extract the full response.
   * 
   * Note: For continuing conversations, extract messageIds from previous responses
   * and pass them via the conversationId parameter context. The conversationHistory
   * parameter is for reference only - message IDs must be extracted from responses.
   * 
   * @example
   * ```typescript
   * // Non-streaming: Get complete response
   * const response = await client.generation.chat('notebook-id', 'What are the key findings?');
   * console.log(response.text);
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
  ): Promise<ChatResponseData> {
    // Check quota before chat
    this.quota?.checkQuota('chat');


    // Generate conversation ID if not provided
    const convId = options?.conversationId || this.generateConversationId();

    // If no source IDs provided, fetch all sources from the notebook
    let sourceIds = options?.sourceIds;
    if (!sourceIds || sourceIds.length === 0) {
      try {
        // Fetch notebook data to get all sources
        const projectResponse = await this.rpc.call(
          RPC.RPC_GET_PROJECT,
          [notebookId, null, [2], null, 0],
          notebookId
        );
        
        // Parse sources from response (similar to SourcesService.parseSourcesFromResponse)
        sourceIds = this.extractSourceIdsFromResponse(projectResponse);
        
        // Debug logging (only if debug enabled)
        if (this.rpc['config']?.debug) {
          console.log('\n🔍 Source Extraction Debug:');
          console.log('📝 Extracted source IDs:', sourceIds);
          console.log('📝 Source IDs count:', sourceIds?.length || 0);
        }
        
        // If no sources found, this might cause issues
        if (!sourceIds || sourceIds.length === 0) {
          if (this.rpc['config']?.debug) {
            console.warn('⚠️ WARNING: No sources extracted from notebook response');
            console.warn('⚠️ This will cause the chat request to fail');
          }
        }
      } catch (error) {
        // If fetching sources fails, log and re-throw
        if (this.rpc['config']?.debug) {
          console.error('\n❌ Failed to fetch sources from notebook:');
          console.error('❌ Error:', error);
          console.error('❌ This will cause the chat request to fail\n');
        }
        sourceIds = [];
      }
    }

    // Ensure we have at least one source (API requires sources for chat)
    if (!sourceIds || sourceIds.length === 0) {
      throw new NotebookLMError('No sources found in notebook. Please add at least one source before chatting.');
    }

    // Build context items based on reference implementation
    // Format for new conversation: [[[["conversation_id"]]], "prompt", null, [2, null, [1]], "notebook_id"]
    // Format for continuing conversation: [[[["conversation_id"]], [["msg_id_1"]], [["msg_id_2"]]]], "prompt", null, [2, null, [1]], "notebook_id"]
    // Format for sources: [[["source_id_1"]], [["source_id_2"]]], "prompt", null, [2, null, [1]], "notebook_id"]
    const contextItems: any[] = [];

    if (sourceIds && sourceIds.length > 0) {
      // When using sources, each source ID becomes an element: [[["source_id"]]]
      for (const sourceId of sourceIds) {
        contextItems.push([[sourceId]]);
      }
    } else {
      // For conversation, add conversation ID: [[["conversation_id"]]]
      contextItems.push([[convId]]);
      
      // Add message history (message IDs) if provided: [["msg_id_1"]], [["msg_id_2"]], ...
      // Message IDs should be extracted from previous chat responses' metadata (messageIds field)
      // The conversationHistory parameter contains message objects for reference, but the API
      // requires message IDs. Extract messageIds from previous ChatResponseData and add to contextItems.
      // Example: After first chat, use responseData.messageIds and add to contextItems in next request
    }

    // Build the inner request array
    // Format: [contextItems, prompt, null, [2, null, [1]], notebookId]
    // The third parameter is always null (not used for message content)
    const innerRequest: any[] = [
      contextItems,
      prompt,
      null,  // Always null - message IDs go in contextItems, not here
      [2, null, [1]],
      notebookId
    ];

    // Build the full request: [null, JSON.stringify(innerRequest)]
    const request = [null, JSON.stringify(innerRequest)];

    // Debug: log the request structure (only if debug enabled)
    if (this.rpc['config']?.debug) {
      console.log('\n🔍 Chat Request Debug:');
      console.log('📝 Notebook ID:', notebookId);
      console.log('📝 Prompt:', prompt);
      console.log('📝 Source IDs:', sourceIds);
      console.log('📝 Source IDs count:', sourceIds.length);
      console.log('📝 Context Items (formatted):', JSON.stringify(contextItems, null, 2));
      console.log('📝 Conversation ID:', convId);
      console.log('📝 Inner Request (formatted):', JSON.stringify(innerRequest, null, 2));
      console.log('📝 Full Request:', JSON.stringify(request));
      console.log('');
    }

    try {
      // For non-streaming, collect all chunks and raw data
      const chunks: StreamChunk[] = [];
      let conversationId: string | undefined;
      let messageIds: [string, string] | undefined;
      const citations = new Set<number>();
      let lastRawData: any = undefined;

      // Use streaming client to get all chunks
      if (!this.streamingClient) {
        throw new NotebookLMError('Streaming client not initialized');
      }

      // Debug logging
      const debug = this.rpc['config']?.debug || false;
      if (debug) {
        console.log('\n🔍 [DEBUG] Starting non-streaming chat:');
        console.log('   Notebook ID:', notebookId);
        console.log('   Prompt:', prompt);
        console.log('   Source IDs:', sourceIds);
        console.log('   Conversation ID:', convId);
      }

      const streamOptions: StreamingOptions = {
        onChunk: (chunk) => {
          chunks.push(chunk);
          
          // Debug each chunk
          if (debug) {
            console.log(`\n🔍 [DEBUG] Chunk #${chunk.chunkNumber}:`);
            console.log('   Byte count:', chunk.byteCount);
            console.log('   Text length:', chunk.text?.length || 0);
            console.log('   Response length:', chunk.response?.length || 0);
            console.log('   Has metadata:', !!chunk.metadata);
            console.log('   Has rawData:', !!chunk.rawData);
            console.log('   Citations:', chunk.citations || []);
            if (chunk.rawData) {
              console.log('   Raw data structure:', Array.isArray(chunk.rawData) ? `Array[${chunk.rawData.length}]` : typeof chunk.rawData);
              if (Array.isArray(chunk.rawData) && chunk.rawData.length > 0) {
                console.log('   First element type:', Array.isArray(chunk.rawData[0]) ? 'Array' : typeof chunk.rawData[0]);
                if (typeof chunk.rawData[0] === 'string') {
                  console.log('   First element (text) preview:', chunk.rawData[0].substring(0, 100));
                }
              }
            }
          }
          
          // Track metadata from first chunk
          if (chunk.metadata && !conversationId) {
            conversationId = chunk.metadata[0];
            messageIds = chunk.metadata.slice(0, 2) as [string, string];
            if (debug) {
              console.log('   [DEBUG] Extracted conversation ID:', conversationId);
              console.log('   [DEBUG] Extracted message IDs:', messageIds);
            }
          }
          
          // Collect citations
          if (chunk.citations) {
            chunk.citations.forEach(citation => citations.add(citation));
          }
          
          // Keep track of last rawData (contains full response structure)
          if (chunk.rawData) {
            lastRawData = chunk.rawData;
          }
        },
        showThinking: false,
      };

      // Stream all chunks
      let chunkReceived = false;
      for await (const chunk of this.streamingClient.streamChat(
        notebookId,
        prompt,
        sourceIds,
        convId,
        null,  // Always null - message IDs go in contextItems
        streamOptions
      )) {
        chunkReceived = true;
        // Chunks are already processed in onChunk callback
      }

      // Debug summary
      if (debug) {
        console.log('\n🔍 [DEBUG] Chat complete:');
        console.log('   Chunks received:', chunks.length);
        console.log('   Conversation ID:', conversationId || 'none');
        console.log('   Citations:', Array.from(citations));
        console.log('   Has rawData:', !!lastRawData);
        
        if (chunks.length > 0) {
          console.log('\n🔍 [DEBUG] First chunk structure:');
          const firstChunk = chunks[0];
          console.log('   Text:', firstChunk.text?.substring(0, 100) || 'none');
          console.log('   Response:', firstChunk.response?.substring(0, 100) || 'none');
          console.log('   RawData type:', firstChunk.rawData ? (Array.isArray(firstChunk.rawData) ? 'Array' : typeof firstChunk.rawData) : 'none');
          
          console.log('\n🔍 [DEBUG] Last chunk structure:');
          const lastChunk = chunks[chunks.length - 1];
          console.log('   Text:', lastChunk.text?.substring(0, 100) || 'none');
          console.log('   Response:', lastChunk.response?.substring(0, 100) || 'none');
          console.log('   RawData type:', lastChunk.rawData ? (Array.isArray(lastChunk.rawData) ? 'Array' : typeof lastChunk.rawData) : 'none');
          
          if (lastChunk.rawData && Array.isArray(lastChunk.rawData) && lastChunk.rawData.length > 0) {
            console.log('   RawData[0] preview:', JSON.stringify(lastChunk.rawData[0]).substring(0, 200));
          }
        }
        
        if (!chunkReceived) {
          console.warn('⚠️  [DEBUG] WARNING: No chunks received from streaming client');
        }
      }

      // Record usage after successful chat
      this.quota?.recordUsage('chat');

      // Extract text from last chunk for convenience (but examples should parse rawData)
      let processedText = '';
      if (chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk.response && lastChunk.response.trim()) {
          processedText = lastChunk.response;
        } else if (lastChunk.text && lastChunk.text.trim()) {
          // Remove thinking headers
          processedText = lastChunk.text.replace(/\*\*[^*]+\*\*\n\n/g, '').trim() || lastChunk.text;
        }
      }

      // Return full response data for examples to decode
      return {
        chunks,
        rawData: lastRawData,
        text: processedText,
        conversationId,
        messageIds,
        citations: Array.from(citations),
      };
    } catch (error) {
      if (this.rpc['config']?.debug) {
        console.error('\n❌ Chat Request Failed:');
        console.error('❌ Error:', error);
        console.error('❌ Request that failed:', JSON.stringify(request));
        console.error('');
      }
      throw error;
    }
  }

  /**
   * Stream chat with notebook (returns async generator for streaming chunks)
   * 
   * @param notebookId - The notebook ID
   * @param prompt - The chat prompt/question
   * @param options - Optional chat options
   * @param options.sourceIds - Optional specific source IDs to query (if not provided, uses all sources)
   * @param options.conversationHistory - Optional conversation history array for reference (message IDs should be extracted from previous responses)
   * @param options.conversationId - Optional conversation ID for continuing a conversation (auto-generated if not provided)
   * @param options.onChunk - Optional callback for each chunk
   * @param options.showThinking - Whether to include thinking process in output
   * 
   * Note: For continuing conversations, extract messageIds from previous responses' metadata
   * and pass them via the conversationId context. The conversationHistory parameter is for
   * reference only - the API requires message IDs in contextItems, not message objects.
   * 
   * @example
   * ```typescript
   * // Stream chat response
   * for await (const chunk of client.generation.chatStream('notebook-id', 'What is this about?')) {
   *   if (chunk.response) {
   *     process.stdout.write(chunk.response);
   *   }
   * }
   * 
   * // With callback
   * await client.generation.chatStream('notebook-id', 'Explain this', {
   *   onChunk: (chunk) => {
   *     console.log('Chunk:', chunk.text);
   *   }
   * });
   * ```
   */
  async *chatStream(
    notebookId: string,
    prompt: string,
    options?: {
      sourceIds?: string[];
      conversationHistory?: Array<{ message: string; role: 'user' | 'assistant' }>;
      conversationId?: string;
      onChunk?: (chunk: StreamChunk) => void;
      showThinking?: boolean;
    }
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Check quota before chat
    this.quota?.checkQuota('chat');

    // Generate conversation ID if not provided
    const convId = options?.conversationId || this.generateConversationId();

    // If no source IDs provided, fetch all sources from the notebook
    let sourceIds = options?.sourceIds;
    if (!sourceIds || sourceIds.length === 0) {
      try {
        // Fetch notebook data to get all sources
        const projectResponse = await this.rpc.call(
          RPC.RPC_GET_PROJECT,
          [notebookId, null, [2], null, 0],
          notebookId
        );
        
        // Parse sources from response
        sourceIds = this.extractSourceIdsFromResponse(projectResponse);
      } catch (error) {
        console.error('\n❌ Failed to fetch sources from notebook:', error);
        sourceIds = [];
      }
    }

    // Ensure we have at least one source
    if (!sourceIds || sourceIds.length === 0) {
      throw new NotebookLMError('No sources found in notebook. Please add at least one source before chatting.');
    }

    // Build context items based on reference implementation
    const contextItems: any[] = [];

    if (sourceIds && sourceIds.length > 0) {
      // When using sources, each source ID becomes an element: [[["source_id"]]]
      for (const sourceId of sourceIds) {
        contextItems.push([[sourceId]]);
      }
    } else {
      // For conversation, add conversation ID: [[["conversation_id"]]]
      contextItems.push([[convId]]);
      
      // Add message history (message IDs) if available
      // Message IDs should be extracted from previous chat responses' metadata
      // The conversationHistory parameter contains message objects, but we need message IDs
      // For proper message ID tracking, users should extract messageIds from previous responses
      // and pass them explicitly (this is a limitation of the current API design)
    }

    // Stream using streaming client
    // Note: The third parameter in the request body is always null
    // Message IDs go in contextItems, not as a separate parameter
    if (!this.streamingClient) {
      throw new NotebookLMError('Streaming client not initialized');
    }

    const streamOptions: StreamingOptions = {
      onChunk: options?.onChunk,
      showThinking: options?.showThinking,
    };

    for await (const chunk of this.streamingClient.streamChat(
      notebookId,
      prompt,
      sourceIds,
      convId,
      null,  // Always null - message IDs go in contextItems
      streamOptions
    )) {
      yield chunk;
    }

    // Record usage after streaming completes
    this.quota?.recordUsage('chat');
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
    // Format: [[[conversation_id]]]
    const request = [[[conversationId]]];

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

  /**
   * Extract source IDs from notebook response
   * Uses the same logic as SourcesService.parseSourcesFromResponse
   */
  private extractSourceIdsFromResponse(response: any): string[] {
    try {
      let parsedResponse = response;
      if (typeof response === 'string') {
        parsedResponse = JSON.parse(response);
      }
      
      if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
        return [];
      }
      
      let data = parsedResponse;
      
      // Handle nested array structure - same as SourcesService
      if (Array.isArray(parsedResponse[0])) {
        data = parsedResponse[0];
      }
      
      // Sources are in data[1] - same as SourcesService
      if (!Array.isArray(data[1])) {
        return [];
      }
      
      const sourceIds: string[] = [];
      
      for (const sourceData of data[1]) {
        if (!Array.isArray(sourceData) || sourceData.length === 0) {
          continue;
        }
        
        // Extract source ID from [0][0] - same as SourcesService
        let sourceId: string | undefined;
        if (Array.isArray(sourceData[0]) && sourceData[0].length > 0) {
          sourceId = sourceData[0][0];
        } else if (typeof sourceData[0] === 'string') {
          sourceId = sourceData[0];
        }
        
        if (sourceId && typeof sourceId === 'string') {
          sourceIds.push(sourceId);
        }
      }
      
      return sourceIds;
    } catch (error) {
      // Return empty array if parsing fails
      if (this.rpc['config']?.debug) {
        console.error('❌ Failed to extract source IDs:', error);
      }
      return [];
    }
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
