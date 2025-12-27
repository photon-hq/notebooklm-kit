<div align="center">
   
# @photon-ai/NotebookLM-kit

> A TypeScript SDK for programmatic access to Google NotebookLM.

</div>

[![npm version](https://img.shields.io/npm/v/notebooklm-kit.svg)](https://www.npmjs.com/package/notebooklm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

</div>

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Features](#features)
- [Authentication](#authentication)
- [API Reference](#api-reference)
  - [Notebooks](#notebooks)
  - [Sources](#sources)
  - [Artifacts](#artifacts)
  - [Generation & Chat](#generation--chat)
  - [Notes](#notes)
- [Language Support](#language-support)
- [Quota Management](#quota-management)
- [Testing Status](#testing-status)
- [Known Issues](#known-issues)
- [Examples](#examples)
- [License](#license)

## Overview

The NotebookLM Kit provides a clean, service-based interface to all NotebookLM features:

| Service | Purpose | Methods |
|---------|---------|---------|
| **`sdk.notebooks`** | Notebook management | `list()`, `create()`, `get()`, `update()`, `delete()` |
| **`sdk.sources`** | Add & manage sources | `addFromURL()`, `addFromText()`, `addFromFile()`, `addYouTube()`, `searchWebAndWait()` |
| **`sdk.artifacts`** | Generate study materials | `create()`, `list()`, `get()`, `download()`, `delete()`, `rename()` |
| **`sdk.generation`** | Chat & content generation | `chat()`, `generateDocumentGuides()`, `generateOutline()` |
| **`sdk.notes`** | Manage notes | `create()`, `list()`, `update()`, `delete()` |

**Supported Artifact Types:**
- ✅ **Quiz** - Multiple choice questions with explanations
- ✅ **Flashcards** - Q&A cards for memorization
- ✅ **Study Guide** - Comprehensive study documents
- ✅ **Mind Map** - Visual concept mapping
- ✅ **Infographic** - Visual data summaries
- ✅ **Slide Deck** - Presentation slides (PDF export)
- ⚠️ **Audio Overview** - Podcast-style audio (*see [Known Issues](#known-issues)*)
- ⚠️ **Video Overview** - Video summaries (*see [Known Issues](#known-issues)*)
- ✅ **Report/Document** - Detailed reports

## Quick Start

### Installation

```bash
npm install notebooklm-kit
```

### Basic Example

```typescript
import { NotebookLMClient, ArtifactType, ArtifactState } from 'notebooklm-kit'

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
})

// Create a notebook
const notebook = await sdk.notebooks.create({
  title: 'AI Research',
  emoji: '🤖',
})

// Add sources
await sdk.sources.addFromURL(notebook.projectId, {
  url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
})

await sdk.sources.addFromText(notebook.projectId, {
  title: 'My Notes',
  content: 'Key findings from my research...',
})

// Wait for sources to process
const status = await sdk.sources.pollProcessing(notebook.projectId)
console.log(`${status.readyCount}/${status.totalCount} sources ready`)

// Create a quiz
const quiz = await sdk.artifacts.create(notebook.projectId, ArtifactType.QUIZ, {
  instructions: 'Create questions about AI fundamentals',
  customization: {
    numberOfQuestions: 2, // Standard
    difficulty: 2, // Medium
    language: 'en',
  },
})

// Wait for quiz to be ready
let artifact = quiz
while (artifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  artifact = await sdk.artifacts.get(quiz.artifactId)
}

// Download quiz
if (artifact.state === ArtifactState.READY) {
  const quizData = await sdk.artifacts.download(quiz.artifactId, './downloads')
  console.log('Quiz questions:', quizData.data.questions)
}

sdk.dispose()
```

## Features

### ✅ Fully Tested & Supported
- **Notebooks**: Create, list, get, update, delete
- **Sources**: URL, text, file (PDF), YouTube, Google Drive, web search
- **Quiz**: Create, download, rename, delete
- **Flashcards**: Create, download (CSV), rename, delete
- **Mind Map**: Create, download (JSON), rename, delete
- **Study Guide**: Create with specific sources
- **Notes**: Create, list, update, delete
- **Chat**: Interactive chat with notebook content

### ⚠️ Tested with Known Issues
- **Audio Overview**: Creation works but may fail due to Google rate limiting
- **Video Overview**: Creation works but may fail due to Google rate limiting
- **Slide Deck**: Creation works but may fail during high traffic
- **Infographic**: Creation works but may fail due to quota limits

### 🚧 Experimental / Needs Testing
- **Report/Document**: Basic functionality works, download needs testing
- **Batch operations**: Partial testing completed

## Authentication

### Getting Credentials

You need two pieces of information from your NotebookLM session:

#### 1. Get Auth Token (`NOTEBOOKLM_AUTH_TOKEN`)

1. Open https://notebooklm.google.com in your browser and log in
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Run: `window.WIZ_global_data.SNlM0e`
5. Copy the returned value - this is your auth token

#### 2. Get Cookies (`NOTEBOOKLM_COOKIES`)

1. In the same browser session, open Developer Tools
2. Go to **Network** tab
3. Refresh the page or navigate in NotebookLM
4. Find any request to `notebooklm.google.com` in the Network tab
5. Click on the request → Go to **Headers** section
6. Find the **Cookie** header under "Request Headers"
7. Copy the **entire Cookie value** (it's a very long string)

### Setup `.env` File

Create a `.env` file in your project root:

```bash
# .env
NOTEBOOKLM_AUTH_TOKEN="ACi2F2NZSD7yrNvFMrCkP3vZJY1R:1766720233448"
NOTEBOOKLM_COOKIES="_ga=GA1.1.1949425436.1764104083; SID=g.a0005AiwX...; __Secure-1PSID=g.a0005AiwX...; APISID=2-7oUEYiopHvktji/Adx9rNhzIF8Oe-MPI; SAPISID=eMePV31yEdEOSnUq/AFdcsHac_J0t3DMBT; ..."
```

**⚠️ Important Notes:**
- Both credentials are required
- Credentials expire after some time - refresh them when you see 401 errors
- Copy the entire Cookie value exactly as it appears (already properly formatted)
- The SDK automatically refreshes credentials every 10 minutes by default

### Auto-Refresh

Auto-refresh keeps your session alive automatically:

```typescript
// Default: enabled with 10-minute interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  // autoRefresh: true (default)
})

// Custom interval
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes
  },
})

// Disable auto-refresh
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  autoRefresh: false,
})

// Manual refresh
await sdk.refreshCredentials()
```

## API Reference

### Notebooks

```typescript
// List all notebooks
const notebooks = await sdk.notebooks.list()

// Create notebook
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
  emoji: '📚',
})

// Get specific notebook
const notebook = await sdk.notebooks.get('notebook-id')

// Update notebook
await sdk.notebooks.update('notebook-id', {
  title: 'Updated Title',
  emoji: '🔬',
})

// Delete notebook
await sdk.notebooks.delete('notebook-id')
```

### Sources

#### Add from URL

```typescript
// Regular URL
const sourceId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article',
})

// YouTube URL (auto-detected)
const ytSource = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

**⚠️ URL Limitations:**
- Only visible text on the website is imported
- Paid articles are NOT supported
- For YouTube: Only public videos are supported
- Recently uploaded YouTube videos may not be available immediately

#### Add from Text

```typescript
const sourceId = await sdk.sources.addFromText('notebook-id', {
  title: 'Research Notes',
  content: 'Your text content here...',
})
```

#### Add from File

```typescript
import { readFile } from 'fs/promises'

// PDF file
const buffer = await readFile('./document.pdf')
const sourceId = await sdk.sources.addFromFile('notebook-id', {
  content: buffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
})
```

**⚠️ File Upload Limitations:**
- Max file size: 200 MB
- If upload fails, check common reasons (file size, format compatibility)

#### Add YouTube Video

```typescript
// From URL
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})

// From video ID
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'dQw4w9WgXcQ',
})
```

**⚠️ YouTube Limitations:**
- Only the text transcript is imported
- Only public videos are supported
- Recently uploaded videos may not be available to import

#### Web Search & Add Sources

```typescript
import { SearchSourceType, ResearchMode } from 'notebooklm-kit'

// Search web and wait for results
const result = await sdk.sources.searchWebAndWait('notebook-id', {
  query: 'machine learning trends 2024',
  sourceType: SearchSourceType.WEB,
  mode: ResearchMode.STANDARD, // or ResearchMode.DEEP
})

console.log(`Found ${result.sources.length} sources`)

// Add selected sources
const sourceIds = await sdk.sources.addDiscovered('notebook-id', {
  sessionId: result.sessionId,
  sourceIds: result.sources.slice(0, 5).map(s => s.sourceId),
})

// Search Google Drive
const driveResult = await sdk.sources.searchWebAndWait('notebook-id', {
  query: 'research paper',
  sourceType: SearchSourceType.GOOGLE_DRIVE,
  mode: ResearchMode.STANDARD,
})
```

#### Batch Add Sources

```typescript
// Add multiple sources at once
const sourceIds = await sdk.sources.addBatch('notebook-id', {
  sources: [
    { type: 'url', url: 'https://example.com/article1' },
    { type: 'url', url: 'https://example.com/article2' },
    { type: 'text', title: 'Notes', content: 'Content...' },
    { type: 'youtube', urlOrId: 'dQw4w9WgXcQ' },
  ],
})
```

#### Check Source Processing

```typescript
// Check if sources are ready
const status = await sdk.sources.pollProcessing('notebook-id')

console.log(`Ready: ${status.readyCount}/${status.totalCount}`)
console.log(`Processing: ${status.processingCount}`)
console.log(`Failed: ${status.failedCount}`)

// Wait for all sources
while (!status.allReady) {
  await new Promise(r => setTimeout(r, 2000))
  const newStatus = await sdk.sources.pollProcessing('notebook-id')
  if (newStatus.allReady) break
}
```

### Artifacts

Create study materials, quizzes, flashcards, audio, video, and more from your notebook sources.

#### Create Quiz

```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Create quiz (uses all sources in notebook)
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  instructions: 'Create questions covering key concepts',
  customization: {
    numberOfQuestions: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: 'en',
  },
})

// Create quiz from specific sources only
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  instructions: 'Create questions from these sources',
  sourceIds: ['source-id-1', 'source-id-2'], // Only use these sources
  customization: {
    numberOfQuestions: 3,
    difficulty: 3,
    language: 'hi', // Hindi
  },
})

// Wait for quiz to be ready
let artifact = quiz
while (artifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  artifact = await sdk.artifacts.get(quiz.artifactId)
}

// Download quiz data
if (artifact.state === ArtifactState.READY) {
  const quizData = await sdk.artifacts.download(quiz.artifactId, './downloads')
  console.log('Questions:', quizData.data.questions)
  // Questions include: question text, options, correct answer, explanation
}
```

#### Create Flashcards

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create flashcards (uses all sources)
const flashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Focus on terminology and definitions',
  customization: {
    numberOfCards: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: 'en',
  },
})

// Create flashcards from specific sources
const flashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Create flashcards for key terms',
  sourceIds: ['source-id-1'],
  customization: {
    numberOfCards: 3, // More cards
    difficulty: 1, // Easy
    language: 'es', // Spanish
  },
})

// Download flashcards (CSV format)
const flashcardData = await sdk.artifacts.download(flashcards.artifactId, './downloads')
console.log('Flashcards saved as CSV:', flashcardData.filePath)
```

#### Create Mind Map

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create mind map (requires sourceIds)
const mindMap = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  instructions: 'Map out the main concepts and their relationships',
  sourceIds: ['source-id-1', 'source-id-2'], // Required
})

// Mind maps are usually ready immediately
if (mindMap.state === ArtifactState.READY) {
  const data = await sdk.artifacts.download(mindMap.artifactId, './downloads')
  console.log('Mind map data:', data.mindMapData)
}
```

#### Create Study Guide

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create study guide (uses all sources)
const guide = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  instructions: 'Comprehensive study guide covering all topics',
})

// From specific sources
const guide = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  instructions: 'Study guide for chapters 1-3',
  sourceIds: ['source-id-1', 'source-id-2', 'source-id-3'],
})
```

#### Create Slide Deck

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create presentation slides (uses all sources)
const slides = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  instructions: 'Create a 10-slide presentation',
  customization: {
    format: 2, // 2=Presenter slides, 3=Detailed deck
    length: 2, // 1=Short, 2=Default, 3=Long
    language: 'en',
  },
})

// From specific sources
const slides = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  instructions: 'Presentation covering main findings',
  sourceIds: ['source-id-1', 'source-id-2'],
  customization: {
    format: 3, // Detailed deck
    length: 3, // Long
    language: NotebookLMLanguage.FRENCH,
  },
})

// Download slides (PDF)
const slideData = await sdk.artifacts.download(slides.artifactId, './downloads')
console.log('Slides saved as PDF:', slideData.filePath)
```

#### Create Infographic

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create infographic (uses all sources)
const infographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visualize key statistics and data',
  customization: {
    orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
    levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
    language: 'en',
  },
})

// From specific sources
const infographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visualize data from financial reports',
  sourceIds: ['source-id-1'],
  customization: {
    orientation: 2, // Portrait
    levelOfDetail: 3, // Detailed
    language: 'ja', // Japanese
  },
})
```

#### Create Audio Overview ⚠️

**⚠️ Known Issue**: Audio creation may fail with "Service unavailable" errors due to Google's rate limiting and anti-automation measures. This is NOT a bug in the SDK - Google actively blocks automated audio/video creation requests while allowing manual UI creation. 

**If audio creation fails:**
- Try again after 15-30 minutes
- Or create audio manually in the NotebookLM UI
- The SDK code is correct, the issue is Google's API blocking automated requests

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create audio overview - Deep dive format (uses all sources)
const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on main conclusions and methodology',
  sourceIds: ['source-id-1', 'source-id-2'], // Recommended: specify sources
  customization: {
    format: 0, // 0=Deep dive, 1=Brief, 2=Critique, 3=Debate
    length: 2, // 1=Short, 2=Default, 3=Long (only for Deep dive)
    language: 'en',
  },
})

// Brief format (no length option)
const briefAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  sourceIds: ['source-id-1'],
  customization: {
    format: 1, // Brief
    language: 'hi', // Hindi
  },
})

// Critique format
const critiqueAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  sourceIds: ['source-id-1', 'source-id-2'],
  customization: {
    format: 2, // Critique
    length: 1, // Short (Critique supports: 1=Short, 2=Default)
    language: 'en',
  },
})

