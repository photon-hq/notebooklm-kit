/**
 * Client-side quota management and rate limiting
 * Enforces NotebookLM's usage limits to prevent API errors
 * 
 * ALL LIMITS IN ONE PLACE - Update here when NotebookLM changes quotas
 * Reference: https://support.google.com/notebooklm/answer/16213268
 */

import { APIError, ErrorType } from './errors.js';

/**
 * NotebookLM plan types
 */
export type NotebookLMPlan = 'standard' | 'plus' | 'pro' | 'ultra';

/**
 * Quota limits for each plan
 * Based on official NotebookLM documentation
 * Reference: https://support.google.com/notebooklm/answer/16213268
 */
export interface PlanLimits {
  /** Per account limits */
  notebooks: number;
  sourcesPerNotebook: number;
  wordsPerSource: number;
  fileSizeMB: number;
  
  /** Daily limits (reset after 24 hours) */
  chatsPerDay: number;
  audioOverviewsPerDay: number;
  videoOverviewsPerDay: number;
  reportsPerDay: number;
  flashcardsPerDay: number;
  quizzesPerDay: number;
  
  /** Monthly limits (reset after 30 days) */
  deepResearchPerMonth: number;
  
  /** Varies by plan (server-side enforcement) */
  dataTables: 'limited' | 'more' | 'higher' | 'highest' | 'server-side';
  infographics: 'limited' | 'more' | 'higher' | 'highest' | 'server-side';
  slides: 'limited' | 'more' | 'higher' | 'highest' | 'server-side';
  
  /** No limits for all plans */
  mindMaps: 'unlimited';
}

/**
 * Quota limits for each NotebookLM plan
 * Reference: https://support.google.com/notebooklm/answer/16213268
 */
export const PLAN_LIMITS: Record<NotebookLMPlan, PlanLimits> = {
  standard: {
    notebooks: 100,
    sourcesPerNotebook: 50,
    wordsPerSource: 500000,
    fileSizeMB: 200,
    chatsPerDay: 50,
    audioOverviewsPerDay: 3,
    videoOverviewsPerDay: 3,
    reportsPerDay: 10,
    flashcardsPerDay: 10,
    quizzesPerDay: 10,
    deepResearchPerMonth: 10,
    dataTables: 'limited',
    infographics: 'limited',
    slides: 'limited',
    mindMaps: 'unlimited',
  },
  plus: {
    notebooks: 200,
    sourcesPerNotebook: 100,
    wordsPerSource: 500000,
    fileSizeMB: 200,
    chatsPerDay: 200,
    audioOverviewsPerDay: 6,
    videoOverviewsPerDay: 6,
    reportsPerDay: 20,
    flashcardsPerDay: 20,
    quizzesPerDay: 20,
    deepResearchPerMonth: 90, // 3/day * 30 days
    dataTables: 'more',
    infographics: 'more',
    slides: 'more',
    mindMaps: 'unlimited',
  },
  pro: {
    notebooks: 500,
    sourcesPerNotebook: 300,
    wordsPerSource: 500000,
    fileSizeMB: 200,
    chatsPerDay: 500,
    audioOverviewsPerDay: 20,
    videoOverviewsPerDay: 20,
    reportsPerDay: 100,
    flashcardsPerDay: 100,
    quizzesPerDay: 100,
    deepResearchPerMonth: 600, // 20/day * 30 days
    dataTables: 'higher',
    infographics: 'higher',
    slides: 'higher',
    mindMaps: 'unlimited',
  },
  ultra: {
    notebooks: 500,
    sourcesPerNotebook: 600,
    wordsPerSource: 500000,
    fileSizeMB: 200,
    chatsPerDay: 5000,
    audioOverviewsPerDay: 200,
    videoOverviewsPerDay: 200,
    reportsPerDay: 1000,
    flashcardsPerDay: 1000,
    quizzesPerDay: 1000,
    deepResearchPerMonth: 6000, // 200/day * 30 days
    dataTables: 'highest',
    infographics: 'highest',
    slides: 'highest',
    mindMaps: 'unlimited',
  },
};

/**
 * Legacy constant for backward compatibility
 * Uses Standard plan limits
 */
