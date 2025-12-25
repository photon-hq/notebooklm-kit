<div align="center">
   
# @photon-ai/NotebookLM-kit

> A TypeScript SDK for programmatic access to Google NotebookLM.

</div>

[![npm version](https://img.shields.io/npm/v/@photon-ai/imessage-kit.svg)](https://www.npmjs.com/package/@photon-ai/imessage-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/bZd4CMd2H5)

## Features

| Category         | Description                                                                 | Availability |
|------------------|------------------------------------------------------------------------------|--------------|
| Notebooks        | Create, read, update, and delete notebooks                                   | ✅           |
| Sources          | Add sources from URLs, text, files, and YouTube                               | ✅           |
| Notes            | Create and manage notes                                                       | ✅           |
| Audio            | Generate AI audio overviews in 10+ languages                                   | ✅           |
| Video            | Create video overviews                                                        | ✅           |
| Artifacts        | Generate study guides, quizzes, flashcards, mind maps, infographics, slides   | ✅           |
| Generation       | Chat, guides, outlines, and reports                                           | ✅           |
| Multi-Language   | Support for Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu | ✅ |
| Quota Management | Enforces NotebookLM limits (100 notebooks, 50 chats/day, 3 audio/day)         | ✅           |
| Auto-Refresh     | Automatically keep sessions alive                                             | ✅           |
| Type-Safe        | Full TypeScript support                                                       | ✅           |
| Modern           | ES modules with async/await                                                   | ✅           |

## Installation

```bash
npm install notebooklm-kit
```

## Quick Start

1. **Extract credentials** using `extract-credentials.js` (see [Authentication](#authentication) below)
2. **Add to `.env` file:**
   ```bash
   NOTEBOOKLM_AUTH_TOKEN="your-token"
   NOTEBOOKLM_COOKIES="SID=value; HSID=value; ..."
   ```
3. **Use the client:**

```typescript
import { NotebookLMClient } from 'notebooklm-kit';

const client = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
});

// List notebooks
const notebooks = await client.notebooks.list();

// Create notebook
const notebook = await client.notebooks.create({
  title: 'My Research',
  emoji: '📚',
});

// Add source
await client.sources.addFromURL(notebook.projectId, {
  url: 'https://example.com/article',
});

// Chat with your notebook
const response = await client.generation.chat(
  notebook.projectId,
  'What are the key findings?'
);

console.log(response.text);
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

If you prefer to extract credentials manually:

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

## API Reference

### Notebooks

```typescript
// List
const notebooks = await client.notebooks.list();

// Get
const notebook = await client.notebooks.get('notebook-id');

// Create
const notebook = await client.notebooks.create({ title: 'Title', emoji: '📚' });

// Update
await client.notebooks.update('notebook-id', { title: 'New Title' });

// Delete
await client.notebooks.delete('notebook-id');
```

### Sources

```typescript
// Add from URL
const sourceId = await client.sources.addFromURL('notebook-id', {
  url: 'https://example.com',
});

// Add from text
const sourceId = await client.sources.addFromText('notebook-id', {
  title: 'My Notes',
  content: 'Content here...',
});

// Add from file
const buffer = await fs.readFile('document.pdf');
const sourceId = await client.sources.addFromFile('notebook-id', {
  content: buffer,
  fileName: 'document.pdf',
  mimeType: 'application/pdf',
});

// Add YouTube
const sourceId = await client.sources.addFromURL('notebook-id', {
  url: 'https://youtube.com/watch?v=VIDEO_ID',
});

// Delete
await client.sources.delete('notebook-id', 'source-id');
```

### Notes

```typescript
// List
const notes = await client.notes.list('notebook-id');

// Create
const note = await client.notes.create('notebook-id', {
  title: 'Note Title',
  content: 'Content...',
});

// Update
await client.notes.update('notebook-id', 'note-id', {
  content: 'Updated content',
});

// Delete
await client.notes.delete('notebook-id', 'note-id');
```

### Audio

```typescript
import { AudioLanguage, ShareOption } from 'notebooklm-kit';

// Create in English (default)
const audio = await client.audio.create('notebook-id', {
  instructions: 'Focus on key findings',
});

// Create in Hindi (हिन्दी)
const hindiAudio = await client.audio.create('notebook-id', {
  language: AudioLanguage.HINDI,
  instructions: 'मुख्य निष्कर्षों पर ध्यान दें',
});

// Create in Tamil (தமிழ்)
const tamilAudio = await client.audio.create('notebook-id', {
  language: AudioLanguage.TAMIL,
  customization: {
    tone: 'educational',
    length: 'detailed',
  },
});

// Supported languages: Hindi, Bengali, Gujarati, Kannada, 
// Malayalam, Marathi, Punjabi, Tamil, Telugu, English

// Get status
const status = await client.audio.get('notebook-id');

// Download
const audio = await client.audio.download('notebook-id');
await audio.saveToFile('overview.mp3');

// Share
const result = await client.audio.share('notebook-id', ShareOption.PUBLIC);

// Delete
await client.audio.delete('notebook-id');
```

### Video

```typescript
// Create
const video = await client.video.create('notebook-id', {
  instructions: 'Create engaging overview',
});
```

### Artifacts

```typescript
// List all artifacts
const artifacts = await client.artifacts.list('notebook-id');

// Create study guide
const studyGuide = await client.artifacts.createStudyGuide('notebook-id', {
  title: 'Exam Study Guide',
  instructions: 'Focus on key concepts and formulas',
});

// Create quiz
const quiz = await client.artifacts.createQuiz('notebook-id', {
  instructions: 'Create 10 multiple choice questions',
});

// Create flashcards
const flashcards = await client.artifacts.createFlashcards('notebook-id', {
  instructions: 'Focus on terminology and definitions',
});

// Create mind map
const mindMap = await client.artifacts.createMindMap('notebook-id', {
  title: 'Concept Map',
});

// Create infographic (BETA)
const infographic = await client.artifacts.createInfographic('notebook-id', {
  instructions: 'Visual summary of key data',
});

// Create slide deck (BETA)
const slideDeck = await client.artifacts.createSlideDeck('notebook-id', {
  title: 'Presentation',
  instructions: 'Create 10 slides covering main topics',
});

// Create report with customization
const report = await client.artifacts.createReport('notebook-id', {
  title: 'Research Report',
  customization: {
    language: 'en',
    tone: 'professional',
    length: 'long',
  },
});

// Get artifact
const artifact = await client.artifacts.get('artifact-id');

// Rename
await client.artifacts.rename('artifact-id', 'New Title');

// Delete
await client.artifacts.delete('artifact-id');
```

### Generation

```typescript
// Chat
const response = await client.generation.chat('notebook-id', 'Your question?');

// Generate guides
const guides = await client.generation.generateDocumentGuides('notebook-id');
const guide = await client.generation.generateNotebookGuide('notebook-id');

// Generate outline
const outline = await client.generation.generateOutline('notebook-id');

// Generate section
const section = await client.generation.generateSection('notebook-id');

// Start draft
const draft = await client.generation.startDraft('notebook-id');

// Generate report suggestions
const suggestions = await client.generation.generateReportSuggestions('notebook-id');

// Magic view
const magicView = await client.generation.generateMagicView('notebook-id', ['source-1']);
```

### Advanced: Direct RPC

```typescript
import { RPCMethods } from 'notebooklm-kit';

const response = await client.rpc(
  RPCMethods.RPC_LIST_RECENTLY_VIEWED_PROJECTS,
  []
);
```

## Configuration

```typescript
const client = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN!,
  cookies: process.env.NOTEBOOKLM_COOKIES!,
  
  // Optional configuration
  debug: false,                    // Enable debug logging
  autoRefresh: true,               // Keep session alive (recommended)
  autoRefresh: {                   // Or configure refresh interval
    enabled: true,
    interval: 10 * 60 * 1000,      // Refresh every 10 minutes
  },
  maxRetries: 3,                   // Retry attempts for failed requests
  enforceQuotas: true,             // Enforce NotebookLM usage limits (default: true)
});

// Clean up when done (stops auto-refresh)
client.dispose();
```

## Quota Management

The SDK automatically enforces NotebookLM's usage limits:

```typescript
import { RateLimitError, NOTEBOOKLM_LIMITS } from 'notebooklm-kit';

// View limits (all in one place for easy updates)
console.log('Limits:', NOTEBOOKLM_LIMITS);
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

// Check usage
const usage = client.getUsage();
console.log(`Chats: ${usage.daily.chats}/50`);
console.log(`Audio: ${usage.daily.audioOverviews}/3`);

// Check remaining
const remaining = client.getRemaining('chats');
console.log(`${remaining} chats remaining today`);

// Disable quota enforcement (not recommended)
const client = new NotebookLMClient({
  authToken: '...',
  cookies: '...',
  enforceQuotas: false,
});
```

## Error Handling

```typescript
import { NotebookLMError, NotebookLMAuthError, RateLimitError } from 'notebooklm-kit';

try {
  const notebooks = await client.notebooks.list();
} catch (error) {
  if (error instanceof NotebookLMAuthError) {
    console.error('Authentication failed');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.message);
    console.error(`Used: ${error.used}/${error.limit}`);
    console.error('Resets at:', error.resetTime);
  } else if (error instanceof NotebookLMError) {
    console.error('API error:', error.message);
  }
}
```

## Type Safety

All methods are fully typed:

```typescript
import type { Notebook, Source, Note, AudioOverview } from 'notebooklm-kit';

const notebook: Notebook = await client.notebooks.get('id');
const sources: Source[] = [];
const notes: Note[] = await client.notes.list('id');
const audio: AudioOverview = await client.audio.get('id');
```

## License

MIT

## Disclaimer

Note: This SDK is for educational and development purposes. Always respect user privacy and follow Google's terms of service.