/**
 * Streaming client for NotebookLM chat
 * Handles chunked streaming responses from GenerateFreeFormStreamed endpoint
 * 
 * CRITICAL FIXES APPLIED:
 * =======================
 * 1. ✅ source-path parameter added to URL (line ~230)
 * 2. ✅ Single URL encoding (removed double encoding) (line ~219)
 * 3. ✅ notebookId used as last parameter in request body (line ~298)
 * 
 * These three fixes are ESSENTIAL for streaming to work. Without them,
 * the API returns empty responses (0 chunks) with no error message.
 * 
 * This client handles HTTP/2 chunked streaming responses using Google's
 * internal wrb.fr (Web RPC Framework) protocol.
 * 
 * Response Format:
 * ----------------
 * Chunks arrive in this format:
 * <byte_count>
 * [["wrb.fr", null, "<escaped_json>"]]
 * 
 * The escaped JSON contains the actual response data.
 */

import type { RPCClientConfig } from '../rpc/rpc-client.js';

export interface StreamChunk {
  /** Chunk number (1-based) */
  chunkNumber: number;
  /** Byte count for this chunk */
  byteCount: number;
  /** Full text content from this chunk */
  text: string;
  /** Thinking headers (bold text) */
  thinking: string[];
  /** Response text (non-bold) */
  response: string;
  /** Metadata (conversation ID, message ID, timestamp) */
  metadata?: [string, string, number];
  /** Message IDs for conversation history */
  messageIds?: [string, string];
  /** Timestamp */
  timestamp?: number;
  /** Is this thinking content? */
  isThinking?: boolean;
  /** Is this response content? */
  isResponse?: boolean;
  /** Formatting information */
  formatting?: any;
  /** Citation numbers */
  citations?: number[];
  /** Raw parsed data */
  rawData?: any;
  /** Is this an error chunk? */
  isError?: boolean;
  /** Error code if this is an error */
  errorCode?: number;
}

export interface StreamingOptions {
  /** Callback for each chunk */
  onChunk?: (chunk: StreamChunk) => void;
  /** Whether to include thinking process */
  showThinking?: boolean;
}

/**
 * Streaming client for NotebookLM chat
 * Handles chunked streaming responses with improved parsing based on Python SDK
 */
export class StreamingClient {
  private config: RPCClientConfig;
  private requestCounter: number = 3114440;
  private buffer: string = '';
  private chunkCount: number = 0;

  constructor(config: RPCClientConfig) {
    this.config = config;
    // Initialize with random base
    this.requestCounter = Math.floor(Math.random() * 9000) + 3114440;
    // Debug logging disabled - no log file initialization
  }

  /**
   * Log message to console and file (disabled)
   */
  private log(_message: string): void {
    // Debug logging disabled
  }

  /**
   * Log error to console and file (disabled)
   */
  private logError(_message: string): void {
    // Debug logging disabled
  }

  /**
   * Save logs to file (disabled)
   */
  private async saveLogs(): Promise<void> {
    // Debug logging disabled
  }

  /**
   * Reset parser state for new stream
   */
  private reset(): void {
    this.buffer = '';
    this.chunkCount = 0;
  }

