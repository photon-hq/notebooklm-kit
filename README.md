<div align="center">
   
# @photon-ai/NotebookLM-kit

> A TypeScript SDK for programmatic access to Google NotebookLM.

</div>

[![npm version](https://img.shields.io/npm/v/notebooklm-kit.svg)](https://www.npmjs.com/package/notebooklm-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

## Overview

The NotebookLM Kit provides a clean, service-based interface to all NotebookLM features:

| Service | Purpose | Methods |
|---------|---------|---------|
| **`sdk.notebooks`** | Notebook management | `list()`, `create()`, `get()`, `update()`, `delete()`, `share()` |
| **`sdk.sources`** | Add & manage sources | `addFromURL()`, `addFromText()`, `addFromFile()`, `addYouTube()`, `searchWebAndWait()` |
| **`sdk.artifacts`** | Generate study materials | `create()`, `list()`, `get()`, `download()`, `delete()`, `rename()` |
| **`sdk.generation`** | Chat & content generation | `chat()`, `generateDocumentGuides()`, `generateOutline()` |
| **`sdk.notes`** | Manage notes | `create()`, `list()`, `update()`, `delete()` |

## Installation

```bash
npm install notebooklm-kit
```

## Authentication

### Setup `.env` File

Create a `.env` file in your project root:

```bash
# .env
NOTEBOOKLM_AUTH_TOKEN="ACi2F2NZSD7yrNvFMrCkP3vZJY1R:1766720233448"
NOTEBOOKLM_COOKIES="_ga=GA1.1.1949425436.1764104083; SID=g.a0005AiwX...; __Secure-1PSID=g.a0005AiwX...; APISID=2-7oUEYiopHvktji/Adx9rNhzIF8Oe-MPI; SAPISID=eMePV31yEdEOSnUq/AFdcsHac_J0t3DMBT; ..."
```

**Getting Credentials:**

1. **Auth Token**: Open https://notebooklm.google.com → Developer Tools (F12) → Console → Run: `window.WIZ_global_data.SNlM0e`
2. **Cookies**: Developer Tools → Network tab → Find any request → Headers → Copy Cookie value

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

<details>
<summary><b>📚 Notebooks</b> - Manage notebooks</summary>

### Methods

#### `list()` → `Promise<Notebook[]>`
List all your notebooks (recently viewed).

**Returns:**
- `Notebook[]` - Array of notebooks with: `projectId`, `title`, `emoji`, `sourceCount`

**Example:**
```typescript
const notebooks = await sdk.notebooks.list()
console.log(`Found ${notebooks.length} notebooks`)
```

---

#### `get(notebookId: string)` → `Promise<Notebook>`
Get full details of a specific notebook.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `Notebook` - Full notebook details with: `projectId`, `title`, `emoji`, `sourceCount`, `lastAccessed`, `sharing`

**Example:**
```typescript
const notebook = await sdk.notebooks.get('notebook-id')
console.log(`Title: ${notebook.title}`)
console.log(`Sources: ${notebook.sourceCount || 0}`)
console.log(`Last accessed: ${notebook.lastAccessed || 'Never'}`)
```

---

#### `create(options: CreateNotebookOptions)` → `Promise<Notebook>`
Create a new notebook. Auto-generates title if empty.

**Parameters:**
- `options.title: string` - Notebook title (optional, auto-generated if empty)
- `options.description?: string` - Initial description (optional)

**Returns:**
- `Notebook` - Created notebook with: `projectId`, `title`, `emoji`

**Example:**
```typescript
// With title
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
})

// Auto-generated title
const untitled = await sdk.notebooks.create({})
```

---

#### `update(notebookId: string, options: UpdateNotebookOptions)` → `Promise<Notebook>`
Update notebook title or description.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.title?: string` - New title (optional)
- `options.description?: string` - New description (optional)

**Returns:**
- `Notebook` - Updated notebook (same as `get()`)

**Example:**
```typescript
const updated = await sdk.notebooks.update('notebook-id', {
  title: 'Updated Title',
})
```

---

#### `delete(notebookIds: string | string[])` → `Promise<DeleteNotebookResult>`
Delete one or more notebooks.

**Parameters:**
- `notebookIds: string | string[]` - Single notebook ID or array of IDs

**Returns:**
- `DeleteNotebookResult` - Object with:
  - `deleted: string[]` - Array of deleted notebook IDs
  - `count: number` - Number of notebooks deleted

**Example:**
```typescript
// Delete single notebook
const result = await sdk.notebooks.delete('notebook-id')
console.log(`Deleted ${result.count} notebook(s)`)

// Delete multiple notebooks
const result = await sdk.notebooks.delete(['id-1', 'id-2'])
console.log(`Deleted: ${result.deleted.join(', ')}`)
```

---

#### `share(notebookId: string, options: ShareNotebookOptions)` → `Promise<ShareNotebookResult>`
Share notebook with users or enable link sharing.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.users?: Array<{email: string, role: 2|3|4}>` - Users to share with (2=editor, 3=viewer, 4=remove)
- `options.anyoneWithLink?: boolean` - Enable public link access
- `options.notify?: boolean` - Notify users (default: true, only used when users are provided)
- `options.accessType?: 1|2` - Access type (1=anyone with link, 2=restricted)

**Returns:**
- `ShareNotebookResult` - Object with:
  - `shareUrl: string` - Share URL (always present)
  - `success: boolean` - Operation status
  - `notebookId: string` - The notebook ID
  - `accessType: 1|2` - Access type set
  - `linkEnabled: boolean` - Whether link sharing is enabled
  - `isShared: boolean` - Whether notebook is shared
  - `publicAccess: boolean` - Whether public access is enabled
  - `users?: Array<{email: string, role: 2|3}>` - Users with access (if users were shared)

**Example:**
```typescript
// Share with users
const result = await sdk.notebooks.share('notebook-id', {
  users: [
    { email: 'user1@example.com', role: 2 }, // editor
    { email: 'user2@example.com', role: 3 }, // viewer
  ],
  notify: true,
  accessType: 2, // restricted
})

// Enable link sharing
const result = await sdk.notebooks.share('notebook-id', {
  anyoneWithLink: true,
  accessType: 1, // anyone with link
})
```

</details>

<details>
<summary><b>📄 Sources</b> - Add & manage sources</summary>

### Methods

#### `addFromURL(notebookId: string, options: AddURLSourceOptions)` → `Promise<string>`
Add a source from a URL (web page, YouTube, etc.).

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.url: string` - URL to add

**Returns:**
- `string` - Source ID

**Example:**
```typescript
const sourceId = await sdk.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article',
})
```

---

#### `addFromText(notebookId: string, options: AddTextSourceOptions)` → `Promise<string>`
Add a source from text content.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.title: string` - Source title
- `options.content: string` - Text content

