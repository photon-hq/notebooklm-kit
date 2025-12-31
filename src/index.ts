/**
 * NotebookLM Kit - TypeScript SDK for NotebookLM API
 * 
 * @packageDocumentation
 */

// Main client
export { NotebookLMClient, createNotebookLMClient } from './client/notebooklm-client.js';

// Services
export { NotebooksService } from './services/notebooks.js';
export { SourcesService } from './services/sources.js';
export { NotesService } from './services/notes.js';
export { ArtifactsService } from './services/artifacts.js';
export { GenerationService } from './services/generation.js';
// Artifact functions are now in ArtifactsService - use artifacts.get() or artifacts.download() instead
// Legacy exports below are kept for backward compatibility but will be removed
export { fetchQuizData } from './services/artifacts.js';
export { fetchFlashcardData } from './services/artifacts.js';
export type { ParsedFlashcardData } from './services/artifacts.js';
export { downloadAudioFile } from './services/artifacts.js';
export { downloadSlidesFile } from './services/artifacts.js';
export { 
  createReport, 
  reportToDocs, 
  reportToSheets,
  getReportContent,
  formatReportAsMarkdown,
  formatReportAsText,
  formatReportAsHTML,
  formatReportAsJSON,
} from './services/artifacts.js';
export type { CreateReportOptions, ReportContent } from './services/artifacts.js';
export { fetchInfographic } from './services/artifacts.js';
export type { InfographicImageData, FetchInfographicOptions } from './services/artifacts.js';

// Types
export type {
  NotebookLMConfig,
  RPCCall,
  RPCResponse,
  BatchExecuteConfig,
} from './types/common.js';

export {
  NotebookLMError,
  NotebookLMAuthError,
  NotebookLMNetworkError,
  NotebookLMParseError,
} from './types/common.js';

export type {
  Notebook,
  CreateNotebookOptions,
  UpdateNotebookOptions,
  SharingSettings,
  ShareNotebookOptions,
  ShareNotebookResult,
  DeleteNotebookResult,
} from './types/notebook.js';

export type {
  Source,
  SourceInput,
  AddSourceFromURLOptions,
  AddSourceFromTextOptions,
  AddSourceFromFileOptions,
  SourceProcessingStatus,
  SourceContent,
  SourceFreshness,
  DiscoveredSource,
  DiscoveredWebSource,
  DiscoveredDriveSource,
  SearchWebSourcesOptions,
  AddDiscoveredSourcesOptions,
  AddGoogleDriveSourceOptions,
  AddYouTubeSourceOptions,
  BatchAddSourcesOptions,
  SearchWebAndWaitOptions,
  WebSearchResult,
} from './types/source.js';
export { ResearchMode, SearchSourceType } from './types/source.js';

export {
  SourceType,
  SourceStatus,
} from './types/source.js';

export type {
  Note,
  CreateNoteOptions,
  UpdateNoteOptions,
} from './types/note.js';

export {
  NoteType,
} from './types/note.js';

export type {
  AudioOverview,
  CreateAudioOverviewOptions,
  ShareAudioResult,
} from './services/artifacts.js';

export {
  ShareOption,
} from './services/artifacts.js';

// Legacy exports removed - use ArtifactState from artifacts.ts and NotebookLMLanguage from languages.js instead

// Language support
export {
  NotebookLMLanguage,
  getLanguageInfo,
  isLanguageSupported,
  getSupportedLanguages,
  COMMON_LANGUAGES,
  type LanguageInfo,
} from './types/languages.js';

export type {
  VideoOverview,
  CreateVideoOverviewOptions,
} from './services/artifacts.js';

// Legacy export - deprecated, use ArtifactState from artifacts.ts instead
// VideoStatus is no longer exported - use ArtifactState instead

// Video service types
export type {
  GetVideoOptions,
} from './services/artifacts.js';

// VideoService is no longer exported - use ArtifactsService.video.create() instead

export type {
  Artifact,
  CreateArtifactOptions,
  QuizData,
  FlashcardData,
  AudioArtifact,
  VideoArtifact,
} from './types/artifact.js';

export {
  ArtifactType,
  ArtifactState,
} from './types/artifact.js';

// RPC methods (for advanced use)
export * as RPCMethods from './rpc/rpc-methods.js';

// RPC client (for advanced use)
export { RPCClient } from './rpc/rpc-client.js';
export type { RPCClientConfig } from './rpc/rpc-client.js';

// Batch execute client (for advanced use)
export { BatchExecuteClient } from './utils/batch-execute.js';

// Error utilities (for advanced use)
export { 
  ErrorType,
  APIError,
  getErrorCode,
  isErrorResponse,
  addErrorCode,
  listErrorCodes,
} from './utils/errors.js';
export type { ErrorCode } from './utils/errors.js';

// Auth utilities (credential refresh)
export {
  RefreshClient,
  AutoRefreshManager,
  extractGSessionId,
  defaultAutoRefreshConfig,
} from './auth/refresh.js';
export type { AutoRefreshConfig } from './auth/refresh.js';

// Quota management
export {
  QuotaManager,
  RateLimitError,
  validateTextSource,
  validateFileSize,
  NOTEBOOKLM_LIMITS,
} from './utils/quota.js';
export type { UsageData } from './utils/quota.js';