  /**
   * Stream a chat request
   * 
   * This method creates an async generator that yields chunks as they arrive.
   * 
   * @param notebookId - The notebook UUID (CRITICAL: used in URL and body)
   * @param prompt - User's question
   * @param sourceIds - List of source IDs to query
   * @param conversationId - Conversation UUID
   * @param conversationHistory - Message history (always null - IDs go in context)
   * @param options - Streaming options (callback, showThinking)
   */
  async *streamChat(
    notebookId: string,
    prompt: string,
    sourceIds: string[],
    conversationId: string,
    conversationHistory: any[] | null,
    options?: StreamingOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // ✅ CRITICAL: Pass notebookId to build URL with source-path parameter
    const url = this.buildStreamingURL(notebookId);
    const headers = this.buildHeaders();
    
    // ✅ CRITICAL: Pass notebookId to build request body correctly
    const body = this.buildRequestBody(
      prompt,
      sourceIds,
      conversationId,
      conversationHistory,
      notebookId  // ⚠️ MUST pass notebookId here
    );

    if (this.config.debug) {
      // Decode the request body to see what we're actually sending
      const decodedBody = this.decodeRequestBody(body);
      
      this.log('\n🌊 Streaming Chat Request:');
      this.log('📝 URL: ' + url);
      this.log('📝 Body length: ' + body.length + ' bytes');
      this.log('\n📦 Request Body (decoded):');
      this.log(JSON.stringify(decodedBody, null, 2));
      this.log('\n📦 Request Body (raw form data):');
      this.log(body);
      this.log('\n📋 Request Headers:');
      this.log(JSON.stringify(headers, null, 2));
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        // Note: fetch doesn't support streaming in Node.js the same way
        // We'll need to handle this differently
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Streaming request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      // Read stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      this.reset();

      let totalBytesReceived = 0;
      let chunkIndex = 0;
      
      if (this.config.debug) {
        this.log('\n📥 Starting to receive response chunks...');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const newData = decoder.decode(value, { stream: true });
        totalBytesReceived += value.length;
        this.buffer += newData;

        if (this.config.debug) {
          this.log(`\n📥 Received chunk #${++chunkIndex}: ${value.length} bytes (total: ${totalBytesReceived} bytes)`);
          this.log(`📥 Raw chunk data (first 500 chars): ${newData.substring(0, 500)}`);
        }

        // Process complete chunks from buffer
        const chunks = this.processStreamBuffer();
        for (const parsed of chunks) {
          if (parsed) {
            this.chunkCount++;
            const streamChunk: StreamChunk = {
              chunkNumber: this.chunkCount,
              byteCount: parsed.byteCount,
              text: parsed.text || '',
              thinking: parsed.thinking || [],
              response: parsed.response || '',
              metadata: parsed.metadata,
              messageIds: parsed.messageIds,
              timestamp: parsed.timestamp,
              isThinking: parsed.isThinking,
              isResponse: parsed.isResponse,
              formatting: parsed.formatting,
              citations: parsed.citations || [],
              rawData: parsed.rawData,
              isError: parsed.isError,
              errorCode: parsed.errorCode,
            };

            if (this.config.debug) {
              this.log(`\n📦 Parsed Chunk #${this.chunkCount}:`);
              this.log(`   Byte Count: ${parsed.byteCount}`);
              this.log(`   Text Length: ${parsed.text?.length || 0}`);
              this.log(`   Response Length: ${parsed.response?.length || 0}`);
              this.log(`   Thinking Steps: ${parsed.thinking?.length || 0}`);
              this.log(`   Citations: [${parsed.citations?.join(', ') || 'none'}]`);
              this.log(`   Has Metadata: ${!!parsed.metadata}`);
              this.log(`   Has RawData: ${!!parsed.rawData}`);
              if (parsed.metadata) {
                this.log(`   Metadata: ${JSON.stringify(parsed.metadata)}`);
              }
              if (parsed.rawData) {
                this.log(`   RawData Structure: ${Array.isArray(parsed.rawData) ? `Array[${parsed.rawData.length}]` : typeof parsed.rawData}`);
                if (Array.isArray(parsed.rawData) && parsed.rawData.length > 0) {
                  this.log(`   RawData[0] Preview: ${JSON.stringify(parsed.rawData[0]).substring(0, 200)}`);
                }
              }
              if (parsed.text) {
                this.log(`   Text Preview: ${parsed.text.substring(0, 200)}`);
              }
            }

            // Call callback if provided
            if (options?.onChunk) {
              options.onChunk(streamChunk);
            }

            yield streamChunk;
          }
        }
      }
      
      if (this.config.debug) {
        this.log(`\n✅ Response complete: ${this.chunkCount} chunks received, ${totalBytesReceived} total bytes`);
      }

      // Process any remaining buffer
      const remainingChunks = this.processStreamBuffer();
      for (const parsed of remainingChunks) {
        if (parsed) {
          this.chunkCount++;
          const streamChunk: StreamChunk = {
            chunkNumber: this.chunkCount,
            byteCount: parsed.byteCount,
            text: parsed.text || '',
            thinking: parsed.thinking || [],
            response: parsed.response || '',
            metadata: parsed.metadata,
            messageIds: parsed.messageIds,
            timestamp: parsed.timestamp,
            isThinking: parsed.isThinking,
            isResponse: parsed.isResponse,
            formatting: parsed.formatting,
            citations: parsed.citations || [],
            rawData: parsed.rawData,
            isError: parsed.isError,
            errorCode: parsed.errorCode,
          };

          if (options?.onChunk) {
            options.onChunk(streamChunk);
          }

          yield streamChunk;
        }
      }
    } catch (error) {
      if (this.config.debug) {
        this.logError(`\n❌ Streaming Error: ${error}`);
        this.logError(`❌ Error Stack: ${(error as Error).stack || 'N/A'}`);
        await this.saveLogs();
      }
      throw error;
    } finally {
      // Save logs when stream completes
      if (this.config.debug) {
        await this.saveLogs();
      }
    }
  }

