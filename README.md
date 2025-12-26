<div align="center">

# NotebookLM Kit

> TypeScript SDK for Google NotebookLM — Build AI-powered research workflows, generate content, and automate knowledge management.

[![npm version](https://img.shields.io/npm/v/notebooklm-kit.svg)](https://www.npmjs.com/package/notebooklm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

</div>

## What is NotebookLM Kit?

NotebookLM Kit is a powerful TypeScript SDK that gives you programmatic access to Google NotebookLM's full feature set. Create notebooks, add sources, generate AI-powered content, and automate your research workflows—all from code.

### Key Features

- 📚 **Notebook Management** — Create, organize, and manage research notebooks
- 📄 **Source Integration** — Add URLs, files, YouTube videos, Google Drive, and web search results
- 💬 **AI Chat** — Interactive conversations with your notebook content
- 🎨 **Content Generation** — Create quizzes, flashcards, study guides, mind maps, infographics, slide decks, reports, audio, and video
- 🌍 **80+ Languages** — Generate content in multiple languages
- 🔄 **Auto-Refresh** — Automatic session management keeps you connected
- 📊 **Quota Management** — Built-in usage tracking and limit enforcement

## Quick Start

### Installation

```bash
npm install notebooklm-kit
```

### Basic Example

```typescript
import { NotebookLMClient, ArtifactType } from 'notebooklm-kit'

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
})

// Create a notebook
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
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

// Generate a quiz
const quiz = await sdk.artifacts.create(notebook.projectId, ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create 10 questions covering key concepts',
})

// Clean up
sdk.dispose()
```

## Authentication

### Quick Setup

1. Open [NotebookLM](https://notebooklm.google.com) in your browser and log in
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Copy and paste the script from `extract-credentials.js`
5. Follow the instructions to add HttpOnly cookies if needed
6. Copy the output to your `.env` file

### Manual Setup

**Get Auth Token:**
- Open DevTools Console on https://notebooklm.google.com
- Run: `window.WIZ_global_data.SNlM0e`
- Copy the value as `NOTEBOOKLM_AUTH_TOKEN`

**Get Cookies:**
- Open DevTools → Application → Cookies → https://notebooklm.google.com
- Find: `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`
- Copy each as `Name=Value` and join with `; `
- Set as `NOTEBOOKLM_COOKIES`

```bash
# .env file
NOTEBOOKLM_AUTH_TOKEN="your-token-here"
NOTEBOOKLM_COOKIES="SID=value; HSID=value; SSID=value; APISID=value; SAPISID=value; ..."
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
    gsessionId?: string           // Optional: Google session ID
  }
  maxRetries?: number             // Retry attempts (default: 3)
  enforceQuotas?: boolean         // Enforce usage limits (default: true)
  headers?: Record<string, string> // Custom headers
  urlParams?: Record<string, string> // Custom URL params
}
```

### Auto-Refresh

The SDK automatically keeps your session alive by refreshing credentials periodically.

- **Default:** Enabled with 10-minute interval
- **Initial refresh:** Happens immediately on client creation
- **Background refresh:** Continues automatically at configured interval
- **Recommended:** 5-10 minute intervals

```typescript
// Default: 10-minute interval
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

## Features

### Notebooks

Create and manage your research notebooks.

```typescript
// List all notebooks
const notebooks = await sdk.notebooks.list()

// Create notebook
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
  emoji: '📚',
})

// Get notebook
const notebook = await sdk.notebooks.get('notebook-id')

// Update notebook
await sdk.notebooks.update('notebook-id', {
  title: 'Updated Title',
})

// Delete notebook
await sdk.notebooks.delete('notebook-id')
```

### Sources

Add content from multiple sources to your notebooks.

#### Add from URL

```typescript
const sourceId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article',
})

// YouTube URLs are automatically detected
const youtubeId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

#### Add from Text

```typescript
const sourceId = await sdk.sources.addFromText('notebook-id', {
  title: 'My Notes',
  content: 'Your text content here...',
})
```

#### Add from File

