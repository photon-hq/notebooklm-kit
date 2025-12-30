/**
 * Audio service
 * Handles audio overview operations and interactive audio downloads
 * 
 * ## Implementation Method
 * 
 * **RPC Method:** `RPC_GET_AUDIO_DOWNLOAD` (RPC ID: `Fxmvse`)
 * 
 * **Download Process:**
 * 1. Get audio overview to check if audio is ready and get audioId
 * 2. Call RPC_GET_AUDIO_DOWNLOAD with audioId to get download URL
 * 3. Download audio file from the URL
 * 
 * **Based on:** `rpc/mm30.txt` - Audio download RPC calls
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { AudioOverview, CreateAudioOverviewOptions, ShareAudioResult } from '../types/audio.js';
import { ShareOption } from '../types/audio.js';
import { NotebookLMError } from '../types/common.js';
import * as https from 'https';
import * as http from 'http';

/**
 * Service for audio overview operations
 */
export class AudioService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  /**
   * Create an audio overview (podcast)
   * 
   * @param notebookId - The notebook ID
   * @param options - Audio creation options
   * 
   * @example
   * ```typescript
   * import { NotebookLMLanguage, AudioLanguage } from 'notebooklm-kit';
   * 
   * // Create in Hindi (using NotebookLMLanguage enum - recommended)
   * const audio = await client.audio.create('notebook-id', {
   *   instructions: 'Focus on the key findings',
   *   language: NotebookLMLanguage.HINDI, // or AudioLanguage.HINDI for backward compatibility
   * });
   * 
   * // Create with customization (supports 80+ languages)
   * const audio = await client.audio.create('notebook-id', {
   *   language: NotebookLMLanguage.TAMIL, // or 'ta'
   *   customization: {
   *     tone: 'educational',
   *     length: 'detailed',
   *   },
   * });
   * ```
   */
  async create(notebookId: string, options: CreateAudioOverviewOptions = {}): Promise<AudioOverview> {
    const { instructions = '', audioType = 0, language, customization } = options;
    
    // Check quota before creating
    this.quota?.checkQuota('createAudioOverview');
    
    // Build instructions with language and customization
    let finalInstructions = instructions;
    
    if (language || customization) {
      const parts: string[] = [];
      
      if (instructions) {
        parts.push(instructions);
      }
      
      if (language) {
        parts.push(`Language: ${language}`);
      }
      
      if (customization?.tone) {
        parts.push(`Tone: ${customization.tone}`);
      }
      
      if (customization?.length) {
        parts.push(`Length: ${customization.length}`);
      }
      
      if (customization?.focusAreas && customization.focusAreas.length > 0) {
        parts.push(`Focus on: ${customization.focusAreas.join(', ')}`);
      }
      
      finalInstructions = parts.join('. ');
    }
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_AUDIO_OVERVIEW,
      [notebookId, audioType, [finalInstructions]],
      notebookId
    );
    
    const audio = this.parseCreateResponse(response, notebookId);
    
    // Record usage after successful creation
    this.quota?.recordUsage('createAudioOverview');
    
    return audio;
  }
  
  /**
   * Get audio overview details
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const audio = await client.audio.get('notebook-id');
   * if (audio.isReady) {
   *   console.log('Audio is ready!');
   * }
   * ```
   */
  async get(notebookId: string): Promise<AudioOverview> {
    const response = await this.rpc.call(
      RPC.RPC_GET_AUDIO_OVERVIEW,
      [notebookId, 1],
      notebookId
    );
    
    return this.parseGetResponse(response, notebookId);
  }
  
  /**
   * Download audio overview
   * Tries different request types to find audio data
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * const audio = await client.audio.download('notebook-id');
   * if (audio.audioData) {
   *   await audio.saveToFile('audio.mp3');
   * }
   * ```
   */
  async download(notebookId: string): Promise<AudioOverview & { saveToFile: (path: string) => Promise<void> }> {
    // Try different request types to find audio data
    const requestTypes = [0, 1, 2, 3, 4, 5];
    
    for (const requestType of requestTypes) {
      try {
        const response = await this.rpc.call(
          RPC.RPC_GET_AUDIO_OVERVIEW,
          [notebookId, requestType],
          notebookId
        );
        
        const audio = this.parseGetResponse(response, notebookId);
        
        if (audio.audioData) {
          // Add saveToFile helper
          return {
            ...audio,
            saveToFile: async (path: string) => {
              if (!audio.audioData) {
                throw new NotebookLMError('No audio data available');
              }
              
              // Decode base64 to Uint8Array
              const binaryString = atob(audio.audioData);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Try Node.js environment
              try {
                // Dynamic import without type checking
                const fsModule: any = await import('fs/promises' as any).catch(() => null);
                
                if (fsModule?.writeFile) {
                  await fsModule.writeFile(path, bytes);
                  return;
                }
              } catch {
                // Fall through to browser
              }
              
              // Browser environment - create download link
              if (typeof Blob !== 'undefined') {
                const blob = new Blob([bytes], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = path;
                a.click();
                URL.revokeObjectURL(url);
              } else {
                throw new NotebookLMError('Cannot save file: unsupported environment');
              }
            },
          };
        }
      } catch {
        // Try next request type
        continue;
      }
    }
    
    throw new NotebookLMError('No request type returned audio data - the audio may not be ready yet');
  }
  
  /**
   * Delete audio overview
   * 
   * @param notebookId - The notebook ID
   * 
   * @example
   * ```typescript
   * await client.audio.delete('notebook-id');
   * ```
   */
  async delete(notebookId: string): Promise<void> {
    await this.rpc.call(
      RPC.RPC_DELETE_AUDIO_OVERVIEW,
      [notebookId],
      notebookId
    );
  }
  
  /**
   * Share audio overview
   * 
   * @param notebookId - The notebook ID
   * @param shareOption - Share option (private or public)
   * 
   * @example
   * ```typescript
   * import { ShareOption } from 'notebooklm-kit';
   * 
   * const result = await client.audio.share('notebook-id', ShareOption.PUBLIC);
   * console.log(`Share URL: ${result.shareUrl}`);
   * ```
   */
  async share(notebookId: string, shareOption: ShareOption = ShareOption.PRIVATE): Promise<ShareAudioResult> {
    const response = await this.rpc.call(
      RPC.RPC_SHARE_AUDIO,
      [[shareOption], notebookId],
      notebookId
    );
    
    return this.parseShareResponse(response, shareOption);
  }
  
  // ========================================================================
  // Response parsers
  // ========================================================================
  
  private parseCreateResponse(response: any, notebookId: string): AudioOverview {
    try {
      let audioId = '';
      
      if (Array.isArray(response) && response.length > 0) {
        const audioData = response[0];
        if (Array.isArray(audioData) && audioData.length > 2) {
          // Status is at index 0 (2 = success)
          // Audio ID is at index 2
          audioId = audioData[2] || '';
        }
      }
      
      return {
        projectId: notebookId,
        audioId,
        isReady: false, // Audio generation is async
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse audio creation response: ${(error as Error).message}`);
    }
  }
  
  private parseGetResponse(response: any, notebookId: string): AudioOverview {
    try {
      const audio: AudioOverview = {
        projectId: notebookId,
        isReady: false,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        const audioData = response[0];
        if (Array.isArray(audioData)) {
          // Status
          if (audioData[0]) {
            audio.isReady = audioData[0] !== 'CREATING';
            audio.status = audioData[0];
          }
          
          // Audio content (base64)
          if (audioData[1]) {
            audio.audioData = audioData[1];
          }
          
          // Title
          if (audioData[2]) {
            audio.title = audioData[2];
          }
        }
      }
      
      return audio;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse audio overview: ${(error as Error).message}`);
    }
  }
  
  private parseShareResponse(response: any, shareOption: ShareOption): ShareAudioResult {
    try {
      const result: ShareAudioResult = {
        shareUrl: '',
        shareId: '',
        isPublic: shareOption === ShareOption.PUBLIC,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        result.shareUrl = response[0] || '';
      }
      
      if (Array.isArray(response) && response.length > 1) {
        result.shareId = response[1] || '';
      }
      
      return result;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse share audio response: ${(error as Error).message}`);
    }
  }
}

/**
 * Download audio file by audio ID
 * 
 * **What it does:** Downloads the complete audio file from NotebookLM.
 * This function retrieves the audio download URL and downloads the audio file.
 * 
 * **Input:**
 * - `audioId` (string, required): The ID of the audio artifact to download.
 *   You can obtain this ID from `audio.get(notebookId)` or `artifacts.list(notebookId)`.
 * - `notebookId` (string, optional): The notebook ID that contains the audio.
 *   Providing this ensures the correct source-path is set for the RPC call.
 * 
 * **Output:** Returns an object containing:
 * - `audioData`: Buffer/Uint8Array containing the audio file data
 * - `audioUrl`: The URL from which the audio was downloaded
 * - `saveToFile`: Helper function to save the audio to a file
 * 
 * **Usage Workflow:**
 * 1. Create an audio overview using `audio.create(notebookId, {...})`
 * 2. Poll the audio state using `audio.get(notebookId)` until `isReady === true`
 * 3. Get the audioId from the audio overview
 * 4. Call this function to download the audio file
 * 5. Use `saveToFile()` to save the audio to disk
 * 
 * **Note:**
 * - The audio must be in `READY` state before downloading (check with `audio.get()`)
 * - Attempting to download audio that's still `CREATING` may fail
 * - This function uses the `RPC_GET_AUDIO_DOWNLOAD` RPC method
 * - The downloaded audio is typically in MP3 format
 * 
 * **Error Handling:**
 * - Throws `NotebookLMError` if the audio ID is missing
 * - Throws `NotebookLMError` if the API call fails
 * - Throws `NotebookLMError` if the download URL cannot be obtained
 * - Throws `NotebookLMError` if the download fails
 * 
 * @param rpc - RPC client instance
 * @param audioId - The audio artifact ID
 * @param notebookId - Optional notebook ID (recommended for proper source-path)
 * @returns Promise resolving to audio download result with saveToFile helper
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, downloadAudioFile } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Step 1: Create audio overview
 * const audio = await client.audio.create('notebook-id', {
 *   instructions: 'Create a podcast summary'
 * });
 * 
 * // Step 2: Wait until ready (poll if needed)
 * let audioOverview = audio;
 * while (!audioOverview.isReady) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   audioOverview = await client.audio.get('notebook-id');
 * }
 * 
 * // Step 3: Download audio file
 * const rpc = client.getRPCClient();
 * const audioDownload = await downloadAudioFile(
 *   rpc,
 *   audioOverview.audioId!,
 *   'notebook-id'
 * );
 * 
 * // Step 4: Save to file
 * await audioDownload.saveToFile('audio.mp3');
 * console.log('Audio saved successfully!');
 * ```
 * 
 * @example
 * ```typescript
 * // Simple usage with NotebookLMClient
 * import { NotebookLMClient, downloadAudioFile } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Get audio overview
 * const audioOverview = await client.audio.get('notebook-id');
 * 
 * if (audioOverview.isReady && audioOverview.audioId) {
 *   // Download audio
 *   const rpc = client.getRPCClient();
 *   const audioDownload = await downloadAudioFile(
 *     rpc,
 *     audioOverview.audioId,
 *     'notebook-id'
 *   );
 *   
 *   // Save to file
 *   await audioDownload.saveToFile('my-podcast.mp3');
 * }
 * ```
 */
export async function downloadAudioFile(
  rpc: RPCClient,
  audioId: string,
  notebookId?: string
): Promise<{
  audioData: Uint8Array;
  audioUrl: string | null;
  saveToFile: (path: string) => Promise<void>;
}> {
  if (!audioId) {
    throw new NotebookLMError('Audio ID is required');
  }

  try {
    // First, try to get audio overview - the audio data is often in the overview response as base64
    // Based on terminal output, RPC_GET_AUDIO_OVERVIEW returns: [null, null, [3, "base64_audio_data"]]
    let audioData: Uint8Array | null = null;
    let audioUrl: string | null = null;
    
    if (notebookId) {
      // Try multiple request types to find audio data or URL
      // Based on AudioService.get(), different request types return different data
      const requestTypes = [1, 0, 2, 3];
      
      for (const requestType of requestTypes) {
        try {
          const audioOverview = await rpc.call(
            RPC.RPC_GET_AUDIO_OVERVIEW,
            [notebookId, requestType],
            notebookId
          );
          
          // Parse the response to extract base64 audio data or URL
          // Response might be a JSON string: "[null,null,[3,\"base64_audio_data\"]]"
          // Or it might be an array directly
          let parsedResponse = audioOverview;
          
          // If response is a JSON string, parse it
          if (typeof audioOverview === 'string') {
            try {
              parsedResponse = JSON.parse(audioOverview);
            } catch {
              // If parsing fails, treat as raw string (might be base64)
              parsedResponse = audioOverview;
            }
          }
          
          // First, try to find URL in the response (from mm30.txt pattern)
          // URL pattern: lh3.googleusercontent.com/notebooklm/...=m140-dv
          if (!audioUrl) {
            audioUrl = parseAudioDownloadResponse(parsedResponse, audioId);
          }
          
          // If URL found, we'll download from URL later
          // Otherwise, try to extract base64 audio data
          if (!audioData) {
            // Response structure: [null, null, [3, "base64_audio_data"]]
            // Or: [status, base64_data, title] based on parseGetResponse
            if (Array.isArray(parsedResponse)) {
              // Try parseGetResponse structure first: [status, base64_data, title]
              if (parsedResponse.length > 0 && Array.isArray(parsedResponse[0])) {
                const audioDataArray = parsedResponse[0];
                if (audioDataArray.length > 1 && typeof audioDataArray[1] === 'string') {
                  const candidate = audioDataArray[1];
                  // Check if it's base64 audio data (long string)
                  if (candidate.length > 1000) {
                    const base64Data = extractBase64AudioData([candidate]);
                    if (base64Data) {
                      audioData = decodeBase64ToUint8Array(base64Data);
                      break; // Found audio data, stop trying other request types
                    }
                  }
                }
              }
              
              // If not found, try recursive search
              const base64Data = extractBase64AudioData(parsedResponse);
              if (base64Data) {
                audioData = decodeBase64ToUint8Array(base64Data);
                break; // Found audio data, stop trying other request types
              }
            } else {
              // Try to extract from non-array response
              const base64Data = extractBase64AudioData(parsedResponse);
              if (base64Data) {
                audioData = decodeBase64ToUint8Array(base64Data);
                break; // Found audio data, stop trying other request types
              }
            }
          }
          
          // If we found both URL and data, or just data, we're done
          if (audioData || audioUrl) {
            break;
          }
        } catch (error: any) {
          // Continue to try next request type
          continue;
        }
      }
    }
    
    // If audio data not found in overview, try RPC_GET_AUDIO_DOWNLOAD
    // This might return a URL or might also return base64 data
    if (!audioData) {
      try {
        const response = await rpc.call(
          RPC.RPC_GET_AUDIO_DOWNLOAD,
          [
            [null, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]],
            audioId,
            [[[0, 1000]]] // Small initial range
          ],
          notebookId
        );

        // Try to extract URL from response
        audioUrl = parseAudioDownloadResponse(response, audioId);
        
        // If URL found, download from URL
        if (audioUrl) {
          try {
            audioData = await downloadAudioFromUrl(audioUrl, rpc.getCookies());
          } catch (urlError: any) {
            // If URL download fails (might need auth), try base64 extraction as fallback
            console.warn(`URL download failed, trying base64 extraction: ${urlError.message}`);
            const base64Data = extractBase64AudioData(response);
            if (base64Data) {
              audioData = decodeBase64ToUint8Array(base64Data);
            } else {
              throw urlError; // Re-throw if base64 also fails
            }
          }
        } else {
          // Try to extract base64 data from response
          const base64Data = extractBase64AudioData(response);
          if (base64Data) {
            audioData = decodeBase64ToUint8Array(base64Data);
          }
        }
      } catch (error: any) {
        throw new NotebookLMError(`Failed to download audio: ${error.message}`);
      }
    }
    
    if (!audioData) {
      throw new NotebookLMError(`Failed to extract audio data. Audio may not be ready yet.`);
    }

    // Return result with saveToFile helper
    return {
      audioData,
      audioUrl,
      saveToFile: async (path: string) => {
        // Try Node.js environment
        try {
          const fsModule: any = await import('fs/promises' as any).catch(() => null);
          
          if (fsModule?.writeFile) {
            await fsModule.writeFile(path, audioData);
            return;
          }
        } catch {
          // Fall through to browser
        }
        
        // Browser environment - create download link
        if (typeof Blob !== 'undefined') {
          // Convert Uint8Array to ArrayBuffer for Blob compatibility
          // Create a new ArrayBuffer by copying the data
          const buffer = new ArrayBuffer(audioData.length);
          const view = new Uint8Array(buffer);
          view.set(audioData);
          const blob = new Blob([buffer], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = path;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          throw new NotebookLMError('Cannot save file: unsupported environment');
        }
      },
    };
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to download audio file for audio ID ${audioId}: ${error.message}`
    );
  }
}

/**
 * Extract base64 audio data from RPC response
 * 
 * The response structure from RPC_GET_AUDIO_OVERVIEW is:
 * [null, null, [3, "base64_audio_data"]]
 * 
 * @param response - Raw RPC response
 * @returns Base64 audio data string or null if not found
 */
function extractBase64AudioData(response: any): string | null {
  // Handle string response (JSON string that needs parsing)
  let data = response;
  if (typeof response === 'string') {
    try {
      data = JSON.parse(response);
    } catch {
      // If parsing fails, check if the string itself is base64 audio data
      // Base64 audio data typically starts with "UklGRi" (RIFF header) or other audio formats
      if (response.length > 100 && /^[A-Za-z0-9+/=]+$/.test(response)) {
        return response;
      }
      return null;
    }
  }
  
  // Recursively search for base64 audio data
  function findBase64(obj: any, depth: number = 0): string | null {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if it's base64 audio data (long string, base64 characters)
      // Base64 audio data is typically very long (millions of characters)
      if (obj.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
        // Check for common audio file headers in base64:
        // "UklGRi" = "RIFF" (WAV), "SUQz" = "ID3" (MP3), "fLaC" = FLAC
        const decoded = atob(obj.substring(0, 100)); // Decode first 100 chars to check header
        if (decoded.includes('RIFF') || decoded.includes('ID3') || decoded.includes('fLaC') || 
            decoded.includes('OggS') || decoded.includes('ftyp')) {
          return obj;
        }
      }
    } else if (Array.isArray(obj)) {
      // Check structure: [null, null, [3, "base64_data"]]
      if (obj.length >= 3 && Array.isArray(obj[2]) && obj[2].length >= 2) {
        const candidate = obj[2][1];
        if (typeof candidate === 'string' && candidate.length > 1000) {
          const result = findBase64(candidate, depth + 1);
          if (result) return result;
        }
      }
      
      // Recursively search
      for (const item of obj) {
        const result = findBase64(item, depth + 1);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = findBase64(obj[key], depth + 1);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  return findBase64(data);
}

/**
 * Decode base64 string to Uint8Array
 * 
 * @param base64 - Base64 encoded string
 * @returns Uint8Array containing decoded binary data
 */
function decodeBase64ToUint8Array(base64: string): Uint8Array {
  // Remove any whitespace
  const cleanBase64 = base64.replace(/\s/g, '');
  
  // Decode base64 to binary string
  const binaryString = atob(cleanBase64);
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Parse RPC response to extract audio download URL
 * 
 * The response structure from RPC_GET_AUDIO_DOWNLOAD may contain:
 * - Direct URL in the response
 * - URL embedded in nested arrays
 * - URL in HTML-encoded format
 * 
 * @param response - Raw RPC response
 * @param audioId - Audio ID for error messages
 * @returns Audio download URL or null if not found
 */
function parseAudioDownloadResponse(response: any, audioId?: string): string | null {
  // Recursively search for URL pattern
  function findUrl(obj: any, depth: number = 0): string | null {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if it's a URL (lh3.googleusercontent.com or googlevideo.com)
      if (obj.includes('lh3.googleusercontent.com/notebooklm/') ||
          obj.includes('googlevideo.com/') ||
          obj.includes('googleusercontent.com/notebooklm/')) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const url = findUrl(item, depth + 1);
        if (url) return url;
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const url = findUrl(obj[key], depth + 1);
        if (url) return url;
      }
    }
    
    return null;
  }
  
  const url = findUrl(response);
  return url;
}

/**
 * Download audio file from URL
 * 
 * @param url - Audio download URL
 * @param cookies - Authentication cookies
 * @returns Promise resolving to audio data as Uint8Array
 */
function downloadAudioFromUrl(url: string, cookies: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Cookie': cookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    
    const req = httpModule.request(options, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          return downloadAudioFromUrl(res.headers.location, cookies)
            .then(resolve)
            .catch(reject);
        }
        reject(new NotebookLMError(`Failed to download audio: HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const audioData = Buffer.concat(chunks);
        resolve(new Uint8Array(audioData));
      });
      
      res.on('error', (error: Error) => {
        reject(new NotebookLMError(`Error downloading audio: ${error.message}`));
      });
    });
    
    req.on('error', (error: Error) => {
      reject(new NotebookLMError(`Request error: ${error.message}`));
    });
    
    req.end();
  });
}

