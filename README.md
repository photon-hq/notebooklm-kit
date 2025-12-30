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
| **[`sdk.notebooks`](#sdknotebooks---notebook-management)** | Notebook management | `list()`, `create()`, `get()`, `update()`, `delete()`, `share()` |
| **[`sdk.sources`](#sdksources---source-management)** | Add & manage sources | `addFromURL()`, `addFromText()`, `addFromFile()`, `addYouTube()`, `searchWebAndWait()` |
| **[`sdk.artifacts`](#sdkartifacts---artifact-management)** | Generate study materials | `create()`, `list()`, `get()`, `download()`, `delete()`, `rename()`, `share()` |
| **[`sdk.generation`](#sdkgeneration---generation--chat)** | Chat & content generation | `chat()`, `generateDocumentGuides()`, `generateOutline()` |
| **[`sdk.notes`](#sdknotes---notes-management)** | Manage notes | `create()`, `list()`, `update()`, `delete()` |

## Installation

```bash
npm install notebooklm-kit
```

## Features

### `sdk.notebooks` - Notebook Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Notebooks | List all your notebooks (recently viewed) | [`sdk.notebooks.list()`](#list-notebooks) | [notebook-list.ts](examples/notebook-list.ts) |
| Get Notebook | Get full details of a specific notebook | [`sdk.notebooks.get(notebookId)`](#get-notebook) | [notebook-get.ts](examples/notebook-get.ts) |
| Create Notebook | Create a new notebook (auto-generates title if empty) | [`sdk.notebooks.create(options)`](#create-notebook) | [notebook-create.ts](examples/notebook-create.ts) |
| Update Notebook | Update notebook title or description | [`sdk.notebooks.update(notebookId, options)`](#update-notebook) | [notebook-update.ts](examples/notebook-update.ts) |
| Delete Notebook | Delete one or more notebooks | [`sdk.notebooks.delete(notebookIds)`](#delete-notebook) | [notebook-delete.ts](examples/notebook-delete.ts) |
| Share Notebook | Share notebook with users or enable link sharing | [`sdk.notebooks.share(notebookId, options)`](#share-notebook) | [notebook-share.ts](examples/notebook-share.ts) |

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
| Create Artifact | Create study material (quiz, flashcards, mind map, etc.) | [`sdk.artifacts.create()`](#create-artifact) or `sdk.artifacts.{type}.create()` | [artifact-create.ts](examples/artifact-create.ts) |
| List Artifacts | List all artifacts in a notebook (with filtering) | [`sdk.artifacts.list()`](#list-artifacts) | [artifact-list.ts](examples/artifact-list.ts) |
| Get Artifact | Get artifact details (auto-fetches content when ready) | [`sdk.artifacts.get()`](#get-artifact) | [artifact-get.ts](examples/artifact-get.ts) |
| Download Artifact | Download artifact data to disk (quiz/flashcard JSON, audio file) | [`sdk.artifacts.download()`](#download-artifact) | [artifact-download.ts](examples/artifact-download.ts) |
| Rename Artifact | Rename an artifact | [`sdk.artifacts.rename()`](#rename-artifact) | [artifact-rename.ts](examples/artifact-rename.ts) |
| Delete Artifact | Delete an artifact | [`sdk.artifacts.delete()`](#delete-artifact) | [artifact-delete.ts](examples/artifact-delete.ts) |
| Share Artifact | Share artifact/notebook with users or enable link sharing | [`sdk.artifacts.share()`](#share-artifact) | [artifact-share.ts](examples/artifact-share.ts) |

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

**Example:** [notebook-list.ts](examples/notebook-list.ts)

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

**Example:** [notebook-get.ts](examples/notebook-get.ts)

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

**Example:** [notebook-create.ts](examples/notebook-create.ts)

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

**Example:** [notebook-update.ts](examples/notebook-update.ts)

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

**Example:** [notebook-delete.ts](examples/notebook-delete.ts)

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

**Example:** [notebook-share.ts](examples/notebook-share.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required, automatically trimmed)
- `options: ShareNotebookOptions`
  - `users?: Array<{email: string, role: 2|3|4}>` - Users to share with (optional)
  - `notify?: boolean` - Notify users (default: true, only used when users are provided)
  - `accessType?: 1|2` - Access type: 1=anyone with link, 2=restricted (optional, default: 2)

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
- `accessType: 1|2` - Access type: 1=anyone with link, 2=restricted
- `isShared: boolean` - Whether the notebook is shared (true if shared with users or link enabled)
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
// Share with users (restricted access, notify enabled by default)
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
  accessType: 1, // 1=anyone with link, 2=restricted
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

## Artifacts

Examples: [artifact-create.ts](examples/artifact-create.ts) | [artifact-list.ts](examples/artifact-list.ts) | [artifact-get.ts](examples/artifact-get.ts) | [artifact-download.ts](examples/artifact-download.ts) | [artifact-rename.ts](examples/artifact-rename.ts) | [artifact-delete.ts](examples/artifact-delete.ts) | [artifact-share.ts](examples/artifact-share.ts)

### Create Artifact

**Method:** `sdk.artifacts.create(notebookId, type, options)` or `sdk.artifacts.{type}.create(notebookId, options)`

**Example:** [artifact-create.ts](examples/artifact-create.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `type: ArtifactType` - Artifact type (required for main method)
- `options: CreateArtifactOptions`
  - `title?: string` - Artifact title (optional)
  - `instructions?: string` - Instructions for generation (optional)
  - `sourceIds?: string[]` - Specific source IDs (optional, uses all if not provided)
  - `customization?: object` - Type-specific customization options (optional)

**Returns:** `Promise<Artifact>` (or `Promise<VideoOverview>` / `Promise<AudioOverview>` for video/audio)

**Description:**
Creates a study material artifact (quiz, flashcards, report, mind map, infographic, slide deck, audio, video). Supports customization options for 6 out of 8 artifact types. Returns immediately with artifact metadata - check `state` field to see if artifact is ready.

**Artifact Types:**

| Type | Value | Customization | Sub-Service |
|------|-------|---------------|-------------|
| Quiz | `ArtifactType.QUIZ` | ✅ Yes | `sdk.artifacts.quiz.create()` |
| Flashcards | `ArtifactType.FLASHCARDS` | ✅ Yes | `sdk.artifacts.flashcard.create()` |
| Report | `ArtifactType.REPORT` | ❌ No | `sdk.artifacts.report.create()` |
| Mind Map | `ArtifactType.MIND_MAP` | ❌ No | `sdk.artifacts.mindmap.create()` |
| Infographic | `ArtifactType.INFOGRAPHIC` | ✅ Yes | `sdk.artifacts.infographic.create()` |
| Slide Deck | `ArtifactType.SLIDE_DECK` | ✅ Yes | `sdk.artifacts.slide.create()` |
| Audio | `ArtifactType.AUDIO` | ✅ Yes | `sdk.artifacts.audio.create()` |
| Video | `ArtifactType.VIDEO` | ✅ Yes | `sdk.artifacts.video.create()` |

**Customization Options:**

<details>
<summary><strong>Quiz Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `numberOfQuestions` | `1`, `2`, `3` | **1** = Fewer (5-10 questions), **2** = Standard (10-15 questions), **3** = More (15-20+ questions) | `2` |
| `difficulty` | `1`, `2`, `3` | **1** = Easy (basic recall), **2** = Medium (application), **3** = Hard (analysis/synthesis) | `2` |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Example:**
```typescript
customization: {
  numberOfQuestions: 2, // Standard (10-15 questions)
  difficulty: 2, // Medium difficulty
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Flashcard Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `numberOfCards` | `1`, `2`, `3` | **1** = Fewer (10-15 cards), **2** = Standard (15-25 cards), **3** = More (25-40+ cards) | `2` |
| `difficulty` | `1`, `2`, `3` | **1** = Easy (basic terms), **2** = Medium (concepts), **3** = Hard (complex relationships) | `2` |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Example:**
```typescript
customization: {
  numberOfCards: 3, // More cards (25-40+)
  difficulty: 1, // Easy (basic terms)
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Slide Deck Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `format` | `2`, `3` | **2** = Presenter slides (concise, bullet points), **3** = Detailed deck (comprehensive, full content) | `2` |
| `length` | `1`, `2`, `3` | **1** = Short (5-10 slides), **2** = Default (10-15 slides), **3** = Long (15-25+ slides) | `2` |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Example:**
```typescript
customization: {
  format: 2, // Presenter slides (concise)
  length: 2, // Default (10-15 slides)
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Infographic Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `orientation` | `1`, `2`, `3` | **1** = Landscape (wide format), **2** = Portrait (tall format), **3** = Square (1:1 aspect ratio) | `1` |
| `levelOfDetail` | `1`, `2`, `3` | **1** = Concise (key points only), **2** = Standard (balanced detail), **3** = Detailed (comprehensive information) | `2` |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Example:**
```typescript
customization: {
  orientation: 1, // Landscape (wide format)
  levelOfDetail: 2, // Standard detail
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Audio Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `format` | `0`, `1`, `2`, `3` | **0** = Deep dive (comprehensive analysis), **1** = Brief (quick summary), **2** = Critique (critical analysis), **3** = Debate (multiple perspectives) | `0` |
| `length` | `1`, `2`, `3` | **1** = Short (2-5 minutes), **2** = Default (5-10 minutes), **3** = Long (10-15+ minutes) | `2` |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Note:** Audio artifacts always use all sources in the notebook. The `sourceIds` option is ignored.

**Example:**
```typescript
customization: {
  format: 0, // Deep dive (comprehensive analysis)
  length: 2, // Default (5-10 minutes)
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Video Customization</strong></summary>

| Option | Values | Description | Default |
|-------|--------|-------------|---------|
| `format` | `1`, `2` | **1** = Explainer (comprehensive explanation), **2** = Brief (quick overview) | `1` |
| `visualStyle` | `0-10` | Visual style for the video (see table below) | `0` |
| `focus` | `string` | What should the AI hosts focus on? (optional, e.g., "Key concepts and main findings") | - |
| `customStyleDescription` | `string` | Custom visual style description (required when `visualStyle=1`) | - |
| `language` | `string` | Language code (e.g., `'en'`, `'hi'`, `'es'`). Use `NotebookLMLanguage` enum for type safety. Supports 80+ languages. | `'en'` |

**Visual Style Options:**

| Value | Style Name | Description |
|-------|------------|-------------|
| `0` | Auto-select | AI chooses the best style automatically (default) |
| `1` | Custom | Requires `customStyleDescription` - describe your desired style |
| `2` | Classic | Traditional, professional style |
| `3` | Whiteboard | Hand-drawn whiteboard style |
| `4` | Kawaii | Cute, colorful style |
| `5` | Anime | Anime-inspired style |
| `6` | Watercolour | Watercolor painting style |
| `7` | Anime (alternative) | Alternative anime style |
| `8` | Retro print | Vintage print/poster style |
| `9` | Heritage | Traditional ink-wash/woodcut style |
| `10` | Paper-craft | Layered paper cutout style |

**Note:** 
- All styles except Custom (`1`) support only the `focus` option
- Custom (`1`) additionally requires `customStyleDescription`
- Video artifacts **require** `sourceIds` to be provided (cannot use all sources)

**Example:**
```typescript
// Auto-select style
customization: {
  format: 1, // Explainer
  visualStyle: 0, // Auto-select (AI chooses)
  focus: 'Key concepts and main findings',
  language: NotebookLMLanguage.ENGLISH,
}

// Custom style
customization: {
  format: 1, // Explainer
  visualStyle: 1, // Custom
  customStyleDescription: 'Modern minimalist design with blue and white colors',
  focus: 'Key concepts and main findings',
  language: NotebookLMLanguage.ENGLISH,
}

// Specific style (e.g., Whiteboard)
customization: {
  format: 1, // Explainer
  visualStyle: 3, // Whiteboard style
  focus: 'Step-by-step explanation of the process',
  language: NotebookLMLanguage.ENGLISH,
}
```

</details>

<details>
<summary><strong>Report & Mind Map (No Customization)</strong></summary>

**Report** and **Mind Map** artifacts do not support customization options. They only support:
- `title?: string` - Artifact title (optional)
- `instructions?: string` - Custom instructions for generation (optional)
- `sourceIds?: string[]` - Specific source IDs to use (optional, uses all sources if omitted)

**Example:**
```typescript
// Create report
const report = await sdk.artifacts.report.create('notebook-id', {
  title: 'Research Report',
  instructions: 'Create a comprehensive research report',
  sourceIds: ['source-id-1', 'source-id-2'], // Optional
})

// Create mind map
const mindMap = await sdk.artifacts.mindmap.create('notebook-id', {
  title: 'Concept Map',
  instructions: 'Create a visual mind map of key concepts',
  sourceIds: ['source-id-1'], // Optional
})
```

</details>

**Source Selection Behavior:**

| Artifact Type | `sourceIds` Behavior |
|---------------|---------------------|
| **Quiz, Flashcards, Slide Deck, Infographic, Report, Mind Map** | Optional - omit to use all sources, or specify to use selected sources |
| **Audio** | Ignored - always uses all sources in notebook |
| **Video** | **Required** - must provide `sourceIds` (cannot use all sources) |

**Return Fields:**
- `artifactId: string` - Unique artifact ID (required for other operations)
- `type: ArtifactType` - Artifact type
- `state: ArtifactState` - Current state: `CREATING`, `READY`, or `FAILED`
- `title: string` - Artifact title
- `sourceIds?: string[]` - Source IDs used to create the artifact
- `createdAt?: string` - Creation timestamp
- `updatedAt?: string` - Last update timestamp

<details>
<summary><strong>Notes</strong></summary>

- Artifacts are created asynchronously - check `state` field to see if ready
- Use `get(artifactId)` to fetch full artifact data when `state === READY`
- Quota is checked before creation (if quota manager is enabled)
- Usage is recorded after successful creation
- Audio and video artifacts return `AudioOverview` / `VideoOverview` instead of `Artifact`
- Sub-services provide type-safe convenience methods (e.g., `sdk.artifacts.quiz.create()`)

</details>

**Usage:**
```typescript
import { ArtifactType } from 'notebooklm-kit'

// Generic create method
const quiz = await sdk.artifacts.create('notebook-id', ArtifactType.QUIZ, {
  title: 'Chapter 1 Quiz',
  instructions: 'Create questions covering key concepts',
  customization: {
    numberOfQuestions: 2, // Standard
    difficulty: 2, // Medium
    language: 'en',
  },
})

// Using sub-services (type-safe)
const quiz = await sdk.artifacts.quiz.create('notebook-id', {
  title: 'Chapter 1 Quiz',
  instructions: 'Create questions covering key concepts',
  customization: {
    numberOfQuestions: 2,
    difficulty: 2,
    language: 'en',
  },
})

const flashcards = await sdk.artifacts.flashcard.create('notebook-id', {
  customization: {
    numberOfCards: 3, // More cards
    difficulty: 1, // Easy
  },
})

const video = await sdk.artifacts.video.create('notebook-id', {
  instructions: 'Create a summary video',
  customization: {
    format: 1,
    visualStyle: 0,
    language: 'en',
  },
})

// Check if ready
if (quiz.state === ArtifactState.READY) {
  const fullQuiz = await sdk.artifacts.get(quiz.artifactId, 'notebook-id')
}
```

---

### List Artifacts

**Method:** `sdk.artifacts.list(notebookId, options?)`

**Example:** [artifact-list.ts](examples/artifact-list.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options?: { type?: ArtifactType; state?: ArtifactState }` - Filtering options (optional)

**Returns:** `Promise<Artifact[]>`

**Description:**
Lists all artifacts in a notebook. Supports filtering by type and/or state. Returns lightweight artifact metadata for display/selection.

**Return Fields:**
- `artifactId: string` - Unique artifact ID
- `type: ArtifactType` - Artifact type
- `state: ArtifactState` - Current state (`CREATING`, `READY`, `FAILED`)
- `title: string` - Artifact title
- `sourceIds?: string[]` - Source IDs used
- `createdAt?: string` - Creation timestamp
- `updatedAt?: string` - Last update timestamp

<details>
<summary><strong>Notes</strong></summary>

- Returns all artifact types (quiz, flashcards, report, mind map, infographic, slide deck, audio, video)
- Filtering is optional - returns all artifacts if no filters provided
- Does not include full artifact content (use `get()` for that)
- Check `state` field to see if artifacts are ready before fetching content

</details>

**Usage:**
```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// List all artifacts
const artifacts = await sdk.artifacts.list('notebook-id')
console.log(`Found ${artifacts.length} artifacts`)

// Filter by type
const quizzes = await sdk.artifacts.list('notebook-id', {
  type: ArtifactType.QUIZ,
})

// Filter by state
const ready = await sdk.artifacts.list('notebook-id', {
  state: ArtifactState.READY,
})

// Filter by both type and state
const readyQuizzes = await sdk.artifacts.list('notebook-id', {
  type: ArtifactType.QUIZ,
  state: ArtifactState.READY,
})

// Display artifacts
artifacts.forEach(artifact => {
  console.log(`${artifact.title} (${artifact.type}) - ${artifact.state}`)
})
```

---

### Get Artifact

**Method:** `sdk.artifacts.get(artifactId, notebookId?, options?)`

**Example:** [artifact-get.ts](examples/artifact-get.ts)

**Parameters:**
- `artifactId: string` - The artifact ID (required)
- `notebookId?: string` - Notebook ID (required for audio artifacts, optional for others)
- `options?: { exportToDocs?: boolean; exportToSheets?: boolean }` - Export options (for reports only)

**Returns:** `Promise<Artifact | QuizData | FlashcardData | AudioArtifact | VideoArtifact | any>`

**Description:**
Retrieves detailed artifact information. Automatically fetches full content when artifact is `READY`:
- **Quiz/Flashcards/Audio**: Downloads and returns full data (questions, flashcards array, audio data)
- **Video/Slides**: Returns URL for accessing the content
- **Reports**: Returns content or exports to Google Docs/Sheets if options provided
- **Infographics**: Returns image data with dimensions
- **Mind Maps**: Returns with `experimental: true` flag

**Return Types by Artifact Type:**

| Type | Returns | Content |
|------|---------|---------|
| Quiz | `QuizData` | Questions, options, correct answers, explanations |
| Flashcards | `FlashcardData` | Flashcards array, CSV, totalCards |
| Audio | `AudioArtifact` | Audio data (base64), saveToFile helper |
| Video | `VideoArtifact` | Video URL (`url` field) |
| Slides | `Artifact` | PDF URL (`url` field) |
| Report | `ReportContent` or `{exportUrl}` | Report content or export URL |
| Infographic | `InfographicImageData` | Image data, dimensions, URL |
| Mind Map | `Artifact` | Metadata with `experimental: true` |

**Report Export Options:**
- `exportToDocs?: boolean` - Export to Google Docs and return export URL
- `exportToSheets?: boolean` - Export to Google Sheets and return export URL
- If neither provided, returns report content as text/markdown/HTML/JSON

<details>
<summary><strong>Validation</strong></summary>

- Export options (`exportToDocs`, `exportToSheets`) can only be used with `REPORT` artifacts
- Throws error if export options are used on non-report artifacts
- `notebookId` is required for audio artifacts (must match `artifactId`)

</details>

<details>
<summary><strong>Notes</strong></summary>

- Automatically detects artifact type and fetches appropriate content
- For `READY` artifacts, returns full data instead of just metadata
- For `CREATING` or `FAILED` artifacts, returns metadata only
- Video and slides return URLs (use these URLs to access content)
- Quiz and flashcards return full structured data
- Audio returns data with `saveToFile()` helper function

</details>

**Usage:**
```typescript
import { ArtifactType, ArtifactState } from 'notebooklm-kit'

// Get quiz with full data
const quiz = await sdk.artifacts.get('quiz-id', 'notebook-id')
if (quiz.state === ArtifactState.READY) {
  console.log(`Quiz: ${quiz.title}`)
  console.log(`Questions: ${quiz.questions?.length || 0}`)
  quiz.questions?.forEach((q, i) => {
    console.log(`Q${i + 1}: ${q.question}`)
  })
}

// Get flashcards with full data
const flashcards = await sdk.artifacts.get('flashcard-id', 'notebook-id')
if (flashcards.state === ArtifactState.READY) {
  console.log(`Total cards: ${flashcards.totalCards}`)
  flashcards.flashcards?.forEach(card => {
    console.log(`Q: ${card.question} | A: ${card.answer}`)
  })
}

// Get video URL
const video = await sdk.artifacts.get('video-id', 'notebook-id')
if (video.url) {
  console.log(`Video URL: ${video.url}`)
}

// Get slide deck PDF URL
const slides = await sdk.artifacts.get('slide-id', 'notebook-id')
if (slides.url) {
  console.log(`PDF URL: ${slides.url}`)
}

// Get report content
const report = await sdk.artifacts.get('report-id', 'notebook-id')
console.log(`Report: ${report.content?.title}`)
console.log(`Content: ${report.content?.content}`)

// Export report to Google Docs
const report = await sdk.artifacts.get('report-id', 'notebook-id', {
  exportToDocs: true,
})
console.log(`Docs URL: ${report.exportUrl}`)

// Export report to Google Sheets
const report = await sdk.artifacts.get('report-id', 'notebook-id', {
  exportToSheets: true,
})
console.log(`Sheets URL: ${report.exportUrl}`)

// Get audio with save helper
const audio = await sdk.artifacts.get('notebook-id', 'notebook-id') // audio uses notebook ID
if (audio.audioData && audio.saveToFile) {
  await audio.saveToFile('./audio.mp3')
}
```

---

### Download Artifact

**Method:** `sdk.artifacts.download(artifactId, folderPath, notebookId?)`

**Example:** [artifact-download.ts](examples/artifact-download.ts)

**Parameters:**
- `artifactId: string` - The artifact ID (required)
- `folderPath: string` - Output folder path (required)
- `notebookId?: string` - Notebook ID (required for audio artifacts)

**Returns:** `Promise<{ filePath: string; data: any }>`

**Description:**
Downloads artifact content and saves to disk. Automatically determines file format and saves with appropriate filename.

**Supported Artifacts:**

| Type | Format | Filename | Content |
|------|--------|----------|---------|
| Quiz | JSON | `quiz_{artifactId}_{timestamp}.json` | Complete quiz data with questions, options, answers, explanations |
| Flashcards | JSON | `flashcard_{artifactId}_{timestamp}.json` | Complete flashcard data with array, CSV, totalCards |
| Audio | Audio file | `audio_{artifactId}.mp3` | Audio file (binary) |
| Video | ⚠️ Experimental | N/A | Not implemented - use `get()` to retrieve URL |
| Slides | ⚠️ Experimental | N/A | Not implemented - use `get()` to retrieve PDF URL |

<details>
<summary><strong>Notes</strong></summary>

- Quiz and flashcards are saved as JSON files with complete data
- Audio is saved as binary file (format depends on backend)
- Video and slides downloads are experimental - use `get()` to get URLs instead
- Files are saved with timestamps to avoid overwrites
- Returns both file path and parsed data (for quiz/flashcards)

</details>

**Usage:**
```typescript
// Download quiz
const result = await sdk.artifacts.download('quiz-id', './downloads', 'notebook-id')
console.log(`Saved to: ${result.filePath}`)
console.log(`Questions: ${result.data.questions?.length || 0}`)

// Download flashcards
const result = await sdk.artifacts.download('flashcard-id', './downloads', 'notebook-id')
console.log(`Saved to: ${result.filePath}`)
console.log(`Total cards: ${result.data.totalCards}`)

// Download audio
const result = await sdk.artifacts.download('notebook-id', './downloads', 'notebook-id')
console.log(`Audio saved to: ${result.filePath}`)

// Video/Slides: Use get() instead
const video = await sdk.artifacts.get('video-id', 'notebook-id')
console.log(`Video URL: ${video.url}`) // Use this URL to download
```

---

### Rename Artifact

**Method:** `sdk.artifacts.rename(artifactId, newTitle)`

**Example:** [artifact-rename.ts](examples/artifact-rename.ts)

**Parameters:**
- `artifactId: string` - The artifact ID (required)
- `newTitle: string` - New title (required)

**Returns:** `Promise<Artifact>`

**Description:**
Renames an artifact. Updates only the title field. Works for all artifact types.

**Return Fields:**
Same as `get()` - returns updated artifact with new title

<details>
<summary><strong>Notes</strong></summary>

- Only updates the title - other fields remain unchanged
- Works for all artifact types (quiz, flashcards, report, mind map, infographic, slide deck, audio, video)
- Returns full artifact object after update

</details>

**Usage:**
```typescript
// Rename any artifact
const updated = await sdk.artifacts.rename('artifact-id', 'My Updated Quiz')
console.log(`New title: ${updated.title}`)

// Rename audio artifact (uses notebook ID)
const updated = await sdk.artifacts.rename('notebook-id', 'My Audio Overview')
```

---

### Delete Artifact

**Method:** `sdk.artifacts.delete(artifactId, notebookId?)`

**Example:** [artifact-delete.ts](examples/artifact-delete.ts)

**Parameters:**
- `artifactId: string` - The artifact ID (required)
- `notebookId?: string` - Notebook ID (required for audio/video artifacts)

**Returns:** `Promise<void>`

**Description:**
Permanently deletes an artifact. Works for all artifact types. This action cannot be undone.

<details>
<summary><strong>Notes</strong></summary>

- Deletion is permanent and cannot be undone
- Works for all artifact types
- Audio artifacts require passing notebook ID (same as `artifactId`)
- Video artifacts are detected automatically
- Other artifacts use standard delete RPC

</details>

**Usage:**
```typescript
// Delete any artifact
await sdk.artifacts.delete('artifact-id')

// Delete audio artifact (requires notebook ID)
await sdk.artifacts.delete('notebook-id', 'notebook-id')

// Delete video artifact
await sdk.artifacts.delete('video-id', 'notebook-id')
```

---

### Share Artifact

**Method:** `sdk.artifacts.share(notebookId, options)`

**Example:** [artifact-share.ts](examples/artifact-share.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required, artifacts are shared at notebook level)
- `options: ShareArtifactOptions`
  - `users?: Array<{email: string, role: 2|3|4}>` - Users to share with (optional)
  - `notify?: boolean` - Notify users (default: true, only used when users are provided)
  - `accessType?: 1|2` - Access type: 1=anyone with link, 2=restricted (optional, default: 2)

**Returns:** `Promise<ShareArtifactResult>`

**Description:**
Shares an artifact (or the notebook containing the artifact) with specific users or makes it publicly accessible via a shareable link. Artifacts are shared at the notebook level, so sharing an artifact shares the entire notebook.

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
- `shareUrl: string` - Share URL (always present)
- `success: boolean` - Whether the share operation succeeded
- `notebookId: string` - The notebook ID that was shared
- `accessType: 1|2` - Access type
- `isShared: boolean` - Whether the notebook is shared
- `users?: Array<{email: string, role: 2|3}>` - Users with access (if users were shared)

<details>
<summary><strong>Validation</strong></summary>

- Email addresses are validated using regex before sharing
- Throws `APIError` if any email is invalid
- Must provide either `users` array or `accessType=1` (anyone with link)
- Supports multiple users in a single call

</details>

<details>
<summary><strong>Notes</strong></summary>

- Artifacts are shared at the notebook level - sharing an artifact shares the entire notebook
- `notify` is only used when `users` are provided
- Default: `true` (users are notified when permissions change)
- Set to `false` to share silently
- `shareUrl` is always returned (constructed from notebook ID if not explicitly shared)

</details>

**Usage:**
```typescript
// Share with users (restricted access, notify enabled by default)
const result = await sdk.artifacts.share('notebook-id', {
  users: [
    { email: 'user1@example.com', role: 2 }, // editor
    { email: 'user2@example.com', role: 3 }, // viewer
  ],
  notify: true,
  accessType: 2, // restricted
})

// Share with users (silent, no notification)
const result = await sdk.artifacts.share('notebook-id', {
  users: [
    { email: 'user@example.com', role: 2 },
  ],
  notify: false,
  accessType: 2,
})

// Enable link sharing (anyone with link)
const result = await sdk.artifacts.share('notebook-id', {
  accessType: 1, // anyone with link
})
console.log(`Share URL: ${result.shareUrl}`)

// Remove user (role: 4)
const result = await sdk.artifacts.share('notebook-id', {
  users: [
    { email: 'user@example.com', role: 4 }, // remove
  ],
  accessType: 2,
})
```

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
