# Missing RPC Methods & Workflows

This document lists **pending** RPC methods and **conflicting** implementations from `nlm-old`, plus **workflow patterns** that combine multiple RPC calls.

---

## ❌ Pending Implementation

### Account Operations
- `RPC_GET_OR_CREATE_ACCOUNT` (ZwVcOc) - Get or create user account
- `RPC_MUTATE_ACCOUNT` (hT54vc) - Update account settings

### Analytics Operations
- `RPC_GET_PROJECT_ANALYTICS` (AUrzMb) - Get project analytics/statistics
- `RPC_SUBMIT_FEEDBACK` (uNyJKe) - Submit user feedback

### Sharing Operations
- `RPC_GET_PROJECT_DETAILS` (JFMDGd) - Get project sharing details (different from GetProject)
- `RPC_SHARE_PROJECT` (QDyure) - Share project/notebook (we have ShareAudio but not ShareProject)

### Guidebooks Operations
- `RPC_DELETE_GUIDEBOOK` (ARGkVc) - Delete a guidebook
- `RPC_GET_GUIDEBOOK` (EYqtU) - Get guidebook details
- `RPC_LIST_RECENTLY_VIEWED_GUIDEBOOKS` (YJBpHc) - List recently viewed guidebooks
- `RPC_PUBLISH_GUIDEBOOK` (R6smae) - Publish a guidebook
- `RPC_GET_GUIDEBOOK_DETAILS` (LJyzeb) - Get guidebook sharing details
- `RPC_SHARE_GUIDEBOOK` (OTl0K) - Share a guidebook
- `RPC_GUIDEBOOK_GENERATE_ANSWER` (itA0pc) - Generate answer in guidebook context

### Additional Operations
- `RPC_LIST_FEATURED_PROJECTS` (nS9Qlc) - List featured/public projects
- `RPC_REPORT_CONTENT` (rJKx8e) - Report inappropriate content

---

## ⚠️ Conflicting/Similar Implementations

### Resolved Conflicts (Both Implemented)

1. **`RPC_LOAD_SOURCE` (hizoJc)** vs **`RPC_LOAD_SOURCE_CONTENT` (tr032e)**
   - ✅ Both implemented - they work together
   - `selectSource()` prepares source, `loadContent()` loads actual content
   - **Usage:** Call `selectSource()` first, then `loadContent()`

2. **`RPC_UPDATE_ARTIFACT` (DJezBc)** vs **`RPC_RENAME_ARTIFACT` (rc3d8d)**
   - ✅ Both implemented - different use cases
   - `rename()` only changes title, `update()` updates content/state/metadata

3. **`RPC_DISCOVER_SOURCES` (qXyaNe)** vs **`RPC_SEARCH_WEB_SOURCES` (Ljjv0c)**
   - ✅ Both implemented - different workflows
   - `discover()` is synchronous, `searchWeb()` is async with session management

4. **`RPC_ACT_ON_SOURCES` (yyryJe)** vs **`RPC_MUTATE_SOURCE` (b7Wfje)**
   - ✅ Both implemented - different use cases
   - `update()` updates single source, `actOn()` performs bulk actions

5. **Same RPC ID, Different Params**
   - `RPC_GET_PROJECT` (rLM1Ne) - Uses `[project_id]` → `notebooks.get()`
   - `RPC_POLL_SOURCE_PROCESSING` (rLM1Ne) - Uses `[notebook_id, null, [2], null, 1]` → `sources.pollProcessing()`
   - `RPC_GENERATE_DOCUMENT_GUIDES` (tr032e) - Uses `[project_id]` → `generation.generateDocumentGuides()`
   - `RPC_LOAD_SOURCE_CONTENT` (tr032e) - Uses `[[[source_id]]]` → `sources.loadContent()`

---

## 🔄 Workflow Patterns

### Source Discovery & Addition Flow (From nlm-old)

**Multi-step async workflow** for discovering and adding sources:

```typescript
// Step 1: Initiate search (async)
const sessionId = await client.sources.searchWeb('notebook-id', {
  query: 'AI research papers',
  mode: ResearchMode.DEEP,  // or FAST
  sourceType: SearchSourceType.WEB,  // or GOOGLE_DRIVE
});

// Step 2: Get discovered sources
const results = await client.sources.getSearchResults('notebook-id');
// Returns: { web: DiscoveredWebSource[], drive: DiscoveredDriveSource[] }

// Step 3: Add selected sources
const sourceIds = await client.sources.addDiscovered('notebook-id', {
  webSources: results.web.slice(0, 5),  // Add first 5 web sources
  driveSources: results.drive.slice(0, 2),  // Add first 2 drive sources
});
```