// Debate format
const debateAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  sourceIds: ['source-id-1'],
  customization: {
    format: 3, // Debate
    length: 2, // Default (Debate supports: 1=Short, 2=Default)
    language: 'en',
  },
})

// Download audio (use notebook ID, not artifact ID)
const audioData = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
console.log('Audio saved as MP3:', audioData.filePath)
```

#### Create Video Overview ⚠️

**⚠️ Known Issue**: Video creation may fail with "Service unavailable" errors due to Google's rate limiting and anti-automation measures. This is NOT a bug in the SDK - Google actively blocks automated audio/video creation requests while allowing manual UI creation.

**If video creation fails:**
- Try again after 15-30 minutes
- Or create video manually in the NotebookLM UI
- The SDK code is correct, the issue is Google's API blocking automated requests

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create video overview (uses all sources)
const video = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video summary',
  sourceIds: ['source-id-1', 'source-id-2'], // Recommended: specify sources
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: 'en',
    visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, etc.
  },
})

// Video with custom visual style
const customVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create a professional video',
  sourceIds: ['source-id-1'],
  customization: {
    format: 2, // Brief
    language: 'en',
    visualStyle: 1, // Custom
    customStyleDescription: 'Modern corporate style with clean graphics',
    focus: 'Focus on key statistics and trends',
  },
})

// Video with predefined style
const animeVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  sourceIds: ['source-id-1'],
  customization: {
    format: 1,
    language: 'ja',
    visualStyle: 5, // Anime
  },
})

// Download video (when ready)
const videoData = await sdk.artifacts.download(video.artifactId, './downloads')
console.log('Video saved as MP4:', videoData.filePath)
```

