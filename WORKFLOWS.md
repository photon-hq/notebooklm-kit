# NotebookLM-kit Workflows & API Design

This document outlines the **proposed workflow functions** for the `notebooklm-kit` npm package. These workflows combine multiple RPC calls into convenient, production-ready functions that handle common use cases like waiting for processing, polling for completion, and chaining operations.

---

## 📦 Package Philosophy

### Design Goals
1. **Developer Experience First**: Workflows should match how developers actually use NotebookLM
2. **Async-Aware**: Handle polling, waiting, and completion automatically
3. **Type-Safe**: Full TypeScript support with proper types
4. **Production-Ready**: Built-in error handling, retries, and timeouts
5. **Configurable**: Allow customization without complexity

### Current Status

**✅ Implemented**: Individual service methods (building blocks)
- `client.sources.*` - Source operations
- `client.artifacts.*` - Artifact operations
- `client.audio.*` - Audio operations
- `client.video.*` - Video operations
- `client.notebooks.*` - Notebook operations
- `client.notes.*` - Note operations
- `client.generation.*` - Generation operations

**🚧 Proposed**: Workflow functions (combinations of service methods)
- All workflows below are **proposed designs**, not yet implemented
- Workflows will be added to `client.workflows.*` namespace

---

## 🎯 Core Workflow Functions (Proposed)

### 1. Source Discovery & Addition

#### `workflows.discoverAndAddSources()`
**Purpose**: Discover sources via web search and add them to a notebook

```typescript
await client.workflows.discoverAndAddSources(notebookId, {
  query: 'AI safety research',
  mode: 'deep', // or 'fast'
  maxSources: 10,
  sourceType: 'web', // or 'drive' or 'both'
  onProgress: (step, data) => console.log(step, data)
})
```

**Returns**: `{ addedSourceIds: string[], discoveredSources: DiscoveredSource[] }`

**Use Case**: "I want to research a topic and add relevant sources automatically"

---

#### `workflows.addSourceAndWait()`
**Purpose**: Add a source (URL, text, file, YouTube) and wait until it's processed

```typescript
await client.workflows.addSourceAndWait(notebookId, {
  url: 'https://example.com/article'
  // or text: { title: 'Notes', content: '...' }
  // or file: File | Buffer | string
  // or youtubeUrl: 'https://youtube.com/watch?v=...'
}, {
  timeout: 300000, // 5 minutes
  loadContent: true, // Load content after ready
  onProgress: (status) => console.log(`Processing: ${status.progress}%`)
})
```

**Returns**: `{ sourceId: string, source: Source, content?: SourceContent }`

**Use Case**: "I want to add a source and use it immediately once it's ready"

---

#### `workflows.addMultipleSourcesAndWait()`
**Purpose**: Add multiple sources in parallel and wait for all to be processed

```typescript
await client.workflows.addMultipleSourcesAndWait(notebookId, {
  sources: [
    'https://example.com/article1',
    'https://example.com/article2',
    { title: 'My Notes', content: '...' },
    'https://youtube.com/watch?v=...'
  ],
  timeout: 600000, // 10 minutes
  onProgress: (ready, total) => console.log(`${ready}/${total} ready`)
})
```

**Returns**: `Array<{ sourceId: string, source: Source }>`

**Use Case**: "I have a list of sources to add and want to wait for all of them"

---

### 2. Artifact Generation

#### `workflows.createArtifactAndWait()`
**Purpose**: Create any artifact type and wait until it's ready

```typescript
// Create a report
await client.workflows.createArtifactAndWait(notebookId, {
  type: 'report',
  title: 'Research Report',
  instructions: 'Focus on methodology',
  customization: {
    language: 'en',
    tone: 'professional',
    length: 'long'
  },
  timeout: 600000, // 10 minutes
  onProgress: (status) => console.log(`Creating: ${status.progress}%`)
})

// Create a quiz
await client.workflows.createArtifactAndWait(notebookId, {
  type: 'quiz',
  instructions: 'Create 10 multiple choice questions',
  customization: {
    questionCount: 10,
    difficulty: 'medium'
  }
})

// Create a slide deck
await client.workflows.createArtifactAndWait(notebookId, {
  type: 'slideDeck',
  title: 'Presentation',
  instructions: 'Create 10 slides covering key points'
})
```

**Returns**: `{ artifactId: string, artifact: Artifact }`

