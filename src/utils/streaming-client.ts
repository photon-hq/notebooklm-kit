/**
 * Streaming client for NotebookLM chat
 * Handles chunked streaming responses from GenerateFreeFormStreamed endpoint
 * 
 * REWRITTEN VERSION with improved buffer draining logic
 * ======================================================
 * 
 * Key improvements:
 * 1. Simplified buffer processing logic
 * 2. More aggressive buffer draining after stream ends
 * 3. Better handling of incomplete frames
 * 4. Cleaner code structure with same interfaces
 * 
 * CRITICAL FIXES MAINTAINED:
 * ==========================
 * 1. ✅ source-path parameter in URL
 * 2. ✅ Single URL encoding (no double encoding)
 * 3. ✅ notebookId as last parameter in request body
 * 
 * Response Format:
 * ----------------
 * Chunks arrive in this format:
 * <byte_count>
 * [["wrb.fr", null, "<escaped_json>"]]
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
 * Parsed chunk data structure (internal)
 */
interface ParsedChunk {
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
}

/**
 * Streaming client for NotebookLM chat
 * Handles chunked streaming responses with improved buffer draining
 */
export class StreamingClient {
  private config: RPCClientConfig;
  private requestCounter: number = 3114440;
  private buffer: string = '';
  private chunkCount: number = 0;

  constructor(config: RPCClientConfig) {
    this.config = config;
    this.requestCounter = Math.floor(Math.random() * 9000) + 3114440;
  }

  /**
   * Log message (disabled by default)
   */
  private log(_message: string): void {
    // Debug logging disabled
  }