**Returns:**
- `string` - Source ID

**Example:**
```typescript
const sourceId = await sdk.sources.addFromText('notebook-id', {
  title: 'Research Notes',
  content: 'Your text content here...',
})
```

---

#### `addFromFile(notebookId: string, options: AddFileSourceOptions)` → `Promise<string>`
Add a source from a file (PDF, image, etc.).

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.content: Buffer` - File content as Buffer
- `options.fileName: string` - File name
- `options.mimeType: string` - MIME type (e.g., 'application/pdf')

**Returns:**
- `string` - Source ID

**Example:**
```typescript
import { readFile } from 'fs/promises'

const buffer = await readFile('./document.pdf')
const sourceId = await sdk.sources.addFromFile('notebook-id', {
  content: buffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
})
```

---

#### `addYouTube(notebookId: string, options: AddYouTubeSourceOptions)` → `Promise<string>`
Add a YouTube video as a source.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.urlOrId: string` - YouTube URL or video ID

**Returns:**
- `string` - Source ID

**Example:**
```typescript
const sourceId = await sdk.sources.addYouTube('notebook-id', {
  urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})
```

---

#### `searchWebAndWait(notebookId: string, options: SearchWebOptions)` → `Promise<SearchWebResult>`
Search the web or Google Drive and wait for results.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.query: string` - Search query
- `options.sourceType: SearchSourceType` - WEB or GOOGLE_DRIVE
- `options.mode: ResearchMode` - STANDARD or DEEP

**Returns:**
- `SearchWebResult` - Object with:
  - `sessionId: string` - Session ID for adding sources
  - `sources: Array<{sourceId: string, title: string, ...}>` - Found sources

**Example:**
```typescript
import { SearchSourceType, ResearchMode } from 'notebooklm-kit'