**Supported Types**: `'report' | 'studyGuide' | 'quiz' | 'flashcards' | 'mindMap' | 'infographic' | 'slideDeck'`

**Use Case**: "I want to generate an artifact and use it once it's ready"

---

#### `workflows.createMultipleArtifacts()`
**Purpose**: Create multiple artifacts in sequence (respects quota limits)

```typescript
await client.workflows.createMultipleArtifacts(notebookId, {
  artifacts: [
    { type: 'report', title: 'Summary Report' },
    { type: 'quiz', title: 'Knowledge Check' },
    { type: 'flashcards', title: 'Study Cards' }
  ],
  onProgress: (completed, total) => console.log(`${completed}/${total} created`)
})
```

**Returns**: `Array<{ artifactId: string, artifact: Artifact }>`

**Use Case**: "I want to generate a complete study package (report + quiz + flashcards)"

---

### 3. Audio & Video Generation

#### `workflows.generateAudioAndDownload()`
**Purpose**: Generate audio overview and download the file

```typescript
await client.workflows.generateAudioAndDownload(notebookId, {
  language: AudioLanguage.HINDI,
  instructions: 'Focus on key findings',
  savePath: './audio.mp3', // Optional: save to file
  timeout: 600000, // 10 minutes
  onProgress: (status) => console.log(`Generating: ${status.progress}%`)
})
```

**Returns**: `{ audioId: string, audio: AudioOverview, fileData: ArrayBuffer, filePath?: string }`

**Use Case**: "I want to generate an audio overview and save it as an MP3 file"

---

#### `workflows.generateVideoAndWait()`
**Purpose**: Generate video overview and wait until ready

```typescript
await client.workflows.generateVideoAndWait(notebookId, {
  instructions: 'Create an engaging overview',
  sourceIds: ['source-1', 'source-2'], // Optional: specific sources
  timeout: 900000, // 15 minutes
  onProgress: (status) => console.log(`Generating: ${status.progress}%`)
})
```

**Returns**: `{ videoId: string, video: VideoOverview }`

**Use Case**: "I want to generate a video overview and get the result"

---

### 4. Complete Research Workflows

#### `workflows.completeResearch()`
**Purpose**: End-to-end research workflow - discover sources, add them, generate artifacts

```typescript
await client.workflows.completeResearch(notebookId, {
  query: 'AI safety research',
  discovery: {
    mode: 'deep',
    maxSources: 10,
    sourceType: 'web'
  },
  artifact: {
    type: 'report',
    title: 'Research Report',
    instructions: 'Comprehensive analysis'
  },
  onProgress: (step, data) => {
    console.log(`Step: ${step}`, data)
  }
})
```

**Returns**: `{ sources: Source[], artifact: Artifact }`

**Use Case**: "I want to do complete research on a topic and get a report"

---

#### `workflows.researchAndGenerateStudyPackage()`
**Purpose**: Complete workflow for creating a study package (sources + report + quiz + flashcards)

```typescript
await client.workflows.researchAndGenerateStudyPackage(notebookId, {
  query: 'Machine Learning Fundamentals',
  discovery: {
    mode: 'deep',
    maxSources: 15
  },
  package: {
    reportTitle: 'ML Fundamentals Report',
    quizTitle: 'ML Knowledge Quiz',
    flashcardsTitle: 'ML Study Cards'
  },
  onProgress: (step, data) => console.log(step, data)
})
```

**Returns**: `{ sources: Source[], report: Artifact, quiz: Artifact, flashcards: Artifact }`

**Use Case**: "I want to create a complete study package for a topic"

---

### 5. Utility Workflows

#### `workflows.waitForSources()`
**Purpose**: Wait for existing sources to finish processing

```typescript
await client.workflows.waitForSources(notebookId, {
  sourceIds: ['source-1', 'source-2'], // Optional: specific sources, or wait for all
  timeout: 300000,
  onProgress: (ready, total) => console.log(`${ready}/${total} ready`)
})
```

**Returns**: `Array<{ sourceId: string, source: Source }>`

**Use Case**: "I added sources earlier and want to wait for them now"

---

#### `workflows.waitForArtifact()`
**Purpose**: Wait for an artifact to finish generating

```typescript
await client.workflows.waitForArtifact(artifactId, {
  timeout: 600000,
  onProgress: (status) => console.log(`Status: ${status.state}`)
})
```

**Returns**: `{ artifact: Artifact }`