```typescript
import { readFile } from 'fs/promises'

const buffer = await readFile('document.pdf')

const sourceId = await sdk.sources.addFromFile('notebook-id', {
  content: buffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
})

// Supported: PDF, DOC, DOCX, TXT, MD, and more
// Max file size: 200MB
```

#### Add YouTube Video

```typescript
// From URL or video ID
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

#### Add Google Drive File

```typescript
const sourceId = await sdk.sources.addGoogleDrive('notebook-id', {
  fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
})
```

#### Web Search

```typescript
import { SearchSourceType, ResearchMode } from 'notebooklm-kit'

// Search and wait for results
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
```

#### Batch Add Sources

```typescript
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

#### Check Processing Status

```typescript
const status = await sdk.sources.pollProcessing('notebook-id')

console.log(`Ready: ${status.readyCount}/${status.totalCount}`)

// Wait for all sources to be ready
while (!status.allReady) {
  await new Promise(r => setTimeout(r, 2000))
  const newStatus = await sdk.sources.pollProcessing('notebook-id')
  if (newStatus.allReady) break
}
```

### Notes

Create and manage notes within your notebooks.

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

### Generation

Chat with your notebook and generate various content types.

#### Chat

```typescript
// Simple chat
const response = await sdk.generation.chat('notebook-id', 'What are the key findings?')

// Chat with specific sources
const response = await sdk.generation.chat('notebook-id', 'Summarize these sources', [
  'source-id-1',
  'source-id-2',
])
```

#### Generate Guides

```typescript
// Generate document guides
const guides = await sdk.generation.generateDocumentGuides('notebook-id')

// Generate notebook guide
const guide = await sdk.generation.generateNotebookGuide('notebook-id')
```

#### Generate Outline

```typescript
const outline = await sdk.generation.generateOutline('notebook-id')
```

### Artifacts

Generate quizzes, flashcards, study guides, mind maps, infographics, slide decks, reports, audio, and video from your notebook content.

**Important:** Your notebook must have at least one source before creating artifacts. If you omit `sourceIds`, all sources in the notebook are used automatically. If you provide `sourceIds`, only those specific sources are used.

#### List Artifacts

```typescript
const artifacts = await sdk.artifacts.list('notebook-id')

// Filter by type
const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ)
const readyArtifacts = artifacts.filter(a => a.state === ArtifactState.READY)
```

#### Audio Overviews

Create podcast-style audio overviews in 80+ languages.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create audio in English (uses all sources)
const audio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings and main conclusions',
  // sourceIds omitted = uses all sources
})

// Create audio from specific sources
const focusedAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  instructions: 'Focus on key findings',
  sourceIds: ['source-id-1', 'source-id-2'],
})

// Create audio in Hindi - Deep dive format
const hindiAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    language: NotebookLMLanguage.HINDI, // or 'hi'
    format: 0, // 0=Deep dive (supports: 1=Short, 2=Default, 3=Long)
    length: 2, // 1=Short, 2=Default, 3=Long
  },
})

// Create audio - Brief format (no length option)
const briefAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    format: 1, // 1=Brief (length option not available)
    language: 'en',
  },
})

// Create audio - Critique format (supports: 1=Short, 2=Default)
const critiqueAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    format: 2, // 2=Critique
    length: 1, // Short
    language: 'en',
  },
})

// Create audio - Debate format (supports: 1=Short, 2=Default)
const debateAudio = await sdk.artifacts.create('notebook-id', ArtifactType.AUDIO, {
  customization: {
    format: 3, // 3=Debate
    length: 2, // Default
    language: 'en',
  },
})

// Get audio status (use notebook ID for audio artifacts)
const audioStatus = await sdk.artifacts.get('notebook-id', 'notebook-id')