export const NOTEBOOKLM_LIMITS = {
  /** Per account limits */
  MAX_NOTEBOOKS: PLAN_LIMITS.standard.notebooks,
  MAX_SOURCES_PER_NOTEBOOK: PLAN_LIMITS.standard.sourcesPerNotebook,
  MAX_WORDS_PER_SOURCE: PLAN_LIMITS.standard.wordsPerSource,
  MAX_FILE_SIZE_MB: PLAN_LIMITS.standard.fileSizeMB,
  
  /** Daily limits (reset after 24 hours) */
  CHATS_PER_DAY: PLAN_LIMITS.standard.chatsPerDay,
  AUDIO_OVERVIEWS_PER_DAY: PLAN_LIMITS.standard.audioOverviewsPerDay,
  VIDEO_OVERVIEWS_PER_DAY: PLAN_LIMITS.standard.videoOverviewsPerDay,
  REPORTS_PER_DAY: PLAN_LIMITS.standard.reportsPerDay,
  FLASHCARDS_PER_DAY: PLAN_LIMITS.standard.flashcardsPerDay,
  QUIZZES_PER_DAY: PLAN_LIMITS.standard.quizzesPerDay,
  
  /** Monthly limits (reset after 30 days) */
  DEEP_RESEARCH_PER_MONTH: PLAN_LIMITS.standard.deepResearchPerMonth,
  
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
  private plan: NotebookLMPlan;
  private limits: PlanLimits;
  private storageKey = 'notebooklm-quota';
  
  constructor(enabled: boolean = false, plan: NotebookLMPlan = 'standard') {
    this.enabled = enabled;
    this.plan = plan;
    this.limits = PLAN_LIMITS[plan];
    this.usage = this.loadUsage();
    
    // Check for resets on initialization
    this.checkAndResetDaily();
    this.checkAndResetMonthly();
  }
  
  /**
   * Set the plan and update limits
   */
  setPlan(plan: NotebookLMPlan): void {
    this.plan = plan;
    this.limits = PLAN_LIMITS[plan];
  }
  
  /**
   * Get current plan
   */
  getPlan(): NotebookLMPlan {
    return this.plan;
  }
  
  /**
   * Get current plan limits
   */
  getLimits(): PlanLimits {
    return { ...this.limits };
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
        if (this.usage.notebooks.total >= this.limits.notebooks) {
          throw new RateLimitError(
            `Notebook limit exceeded: ${this.usage.notebooks.total}/${this.limits.notebooks} notebooks created (${this.plan} plan)`,
            'notebooks',
            this.usage.notebooks.total,
            this.limits.notebooks
          );
        }
        break;
        
      case 'addSource':
        if (notebookId) {
          const sourceCount = this.usage.notebooks.sources[notebookId] || 0;
          if (sourceCount >= this.limits.sourcesPerNotebook) {
            throw new RateLimitError(
              `Source limit exceeded for notebook: ${sourceCount}/${this.limits.sourcesPerNotebook} sources (${this.plan} plan)`,
              'sources',
              sourceCount,
              this.limits.sourcesPerNotebook
            );
          }
        }
        break;
        
      case 'chat':
        if (this.usage.daily.chats >= this.limits.chatsPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily chat limit exceeded: ${this.usage.daily.chats}/${this.limits.chatsPerDay} chats used today (${this.plan} plan)`,
            'chats',
            this.usage.daily.chats,
            this.limits.chatsPerDay,
            resetTime
          );
        }
        break;
        
      case 'createAudioOverview':
        if (this.usage.daily.audioOverviews >= this.limits.audioOverviewsPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily audio limit exceeded: ${this.usage.daily.audioOverviews}/${this.limits.audioOverviewsPerDay} audio overviews created today (${this.plan} plan)`,
            'audioOverviews',
            this.usage.daily.audioOverviews,
            this.limits.audioOverviewsPerDay,
            resetTime
          );
        }
        break;
        
      case 'createVideoOverview':
        if (this.usage.daily.videoOverviews >= this.limits.videoOverviewsPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily video limit exceeded: ${this.usage.daily.videoOverviews}/${this.limits.videoOverviewsPerDay} video overviews created today (${this.plan} plan)`,
            'videoOverviews',
            this.usage.daily.videoOverviews,
            this.limits.videoOverviewsPerDay,
            resetTime
          );
        }
        break;
        
      case 'createReport':
        if (this.usage.daily.reports >= this.limits.reportsPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily report limit exceeded: ${this.usage.daily.reports}/${this.limits.reportsPerDay} reports created today (${this.plan} plan)`,
            'reports',
            this.usage.daily.reports,
            this.limits.reportsPerDay,
            resetTime
          );
        }
        break;
        
      case 'createFlashcards':
        if (this.usage.daily.flashcards >= this.limits.flashcardsPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily flashcard limit exceeded: ${this.usage.daily.flashcards}/${this.limits.flashcardsPerDay} flashcards created today (${this.plan} plan)`,
            'flashcards',
            this.usage.daily.flashcards,
            this.limits.flashcardsPerDay,
            resetTime
          );
        }
        break;
        
      case 'createQuiz':
        if (this.usage.daily.quizzes >= this.limits.quizzesPerDay) {
          const resetTime = this.getDailyResetTime();
          throw new RateLimitError(
            `Daily quiz limit exceeded: ${this.usage.daily.quizzes}/${this.limits.quizzesPerDay} quizzes created today (${this.plan} plan)`,
            'quizzes',
            this.usage.daily.quizzes,
            this.limits.quizzesPerDay,
            resetTime
          );
        }
        break;
        
      case 'deepResearch':
        if (this.usage.monthly.deepResearch >= this.limits.deepResearchPerMonth) {
          const resetTime = this.getMonthlyResetTime();
          throw new RateLimitError(
            `Monthly deep research limit exceeded: ${this.usage.monthly.deepResearch}/${this.limits.deepResearchPerMonth} used this month (${this.plan} plan)`,
            'deepResearch',
            this.usage.monthly.deepResearch,
            this.limits.deepResearchPerMonth,
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
        return Math.max(0, this.limits.notebooks - this.usage.notebooks.total);
      case 'chats':
        return Math.max(0, this.limits.chatsPerDay - this.usage.daily.chats);
      case 'audioOverviews':
        return Math.max(0, this.limits.audioOverviewsPerDay - this.usage.daily.audioOverviews);
      case 'videoOverviews':
        return Math.max(0, this.limits.videoOverviewsPerDay - this.usage.daily.videoOverviews);
      case 'reports':
        return Math.max(0, this.limits.reportsPerDay - this.usage.daily.reports);
      case 'flashcards':
        return Math.max(0, this.limits.flashcardsPerDay - this.usage.daily.flashcards);
      case 'quizzes':
        return Math.max(0, this.limits.quizzesPerDay - this.usage.daily.quizzes);
      case 'deepResearch':
        return Math.max(0, this.limits.deepResearchPerMonth - this.usage.monthly.deepResearch);
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
   * Note: Validation is simple - if too large, NotebookLM will reject it
   */
  validateTextSource(text: string): void {
    if (!this.enabled) return;
    
    const wordCount = this.countWords(text);
    if (wordCount > this.limits.wordsPerSource) {
      throw new APIError(
        `Text source exceeds ${this.limits.wordsPerSource} word limit: ${wordCount} words (${this.plan} plan)`,
        {
          code: 6,
          type: ErrorType.INVALID_INPUT,
          message: 'Text too long',
          description: `Source exceeds word limit (${wordCount}/${this.limits.wordsPerSource} words). Note: NotebookLM will reject sources exceeding 500,000 words or 200MB file size.`,
          retryable: false,
        }
      );
    }
  }
  
  /**
   * Validate file size
   * Note: Validation is simple - if too large, NotebookLM will reject it
   */
  validateFileSize(sizeBytes: number): void {
    if (!this.enabled) return;
    
    const sizeMB = sizeBytes / (1024 * 1024);
    const limitMB = this.limits.fileSizeMB;
    
    if (sizeMB > limitMB) {
      throw new APIError(
        `File size exceeds ${limitMB}MB limit: ${sizeMB.toFixed(2)}MB (${this.plan} plan)`,
        {
          code: 6,
          type: ErrorType.INVALID_INPUT,
          message: 'File too large',
          description: `File exceeds size limit (${sizeMB.toFixed(2)}MB/${limitMB}MB). Note: NotebookLM will reject files exceeding 200MB or sources with more than 500,000 words.`,
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
 * Uses Standard plan limits by default
 * Note: Validation is simple - if too large, NotebookLM will reject it
 */
export function validateTextSource(text: string, plan: NotebookLMPlan = 'standard'): void {
  const limits = PLAN_LIMITS[plan];
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  if (wordCount > limits.wordsPerSource) {
    throw new APIError(
      `Text source exceeds ${limits.wordsPerSource} word limit: ${wordCount} words (${plan} plan)`,
      {
        code: 6,
        type: ErrorType.INVALID_INPUT,
        message: 'Text too long',
        description: `Source exceeds word limit (${wordCount}/${limits.wordsPerSource} words). Note: NotebookLM will reject sources exceeding 500,000 words or 200MB file size.`,
        retryable: false,
      }
    );
  }
}

/**
 * Helper function to validate file size
 * Uses Standard plan limits by default
 * Note: Validation is simple - if too large, NotebookLM will reject it
 */
export function validateFileSize(sizeBytes: number, plan: NotebookLMPlan = 'standard'): void {
  const limits = PLAN_LIMITS[plan];
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB > limits.fileSizeMB) {
    throw new APIError(
      `File size exceeds ${limits.fileSizeMB}MB limit: ${sizeMB.toFixed(2)}MB (${plan} plan)`,
      {
        code: 6,
        type: ErrorType.INVALID_INPUT,
        message: 'File too large',
        description: `File exceeds size limit (${sizeMB.toFixed(2)}MB/${limits.fileSizeMB}MB). Note: NotebookLM will reject files exceeding 200MB or sources with more than 500,000 words.`,
        retryable: false,
      }
    );
  }
}