**RPC Flow:** `RPC_SEARCH_WEB_SOURCES` → `RPC_GET_SEARCH_RESULTS` → `RPC_ADD_DISCOVERED_SOURCES`

**Source:** From `nlm-old` - documented in `callss/sdk/README_NEW_METHODS.txt`

---

### Source Processing Flow (From nlm-old)

**Multi-step workflow** for adding sources and waiting until ready:

```typescript
// Step 1: Add source
const sourceId = await client.sources.addFromURL('notebook-id', {
  url: 'https://example.com/article',
});

// Step 2: Poll until processing is complete
let status: SourceProcessingStatus;
do {
  status = await client.sources.pollProcessing('notebook-id');
  if (!status.allReady) {
    await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2s
  }
} while (!status.allReady);

// Step 3: Load content (optional - prepare source first)
await client.sources.selectSource(sourceId);
const content = await client.sources.loadContent(sourceId);
```

**RPC Flow:** `RPC_ADD_SOURCES` → `RPC_POLL_SOURCE_PROCESSING` → `RPC_LOAD_SOURCE` → `RPC_LOAD_SOURCE_CONTENT`

**Source:** From `nlm-old` - standard pattern for source processing

---

### Simple Source Discovery (Custom Convenience)

**Single-step synchronous method** for quick discovery:

```typescript
// One call - returns sources directly
const sources = await client.sources.discover('notebook-id', 'AI research');
// Returns: DiscoveredSource[] directly
```

**RPC Flow:** `RPC_DISCOVER_SOURCES` (single call)

**Source:** Custom convenience method - wraps single RPC call

---

### Source Loading Flow (From nlm-old)

**Two-step workflow** for loading source content:

```typescript
// Step 1: Prepare/select source
await client.sources.selectSource('source-id');

// Step 2: Load actual content
const content = await client.sources.loadContent('source-id');
```

**RPC Flow:** `RPC_LOAD_SOURCE` → `RPC_LOAD_SOURCE_CONTENT`

**Source:** From `nlm-old` - `selectSource()` prepares the source before loading

---

### Deep Research Flow (From nlm-old)

**Single-step method** with quota enforcement:

```typescript
// Add deep research report (monthly limit: 10)
const sourceId = await client.sources.addDeepResearch('notebook-id', 'query');
```

**RPC Flow:** `RPC_ADD_DEEP_RESEARCH_REPORT` (single call with quota check)

**Source:** From `nlm-old` - includes monthly quota limit (10 per month)

---

### Artifact Update Flow (From nlm-old)

**Two methods** for different update scenarios:

```typescript
// Quick rename (title only)
await client.artifacts.rename('artifact-id', 'New Title');

// Comprehensive update (content, state, metadata)
await client.artifacts.update('artifact-id', {
  content: { ... },
  state: 'published',
  metadata: { ... },
});
```

**RPC Flow:** 
- `RPC_RENAME_ARTIFACT` (single call - title only)
- `RPC_UPDATE_ARTIFACT` (single call - comprehensive)

**Source:** From `nlm-old` - both methods serve different purposes

---

## 📝 Notes

### Workflow Classification

- **From nlm-old:** Multi-step workflows that match patterns found in `nlm-old/callss/sdk/` documentation
- **Custom:** Convenience methods that wrap single RPC calls or combine multiple calls for better UX

### Unknown RPCs

These RPCs are found in `nlm-old` but purpose is unclear:
- `RPC_UPLOAD_FILE_BY_FILENAME` (o4cbdc) - May be duplicate of AddSources with file
- `RPC_UNKNOWN_POST_SLIDE_DECK` (ozz5Z) - Called after slide deck creation, may be internal/automatic

---

## 🎯 Implementation Priority

### High Priority
1. `RPC_SHARE_PROJECT` - Complete sharing functionality
2. `RPC_GET_PROJECT_DETAILS` - Sharing details

### Medium Priority
3. `RPC_GET_PROJECT_ANALYTICS` - Analytics/statistics
4. `RPC_SUBMIT_FEEDBACK` - User feedback

### Low Priority
5. Account operations (GetOrCreateAccount, MutateAccount)
6. Guidebooks operations (all 7 methods)
7. Additional (ListFeaturedProjects, ReportContent)
