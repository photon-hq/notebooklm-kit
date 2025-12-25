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

// Create client with auto-refresh enabled (default: 10-minute interval)
// Credentials are refreshed immediately on initialization, then every 10 minutes
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  // autoRefresh: true is the default - keeps session alive automatically
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

// Clean up (stops auto-refresh)
sdk.dispose()
```

### Configuration

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

**Auto-Refresh Details:**

The SDK automatically keeps your session alive by refreshing credentials periodically. This prevents session expiration during long-running operations.

- **Default:** Auto-refresh is enabled with a 10-minute interval (600,000 ms)
- **Initial refresh:** Credentials are refreshed immediately when the client is created
- **Background refresh:** Subsequent refreshes happen automatically at the configured interval
- **Recommended intervals:** 5-10 minutes (300,000 - 600,000 ms)
- **Disable:** Set `autoRefresh: false` to disable automatic refresh

```typescript
// Default: Auto-refresh enabled, 10-minute interval
const sdk = new NotebookLMClient({
  authToken: '...',
  cookies: '...',
})

// Custom 5-minute interval
const sdk = new NotebookLMClient({
  authToken: '...',
  cookies: '...',
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes
  },
})

// Disable auto-refresh
const sdk = new NotebookLMClient({
  authToken: '...',
  cookies: '...',
  autoRefresh: false,
})
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

## Quick Reference

**Common Workflows:**

```typescript
// 1. Create notebook and add sources
const notebook = await sdk.notebooks.create({ title: 'Research', emoji: '📚' })
await sdk.sources.addFromURL(notebook.projectId, { url: 'https://example.com' })

// 2. Chat with notebook
const response = await sdk.generation.chat(notebook.projectId, 'Summarize this')

// 3. Create artifacts
const quiz = await sdk.artifacts.create(notebook.projectId, ArtifactType.QUIZ, {
  instructions: 'Create 10 questions',
})

// 4. Check quota
const usage = sdk.getUsage()
console.log(`Chats used: ${usage.daily.chats}/50`)

// 5. Clean up
sdk.dispose()
```

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
- **Your notebook must have at least one source** before creating artifacts
- If you don't specify `sourceIds`, **all sources in the notebook** are used automatically
- If you provide `sourceIds`, **only those specific sources** are used
- **Video artifacts specifically require sources** - always provide `sourceIds` for videos
- **Audio artifacts** automatically use all sources (you don't need to specify `sourceIds`)

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

// Create audio in English (default)
// Note: Audio automatically uses ALL sources in the notebook - no need to specify sourceIds
const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings and main conclusions',
  // sourceIds is not needed for audio - all sources are used automatically
})

// Create audio in Hindi (हिन्दी) using enum
const hindiAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.HINDI, // or 'hi'
    format: 0, // Deep dive
    length: 2, // Default
  },
  instructions: 'मुख्य निष्कर्षों पर ध्यान दें',
})

// Create audio in French (Français)
const frenchAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
    length: 3, // 1=Short, 2=Default, 3=Long
  },
  instructions: 'Focus on key findings and methodology',
})

// Create audio in Japanese (日本語)
const japaneseAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.JAPANESE, // or 'ja'
    format: 1, // Brief
    length: 2, // Default
  },
})

// Get audio status (use notebook ID for audio artifacts)
const audioStatus = await sdk.artifacts.get('notebook-id', 'notebook-id')

// Download audio (when ready)
if (audioStatus.state === ArtifactState.READY) {
  const audioData = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
  console.log(`Audio saved to: ${audioData.filePath}`)
}

// Supported languages include: English, Spanish, French, German, Italian, Portuguese,
// Russian, Japanese, Korean, Chinese, Hindi, Bengali, Tamil, Telugu, Gujarati, Kannada,
// Malayalam, Marathi, Punjabi, Arabic, Turkish, Thai, Vietnamese, Indonesian, Malay,
// and 60+ more languages. See NotebookLMLanguage enum for complete list.
```

### Video Overviews

NotebookLM supports **80+ languages** for video overviews. Use the `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create video overview in English (sources are required for video)
const video = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video overview with key highlights',
  sourceIds: ['source-id-1', 'source-id-2'], // Required: video artifacts need sources
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    visualStyle: 0, // 0=Auto, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime
  },
})

// Create video in Spanish (Español)
const spanishVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Crear un resumen de video atractivo',
  sourceIds: ['source-id-1'],
  customization: {
    format: 1,
    language: NotebookLMLanguage.SPANISH, // or 'es'
    visualStyle: 2, // Classic
  },
})

// Create video in German (Deutsch)
const germanVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Erstellen Sie eine ansprechende Videoübersicht',
  sourceIds: ['source-id-1'],
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

// Create quiz in Chinese (简体中文)
const chineseQuiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: '第一章测验',
  instructions: '创建10个涵盖关键概念的多项选择题',
  customization: {
    numberOfQuestions: 2, // Standard
    difficulty: 2, // Medium
    language: NotebookLMLanguage.CHINESE_SIMPLIFIED, // or 'zh'
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

// Create flashcards in Spanish (Español)
const spanishFlashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Enfócate en terminología y definiciones',
  customization: {
    numberOfCards: 2,
    difficulty: 1, // Easy
    language: NotebookLMLanguage.SPANISH, // or 'es'
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

// Create mind map (uses all sources)
const mindMap = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  title: 'Concept Map',
  // sourceIds omitted = uses all sources in notebook
})

