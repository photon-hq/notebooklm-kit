/**
 * Source types
 */

/**
 * Source type enum
 */
export enum SourceType {
  UNKNOWN = 0,
  URL = 1,
  TEXT = 2,
  FILE = 3,
  YOUTUBE_VIDEO = 4,
  GOOGLE_DRIVE = 5,
  GOOGLE_SLIDES = 6,
}

/**
 * Source in a notebook
 */
export interface Source {
  /** Unique source ID */
  sourceId: string;
  
  /** Source title/name */
  title?: string;
  
  /** Source type */
  type?: SourceType;
  
  /** Source content (for text sources) */
  content?: string;
  
  /** Source URL (for URL sources) */
  url?: string;
  
  /** Source metadata */
  metadata?: Record<string, any>;
  
  /** Creation timestamp */
  createdAt?: string;
  
  /** Last modified timestamp */
  updatedAt?: string;
  
  /** Processing status */
  status?: SourceStatus;
  
  /** Error message if processing failed */
  error?: string;
}

/**
 * Source processing status
 */
export enum SourceStatus {
  UNKNOWN = 0,
  PROCESSING = 1,
  READY = 2,
  FAILED = 3,
}

/**
 * Input for adding a source
 */
export interface SourceInput {
  /** Source type */
  type: SourceType;
  
  /** Source title */
  title?: string;
  
  /** Text content (for text sources) */
  content?: string;
  
  /** URL (for URL sources) */
  url?: string;
  
  /** File content (base64 for file sources) */
  fileContent?: string;
  
  /** File name (for file sources) */
  fileName?: string;
  
  /** MIME type (for file sources) */
  mimeType?: string;
  
  /** YouTube video ID (for YouTube sources) */
  videoId?: string;
}

/**
 * Options for adding a source from URL
 */
export interface AddSourceFromURLOptions {
  /** URL to add */
  url: string;
  
  /** Optional custom title */
  title?: string;
}

/**
 * Options for adding a source from text
 */
export interface AddSourceFromTextOptions {
  /** Text content */
  content: string;
  
  /** Source title */
  title: string;
}

/**
 * Options for adding a source from file
 */
export interface AddSourceFromFileOptions {
  /** File content (as Buffer or base64 string) */
  content: Buffer | string;
  
  /** File name */
  fileName: string;
  
  /** MIME type (optional, will be auto-detected if not provided) */
  mimeType?: string;
}

/**
 * Source processing status result
 */
export interface SourceProcessingStatus {
  /** Whether all sources are ready */
  allReady: boolean;
  
  /** List of source IDs still processing */
  processing: string[];
}

/**
 * Source content result
 */
export interface SourceContent {
  /** Full text content */
  text: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Source freshness check result
 */
export interface SourceFreshness {
  /** Whether source is fresh/up-to-date */
  isFresh: boolean;
  
  /** Last checked timestamp */
  lastChecked?: Date;
}

/**
 * Research mode for source discovery
 */
export enum ResearchMode {
  /** Fast research (quick results) */
  FAST = 1,
  
  /** Deep research (in-depth report, Web only) */
  DEEP = 2,
}

/**
 * Source type for search
 */
export enum SearchSourceType {
  /** Web sources */
  WEB = 1,
  
  /** Google Drive sources */
  GOOGLE_DRIVE = 5,
}

/**
 * Discovered web source
 */
export interface DiscoveredWebSource {
  /** Source URL */
  url: string;
  
  /** Source title */
  title: string;
  
  /** Source ID (if available) */
  id?: string;
}

/**
 * Discovered Drive source
 */
export interface DiscoveredDriveSource {
  /** Google Drive file ID */
  fileId: string;
  
  /** MIME type */
  mimeType: string;
  
  /** File title */
  title: string;
  
  /** Source ID (if available) */
  id?: string;
}

/**
 * Discovered source (DEPRECATED - use DiscoveredWebSource or DiscoveredDriveSource instead)
 * 
 * @deprecated This type was used with the removed `discover()` method.
 * Use `DiscoveredWebSource[]` or `DiscoveredDriveSource[]` from `getSearchResults()` or `searchWebAndWait()` instead.
 */
export interface DiscoveredSource {
  /** Source ID */
  id: string;
  
  /** Source title */
  title: string;
  
  /** Source type */
  type?: SourceType;
  
  /** Source URL (for web sources) */
  url?: string;
  
  /** Relevance score (if available) */
  relevance?: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Options for searching web sources
 */
export interface SearchWebSourcesOptions {
  /** Search query */
  query: string;
  
  /** Source type (web or drive) */
  sourceType?: SearchSourceType;
  
  /** Research mode (fast or deep) */
  mode?: ResearchMode;
}

/**
 * Options for adding discovered sources
 */
export interface AddDiscoveredSourcesOptions {
  /** Search session ID from searchWeb() */
  sessionId: string;
  
  /** Web sources to add */
  webSources?: DiscoveredWebSource[];
  
  /** Drive sources to add */
  driveSources?: DiscoveredDriveSource[];
}

/**
 * Options for adding Google Drive source directly
 */
export interface AddGoogleDriveSourceOptions {
  /** Google Drive file ID */
  fileId: string;
  
  /** Optional custom title */
  title?: string;
  
  /** MIME type (optional, will be inferred if not provided) */
  mimeType?: string;
}

/**
 * Options for adding YouTube source
 */
export interface AddYouTubeSourceOptions {
  /** YouTube URL or video ID */
  urlOrId: string;
  
  /** Optional custom title */
  title?: string;
}

/**
 * Options for batch source addition
 */
export interface BatchAddSourcesOptions {
  /** Array of source inputs (mixed types supported) */
  sources: Array<
    | { type: 'url'; url: string; title?: string }
    | { type: 'text'; title: string; content: string }
    | { type: 'file'; content: Buffer | string; fileName: string; mimeType?: string }
    | { type: 'youtube'; urlOrId: string; title?: string }
    | { type: 'gdrive'; fileId: string; title?: string; mimeType?: string }
  >;
  
  /** Whether to wait for all sources to be processed (default: false) */
  waitForProcessing?: boolean;
  
  /** Timeout in ms if waitForProcessing is true (default: 300000 = 5 minutes) */
  timeout?: number;
  
  /** Poll interval in ms if waitForProcessing is true (default: 2000 = 2 seconds) */
  pollInterval?: number;
  
  /** Progress callback */
  onProgress?: (ready: number, total: number) => void;
}

/**
 * Options for web search with waiting
 */
export interface SearchWebAndWaitOptions extends SearchWebSourcesOptions {
  /** Max wait time for results in ms (default: 30000 = 30 seconds) */
  timeout?: number;
  
  /** Poll interval in ms (default: 2000 = 2 seconds) */
  pollInterval?: number;
  
  /** Progress callback */
  onProgress?: (status: { hasResults: boolean; resultCount?: number }) => void;
}

/**
 * Result from web search with waiting
 */
export interface WebSearchResult {
  /** Search session ID (required for adding sources) */
  sessionId: string;
  
  /** Discovered web sources */
  web: DiscoveredWebSource[];
  
  /** Discovered Google Drive sources */
  drive: DiscoveredDriveSource[];
}