// Download audio (when ready)
if (audioStatus.state === ArtifactState.READY) {
  const result = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
  console.log(`Audio saved to: ${result.filePath}`) // Saves as MP3
}
```

**Audio Format Options:**
- **Deep dive** (format: 0) — Supports all 3 length options: Short, Default, Long
- **Brief** (format: 1) — No length option
- **Critique** (format: 2) — Supports: Short, Default
- **Debate** (format: 3) — Supports: Short, Default

#### Video Overviews

Create engaging video overviews in 80+ languages with multiple visual styles.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create video in English (uses all sources)
const video = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create an engaging video overview with key highlights',
  // sourceIds omitted = uses all sources
  customization: {
    format: 1, // 1=Explainer, 2=Brief
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    visualStyle: 0, // 0=Auto-select, 1=Custom, 2=Classic, 3=Whiteboard, 4=Kawaii, 5=Anime, 6=Watercolour, 7=Anime (alt), 8=Retro print, 9=Heritage, 10=Paper-craft
  },
})

// Create video from specific sources
const focusedVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  instructions: 'Create video from these sources',
  sourceIds: ['source-id-1', 'source-id-2'],
  customization: {
    format: 2, // Brief
    language: 'en',
    visualStyle: 2, // Classic
  },
})

// Create video with custom style
const customVideo = await sdk.artifacts.create('notebook-id', ArtifactType.VIDEO, {
  customization: {
    format: 1,
    language: 'en',
    visualStyle: 1, // Custom (requires customStyleDescription)
    customStyleDescription: 'A minimalist design with pastel colors',
    focus: 'Focus on the methodology and results',
  },
})

// Download video (when ready)
const videoStatus = await sdk.artifacts.get(video.artifactId)
if (videoStatus.state === ArtifactState.READY) {
  const result = await sdk.artifacts.download(video.artifactId, './downloads')
  console.log(`Video saved to: ${result.filePath}`) // Saves as MP4
}
```

**Visual Style Options:**
- `0` = Auto-select (AI chooses the best style)
- `1` = Custom (requires `customStyleDescription`)
- `2` = Classic (traditional, professional)
- `3` = Whiteboard (hand-drawn style)
- `4` = Kawaii (cute, colorful)
- `5` = Anime (anime-inspired)
- `6` = Watercolour (watercolor painting)
- `7` = Anime (alternative)
- `8` = Retro print (vintage print/poster)
- `9` = Heritage (traditional ink-wash)
- `10` = Paper-craft (paper cut-out)

#### Quizzes

Generate interactive quizzes in 80+ languages.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create quiz in English (uses all sources)
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create 10 multiple choice questions covering key concepts',
  // sourceIds omitted = uses all sources
  customization: {
    numberOfQuestions: 3, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: NotebookLMLanguage.ENGLISH, // or 'en'
  },
})

// Create quiz from specific sources
const quizFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Focused Quiz',
  sourceIds: ['source-id-1', 'source-id-2'],
  customization: {
    numberOfQuestions: 3,
    difficulty: 3, // Hard
    language: 'en',
  },
})

// Wait for quiz to be ready
let artifact = quiz
while (artifact.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  artifact = await sdk.artifacts.get(quiz.artifactId)
}

// Download quiz (saves as JSON)
if (artifact.state === ArtifactState.READY) {
  const result = await sdk.artifacts.download(quiz.artifactId, './downloads')
  console.log(`Quiz saved to: ${result.filePath}`)
  console.log(result.data.questions) // Array of questions with answers
}
```

#### Flashcards

Generate flashcard sets in 80+ languages.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Create flashcards in English (uses all sources)
const flashcards = await sdk.artifacts.create('notebook-id', ArtifactType.FLASHCARDS, {
  instructions: 'Focus on terminology and definitions',
  // sourceIds omitted = uses all sources
  customization: {
    numberOfCards: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: NotebookLMLanguage.ENGLISH, // or 'en'
  },
})

// Download flashcards (saves as CSV)
const result = await sdk.artifacts.download(flashcards.artifactId, './downloads')
console.log(`Flashcards saved to: ${result.filePath}`)
console.log(result.data.csv) // CSV string
console.log(result.data.flashcards) // Parsed array
```

#### Slide Decks

Create presentation slide decks in 80+ languages.