  /**
   * Build streaming URL
   * 
   * CRITICAL FIX #1 & #2: source-path parameter and single encoding
   * ================================================================
   * 
   * The URL MUST include the source-path parameter. Without it, the API
   * returns empty responses (0 chunks) with no error message.
   * 
   * Format: source-path=/notebook/{notebookId}
   * 
   * CRITICAL: Do NOT manually URL-encode the source-path value before
   * passing it to URLSearchParams. URLSearchParams will encode it
   * automatically. Double encoding causes %252F instead of %2F, which
   * the API silently rejects.
   * 
   * @param notebookId - The notebook ID to include in source-path parameter
   */
  private buildStreamingURL(notebookId: string): string {
    this.requestCounter++;
    
    // Get f.sid from config (passed from RPC client's batch client)
    const batchClient = (this.config as any).batchClient;
    let fSid = '-7958112141384765164'; // Default fallback
    
    if (batchClient?.config?.urlParams?.['f.sid']) {
      fSid = batchClient.config.urlParams['f.sid'];
    } else if (this.config.urlParams?.['f.sid']) {
      fSid = this.config.urlParams['f.sid'];
    }
    
    // ✅ CRITICAL FIX #2: Don't encode here, let URLSearchParams do it
    // This prevents double encoding (%252F instead of %2F)
    const sourcePath = `/notebook/${notebookId}`;
    
    const params = new URLSearchParams({
      bl: 'boq_labs-tailwind-frontend_20260101.17_p0',
      'f.sid': fSid,
      hl: 'en',
      authuser: this.config.authUser || '0',
      pageId: 'none',
      _reqid: this.requestCounter.toString(),
      rt: 'c',
      // ✅ CRITICAL FIX #1: Add source-path parameter
      // URLSearchParams will encode this correctly to %2Fnotebook%2F{id}
      'source-path': sourcePath,
    });

    return `https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed?${params.toString()}`;
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    return {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'origin': 'https://notebooklm.google.com',
      'referer': 'https://notebooklm.google.com/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'x-goog-ext-353267353-jspb': '[null,null,null,282611]',
      'x-same-domain': '1',
      'cookie': this.config.cookies,
      ...this.config.headers,
    };
  }

  /**
   * Build request body
   * 
   * CRITICAL FIX #3: notebookId as last parameter
   * ==============================================
   * 
   * The request body format is:
   * [contextItems, prompt, null, [2, null, [1]], notebookId]
   * 
   * The last parameter MUST be notebookId, NOT conversationId!
   * Using conversationId here was a major bug that caused empty responses.
   * 
   * Context Items Format:
   * - For sources: [[["source_id_1"]], [["source_id_2"]]]
   * - For conversation: [[["conversation_id"]], [["msg_id_1"]], [["msg_id_2"]]]
   * 
   * The third parameter is always null. Message IDs go in contextItems when
   * continuing a conversation, not in the third parameter.
   * 
   * @param prompt - User's question
   * @param sourceIds - List of source IDs to query
   * @param conversationId - Conversation UUID
   * @param conversationHistory - Always null (message IDs go in contextItems)
   * @param notebookId - Notebook UUID (CRITICAL: used as last parameter)
   */
  private buildRequestBody(
    prompt: string,
    sourceIds: string[],
    conversationId: string,
    conversationHistory: any[] | null,
    notebookId: string
  ): string {
    // Build context items based on whether we're using sources or conversation
    const contextItems: any[] = [];
    
    if (sourceIds && sourceIds.length > 0) {
      // When using sources, each source ID becomes an element: [[["source_id"]]]
      for (const sourceId of sourceIds) {
        contextItems.push([[sourceId]]);
      }
    } else {
      // For conversation, add conversation ID: [[["conversation_id"]]]
      contextItems.push([[conversationId]]);
      
      // Add message history (message IDs) if provided: [["msg_id_1"]], [["msg_id_2"]], ...
      // Note: conversationHistory parameter is not used here - message IDs should be passed separately
      // Message IDs come from previous chat responses' metadata (messageIds field)
      // This is handled by the generation service which tracks message IDs from responses
    }

    // ✅ CRITICAL FIX #3: Last parameter MUST be notebookId, NOT conversationId!
    // Build inner request: [contextItems, prompt, null, [2, null, [1]], notebookId]
    const innerRequest = [
      contextItems,
      prompt,
      null,  // Always null - message IDs go in contextItems, not here
      [2, null, [1]],
      notebookId,  // ⚠️ CRITICAL: Must be notebookId, NOT conversationId!
    ];

    // Build f.req: [null, JSON.stringify(innerRequest)]
    const fReq = [null, JSON.stringify(innerRequest)];

    // Build form data
    const formData = new URLSearchParams();
    formData.append('f.req', JSON.stringify(fReq));
    formData.append('at', this.config.authToken);

    return formData.toString();
  }