**Available Visual Styles:**
- `0` = Auto-select
- `1` = Custom (requires `customStyleDescription`)
- `2` = Classic
- `3` = Whiteboard
- `4` = Kawaii
- `5` = Anime
- `6` = Watercolour
- `7` = Anime (alt)
- `8` = Retro print
- `9` = Heritage
- `10` = Paper-craft

#### List Artifacts

```typescript
// List all artifacts in notebook
const artifacts = await sdk.artifacts.list('notebook-id')

// Filter by type
import { ArtifactType } from 'notebooklm-kit'
const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ)
const flashcards = artifacts.filter(a => a.type === ArtifactType.FLASHCARDS)

// Filter by state
import { ArtifactState } from 'notebooklm-kit'
const ready = artifacts.filter(a => a.state === ArtifactState.READY)
const creating = artifacts.filter(a => a.state === ArtifactState.CREATING)
```

#### Artifact Operations

```typescript
// Get artifact details
const artifact = await sdk.artifacts.get('artifact-id')

// Rename artifact
await sdk.artifacts.rename('artifact-id', 'New Title')

// Delete artifact
await sdk.artifacts.delete('artifact-id')

// Download artifact
const data = await sdk.artifacts.download('artifact-id', './downloads')
console.log('Downloaded:', data.filePath)
```