```typescript
import { ArtifactType, ArtifactState, NotebookLMLanguage } from 'notebooklm-kit'

// Step 1: Add sources first
const sourceId1 = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article1',
})
const sourceId2 = await sdk.sources.addFromText('notebook-id', {
  title: 'Research Notes',
  content: 'Key findings and insights...',
})

// Step 2: Create slide deck using all sources
const slideDeck = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Presentation',
  instructions: 'Create 10 slides covering main topics with visuals',
  // sourceIds omitted = uses all sources
  customization: {
    format: 3, // 2=Presenter slides, 3=Detailed deck
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    length: 2, // 1=Short, 2=Default, 3=Long
  },
})

// Step 3: Create slide deck from specific sources
const slideDeckFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
  title: 'Focused Presentation',
  sourceIds: [sourceId1, sourceId2], // Only these sources
  customization: {
    format: 2, // Presenter slides
    language: NotebookLMLanguage.FRENCH, // or 'fr'
    length: 3, // Long
  },
})

// Wait for slide deck to be ready
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

#### Infographics

Create visual infographics in 80+ languages.

```typescript
import { ArtifactType, NotebookLMLanguage } from 'notebooklm-kit'

// Create infographic in English (uses all sources)
const infographic = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Visual summary of key data and statistics',
  // sourceIds omitted = uses all sources
  customization: {
    language: NotebookLMLanguage.ENGLISH, // or 'en'
    orientation: 1, // 1=Landscape, 2=Portrait, 3=Square
    levelOfDetail: 2, // 1=Concise, 2=Standard, 3=Detailed
  },
})

// Create infographic from specific sources
const infographicFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.INFOGRAPHIC, {
  instructions: 'Use a blue colour theme and highlight the 3 key stats',
  sourceIds: ['source-id-1', 'source-id-2'],
  customization: {
    language: NotebookLMLanguage.ARABIC, // or 'ar'
    orientation: 2, // Portrait
    levelOfDetail: 3, // Detailed
  },
})

// Download infographic (saves as PNG or JSON)
const result = await sdk.artifacts.download(infographic.artifactId, './downloads')
console.log(`Infographic saved to: ${result.filePath}`)
```

#### Mind Maps

Create interactive mind maps from your sources.

```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Create mind map (requires sourceIds)
const mindMap = await sdk.artifacts.create('notebook-id', ArtifactType.MIND_MAP, {
  title: 'Concept Map',
  instructions: 'Focus on key concepts and their relationships',
  sourceIds: ['source-id-1', 'source-id-2'], // Required: Must specify sources
})

// Wait for mind map to be ready
let mindMapStatus = await sdk.artifacts.get(mindMap.artifactId)
while (mindMapStatus.state === ArtifactState.CREATING) {
  await new Promise(r => setTimeout(r, 2000))
  mindMapStatus = await sdk.artifacts.get(mindMap.artifactId)
}

// Download mind map (saves as JSON)
if (mindMapStatus.state === ArtifactState.READY) {
  const result = await sdk.artifacts.download(mindMap.artifactId, './downloads')
  console.log(`Mind map saved to: ${result.filePath}`)
}
```

**Note:** Mind maps require you to explicitly specify `sourceIds`. You cannot omit `sourceIds` to use all sources automatically.

#### Study Guides

Generate comprehensive study guides.

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create study guide (uses all sources)
const studyGuide = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  title: 'Exam Study Guide',
  instructions: 'Focus on key concepts, formulas, and important dates',
  // sourceIds omitted = uses all sources
})

// Create study guide from specific sources
const studyGuideFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.STUDY_GUIDE, {
  title: 'Chapters 1-3 Study Guide',
  sourceIds: ['source-id-1', 'source-id-2'],
})
```

#### Reports

Generate comprehensive reports and documents.

```typescript
import { ArtifactType } from 'notebooklm-kit'

// Create report (uses all sources)
const report = await sdk.artifacts.create('notebook-id', ArtifactType.DOCUMENT, {
  title: 'Research Report',
  instructions: 'Comprehensive report covering all key findings',
  // sourceIds omitted = uses all sources
})

// Create report from specific sources
const reportFromSelected = await sdk.artifacts.create('notebook-id', ArtifactType.DOCUMENT, {
  title: 'Chapter 1-3 Report',
  instructions: 'Report covering chapters 1-3',
  sourceIds: ['source-id-1', 'source-id-2'],
})
```

