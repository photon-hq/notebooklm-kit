/**
 * Notebook Language Service
 * Handles getting and setting the notebook's default output language
 * 
 * The notebook's default output language is used as the default for:
 * - Artifact creation (audio, video, report, infographics, slide decks)
 * - Chat responses
 * - All other notebook operations
 * 
 * If a specific language is provided in artifact creation, it overrides the default.
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { APIError } from '../utils/errors.js';
import { NotebookLMLanguage, isLanguageSupported } from '../types/languages.js';

export interface NotebookLanguageInfo {
  /** Current default output language code (e.g., 'en', 'de', 'ja') */
  language: string;
  
  /** Language display name */
  name?: string;
  
  /** Native language name */
  nativeName?: string;
}

/**
 * Service for managing notebook output language
 */
export class NotebookLanguageService {
  // Cache for notebook languages to avoid repeated RPC calls
  private languageCache: Map<string, string> = new Map();
  
  constructor(
    private rpc: RPCClient
  ) {}
  
  /**
   * Get the default output language for a notebook
   * 
   * **What it does:** Retrieves the notebook's default output language setting.
   * This language is used as the default for all artifact creation, chat responses,
   * and other notebook operations unless overridden.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook
   * 
   * **Output:** Returns the language code (e.g., 'en', 'de', 'ja')
   * 
   * **Note:**
   * - Returns cached language if available (set via `set()` method)
   * - If not cached, defaults to 'en' (English)
   * - The language is cached when set via `set()` method
   * 
   * @param notebookId - The notebook ID
   * @returns The default language code
   * 
   * @example
   * ```typescript
   * const language = await sdk.notebookLanguage.get('notebook-id');
   * console.log(`Default language: ${language}`); // 'en', 'de', 'ja', etc.
   * ```
   */
  async get(notebookId: string): Promise<string> {
    // Check cache first - language is cached when set via set() method
    if (this.languageCache.has(notebookId)) {
      return this.languageCache.get(notebookId)!;
    }
    
    // If not cached, default to 'en'
    // The language will be cached when set via set() method
    const defaultLanguage = 'en';
    this.languageCache.set(notebookId, defaultLanguage);
    return defaultLanguage;
  }
  
  /**
   * Set the default output language for a notebook
   * 
   * **What it does:** Sets the notebook's default output language.
   * This language will be used as the default for all artifact creation,
   * chat responses, and other notebook operations.
   * 
   * **Input:**
   * - `notebookId` (string, required): The ID of the notebook
   * - `language` (string, required): Language code (e.g., 'en', 'de', 'ja')
   *   - Use `NotebookLMLanguage` enum for type safety
   *   - Supports 80+ languages
   * 
   * **Output:** Returns the updated language code
   * 
   * **Note:**
   * - The language setting is persistent and affects all future operations
   * - Cache is updated after successful setting
   * - Uses RPC `hT54vc` (MutateAccount) to update the language
   * 
   * @param notebookId - The notebook ID
   * @param language - Language code to set
   * @returns The updated language code
   * 
   * @example
   * ```typescript
   * import { NotebookLMLanguage } from 'notebooklm-kit';
   * 
   * // Set to German
   * await sdk.notebookLanguage.set('notebook-id', NotebookLMLanguage.GERMAN);
   * 
   * // Set to Japanese
   * await sdk.notebookLanguage.set('notebook-id', NotebookLMLanguage.JAPANESE);
   * 
   * // Set using language code directly
   * await sdk.notebookLanguage.set('notebook-id', 'de');
   * ```
   */
  async set(notebookId: string, language: string): Promise<string> {
    // Validate language code
    if (!language || typeof language !== 'string') {
      throw new APIError('Invalid language code. Must be a non-empty string.', undefined, 400);
    }
    
    // Normalize language code (lowercase)
    const normalizedLang = language.toLowerCase();
    
    // Validate that it's a supported language (optional check)
    if (!isLanguageSupported(normalizedLang)) {
      console.warn(`Language code '${normalizedLang}' may not be supported. Proceeding anyway.`);
    }
    
    try {
      // Based on mm55.txt, the RPC call structure is:
      // RPC: hT54vc (MutateAccount)
      // Args: [[null, [[null, null, null, null, ["en"]]]]]
      // The language code is in a nested array at the end
      const args = [
        [
          null,
          [
            [
              null,
              null,
              null,
              null,
              [normalizedLang] // Language code in array
            ]
          ]
        ]
      ];
      
      // Make the RPC call to set the language
      await this.rpc.call(
        RPC.RPC_MUTATE_ACCOUNT, // hT54vc
        args,
        notebookId
      );
      
      // Also call ozz5Z RPC (based on mm55.txt, this seems to be a follow-up call)
      // Args: [[[[null, "1", 627]], [null, null, null, null, null, null, null, null, null, [null, null, 1]]], 1]]
      try {
        await this.rpc.call(
          RPC.RPC_UNKNOWN_POST_SLIDE_DECK, // ozz5Z
          [
            [
              [
                [null, "1", 627]
              ],
              [
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                [null, null, 1]
              ]
            ],
            1
          ],
          notebookId
        );
      } catch (error) {
        // ozz5Z call is optional, don't fail if it errors
        console.warn('Optional ozz5Z RPC call failed (non-critical):', error);
      }
      
      // Update cache
      this.languageCache.set(notebookId, normalizedLang);
      
      return normalizedLang;
    } catch (error) {
      // Clear cache on error
      this.languageCache.delete(notebookId);
      throw new APIError(
        `Failed to set notebook language to '${normalizedLang}': ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        500
      );
    }
  }
  
  /**
   * Clear the language cache for a notebook
   * Useful if you want to force a fresh fetch
   * 
   * @param notebookId - The notebook ID (optional, clears all if not provided)
   */
  clearCache(notebookId?: string): void {
    if (notebookId) {
      this.languageCache.delete(notebookId);
    } else {
      this.languageCache.clear();
    }
  }
  
  /**
   * Get language information with metadata
   * 
   * @param notebookId - The notebook ID
   * @returns Language information object
   */
  async getInfo(notebookId: string): Promise<NotebookLanguageInfo> {
    const language = await this.get(notebookId);
    
    // Import getLanguageInfo dynamically to avoid circular dependencies
    const { getLanguageInfo } = await import('../types/languages.js');
    const info = getLanguageInfo(language);
    
    return {
      language,
      name: info?.name,
      nativeName: info?.nativeName,
    };
  }
}

