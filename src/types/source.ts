/**
 * Source types
 */

/**
 * Source type enum
 * Maps to NotebookLM API type codes:
 * - API code 1 → GOOGLE_DRIVE
 * - API code 2 → TEXT
 * - API code 3 → PDF
 * - API code 4 → TEXT_NOTE
 * - API code 5 → URL
 * - API code 8 → MIND_MAP_NOTE
 * - API code 9 → YOUTUBE_VIDEO
 * - API code 10 → VIDEO_FILE
 * - API code 13 → IMAGE
 * - API code 14 → PDF_FROM_DRIVE
 */
export enum SourceType {
  UNKNOWN = 0,
  URL = 1,
  TEXT = 2,
  FILE = 3, // Generic file (deprecated - use specific types like PDF, VIDEO_FILE, IMAGE)
  YOUTUBE_VIDEO = 4,
  GOOGLE_DRIVE = 5,
  GOOGLE_SLIDES = 6,
  PDF = 7, // PDF file (API code 3)
  TEXT_NOTE = 8, // Text note (API code 4)
  VIDEO_FILE = 10, // Video file upload (API code 10)
  IMAGE = 13, // Image file (API code 13)
  PDF_FROM_DRIVE = 14, // PDF from Google Drive (API code 14)
  MIND_MAP_NOTE = 15, // Mind map note (API code 8)
}

/**
 * Source in a notebook
 */
export interface Source {
  sourceId: string; // Unique source ID
  title?: string; // Source title/name
  type?: SourceType; // Source type
  content?: string; // Source content (for text sources)
  url?: string; // Source URL (for URL sources)
  metadata?: Record<string, any>; // Source metadata
  createdAt?: string; // Creation timestamp
  updatedAt?: string; // Last modified timestamp
  status?: SourceStatus; // Processing status
  error?: string; // Error message if processing failed
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
  type: SourceType; // Source type
  title?: string; // Source title
  content?: string; // Text content (for text sources)
  url?: string; // URL (for URL sources)
  fileContent?: string; // File content (base64 for file sources)
  fileName?: string; // File name (for file sources)
  mimeType?: string; // MIME type (for file sources)
  videoId?: string; // YouTube video ID (for YouTube sources)
}

/**
 * Options for adding a source from URL
 */
export interface AddSourceFromURLOptions {
  url: string; // URL to add
  title?: string; // Optional custom title
}

/**
 * Options for adding a source from text
 */
export interface AddSourceFromTextOptions {
  content: string; // Text content
  title: string; // Source title
}

/**
 * Options for adding a source from file
 */
export interface AddSourceFromFileOptions {
  content: Buffer | string; // File content (as Buffer or base64 string)
  fileName: string; // File name
  mimeType?: string; // MIME type (optional, will be auto-detected if not provided)
}

/**
 * Source processing status result
 */
export interface SourceProcessingStatus {
  allReady: boolean; // Whether all sources are ready
  processing: string[]; // List of source IDs still processing
}

/**
 * Source content result
 */
