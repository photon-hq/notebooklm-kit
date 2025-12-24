/**
 * Client-side quota management and rate limiting
 * Enforces NotebookLM's usage limits to prevent API errors
 * 
 * ALL LIMITS IN ONE PLACE - Update here when NotebookLM changes quotas
 */

import { APIError, ErrorType } from './errors.js';

/**
 * NotebookLM usage limits (as of Dec 2024)
 * UPDATE THESE WHEN NOTEBOOKLM CHANGES THEIR QUOTAS
 */
export const NOTEBOOKLM_LIMITS = {
  /** Per account limits */
  MAX_NOTEBOOKS: 100,
  MAX_SOURCES_PER_NOTEBOOK: 50,
  MAX_WORDS_PER_SOURCE: 500000,
  MAX_FILE_SIZE_MB: 200,
  
  /** Daily limits (reset after 24 hours) */
  CHATS_PER_DAY: 50,
  AUDIO_OVERVIEWS_PER_DAY: 3,
  VIDEO_OVERVIEWS_PER_DAY: 3,
  REPORTS_PER_DAY: 10,
  FLASHCARDS_PER_DAY: 10,
  QUIZZES_PER_DAY: 10,
  
  /** Monthly limits (reset after 30 days) */
  DEEP_RESEARCH_PER_MONTH: 10,
  
  /** No limits (but may be restricted server-side) */
  MIND_MAPS: Infinity, // "No Limits"
  
  /** Limited (server enforced, no specific client limit) */
  DATA_TABLES: -1, // "Limited" - server enforced
  INFOGRAPHICS: -1, // "Limited" - server enforced
  SLIDES: -1, // "Limited" - server enforced
} as const;

/**
 * Usage tracking data
 */
export interface UsageData {
  /** Daily usage */
  daily: {
    chats: number;
    audioOverviews: number;
    videoOverviews: number;
    reports: number;
    flashcards: number;
    quizzes: number;
    lastReset: number; // timestamp
  };
  
  /** Monthly usage */
  monthly: {
    deepResearch: number;
    lastReset: number; // timestamp
  };
  
  /** Notebook tracking */
  notebooks: {
    total: number;
    sources: Record<string, number>; // notebookId -> source count
  };
}

/**
 * Rate limit error (uses existing error code 324934)
 */