**Use Case**: "I created an artifact earlier and want to check if it's ready"

---

## 🔧 Advanced Workflow Functions (Proposed)

### 6. Batch Operations

#### `workflows.batchAddSources()`
**Purpose**: Add multiple sources with parallel processing and smart retries

```typescript
await client.workflows.batchAddSources(notebookId, {
  sources: [
    { type: 'url', value: 'https://example.com/1' },
    { type: 'url', value: 'https://example.com/2' },
    { type: 'text', title: 'Notes', content: '...' },
    { type: 'youtube', url: 'https://youtube.com/watch?v=...' }
  ],
  parallel: true, // Process in parallel (default: true)
  maxConcurrent: 5, // Max parallel operations
  retryFailed: true, // Retry failed sources
  onProgress: (stats) => {
    console.log(`Added: ${stats.added}, Failed: ${stats.failed}, Pending: ${stats.pending}`)
  }
})
```

**Returns**: `{ added: Array<{ sourceId: string }>, failed: Array<{ source: any, error: Error }> }`

---

### 7. Custom Workflows

#### `workflows.createCustomWorkflow()`
**Purpose**: Create a custom workflow by chaining operations

```typescript
const customWorkflow = client.workflows.createCustomWorkflow({
  steps: [
    { type: 'discover', query: 'AI research' },
    { type: 'addSources', maxSources: 5 },
    { type: 'waitForSources' },
    { type: 'createArtifact', type: 'report' }
  ],
  onProgress: (step, data) => console.log(step, data)
})

await customWorkflow.execute(notebookId)
```

**Use Case**: "I want to create a custom workflow for my specific use case"

---

## 📋 Function Reference

### Workflow Functions Summary

| Function | Purpose | Returns |
|----------|---------|---------|
| `discoverAndAddSources()` | Discover & add sources | `{ addedSourceIds, discoveredSources }` |
| `addSourceAndWait()` | Add source & wait | `{ sourceId, source, content? }` |
| `addMultipleSourcesAndWait()` | Add multiple sources & wait | `Array<{ sourceId, source }>` |
| `createArtifactAndWait()` | Create artifact & wait | `{ artifactId, artifact }` |
| `createMultipleArtifacts()` | Create multiple artifacts | `Array<{ artifactId, artifact }>` |
| `generateAudioAndDownload()` | Generate audio & download | `{ audioId, audio, fileData, filePath? }` |
| `generateVideoAndWait()` | Generate video & wait | `{ videoId, video }` |
| `completeResearch()` | Complete research workflow | `{ sources, artifact }` |
| `researchAndGenerateStudyPackage()` | Full study package | `{ sources, report, quiz, flashcards }` |
| `waitForSources()` | Wait for sources | `Array<{ sourceId, source }>` |
| `waitForArtifact()` | Wait for artifact | `{ artifact }` |
| `batchAddSources()` | Batch add with retries | `{ added, failed }` |

---

## 🎨 Configuration Options

### Common Options (Available in Most Workflows)

```typescript
interface WorkflowOptions {
  // Timing
  timeout?: number;           // Max wait time in ms (default varies by workflow)
  pollInterval?: number;      // Poll interval in ms (default: 2-5s)
  
  // Progress tracking
  onProgress?: (status: ProgressStatus) => void;
  
  // Error handling
  retryOnError?: boolean;      // Retry on transient errors (default: true)
  maxRetries?: number;         // Max retry attempts (default: 3)
  
  // Quota management
  checkQuota?: boolean;       // Check quota before starting (default: true)
  enforceQuota?: boolean;     // Throw error if quota exceeded (default: true)
}
```

### Progress Status

```typescript
interface ProgressStatus {
  step: string;               // Current step name
  progress?: number;          // Progress percentage (0-100)
  isReady?: boolean;          // Is current operation ready?
  message?: string;           // Status message
  data?: any;                 // Additional data
}
```

---

## ⚠️ Known Limitations

### Artifact Download/Export

**Current State**: There is **NO download or export method** for artifacts (including slide decks, reports, quizzes, etc.)

**What's Available**:
- `artifacts.get()` - Returns metadata only (ID, type, state, title, sources)
- `artifacts.create*()` - Creates artifacts
- `artifacts.update()` - Updates artifact content/metadata

**What's Missing**:
- ❌ `artifacts.download()` - No download method
- ❌ `artifacts.export()` - No export method
- ❌ Content extraction from `get()` response

