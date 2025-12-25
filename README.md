<div align="center">
   
# @photon-ai/NotebookLM-kit

> A TypeScript SDK for programmatic access to Google NotebookLM.

</div>

[![npm version](https://img.shields.io/npm/v/notebooklm-kit.svg)](https://www.npmjs.com/package/notebooklm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

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

// Create a notebook
const notebook = await sdk.notebooks.create({
  title: 'My Research',
  emoji: '📚',
})

// Add a source
await sdk.sources.addFromURL(notebook.projectId, {
  url: 'https://example.com/article',
})

// Chat with your notebook
const response = await sdk.generation.chat(
  notebook.projectId,
  'What are the key findings?'
)

console.log(response)

// Clean up
sdk.dispose()
```

### Configuration

```typescript
interface NotebookLMConfig {
  authToken: string              // Required: Auth token from NotebookLM
  cookies: string                 // Required: Session cookies
  debug?: boolean                 // Enable debug logging (default: false)
  autoRefresh?: boolean | {       // Keep session alive (default: true)
    enabled: boolean
    interval?: number             // Refresh interval in ms (default: 10 minutes)
    gsessionId?: string           // Optional: Google session ID
  }
  maxRetries?: number             // Retry attempts (default: 3)
  enforceQuotas?: boolean         // Enforce usage limits (default: true)
  headers?: Record<string, string> // Custom headers
  urlParams?: Record<string, string> // Custom URL params
}
```

## Authentication

### Quick Setup (Recommended)

1. Open https://notebooklm.google.com in your browser and log in
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Copy and paste the script from `extract-credentials.js`
5. Follow the instructions to add HttpOnly cookies if needed
6. Copy the output to your `.env` file

### Manual Setup

1. **Get Auth Token:**
   - Open DevTools Console on https://notebooklm.google.com
   - Run: `window.WIZ_global_data.SNlM0e`
   - Copy the value as `NOTEBOOKLM_AUTH_TOKEN`

2. **Get Cookies:**
   - Open DevTools → Application → Cookies → https://notebooklm.google.com
   - Find these cookies: `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`
   - Copy each as `Name=Value` and join with `; `
   - Set as `NOTEBOOKLM_COOKIES`

```bash
# .env file
NOTEBOOKLM_AUTH_TOKEN="your-token-here"
NOTEBOOKLM_COOKIES="SID=value; HSID=value; SSID=value; APISID=value; SAPISID=value; ..."
```

**Note:** HttpOnly cookies (HSID, SSID, SID, APISID) can only be copied from the Application tab, not from `document.cookie`.

## Features

| Feature | Method | Example |
|---------|---------|---------|
| Create Notebook | `sdk.notebooks.create()` | [Create Notebook](#notebooks) |
| List Notebooks | `sdk.notebooks.list()` | [List Notebooks](#notebooks) |
| Add URL Source | `sdk.sources.addFromURL()` | [Add Sources](#sources) |
| Add Text Source | `sdk.sources.addFromText()` | [Add Sources](#sources) |
| Add File Source | `sdk.sources.addFromFile()` | [Add Sources](#sources) |
| Add YouTube Source | `sdk.sources.addYouTube()` | [Add Sources](#sources) |
| Add Google Drive | `sdk.sources.addGoogleDrive()` | [Add Sources](#sources) |
| Web Search | `sdk.sources.searchWebAndWait()` | [Add Sources](#sources) |
| Batch Add Sources | `sdk.sources.addBatch()` | [Add Sources](#sources) |
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
| Auto-Refresh | `sdk.refreshCredentials()` | [Auto-Refresh](#auto-refresh) |
| Quota Management | `sdk.getUsage()` | [Quota Management](#quota-management) |

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

### List Artifacts

```typescript
// List all artifacts
const artifacts = await sdk.artifacts.list('notebook-id')

// Filter by type
const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ)
const readyArtifacts = artifacts.filter(a => a.state === ArtifactState.READY)
```

### Audio Overviews

```typescript
import { ArtifactType, ArtifactState, AudioLanguage } from 'notebooklm-kit'

// Create audio in English (default)
const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings and main conclusions',
})

// Create audio in Hindi (हिन्दी)
const hindiAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: AudioLanguage.HINDI,
    format: 0, // Deep dive
    length: 2, // Default
  },
  instructions: 'मुख्य निष्कर्षों पर ध्यान दें',
})

// Create with customization
const customAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: AudioLanguage.TAMIL,
    format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
    length: 3, // 1=Short, 2=Default, 3=Long
  },
  instructions: 'Focus on key findings and methodology',
})

// Get audio status (use notebook ID for audio artifacts)
const audioStatus = await sdk.artifacts.get('notebook-id', 'notebook-id')

// Download audio (when ready)
if (audioStatus.state === ArtifactState.READY) {
  const audioData = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
  console.log(`Audio saved to: ${audioData.filePath}`)
}