export class RateLimitError extends APIError {
  constructor(
    message: string,
    public readonly resource: string,
    public readonly used: number,
    public readonly limit: number,
    public readonly resetTime?: Date
  ) {
    super(
      message,
      {
        code: 324934,
        type: ErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        description: message,
        retryable: true,
      },
      429
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Client-side quota manager
 * Tracks usage and enforces NotebookLM limits before making API calls
 */
export class QuotaManager {
  private usage: UsageData;
  private enabled: boolean;
  private storageKey = 'notebooklm-quota';
  
  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.usage = this.loadUsage();
    
    // Check for resets on initialization
    this.checkAndResetDaily();
    this.checkAndResetMonthly();
  }
  
  /**
   * Check if operation is allowed
   * @throws {RateLimitError} if limit exceeded
   */
  checkQuota(operation: string, notebookId?: string): void {
    if (!this.enabled) return;
    
    this.checkAndResetDaily();
    this.checkAndResetMonthly();
    
    switch (operation) {
      case 'createNotebook':
        if (this.usage.notebooks.total >= NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS) {
          throw new RateLimitError(
            `Notebook limit exceeded: ${this.usage.notebooks.total}/${NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS} notebooks created`,
            'notebooks',
            this.usage.notebooks.total,
            NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS
          );
        }
        break;
        
      case 'addSource':
        if (notebookId) {
          const sourceCount = this.usage.notebooks.sources[notebookId] || 0;
          if (sourceCount >= NOTEBOOKLM_LIMITS.MAX_SOURCES_PER_NOTEBOOK) {
            throw new RateLimitError(
              `Source limit exceeded for notebook: ${sourceCount}/${NOTEBOOKLM_LIMITS.MAX_SOURCES_PER_NOTEBOOK} sources`,
              'sources',
              sourceCount,
              NOTEBOOKLM_LIMITS.MAX_SOURCES_PER_NOTEBOOK
            );
          }
        }
        break;
        
      case 'chat':
        if (this.usage.daily.chats >= NOTEBOOKLM_LIMITS.CHATS_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily chat limit exceeded: ${this.usage.daily.chats}/${NOTEBOOKLM_LIMITS.CHATS_PER_DAY} chats used today`,
            'chats',
            this.usage.daily.chats,
            NOTEBOOKLM_LIMITS.CHATS_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'createAudioOverview':
        if (this.usage.daily.audioOverviews >= NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily audio limit exceeded: ${this.usage.daily.audioOverviews}/${NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY} audio overviews created today`,
            'audioOverviews',
            this.usage.daily.audioOverviews,
            NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'createVideoOverview':
        if (this.usage.daily.videoOverviews >= NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily video limit exceeded: ${this.usage.daily.videoOverviews}/${NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY} video overviews created today`,
            'videoOverviews',
            this.usage.daily.videoOverviews,
            NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'createReport':
        if (this.usage.daily.reports >= NOTEBOOKLM_LIMITS.REPORTS_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily report limit exceeded: ${this.usage.daily.reports}/${NOTEBOOKLM_LIMITS.REPORTS_PER_DAY} reports created today`,
            'reports',
            this.usage.daily.reports,
            NOTEBOOKLM_LIMITS.REPORTS_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'createFlashcards':
        if (this.usage.daily.flashcards >= NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily flashcard limit exceeded: ${this.usage.daily.flashcards}/${NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY} flashcards created today`,
            'flashcards',
            this.usage.daily.flashcards,
            NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'createQuiz':
        if (this.usage.daily.quizzes >= NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily quiz limit exceeded: ${this.usage.daily.quizzes}/${NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY} quizzes created today`,
            'quizzes',
            this.usage.daily.quizzes,
            NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY,
            resetTime
          );
        }
        break;
        
      case 'deepResearch':
        if (this.usage.monthly.deepResearch >= NOTEBOOKLM_LIMITS.DEEP_RESEARCH_PER_MONTH) {
          const resetTime = this.getMonthlyResetTime();
          throw new RateLimitError(
            `Monthly deep research limit exceeded: ${this.usage.monthly.deepResearch}/${NOTEBOOKLM_LIMITS.DEEP_RESEARCH_PER_MONTH} used this month`,
            'deepResearch',
            this.usage.monthly.deepResearch,
            NOTEBOOKLM_LIMITS.DEEP_RESEARCH_PER_MONTH,
            resetTime
          );
        }
        break;
    }
  }
  
  /**
   * Record usage after successful operation
   */
  recordUsage(operation: string, notebookId?: string): void {
    if (!this.enabled) return;
    
    switch (operation) {
      case 'createNotebook':
        this.usage.notebooks.total++;
        break;
        
      case 'addSource':
        if (notebookId) {
          this.usage.notebooks.sources[notebookId] = 
            (this.usage.notebooks.sources[notebookId] || 0) + 1;
        }
        break;
        
      case 'chat':
        this.usage.daily.chats++;
        break;
        
      case 'createAudioOverview':
        this.usage.daily.audioOverviews++;
        break;
        
      case 'createVideoOverview':
        this.usage.daily.videoOverviews++;
        break;
        
      case 'createReport':
        this.usage.daily.reports++;
        break;
        
      case 'createFlashcards':
        this.usage.daily.flashcards++;
        break;
        
      case 'createQuiz':
        this.usage.daily.quizzes++;
        break;
        
      case 'deepResearch':
        this.usage.monthly.deepResearch++;
        break;
    }
    
    this.saveUsage();
  }
  
  /**
   * Get current usage statistics
   */
  getUsage(): UsageData {
    this.checkAndResetDaily();
    this.checkAndResetMonthly();
    return { ...this.usage };
  }
  
  /**
   * Get remaining quota for a resource
   */
  getRemaining(resource: string): number {
    this.checkAndResetDaily();
    this.checkAndResetMonthly();
    
    switch (resource) {
      case 'notebooks':
        return Math.max(0, NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS - this.usage.notebooks.total);
      case 'chats':
        return Math.max(0, NOTEBOOKLM_LIMITS.CHATS_PER_DAY - this.usage.daily.chats);
      case 'audioOverviews':
        return Math.max(0, NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY - this.usage.daily.audioOverviews);
      case 'videoOverviews':
        return Math.max(0, NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY - this.usage.daily.videoOverviews);
      case 'reports':
        return Math.max(0, NOTEBOOKLM_LIMITS.REPORTS_PER_DAY - this.usage.daily.reports);
      case 'flashcards':
        return Math.max(0, NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY - this.usage.daily.flashcards);
      case 'quizzes':
        return Math.max(0, NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY - this.usage.daily.quizzes);
      case 'deepResearch':
        return Math.max(0, NOTEBOOKLM_LIMITS.DEEP_RESEARCH_PER_MONTH - this.usage.monthly.deepResearch);
      default:
        return Infinity;
    }
  }
  
  /**
   * Reset all usage (for testing or manual reset)
   */
  resetUsage(): void {
    this.usage = this.createEmptyUsage();
    this.saveUsage();
  }
  
  /**
   * Validate text source word count
   */
  validateTextSource(text: string): void {
    if (!this.enabled) return;
    
    const wordCount = this.countWords(text);
    if (wordCount > NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE) {
      throw new APIError(
        `Text source exceeds ${NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE} word limit: ${wordCount} words`,
        {
          code: 6,
          type: ErrorType.INVALID_INPUT,
          message: 'Text too long',
          description: `Source exceeds word limit (${wordCount}/${NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE} words)`,
          retryable: false,
        }
      );
    }
  }
  
  /**
   * Validate file size
   */
  validateFileSize(sizeBytes: number): void {
    if (!this.enabled) return;
    
    const sizeMB = sizeBytes / (1024 * 1024);
    const limitMB = NOTEBOOKLM_LIMITS.MAX_FILE_SIZE_MB;
    
    if (sizeMB > limitMB) {
      throw new APIError(
        `File size exceeds ${limitMB}MB limit: ${sizeMB.toFixed(2)}MB`,
        {
          code: 6,
          type: ErrorType.INVALID_INPUT,
          message: 'File too large',
          description: `File exceeds size limit (${sizeMB.toFixed(2)}MB/${limitMB}MB)`,
          retryable: false,
        }
      );
    }
  }
  
  /**
   * Count words in text (approximation)
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  /**
   * Check and reset daily quotas if 24 hours passed
   */
  private checkAndResetDaily(): void {
    const now = Date.now();
    const lastReset = this.usage.daily.lastReset;
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);
    
    if (hoursSinceReset >= 24) {
      this.usage.daily = {
        chats: 0,
        audioOverviews: 0,
        videoOverviews: 0,
        reports: 0,
        flashcards: 0,
        quizzes: 0,
        lastReset: now,
      };
      this.saveUsage();
    }
  }
  
  /**
   * Check and reset monthly quotas if 30 days passed
   */
  private checkAndResetMonthly(): void {
    const now = Date.now();
    const lastReset = this.usage.monthly.lastReset;
    const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReset >= 30) {
      this.usage.monthly = {
        deepResearch: 0,
        lastReset: now,
      };
      this.saveUsage();
    }
  }
  
  /**
   * Get time when daily quota resets
   */
  private getDailyResetTime(): Date {
    const lastReset = new Date(this.usage.daily.lastReset);
    return new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
  }
  
  /**
   * Get time when monthly quota resets
   */
  private getMonthlyResetTime(): Date {
    const lastReset = new Date(this.usage.monthly.lastReset);
    return new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  /**
   * Create empty usage data
   */
  private createEmptyUsage(): UsageData {
    const now = Date.now();
    return {
      daily: {
        chats: 0,
        audioOverviews: 0,
        videoOverviews: 0,
        reports: 0,
        flashcards: 0,
        quizzes: 0,
        lastReset: now,
      },
      monthly: {
        deepResearch: 0,
        lastReset: now,
      },
      notebooks: {
        total: 0,
        sources: {},
      },
    };
  }
  
  /**
   * Load usage from storage
   */
  private loadUsage(): UsageData {
    try {
      // Try localStorage first (browser)
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      // Fallback to in-memory
    }
    
    return this.createEmptyUsage();
  }
  
  /**
   * Save usage to storage
   */
  private saveUsage(): void {
    try {
      // Try localStorage (browser)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.usage));
      }
    } catch {
      // In-memory only if localStorage not available
    }
  }
  
  /**
   * Enable or disable quota enforcement
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Check if quota enforcement is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Helper function to validate text source before upload
 */
export function validateTextSource(text: string): void {
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  if (wordCount > NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE) {
    throw new APIError(
      `Text source exceeds ${NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE} word limit: ${wordCount} words`,
      {
        code: 6,
        type: ErrorType.INVALID_INPUT,
        message: 'Text too long',
        description: `Source exceeds word limit (${wordCount}/${NOTEBOOKLM_LIMITS.MAX_WORDS_PER_SOURCE} words)`,
        retryable: false,
      }
    );
  }
}

/**
 * Helper function to validate file size
 */
export function validateFileSize(sizeBytes: number): void {
  const sizeMB = sizeBytes / (1024 * 1024);
  const limitMB = NOTEBOOKLM_LIMITS.MAX_FILE_SIZE_MB;
  
  if (sizeMB > limitMB) {
    throw new APIError(
      `File size exceeds ${limitMB}MB limit: ${sizeMB.toFixed(2)}MB`,
      {
        code: 6,
        type: ErrorType.INVALID_INPUT,
        message: 'File too large',
        description: `File exceeds size limit (${sizeMB.toFixed(2)}MB/${limitMB}MB)`,
        retryable: false,
      }
    );
  }
}

