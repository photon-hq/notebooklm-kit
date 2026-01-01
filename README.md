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
| **[`sdk.sources`](#sdksources---source-management)** | Add & manage sources | `list()`, `get()`, `add.url()`, `add.text()`, `add.youtube()`, `add.web.searchAndWait()`, `update()`, `delete()`, `status()` |
| **[`sdk.artifacts`](#sdkartifacts---artifact-management)** | Generate study materials | `create()`, `list()`, `get()`, `download()`, `delete()`, `rename()`, `share()` |
| **[`sdk.generation`](#sdkgeneration---generation--chat)** | Chat & content generation | `chat()`, `setChatConfig()`, `generateDocumentGuides()`, `deleteChatHistory()` |
| **[`sdk.notes`](#sdknotes---notes-management)** | Manage notes | `create()`, `list()`, `update()`, `delete()` |

## Installation

**From npm:**
```bash
npm install notebooklm-kit
```

**From GitHub:**
```bash
git clone https://github.com/photon-hq/notebooklm-kit.git && cd notebooklm-kit && npm install
```

**Requirements:** Node.js >=18.0.0

<details>
<summary><strong>Development</strong></summary>

**Build only (no reinstall):**
```bash
npm run build:dev
```

**Watch mode (auto-rebuild):**
```bash
npm run dev
```

</details>

## Features

### `sdk.notebooks` - Notebook Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Notebooks | List all your notebooks (recently viewed) | [`sdk.notebooks.list()`](#list-notebooks) | [notebook-list.ts](examples/notebook-list.ts) |
| Get Notebook | Get full details of a specific notebook | [`sdk.notebooks.get(notebookId)`](#get-notebook) | [notebook-get.ts](examples/notebook-get.ts) |
| Create Notebook | Create a new notebook (auto-generates title if empty) | [`sdk.notebooks.create(options)`](#create-notebook) | [notebook-create.ts](examples/notebook-create.ts) |
| Update Notebook | Update notebook title or emoji | [`sdk.notebooks.update(notebookId, options)`](#update-notebook) | [notebook-update.ts](examples/notebook-update.ts) |
| Delete Notebook | Delete one or more notebooks | [`sdk.notebooks.delete(notebookIds)`](#delete-notebook) | [notebook-delete.ts](examples/notebook-delete.ts) |
| Share Notebook | Share notebook with users or enable link sharing | [`sdk.notebooks.share(notebookId, options)`](#share-notebook) | [notebook-share.ts](examples/notebook-share.ts) |

### `sdk.sources` - Source Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Sources | List all sources in a notebook | [`sdk.sources.list(notebookId)`](#list-sources) | [source-list.ts](examples/source-list.ts) |
| Get Source | Get one or all sources | [`sdk.sources.get(notebookId, sourceId?)`](#get-source) | [source-get.ts](examples/source-get.ts) |
| Add URL | Add a source from a web page URL | [`sdk.sources.add.url(notebookId, options)`](#add-url-source) | [source-add-url.ts](examples/source-add-url.ts) |
| Add Text | Add a source from text content | [`sdk.sources.add.text(notebookId, options)`](#add-text-source) | [source-add-text.ts](examples/source-add-text.ts) |
| Add File | Add a source from a file (PDF, image, etc.) | [`sdk.sources.add.file(notebookId, options)`](#add-file-source) | [source-add-file.ts](examples/source-add-file.ts) |
| Add YouTube | Add a YouTube video as a source | [`sdk.sources.add.youtube(notebookId, options)`](#add-youtube-source) | [source-add-youtube.ts](examples/source-add-youtube.ts) |
| Add Google Drive | Add a Google Drive file as a source | [`sdk.sources.add.drive(notebookId, options)`](#add-google-drive-source) | [source-add-drive.ts](examples/source-add-drive.ts) |
| Batch Add | Add multiple sources at once | [`sdk.sources.add.batch(notebookId, options)`](#batch-add-sources) | [source-add-batch.ts](examples/source-add-batch.ts) |
| Web Search (Simple) | Search web and wait for results | [`sdk.sources.add.web.searchAndWait(notebookId, options)`](#web-search-simple) | [source-web-search.ts](examples/source-web-search.ts) |
| Web Search (Advanced) | Multi-step web search workflow | [`sdk.sources.add.web.search()`](#web-search-advanced) → `getResults()` → `addDiscovered()` | [source-web-search-advanced.ts](examples/source-web-search-advanced.ts) |
| Update Source | Update source metadata | [`sdk.sources.update(notebookId, sourceId, updates)`](#update-source) | [source-update.ts](examples/source-update.ts) |
| Delete Source | Delete a source from a notebook | [`sdk.sources.delete(notebookId, sourceId)`](#delete-source) | [source-delete.ts](examples/source-delete.ts) |
| Check Status | Check source processing status | [`sdk.sources.status(notebookId)`](#check-processing-status) | [source-status.ts](examples/source-status.ts) |

### `sdk.artifacts` - Artifact Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| Create Artifact | Create study material (quiz, flashcards, mind map, etc.) | [`sdk.artifacts.create()`](#create-artifact) or `sdk.artifacts.{type}.create()` | [artifact-create.ts](examples/artifact-create.ts)<br>[artifact-create-subservices.ts](examples/artifact-create-subservices.ts) |
| List Artifacts | List all artifacts in a notebook (with filtering) | [`sdk.artifacts.list()`](#list-artifacts) | [artifact-list.ts](examples/artifact-list.ts) |
| Get Artifact | Get artifact details (auto-fetches content when ready) | [`sdk.artifacts.get()`](#get-artifact) | [artifact-get.ts](examples/artifact-get.ts) |
| Download Artifact | Download artifact data to disk (quiz/flashcard JSON, audio file) | [`sdk.artifacts.download()`](#download-artifact) | [artifact-download.ts](examples/artifact-download.ts) |
| Download Video | Download video artifact as MP4 file | [`sdk.artifacts.get()`](#get-artifact) with `outputPath` or [`sdk.artifacts.download()`](#download-artifact) | [artifact-video.ts](examples/artifact-video.ts) |
| Download Slides | Download slide deck as PDF or PNG files | [`sdk.artifacts.get()`](#get-artifact) with `outputPath` and `downloadAs` or [`sdk.artifacts.download()`](#download-artifact) | [artifact-slide.ts](examples/artifact-slide.ts) |
| Rename Artifact | Rename an artifact | [`sdk.artifacts.rename()`](#rename-artifact) | [artifact-rename.ts](examples/artifact-rename.ts) |
| Delete Artifact | Delete an artifact | [`sdk.artifacts.delete()`](#delete-artifact) | [artifact-delete.ts](examples/artifact-delete.ts) |
| Share Artifact | Share artifact/notebook with users or enable link sharing | [`sdk.artifacts.share()`](#share-artifact) | [artifact-share.ts](examples/artifact-share.ts) |

### `sdk.generation` - Generation & Chat

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| Chat | Chat with notebook content (with source selection & conversation history) | [`sdk.generation.chat(notebookId, prompt, options?)`](#chat) | [chat-basic.ts](examples/chat-basic.ts) |
| Chat with Sources | Chat with specific sources | [`sdk.generation.chat(notebookId, prompt, { sourceIds })`](#chat) | [chat-with-sources.ts](examples/chat-with-sources.ts) |
| Chat Conversation | Chat with conversation history | [`sdk.generation.chat(notebookId, prompt, { conversationHistory })`](#chat) | [chat-conversation.ts](examples/chat-conversation.ts) |
| Set Chat Config | Configure chat (custom prompt, learning guide, response length) | [`sdk.generation.setChatConfig(notebookId, config)`](#set-chat-configuration) | [generation-set-chat-config.ts](examples/generation-set-chat-config.ts) |
| Generate Document Guides | Generate document guides for all or specific sources | [`sdk.generation.generateDocumentGuides(notebookId, sourceId?)`](#generate-document-guides) | [generation-document-guides.ts](examples/generation-document-guides.ts) |
| Delete Chat History | Delete a conversation history | [`sdk.generation.deleteChatHistory(notebookId, conversationId)`](#delete-chat-history) | [generation-delete-chat-history.ts](examples/generation-delete-chat-history.ts) |

### `sdk.notes` - Notes Management

| Feature | Description | Method | Example |
|---------|-------------|--------|---------|
| List Notes | List all notes in a notebook | [`sdk.notes.list(notebookId)`](#list-notes) | [note-list.ts](examples/note-list.ts) |
| Create Note | Create a new note | [`sdk.notes.create(notebookId, options)`](#create-note) | [note-create.ts](examples/note-create.ts) |
| Update Note | Update a note | [`sdk.notes.update(notebookId, noteId, options)`](#update-note) | [note-update.ts](examples/note-update.ts) |
| Delete Note | Delete a note | [`sdk.notes.delete(notebookId, noteIds)`](#delete-note) | [note-delete.ts](examples/note-delete.ts) |

## Core Concepts

### SDK Initialization

**Methods:** `sdk.connect()` | `sdk.dispose()`

**Connect:**
```typescript
const sdk = new NotebookLMClient({
  auth: { email: '...', password: '...' },
  // or
  authToken: '...',
  cookies: '...',
});

await sdk.connect(); // Initialize SDK, authenticate, start auto-refresh
// Now you can use sdk.notebooks, sdk.sources, etc.
```

**Dispose:**
```typescript
await sdk.dispose(); // Stop auto-refresh, clean up resources
```

<details>
<summary><strong>Connection Flow</strong></summary>

1. **Credentials Resolution** (in priority order):
   - Provided in config (`authToken`/`cookies`)
   - Environment variables (`NOTEBOOKLM_AUTH_TOKEN`/`NOTEBOOKLM_COOKIES`)
   - Saved credentials (`credentials.json` in project root) - **reused automatically**
   - Auto-login (if `auth.email`/`auth.password` provided) - **only if no saved credentials**
   
   **Note:** Set `FORCE_REAUTH=true` in `.env` to force re-authentication and ignore saved credentials

2. **Initialization:**
   - Creates RPC client with credentials
   - Initializes all services (`notebooks`, `sources`, `artifacts`, etc.)
   - Starts auto-refresh manager (if enabled)

3. **Auto-Refresh:**
   - Begins automatically after `connect()`
   - Runs in background, doesn't block operations
   - Updates credentials and cookies automatically

</details>

<details>
<summary><strong>Cleanup</strong></summary>

**Always call `dispose()` when done:**
- Stops auto-refresh background timers
- Prevents memory leaks
- Resets client state
- Required for graceful shutdown

```typescript
try {
  await sdk.connect();
  // ... use SDK ...
} finally {
  await sdk.dispose(); // Always cleanup
}
```

</details>

### Authentication

| Concept | Format | Details |
|---------|--------|---------|
| **Auth Token** | `"tokenValue:timestamp"` | Format: `ACi2F2NZSD7yrNvFMrCkP3vZJY1R:1766720233448`<br>Expires: 1 hour after timestamp<br>Extract: `window.WIZ_global_data.SNlM0e` in NotebookLM console |
| **Cookies** | Semicolon-separated string | `_ga=...; SID=...; SAPISID=...; ...`<br>Long-lived (2+ years for SAPISID)<br>Critical cookie: `SAPISID` (for refresh) |
| **Auto-Login** | Email + Password | Uses Playwright visible browser<br>Extracts auth token automatically<br>Prompts for cookies manually<br>Saves to `credentials.json` in project root |
| **Saved Credentials** | `credentials.json` | Automatically saved after manual cookie entry<br>Reused on subsequent runs<br>Located in project root for easy access |

<details>
<summary><strong>Credential Refresh Endpoint</strong></summary>

**URL:** `https://signaler-pa.clients6.google.com/punctual/v1/refreshCreds`

**Method:** POST

**Headers:**
- `Authorization: SAPISIDHASH <timestamp>_<hash>`
- `Cookie: <full cookie string>`
- `Content-Type: application/json+protobuf`

**SAPISIDHASH:** `SHA1(timestamp + " " + SAPISID + " " + origin)`<br>
**Origin:** `https://notebooklm.google.com`

**Purpose:** Extends session validity without re-authentication

</details>

<details>
<summary><strong>Auto-Refresh Strategies</strong></summary>

| Strategy | Description | When to Use | Default |
|----------|-------------|-------------|---------|
| **auto** | Expiration-based + time-based fallback | Most use cases (recommended) | ✅ Yes |
| **time** | Fixed interval refresh | Testing, simple scenarios | 10 min |
| **expiration** | Only when token expires | Maximum efficiency, production | 5 min before expiry |

```typescript
// Auto (default - recommended)
autoRefresh: { strategy: 'auto' }

// Time-based
autoRefresh: { strategy: 'time', interval: 10 * 60 * 1000 }

// Expiration-based
autoRefresh: { strategy: 'expiration', refreshAhead: 5 * 60 * 1000 }
```

</details>

### Quota Limits

Reference: [Official Documentation](https://support.google.com/notebooklm/answer/16213268)

**Plan Types:** `standard` (default) | `plus` | `pro` | `ultra`

| Limit | Standard | Plus | Pro | Ultra |
|-------|----------|------|-----|-------|
| **Notebooks** | 100/user | 200/user | 500/user | 500/user |
| **Sources/Notebook** | 50 | 100 | 300 | 600 |
| **Words/Source** | 500,000 | 500,000 | 500,000 | 500,000 |
| **File Size** | 200MB | 200MB | 200MB | 200MB |
| **Chats/Day** | 50 | 200 | 500 | 5,000 |
| **Audio/Video/Day** | 3 | 6 | 20 | 200 |
| **Reports/Day** | 10 | 20 | 100 | 1,000 |
| **Deep Research/Month** | 10 | 90 | 600 | 6,000 |
| **Mind Maps** | Unlimited | Unlimited | Unlimited | Unlimited |

<details>
<summary><strong>Important Notes</strong></summary>

- **Daily quotas** reset after 24 hours
- **Monthly quotas** reset after 30 days
- **Word/File Limits:** NotebookLM rejects sources >500k words or >200MB. Copy-protected PDFs cannot be imported.
- **Server-Side Enforcement:** Data Tables, Infographics, Slides (limits vary)
- **Client-Side Validation:** Optional (`enforceQuotas: true`), disabled by default
- **Plan Selection:** Set during SDK initialization: `plan: 'pro'`

</details>

## Authentication

### Auto-Login (Recommended)

**Method:** Use `auth` config with email/password

```typescript
const sdk = new NotebookLMClient({
  auth: {
    email: process.env.GOOGLE_EMAIL,
    password: process.env.GOOGLE_PASSWORD,
    headless: true, // default: true
  },
});

await sdk.connect(); // Logs in, extracts auth token, prompts for cookies, saves to credentials.json
```

<details>
<summary><strong>Environment Variables</strong></summary>

```bash
# .env

# Auto-login (recommended)
GOOGLE_EMAIL="your-email@gmail.com"
GOOGLE_PASSWORD="your-password"

# Manual credentials (alternative)
NOTEBOOKLM_AUTH_TOKEN="ACi2F2NZSD7yrNvFMrCkP3vZJY1R:1766720233448"
NOTEBOOKLM_COOKIES="_ga=GA1.1.1949425436.1764104083; SID=g.a0005AiwX...; ..."

# Retry configuration (optional)
NOTEBOOKLM_MAX_RETRIES=1          # Default: 1
NOTEBOOKLM_RETRY_DELAY=1000       # Default: 1000ms
NOTEBOOKLM_RETRY_MAX_DELAY=5000   # Default: 5000ms

# Force re-authentication (optional)
FORCE_REAUTH=true                 # Force re-authentication, ignore saved credentials
```

**Important:** Account must NOT have 2FA enabled (or use app-specific passwords)

</details>

### Manual Credentials

**Method:** Provide `authToken` and `cookies` directly

```typescript
const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  enforceQuotas: true, // optional
  plan: 'standard', // optional: 'standard' | 'plus' | 'pro' | 'ultra'
});

await sdk.connect();
```

<details>
<summary><strong>Getting Credentials</strong></summary>

1. **Auth Token**: Open https://notebooklm.google.com → DevTools (F12) → Console → Run: `window.WIZ_global_data.SNlM0e`
2. **Cookies**: DevTools → Network tab → Any request → Headers → Copy Cookie value

</details>

### Saved Credentials

**Location:** `credentials.json` in project root (e.g., `notebooklm-kit/credentials.json`)

When using auto-login with email/password:
1. Browser opens and authenticates
2. Auth token is extracted automatically
3. You're prompted to manually paste cookies
4. Credentials are saved to `credentials.json` for future use

**Subsequent runs:**
- Saved credentials are automatically reused (no browser prompt)
- Faster startup - no need to re-enter cookies
- Credentials file is in project root for easy viewing/editing

**To force re-authentication:**
- Set `FORCE_REAUTH=true` in `.env`, or
- Delete `credentials.json` file

**Security Note:** `credentials.json` contains sensitive authentication data. It's automatically added to `.gitignore` to prevent accidental commits.

### Auto-Refresh Configuration

**Default:** Enabled with `'auto'` strategy (recommended)

```typescript
// Default: auto strategy (expiration-based + time-based fallback)
const sdk = new NotebookLMClient({
  auth: { email: '...', password: '...' },
  // autoRefresh: true (default)
});

// Time-based (simple, predictable)
autoRefresh: { strategy: 'time', interval: 10 * 60 * 1000 }

// Expiration-based (maximum efficiency)
autoRefresh: { strategy: 'expiration', refreshAhead: 5 * 60 * 1000 }

// Disable
autoRefresh: false

// Manual refresh
await sdk.refreshCredentials();
```

<details>
<summary><strong>Auto-Refresh Details</strong></summary>

- Credentials updated automatically after refresh
- Cookies kept in sync
- Runs in background, doesn't block operations
- See [Auto-Refresh Strategies](#auto-refresh-strategies) in Core Concepts

</details>

### Quota Management

**Method:** `sdk.getUsage()` | `sdk.getRemaining()` | `sdk.getQuotaManager()`

```typescript
const sdk = new NotebookLMClient({
  auth: { email: '...', password: '...' },
  enforceQuotas: true, // Enable client-side validation (disabled by default)
  plan: 'pro', // Set plan for accurate limits
});

await sdk.connect();

// Check usage
const usage = sdk.getUsage();
const remaining = sdk.getRemaining('chats');
const limits = sdk.getQuotaManager().getLimits();
```

<details>
<summary><strong>Quota Notes</strong></summary>

- **Disabled by default** - enable with `enforceQuotas: true`
- Throws `RateLimitError` if limit exceeded (when enabled)
- Server-side enforcement always active (even if client-side disabled)
- See [Quota Limits](#quota-limits) table in Core Concepts

</details>

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
  - `emoji?: string` - Notebook emoji (optional)

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

// With title and emoji
const notebook = await sdk.notebooks.create({
  title: 'My Research Project',
  emoji: '📚',
})

// Auto-generated title
const untitled = await sdk.notebooks.create({})

// With description and emoji
const notebook = await sdk.notebooks.create({
  title: 'Project Notes',
  description: 'Initial project description',
  emoji: '🔬',
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
  - `emoji?: string` - New emoji (optional)
  - `metadata?: Record<string, any>` - Other metadata updates (optional)

**Returns:** `Promise<Notebook>` (same as `get()` - full notebook details)

**Description:**
Updates notebook title, description, or emoji. Returns full notebook details after update (same structure as `get()`). Supports updating emoji only, title only, or both together.

<details>
<summary><strong>Validation</strong></summary>

- At least one field (`title`, `description`, or `emoji`) must be provided
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

// Update emoji only
const updated = await sdk.notebooks.update('notebook-id', {
  emoji: '🔥',
})

// Update both title and emoji
const updated = await sdk.notebooks.update('notebook-id', {
  title: 'New Title',
  emoji: '⭐',
})

// Update all fields
const updated = await sdk.notebooks.update('notebook-id', {
  title: 'New Title',
  emoji: '🎯',
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

## Sources

Examples: [source-list.ts](examples/source-list.ts) | [source-get.ts](examples/source-get.ts) | [source-add-url.ts](examples/source-add-url.ts) | [source-add-text.ts](examples/source-add-text.ts) | [source-add-file.ts](examples/source-add-file.ts) | [source-add-youtube.ts](examples/source-add-youtube.ts) | [source-add-drive.ts](examples/source-add-drive.ts) | [source-add-batch.ts](examples/source-add-batch.ts) | [source-web-search.ts](examples/source-web-search.ts) | [source-web-search-advanced.ts](examples/source-web-search-advanced.ts) | [source-update.ts](examples/source-update.ts) | [source-delete.ts](examples/source-delete.ts) | [source-status.ts](examples/source-status.ts)

### List Sources

**Method:** `sdk.sources.list(notebookId)`

**Example:** [source-list.ts](examples/source-list.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)

**Returns:** `Promise<Source[]>`

**Description:**
Retrieves a list of all sources (URLs, text, files, YouTube videos, Google Drive files, etc.) associated with a notebook. Sources are extracted from the notebook response efficiently without requiring a separate RPC call.

**Return Fields:**
- `sourceId: string` - Unique identifier for the source
- `title?: string` - Source title/name
- `type?: SourceType` - Source type (URL, TEXT, PDF, YOUTUBE_VIDEO, GOOGLE_DRIVE, IMAGE, etc.)
- `url?: string` - Source URL (for URL/YouTube sources)
- `createdAt?: string` - Creation timestamp (ISO format)
- `updatedAt?: string` - Last modified timestamp (ISO format)
- `status?: SourceStatus` - Processing status (`PROCESSING`, `READY`, `FAILED`)
- `metadata?: Record<string, any>` - Additional metadata (file size, MIME type, etc.)

**Source Types:**
- `URL` - Web page URL
- `TEXT` - Text content
- `PDF` - PDF file
- `YOUTUBE_VIDEO` - YouTube video
- `GOOGLE_DRIVE` - Google Drive file
- `IMAGE` - Image file
- `VIDEO_FILE` - Video file upload
- `PDF_FROM_DRIVE` - PDF from Google Drive
- `TEXT_NOTE` - Text note
- `MIND_MAP_NOTE` - Mind map note

<details>
<summary><strong>Notes</strong></summary>

- Sources are extracted from the notebook response (same RPC as `notebooks.get()`)
- Processing status is inferred from source metadata
- Returns empty array if notebook has no sources
- File size and MIME type are included in metadata when available

</details>

**Usage:**
```typescript
// List all sources
const sources = await sdk.sources.list('notebook-id')
console.log(`Found ${sources.length} sources`)

// Filter by type
const pdfs = sources.filter(s => s.type === SourceType.PDF)
const urls = sources.filter(s => s.type === SourceType.URL)

// Check processing status
const ready = sources.filter(s => s.status === SourceStatus.READY)
const processing = sources.filter(s => s.status === SourceStatus.PROCESSING)
```

---

### Get Source

**Method:** `sdk.sources.get(notebookId, sourceId?)`

**Example:** [source-get.ts](examples/source-get.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sourceId?: string` - Optional source ID to get a single source

**Returns:** `Promise<Source | Source[]>` - Single source if `sourceId` provided, array of all sources if omitted

**Description:**
Get one or all sources from a notebook. If `sourceId` is provided, returns a single source. If omitted, returns all sources (same as `list()`).

**Return Fields:**
Same as `list()` - see [List Sources](#list-sources) for field descriptions.

<details>
<summary><strong>Notes</strong></summary>

- Returns array if `sourceId` is omitted (same as `list()`)
- Returns single source object if `sourceId` is provided
- Throws error if source not found when `sourceId` is provided
- Efficiently reuses notebook data (no separate RPC call)

</details>

**Usage:**
```typescript
// Get all sources
const allSources = await sdk.sources.get('notebook-id')

// Get specific source
const source = await sdk.sources.get('notebook-id', 'source-id')
console.log(source.title)
```

---

### Add URL Source

**Method:** `sdk.sources.add.url(notebookId, options)`

**Example:** [source-add-url.ts](examples/source-add-url.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddSourceFromURLOptions`
  - `url: string` - URL to add (required)
  - `title?: string` - Optional custom title

**Returns:** `Promise<string>` - Source ID

**Description:**
Adds a web page URL as a source. Returns immediately after source is queued. Use `status()` to check if source is ready.

<details>
<summary><strong>Notes</strong></summary>

- Returns immediately after source is queued (does not wait for processing)
- Quota is checked before adding
- Use `status()` to check if source is ready
- URL must be a valid HTTP/HTTPS URL

</details>

**Usage:**
```typescript
const sourceId = await sdk.sources.add.url('notebook-id', {
  url: 'https://ai.google.dev/',
  title: 'Google AI Developer',
})

// Check if ready
const status = await sdk.sources.status('notebook-id')
if (!status.processing.includes(sourceId)) {
  console.log('Source is ready!')
}
```

---

### Add Text Source

**Method:** `sdk.sources.add.text(notebookId, options)`

**Example:** [source-add-text.ts](examples/source-add-text.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddSourceFromTextOptions`
  - `content: string` - Text content (required)
  - `title: string` - Source title (required)

**Returns:** `Promise<string>` - Source ID

**Description:**
Adds text content as a source. Useful for adding notes, research summaries, or any text-based content.

**Usage:**
```typescript
const sourceId = await sdk.sources.add.text('notebook-id', {
  title: 'Research Notes',
  content: 'Key findings from research...',
})
```

---

### Add File Source

**Method:** `sdk.sources.add.file(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddSourceFromFileOptions`
  - `content: Buffer | string` - File content as Buffer or base64 string (required)
  - `fileName: string` - File name (required)
  - `mimeType?: string` - MIME type (optional, auto-detected if not provided)

**Returns:** `Promise<string>` - Source ID

**Description:**
Adds a file (PDF, image, video, etc.) as a source. Supports files as Buffer or base64 string.

**Supported File Types:**
- PDF files
- Image files (PNG, JPG, etc.)
- Video files
- Other document types

**Usage:**
```typescript
import fs from 'fs'

// From file buffer
const fileBuffer = fs.readFileSync('document.pdf')
const sourceId = await sdk.sources.add.file('notebook-id', {
  content: fileBuffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
})

// From base64 string
const base64Content = fileBuffer.toString('base64')
const sourceId = await sdk.sources.add.file('notebook-id', {
  content: base64Content,
  fileName: 'document.pdf',
})
```

---

### Add YouTube Source

**Method:** `sdk.sources.add.youtube(notebookId, options)`

**Example:** [source-add-youtube.ts](examples/source-add-youtube.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddYouTubeSourceOptions`
  - `urlOrId: string` - YouTube URL or video ID (required)
  - `title?: string` - Optional custom title

**Returns:** `Promise<string>` - Source ID

**Description:**
Adds a YouTube video as a source. Accepts either full YouTube URL or just the video ID.

**Usage:**
```typescript
// From YouTube URL
const sourceId = await sdk.sources.add.youtube('notebook-id', {
  urlOrId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
})

// From video ID
const sourceId = await sdk.sources.add.youtube('notebook-id', {
  urlOrId: 'dQw4w9WgXcQ',
})
```

---

### Add Google Drive Source

**Method:** `sdk.sources.add.drive(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddGoogleDriveSourceOptions`
  - `fileId: string` - Google Drive file ID (required)
  - `title?: string` - Optional custom title
  - `mimeType?: string` - MIME type (optional, inferred if not provided)

**Returns:** `Promise<string>` - Source ID

**Description:**
Adds a Google Drive file as a source. Requires the file ID from Google Drive.

<details>
<summary><strong>Deprecated</strong></summary>

This method is deprecated. Use `add.batch()` with `type: 'gdrive'` instead.

</details>

**Usage:**
```typescript
const sourceId = await sdk.sources.add.drive('notebook-id', {
  fileId: '1a2b3c4d5e6f7g8h9i0j',
  mimeType: 'application/vnd.google-apps.document',
  title: 'My Document',
})
```

---

### Batch Add Sources

**Method:** `sdk.sources.add.batch(notebookId, options)`

**Example:** [source-add-batch.ts](examples/source-add-batch.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: BatchAddSourcesOptions`
  - `sources: Array<...>` - Array of source inputs (required)
  - `waitForProcessing?: boolean` - Whether to wait for all sources to be processed (default: false)
  - `timeout?: number` - Timeout in ms if `waitForProcessing` is true (default: 300000 = 5 minutes)
  - `pollInterval?: number` - Poll interval in ms (default: 2000 = 2 seconds)
  - `onProgress?: (ready: number, total: number) => void` - Progress callback

**Returns:** `Promise<string[]>` - Array of source IDs

**Description:**
Adds multiple sources at once. Supports mixed source types (URLs, text, files, YouTube, Google Drive) in a single call.

**Source Types:**
- `{ type: 'url', url: string, title?: string }` - URL source
- `{ type: 'text', title: string, content: string }` - Text source
- `{ type: 'file', content: Buffer | string, fileName: string, mimeType?: string }` - File source
- `{ type: 'youtube', urlOrId: string, title?: string }` - YouTube source
- `{ type: 'gdrive', fileId: string, title?: string, mimeType?: string }` - Google Drive source

**Usage:**
```typescript
const sourceIds = await sdk.sources.add.batch('notebook-id', {
  sources: [
    { type: 'url', url: 'https://example.com', title: 'Example' },
    { type: 'text', title: 'Notes', content: 'Content here...' },
    { type: 'youtube', urlOrId: 'dQw4w9WgXcQ' },
  ],
  waitForProcessing: true, // Optional: wait for all to be ready
  timeout: 300000, // 5 minutes
  onProgress: (ready, total) => {
    console.log(`Progress: ${ready}/${total}`)
  },
})
```

---

### Web Search (Simple)

**Method:** `sdk.sources.add.web.searchAndWait(notebookId, options)`

**Example:** [source-web-search.ts](examples/source-web-search.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: SearchWebAndWaitOptions`
  - `query: string` - Search query (required)
  - `sourceType?: SearchSourceType` - Source type: `WEB` (default) or `GOOGLE_DRIVE`
  - `mode?: ResearchMode` - Research mode: `FAST` (default) or `DEEP` (web only)
  - `timeout?: number` - Max wait time in ms (default: 60000 = 60 seconds)
  - `pollInterval?: number` - Poll interval in ms (default: 2000 = 2 seconds)
  - `onProgress?: (status) => void` - Progress callback

**Returns:** `Promise<WebSearchResult>` - Results with `sessionId`, `web` sources, and `drive` sources

**Description:**
**RECOMMENDED FOR SIMPLE WORKFLOWS** - One call that searches and waits for results automatically. Returns all discovered sources once available (or timeout). Perfect for automated workflows where you don't need to see intermediate steps.

**Research Modes:**
- `ResearchMode.FAST` - Quick search (~10-30 seconds, default)
- `ResearchMode.DEEP` - Comprehensive research (~60-120 seconds, web only)

**Source Types:**
- `SearchSourceType.WEB` - Search web (default)
- `SearchSourceType.GOOGLE_DRIVE` - Search Google Drive (FAST mode only)

**Return Fields:**
- `sessionId: string` - Required for adding sources (use with `addDiscovered()`)
- `web: DiscoveredWebSource[]` - Discovered web sources
- `drive: DiscoveredDriveSource[]` - Discovered Google Drive sources

<details>
<summary><strong>Notes</strong></summary>

- Automatically polls for results until available or timeout
- Returns results once count stabilizes (assumes search complete)
- Progress callback shows result count as search progresses
- Use returned `sessionId` with `addDiscovered()` to add selected sources

</details>

**Usage:**
```typescript
import { ResearchMode, SearchSourceType } from 'notebooklm-kit'

// Simple search and wait
const result = await sdk.sources.add.web.searchAndWait('notebook-id', {
  query: 'machine learning research papers 2024',
  mode: ResearchMode.DEEP, // Comprehensive search
  sourceType: SearchSourceType.WEB,
  timeout: 120000, // Wait up to 2 minutes
  onProgress: (status) => {
    console.log(`Found ${status.resultCount} results so far...`)
  },
})

console.log(`Found ${result.web.length} web sources`)
console.log(`Session ID: ${result.sessionId}`)

// Add selected sources
const addedIds = await sdk.sources.add.web.addDiscovered('notebook-id', {
  sessionId: result.sessionId,
  webSources: result.web.slice(0, 5), // Top 5
})
```

---

### Web Search (Advanced)

**Method:** `sdk.sources.add.web.search(notebookId, options)` → `sdk.sources.add.web.getResults(notebookId, sessionId)` → `sdk.sources.add.web.addDiscovered(notebookId, options)`

**Example:** [source-web-search-advanced.ts](examples/source-web-search-advanced.ts)

**Description:**
**MULTI-STEP WORKFLOW** - For cases where you want to see results and make decisions at each step. Returns intermediate results so you can validate, filter, or select before adding sources.

**Workflow Steps:**
1. **`search()`** - Start search, returns `sessionId` immediately
2. **`getResults(sessionId)`** - Get discovered sources (can call multiple times to poll)
3. **`addDiscovered(sessionId, selectedSources)`** - Add your selected sources

**Step 1: Start Search**

**Method:** `sdk.sources.add.web.search(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: SearchWebSourcesOptions`
  - `query: string` - Search query (required)
  - `sourceType?: SearchSourceType` - `WEB` (default) or `GOOGLE_DRIVE`
  - `mode?: ResearchMode` - `FAST` (default) or `DEEP` (web only)

**Returns:** `Promise<string>` - Session ID (required for steps 2 and 3)

**Step 2: Get Results**

**Method:** `sdk.sources.add.web.getResults(notebookId, sessionId?)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sessionId?: string` - Session ID from step 1 (optional - if omitted, returns all results)

**Returns:** `Promise<{ web: DiscoveredWebSource[], drive: DiscoveredDriveSource[] }>`

**Step 3: Add Discovered Sources**

**Method:** `sdk.sources.add.web.addDiscovered(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddDiscoveredSourcesOptions`
  - `sessionId: string` - Session ID from step 1 (required)
  - `webSources?: DiscoveredWebSource[]` - Web sources to add
  - `driveSources?: DiscoveredDriveSource[]` - Drive sources to add

**Returns:** `Promise<string[]>` - Array of added source IDs

**Usage:**
```typescript
// Step 1: Start search
const sessionId = await sdk.sources.add.web.search('notebook-id', {
  query: 'quantum computing',
  mode: ResearchMode.FAST,
})

// Step 2: Poll for results (you control when/how often)
let results
do {
  await new Promise(r => setTimeout(r, 2000)) // Wait 2 seconds
  results = await sdk.sources.add.web.getResults('notebook-id', sessionId)
  console.log(`Found ${results.web.length} sources...`)
} while (results.web.length === 0)

// Step 3: Filter and add selected sources
const relevant = results.web.filter(s => s.url.includes('arxiv.org'))
const addedIds = await sdk.sources.add.web.addDiscovered('notebook-id', {
  sessionId,
  webSources: relevant,
})
```

---

### Get Search Results

**Method:** `sdk.sources.add.web.getResults(notebookId, sessionId?)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sessionId?: string` - Optional session ID to filter results

**Returns:** `Promise<{ web: DiscoveredWebSource[], drive: DiscoveredDriveSource[] }>`

**Description:**
Returns discovered sources from search sessions. If `sessionId` is provided, filters results to that specific session. If omitted, returns all results (may include results from other searches).

**Usage:**
```typescript
// Get results for specific session
const results = await sdk.sources.add.web.getResults('notebook-id', sessionId)

// Get all results (no filtering)
const allResults = await sdk.sources.add.web.getResults('notebook-id')
```

---

### Add Discovered Sources

**Method:** `sdk.sources.add.web.addDiscovered(notebookId, options)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: AddDiscoveredSourcesOptions`
  - `sessionId: string` - Session ID from search (required)
  - `webSources?: DiscoveredWebSource[]` - Web sources to add
  - `driveSources?: DiscoveredDriveSource[]` - Drive sources to add

**Returns:** `Promise<string[]>` - Array of added source IDs

**Description:**
Adds selected discovered sources from search results. You decide which sources to add (from `getResults()` or `searchAndWait()`).

**Usage:**
```typescript
// After searchAndWait()
const result = await sdk.sources.add.web.searchAndWait(...)
const addedIds = await sdk.sources.add.web.addDiscovered('notebook-id', {
  sessionId: result.sessionId,
  webSources: result.web.slice(0, 5), // Top 5
})

// After manual search workflow
const addedIds = await sdk.sources.add.web.addDiscovered('notebook-id', {
  sessionId: sessionId,
  webSources: filteredSources,
  driveSources: selectedDriveSources,
})
```

---

### Update Source

**Method:** `sdk.sources.update(notebookId, sourceId, updates)`

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sourceId: string` - The source ID (required)
- `updates: Partial<Source>` - Fields to update
  - `title?: string` - New title

**Returns:** `Promise<void>`

**Description:**
Updates source metadata. Currently supports updating the title.

**Usage:**
```typescript
await sdk.sources.update('notebook-id', 'source-id', {
  title: 'Updated Source Title',
})
```

---

### Delete Source

**Method:** `sdk.sources.delete(notebookId, sourceId)`

**Example:** [source-delete.ts](examples/source-delete.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sourceId: string` - The source ID (required)

**Returns:** `Promise<void>`

**Description:**
Deletes a source from a notebook.

**Usage:**
```typescript
await sdk.sources.delete('notebook-id', 'source-id')
```

---

### Check Processing Status

**Method:** `sdk.sources.status(notebookId)`

**Example:** [source-status.ts](examples/source-status.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)

**Returns:** `Promise<SourceProcessingStatus>`

**Description:**
Checks the processing status of all sources in a notebook. Returns information about which sources are still processing and whether all sources are ready.

**Return Fields:**
- `allReady: boolean` - Whether all sources are ready
- `processing: string[]` - Array of source IDs still processing

**Usage:**
```typescript
const status = await sdk.sources.status('notebook-id')

if (status.allReady) {
  console.log('All sources are ready!')
} else {
  console.log(`Still processing: ${status.processing.length} sources`)
  console.log('Processing IDs:', status.processing)
}
```

---

## Artifacts

Examples: [artifact-create.ts](examples/artifact-create.ts) | [artifact-create-subservices.ts](examples/artifact-create-subservices.ts) | [artifact-list.ts](examples/artifact-list.ts) | [artifact-get.ts](examples/artifact-get.ts) | [artifact-download.ts](examples/artifact-download.ts) | [artifact-video.ts](examples/artifact-video.ts) | [artifact-slide.ts](examples/artifact-slide.ts) | [artifact-rename.ts](examples/artifact-rename.ts) | [artifact-delete.ts](examples/artifact-delete.ts) | [artifact-share.ts](examples/artifact-share.ts)

### Create Artifact

**Method:** `sdk.artifacts.create(notebookId, type, options)` or `sdk.artifacts.{type}.create(notebookId, options)`

**Examples:** 
- [artifact-create.ts](examples/artifact-create.ts) - Using main `create()` method
- [artifact-create-subservices.ts](examples/artifact-create-subservices.ts) - Using type-safe sub-service methods

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

**Examples:** [artifact-get.ts](examples/artifact-get.ts) | [artifact-video.ts](examples/artifact-video.ts) (video-specific) | [artifact-slide.ts](examples/artifact-slide.ts) (slide-specific)

**Parameters:**
- `artifactId: string` - The artifact ID from `create()` or `list()` (required)
- `notebookId?: string` - Optional notebook ID (helpful for audio/video if get() needs it)
- `options?: { exportToDocs?: boolean; exportToSheets?: boolean }` - Export options (for reports only)

**Returns:** `Promise<Artifact | QuizData | FlashcardData | AudioArtifact | VideoArtifact | any>`

**Description:**
Retrieves detailed artifact information. Automatically fetches full content when artifact is `READY`:
- **Quiz/Flashcards/Audio**: Downloads and returns full data (questions, flashcards array, audio data)
- **Video**: Downloads video (requires `outputPath` option) - returns download path
- **Slides**: Downloads slides (requires `outputPath` option) - returns download path
- **Reports**: Returns content or exports to Google Docs/Sheets if options provided
- **Infographics**: Returns image data with dimensions
- **Mind Maps**: Returns with `experimental: true` flag

**Return Types by Artifact Type:**

| Type | Returns | Content |
|------|---------|---------|
| Quiz | `QuizData` | Questions, options, correct answers, explanations |
| Flashcards | `FlashcardData` | Flashcards array, CSV, totalCards |
| Audio | `AudioArtifact` | Audio data (base64), saveToFile helper |
| Video | `Artifact` | Download path (`downloadPath` field, requires `outputPath` option) |
| Slides | `Artifact` | Download path (`downloadPath` field, requires `outputPath` option) |
| Report | `ReportContent` or `{exportUrl}` | Report content or export URL |
| Infographic | `InfographicImageData` | Image data, dimensions, URL |
| Mind Map | `Artifact` | Metadata with `experimental: true` |

**Report Export Options:**
- `exportToDocs?: boolean` - Export to Google Docs and return export URL
- `exportToSheets?: boolean` - Export to Google Sheets and return export URL
- If neither provided, returns report content as text/markdown/HTML/JSON

**Slide Download Options (Required):**
- `outputPath: string` - Directory path to save downloaded slides (required)
- `downloadAs?: 'pdf' | 'png'` - Download format: PDF (default) or PNG files
- PNG files are saved in a subfolder named after the artifact
- Slides always download - URL option is not available

**Video Download Options (Required):**
- `outputPath: string` - Directory path to save downloaded video (required)
- Videos are downloaded as MP4 files
- Videos always download - URL option is not available

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
- Video and slides always download (requires `outputPath` option) - returns download path
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

// Download video as MP4
const video = await sdk.artifacts.get('video-id', 'notebook-id', { 
  outputPath: './downloads' 
})
console.log(`Video saved to: ${video.downloadPath}`)

// Download slide deck as PDF (default)
const slides = await sdk.artifacts.get('slide-id', 'notebook-id', { 
  outputPath: './downloads' 
})
console.log(`PDF saved to: ${slides.downloadPath}`)

// Download slide deck as PNG files
const slidesPng = await sdk.artifacts.get('slide-id', 'notebook-id', { 
  downloadAs: 'png', 
  outputPath: './downloads' 
})
console.log(`PNG files saved to: ${slidesPng.downloadPath}`)

// Download video as MP4
const video = await sdk.artifacts.get('video-id', 'notebook-id', { 
  outputPath: './downloads' 
})
console.log(`Video saved to: ${video.downloadPath}`)

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

// Get audio with save helper (use audioId from create() or list())
const audioArtifact = await sdk.artifacts.audio.create('notebook-id')
const audio = await sdk.artifacts.get(audioArtifact.audioId, 'notebook-id')
if (audio.audioData && audio.saveToFile) {
  await audio.saveToFile('./audio.mp3')
}
```

---

### Download Artifact

**Method:** `sdk.artifacts.download(artifactId, folderPath, notebookId?)`

**Example:** [artifact-download.ts](examples/artifact-download.ts)

**Parameters:**
- `artifactId: string` - The artifact ID from `create()` or `list()` (required)
- `folderPath: string` - Output folder path (required)
- `notebookId?: string` - Optional notebook ID (helpful for audio/video if download needs it)

**Returns:** `Promise<{ filePath: string; data: any }>`

**Description:**
Downloads artifact content and saves to disk. Automatically determines file format and saves with appropriate filename.

**Supported Artifacts:**

| Type | Format | Filename | Content |
|------|--------|----------|---------|
| Quiz | JSON | `quiz_{artifactId}_{timestamp}.json` | Complete quiz data with questions, options, answers, explanations |
| Flashcards | JSON | `flashcard_{artifactId}_{timestamp}.json` | Complete flashcard data with array, CSV, totalCards |
| Audio | Audio file | `audio_{artifactId}.mp3` | Audio file (binary) |
| Video | MP4 file | `<artifact-title>.mp4` | Video downloaded as MP4 using Playwright |
| Slides | PDF file | `<artifact-title>.pdf` or `<artifact-title>/slide_*.png` | Slides downloaded as PDF (default) or PNG files using Playwright |

<details>
<summary><strong>Notes</strong></summary>

- Quiz and flashcards are saved as JSON files with complete data
- Audio is saved as binary file (format depends on backend)
- Video and slides are downloaded using Playwright for authentication
- Videos are downloaded as MP4 files
- Slides are downloaded as PDF (default) or PNG files
- For PDF downloads, `pdf-lib` package is recommended (falls back to PNG if not available)
- PNG files are saved in a subfolder named after the artifact
- Files are saved with timestamps to avoid overwrites (except for slides which use artifact title)
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

// Download audio (use audioId from create() or list())
const audio = await sdk.artifacts.audio.create('notebook-id')
const result = await sdk.artifacts.download(audio.audioId, './downloads', 'notebook-id')
console.log(`Audio saved to: ${result.filePath}`)

// Download video (using get() with outputPath or download() method)
const video = await sdk.artifacts.get('video-id', 'notebook-id', { outputPath: './downloads' })
console.log(`Video saved to: ${video.downloadPath}`)
// Alternative: const result = await sdk.artifacts.download('video-id', './downloads', 'notebook-id')

// Slides: Download using download() or get() with downloadAs option
const slidesResult = await sdk.artifacts.download('slide-id', './downloads', 'notebook-id')
console.log(`Slides saved to: ${slidesResult.filePath}`)
```

---

### Download Video

**Method:** `sdk.artifacts.get(videoId, notebookId, { outputPath })` or `sdk.artifacts.download(videoId, outputPath, notebookId)`

**Example:** [artifact-video.ts](examples/artifact-video.ts)

**Parameters:**
- `videoId` (string, required): The video artifact ID
- `notebookId` (string, required): The notebook ID containing the video
- `outputPath` (string, required): Directory path to save the downloaded video

**Returns:** 
- `get()`: Returns `Artifact + { downloadPath: string }` - The artifact with download path
- `download()`: Returns `{ filePath: string, data: Artifact }` - File path and artifact data

**Description:**
Downloads a video artifact as an MP4 file. Uses Playwright for authentication and handles the download automatically. The video file is saved with the artifact title as the filename.

**Important Notes:**
- Video must be in `READY` state before downloading (check with `get()` first)
- Requires cookies to be configured in the RPC client
- Uses Playwright headless browser for authenticated download
- Video is saved as `<artifact-title>.mp4` in the specified output directory

**Usage:**
```typescript
// Method 1: Using get() with outputPath option
const video = await sdk.artifacts.get('video-id', 'notebook-id', { 
  outputPath: './downloads' 
})
console.log(`Video saved to: ${video.downloadPath}`)

// Method 2: Using download() method
const result = await sdk.artifacts.download('video-id', './downloads', 'notebook-id')
console.log(`Video saved to: ${result.filePath}`)
```

**Example Workflow:**
```typescript
// 1. Check video status
const video = await sdk.artifacts.get('video-id', 'notebook-id')
if (video.state === ArtifactState.READY) {
  // 2. Download video
  const downloaded = await sdk.artifacts.get('video-id', 'notebook-id', { 
    outputPath: './downloads' 
  })
  console.log(`Downloaded: ${downloaded.downloadPath}`)
}
```

---

### Download Slides

**Method:** `sdk.artifacts.get(slideId, notebookId, { outputPath, downloadAs })` or `sdk.artifacts.download(slideId, outputPath, notebookId, { downloadAs })`

**Example:** [artifact-slide.ts](examples/artifact-slide.ts)

**Parameters:**
- `slideId` (string, required): The slide artifact ID
- `notebookId` (string, required): The notebook ID containing the slides
- `outputPath` (string, required): Directory path to save the downloaded slides
- `downloadAs` (string, optional): Download format - `'pdf'` (default) or `'png'`

**Returns:** 
- `get()`: Returns `Artifact + { downloadPath: string, downloadFormat: 'pdf' | 'png' }` - The artifact with download path and format
- `download()`: Returns `{ filePath: string, data: Artifact }` - File path and artifact data

**Description:**
Downloads a slide deck artifact as PDF (default) or PNG files. Uses Playwright for authentication and handles the download automatically. PDF format saves all slides in a single file, while PNG format saves each slide as a separate image file.

**Format Options:**

**PDF (default):**
- Single PDF file containing all slides
- Filename: `<artifact-title>.pdf`
- Saved directly in the output directory

**PNG:**
- Individual PNG files for each slide
- Saved in a subfolder named after the artifact: `<artifact-title>/`
- Filenames: `slide_1.png`, `slide_2.png`, etc.

**Important Notes:**
- Slides must be in `READY` state before downloading (check with `get()` first)
- Requires cookies to be configured in the RPC client
- Uses Playwright headless browser for authenticated download
- PDF generation uses `pdf-lib` if available, falls back to PNG if not installed
- PNG files are always saved individually in a subfolder

**Usage:**
```typescript
// Method 1: Using get() with outputPath option
// Download as PDF (default)
const slides = await sdk.artifacts.get('slide-id', 'notebook-id', { 
  outputPath: './downloads' 
})
console.log(`PDF saved to: ${slides.downloadPath}`)

// Download as PNG files
const slidesPng = await sdk.artifacts.get('slide-id', 'notebook-id', { 
  outputPath: './downloads',
  downloadAs: 'png'
})
console.log(`PNG files saved to: ${slidesPng.downloadPath}`)

// Method 2: Using download() method (PDF by default)
const result = await sdk.artifacts.download('slide-id', './downloads', 'notebook-id')
console.log(`Slides saved to: ${result.filePath}`)
```

**Example Workflow:**
```typescript
// 1. Check slide status
const slides = await sdk.artifacts.get('slide-id', 'notebook-id')
if (slides.state === ArtifactState.READY) {
  // 2. Download as PDF (default)
  const downloaded = await sdk.artifacts.get('slide-id', 'notebook-id', { 
    outputPath: './downloads' 
  })
  console.log(`Downloaded PDF: ${downloaded.downloadPath}`)
  
  // Or download as PNG files
  const pngSlides = await sdk.artifacts.get('slide-id', 'notebook-id', { 
    outputPath: './downloads',
    downloadAs: 'png'
  })
  console.log(`Downloaded PNGs: ${pngSlides.downloadPath}`)
}
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

// Rename audio artifact (use audioId from create() or list())
const audio = await sdk.artifacts.audio.create('notebook-id')
const renamed = await sdk.artifacts.rename(audio.audioId, 'My Audio Overview')
```

---

### Delete Artifact

**Method:** `sdk.artifacts.delete(artifactId, notebookId?)`

**Example:** [artifact-delete.ts](examples/artifact-delete.ts)

**Parameters:**
- `artifactId: string` - The artifact ID from `create()` or `list()` (required)
- `notebookId?: string` - Optional notebook ID (helpful if `get()` fails for audio/video)

**Returns:** `Promise<void>`

**Description:**
Permanently deletes an artifact. Works for all artifact types. This action cannot be undone. Automatically detects artifact type and uses the correct RPC method.

<details>
<summary><strong>Notes</strong></summary>

- Deletion is permanent and cannot be undone
- Works for all artifact types (quiz, flashcards, report, mind map, infographic, slide deck, audio, video)
- Automatically detects artifact type by calling `get()` first
- Audio and video artifacts use V5N4be RPC with `[[2], artifactId]` structure
- Other artifacts use WxBZtb RPC with `[artifactId]` structure
- If `get()` fails, tries both methods (V5N4be first, then standard delete)
- Audio and video artifacts have their own artifactId (not the notebook ID)

</details>

**Usage:**
```typescript
// Delete any artifact (recommended - automatically detects type)
await sdk.artifacts.delete('artifact-id')

// Delete with notebook ID (helpful if get() fails)
await sdk.artifacts.delete('artifact-id', 'notebook-id')

// Note: Audio and video artifacts have their own artifactId from create() or list()
const audio = await sdk.artifacts.audio.create('notebook-id')
await sdk.artifacts.delete(audio.audioId) // Use audioId, not notebookId
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

## Generation & Chat

Examples: [chat-basic.ts](examples/chat-basic.ts) | [chat-with-sources.ts](examples/chat-with-sources.ts) | [chat-conversation.ts](examples/chat-conversation.ts) | [generation-set-chat-config.ts](examples/generation-set-chat-config.ts) | [generation-document-guides.ts](examples/generation-document-guides.ts) | [generation-delete-chat-history.ts](examples/generation-delete-chat-history.ts)

### Chat

**Method:** `sdk.generation.chat(notebookId, prompt, options?)`

**Examples:** 
- [chat-basic.ts](examples/chat-basic.ts) - Basic chat with all sources
- [chat-with-sources.ts](examples/chat-with-sources.ts) - Chat with specific sources
- [chat-conversation.ts](examples/chat-conversation.ts) - Chat with conversation history

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `prompt: string` - Chat message/prompt (required)
- `options?: object` - Optional chat options:
  - `sourceIds?: string[]` - Specific source IDs to query (uses all sources if omitted)
  - `conversationHistory?: Array<{ message: string; role: 'user' | 'assistant' }>` - Conversation history for follow-up messages
  - `conversationId?: string` - Conversation ID for continuing a conversation (auto-generated if not provided)

**Returns:** `Promise<string>` - AI response text

**Description:**
Chat with your notebook content using AI. Ask questions, get summaries, or have conversations about the content in your notebook. Supports source selection and conversation history for multi-turn conversations.

<details>
<summary><strong>Notes</strong></summary>

- Quota is checked before chat (if quota manager is enabled)
- Usage is recorded after successful chat
- Response is parsed and returned as plain text
- If `sourceIds` is provided, only those sources are used for context
- If `sourceIds` is omitted, all sources in the notebook are used
- Conversation ID is auto-generated if not provided
- Use `conversationHistory` for follow-up messages to maintain context

</details>

**Usage:**
```typescript
// Chat with all sources
const response = await sdk.generation.chat(
  'notebook-id',
  'What are the main findings from the research?'
)
console.log(response)

// Chat with specific sources
const response = await sdk.generation.chat(
  'notebook-id',
  'Summarize the methodology section',
  { sourceIds: ['source-id-1', 'source-id-2'] }
)
console.log(response)

// Follow-up message with conversation history
const response1 = await sdk.generation.chat('notebook-id', 'What is machine learning?')
const response2 = await sdk.generation.chat('notebook-id', 'Tell me more', {
  conversationHistory: [
    { message: 'What is machine learning?', role: 'user' },
    { message: response1, role: 'assistant' }
  ]
})
```

---

### Set Chat Configuration

**Method:** `sdk.generation.setChatConfig(notebookId, config)`

**Example:** [generation-set-chat-config.ts](examples/generation-set-chat-config.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `config: object` - Chat configuration:
  - `type: 'default' | 'custom' | 'learning-guide'` - Configuration type (required)
  - `customText?: string` - Custom prompt text (required if type is 'custom')
  - `responseLength: 'default' | 'shorter' | 'longer'` - Response length (required)

**Returns:** `Promise<any>` - Configuration result

**Description:**
Configure chat behavior before sending messages. Set the chat mode (default, custom prompt, or learning guide) and response length. This is optional - you can use chat without setting configuration.

**Usage:**
```typescript
// Set default configuration
await sdk.generation.setChatConfig('notebook-id', {
  type: 'default',
  responseLength: 'default'
})

// Set custom configuration with custom prompt
await sdk.generation.setChatConfig('notebook-id', {
  type: 'custom',
  customText: 'respond as phd student',
  responseLength: 'longer'
})

// Set learning guide configuration
await sdk.generation.setChatConfig('notebook-id', {
  type: 'learning-guide',
  responseLength: 'shorter'
})
```

---

### Generate Document Guides

**Method:** `sdk.generation.generateDocumentGuides(notebookId, sourceId?)`

**Example:** [generation-document-guides.ts](examples/generation-document-guides.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `sourceId?: string` - Optional specific source ID to generate guides for (if not provided, generates for all sources)

**Returns:** `Promise<any>` - Document guides (array of guide objects with `content` field)

**Description:**
Generates document guides for sources in the notebook. These guides provide structured information about each source. Can generate guides for all sources or a specific source.

**Usage:**
```typescript
// Generate guides for all sources
const guides = await sdk.generation.generateDocumentGuides('notebook-id')
console.log(guides)

// Generate guides for a specific source
const guides = await sdk.generation.generateDocumentGuides('notebook-id', 'source-id')
console.log(guides)
```

---

### Delete Chat History

**Method:** `sdk.generation.deleteChatHistory(notebookId, conversationId)`

**Example:** [generation-delete-chat-history.ts](examples/generation-delete-chat-history.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `conversationId: string` - The conversation ID to delete (required)

**Returns:** `Promise<any>` - Deletion result

**Description:**
Delete a conversation history from the notebook. Use this to remove old conversations or clean up chat history.

**Usage:**
```typescript
await sdk.generation.deleteChatHistory('notebook-id', 'conversation-id')
```

---

## Notes

Examples: [note-list.ts](examples/note-list.ts) | [note-create.ts](examples/note-create.ts) | [note-update.ts](examples/note-update.ts) | [note-delete.ts](examples/note-delete.ts)

### List Notes

**Method:** `sdk.notes.list(notebookId)`

**Example:** [note-list.ts](examples/note-list.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)

**Returns:** `Promise<Note[]>`

**Description:**
Lists all notes in a notebook. Returns an array of notes with their titles, content, and metadata.

**Return Fields:**
- `noteId: string` - Unique note ID (required for update/delete operations)
- `title: string` - Note title
- `content: string` - Note content
- `tags?: string[]` - Note tags (if any)
- `createdAt?: string` - Creation timestamp (if available)
- `updatedAt?: string` - Last modified timestamp (if available)

<details>
<summary><strong>Notes</strong></summary>

- Returns empty array if notebook has no notes
- Notes are returned in the order they appear in the notebook
- Content may be truncated in list view (use individual note operations for full content)
- Tags are optional and may be empty

</details>

**Usage:**
```typescript
const notes = await sdk.notes.list('notebook-id')
console.log(`Found ${notes.length} notes`)

notes.forEach((note, index) => {
  console.log(`${index + 1}. ${note.title}`)
  console.log(`   ID: ${note.noteId}`)
  if (note.tags && note.tags.length > 0) {
    console.log(`   Tags: ${note.tags.join(', ')}`)
  }
})
```

---

### Create Note

**Method:** `sdk.notes.create(notebookId, options)`

**Example:** [note-create.ts](examples/note-create.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `options: CreateNoteOptions`
  - `title: string` - Note title (required)
  - `content?: string` - Note content (optional, defaults to empty string)
  - `tags?: string[]` - Note tags (optional)
  - `noteType?: NoteType[]` - Note type (optional, defaults to `[NoteType.REGULAR]`)

**Returns:** `Promise<Note>`

**Description:**
Creates a new note in the notebook. Notes are useful for adding your own annotations, reminders, or summaries alongside the notebook content.

**Return Fields:**
- `noteId: string` - Unique note ID (use this for update/delete operations)
- `title: string` - Note title (as provided)
- `content: string` - Note content (may be empty initially)

<details>
<summary><strong>Notes</strong></summary>

- Title is required - cannot create a note without a title
- Content is optional and can be added later via `update()`
- Tags are optional and can be added during creation or later
- Note type defaults to `REGULAR` (1) - use `GENERATED` (2) for AI-generated notes
- Returns immediately with note ID - no waiting required

</details>

**Usage:**
```typescript
// Create a simple note
const note = await sdk.notes.create('notebook-id', {
  title: 'Meeting Notes',
  content: 'Key points from today\'s meeting...',
})
console.log(`Created note: ${note.noteId}`)

// Create a note with tags
const note = await sdk.notes.create('notebook-id', {
  title: 'Research Findings',
  content: 'Important findings...',
  tags: ['research', 'findings'],
})

// Create a note with just a title (add content later)
const note = await sdk.notes.create('notebook-id', {
  title: 'Quick Reminder',
})
```

---

### Update Note

**Method:** `sdk.notes.update(notebookId, noteId, options)`

**Example:** [note-update.ts](examples/note-update.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `noteId: string` - The note ID (required)
- `options: UpdateNoteOptions`
  - `title?: string` - New title (optional, defaults to empty string)
  - `content?: string` - New content (optional, defaults to empty string)
  - `tags?: string[]` - New tags (optional, defaults to empty array)

**Returns:** `Promise<Note>`

**Description:**
Updates a note's title, content, and tags. All fields can be updated together or individually. If a field is not provided, it defaults to an empty value.

<details>
<summary><strong>Notes</strong></summary>

- Both `title` and `content` are always sent (defaults to empty string if not provided)
- Tags default to empty array if not provided
- All fields are updated together in a single operation
- Returns updated note object with the provided title

</details>

**Usage:**
```typescript
// Update title and content
const updated = await sdk.notes.update('notebook-id', 'note-id', {
  title: 'Updated Meeting Notes',
  content: 'Updated content with new information...',
})

// Update all fields including tags
const updated = await sdk.notes.update('notebook-id', 'note-id', {
  title: 'Final Meeting Notes',
  content: 'Final content...',
  tags: ['meeting', 'final'],
})

// Update both title and content
const updated = await sdk.notes.update('notebook-id', 'note-id', {
  title: 'Final Meeting Notes',
  content: 'Final content...',
  tags: ['meeting', 'final'],
})
```

---

### Delete Note

**Method:** `sdk.notes.delete(notebookId, noteIds)`

**Example:** [note-delete.ts](examples/note-delete.ts)

**Parameters:**
- `notebookId: string` - The notebook ID (required)
- `noteIds: string | string[]` - Single note ID or array of note IDs (required)

**Returns:** `Promise<void>`

**Description:**
Deletes one or more notes from the notebook. This action cannot be undone.

<details>
<summary><strong>Notes</strong></summary>

- Supports both single note ID and array of note IDs
- Batch deletion is supported (pass array of IDs)
- Deletion is permanent and cannot be undone
- No confirmation required - deletion is immediate

</details>

**Usage:**
```typescript
// Delete single note
await sdk.notes.delete('notebook-id', 'note-id')

// Delete multiple notes
await sdk.notes.delete('notebook-id', [
  'note-id-1',
  'note-id-2',
  'note-id-3',
])
```

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