// Supported languages: Hindi, Bengali, Gujarati, Kannada, Malayalam, 
// Marathi, Punjabi, Tamil, Telugu, English
```

### Video Overviews

```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Create video overview
const video = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video overview with key highlights',
  sourceIds: ['source-id-1', 'source-id-2'], // Required: specify sources
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: 'en',
    visualStyle: 0, // 0=Auto, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime
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

```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Create quiz
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create 10 multiple choice questions covering key concepts',
  customization: {
    numberOfQuestions: 3, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: 'en',
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

```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Create flashcards
const flashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Focus on terminology and definitions',
  customization: {
    numberOfCards: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: 'en',
  },
})

// Download flashcard data
const flashcardData = await sdk.artifacts.download(flashcards.artifactId, './downloads')
console.log(flashcardData.data.cards) // Array of { front, back } cards
```

### Study Guides

```typescript
import { ArtifactType } from 'notebooklm-kit'

const studyGuide = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  title: 'Exam Study Guide',
  instructions: 'Focus on key concepts, formulas, and important dates',
})
```

### Mind Maps

```typescript
import { ArtifactType } from 'notebooklm-kit'

const mindMap = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  title: 'Concept Map',
})
```

### Infographics

```typescript
import { ArtifactType } from 'notebooklm-kit'

const infographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visual summary of key data and statistics',
  customization: {
    language: 'en',
    orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
    levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
  },
})
```

### Slide Decks

```typescript
import { ArtifactType } from 'notebooklm-kit'

const slideDeck = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Presentation',
  instructions: 'Create 10 slides covering main topics with visuals',
  customization: {
    format: 3, // 2=Presenter slides, 3=Detailed deck
    language: 'en',
    length: 2, // 1=Short, 2=Default, 3=Long
  },
})
```

### Reports

```typescript
import { ArtifactType } from 'notebooklm-kit'

const report = await sdk.artifacts.create('notebook-id', ArtifactType.DOCUMENT, {
  title: 'Research Report',
  instructions: 'Comprehensive report covering all key findings',
})
```

### Manage Artifacts

```typescript
// Get artifact details
const artifact = await sdk.artifacts.get('artifact-id')

// Rename artifact
await sdk.artifacts.rename('artifact-id', 'New Title')

// Delete artifact
await sdk.artifacts.delete('artifact-id')

// For audio artifacts, use notebook ID
await sdk.artifacts.delete('notebook-id', 'notebook-id')
```

## Auto-Refresh

Keep your session alive automatically. The SDK can refresh your credentials periodically to prevent session expiration.

### Basic Auto-Refresh

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: true, // Enabled by default, refreshes every 10 minutes
})
```

### Configure Auto-Refresh

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // Refresh every 5 minutes
    gsessionId: 'optional-gsession-id', // Optional: if you have it
  },
})
```

### Manual Refresh

```typescript
// Manually refresh credentials
await sdk.refreshCredentials()

// Get refresh manager
const refreshManager = sdk.getRefreshManager()
if (refreshManager) {
  await refreshManager.refresh()
}
```

### Disable Auto-Refresh

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: false, // Disable auto-refresh
})
```

## Quota Management

The SDK automatically enforces NotebookLM's usage limits to prevent API errors. You can check your usage and customize quota behavior.

### View Limits

```typescript
import { NOTEBOOKLM_LIMITS } from 'notebooklm-kit'

console.log('NotebookLM Limits:', NOTEBOOKLM_LIMITS)
// {
//   MAX_NOTEBOOKS: 100,
//   MAX_SOURCES_PER_NOTEBOOK: 50,
//   MAX_WORDS_PER_SOURCE: 500000,
//   MAX_FILE_SIZE_MB: 200,
//   CHATS_PER_DAY: 50,
//   AUDIO_OVERVIEWS_PER_DAY: 3,
//   VIDEO_OVERVIEWS_PER_DAY: 3,
//   REPORTS_PER_DAY: 10,
//   FLASHCARDS_PER_DAY: 10,
//   QUIZZES_PER_DAY: 10,
//   DEEP_RESEARCH_PER_MONTH: 10,
// }
```

### Check Usage

```typescript
// Get current usage
const usage = sdk.getUsage()

console.log(`Chats: ${usage.daily.chats}/${NOTEBOOKLM_LIMITS.CHATS_PER_DAY}`)
console.log(`Audio: ${usage.daily.audioOverviews}/${NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY}`)
console.log(`Video: ${usage.daily.videoOverviews}/${NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY}`)
console.log(`Reports: ${usage.daily.reports}/${NOTEBOOKLM_LIMITS.REPORTS_PER_DAY}`)
console.log(`Flashcards: ${usage.daily.flashcards}/${NOTEBOOKLM_LIMITS.FLASHCARDS_PER_DAY}`)
console.log(`Quizzes: ${usage.daily.quizzes}/${NOTEBOOKLM_LIMITS.QUIZZES_PER_DAY}`)
console.log(`Notebooks: ${usage.notebooks.total}/${NOTEBOOKLM_LIMITS.MAX_NOTEBOOKS}`)
```