### Generation & Chat

```typescript
// Chat with notebook
const response = await sdk.generation.chat('notebook-id', 'What are the main findings?')

// Chat with specific sources
const response = await sdk.generation.chat(
  'notebook-id',
  'Summarize the methodology',
  ['source-id-1', 'source-id-2']
)

// Generate document guides
const guides = await sdk.generation.generateDocumentGuides('notebook-id')

// Generate notebook guide
const guide = await sdk.generation.generateNotebookGuide('notebook-id')

// Generate outline
const outline = await sdk.generation.generateOutline('notebook-id')
```

### Notes

```typescript
// List notes
const notes = await sdk.notes.list('notebook-id')

// Create note
const note = await sdk.notes.create('notebook-id', {
  title: 'Meeting Notes',
  content: 'Key points from the discussion...',
})

// Update note
await sdk.notes.update('notebook-id', 'note-id', {
  content: 'Updated content...',
})

// Delete note
await sdk.notes.delete('notebook-id', 'note-id')
```

## Language Support

NotebookLM supports **80+ languages** for artifacts. Use the `NotebookLMLanguage` enum for type safety:

```typescript
import { NotebookLMLanguage, getLanguageInfo } from 'notebooklm-kit'

// Common languages
NotebookLMLanguage.ENGLISH      // 'en'
NotebookLMLanguage.HINDI        // 'hi'
NotebookLMLanguage.SPANISH      // 'es'
NotebookLMLanguage.FRENCH       // 'fr'
NotebookLMLanguage.GERMAN       // 'de'
NotebookLMLanguage.JAPANESE     // 'ja'
NotebookLMLanguage.CHINESE      // 'zh'
NotebookLMLanguage.KOREAN       // 'ko'
NotebookLMLanguage.ARABIC       // 'ar'
NotebookLMLanguage.RUSSIAN      // 'ru'
NotebookLMLanguage.PORTUGUESE   // 'pt'
NotebookLMLanguage.ITALIAN      // 'it'
NotebookLMLanguage.TAMIL        // 'ta'
NotebookLMLanguage.TELUGU       // 'te'
NotebookLMLanguage.BENGALI      // 'bn'
NotebookLMLanguage.URDU         // 'ur'
// ... and 60+ more

// Get language info
const info = getLanguageInfo(NotebookLMLanguage.HINDI)
console.log(info.name)        // 'Hindi'
console.log(info.nativeName)  // 'हिन्दी'
console.log(info.code)        // 'hi'
```