**Workaround**: Artifacts may be accessible via NotebookLM web UI at `https://notebooklm.google.com/artifact/{artifactId}`

---

## 🔍 Source Discovery Flows

### Async Search Flow (Multi-Step with Session)

**Pattern**: `searchWeb()` → `getSearchResults()` → `addDiscovered()` (or use `searchWebAndWait()` for simpler workflow)

**How it works**:
1. `searchWeb()` - Returns `sessionId` (search happens in background)
2. `getSearchResults()` - Uses `notebookId` only (no sessionId needed)
3. `addDiscovered()` - **Requires `sessionId` from step 1**

**Session Management**: Workflows automatically handle `sessionId` tracking - you don't need to manage it manually.

---

## 🛠️ Implementation Details

### Workflow Service Structure

```typescript
export class WorkflowsService {
  constructor(
    private notebooks: NotebooksService,
    private sources: SourcesService,
    private audio: AudioService,
    private video: VideoService,
    private artifacts: ArtifactsService,
    private quota?: QuotaManager
  ) {}

  // Core workflows
  async discoverAndAddSources(...)
  async addSourceAndWait(...)
  async addMultipleSourcesAndWait(...)
  async createArtifactAndWait(...)
  async createMultipleArtifacts(...)
  async generateAudioAndDownload(...)
  async generateVideoAndWait(...)
  async completeResearch(...)
  async researchAndGenerateStudyPackage(...)
  async waitForSources(...)
  async waitForArtifact(...)
  
  // Advanced workflows
  async batchAddSources(...)
  createCustomWorkflow(...)
  
  // Internal helpers
  private async pollUntilReady(...)
  private async manageDiscoverySession(...)
}
```

### Default Timeouts

- Source processing: 5 minutes
- Audio generation: 10 minutes
- Video generation: 15 minutes
- Artifact generation: 10 minutes

### Default Poll Intervals

- Source processing: 2 seconds
- Audio generation: 5 seconds
- Video generation: 10 seconds
- Artifact generation: 5 seconds

---

## 📊 Usage Examples

### Example 1: Quick Research

```typescript
import { createNotebookLMClient } from 'notebooklm-kit';

const client = createNotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN,
  cookies: process.env.NOTEBOOKLM_COOKIES
});

// Create notebook
const notebook = await client.notebooks.create({ title: 'AI Research' });

// Discover and add sources
const { addedSourceIds } = await client.workflows.discoverAndAddSources(
  notebook.notebookId,
  {
    query: 'AI safety research',
    mode: 'deep',
    maxSources: 10
  }
);

// Generate report
const { artifact } = await client.workflows.createArtifactAndWait(
  notebook.notebookId,
  {
    type: 'report',
    title: 'AI Safety Research Report'
  }
);
```

### Example 2: Study Package Creation

```typescript
const { sources, report, quiz, flashcards } = 
  await client.workflows.researchAndGenerateStudyPackage(notebookId, {
    query: 'Machine Learning Fundamentals',
    discovery: { mode: 'deep', maxSources: 15 },
    package: {
      reportTitle: 'ML Fundamentals Report',
      quizTitle: 'ML Knowledge Quiz',
      flashcardsTitle: 'ML Study Cards'
    }
  });
```

### Example 3: Audio Generation

```typescript
const { fileData, filePath } = await client.workflows.generateAudioAndDownload(
  notebookId,
  {
    language: AudioLanguage.HINDI,
    instructions: 'Focus on key findings',
    savePath: './audio.mp3'
  }
);
```

---

## 🚀 Roadmap

### Phase 1: Core Workflows (Priority)
- ✅ `addSourceAndWait()`
- ✅ `discoverAndAddSources()`
- ✅ `createArtifactAndWait()`
- ✅ `generateAudioAndDownload()`

### Phase 2: Advanced Workflows
- ⏳ `completeResearch()`
- ⏳ `researchAndGenerateStudyPackage()`
- ⏳ `batchAddSources()`

### Phase 3: Custom Workflows
- ⏳ `createCustomWorkflow()`
- ⏳ Workflow builder API

---

## 📝 Notes

- All workflows respect quota limits automatically
- Workflows handle errors and retries internally
- Progress callbacks are optional but recommended for long-running operations
- All workflows are fully typed with TypeScript
- Workflows can be cancelled (future feature)

---

**Last Updated**: 2024
**Status**: Proposed API - Implementation in progress
