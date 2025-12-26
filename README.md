<div align="center">
   
# @photon-ai/NotebookLM-kit

> A TypeScript SDK for programmatic access to Google NotebookLM.

</div>

[![npm version](https://img.shields.io/npm/v/notebooklm-kit.svg)](https://www.npmjs.com/package/notebooklm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

## Overview

The NotebookLM Kit provides a clean, organized interface to all NotebookLM features through a service-based architecture:

- **`sdk.notebooks`** - Create, list, update, delete notebooks
- **`sdk.sources`** - Add sources (URLs, text, files, YouTube, Google Drive, web search)
- **`sdk.notes`** - Create and manage notes within notebooks
- **`sdk.artifacts`** - Generate quizzes, flashcards, study guides, mind maps, infographics, slides, reports, audio, video
- **`sdk.generation`** - Chat with notebooks, generate guides, outlines, reports

All features are organized logically and easy to discover. The SDK handles authentication, quota management, and session refresh automatically.

## Quick Start

### Installation

```bash
npm install notebooklm-kit
```

### Basic Usage

```typescript
import { NotebookLMClient } from 'notebooklm-kit'

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
})

const notebook = await sdk.notebooks.create({
  title: 'My Research',
  emoji: '📚',
})

await sdk.sources.addFromURL(notebook.projectId, {
  url: 'https://example.com/article',
})

const response = await sdk.generation.chat(
  notebook.projectId,
  'What are the key findings?'
)

console.log(response)

sdk.dispose()
```

## Configuration

```typescript
interface NotebookLMConfig {
  authToken: string              // Required: Auth token from NotebookLM
  cookies: string                 // Required: Session cookies
  debug?: boolean                 // Enable debug logging (default: false)
  autoRefresh?: boolean | {       // Auto-refresh credentials (default: true)
    enabled: boolean              // Enable auto-refresh (default: true)
    interval?: number             // Refresh interval in ms (default: 600000 = 10 minutes)
    gsessionId?: string           // Optional: Google session ID (auto-extracted if not provided)
  }
  maxRetries?: number             // Retry attempts (default: 3)
  enforceQuotas?: boolean         // Enforce usage limits (default: true)
  headers?: Record<string, string> // Custom headers
  urlParams?: Record<string, string> // Custom URL params
}
```

## Authentication

To use the SDK, you need to provide authentication credentials from your NotebookLM session.

### Getting Credentials

1. **Get Auth Token (`NOTEBOOKLM_AUTH_TOKEN`):**
   - Open https://notebooklm.google.com in your browser and log in
   - Open Developer Tools (F12 or Cmd+Option+I)
   - Go to **Console** tab
   - Run: `window.WIZ_global_data.SNlM0e`
   - Copy the returned value - this is your `NOTEBOOKLM_AUTH_TOKEN`

2. **Get Cookies (`NOTEBOOKLM_COOKIES`):**
   - In the same browser session, open Developer Tools
   - Go to **Network** tab
   - Make any request to notebooklm.google.com (refresh the page or navigate)
   - Find any request to `notebooklm.google.com` in the Network tab
   - Click on the request → Go to **Headers** section
   - Find the **Cookie** header
   - Copy the **entire Cookie value** as-is (it's a long string with all cookies)
   - This is your `NOTEBOOKLM_COOKIES`

### Setup `.env` File

Create a `.env` file in your project root:

```bash
# .env file
NOTEBOOKLM_AUTH_TOKEN="ACi2F2NZSD7yrNvFMrCkP3vZJY1R:1766720233448"
NOTEBOOKLM_COOKIES="_ga=GA1.1.1949425436.1764104083; _gcl_au=1.1.97624223.1766334541; SID=g.a0005AiwX1RtlIPQBj7__D1pWyMMI4OZ96lR1jORFU-zhw0PyJjFPhsuA6wz-fDn5ePHz4FgJQACgYKARgSARISFQHGX2MiJLpitYn6kL6yvitaZn3QWhoVAUF8yKqOII_qVxsGB0zENq9N26M50076; APISID=2-7oUEYiopHvktji/Adx9rNhzIF8Oe-MPI; SAPISID=eMePV31yEdEOSnUq/AFdcsHac_J0t3DMBT; ..."
```

**Important Notes:**
- The Cookie header value from Network tab contains all cookies in the correct format
- Copy the entire Cookie value exactly as it appears (it's already properly formatted)
- Both credentials are required for the SDK to work
- Credentials expire after some time - you may need to refresh them periodically

## Auto-Refresh Setup

Auto-refresh keeps your session alive automatically by refreshing credentials periodically. This prevents session expiration during long-running operations.

### Default Configuration

Auto-refresh is **enabled by default** with a 10-minute interval:

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  // Auto-refresh is enabled by default
  // - Initial refresh happens immediately on initialization
  // - Subsequent refreshes happen every 10 minutes automatically
})
```

### Custom Refresh Interval

```typescript
// 5-minute interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes (300,000 ms)
  },
})

