/**
 * RPC endpoint IDs for NotebookLM services
 * These are the method identifiers used to call various NotebookLM API operations
 */

// ============================================================================
// NotebookLM Service - Project/Notebook Operations
// ============================================================================

/** List my notebooks (recently viewed) - primary listing RPC */
export const RPC_LIST_MY_NOTEBOOKS = 'wXbhsf';

/** List projects/notebooks with filters (legacy, may not return actual data) */
export const RPC_LIST_PROJECTS = 'hT54vc';

/** Create a new project/notebook */
export const RPC_CREATE_PROJECT = 'CCqFvf';

/** Get project details (uses [project_id]) */
export const RPC_GET_PROJECT = 'rLM1Ne';

/** Poll source processing status (uses [notebook_id, null, [2], null, 1]) - same RPC as GetProject, different params */
export const RPC_POLL_SOURCE_PROCESSING = 'rLM1Ne';

/** Delete one or more projects */
export const RPC_DELETE_PROJECTS = 'WWINqb';

/** Update project metadata */
export const RPC_UPDATE_PROJECT = 's0tc2d';


// ============================================================================
// NotebookLM Service - Source Operations
// ============================================================================

/** Add sources to a project */
export const RPC_ADD_SOURCES = 'izAoDd';

/** Delete sources from a project */
export const RPC_DELETE_SOURCES = 'tGMBJ';

/** Update source metadata */
export const RPC_MUTATE_SOURCE = 'b7Wfje';

/** Refresh a source (re-fetch content) */
export const RPC_REFRESH_SOURCE = 'FLmJqe';

/** Load source content */
export const RPC_LOAD_SOURCE = 'hizoJc';

/** Check if source content is fresh/up-to-date */
export const RPC_CHECK_SOURCE_FRESHNESS = 'yR9Yof';

/** Perform action on sources */
export const RPC_ACT_ON_SOURCES = 'yyryJe';

/** Discover sources (search) */
export const RPC_DISCOVER_SOURCES = 'qXyaNe';

// ============================================================================
// NotebookLM Service - Source Discovery/Research Operations
// ============================================================================

/** Initiate web or drive search */
export const RPC_SEARCH_WEB_SOURCES = 'Ljjv0c';

/** Get discovered sources from search */
export const RPC_GET_SEARCH_RESULTS = 'e3bVqc';

/** Add selected sources from discovery */
export const RPC_ADD_DISCOVERED_SOURCES = 'LBwxtb';

/** Add deep research report as source */
export const RPC_ADD_DEEP_RESEARCH_REPORT = 'QA9ei';

/** Load source content (uses [[[source_id]]]) - same RPC as GenerateDocumentGuides, different params */
export const RPC_LOAD_SOURCE_CONTENT = 'tr032e';

// ============================================================================
// NotebookLM Service - Note Operations
// ============================================================================

/** Create a new note */
export const RPC_CREATE_NOTE = 'CYK0Xb';

/** Update note content or metadata */
export const RPC_MUTATE_NOTE = 'cYAfTb';

/** Delete one or more notes */
export const RPC_DELETE_NOTES = 'AH0mwd';

/** Get notes for a project */
export const RPC_GET_NOTES = 'cFji9';

// ============================================================================
// NotebookLM Service - Audio Operations
// ============================================================================

/** Create audio overview (podcast) */
export const RPC_CREATE_AUDIO_OVERVIEW = 'AHyHrd';

/** Get audio overview details and content */
export const RPC_GET_AUDIO_OVERVIEW = 'VUsiyb';

/** Delete audio overview */
export const RPC_DELETE_AUDIO_OVERVIEW = 'V5N4be';

/** Get audio download URL (download audio file) */
export const RPC_GET_AUDIO_DOWNLOAD = 'Fxmvse';

// ============================================================================
// NotebookLM Service - Video Operations
// ============================================================================

/** Create video overview */
export const RPC_CREATE_VIDEO_OVERVIEW = 'R7cb6c';

/** Create report (also uses R7cb6c) */
export const RPC_CREATE_REPORT = 'R7cb6c';