#### Manage Artifacts

```typescript
// Get artifact details
const artifact = await sdk.artifacts.get('artifact-id')

// Rename artifact
await sdk.artifacts.rename('artifact-id', 'New Title')

// Delete artifact
await sdk.artifacts.delete('artifact-id')

// For audio artifacts, use notebook ID
await sdk.artifacts.get('notebook-id', 'notebook-id')
await sdk.artifacts.delete('notebook-id', 'notebook-id')
await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')

// Download artifact (works for all types)
// - Slide decks: Saves as PDF
// - Quizzes: Saves as JSON
// - Flashcards: Saves as CSV
// - Audio: Saves as MP3
// - Video: Saves as MP4
// - Mind maps: Saves as JSON
// - Reports: Saves as JSON
// - Infographics: Saves as PNG or JSON
const result = await sdk.artifacts.download('artifact-id', './downloads')
console.log(`File saved to: ${result.filePath}`)
```

## Language Support

NotebookLM supports **80+ languages** for audio, video, quizzes, flashcards, slide decks, and infographics.

### Using Languages

```typescript
import { NotebookLMLanguage, getLanguageInfo, isLanguageSupported } from 'notebooklm-kit'

// Use enum for type safety
const language = NotebookLMLanguage.HINDI // 'hi'
const language2 = NotebookLMLanguage.FRENCH // 'fr'

// Or use ISO 639-1 codes directly
const language3 = 'es' // Spanish

// Check if language is supported
if (isLanguageSupported('ta')) {
  console.log('Tamil is supported!')
}

// Get language information
const info = getLanguageInfo(NotebookLMLanguage.HINDI)
console.log(info.name) // 'Hindi'
console.log(info.nativeName) // 'हिन्दी'
```

### Supported Languages Include

- **Major Languages:** English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese
- **Indian Languages:** Hindi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Urdu
- **Middle Eastern:** Arabic, Hebrew, Persian, Turkish
- **Southeast Asian:** Thai, Vietnamese, Indonesian, Malay, Tagalog
- **European:** Polish, Dutch, Swedish, Danish, Finnish, Norwegian, Czech, Slovak, Hungarian, Romanian
- **African:** Swahili, Zulu, Afrikaans, Yoruba, Igbo, Hausa

See the `NotebookLMLanguage` enum for the complete list of 80+ supported languages.

## Quota Management

The SDK automatically enforces NotebookLM's usage limits to prevent API errors.

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

// Get remaining quota
const remainingChats = sdk.getRemaining('chats')
console.log(`${remainingChats} chats remaining today`)
```

### Customize Quota Behavior

```typescript
// Disable quota enforcement (not recommended)
const sdk = new NotebookLMClient({
  authToken: '...',
  cookies: '...',
  enforceQuotas: false,
})
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
  }
}
```

## Documentation

For detailed operation guides, see:

- [Quiz Operations](./rpc/QUIZ_OPERATIONS.md)
- [Flashcard Operations](./rpc/FLASHCARD_OPERATIONS.md)
- [Slide Deck Operations](./rpc/SLIDE_DECK_OPERATIONS.md)
- [Audio Operations](./rpc/AUDIO_OPERATIONS.md)
- [Video Operations](./rpc/VIDEO_OPERATIONS.md)
- [Mind Map Operations](./rpc/MIND_MAP_OPERATIONS.md)
- [Report Operations](./rpc/REPORT_OPERATIONS.md)
- [Infographic Operations](./rpc/INFOGRAPHIC_OPERATIONS.md)

## Requirements

- **Runtime:** Node.js >= 18.0.0
- **Credentials:** Valid NotebookLM auth token and cookies
- **Permissions:** Access to NotebookLM account

## License

MIT License

## Disclaimer

Unofficial SDK, not affiliated with Google. Use at your own risk.