// 15-minute interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: {
    enabled: true,
    interval: 15 * 60 * 1000, // 15 minutes (900,000 ms)
  },
})
```

### Refresh Interval Guidelines

- **Recommended:** 5-10 minutes (300,000 - 600,000 ms)
- **Minimum:** 1 minute (60,000 ms) - not recommended, may be too frequent
- **Maximum:** 30 minutes (1,800,000 ms) - sessions may expire before refresh
- **Default:** 10 minutes (600,000 ms) - optimal balance

### Disable Auto-Refresh

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: false, // Disable auto-refresh
})
```

### Manual Refresh

```typescript
// Manually refresh credentials
await sdk.refreshCredentials()

// Get refresh manager status
const refreshManager = sdk.getRefreshManager()
if (refreshManager?.isRunning()) {
  console.log('Auto-refresh is active')
}
```

## Quota Management & Limits

The SDK automatically tracks and enforces NotebookLM's usage limits to prevent API errors. All limits are enforced client-side before making API calls.

### View All Limits

```typescript
import { NOTEBOOKLM_LIMITS } from 'notebooklm-kit'

console.log('NotebookLM Limits:', NOTEBOOKLM_LIMITS)
```

**Account Limits:**
- **Max Notebooks:** 100 per account
- **Max Sources per Notebook:** 50 sources
- **Max Words per Source:** 500,000 words
- **Max File Size:** 200 MB per file

**Daily Limits (reset after 24 hours):**
- **Chats:** 50 per day
- **Audio Overviews:** 3 per day
- **Video Overviews:** 3 per day
- **Reports:** 10 per day
- **Flashcards:** 10 per day
- **Quizzes:** 10 per day

**Monthly Limits (reset after 30 days):**
- **Deep Research Reports:** 10 per month

**Unlimited (server-enforced):**
- **Mind Maps:** No client-side limit
- **Infographics:** Server-enforced limit
- **Slide Decks:** Server-enforced limit

### Check Current Usage

```typescript
// Get complete usage statistics
const usage = sdk.getUsage()

console.log('Daily Usage:')
console.log(`  Chats: ${usage.daily.chats}/${NOTEBOOKLM_LIMITS.CHATS_PER_DAY}`)
console.log(`  Audio: ${usage.daily.audioOverviews}/${NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY}`)
console.log(`  Video: ${usage.daily.videoOverviews}/${NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY}`)
console.log(`  Reports: ${usage.daily.reports}/${NOTEBOOKLM_LIMITS.REPORTS_PER_DAY}`)
console.log(`  Flashcards: ${usage.daily.flashcards}/${NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY}`)
console.log(`  Quizzes: ${usage.daily.quizzes}/${NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY}`)

console.log('Monthly Usage:')
console.log(`  Deep Research: ${usage.monthly.deepResearch}/${NOTEBOOKLM_LIMITS.DEEP_RESEARCH_PER_MONTH}`)

console.log('Account Usage:')
console.log(`  Notebooks: ${usage.notebooks.total}/${NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS}`)
```

### Check Remaining Quota

```typescript
// Get remaining quota for specific resources
const remainingChats = sdk.getRemaining('chats')
const remainingAudio = sdk.getRemaining('audioOverviews')
const remainingVideo = sdk.getRemaining('videoOverviews')
const remainingQuizzes = sdk.getRemaining('quizzes')
const remainingFlashcards = sdk.getRemaining('flashcards')
const remainingReports = sdk.getRemaining('reports')
const remainingNotebooks = sdk.getRemaining('notebooks')
const remainingDeepResearch = sdk.getRemaining('deepResearch')

console.log(`${remainingChats} chats remaining today`)
console.log(`${remainingAudio} audio overviews remaining today`)
console.log(`${remainingVideo} video overviews remaining today`)
console.log(`${remainingQuizzes} quizzes remaining today`)
console.log(`${remainingFlashcards} flashcards remaining today`)
console.log(`${remainingReports} reports remaining today`)
console.log(`${remainingNotebooks} notebooks remaining`)
console.log(`${remainingDeepResearch} deep research reports remaining this month`)

// Check before making requests
if (remainingChats === 0) {
  console.log('Daily chat limit reached. Wait for reset.')
} else {
  await sdk.generation.chat('notebook-id', 'Hello')
}
```

