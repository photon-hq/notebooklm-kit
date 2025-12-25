/**
 * Audio overview types
 */

/**
 * Audio overview result
 */
export interface AudioOverview {
  /** Project ID */
  projectId: string;
  
  /** Audio ID */
  audioId?: string;
  
  /** Audio title */
  title?: string;
  
  /** Audio data (base64 encoded) */
  audioData?: string;
  
  /** Is audio ready */
  isReady: boolean;
  
  /** Audio status */
  status?: AudioStatus;
  
  /** Audio duration (seconds) */
  duration?: number;
  
  /** Creation timestamp */
  createdAt?: string;
}

/**
 * Audio status enum
 */
export enum AudioStatus {
  CREATING = 'CREATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Supported languages for audio overview
 * Based on NotebookLM's multi-language support (80+ languages)
 * 
 * @deprecated Use NotebookLMLanguage from './languages' instead
 * This enum is kept for backward compatibility
 */
export enum AudioLanguage {
  HINDI = 'hi',           // हिन्दी
  BENGALI = 'bn',         // বাংলা
  GUJARATI = 'gu',        // ગુજરાતી
  KANNADA = 'kn',         // ಕನ್ನಡ
  MALAYALAM = 'ml',       // മലയാളം
  MARATHI = 'mr',         // मराठी
  PUNJABI = 'pa',         // ਪੰਜਾਬੀ
  TAMIL = 'ta',           // தமிழ்
  TELUGU = 'te',          // తెలుగు
  ENGLISH = 'en',         // English
}

// Re-export NotebookLMLanguage for convenience
export { NotebookLMLanguage, getLanguageInfo, isLanguageSupported } from './languages.js';

/**
 * Options for creating audio overview
 */
export interface CreateAudioOverviewOptions {
  /** Custom instructions for audio generation */
  instructions?: string;
  
  /** Audio type (0 = default) */
  audioType?: number;
  
  /** Language for audio overview (use NotebookLMLanguage enum or ISO 639-1 code) */
  language?: AudioLanguage | string;
  
  /** Additional customization */
  customization?: {
    /** Speaking style/tone */
    tone?: 'conversational' | 'professional' | 'educational' | 'engaging';
    
    /** Length preference */
    length?: 'brief' | 'standard' | 'detailed';
    
    /** Focus areas */
    focusAreas?: string[];
  };
}

/**
 * Share options for audio
 */
export enum ShareOption {
  PRIVATE = 0,
  PUBLIC = 1,
}

/**
 * Share audio result
 */
export interface ShareAudioResult {
  /** Share URL */
  shareUrl: string;
  
  /** Share ID */
  shareId: string;
  
  /** Is public */
  isPublic: boolean;
}

