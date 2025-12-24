/**
 * Audio service
 * Handles audio overview operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { AudioOverview, CreateAudioOverviewOptions, ShareAudioResult } from '../types/audio.js';
import { ShareOption } from '../types/audio.js';
import { NotebookLMError } from '../types/common.js';

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
   * import { AudioLanguage } from 'notebooklm-kit';
   * 
   * // Create in Hindi
   * const audio = await client.audio.create('notebook-id', {
   *   instructions: 'Focus on the key findings',
   *   language: AudioLanguage.HINDI,
   * });
   * 
   * // Create with customization
   * const audio = await client.audio.create('notebook-id', {
   *   language: AudioLanguage.TAMIL,
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