**Language Support by Feature:**
- ✅ Audio Overviews: All 80+ languages
- ✅ Video Overviews: All 80+ languages
- ✅ Quizzes: All 80+ languages
- ✅ Flashcards: All 80+ languages
- ✅ Slide Decks: All 80+ languages
- ✅ Infographics: All 80+ languages

## Quota Management

The SDK automatically tracks and enforces NotebookLM's usage limits:

```typescript
import { NOTEBOOKLM_LIMITS } from 'notebooklm-kit'

// View all limits
console.log('Limits:', NOTEBOOKLM_LIMITS)

// Check current usage
const usage = sdk.getUsage()
console.log('Daily chats:', `${usage.daily.chats}/${NOTEBOOKLM_LIMITS.CHATS_PER_DAY}`)
console.log('Daily audio:', `${usage.daily.audioOverviews}/${NOTEBOOKLM_LIMITS.AUDIO_OVERVIEWS_PER_DAY}`)
console.log('Daily video:', `${usage.daily.videoOverviews}/${NOTEBOOKLM_LIMITS.VIDEO_OVERVIEWS_PER_DAY}`)

// Check remaining quota
const remainingChats = sdk.getRemaining('chats')
const remainingAudio = sdk.getRemaining('audioOverviews')
const remainingVideo = sdk.getRemaining('videoOverviews')
const remainingQuizzes = sdk.getRemaining('quizzes')

console.log(`${remainingChats} chats remaining today`)
console.log(`${remainingAudio} audio overviews remaining today`)

// Check before making requests
if (remainingChats === 0) {
  console.log('Daily chat limit reached. Try again tomorrow.')
} else {
  await sdk.generation.chat('notebook-id', 'Hello')
}
```