export interface SourceContent {
  text: string; // Full text content
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Source freshness check result
 */
export interface SourceFreshness {
  isFresh: boolean; // Whether source is fresh/up-to-date
  lastChecked?: Date; // Last checked timestamp
}

/**
 * Research mode for source discovery
 */
export enum ResearchMode {
  FAST = 1, // Fast research (quick results)
  DEEP = 2, // Deep research (in-depth report, Web only)
}

/**
 * Source type for search
 */
export enum SearchSourceType {
  WEB = 1, // Web sources
  GOOGLE_DRIVE = 5, // Google Drive sources
}

/**
 * Discovered web source
 */
export interface DiscoveredWebSource {
  url: string; // Source URL
  title: string; // Source title
  id?: string; // Source ID (if available)
  type?: string; // Source type indicator from API (if available)
}

/**
 * Discovered Drive source
 */
export interface DiscoveredDriveSource {
  fileId: string; // Google Drive file ID
  mimeType: string; // MIME type
  title: string; // File title
  id?: string; // Source ID (if available)
}

/**
 * Discovered source (DEPRECATED - use DiscoveredWebSource or DiscoveredDriveSource instead)
 * @deprecated This type was used with the removed `discover()` method.
 * Use `DiscoveredWebSource[]` or `DiscoveredDriveSource[]` from `getSearchResults()` or `searchWebAndWait()` instead.
 */
export interface DiscoveredSource {
  id: string; // Source ID
  title: string; // Source title
  type?: SourceType; // Source type
  url?: string; // Source URL (for web sources)
  relevance?: number; // Relevance score (if available)
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Options for searching web sources
 */
export interface SearchWebSourcesOptions {
  query: string; // Search query
  sourceType?: SearchSourceType; // Source type (web or drive)
  mode?: ResearchMode; // Research mode (fast or deep)
}

/**
 * Options for adding discovered sources
 */
export interface AddDiscoveredSourcesOptions {
  sessionId: string; // Search session ID from searchWeb()
  webSources?: DiscoveredWebSource[]; // Web sources to add
  driveSources?: DiscoveredDriveSource[]; // Drive sources to add
}

/**
 * Options for adding Google Drive source directly
 */
export interface AddGoogleDriveSourceOptions {
  fileId: string; // Google Drive file ID
  title?: string; // Optional custom title
  mimeType?: string; // MIME type (optional, will be inferred if not provided)
}

/**
 * Options for adding YouTube source
 */
export interface AddYouTubeSourceOptions {
  urlOrId: string; // YouTube URL or video ID
  title?: string; // Optional custom title
}

/**
 * Options for batch source addition
 */
export interface BatchAddSourcesOptions {
  sources: Array< // Array of source inputs (mixed types supported)
    | { type: 'url'; url: string; title?: string }
    | { type: 'text'; title: string; content: string }
    | { type: 'file'; content: Buffer | string; fileName: string; mimeType?: string }
    | { type: 'youtube'; urlOrId: string; title?: string }
    | { type: 'gdrive'; fileId: string; title?: string; mimeType?: string }
  >;
  waitForProcessing?: boolean; // Whether to wait for all sources to be processed (default: false)
  timeout?: number; // Timeout in ms if waitForProcessing is true (default: 300000 = 5 minutes)
  pollInterval?: number; // Poll interval in ms if waitForProcessing is true (default: 2000 = 2 seconds)
  onProgress?: (ready: number, total: number) => void; // Progress callback
}

/**
 * Options for web search with waiting
 */
export interface SearchWebAndWaitOptions extends SearchWebSourcesOptions {
  timeout?: number; // Max wait time for results in ms (default: 30000 = 30 seconds)
  pollInterval?: number; // Poll interval in ms (default: 2000 = 2 seconds)
  onProgress?: (status: { hasResults: boolean; resultCount?: number }) => void; // Progress callback
}

/**
 * Result from web search with waiting
 */
export interface WebSearchResult {
  sessionId: string; // Search session ID (required for adding sources)
  web: DiscoveredWebSource[]; // Discovered web sources
  drive: DiscoveredDriveSource[]; // Discovered Google Drive sources
}

/**
 * Chunk metadata for auto-chunked sources
 */
export interface SourceChunk {
  sourceId: string; // Source ID of this chunk
  fileName: string; // Original or chunked file name
  chunkIndex: number; // Zero-based index of this chunk
  wordStart?: number; // Starting word index (for text chunks)
  wordEnd?: number; // Ending word index (for text chunks)
  sizeBytes?: number; // Size in bytes (for file chunks)
}

/**
 * Result from adding a source (may be chunked)
 */
export interface AddSourceResult {
  sourceId?: string; // Single source ID (if not chunked)
  sourceIds?: string[]; // All source IDs (if chunked)
  wasChunked: boolean; // Whether the source was automatically chunked
  totalWords?: number; // Total word count (for text sources)
  totalSizeBytes?: number; // Total size in bytes (for file sources)
  chunks?: SourceChunk[]; // Chunk metadata (if chunked)
  allSourceIds?: string[]; // All source IDs (convenience - same as sourceIds if chunked, [sourceId] if not)
}