  /**
   * Log error (disabled by default)
   */
  private logError(_message: string): void {
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
   * @param notebookId - The notebook UUID
   * @param prompt - User's question
   * @param sourceIds - List of source IDs to query
   * @param conversationId - Conversation UUID
   * @param conversationHistory - Message history (always null)
   * @param options - Streaming options
   */
  async *streamChat(
    notebookId: string,
    prompt: string,
    sourceIds: string[],
    conversationId: string,
    conversationHistory: any[] | null,
    options?: StreamingOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const url = this.buildStreamingURL(notebookId);
    const headers = this.buildHeaders();
    const body = this.buildRequestBody(prompt, sourceIds, conversationId, conversationHistory, notebookId);

    if (this.config.debug) {
      const decodedBody = this.decodeRequestBody(body);
      this.log('\n🌊 Streaming Chat Request:');
      this.log('📝 URL: ' + url);
      this.log('📝 Body length: ' + body.length + ' bytes');
      this.log('\n📦 Request Body (decoded):');
      this.log(JSON.stringify(decodedBody, null, 2));
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Streaming request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

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

      // Main streaming loop
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (this.config.debug && this.buffer.length > 0) {
            this.log(`\n📥 Stream ended, buffer has ${this.buffer.length} bytes remaining`);
          }

          // Decode any remaining data from decoder
          try {
            const remainingDecoded = decoder.decode(undefined, { stream: false });
            if (remainingDecoded) {
              totalBytesReceived += remainingDecoded.length;
              this.buffer += remainingDecoded;
              if (this.config.debug) {
                this.log(`📥 Decoded ${remainingDecoded.length} remaining bytes from decoder`);
              }
            }
          } catch (decodeError) {
            // Ignore decode errors
          }

          // ✅ CRITICAL: Aggressively drain ALL remaining buffer
          // Keep processing until no more complete frames can be extracted
          let drainIterations = 0;
          const MAX_DRAIN_ITERATIONS = 100;

          if (this.config.debug) {
            this.log(`\n🔄 Starting aggressive buffer drain (buffer size: ${this.buffer.length} bytes)`);
          }

          while (drainIterations < MAX_DRAIN_ITERATIONS) {
            const chunks = this.extractCompleteFrames();

            if (chunks.length === 0) {
              // No more complete frames found
              break;
            }

            if (this.config.debug) {
              this.log(`🔄 Drain iteration ${drainIterations + 1}: extracted ${chunks.length} chunk(s)`);
            }

            for (const parsed of chunks) {
              this.chunkCount++;
              const streamChunk = this.createStreamChunk(parsed);

              if (options?.onChunk) {
                options.onChunk(streamChunk);
              }

              yield streamChunk;
            }

            drainIterations++;
          }

          if (this.config.debug) {
            this.log(`\n✅ Buffer drain complete after ${drainIterations} iterations`);
            this.log(`   Final buffer size: ${this.buffer.length} bytes`);
            if (this.buffer.length > 0) {
              this.log(`   Remaining buffer: ${this.buffer.substring(0, 200)}`);
            }
          }

          break;
        }

        // Process incoming data
        if (value && value.length > 0) {
          const newData = decoder.decode(value, { stream: true });
          totalBytesReceived += value.length;
          this.buffer += newData;

          if (this.config.debug) {
            this.log(`\n📥 Received chunk #${++chunkIndex}: ${value.length} bytes (total: ${totalBytesReceived} bytes)`);
          }

          // Extract and yield complete frames from buffer
          const chunks = this.extractCompleteFrames();
          for (const parsed of chunks) {
            this.chunkCount++;
            const streamChunk = this.createStreamChunk(parsed);

            if (this.config.debug) {
              this.log(`\n📦 Parsed Chunk #${this.chunkCount}:`);
              this.log(`   Text Length: ${parsed.text?.length || 0}`);
              this.log(`   Citations: [${parsed.citations?.join(', ') || 'none'}]`);
            }

            if (options?.onChunk) {
              options.onChunk(streamChunk);
            }

            yield streamChunk;
          }
        }
      }

      if (this.config.debug) {
        this.log(`\n✅ Stream complete: ${this.chunkCount} chunks received, ${totalBytesReceived} total bytes`);
      }
    } catch (error) {
      if (this.config.debug) {
        this.logError(`\n❌ Streaming Error: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Extract all complete frames from buffer
   * This is the core buffer processing logic - simplified and foolproof
   */
  private extractCompleteFrames(): ParsedChunk[] {
    const frames: ParsedChunk[] = [];

    // Remove XSSI prefix if present
    if (this.buffer.startsWith(")]}'")) {
      this.buffer = this.buffer.substring(4).trimStart();
    }

    // Keep extracting frames until buffer is exhausted
    let iterations = 0;
    const MAX_ITERATIONS = 1000;

    while (this.buffer.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Trim leading whitespace
      this.buffer = this.buffer.trimStart();

      if (this.buffer.length === 0) {
        break;
      }

      // Look for byte count pattern: digits followed by newline
      const byteCountMatch = this.buffer.match(/^(\d+)\n/);

      if (!byteCountMatch) {
        // No valid frame header at start - try to find next frame
        const nextFrameMatch = this.buffer.match(/(\d+)\n\[\["wrb\.fr"/);

        if (nextFrameMatch && nextFrameMatch.index !== undefined && nextFrameMatch.index > 0) {
          // Skip invalid content before next frame
          if (this.config.debug) {
            this.log(`⚠️  Skipping ${nextFrameMatch.index} bytes of invalid content`);
          }
          this.buffer = this.buffer.substring(nextFrameMatch.index);
          continue;
        } else {
          // No more frames found
          break;
        }
      }

      const byteCount = parseInt(byteCountMatch[1], 10);
      const headerLength = byteCountMatch[0].length;
      const requiredLength = headerLength + byteCount;

      // Check if we have the complete frame
      if (this.buffer.length < requiredLength) {
        // Incomplete frame - wait for more data
        if (this.config.debug) {
          this.log(`⏳ Incomplete frame: need ${requiredLength} bytes, have ${this.buffer.length} bytes`);
        }
        break;
      }

      // Extract the complete frame
      const frameText = this.buffer.substring(headerLength, requiredLength);

      // Parse the frame
      try {
        const parsed = this.parseFrame(byteCount, frameText);
        if (parsed) {
          frames.push(parsed);
          if (this.config.debug) {
            this.log(`✅ Parsed frame: ${parsed.text?.length || 0} chars`);
          }
        } else {
          // Incomplete frame (incremental update) - skip it
          if (this.config.debug) {
            this.log(`⏭️  Skipping incomplete frame (${byteCount} bytes)`);
          }
        }
      } catch (error) {
        // Parsing error - log and continue
        if (this.config.debug) {
          this.logError(`❌ Error parsing frame: ${error}`);
        }
      }

      // ALWAYS remove the frame from buffer (even if parsing failed)
      this.buffer = this.buffer.substring(requiredLength).trimStart();
    }

    return frames;
  }

  /**
   * Parse a single frame
   * Returns null for incomplete frames (incremental updates)
   */
  private parseFrame(byteCount: number, frameText: string): ParsedChunk | null {
    try {
      // Trim trailing whitespace
      let jsonText = frameText.trimEnd();

      // Try to find valid JSON by removing trailing protocol markers
      try {
        JSON.parse(jsonText);
      } catch (e) {
        // Try removing trailing digits/whitespace (protocol markers)
        let testText = jsonText;
        let foundValid = false;

        for (let i = 0; i < 10 && testText.length > 0; i++) {
          const lastChar = testText[testText.length - 1];
          if (/[\d\n\r\s]/.test(lastChar)) {
            testText = testText.slice(0, -1);
            try {
              JSON.parse(testText);
              jsonText = testText;
              foundValid = true;
              break;
            } catch {
              // Continue
            }
          } else {
            break;
          }
        }

        if (!foundValid) {
          // Check if it's an incomplete frame
          if (e instanceof SyntaxError && 
              (e.message.includes('Unterminated string') || 
               e.message.includes('Unexpected non-whitespace'))) {
            return null; // Skip incomplete frame
          }
          return null;
        }
      }

      // Parse outer wrapper: [["wrb.fr", null, "<escaped_json>"]]
      const outerParsed = JSON.parse(jsonText);

      if (!Array.isArray(outerParsed) || outerParsed.length === 0) {
        return null;
      }

      const wrbFrame = outerParsed[0];
      if (!Array.isArray(wrbFrame) || wrbFrame[0] !== 'wrb.fr') {
        return null;
      }

      // Extract escaped JSON
      const escapedJson = wrbFrame[2];
      if (typeof escapedJson !== 'string') {
        // Check for error frames
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

      // Parse inner JSON
      let innerData;
      try {
        innerData = JSON.parse(escapedJson);
      } catch (parseError) {
        if (parseError instanceof SyntaxError && 
            (parseError.message.includes('Unterminated string') || 
             parseError.message.includes('Unexpected non-whitespace'))) {
          return null; // Skip incomplete frame
        }
        throw parseError;
      }

      if (!Array.isArray(innerData) || innerData.length === 0) {
        return null;
      }

      // Extract data
      const dataArray = innerData[0];
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return null;
      }

      // Extract text (full accumulated text)
      let text = dataArray[0] || '';
      if (typeof text !== 'string') {
        text = text === null || text === undefined ? '' : String(text);
      }

      const metadata = dataArray[2];
      const formatting = dataArray[4];
      const statusCode = dataArray[8];

      // Extract metadata
      let conversationId: string | undefined;
      let messageId: string | undefined;
      let timestamp: number | undefined;

      if (Array.isArray(metadata) && metadata.length >= 3) {
        conversationId = metadata[0];
        messageId = metadata[1];
        timestamp = metadata[2];
      }

      // Extract thinking headers (**Header**)
      const thinking: string[] = [];
      const thinkingMatches = text.match(/\*\*([^*]+)\*\*/g);
      if (thinkingMatches) {
        for (const match of thinkingMatches) {
          thinking.push(match.slice(2, -2).trim());
        }
      }

      // Extract response (non-bold text)
      const response = text.replace(/\*\*[^*]+\*\*/g, '');

      // Extract citations [1], [2], etc.
      const citations: number[] = [];
      const citationMatches = text.match(/\[(\d+)\]/g);
      if (citationMatches) {
        for (const match of citationMatches) {
          const num = parseInt(match.slice(1, -1), 10);
          if (!citations.includes(num)) {
            citations.push(num);
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
      // Check for incomplete frame
      if (error instanceof SyntaxError && 
          (error.message.includes('Unterminated string') || 
           error.message.includes('Unexpected non-whitespace'))) {
        return null;
      }

      if (this.config.debug) {
        this.logError(`Error parsing frame: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Create StreamChunk from ParsedChunk
   */
  private createStreamChunk(parsed: ParsedChunk): StreamChunk {
    return {
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
  }

  /**
   * Build streaming URL
   */
  private buildStreamingURL(notebookId: string): string {
    this.requestCounter++;

    const batchClient = (this.config as any).batchClient;
    let fSid = '-7958112141384765164';

    if (batchClient?.config?.urlParams?.['f.sid']) {
      fSid = batchClient.config.urlParams['f.sid'];
    } else if (this.config.urlParams?.['f.sid']) {
      fSid = this.config.urlParams['f.sid'];
    }

    const sourcePath = `/notebook/${notebookId}`;

    const params = new URLSearchParams({
      bl: 'boq_labs-tailwind-frontend_20260101.17_p0',
      'f.sid': fSid,
      hl: 'en',
      authuser: this.config.authUser || '0',
      pageId: 'none',
      _reqid: this.requestCounter.toString(),
      rt: 'c',
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
   */
  private buildRequestBody(
    prompt: string,
    sourceIds: string[],
    conversationId: string,
    conversationHistory: any[] | null,
    notebookId: string
  ): string {
    const contextItems: any[] = [];

    if (sourceIds && sourceIds.length > 0) {
      for (const sourceId of sourceIds) {
        contextItems.push([[sourceId]]);
      }
    } else {
      contextItems.push([[conversationId]]);
    }

    const innerRequest = [
      contextItems,
      prompt,
      null,
      [2, null, [1]],
      notebookId,
    ];

    const fReq = [null, JSON.stringify(innerRequest)];

    const formData = new URLSearchParams();
    formData.append('f.req', JSON.stringify(fReq));
    formData.append('at', this.config.authToken);

    return formData.toString();
  }

  /**
   * Decode request body for logging
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
            'at': params.get('at')?.substring(0, 20) + '...',
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
}