**Usage Limits:**

| Resource | Limit | Reset Period |
|----------|-------|--------------|
| **Notebooks** | 100 per account | Account lifetime |
| **Sources per Notebook** | 50 sources | Per notebook |
| **Chats** | 50 per day | 24 hours |
| **Audio Overviews** | 3 per day | 24 hours |
| **Video Overviews** | 3 per day | 24 hours |
| **Reports** | 10 per day | 24 hours |
| **Flashcards** | 10 per day | 24 hours |
| **Quizzes** | 10 per day | 24 hours |
| **Deep Research** | 10 per month | 30 days |

## Testing Status

### ✅ Fully Tested Features

These features have been extensively tested and work reliably:

| Feature | Status | Test File |
|---------|--------|-----------|
| **Notebooks** | ✅ Fully tested | `test/test-notebooks.js` |
| **Sources (URL)** | ✅ Fully tested | `test/test-sources.js` |
| **Sources (Text)** | ✅ Fully tested | `test/test-sources.js` |
| **Sources (PDF)** | ✅ Fully tested | `test/test-sources.js` |
| **Sources (PNG/Image)** | ✅ Fully tested | `test/test-sources.js` |
| **Sources (YouTube)** | ✅ Fully tested | `test/test-sources.js` |
| **Web Search** | ✅ Fully tested | `test/test-search-web-and-wait.js` |
| **Deep Search** | ✅ Fully tested | `test/test-deep-search-interactive.js` |
| **Quiz** | ✅ Fully tested | `test/test-artifacts.js` |
| **Flashcards** | ✅ Fully tested | `test/test-artifacts.js` |
| **Mind Map** | ✅ Fully tested | `test/test-artifacts.js` |

### ⚠️ Tested with Known Issues

These features work but may encounter Google API limitations:

| Feature | Status | Known Issues | Workaround |
|---------|--------|--------------|------------|
| **Audio Overview** | ⚠️ Intermittent | Google blocks automated requests | Create manually in UI or retry after 30min |
| **Video Overview** | ⚠️ Intermittent | Google blocks automated requests | Create manually in UI or retry after 30min |
| **Slide Deck** | ⚠️ Intermittent | Service unavailable during high load | Retry or use fewer sources |
| **Infographic** | ⚠️ Intermittent | Resource exhausted errors | Retry after cooldown period |

**About Audio/Video Blocking:**
Google NotebookLM actively rate-limits and blocks automated audio/video creation requests to prevent abuse. The same exact request structure works perfectly in the manual UI but fails via SDK with "Service unavailable" errors. This is intentional API-side blocking, not a bug in the SDK.

### 🚧 Experimental Features

These features have basic implementation but need more testing:

| Feature | Status | Notes |
|---------|--------|-------|
| **Study Guide** | 🚧 Basic testing | Creation works, download needs testing |
| **Report/Document** | 🚧 Basic testing | Creation works, download needs testing |
| **Google Drive (add)** | 🚧 Basic testing | Works for documents, needs testing for other file types |
| **Google Drive (search)** | 🚧 Basic testing | Search works, selection needs testing |
| **Notes** | 🚧 Basic testing | CRUD works, needs real-world testing |

### ❌ Deprecated / Removed Features

These features were removed or are deprecated:

| Feature | Status | Reason |
|---------|--------|--------|
| **Direct audio.create()** | ❌ Deprecated | Use `artifacts.create(ArtifactType.AUDIO)` instead |
| **Direct video.create()** | ❌ Deprecated | Use `artifacts.create(ArtifactType.VIDEO)` instead |

## Known Issues

### 1. Audio/Video Creation Failures ⚠️