const result = await sdk.sources.searchWebAndWait('notebook-id', {
  query: 'machine learning trends 2024',
  sourceType: SearchSourceType.WEB,
  mode: ResearchMode.STANDARD,
})

// Add selected sources
const sourceIds = await sdk.sources.addDiscovered('notebook-id', {
  sessionId: result.sessionId,
  sourceIds: result.sources.slice(0, 5).map(s => s.sourceId),
})
```

---

#### `pollProcessing(notebookId: string)` → `Promise<SourceProcessingStatus>`
Check source processing status.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `SourceProcessingStatus` - Object with:
  - `readyCount: number` - Number of ready sources
  - `totalCount: number` - Total sources
  - `processingCount: number` - Sources being processed
  - `failedCount: number` - Failed sources
  - `allReady: boolean` - Whether all sources are ready

**Example:**
```typescript
const status = await sdk.sources.pollProcessing('notebook-id')
console.log(`Ready: ${status.readyCount}/${status.totalCount}`)
```

</details>

<details>
<summary><b>🎨 Artifacts</b> - Generate study materials</summary>

### Methods

#### `create(notebookId: string, type: ArtifactType, options: CreateArtifactOptions)` → `Promise<Artifact>`
Create a study material (quiz, flashcards, mind map, etc.).

**Parameters:**
- `notebookId: string` - The notebook ID
- `type: ArtifactType` - Artifact type (QUIZ, FLASHCARDS, MIND_MAP, etc.)
- `options.instructions: string` - Instructions for generation
- `options.sourceIds?: string[]` - Specific source IDs (optional, uses all if not provided)
- `options.customization?: object` - Type-specific customization options

**Returns:**
- `Artifact` - Created artifact with: `artifactId`, `type`, `state`, `title`, etc.

**Example:**
```typescript
import { ArtifactType } from 'notebooklm-kit'

const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  instructions: 'Create questions covering key concepts',
  customization: {
    numberOfQuestions: 2, // 1=Fewer, 2=Standard, 3=More
    difficulty: 2, // 1=Easy, 2=Medium, 3=Hard
    language: 'en',
  },
})
```

---

#### `list(notebookId: string)` → `Promise<Artifact[]>`
List all artifacts in a notebook.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `Artifact[]` - Array of artifacts

**Example:**
```typescript
const artifacts = await sdk.artifacts.list('notebook-id')
const quizzes = artifacts.filter(a => a.type === ArtifactType.QUIZ)
```

---

#### `get(artifactId: string)` → `Promise<Artifact>`
Get artifact details.

**Parameters:**
- `artifactId: string` - The artifact ID

**Returns:**
- `Artifact` - Artifact details

**Example:**
```typescript
const artifact = await sdk.artifacts.get('artifact-id')
console.log(`State: ${artifact.state}`)
```

---

#### `download(artifactId: string, outputDir: string, notebookId?: string)` → `Promise<DownloadResult>`
Download artifact data (quiz questions, flashcard CSV, mind map JSON, etc.).

**Parameters:**
- `artifactId: string` - The artifact ID
- `outputDir: string` - Output directory path
- `notebookId?: string` - Notebook ID (required for audio/video)

**Returns:**
- `DownloadResult` - Object with:
  - `filePath: string` - Path to downloaded file
  - `data?: any` - Parsed data (for quizzes, flashcards, etc.)

**Example:**
```typescript
const result = await sdk.artifacts.download('artifact-id', './downloads')
console.log(`Downloaded: ${result.filePath}`)
if (result.data) {
  console.log('Quiz questions:', result.data.questions)
}
```

---

#### `rename(artifactId: string, newTitle: string)` → `Promise<void>`
Rename an artifact.

**Parameters:**
- `artifactId: string` - The artifact ID
- `newTitle: string` - New title

**Example:**
```typescript
await sdk.artifacts.rename('artifact-id', 'New Title')
```

---

#### `delete(artifactId: string)` → `Promise<void>`
Delete an artifact.

**Parameters:**
- `artifactId: string` - The artifact ID

**Example:**
```typescript
await sdk.artifacts.delete('artifact-id')
```

</details>

<details>
<summary><b>💬 Generation & Chat</b> - Chat & content generation</summary>

### Methods

#### `chat(notebookId: string, message: string, sourceIds?: string[])` → `Promise<string>`
Chat with notebook content.

**Parameters:**
- `notebookId: string` - The notebook ID
- `message: string` - Chat message
- `sourceIds?: string[]` - Specific source IDs (optional, uses all if not provided)

**Returns:**
- `string` - AI response

**Example:**
```typescript
const response = await sdk.generation.chat('notebook-id', 'What are the main findings?')