  /**
   * Decode request body for logging
   * Parses the form-encoded body to show the actual JSON structure
   */
  private decodeRequestBody(body: string): any {
    try {
      const params = new URLSearchParams(body);
      const fReqStr = params.get('f.req');
      if (fReqStr) {
        const fReq = JSON.parse(fReqStr);
        if (Array.isArray(fReq) && fReq.length >= 2 && typeof fReq[1] === 'string') {
          const innerRequest = JSON.parse(fReq[1]);
          return {
            'f.req': fReq,
            'at': params.get('at')?.substring(0, 20) + '...', // Truncate auth token
            decoded: {
              innerRequest: innerRequest,
              contextItems: innerRequest[0],
              prompt: innerRequest[1],
              thirdParam: innerRequest[2],
              metadata: innerRequest[3],
              notebookId: innerRequest[4],
            }
          };
        }
        return { 'f.req': fReq, 'at': params.get('at')?.substring(0, 20) + '...' };
      }
      return { raw: body };
    } catch (error) {
      return { error: 'Failed to decode', raw: body.substring(0, 500) };
    }
  }

  /**
   * Process stream buffer and extract complete chunks
   * 
   * CRITICAL FIX: Handle fragmented HTTP chunks
   * ============================================
   * 
   * HTTP chunks don't align with wrb.fr frames. Byte counts and frame content
   * can be split across multiple TCP packets. This parser now:
   * 1. Buffers incomplete data until complete frames are available
   * 2. Handles partial byte counts (e.g., "8", "2", "9" → "829")
   * 3. Uses exact byte count to extract frames (not regex)
   * 4. Waits for complete frames before parsing
   * 
   * Chunks arrive in this format:
   * <byte_count>\n[["wrb.fr", null, "<escaped_json>"]]
   */
  private processStreamBuffer(): Array<{
    byteCount: number;
    text: string;
    thinking: string[];
    response: string;
    metadata?: [string, string, number];
    messageIds?: [string, string];
    timestamp?: number;
    isThinking?: boolean;
    isResponse?: boolean;
    formatting?: any;
    citations?: number[];
    rawData?: any;
    isError?: boolean;
    errorCode?: number;
  }> {
    const chunks: Array<{
      byteCount: number;
      text: string;
      thinking: string[];
      response: string;
      metadata?: [string, string, number];
      messageIds?: [string, string];
      timestamp?: number;
      isThinking?: boolean;
      isResponse?: boolean;
      formatting?: any;
      citations?: number[];
      rawData?: any;
      isError?: boolean;
      errorCode?: number;
    }> = [];

    // Remove XSSI protection prefix if present (only once, at the start)
    // Also trim leading whitespace that may appear after the XSSI prefix
    if (this.buffer.startsWith(")]}'")) {
      this.buffer = this.buffer.substring(4).trimStart();
    }

    // Extract complete chunks from buffer
    // Pattern: <byte_count>\n[["wrb.fr"...]]
    // CRITICAL: We must wait for complete frames, not use regex on partial data
    while (true) {
      // Trim any leading whitespace before trying to parse (handles whitespace between frames)
      this.buffer = this.buffer.trimStart();
      
      // Step 1: Try to extract byte count
      // Look for pattern: digits followed by newline
      // CRITICAL: We need to ensure we have a complete byte count, not a partial one
      // A valid byte count must be followed by a newline, then the frame content
      
      // First, check if buffer starts with digits (might be partial byte count)
      const leadingDigitsMatch = this.buffer.match(/^(\d+)/);
      if (!leadingDigitsMatch) {
        // Buffer doesn't start with digits - might be corrupted, leftover content, or empty
        if (this.buffer.length > 0) {
          // Try to find the next valid frame header by searching for byte count pattern
          // Look for: digits followed by newline and wrb.fr frame start
          // Pattern: (\d+)\n\[\["wrb\.fr"
          const nextFrameMatch = this.buffer.match(/(\d+)\n\[\["wrb\.fr"/);
          if (nextFrameMatch) {
            // Found a frame header later in the buffer - skip the invalid content
            const skipLength = this.buffer.indexOf(nextFrameMatch[0]);
            if (this.config.debug) {
              this.log(`⚠️ Buffer doesn't start with digits. Found frame header at position ${skipLength}, skipping ${skipLength} bytes of invalid content`);
              this.log(`   Skipped content preview: "${this.buffer.substring(0, Math.min(200, skipLength))}"`);
            }
            this.buffer = this.buffer.substring(skipLength);
            continue; // Retry parsing with cleaned buffer
          } else {
            // Also try simpler pattern: just digits followed by newline (might be at start after trimming)
            const simpleMatch = this.buffer.match(/(\d+)\n/);
            if (simpleMatch && simpleMatch.index !== undefined && simpleMatch.index < 100) {
              // Found a byte count pattern within first 100 chars - likely a frame header
              const skipLength = simpleMatch.index;
              if (this.config.debug) {
                this.log(`⚠️ Buffer doesn't start with digits. Found byte count pattern at position ${skipLength}, skipping ${skipLength} bytes`);
                this.log(`   Skipped content preview: "${this.buffer.substring(0, Math.min(200, skipLength))}"`);
              }
              this.buffer = this.buffer.substring(skipLength);
              continue; // Retry parsing with cleaned buffer
            }
            
            // No frame header found - might need more data or buffer is corrupted
            if (this.config.debug) {
              this.log(`⏳ Buffer doesn't start with digits and no frame header found. Buffer start: "${this.buffer.substring(0, 100)}"`);
              this.log(`   Buffer length: ${this.buffer.length} bytes. Waiting for more data or next frame header.`);
            }
            break;
          }
        } else {
          // Empty buffer - wait for more data
          break;
        }
      }
      
      // Check if we have a newline after the digits
      const digitsLength = leadingDigitsMatch[1].length;
      if (this.buffer.length < digitsLength + 1 || this.buffer[digitsLength] !== '\n') {
        // We have a partial byte count (digits but no newline yet)
        if (this.config.debug) {
          this.log(`⏳ Waiting for complete byte count (partial: "${leadingDigitsMatch[1]}"). Need newline. Buffer length: ${this.buffer.length}`);
        }
        break;
      }
      
      // We have a complete byte count: digits + newline
      const byteCountMatch = this.buffer.match(/^(\d+)\n/);
      if (!byteCountMatch) {
        // This shouldn't happen if the above checks passed, but handle it anyway
        if (this.config.debug) {
          this.logError(`⚠️ Unexpected: byte count regex failed after validation. Buffer start: "${this.buffer.substring(0, 50)}"`);
        }
        break;
      }

      const byteCount = parseInt(byteCountMatch[1], 10);
      const headerLength = byteCountMatch[0].length; // Includes newline
      
      if (this.config.debug) {
        this.log(`🔍 Extracted byte count: ${byteCount}, header length: ${headerLength}, buffer length: ${this.buffer.length}`);
      }

      // Step 2: Check if we have the full frame
      // We need: headerLength (byte count + newline) + byteCount (frame content)
      const requiredLength = headerLength + byteCount;
      if (this.buffer.length < requiredLength) {
        // Frame incomplete, wait for more data
        if (this.config.debug) {
          this.log(`⏳ Waiting for complete frame. Need ${requiredLength} bytes, have ${this.buffer.length} bytes. Byte count: ${byteCount}`);
        }
        break;
      }

      // Step 3: Extract the complete frame using exact byte count
      const frameText = this.buffer.substring(headerLength, requiredLength);
      
      if (this.config.debug) {
        this.log(`✅ Extracting frame: byteCount=${byteCount}, frameLength=${frameText.length}, bufferLength=${this.buffer.length}`);
        this.log(`   Frame preview (first 200 chars): ${frameText.substring(0, 200)}`);
        this.log(`   Frame preview (last 50 chars): ${frameText.substring(Math.max(0, frameText.length - 50))}`);
      }

      // Step 4: Parse the frame
      // Note: frameText should be exactly byteCount bytes, but may have trailing whitespace
      // We'll let parseChunk handle any trailing whitespace issues
      // 
      // CRITICAL: NotebookLM sends two types of frames:
      // 1. Incremental updates (PARTIAL): Incomplete JSON strings - skip these
      // 2. Complete responses (FULL): Complete JSON frames - parse these
      let parsed: ReturnType<typeof this.parseChunk> = null;
      
      try {
        parsed = this.parseChunk(byteCount, frameText);
        if (parsed) {
          chunks.push(parsed);
          if (this.config.debug) {
            this.log(`✅ Successfully parsed chunk with ${parsed.text?.length || 0} chars of text`);
          }
        } else {
          // parseChunk returned null - this is an incomplete frame (incremental update)
          if (this.config.debug) {
            this.log(`⏭️  Skipping incomplete frame (${byteCount} bytes) - incremental update`);
          }
        }
      } catch (error) {
        // Real parsing error (not incomplete frame - those return null)
        // Log error but continue processing - don't break the loop
        if (this.config.debug) {
          this.logError(`❌ Error parsing chunk: ${error}`);
          this.logError(`   Frame text length: ${frameText.length} bytes (expected: ${byteCount})`);
        }
        // Don't break - continue processing other frames
      }

      // Step 5: ✅ ALWAYS remove frame from buffer (even if skipped or errored)
      // This prevents infinite loops when incomplete frames are encountered
      const bufferBeforeRemoval = this.buffer;
      const removedBytes = requiredLength;
      
      // Validate removal length matches expected
      if (this.buffer.length < requiredLength) {
        if (this.config.debug) {
          this.logError(`❌ CRITICAL: Buffer length (${this.buffer.length}) < required length (${requiredLength})!`);
          this.logError(`   This should not happen - frame validation should have caught this.`);
        }
        break; // Can't safely remove - wait for more data
      }
      
      // Extract what we're about to remove for validation
      const removedContent = this.buffer.substring(0, requiredLength);
      this.buffer = this.buffer.substring(requiredLength).trimStart();
      
      if (this.config.debug) {
        if (!parsed) {
          this.log(`   Removed incomplete/errored frame from buffer (${removedBytes} bytes)`);
        }
        this.log(`   Removed content ends with: "${removedContent.substring(Math.max(0, removedContent.length - 50))}"`);
        
        if (this.buffer.length > 0) {
          this.log(`📦 Remaining buffer: ${this.buffer.length} bytes. Next 100 chars: "${this.buffer.substring(0, 100)}"`);
          this.log(`   Buffer before removal: ${bufferBeforeRemoval.length} bytes`);
          this.log(`   Removed: ${removedBytes} bytes (header: ${headerLength}, frame: ${byteCount})`);
          this.log(`   Expected remaining: ${bufferBeforeRemoval.length - removedBytes} bytes`);
          this.log(`   Actual remaining: ${this.buffer.length} bytes`);
          
          // Validate that the next buffer starts with a byte count or is empty
          const trimmedBuffer = this.buffer.trimStart();
          const nextStartsWithByteCount = /^\d+\n/.test(trimmedBuffer);
          if (!nextStartsWithByteCount && trimmedBuffer.length > 0) {
            this.logError(`⚠️ WARNING: Remaining buffer doesn't start with byte count!`);
            this.logError(`   Buffer start (first 200 chars): "${this.buffer.substring(0, 200)}"`);
            this.logError(`   Buffer start (hex): ${Array.from(this.buffer.substring(0, Math.min(50, this.buffer.length))).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
            // Try to find next frame header
            const nextFrameMatch = this.buffer.match(/(\d+)\n\[\["wrb\.fr"/);
            if (nextFrameMatch && nextFrameMatch.index !== undefined) {
              this.logError(`   Found potential frame header at position ${nextFrameMatch.index}`);
            }
          } else if (nextStartsWithByteCount) {
            const nextByteCountMatch = trimmedBuffer.match(/^(\d+)\n/);
            if (nextByteCountMatch) {
              this.log(`✅ Next frame byte count: ${nextByteCountMatch[1]}`);
            }
          }
        } else {
          this.log(`📦 Buffer is now empty - waiting for more data`);
        }
      }
    }

    return chunks;
  }

  /**
   * Parse a single chunk
   * 
   * Format: [["wrb.fr", null, "<escaped_json>"]]
   * 
   * The escaped JSON contains:
   * [[
   *   "response text",
   *   null,
   *   ["conv_id", "msg_id", timestamp],
   *   null,
   *   [[ranges], [formatting]]
   * ]]
   */
  private parseChunk(byteCount: number, frameText: string): {
    byteCount: number;
    text: string;
    thinking: string[];
    response: string;
    metadata?: [string, string, number];
    messageIds?: [string, string];
    timestamp?: number;
    isThinking?: boolean;
    isResponse?: boolean;
    formatting?: any;
    citations?: number[];
    rawData?: any;
    isError?: boolean;
    errorCode?: number;
  } | null {
    try {
      // Step 1: Trim trailing whitespace/newlines that might be included in byte count
      // but are not part of the JSON structure
      let trimmedChunkText = frameText.trimEnd();
      
      // Also try removing a single trailing newline if present (common in streaming protocols)
      if (trimmedChunkText.endsWith('\n')) {
        trimmedChunkText = trimmedChunkText.slice(0, -1);
      }
      
      // CRITICAL FIX: The byte count may include trailing characters that are not part of the JSON
      // Looking at the error: frame ends with `]]]]]]],null,null,null,2]],null,null,null,false]"]]
      // 1` - the `1` is included in byte count but breaks JSON parsing
      // We need to find where the JSON actually ends by trying to parse it
      
      // Strategy: Try to find valid JSON by removing trailing non-JSON characters
      // The protocol may include trailing digits, newlines, or other markers
      let jsonText = trimmedChunkText;
      
      // Try parsing as-is first
      try {
        JSON.parse(jsonText);
        // Success! Use as-is
      } catch (e) {
        // Parsing failed - try removing trailing characters
        // Remove trailing digits, newlines, whitespace that might be protocol markers
        let testText = jsonText;
        let foundValid = false;
        
        // Try removing up to 10 trailing characters (should be enough for protocol markers)
        for (let i = 0; i < 10 && testText.length > 0; i++) {
          const lastChar = testText[testText.length - 1];
          // Only remove if it's a digit, newline, carriage return, or whitespace
          if (/[\d\n\r\s]/.test(lastChar)) {
            testText = testText.slice(0, -1);
            // Try parsing the shortened text
            try {
              JSON.parse(testText);
              jsonText = testText;
              foundValid = true;
              if (this.config.debug) {
                this.log(`✅ Found valid JSON by removing ${i + 1} trailing character(s)`);
              }
              break;
            } catch (parseError) {
              // Continue removing characters
            }
          } else {
            // Not a removable character, stop
            break;
          }
        }
        
        if (!foundValid) {
          // Could not find valid JSON even after removing trailing characters
          // This is likely an incomplete frame (incremental update)
          // Check if the error was "Unterminated string" or "Unexpected non-whitespace"
          if (e instanceof SyntaxError && 
              (e.message.includes('Unterminated string') || 
               e.message.includes('Unexpected non-whitespace'))) {
            if (this.config.debug) {
              this.log(`⏭️  Incomplete frame detected (${byteCount} bytes) - skipping incremental update`);
            }
            return null; // Skip incomplete frame
          }
          
          // Other parsing errors - log and return null
          if (this.config.debug) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            this.logError(`⚠️ Could not find valid JSON by removing trailing characters`);
            this.logError(`   Error: ${errorMessage}`);
            this.logError(`   Last 50 chars: ${trimmedChunkText.substring(Math.max(0, trimmedChunkText.length - 50))}`);
          }
          return null;
        }
      }
      
      // Step 2: Parse the outer wrb.fr wrapper
      // Format: [["wrb.fr", null, "<escaped_json>"]]
      let outerParsed;
      try {
        outerParsed = JSON.parse(jsonText);
      } catch (parseError) {
        // If parsing still fails after removing trailing chars, it's an incomplete frame
        if (parseError instanceof SyntaxError && 
            (parseError.message.includes('Unterminated string') || 
             parseError.message.includes('Unexpected non-whitespace'))) {
          if (this.config.debug) {
            this.log(`⏭️  Incomplete frame detected during outer parse (${byteCount} bytes) - skipping`);
          }
          return null; // Skip incomplete frame
        }
        throw parseError; // Re-throw other errors
      }
      
      if (!Array.isArray(outerParsed) || outerParsed.length === 0) {
        if (this.config.debug) {
          this.logError('Frame is not an array or is empty');
        }
        return null;
      }

      const wrbFrame = outerParsed[0];
      if (!Array.isArray(wrbFrame) || wrbFrame[0] !== 'wrb.fr') {
        if (this.config.debug) {
          this.logError(`Not a wrb.fr frame: ${wrbFrame?.[0]}`);
        }
        return null;
      }

      // Step 3: Extract the escaped JSON string (3rd element)
      const escapedJson = wrbFrame[2];
      if (typeof escapedJson !== 'string') {
        if (this.config.debug) {
          this.logError('No escaped JSON string in wrb.fr frame');
        }
        // Check for error frames: [["wrb.fr", null, null, null, null, [errorCode]]]
        if (wrbFrame.length > 5 && Array.isArray(wrbFrame[5]) && wrbFrame[5].length > 0) {
          return {
            byteCount,
            text: '',
            thinking: [],
            response: '',
            isError: true,
            errorCode: wrbFrame[5][0],
            citations: [],
          };
        }
        return null;
      }
      
      // Step 4: Parse the inner JSON
      let innerData;
      try {
        innerData = JSON.parse(escapedJson);
      } catch (parseError) {
        // If parsing inner JSON fails with "Unterminated string", it's an incomplete frame
        if (parseError instanceof SyntaxError && 
            (parseError.message.includes('Unterminated string') || 
             parseError.message.includes('Unexpected non-whitespace'))) {
          if (this.config.debug) {
            this.log(`⏭️  Incomplete frame detected during inner parse (${byteCount} bytes) - skipping`);
          }
          return null; // Skip incomplete frame
        }
        throw parseError; // Re-throw other errors
      }
      
      if (!Array.isArray(innerData) || innerData.length === 0) {
        if (this.config.debug) {
          this.logError('Inner data is not an array or is empty');
        }
        return null;
      }
      
      // Step 5: Extract data from the inner array
      // Format: [["text", null, metadata, null, formatting, ...]]
      const dataArray = innerData[0];
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        if (this.config.debug) {
          this.logError('Data array is not an array or is empty');
        }
        return null;
      }
      
      const text = dataArray[0] || '';
      const metadata = dataArray[2]; // [conv_id, msg_id, timestamp]
      const formatting = dataArray[4]; // Formatting information
      const statusCode = dataArray[8]; // Status code (if present)
      
      // Extract metadata
      let conversationId: string | undefined;
      let messageId: string | undefined;
      let timestamp: number | undefined;
      
      if (Array.isArray(metadata) && metadata.length >= 3) {
        conversationId = metadata[0];
        messageId = metadata[1];
        timestamp = metadata[2];
      }
      
      // Extract thinking headers (bold text: **Header**)
      const thinking: string[] = [];
      const thinkingMatches = text.match(/\*\*([^*]+)\*\*/g);
      if (thinkingMatches) {
        for (const match of thinkingMatches) {
          thinking.push(match.slice(2, -2).trim());
        }
      }
      
      // Extract response (non-bold text)
      const response = text.replace(/\*\*[^*]+\*\*/g, '').trim();
      
      // Extract citations [1], [2], [1, 2], etc.
      const citations: number[] = [];
      // Match both formats: [1] or [1, 2, 3]
      const citationMatches = text.match(/\[(\d+(?:\s*,\s*\d+)*)\]/g);
      if (citationMatches) {
        for (const match of citationMatches) {
          // Extract all numbers from the match (handles both [1] and [1, 2, 3])
          const numbers = match.match(/\d+/g);
          if (numbers) {
            for (const numStr of numbers) {
              const num = parseInt(numStr, 10);
              if (!isNaN(num) && !citations.includes(num)) {
                citations.push(num);
              }
            }
          }
        }
      }

      return {
        byteCount,
        text,
        thinking,
        response,
        metadata: conversationId && messageId && timestamp ? [conversationId, messageId, timestamp] : undefined,
        messageIds: conversationId && messageId ? [conversationId, messageId] : undefined,
        timestamp,
        isThinking: thinking.length > 0,
        isResponse: response.length > 0,
        formatting,
        citations: citations.length > 0 ? citations : undefined,
        rawData: innerData,
        isError: statusCode === 4 || statusCode === 139,
        errorCode: statusCode,
      };
    } catch (error) {
      // Check if it's an incomplete frame error (incremental update)
      if (error instanceof SyntaxError && 
          (error.message.includes('Unterminated string') || 
           error.message.includes('Unexpected non-whitespace'))) {
        if (this.config.debug) {
          this.log(`⏭️  Incomplete frame detected in catch block (${byteCount} bytes) - skipping`);
        }
        return null; // Skip incomplete frame
      }
      
      // For other errors, log and re-throw
      if (this.config.debug) {
        this.logError(`Error parsing chunk: ${error}`);
      }
      throw error; // Re-throw other errors to trigger retry logic in processStreamBuffer
    }
  }

  /**
   * Check if frame indicates an error
   * Error frames have structure: ["wrb.fr", null, null, null, null, [16]]
   */
  private isErrorFrame(frame: any[]): boolean {
    return (
      frame.length >= 6 &&
      frame[2] === null &&
      frame[3] === null &&
      frame[4] === null &&
      Array.isArray(frame[5])
    );
  }

  /**
   * Parse error frame
   */
  private parseError(frame: any[]): {
    byteCount: number;
    text: string;
    thinking: string[];
    response: string;
    isError: boolean;
    errorCode?: number;
  } {
    return {
      byteCount: 0,
      text: '',
      thinking: [],
      response: '',
      isError: true,
      errorCode: Array.isArray(frame[5]) && frame[5].length > 0 ? frame[5][0] : undefined,
    };
  }

  /**
   * Extract citation numbers from text
   * Format: [1], [2], [3]
   */
  private extractCitations(text: string): number[] {
    const matches = text.match(/\[(\d+)\]/g);
    if (!matches) return [];
    return matches.map(m => parseInt(m.slice(1, -1), 10));
  }

  /**
   * Extract thinking headers from text
   * Format: **Header Text**
   */
  private extractThinking(text: string): string[] {
    const matches = text.match(/\*\*([^*]+)\*\*/g);
    if (!matches) return [];
    return matches.map(m => m.slice(2, -2).trim());
  }
}

