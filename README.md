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

## Features

### `sdk.notebooks` - Notebook Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Notebooks | List all your notebooks (recently viewed) | [`sdk.notebooks.list()`](#list-notebooks) | |
| Get Notebook | Get full details of a specific notebook | [`sdk.notebooks.get(notebookId)`](#get-notebook) | |
| Create Notebook | Create a new notebook (auto-generates title if empty) | [`sdk.notebooks.create(options)`](#create-notebook) | |
| Update Notebook | Update notebook title or description | [`sdk.notebooks.update(notebookId, options)`](#update-notebook) | |
| Delete Notebook | Delete one or more notebooks | [`sdk.notebooks.delete(notebookIds)`](#delete-notebook) | |
| Share Notebook | Share notebook with users or enable link sharing | [`sdk.notebooks.share(notebookId, options)`](#share-notebook) | |

### `sdk.sources` - Source Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| Add from URL | Add a source from a web page URL | `sdk.sources.addFromURL(notebookId, options)` | |
| Add from Text | Add a source from text content | `sdk.sources.addFromText(notebookId, options)` | |
| Add from File | Add a source from a file (PDF, image, etc.) | `sdk.sources.addFromFile(notebookId, options)` | |
| Add YouTube | Add a YouTube video as a source | `sdk.sources.addYouTube(notebookId, options)` | |
| Add Google Drive | Add a Google Drive file as a source | `sdk.sources.addGoogleDrive(notebookId, options)` | |
| Search Web | Search the web for sources | `sdk.sources.searchWeb(notebookId, options)` | |
| Search Web and Wait | Search web and wait for results | `sdk.sources.searchWebAndWait(notebookId, options)` | |
| Get Search Results | Get search results from a session | `sdk.sources.getSearchResults(notebookId, sessionId?)` | |
| Add Discovered | Add discovered sources from search | `sdk.sources.addDiscovered(notebookId, options)` | |
| Batch Add | Add multiple sources at once | `sdk.sources.addBatch(notebookId, options)` | |
| Delete Source | Delete a source from a notebook | `sdk.sources.delete(notebookId, sourceId)` | |
| Update Source | Update source metadata | `sdk.sources.update(notebookId, sourceId, updates)` | |
| Refresh Source | Re-fetch and reprocess source content | `sdk.sources.refresh(notebookId, sourceId)` | |
| Poll Processing | Check source processing status | `sdk.sources.pollProcessing(notebookId)` | |
| Select Source | Select a source (deprecated) | `sdk.sources.selectSource(sourceId)` | |
| Load Content | Load source content (deprecated) | `sdk.sources.loadContent(sourceId)` | |
| Check Freshness | Check if source needs refresh (deprecated) | `sdk.sources.checkFreshness(sourceId)` | |
| Add Deep Research | Add deep research source (deprecated) | `sdk.sources.addDeepResearch(notebookId, query)` | |
| Act On | Perform action on sources (deprecated) | `sdk.sources.actOn(notebookId, action, sourceIds)` | |

### `sdk.artifacts` - Artifact Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| Create Artifact | Create study material (quiz, flashcards, mind map, etc.) | `sdk.artifacts.create(notebookId, type, options)` | |
| List Artifacts | List all artifacts in a notebook | `sdk.artifacts.list(notebookId)` | |
| Get Artifact | Get artifact details | `sdk.artifacts.get(artifactId, notebookId?)` | |
| Download Artifact | Download artifact data (quiz questions, CSV, JSON, etc.) | `sdk.artifacts.download(artifactId, outputDir, notebookId?)` | |
| Rename Artifact | Rename an artifact | `sdk.artifacts.rename(artifactId, newTitle)` | |
| Delete Artifact | Delete an artifact | `sdk.artifacts.delete(artifactId, notebookId?)` | |
| Update Artifact | Update artifact metadata | `sdk.artifacts.update(artifactId, updates)` | |

### `sdk.generation` - Generation & Chat

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| Chat | Chat with notebook content | `sdk.generation.chat(notebookId, message, sourceIds?)` | |
| Generate Document Guides | Generate document guides for sources | `sdk.generation.generateDocumentGuides(notebookId)` | |
| Generate Notebook Guide | Generate a notebook guide | `sdk.generation.generateNotebookGuide(notebookId)` | |
| Generate Outline | Generate an outline for the notebook | `sdk.generation.generateOutline(notebookId)` | |
| Generate Report Suggestions | Generate report suggestions | `sdk.generation.generateReportSuggestions(notebookId)` | |
| Generate Magic View | Generate magic view | `sdk.generation.generateMagicView(notebookId, sourceIds)` | |
| Start Draft | Start a draft | `sdk.generation.startDraft(notebookId)` | |
| Start Section | Start a section | `sdk.generation.startSection(notebookId)` | |
| Generate Section | Generate a section | `sdk.generation.generateSection(notebookId)` | |

### `sdk.notes` - Notes Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Notes | List all notes in a notebook | `sdk.notes.list(notebookId)` | |
| Create Note | Create a new note | `sdk.notes.create(notebookId, options)` | |
| Update Note | Update a note | `sdk.notes.update(notebookId, noteId, options)` | |
| Delete Note | Delete a note | `sdk.notes.delete(notebookId, noteIds)` | |

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

## Notebooks

Examples: [notebook-list.ts](examples/notebook-list.ts) | [notebook-get.ts](examples/notebook-get.ts) | [notebook-create.ts](examples/notebook-create.ts) | [notebook-update.ts](examples/notebook-update.ts) | [notebook-delete.ts](examples/notebook-delete.ts) | [notebook-share.ts](examples/notebook-share.ts)

### List Notebooks

**Method:** `sdk.notebooks.list()`

**Returns:** `Promise<Notebook[]>`

**Description:**
Lists all your notebooks (recently viewed). Returns a lightweight array of notebooks with essential information for display/selection.

**Return Fields:**
- `projectId: string` - Unique notebook ID (required for other operations)
- `title: string` - Notebook title
- `emoji: string` - Visual identifier
- `sourceCount: number` - Number of sources in the notebook

<details>
<summary><strong>Notes</strong></summary>

- Automatically filters out system notebooks (e.g., "OpenStax's Biology")
- Returns only notebooks you've recently viewed
- Does not include full notebook details (use `get()` for that)
- Does not include sources array (use `sources` service for source operations)
- Does not include sharing info (use `get()` for sharing details)

</details>

**Usage:**
```typescript
const notebooks = await sdk.notebooks.list()
console.log(`Found ${notebooks.length} notebooks`)
notebooks.forEach(nb => {
  console.log(`${nb.emoji} ${nb.title} (${nb.sourceCount} sources)`)
})
```

---

### Get Notebook

**Method:** `sdk.notebooks.get(notebookId)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)

**Returns:** `Promise<Notebook>`

**Description:**
Retrieves full details of a specific notebook, including analytics and sharing information. Makes parallel RPC calls to get complete notebook data.

**Return Fields:**
- `projectId: string` - Unique notebook ID
- `title: string` - Notebook title
- `emoji: string` - Visual identifier
- `sourceCount?: number` - Number of sources (analytics)
- `lastAccessed?: string` - Last accessed timestamp (ISO format, analytics)
- `sharing?: SharingSettings` - Sharing configuration:
  - `isShared: boolean` - Whether notebook is shared
  - `shareUrl?: string` - Share URL if shared
  - `shareId?: string` - Share ID
  - `publicAccess?: boolean` - Whether public access is enabled
  - `allowedUsers?: string[]` - Array of user emails with access

<details>
<summary><strong>Notes</strong></summary>

- Validates notebook ID format before making RPC calls
- Calls both `RPC_GET_PROJECT` and `RPC_GET_SHARING_DETAILS` in parallel for efficiency
- Sharing data is optional - won't fail if unavailable
- Does not include sources array (use `sources` service for source operations)
- `lastAccessed` is extracted from notebook metadata if available

</details>

**Usage:**
```typescript
const notebook = await sdk.notebooks.get('notebook-id')
console.log(`Title: ${notebook.title}`)
console.log(`Sources: ${notebook.sourceCount || 0}`)
console.log(`Last accessed: ${notebook.lastAccessed || 'Never'}`)
if (notebook.sharing?.isShared) {
  console.log(`Share URL: ${notebook.sharing.shareUrl}`)
}
```

---

### Create Notebook

**Method:** `sdk.notebooks.create(options)`

**Parameters:**
- `options: CreateNotebookOptions`
  - `title: string` - Notebook title (optional, auto-generated if empty)
  - `description?: string` - Initial description (optional)

**Returns:** `Promise<Notebook>`

**Description:**
Creates a new notebook. Automatically generates a title if not provided. Validates title length before creation.

**Return Fields:**
- `projectId: string` - Unique notebook ID (use this for subsequent operations)
- `title: string` - Notebook title (as provided or auto-generated)
- `emoji: string` - Default emoji

**Auto-Generated Title Format:**
If `title` is empty or not provided, generates: `"Untitled Notebook {current date}"`
Example: `"Untitled Notebook 12/30/2024"`

<details>
<summary><strong>Validation</strong></summary>

- Title maximum length: 100 characters
- Throws `APIError` if title exceeds limit
- Empty title is allowed (will be auto-generated)

</details>

<details>
<summary><strong>Notes</strong></summary>

- Quota is checked before creation (if quota manager is enabled)
- Usage is recorded after successful creation
- Returns immediately with notebook ID - no waiting required
- Does not include `sourceCount`, `lastAccessed`, or `sharing` (not available for new notebooks)

</details>

**Usage:**
```typescript
// With title
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
})

// Auto-generated title
const untitled = await sdk.notebooks.create({})

// With description
const notebook = await sdk.notebooks.create({
  title: 'Project Notes',
  description: 'Initial project description',
})
```

---

### Update Notebook

**Method:** `sdk.notebooks.update(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required, automatically trimmed)
- `options: UpdateNotebookOptions`
  - `title?: string` - New title (optional)
  - `description?: string` - New description (optional)
  - `metadata?: Record<string, any>` - Other metadata updates (optional)

**Returns:** `Promise<Notebook>` (same as `get()` - full notebook details)

**Description:**
Updates notebook title or description. Returns full notebook details after update (same structure as `get()`).

<details>
<summary><strong>Validation</strong></summary>

- At least one field (`title` or `description`) must be provided
- Title maximum length: 100 characters
- Notebook ID is automatically trimmed (removes trailing spaces)
- Returns error if notebook doesn't exist

</details>

**Return Fields:**
Same as `get()` - includes `projectId`, `title`, `emoji`, `sourceCount`, `lastAccessed`, `sharing`

<details>
<summary><strong>Notes</strong></summary>

- Notebook ID is trimmed automatically to prevent issues with trailing spaces
- Only provided fields are updated (partial updates supported)
- Returns full notebook object after update (not just updated fields)
- Does not validate notebook existence first (for performance) - returns error if not found

</details>

**Usage:**
```typescript
// Update title only
const updated = await sdk.notebooks.update('notebook-id', {
  title: 'Updated Title',
})

// Update description only
const updated = await sdk.notebooks.update('notebook-id', {
  description: 'New description',
})

// Update both
const updated = await sdk.notebooks.update('notebook-id', {
  title: 'New Title',
  description: 'New Description',
})
```

---

### Delete Notebook

**Method:** `sdk.notebooks.delete(notebookIds)`

**Parameters:**
- `notebookIds: string | string[]` - Single notebook ID or array of IDs (required)

**Returns:** `Promise<DeleteNotebookResult>`

**Description:**
Deletes one or more notebooks. Returns confirmation with deleted IDs and count.

**Return Fields:**
- `deleted: string[]` - Array of deleted notebook IDs
- `count: number` - Number of notebooks deleted

<details>
<summary><strong>Validation</strong></summary>

- All provided IDs are validated before deletion
- Throws `APIError` if any ID is invalid
- Supports both single ID and array of IDs

</details>

<details>
<summary><strong>Notes</strong></summary>

- No confirmation required - deletion is immediate
- Batch deletion is supported (pass array of IDs)
- Returns validation/confirmation object (not void)
- All IDs are validated before any deletion occurs

</details>

**Usage:**
```typescript
// Delete single notebook
const result = await sdk.notebooks.delete('notebook-id')
console.log(`Deleted ${result.count} notebook: ${result.deleted[0]}`)

// Delete multiple notebooks
const result = await sdk.notebooks.delete(['id-1', 'id-2', 'id-3'])
console.log(`Deleted ${result.count} notebooks: ${result.deleted.join(', ')}`)
```

---

### Share Notebook

**Method:** `sdk.notebooks.share(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required, automatically trimmed)
- `options: ShareNotebookOptions`
  - `users?: Array<{email: string, role: 2|3|4}>` - Users to share with (optional)
  - `anyoneWithLink?: boolean` - Enable public link access (optional)
  - `notify?: boolean` - Notify users (default: true, only used when users are provided)
  - `accessType?: 1|2` - Access type (optional, default: 2=restricted)

**Returns:** `Promise<ShareNotebookResult>`

**Description:**
Shares notebook with users or enables link sharing. Supports multiple users with different roles. Automatically fetches updated sharing state after operation.

**User Roles:**

| Role | Value | Description |
|------|-------|-------------|
| Editor | `2` | Can edit notebook content |
| Viewer | `3` | Can view notebook only |
| Remove | `4` | Remove user from shared list |

**Access Types:**

| Access Type | Value | Description |
|-------------|-------|-------------|
| Anyone with link | `1` | Public access via share link |
| Restricted | `2` | Only specified users can access |

**Return Fields:**
- `shareUrl: string` - Share URL (always present, even if not shared)
- `success: boolean` - Whether the share operation succeeded
- `notebookId: string` - The notebook ID that was shared
- `accessType: 1|2` - Access type that was set
- `linkEnabled: boolean` - Whether "anyone with link" is enabled
- `isShared: boolean` - Whether the notebook is shared
- `publicAccess: boolean` - Whether public access is enabled
- `users?: Array<{email: string, role: 2|3}>` - Users with access (only present if users were shared)

**Notify Behavior:**
- `notify` is only used when `users` are provided
- Default: `true` (users are notified when permissions change)
- Set to `false` to share silently
- Not used when only changing link access (no user changes)

<details>
<summary><strong>Validation</strong></summary>

- Email addresses are validated using regex before sharing
- Throws `APIError` if any email is invalid
- Supports multiple users in a single call

</details>

<details>
<summary><strong>Notes</strong></summary>
- Notebook ID is automatically trimmed
- Makes prerequisite `JFMDGd` call before sharing (to initialize sharing state)
- After successful share, makes another `JFMDGd` call to fetch updated state
- `shareUrl` is always returned (constructed from notebook ID if not explicitly shared)
- Supports sharing with multiple users in a single operation
- Can combine user sharing with link access in one call

</details>

**Usage:**
```typescript
// Share with users (notify enabled by default)
const result = await sdk.notebooks.share('notebook-id', {
  users: [
    { email: 'user1@example.com', role: 2 }, // editor
    { email: 'user2@example.com', role: 3 }, // viewer
  ],
  notify: true,
  accessType: 2, // restricted
})

// Share with users (silent, no notification)
const result = await sdk.notebooks.share('notebook-id', {
  users: [
    { email: 'user@example.com', role: 2 },
  ],
  notify: false,
  accessType: 2,
})

// Enable link sharing (anyone with link)
const result = await sdk.notebooks.share('notebook-id', {
  anyoneWithLink: true,
  accessType: 1, // anyone with link
})

// Remove user (role: 4)
const result = await sdk.notebooks.share('notebook-id', {
  users: [
    { email: 'user@example.com', role: 4 }, // remove
  ],
  accessType: 2,
})
```

<details>
<summary><b>Sources</b> - Add & manage sources</summary>

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
<summary><b>Artifacts</b> - Generate study materials</summary>

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
<summary><b>Generation & Chat</b> - Chat & content generation</summary>

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
<summary><b>Notes</b> - Manage notes</summary>

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
    console.error('Authentication failed - refresh your cookies')
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.message)
  } else if (error instanceof APIError) {
    console.error('API error:', error.message)
  } else if (error instanceof NotebookLMError) {
    console.error('NotebookLM error:', error.message)
  }
}
```