**Symptom**: Audio and video creation fail with "Service unavailable" (error code 3) even with valid credentials.

**Cause**: Google NotebookLM actively blocks automated audio/video creation requests to prevent abuse. The same request that fails via SDK works perfectly when made manually in the UI.

**Evidence**:
- Manual UI video creation: ✅ Works
- SDK video creation with exact same structure: ❌ Fails with error code 3
- Same notebook, same sources, same cookies: Different results

**Workarounds:**
1. **Wait 15-30 minutes** between audio/video creation attempts
2. **Create manually** in the NotebookLM UI
3. **Try with a different notebook** (fresh notebooks sometimes work better)
4. **Use fewer sources** (manual requests often use 40+ sources, try with 2-5 sources)

**This is NOT a bug** - it's Google's intentional API protection. The SDK code is correct.

### 2. "Resource Exhausted" Errors

**Symptom**: Creating multiple artifacts quickly results in "Resource exhausted" (error code 8) errors.

**Cause**: NotebookLM enforces rate limits to prevent abuse.

**Solution**: **Create artifacts one at a time** with delays between requests (5-10 seconds minimum).

### 3. Cookie Expiration

**Symptom**: `401 Unauthorized` errors after some time.

**Cause**: Session cookies expire.

**Solution**: Refresh your cookies from the browser (see [Authentication](#authentication) section).

## Examples

### Complete Workflow Example

```typescript
import {
  NotebookLMClient,
  ArtifactType,
  ArtifactState,
  SearchSourceType,
  ResearchMode,
} from 'notebooklm-kit'

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
})

// 1. Create notebook
const notebook = await sdk.notebooks.create({
  title: 'AI Research Project',
  emoji: '🤖',
})

// 2. Add sources
const urlSource = await sdk.sources.addFromURL(notebook.projectId, {
  url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
})

const textSource = await sdk.sources.addFromText(notebook.projectId, {
  title: 'My Research Notes',
  content: 'Key findings from my experiments...',
})

// 3. Search and add more sources
const searchResult = await sdk.sources.searchWebAndWait(notebook.projectId, {
  query: 'machine learning advances 2024',
  mode: ResearchMode.STANDARD,
})

const webSourceIds = await sdk.sources.addDiscovered(notebook.projectId, {
  sessionId: searchResult.sessionId,
  sourceIds: searchResult.sources.slice(0, 3).map(s => s.sourceId),
})

// 4. Wait for sources to process
const sourceStatus = await sdk.sources.pollProcessing(notebook.projectId)
console.log(`${sourceStatus.readyCount}/${sourceStatus.totalCount} sources ready`)

// 5. Create study materials
const quiz = await sdk.artifacts.create(notebook.projectId, ArtifactType.QUIZ, {
  instructions: 'Create questions about AI fundamentals',
  customization: {
    numberOfQuestions: 2,
    difficulty: 2,
    language: 'en',
  },
})

const flashcards = await sdk.artifacts.create(notebook.projectId, ArtifactType.FLASHCARDS, {
  instructions: 'Focus on key terminology',
  customization: {
    numberOfCards: 2,
    difficulty: 2,
    language: 'en',
  },
})

const mindMap = await sdk.artifacts.create(notebook.projectId, ArtifactType.MIND_MAP, {
  instructions: 'Map AI concepts and relationships',
  sourceIds: [urlSource, textSource],
})

// 6. Wait for artifacts
let quizArtifact = quiz
while (quizArtifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  quizArtifact = await sdk.artifacts.get(quiz.artifactId)
}

// 7. Download artifacts
if (quizArtifact.state === ArtifactState.READY) {
  const quizData = await sdk.artifacts.download(quiz.artifactId, './downloads')
  console.log(`Quiz saved: ${quizData.filePath}`)
  console.log(`Questions: ${quizData.data.questions.length}`)
}

const flashcardData = await sdk.artifacts.download(flashcards.artifactId, './downloads')
console.log(`Flashcards saved: ${flashcardData.filePath}`)

// 8. Chat with your notebook
const chatResponse = await sdk.generation.chat(
  notebook.projectId,
  'What are the most important concepts in machine learning?'
)
console.log('AI Response:', chatResponse)

// 9. Cleanup
sdk.dispose()
```

### Multi-Language Example

```typescript
import { NotebookLMClient, ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
})

const notebookId = 'your-notebook-id'

// Create quiz in Hindi
const hindiQuiz = await sdk.artifacts.create(notebookId, ArtifactType.QUIZ, {
  instructions: 'मुख्य अवधारणाओं पर प्रश्न बनाएं',
  customization: {
    numberOfQuestions: 2,
    difficulty: 2,
    language: NotebookLMLanguage.HINDI, // or 'hi'
  },
})

// Create flashcards in Spanish
const spanishCards = await sdk.artifacts.create(notebookId, ArtifactType.FLASHCARDS, {
  instructions: 'Enfócate en la terminología clave',
  customization: {
    numberOfCards: 3,
    difficulty: 2,
    language: NotebookLMLanguage.SPANISH, // or 'es'
  },
})

// Create slides in French
const frenchSlides = await sdk.artifacts.create(notebookId, ArtifactType.SLIDE_DECK, {
  instructions: 'Créer une présentation couvrant les principaux sujets',
  customization: {
    format: 2,
    length: 2,
    language: NotebookLMLanguage.FRENCH, // or 'fr'
  },
})

sdk.dispose()
```

## Error Handling

```typescript
import {
  NotebookLMError,
  NotebookLMAuthError,
  RateLimitError,
  APIError,
} from 'notebooklm-kit'

try {
  const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
    instructions: 'Create a quiz',
    customization: { numberOfQuestions: 2, difficulty: 2, language: 'en' },
  })
} catch (error) {
  if (error instanceof NotebookLMAuthError) {
    console.error('❌ Authentication failed - refresh your cookies')
  } else if (error instanceof RateLimitError) {
    console.error('❌ Rate limit exceeded:', error.message)
    console.error(`Used: ${error.used}/${error.limit}`)
    console.error(`Resets at: ${error.resetTime}`)
  } else if (error instanceof APIError) {
    console.error('❌ API error:', error.message)
    if (error.message.includes('Service unavailable')) {
      console.log('⚠️  Google is blocking automated requests. Try again later or create manually in UI.')
    }
  } else if (error instanceof NotebookLMError) {
    console.error('❌ NotebookLM error:', error.message)
  }
}
```

## Advanced Configuration

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  
  // Enable debug logging
  debug: true,
  
  // Auto-refresh configuration
  autoRefresh: {
    enabled: true,
    interval: 5 * 60 * 1000, // 5 minutes
  },
  
  // Retry configuration
  maxRetries: 3,
  
  // Quota enforcement
  enforceQuotas: true,
  
  // Custom headers
  headers: {
    'User-Agent': 'My Custom Agent',
  },
})