### Check Remaining Quota

```typescript
// Get remaining quota for a resource
const remainingChats = sdk.getRemaining('chats')
const remainingAudio = sdk.getRemaining('audioOverviews')
const remainingVideo = sdk.getRemaining('videoOverviews')

console.log(`${remainingChats} chats remaining today`)
console.log(`${remainingAudio} audio overviews remaining today`)
```

### Customize Quota Behavior

```typescript
// Disable quota enforcement (not recommended)
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  enforceQuotas: false, // Disable client-side quota checks
})

// Get quota manager for advanced usage
const quotaManager = sdk.getQuotaManager()

// Reset usage (for testing)
quotaManager.resetUsage()
```

### Quota Error Handling

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

## API Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `sdk.notebooks.list()` | List all notebooks |
| `sdk.notebooks.get(id)` | Get notebook by ID |
| `sdk.notebooks.create(options)` | Create new notebook |
| `sdk.notebooks.update(id, options)` | Update notebook |
| `sdk.notebooks.delete(id)` | Delete notebook |
| `sdk.sources.addFromURL(id, options)` | Add source from URL |
| `sdk.sources.addFromText(id, options)` | Add source from text |
| `sdk.sources.addFromFile(id, options)` | Add source from file |
| `sdk.sources.addYouTube(id, options)` | Add YouTube video |
| `sdk.sources.addGoogleDrive(id, options)` | Add Google Drive file |
| `sdk.sources.searchWeb(id, options)` | Search web/Drive |
| `sdk.sources.searchWebAndWait(id, options)` | Search and wait for results |
| `sdk.sources.addDiscovered(id, options)` | Add discovered sources |
| `sdk.sources.addBatch(id, options)` | Batch add sources |
| `sdk.sources.pollProcessing(id)` | Check source processing status |
| `sdk.sources.delete(id, sourceId)` | Delete source |
| `sdk.notes.list(id)` | List notes |
| `sdk.notes.create(id, options)` | Create note |
| `sdk.notes.update(id, noteId, options)` | Update note |
| `sdk.notes.delete(id, noteId)` | Delete note |
| `sdk.generation.chat(id, prompt, sourceIds?)` | Chat with notebook |
| `sdk.generation.generateDocumentGuides(id)` | Generate document guides |
| `sdk.generation.generateNotebookGuide(id)` | Generate notebook guide |
| `sdk.generation.generateOutline(id)` | Generate outline |
| `sdk.generation.generateReportSuggestions(id)` | Generate report suggestions |
| `sdk.generation.generateMagicView(id, sourceIds)` | Generate magic view |
| `sdk.artifacts.list(id)` | List artifacts |
| `sdk.artifacts.get(id, notebookId?)` | Get artifact |
| `sdk.artifacts.create(id, ArtifactType.AUDIO, options)` | Create audio overview |
| `sdk.artifacts.create(id, ArtifactType.VIDEO, options)` | Create video overview |
| `sdk.artifacts.create(id, ArtifactType.QUIZ, options)` | Create quiz |
| `sdk.artifacts.create(id, ArtifactType.FLASHCARDS, options)` | Create flashcards |
| `sdk.artifacts.create(id, ArtifactType.STUDY_GUIDE, options)` | Create study guide |
| `sdk.artifacts.create(id, ArtifactType.MIND_MAP, options)` | Create mind map |
| `sdk.artifacts.create(id, ArtifactType.INFOGRAPHIC, options)` | Create infographic |
| `sdk.artifacts.create(id, ArtifactType.SLIDE_DECK, options)` | Create slide deck |
| `sdk.artifacts.create(id, ArtifactType.DOCUMENT, options)` | Create report/document |
| `sdk.artifacts.download(id, folderPath, notebookId?)` | Download artifact |
| `sdk.artifacts.rename(id, title)` | Rename artifact |
| `sdk.artifacts.delete(id, notebookId?)` | Delete artifact |
| `sdk.getUsage()` | Get usage statistics |
| `sdk.getRemaining(resource)` | Get remaining quota |
| `sdk.refreshCredentials()` | Manually refresh credentials |
| `sdk.dispose()` | Clean up and stop auto-refresh |

## Requirements

- **Runtime:** Node.js >= 18.0.0
- **Credentials:** Valid NotebookLM auth token and cookies
- **Permissions:** Access to NotebookLM account

## License

MIT License

## Disclaimer

Unofficial SDK, not affiliated with Google. Use at your own risk.