/** Export report to Google Docs or Sheets */
export const RPC_EXPORT_REPORT = 'Krh3pd';

// ============================================================================
// NotebookLM Service - Generation Operations
// ============================================================================

/** Generate document guides (uses [project_id]) */
export const RPC_GENERATE_DOCUMENT_GUIDES = 'tr032e';

/** Generate notebook guide */
export const RPC_GENERATE_NOTEBOOK_GUIDE = 'VfAZjd';

/** Generate outline */
export const RPC_GENERATE_OUTLINE = 'lCjAd';

/** Generate section */
export const RPC_GENERATE_SECTION = 'BeTrYd';

/** Start draft */
export const RPC_START_DRAFT = 'exXvGf';

/** Start section */
export const RPC_START_SECTION = 'pGC7gf';

/** Generate free-form streamed response (chat) */
export const RPC_GENERATE_FREE_FORM_STREAMED = 'BD';

/** Generate report suggestions */
export const RPC_GENERATE_REPORT_SUGGESTIONS = 'GHsKob';

// ============================================================================
// NotebookLM Service - Account Operations
// ============================================================================

/** Get or create user account */
export const RPC_GET_OR_CREATE_ACCOUNT = 'ZwVcOc';

/** Update account settings */
export const RPC_MUTATE_ACCOUNT = 'hT54vc';

// ============================================================================
// NotebookLM Service - Analytics Operations
// ============================================================================


// ============================================================================
// NotebookLMSharing Service Operations
// ============================================================================

/** Share audio overview */
export const RPC_SHARE_AUDIO = 'RGP97b';

/** Get sharing details */
export const RPC_GET_SHARING_DETAILS = 'JFMDGd';

/** Share project */
export const RPC_SHARE_PROJECT = 'QDyure';

// ============================================================================
// NotebookLMGuidebooks Service Operations
// ============================================================================

/** Delete guidebook */
export const RPC_DELETE_GUIDEBOOK = 'ARGkVc';

/** Get guidebook */
export const RPC_GET_GUIDEBOOK = 'EYqtU';

/** List recently viewed guidebooks */
export const RPC_LIST_RECENTLY_VIEWED_GUIDEBOOKS = 'YJBpHc';

/** Publish guidebook */
export const RPC_PUBLISH_GUIDEBOOK = 'R6smae';

/** Get guidebook details */
export const RPC_GET_GUIDEBOOK_DETAILS = 'LJyzeb';

/** Share guidebook */
export const RPC_SHARE_GUIDEBOOK = 'OTl0K';

/** Generate answer in guidebook */
export const RPC_GUIDEBOOK_GENERATE_ANSWER = 'itA0pc';

// ============================================================================
// LabsTailwindOrchestrationService - Artifact Operations
// ============================================================================

/** Create artifact */
export const RPC_CREATE_ARTIFACT = 'xpWGLf';

/** Get artifact */
export const RPC_GET_ARTIFACT = 'BnLyuf';

/** Get quiz data (download quiz as JSON) */
export const RPC_GET_QUIZ_DATA = 'v9rmvd';

/** Update artifact */
export const RPC_UPDATE_ARTIFACT = 'DJezBc';

/** Rename artifact (for title updates) */
export const RPC_RENAME_ARTIFACT = 'rc3d8d';

/** Delete artifact */
export const RPC_DELETE_ARTIFACT = 'WxBZtb';

/** List artifacts */
export const RPC_LIST_ARTIFACTS = 'gArtLc';

// ============================================================================
// LabsTailwindOrchestrationService - Additional Operations
// ============================================================================


/** Report content */
export const RPC_REPORT_CONTENT = 'rJKx8e';

// ============================================================================
// Unknown/Unimplemented RPCs
// ============================================================================

/** Upload file by filename (purpose unclear) */
export const RPC_UPLOAD_FILE_BY_FILENAME = 'o4cbdc';

/** Called after slide deck creation (purpose unknown) */
export const RPC_UNKNOWN_POST_SLIDE_DECK = 'ozz5Z';