### Quota Error Handling

When a quota limit is exceeded, the SDK throws a `RateLimitError` with detailed information:

```typescript
import { RateLimitError } from 'notebooklm-kit'

try {
  await sdk.generation.chat('notebook-id', 'Hello')
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.message)
    console.error(`Used: ${error.used}/${error.limit}`)
    console.error('Resource:', error.resource)
    console.error('Resets at:', error.resetTime)
  }
}
```

### Disable Quota Enforcement

```typescript
// Disable client-side quota checks (not recommended)
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  enforceQuotas: false, // Disable quota enforcement
})

// Get quota manager for advanced usage
const quotaManager = sdk.getQuotaManager()

// Reset usage (for testing only)
quotaManager.resetUsage()
```

## Features

| Feature | Method | Example |
|---------|---------|---------|
| Create Notebook | `sdk.notebooks.create()` | [Notebooks](#notebooks) |
| List Notebooks | `sdk.notebooks.list()` | [Notebooks](#notebooks) |
| Add URL Source | `sdk.sources.addFromURL()` | [Sources](#sources) |
| Add Text Source | `sdk.sources.addFromText()` | [Sources](#sources) |
| Add File Source | `sdk.sources.addFromFile()` | [Sources](#sources) |
| Add YouTube Source | `sdk.sources.addYouTube()` | [Sources](#sources) |
| Add Google Drive | `sdk.sources.addGoogleDrive()` | [Sources](#sources) |
| Web Search | `sdk.sources.searchWebAndWait()` | [Sources](#sources) |
| Batch Add Sources | `sdk.sources.addBatch()` | [Sources](#sources) |
| Chat | `sdk.generation.chat()` | [Generation](#generation) |
| Create Audio | `sdk.artifacts.create(ArtifactType.AUDIO)` | [Artifacts](#artifacts) |
| Create Video | `sdk.artifacts.create(ArtifactType.VIDEO)` | [Artifacts](#artifacts) |
| Create Quiz | `sdk.artifacts.create(ArtifactType.QUIZ)` | [Artifacts](#artifacts) |
| Create Flashcards | `sdk.artifacts.create(ArtifactType.FLASHCARDS)` | [Artifacts](#artifacts) |
| Create Study Guide | `sdk.artifacts.create(ArtifactType.STUDY_GUIDE)` | [Artifacts](#artifacts) |
| Create Mind Map | `sdk.artifacts.create(ArtifactType.MIND_MAP)` | [Artifacts](#artifacts) |
| Create Infographic | `sdk.artifacts.create(ArtifactType.INFOGRAPHIC)` | [Artifacts](#artifacts) |
| Create Slide Deck | `sdk.artifacts.create(ArtifactType.SLIDE_DECK)` | [Artifacts](#artifacts) |
| Create Report | `sdk.artifacts.create(ArtifactType.DOCUMENT)` | [Artifacts](#artifacts) |
| List Artifacts | `sdk.artifacts.list()` | [Artifacts](#artifacts) |
| Create Notes | `sdk.notes.create()` | [Notes](#notes) |

## Notebooks

```typescript
// List all notebooks
const notebooks = await sdk.notebooks.list()

// Get specific notebook
const notebook = await sdk.notebooks.get('notebook-id')

// Create notebook
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
  emoji: '📚',
})

// Update notebook
await sdk.notebooks.update('notebook-id', {
  title: 'Updated Title',
})

// Delete notebook
await sdk.notebooks.delete('notebook-id')
```

## Sources

Add sources from various formats to your notebooks. The SDK supports URLs, text, files, YouTube videos, Google Drive files, and web search results.

### Add from URL

```typescript
// Add a regular URL
const sourceId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article',
})

// YouTube URLs are automatically detected
const youtubeId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

### Add from Text

```typescript
const sourceId = await sdk.sources.addFromText('notebook-id', {
  title: 'My Notes',
  content: 'Your text content here...',
})
```

### Add from File

```typescript
import { readFile } from 'fs/promises'

// Read file as buffer
const buffer = await readFile('document.pdf')

const sourceId = await sdk.sources.addFromFile('notebook-id', {
  content: buffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
})

// Supported file types: PDF, DOC, DOCX, TXT, MD, and more
// Max file size: 200MB
```

### Add YouTube Video

```typescript
// From YouTube URL
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})

// From video ID
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'dQw4w9WgXcQ',
})
```

### Add Google Drive File

```typescript
// Add by file ID
const sourceId = await sdk.sources.addGoogleDrive('notebook-id', {
  fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
})

// Search Drive first, then add
const searchResult = await sdk.sources.searchWebAndWait('notebook-id', {
  query: 'research paper',
  sourceType: SearchSourceType.GOOGLE_DRIVE,
})

const sourceIds = await sdk.sources.addDiscovered('notebook-id', {
  sessionId: searchResult.sessionId,
  sourceIds: searchResult.sources.slice(0, 3).map(s => s.sourceId),
})
```

### Web Search

```typescript
import { SearchSourceType, ResearchMode } from 'notebooklm-kit'

// Search and wait for results (recommended)
const result = await sdk.sources.searchWebAndWait('notebook-id', {
  query: 'machine learning trends 2024',
  sourceType: SearchSourceType.WEB,
  mode: ResearchMode.STANDARD, // or ResearchMode.DEEP
})

// Add selected sources
const sourceIds = await sdk.sources.addDiscovered('notebook-id', {
  sessionId: result.sessionId,
  sourceIds: result.sources.slice(0, 5).map(s => s.sourceId),
})

// Manual workflow (if you need more control)
const sessionId = await sdk.sources.searchWeb('notebook-id', {
  query: 'AI research',
  sourceType: SearchSourceType.WEB,
})

// Poll for results
let searchResults
do {
  await new Promise(r => setTimeout(r, 2000))
  searchResults = await sdk.sources.getSearchResults('notebook-id', sessionId)
} while (!searchResults.complete)

// Add sources
const addedIds = await sdk.sources.addDiscovered('notebook-id', {
  sessionId,
  sourceIds: searchResults.sources.map(s => s.sourceId),
})
```

### Batch Add Sources

```typescript
// Add multiple sources at once
const sourceIds = await sdk.sources.addBatch('notebook-id', {
  sources: [
    { type: 'url', url: 'https://example.com/article1' },
    { type: 'url', url: 'https://example.com/article2' },
    { type: 'text', title: 'Notes', content: 'Text content...' },
    { type: 'youtube', urlOrId: 'dQw4w9WgXcQ' },
    { type: 'gdrive', fileId: 'file-id-here' },
  ],
})
```

### Check Source Processing Status

```typescript
// Check if sources are ready
const status = await sdk.sources.pollProcessing('notebook-id')

console.log(`Ready: ${status.readyCount}/${status.totalCount}`)
console.log(`Processing: ${status.processingCount}`)
console.log(`Failed: ${status.failedCount}`)

// Wait for all sources to be ready
while (!status.allReady) {
  await new Promise(r => setTimeout(r, 2000))
  const newStatus = await sdk.sources.pollProcessing('notebook-id')
  if (newStatus.allReady) break
}
```

### Delete Source

```typescript
await sdk.sources.delete('notebook-id', 'source-id')
```

## Notes

```typescript
// List notes
const notes = await sdk.notes.list('notebook-id')

// Create note
const note = await sdk.notes.create('notebook-id', {
  title: 'Meeting Notes',
  content: 'Key points from the meeting...',
})

// Update note
await sdk.notes.update('notebook-id', 'note-id', {
  content: 'Updated content...',
})

// Delete note
await sdk.notes.delete('notebook-id', 'note-id')
```

## Generation

Chat with your notebook and generate various content types.

### Chat

```typescript
// Simple chat
const response = await sdk.generation.chat('notebook-id', 'What are the key findings?')

// Chat with specific sources
const response = await sdk.generation.chat('notebook-id', 'Summarize these sources', [
  'source-id-1',
  'source-id-2',
])
```

### Generate Guides

```typescript
// Generate document guides
const guides = await sdk.generation.generateDocumentGuides('notebook-id')

// Generate notebook guide
const guide = await sdk.generation.generateNotebookGuide('notebook-id')
```

### Generate Outline

```typescript
const outline = await sdk.generation.generateOutline('notebook-id')
```

### Generate Report Suggestions

```typescript
const suggestions = await sdk.generation.generateReportSuggestions('notebook-id')
```

### Magic View

```typescript
const magicView = await sdk.generation.generateMagicView('notebook-id', [
  'source-id-1',
  'source-id-2',
])
```

## Artifacts

Create various types of artifacts from your notebook content. Artifacts include audio overviews, video overviews, quizzes, flashcards, study guides, mind maps, infographics, slide decks, and reports.

**⚠️ Important: Sources Required**
- Your notebook must have at least one source before creating artifacts
- If you don't specify `sourceIds`, all sources in the notebook are used automatically
- If you provide `sourceIds`, only those specific sources are used

### List Artifacts

```typescript
// List all artifacts
const artifacts = await sdk.artifacts.list('notebook-id')

// Filter by type
const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ)
const readyArtifacts = artifacts.filter(a => a.state === ArtifactState.READY)
```

### Audio Overviews

NotebookLM supports **80+ languages** for audio overviews. Use the `NotebookLMLanguage` enum for type safety, or pass ISO 639-1 language codes directly.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create audio in English (uses all sources)
const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings and main conclusions',
  // sourceIds omitted = uses ALL sources in notebook
})

// Create audio from specific sources only
const focusedAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings and main conclusions',
  sourceIds: ['source-id-1', 'source-id-2'], // Only these sources
})

// Create audio in Hindi (हिन्दी) - Deep dive format
const hindiAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.HINDI, // or 'hi'
    format: 0, // 0=Deep dive (supports all 3 length options)
    length: 2, // 1=Short, 2=Default, 3=Long
  },
  instructions: 'मुख्य निष्कर्षों पर ध्यान दें',
})

// Create audio in French (Français) - Deep dive with long length
const frenchAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    format: 0, // 0=Deep dive (supports: 1=Short, 2=Default, 3=Long)
    length: 3, // Long
  },
  instructions: 'Focus on key findings and methodology',
})

// Create audio in Japanese (日本語) - Brief format (no length option)
const japaneseAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.JAPANESE, // or 'ja'
    format: 1, // 1=Brief (length option not available)
  },
})

// Create audio - Critique format (supports: 1=Short, 2=Default)
const critiqueAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    format: 2, // 2=Critique (supports: 1=Short, 2=Default)
    length: 1, // Short
    language: 'en',
  },
})

// Create audio - Debate format (supports: 1=Short, 2=Default)
const debateAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    format: 3, // 3=Debate (supports: 1=Short, 2=Default)
    length: 2, // Default
    language: 'en',
    instructions: 'Discuss the pros and cons of the main argument',
  },
})

// Get audio status (use notebook ID for audio artifacts)
const audioStatus = await sdk.artifacts.get('notebook-id', 'notebook-id')

// Download audio (when ready)
if (audioStatus.state === ArtifactState.READY) {
  const audioData = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
  console.log(`Audio saved to: ${audioData.filePath}`)
}
```

### Video Overviews

NotebookLM supports **80+ languages** for video overviews. Use the `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create video overview in English (uses all sources)
const video = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video overview with key highlights',
  // sourceIds omitted = uses ALL sources in notebook
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime, 6=Watercolour, 7=Anime (alt), 8=Retro print, 9=Heritage, 10=Paper-craft
  },
})

// Create video from specific sources only
const focusedVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video overview with key highlights',
  sourceIds: ['source-id-1', 'source-id-2'], // Only use these sources
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    visualStyle: 2, // Classic
  },
})

// Create video in Spanish (Español)
const spanishVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Crear un resumen de video atractivo',
  // sourceIds omitted = uses all sources
  customization: {
    format: 1,
    language: NotebookLMLanguage.SPANISH, // or 'es'
    visualStyle: 2, // Classic
  },
})

// Create video in German (Deutsch)
const germanVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Erstellen Sie eine ansprechende Videoübersicht',
  // sourceIds omitted = uses all sources
  customization: {
    format: 2, // Brief
    language: NotebookLMLanguage.GERMAN, // or 'de'
    visualStyle: 3, // Whiteboard
  },
})

// Get video status
const videoStatus = await sdk.artifacts.get(video.artifactId)

// Download video (when ready)
if (videoStatus.state === ArtifactState.READY) {
  const videoData = await sdk.artifacts.download(video.artifactId, './downloads')
  console.log(`Video saved to: ${videoData.filePath}`)
}
```

### Quizzes

Quizzes support **80+ languages**. Use `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create quiz in English (uses all sources)
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create 10 multiple choice questions covering key concepts',
  // sourceIds omitted = uses all sources in notebook
  customization: {
    numberOfQuestions: 3, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: NotebookLMLanguage.ENGLISH, // or 'en'
  },
})

// Create quiz from specific sources only
const quizFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create questions from these sources',
  sourceIds: ['source-id-1', 'source-id-2'], // Only use these sources
  customization: {
    numberOfQuestions: 3,
    difficulty: 2,
    language: NotebookLMLanguage.ENGLISH,
  },
})

// Create quiz in Hindi (हिन्दी)
const hindiQuiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'अध्याय 1 प्रश्नोत्तरी',
  instructions: 'मुख्य अवधारणाओं को कवर करने वाले 10 बहुविकल्पीय प्रश्न बनाएं',
  customization: {
    numberOfQuestions: 3,
    difficulty: 3, // Hard
    language: NotebookLMLanguage.HINDI, // or 'hi'
  },
})

// Poll until ready
let artifact = quiz
while (artifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  artifact = await sdk.artifacts.get(quiz.artifactId)
}

// Download quiz data
if (artifact.state === ArtifactState.READY) {
  const quizData = await sdk.artifacts.download(quiz.artifactId, './downloads')
  console.log(quizData.data.questions) // Array of questions with answers
}
```

### Flashcards

Flashcards support **80+ languages**. Use `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create flashcards in English (uses all sources)
const flashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Focus on terminology and definitions',
  // sourceIds omitted = uses all sources in notebook
  customization: {
    numberOfCards: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: NotebookLMLanguage.ENGLISH, // or 'en'
  },
})

// Create flashcards from specific sources
const flashcardsFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Focus on terminology from these sources',
  sourceIds: ['source-id-1'], // Only use this source
  customization: {
    numberOfCards: 3, // More cards
    difficulty: 2,
    language: NotebookLMLanguage.ENGLISH,
  },
})

// Create flashcards in Tamil (தமிழ்)
const tamilFlashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'சொற்களஞ்சியம் மற்றும் வரையறைகளில் கவனம் செலுத்துங்கள்',
  customization: {
    numberOfCards: 3, // More cards
    difficulty: 2,
    language: NotebookLMLanguage.TAMIL, // or 'ta'
  },
})

// Download flashcard data
const flashcardData = await sdk.artifacts.download(flashcards.artifactId, './downloads')
console.log(flashcardData.data.cards) // Array of { front, back } cards
```

### Study Guides

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create study guide (uses all sources)
const studyGuide = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  title: 'Exam Study Guide',
  instructions: 'Focus on key concepts, formulas, and important dates',
  // sourceIds omitted = uses all sources in notebook
})

// Create study guide from specific sources
const studyGuideFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  title: 'Chapters 1-3 Study Guide',
  instructions: 'Focus on chapters 1-3',
  sourceIds: ['source-id-1', 'source-id-2', 'source-id-3'], // Only these sources
})
```

### Mind Maps

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create mind map (requires sourceIds)
const mindMap = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  title: 'Concept Map',
  instructions: 'Focus on key concepts and their relationships',
  sourceIds: ['source-id-1', 'source-id-2'], // REQUIRED: Must specify sources
})
```

### Infographics

Infographics support **80+ languages**. Use `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create infographic in English (uses all sources)
const infographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visual summary of key data and statistics',
  // sourceIds omitted = uses all sources in notebook
  customization: {
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
    levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
  },
})

// Create infographic from specific sources
const infographicFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visual summary from these sources',
  sourceIds: ['source-id-1', 'source-id-2'], // Only these sources
  customization: {
    language: NotebookLMLanguage.ARABIC, // or 'ar'
    orientation: 2, // Portrait
    levelOfDetail: 3, // Detailed
  },
})
```

### Slide Decks

Slide decks support **80+ languages**. Use `NotebookLMLanguage` enum for type safety.

**⚠️ Important: Sources Required**
- You must add sources to your notebook before creating slide decks
- If you omit `sourceIds`, all sources in the notebook are used automatically
- If you provide `sourceIds`, only those specific sources are used

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Step 1: Add sources to your notebook first
const sourceId1 = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article1',
})
const sourceId2 = await sdk.sources.addFromText('notebook-id', {
  title: 'Research Notes',
  content: 'Key findings and insights...',
})
const sourceId3 = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article2',
})

// Step 2: Create slide deck using ALL sources (omit sourceIds)
const slideDeck = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Presentation',
  instructions: 'Create 10 slides covering main topics with visuals',
  // sourceIds omitted = uses ALL sources in notebook (sourceId1, sourceId2, sourceId3)
  customization: {
    format: 3, // 2=Presenter slides, 3=Detailed deck
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    length: 2, // 1=Short, 2=Default, 3=Long
  },
})

// Step 3: Create slide deck from SPECIFIC sources only
const slideDeckFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Focused Presentation',
  instructions: 'Create slides from these specific sources',
  sourceIds: [sourceId1, sourceId2], // Only use sourceId1 and sourceId2 (not sourceId3)
  customization: {
    format: 2, // Presenter slides
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    length: 3, // Long
  },
})

// Poll until ready, then download
let slideArtifact = slideDeck
while (slideArtifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  slideArtifact = await sdk.artifacts.get(slideDeck.artifactId)
}

// Download slide deck (saves as PDF)
if (slideArtifact.state === ArtifactState.READY) {
  const result = await sdk.artifacts.download(slideDeck.artifactId, './downloads')
  console.log(`Slide deck saved to: ${result.filePath}`)
}
```

### Reports

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create report (uses all sources)
const report = await sdk.artifacts.create('notebook-id', ArtifactType.DOCUMENT, {
  title: 'Research Report',
  instructions: 'Comprehensive report covering all key findings',
  // sourceIds omitted = uses all sources in notebook
})

// Create report from specific sources
const reportFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.DOCUMENT, {
  title: 'Chapter 1-3 Report',
  instructions: 'Report covering chapters 1-3',
  sourceIds: ['source-id-1', 'source-id-2', 'source-id-3'], // Only these sources
})
```

### Manage Artifacts

```typescript
// Get artifact details
const artifact = await sdk.artifacts.get('artifact-id')

// Rename artifact (works for all types)
await sdk.artifacts.rename('artifact-id', 'New Title')

// Delete artifact (works for all types)
await sdk.artifacts.delete('artifact-id')

// For audio artifacts, use notebook ID for get, delete, and download
await sdk.artifacts.get('notebook-id', 'notebook-id') // Get audio status
await sdk.artifacts.delete('notebook-id', 'notebook-id') // Delete audio
await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id') // Download audio

// Download artifact (works for all types)
// - Slide decks: Saves as PDF
// - Quizzes: Saves as JSON
// - Flashcards: Saves as CSV
// - Audio: Saves as MP3
// - Video: Saves as MP4
// - Mind maps, reports, study guides: Saves as JSON
// - Infographics: Saves as PNG or JSON
const result = await sdk.artifacts.download('artifact-id', './downloads')
console.log(`File saved to: ${result.filePath}`)
```

## Language Support

NotebookLM supports **80+ languages** for audio overviews, video overviews, and artifacts (quizzes, flashcards, slide decks, infographics). Use the `NotebookLMLanguage` enum for type safety, or pass ISO 639-1 language codes directly.

### Supported Languages

The SDK includes a comprehensive `NotebookLMLanguage` enum with 80+ supported languages:

```typescript
import { NotebookLMLanguage, getLanguageInfo, isLanguageSupported } from 'notebooklm-kit'

// Use enum for type safety
const language = NotebookLMLanguage.HINDI // 'hi'
const language2 = NotebookLMLanguage.FRENCH // 'fr'
const language3 = NotebookLMLanguage.JAPANESE // 'ja'

// Or use ISO 639-1 codes directly
const language4 = 'es' // Spanish
const language5 = 'de' // German

// Check if language is supported
if (isLanguageSupported('ta')) {
  console.log('Tamil is supported!')
}

// Get language information
const info = getLanguageInfo(NotebookLMLanguage.HINDI)
console.log(info.name) // 'Hindi'
console.log(info.nativeName) // 'हिन्दी'
```

### Language Support by Artifact Type

- **Audio Overviews**: 80+ languages supported
- **Video Overviews**: 80+ languages supported
- **Quizzes**: 80+ languages supported
- **Flashcards**: 80+ languages supported
- **Slide Decks**: 80+ languages supported
- **Infographics**: 80+ languages supported

## Error Handling

```typescript
import {
  NotebookLMError,
  NotebookLMAuthError,
  NotebookLMNetworkError,
  RateLimitError,
} from 'notebooklm-kit'

try {
  const notebooks = await sdk.notebooks.list()
} catch (error) {
  if (error instanceof NotebookLMAuthError) {
    console.error('Authentication failed - check your credentials')
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.message)
    console.error(`Used: ${error.used}/${error.limit}`)
  } else if (error instanceof NotebookLMNetworkError) {
    console.error('Network error:', error.message)
  } else if (error instanceof NotebookLMError) {
    console.error('API error:', error.message)
  } else {
    console.error('Unknown error:', error)
  }
}
```

## Advanced Usage

### Direct RPC Calls

For advanced use cases, you can make direct RPC calls:

```typescript
import { RPCMethods } from 'notebooklm-kit'

// Direct RPC call
const response = await sdk.rpc(
  RPCMethods.RPC_LIST_RECENTLY_VIEWED_PROJECTS,
  []
)

// Get RPC client for more control
const rpcClient = sdk.getRPCClient()
```

### Batch Operations

```typescript
// Batch add sources
const sourceIds = await sdk.sources.addBatch('notebook-id', {
  sources: [
    { type: 'url', url: 'https://example.com/1' },
    { type: 'url', url: 'https://example.com/2' },
    { type: 'text', title: 'Notes', content: '...' },
  ],
})
```

### Type Safety

All methods are fully typed with TypeScript:

```typescript
import type {
  Notebook,
  Source,
  Note,
  Artifact,
  AudioOverview,
  VideoOverview,
} from 'notebooklm-kit'

const notebook: Notebook = await sdk.notebooks.get('id')
const sources: Source[] = await sdk.sources.list('id')
const notes: Note[] = await sdk.notes.list('id')
const artifacts: Artifact[] = await sdk.artifacts.list('id')
```

## Client Structure

The NotebookLM client organizes all features into logical services:

```typescript
const sdk = new NotebookLMClient({ ... })

// Notebook operations
sdk.notebooks.list()
sdk.notebooks.create({ title: 'Research', emoji: '📚' })
sdk.notebooks.get('notebook-id')
sdk.notebooks.update('notebook-id', { title: 'New Title' })
sdk.notebooks.delete('notebook-id')

// Source operations
sdk.sources.addFromURL('notebook-id', { url: 'https://example.com' })
sdk.sources.addFromText('notebook-id', { title: 'Notes', content: '...' })
sdk.sources.addFromFile('notebook-id', { content: buffer, fileName: 'doc.pdf' })
sdk.sources.addYouTube('notebook-id', { urlOrId: 'video-id' })
sdk.sources.addGoogleDrive('notebook-id', { fileId: 'file-id' })
sdk.sources.searchWebAndWait('notebook-id', { query: 'AI research' })
sdk.sources.addBatch('notebook-id', { sources: [...] })

// Note operations
sdk.notes.list('notebook-id')
sdk.notes.create('notebook-id', { title: 'Note', content: '...' })
sdk.notes.update('notebook-id', 'note-id', { content: 'Updated' })
sdk.notes.delete('notebook-id', 'note-id')

// Generation operations
sdk.generation.chat('notebook-id', 'What are the key findings?')
sdk.generation.generateNotebookGuide('notebook-id')
sdk.generation.generateOutline('notebook-id')
sdk.generation.generateReportSuggestions('notebook-id')

// Artifact operations
sdk.artifacts.list('notebook-id')
sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, { instructions: '...' })
sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, { instructions: '...' })
sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, { instructions: '...' })
sdk.artifacts.download('artifact-id', './downloads')
sdk.artifacts.delete('artifact-id')

// Utility methods
sdk.getUsage()                    // Check quota usage
sdk.getRemaining('chats')          // Check remaining quota
sdk.refreshCredentials()           // Manually refresh session
sdk.dispose()                      // Clean up resources
```

## Requirements

- **Runtime:** Node.js >= 18.0.0
- **Credentials:** Valid NotebookLM auth token and cookies
- **Permissions:** Access to NotebookLM account

## License

MIT License

## Disclaimer

Unofficial SDK, not affiliated with Google. Use at your own risk.