// Manually refresh
await sdk.refreshCredentials()

// Get quota manager
const quotaManager = sdk.getQuotaManager()
quotaManager.resetUsage() // For testing only

// Get RPC client
const rpcClient = sdk.getRPCClient()
```

## Requirements

- **Runtime:** Node.js >= 18.0.0
- **TypeScript:** >= 5.0.0 (for TypeScript projects)
- **Credentials:** Valid NotebookLM auth token and cookies

## Contributing

See the `rpc/` folder for detailed RPC method documentation and examples. Each artifact type has its own operation guide:

- `rpc/QUIZ_OPERATIONS.md`
- `rpc/FLASHCARD_OPERATIONS.md`
- `rpc/AUDIO_OPERATIONS.md`
- `rpc/VIDEO_OPERATIONS.md`
- `rpc/SLIDE_DECK_OPERATIONS.md`
- `rpc/INFOGRAPHIC_OPERATIONS.md`
- `rpc/MIND_MAP_OPERATIONS.md`
- `rpc/REPORT_OPERATIONS.md`

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Disclaimer

**Unofficial SDK** - Not affiliated with or endorsed by Google. Use at your own risk.

**Important**: This SDK interacts with Google NotebookLM's internal APIs which may change without notice. Google actively rate-limits and blocks automated requests for certain features (especially audio/video creation) to prevent abuse.

## Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/photon-hq/notebooklm-kit/issues)
- 💬 **Discord**: [Join our community](https://discord.gg/bZd4CMd2H5)
- 📧 **Email**: support@photon.codes

---

Made with ❤️ by [Photon](https://photon.codes)
