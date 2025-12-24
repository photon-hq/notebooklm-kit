# NotebookLM Kit

TypeScript SDK for programmatic access to Google NotebookLM.

**Developed by [photon-ai](https://github.com/photon-ai)**

## Features

- 📚 **Notebooks** - Create, read, update, delete notebooks
- 📄 **Sources** - Add from URLs, text, files, YouTube
- 📝 **Notes** - Create and manage notes
- 🎙️ **Audio** - Generate AI audio overviews in 10+ languages
- 🎥 **Video** - Create video overviews
- 📑 **Artifacts** - Study guides, quizzes, flashcards, mind maps, infographics, slide decks
- 💬 **Generation** - Chat, guides, outlines, reports
- 🌍 **Multi-Language** - Support for हिन्दी, বাংলা, ગુજરાતી, ಕನ್ನಡ, മലയാളം, मराठी, ਪੰਜਾਬੀ, தமிழ், తెలుగు
- 🚦 **Quota Management** - Enforces NotebookLM limits (100 notebooks, 50 chats/day, 3 audio/day)
- 🔄 **Auto-Refresh** - Keep sessions alive automatically
- 🔒 **Type-Safe** - Full TypeScript support
- ⚡ **Modern** - ES modules, async/await

## Installation

```bash
npm install notebooklm-kit
```

## Quick Start

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

// Chat
const response = await client.generation.chat(
  notebook.projectId,
  'What are the key findings?'
);
```

## Authentication

Get your credentials from https://notebooklm.google.com:

1. Open Developer Tools (F12)
2. Go to Application → Cookies
3. Copy `__Secure-1PSID` value as `NOTEBOOKLM_AUTH_TOKEN`
4. Copy all cookies as string for `NOTEBOOKLM_COOKIES`

```bash
export NOTEBOOKLM_AUTH_TOKEN="your-token"
export NOTEBOOKLM_COOKIES="cookie1=value1; cookie2=value2; ..."
```

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
  authToken: 'your-token',
  cookies: 'your-cookies',
  debug: false,           // Enable debug logging
  maxRetries: 3,          // Retry attempts
  retryDelay: 1000,       // Initial retry delay (ms)
  retryMaxDelay: 10000,   // Max retry delay (ms)
  
  // Auto-refresh credentials (keeps session alive)
  autoRefresh: true,      // Simple enable
  // OR
  autoRefresh: {
    enabled: true,
    interval: 10 * 60 * 1000,  // Refresh every 10 minutes
  },
});

// Don't forget to dispose when done (stops auto-refresh)
// client.dispose();
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

Unofficial SDK, not affiliated with Google. Use at your own risk.