// Chat with specific sources
const response = await sdk.generation.chat(
  'notebook-id',
  'Summarize the methodology',
  ['source-id-1', 'source-id-2']
)
```

---

#### `generateDocumentGuides(notebookId: string)` → `Promise<DocumentGuide[]>`
Generate document guides for sources.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `DocumentGuide[]` - Array of document guides

**Example:**
```typescript
const guides = await sdk.generation.generateDocumentGuides('notebook-id')
```

---

#### `generateNotebookGuide(notebookId: string)` → `Promise<string>`
Generate a notebook guide.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `string` - Generated guide text

**Example:**
```typescript
const guide = await sdk.generation.generateNotebookGuide('notebook-id')
```

---

#### `generateOutline(notebookId: string)` → `Promise<Outline>`
Generate an outline for the notebook.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `Outline` - Generated outline

**Example:**
```typescript
const outline = await sdk.generation.generateOutline('notebook-id')
```

</details>

<details>
<summary><b>📝 Notes</b> - Manage notes</summary>

### Methods

#### `list(notebookId: string)` → `Promise<Note[]>`
List all notes in a notebook.

**Parameters:**
- `notebookId: string` - The notebook ID

**Returns:**
- `Note[]` - Array of notes

**Example:**
```typescript
const notes = await sdk.notes.list('notebook-id')
```

---

#### `create(notebookId: string, options: CreateNoteOptions)` → `Promise<Note>`
Create a new note.

**Parameters:**
- `notebookId: string` - The notebook ID
- `options.title: string` - Note title
- `options.content: string` - Note content

**Returns:**
- `Note` - Created note

**Example:**
```typescript
const note = await sdk.notes.create('notebook-id', {
  title: 'Meeting Notes',
  content: 'Key points from the discussion...',
})
```

---

#### `update(notebookId: string, noteId: string, options: UpdateNoteOptions)` → `Promise<Note>`
Update a note.

**Parameters:**
- `notebookId: string` - The notebook ID
- `noteId: string` - The note ID
- `options.title?: string` - New title (optional)
- `options.content?: string` - New content (optional)

**Returns:**
- `Note` - Updated note

**Example:**
```typescript
const updated = await sdk.notes.update('notebook-id', 'note-id', {
  content: 'Updated content...',
})
```

---

#### `delete(notebookId: string, noteId: string)` → `Promise<void>`
Delete a note.

**Parameters:**
- `notebookId: string` - The notebook ID
- `noteId: string` - The note ID

**Example:**
```typescript
await sdk.notes.delete('notebook-id', 'note-id')
```

</details>

## Language Support

NotebookLM supports **80+ languages** for artifacts. Use the `NotebookLMLanguage` enum for type safety:

```typescript
import { NotebookLMLanguage } from 'notebooklm-kit'

NotebookLMLanguage.ENGLISH      // 'en'
NotebookLMLanguage.HINDI        // 'hi'
NotebookLMLanguage.SPANISH      // 'es'
NotebookLMLanguage.FRENCH       // 'fr'
NotebookLMLanguage.JAPANESE     // 'ja'
// ... and 75+ more
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
  
  // Custom headers
  headers: {
    'User-Agent': 'My Custom Agent',
  },
})

// Manually refresh
await sdk.refreshCredentials()

// Get RPC client
const rpcClient = sdk.getRPCClient()
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
  } else if (error instanceof APIError) {
    console.error('❌ API error:', error.message)
  } else if (error instanceof NotebookLMError) {
    console.error('❌ NotebookLM error:', error.message)
  }
}
```