// Create mind map from specific sources
const mindMapFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  title: 'Concept Map',
  sourceIds: ['source-id-1', 'source-id-2'], // Only these sources
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

// Create infographic in Arabic (العربية)
const arabicInfographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'ملخص مرئي للبيانات والإحصائيات الرئيسية',
  customization: {
    language: NotebookLMLanguage.ARABIC, // or 'ar'
    orientation: 2, // Portrait
    levelOfDetail: 3, // Detailed
  },
})
```

### Slide Decks

Slide decks support **80+ languages**. Use `NotebookLMLanguage` enum for type safety.

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create slide deck in English (uses all sources)
const slideDeck = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Presentation',
  instructions: 'Create 10 slides covering main topics with visuals',
  // sourceIds omitted = uses all sources in notebook
  customization: {
    format: 3, // 2=Presenter slides, 3=Detailed deck
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    length: 2, // 1=Short, 2=Default, 3=Long
  },
})

// Create slide deck from specific sources
const slideDeckFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Presentation',
  instructions: 'Create slides from these sources',
  sourceIds: ['source-id-1', 'source-id-2'], // Only these sources
  customization: {
    format: 2, // Presenter slides
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    length: 3, // Long
  },
})
```

// Create slide deck in French (Français)
const frenchSlides = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Présentation',
  instructions: 'Créer 10 diapositives couvrant les principaux sujets avec des visuels',
  customization: {
    format: 2, // Presenter slides
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    length: 3, // Long
  },
})
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

// Rename artifact
await sdk.artifacts.rename('artifact-id', 'New Title')

// Delete artifact
await sdk.artifacts.delete('artifact-id')

// For audio artifacts, use notebook ID
await sdk.artifacts.delete('notebook-id', 'notebook-id')
```

## Auto-Refresh

Keep your session alive automatically. The SDK automatically refreshes your credentials periodically to prevent session expiration during long-running operations.

### How It Works

When you create a `NotebookLMClient`, auto-refresh is enabled by default:

1. **Initial refresh:** Credentials are refreshed immediately when the client is initialized
2. **Background refresh:** Subsequent refreshes happen automatically at the configured interval
3. **Default interval:** 10 minutes (600,000 ms)
4. **Automatic cleanup:** Call `sdk.dispose()` to stop auto-refresh when done

### Basic Auto-Refresh (Default)

```typescript
// Auto-refresh is enabled by default with 10-minute interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  // No need to specify autoRefresh - it's enabled by default
})

// Credentials are refreshed:
// - Immediately on initialization
// - Every 10 minutes automatically
```

### Configure Refresh Interval

```typescript
// Custom 5-minute interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes (300,000 ms)
  },
})

// Custom 15-minute interval
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

### Common Languages

```typescript
import { COMMON_LANGUAGES, NotebookLMLanguage } from 'notebooklm-kit'

// Quick access to common languages
const languages = {
  english: COMMON_LANGUAGES.ENGLISH,      // 'en'
  spanish: COMMON_LANGUAGES.SPANISH,      // 'es'
  french: COMMON_LANGUAGES.FRENCH,        // 'fr'
  german: COMMON_LANGUAGES.GERMAN,        // 'de'
  hindi: COMMON_LANGUAGES.HINDI,          // 'hi'
  chinese: COMMON_LANGUAGES.CHINESE,      // 'zh'
  japanese: COMMON_LANGUAGES.JAPANESE,    // 'ja'
  korean: COMMON_LANGUAGES.KOREAN,        // 'ko'
  arabic: COMMON_LANGUAGES.ARABIC,         // 'ar'
  // ... and more
}
```

### Language Support by Artifact Type

- **Audio Overviews**: 80+ languages supported
- **Video Overviews**: 80+ languages supported
- **Quizzes**: 80+ languages supported
- **Flashcards**: 80+ languages supported
- **Slide Decks**: 80+ languages supported
- **Infographics**: 80+ languages supported

### Example: Multi-Language Artifacts

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create artifacts in different languages
const englishQuiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  customization: { language: NotebookLMLanguage.ENGLISH }
})

const hindiAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: { language: NotebookLMLanguage.HINDI }
})

const spanishVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  customization: { language: NotebookLMLanguage.SPANISH }
})

const frenchFlashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  customization: { language: NotebookLMLanguage.FRENCH }
})
```

### Complete Language List

The `NotebookLMLanguage` enum includes languages from:
- **Major World Languages**: English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese
- **Indian Languages**: Hindi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Urdu, and more
- **Middle Eastern Languages**: Arabic, Hebrew, Persian, Turkish, and more
- **Southeast Asian Languages**: Thai, Vietnamese, Indonesian, Malay, Tagalog, and more
- **European Languages**: Polish, Dutch, Swedish, Danish, Finnish, Norwegian, Czech, Slovak, Hungarian, Romanian, and more
- **African Languages**: Swahili, Zulu, Afrikaans, Yoruba, Igbo, Hausa, and more

See the `NotebookLMLanguage` enum in the SDK for the complete list of 80+ supported languages.

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
