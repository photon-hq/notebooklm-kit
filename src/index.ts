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
export { AudioService } from './services/audio.js';
export { VideoService } from './services/video.js';
export { ArtifactsService } from './services/artifacts.js';
export { GenerationService } from './services/generation.js';

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
} from './types/audio.js';

export {
  AudioStatus,
  ShareOption,
  AudioLanguage,
} from './types/audio.js';

export type {
  VideoOverview,
  CreateVideoOverviewOptions,
} from './types/video.js';

export {
  VideoStatus,
} from './types/video.js';

export type {
  Artifact,
  CreateArtifactOptions,
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

