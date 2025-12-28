/**
 * Flashcard service
 * Handles flashcard data fetching operations
 * 
 * ## Implementation Method
 * 
 * **RPC Method:** `RPC_GET_QUIZ_DATA` (RPC ID: `v9rmvd`)
 * 
 * **Response Structure:**
 * The RPC returns a large JSON string (often 1MB+) with the structure:
 * ```
 * [["artifactId", "title", type, [[[sourceIds]]], ..., flashcardData]]
 * ```
 * 
 * **Key Challenge:**
 * The actual flashcard data is NOT directly in the response array. Instead, it's embedded
 * within an HTML string that contains a `data-app-data` attribute. The HTML string
 * is typically nested deep within the response array structure.
 * 
 * **Parsing Strategy:**
 * 1. **Initial Parse:** Parse the JSON string response into a nested array structure
 * 2. **Recursive Search:** Recursively search through all nested arrays/objects to find
 *    HTML strings containing `data-app-data` attribute or flashcard patterns
 * 3. **HTML Extraction:** Extract the JSON from the `data-app-data` attribute value
 * 4. **Pattern Matching:** Search for `&quot;flashcards&quot;:` or `"flashcards":` patterns in HTML
 * 5. **Brace Matching:** Use brace counting to extract the complete JSON object containing
 *    the flashcard data (handles nested objects correctly)
 * 6. **Entity Decoding:** Decode HTML entities (`&quot;` → `"`, `&amp;` → `&`, etc.)
 *    and Unicode escapes (`\u003c` → `<`, etc.)
 * 7. **JSON Parse:** Parse the decoded JSON string to get the flashcards array
 * 8. **Card Mapping:** Map the flashcards array items to `Flashcard` format, handling
 *    the structure with "f" (front/question) and "b" (back/answer) properties
 * 
 * **Why This Approach:**
 * - The response can be extremely large (1MB+), so we need efficient searching
 * - The HTML string can be nested at any depth in the array structure
 * - The JSON in `data-app-data` is HTML-encoded, requiring entity decoding
 * - The flashcard data structure matches the format shown in `rpc/mm22.txt`
 * 
 * **Fallback Mechanisms:**
 * - If recursive search fails, fall back to first-level array scanning
 * - If HTML extraction fails, try direct JSON pattern matching
 * - If flashcards array not found, recursively search using `findFlashcardsArray` helper
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { FlashcardData } from '../types/artifact.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Extended FlashcardData with parsed flashcards array
 * 
 * This interface extends the base FlashcardData type with additional parsed data
 * that's convenient to work with in TypeScript applications.
 */
export interface ParsedFlashcardData {
  /** 
   * Parsed flashcards array (mapped to question/answer format for compatibility)
   * Each flashcard contains:
   * - `question`: The front of the card (what you see first)
   * - `answer`: The back of the card (the answer/reveal)
   * 
   * HTML entities are automatically decoded (e.g., `&#39;` becomes `'`)
   */
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
  /** 
   * Total number of flashcards in the deck
   * This is the same as `flashcards.length` but provided for convenience
   */
  totalCards: number;
  /** 
   * CSV string representation of the flashcards
   * 
   * Format: Each line is `"question","answer"` with proper CSV escaping:
   * - Quotes in questions/answers are escaped as `""`
   * - Fields containing commas, quotes, or newlines are wrapped in quotes
   * - Suitable for importing into spreadsheet applications (Excel, Google Sheets)
   * - Compatible with most flashcard software that accepts CSV import
   * 
   * Example:
   * ```
   * "What is AI?","Artificial Intelligence"
   * "What is ML?","Machine Learning"
   * ```
   */
  csv: string;
}

/**
 * Fetch flashcard data by flashcard ID
 * 
 * **What it does:** Retrieves the complete flashcard data including all front/back pairs.
 * This function extracts flashcard data from the NotebookLM API response, which embeds
 * the flashcard content in HTML-encoded JSON within a large response structure.
 * 
 * **Input:**
 * - `flashcardId` (string, required): The ID of the flashcard artifact to fetch.
 *   You can obtain this ID from `artifacts.list()` or `artifacts.create()`.
 * - `notebookId` (string, optional): The notebook ID that contains the flashcard.
 *   Providing this ensures the correct source-path is set for the RPC call, which
 *   improves reliability of the API request.
 * 
 * **Output:** Returns `ParsedFlashcardData` object containing:
 * - `flashcards`: Array of flashcard objects, each with:
 *   - `question`: The front text (question/prompt) - HTML entities are automatically decoded
 *   - `answer`: The back text (answer) - HTML entities are automatically decoded
 * - `totalCards`: Total number of flashcards in the deck
 * - `csv`: CSV string representation of the flashcards (comma-separated, with proper escaping)
 *   - Format: `"question","answer"\n"question2","answer2"\n...`
 *   - Quotes and commas in questions/answers are properly escaped
 *   - Suitable for importing into spreadsheet applications or flashcard software
 * 
 * **Usage Workflow:**
 * 1. Create a flashcard artifact using `artifacts.create(notebookId, ArtifactType.FLASHCARDS, {...})`
 * 2. Poll the artifact state using `artifacts.get(flashcardId)` until `state === ArtifactState.READY`
 * 3. Call this function to fetch the flashcard data
 * 4. Use the flashcards array or CSV string as needed for your application
 * 
 * **Note:**
 * - The flashcard must be in `READY` state before fetching (check with `artifacts.get()`)
 * - Attempting to fetch a flashcard that's still `CREATING` may return incomplete or no data
 * - This function uses the `RPC_GET_QUIZ_DATA` RPC method which is shared by both
 *   quiz and flashcard artifacts (they use the same underlying API endpoint)
 * - HTML entities in the flashcard text (like `&#39;` for apostrophes) are automatically decoded
 * - The CSV format is compatible with most flashcard applications and spreadsheet software
 * 
 * **Error Handling:**
 * - Throws `NotebookLMError` if the flashcard ID is missing
 * - Throws `NotebookLMError` if the API call fails
 * - Throws `NotebookLMError` if no valid flashcards are found in the response
 * 
 * @param flashcardId - The flashcard artifact ID
 * @param notebookId - Optional notebook ID (recommended for proper source-path)
 * @returns Promise resolving to ParsedFlashcardData
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, fetchFlashcardData } from 'notebooklm-kit';
 * import { ArtifactType, ArtifactState } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Step 1: Create flashcard artifact
 * const flashcard = await client.artifacts.create(
 *   'notebook-id',
 *   ArtifactType.FLASHCARDS,
 *   { title: 'My Study Cards' }
 * );
 * 
 * // Step 2: Wait until ready (poll if needed)
 * let artifact = flashcard;
 * while (artifact.state === ArtifactState.CREATING) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   artifact = await client.artifacts.get(flashcard.artifactId);
 * }
 * 
 * // Step 3: Fetch flashcard data
 * const rpc = client.getRPCClient();
 * const flashcardData = await fetchFlashcardData(
 *   rpc,
 *   flashcard.artifactId,
 *   'notebook-id'
 * );
 * 
 * console.log(`Flashcards have ${flashcardData.totalCards} cards`);
 * 
 * // Step 4: Use the flashcards
 * flashcardData.flashcards.forEach((card, index) => {
 *   console.log(`Card ${index + 1}:`);
 *   console.log(`  Question: ${card.question}`);
 *   console.log(`  Answer: ${card.answer}`);
 * });
 * 
 * // Step 5: Save as CSV file (Node.js example)
 * import fs from 'fs';
 * fs.writeFileSync('flashcards.csv', flashcardData.csv);
 * ```
 * 
 * @example
 * ```typescript
 * // Simple usage with NotebookLMClient
 * import { NotebookLMClient, fetchFlashcardData } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Get flashcard data
 * const rpc = client.getRPCClient();
 * const flashcardData = await fetchFlashcardData(
 *   rpc,
 *   'flashcard-id-123',
 *   'notebook-id-456'
 * );
 * 
 * // Export to CSV
 * console.log('CSV Format:');
 * console.log(flashcardData.csv);
 * 
 * // Work with flashcards array
 * const questions = flashcardData.flashcards.map(card => card.question);
 * const answers = flashcardData.flashcards.map(card => card.answer);
 * ```
 */
export async function fetchFlashcardData(
  rpc: RPCClient,
  flashcardId: string,
  notebookId?: string
): Promise<ParsedFlashcardData> {
  if (!flashcardId) {
    throw new NotebookLMError('Flashcard ID is required');
  }

  try {
    // Call RPC_GET_QUIZ_DATA with flashcard ID (same RPC as quiz)
    const response = await rpc.call(
      RPC.RPC_GET_QUIZ_DATA,
      [flashcardId],
      notebookId // Pass notebookId to set correct source-path
    );

    // Parse the response into FlashcardData format
    return parseFlashcardResponse(response, flashcardId);
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to fetch flashcard data for flashcard ID ${flashcardId}: ${error.message}`,
      error
    );
  }
}

/**
 * Decode HTML entities in a string
 * Handles both named entities (&quot;) and numeric entities (&#39;, &#x27;)
 * This is needed because the flashcard data contains HTML-encoded strings like:
 * - &quot; for quotes
 * - &#39; for apostrophes
 * - &amp; for ampersands
 */
function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  // Decode in order: &amp; must be decoded last to avoid double-decoding
  return text
    .replace(/&quot;/g, '"')      // Named entity: &quot;
    .replace(/&#39;/g, "'")        // Numeric entity: &#39; (apostrophe)
    .replace(/&#x27;/g, "'")       // Hex entity: &#x27; (apostrophe)
    .replace(/&#x2F;/g, '/')       // Hex entity: &#x2F; (slash)
    .replace(/&#x2f;/g, '/')       // Hex entity: &#x2f; (slash, lowercase)
    .replace(/&lt;/g, '<')         // Named entity: &lt;
    .replace(/&gt;/g, '>')         // Named entity: &gt;
    .replace(/&amp;/g, '&');       // Named entity: &amp; (must be last)
}

/**
 * Parse RPC response into ParsedFlashcardData format
 * 
 * **Implementation Details:**
 * See the file-level documentation for the complete parsing strategy.
 * 
 * **Response Structure:**
 * The RPC returns a large JSON string (often 1MB+) with structure:
 * `[["artifactId", "title", type, [[[sourceIds]]], ..., flashcardData]]`
 * 
 * **Key Finding:**
 * The flashcard data is NOT directly accessible in the response array. It's embedded
 * in an HTML string (nested deep in the array) within a `data-app-data` attribute.
 * The HTML contains HTML-encoded JSON like: 
 * `data-app-data="{&quot;flashcards&quot;:[{&quot;f&quot;:&quot;...&quot;,&quot;b&quot;:&quot;...&quot;}]}"`
 * 
 * **Parsing Steps:**
 * 1. **Parse JSON string** → nested array structure
 * 2. **Recursive Search** → Find HTML strings with `data-app-data` or flashcard patterns
 * 3. **HTML Extraction** → Extract JSON from `data-app-data` attribute (or find pattern directly)
 * 4. **Entity Decoding** → Decode HTML entities (`&quot;` → `"`, `&#39;` → `'`, etc.) and Unicode escapes
 * 5. **JSON Parse** → Parse the decoded JSON string to get the flashcards array
 * 6. **Card Mapping** → Map flashcard items from API format ("f"/"b") to standard format (question/answer)
 * 7. **CSV Generation** → Generate CSV string with proper escaping for compatibility
 * 
 * **Flashcard Data Format (from mm22.txt):**
 * The API returns flashcards in this format:
 * ```json
 * {
 *   "flashcards": [
 *     {
 *       "f": "Question text with HTML entities like &#39;",
 *       "b": "Answer text with HTML entities like &#39;"
 *     },
 *     {
 *       "f": "Another question",
 *       "b": "Another answer"
 *     }
 *   ]
 * }
 * ```
 * 
 * This is then transformed into:
 * ```json
 * {
 *   "flashcards": [
 *     {
 *       "question": "Question text with apostrophes",
 *       "answer": "Answer text with apostrophes"
 *     }
 *   ],
 *   "totalCards": 1,
 *   "csv": "\"Question text with apostrophes\",\"Answer text with apostrophes\""
 * }
 * ```
 * 
 * **Error Handling:**
 * - Validates response structure at each step
 * - Provides detailed error messages if parsing fails
 * - Throws descriptive errors indicating what went wrong and where
 * 
 * @param response - Raw RPC response (JSON string or parsed object)
 * @param flashcardId - Flashcard ID for error messages (optional, for debugging)
 * @returns Parsed ParsedFlashcardData with flashcards array, total count, and CSV
 */
function parseFlashcardResponse(response: any, flashcardId?: string): ParsedFlashcardData {
  // The response from RPC_GET_QUIZ_DATA (v9rmvd) is a JSON string
  // Structure: [["artifactId", "title", type, [[[sourceIds]]], ..., flashcardData]]
  // When parsed, it becomes: [[artifactId, title, type, sourceIds, ...flashcardData...]]
  
  const originalResponse = response;
  let parsed: any = response;
  
  // Parse JSON string if needed
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      throw new NotebookLMError(
        `Failed to parse flashcard response as JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  
  // The response is an array containing one element: [[artifactId, title, type, ...]]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new NotebookLMError(
      `Unexpected response structure: expected array with at least one element, got ${typeof parsed}`
    );
  }
  
  // Get the inner array: [artifactId, title, type, sourceIds, ...flashcardData...]
  const dataArray = parsed[0];
  if (!Array.isArray(dataArray)) {
    throw new NotebookLMError(
      `Unexpected response structure: first element should be an array, got ${typeof dataArray}`
    );
  }
  
  let flashcardsArray: any[] = [];
  
  // Helper function to extract flashcard data from an HTML string
  function extractFlashcardsFromHtmlString(htmlString: string): any[] | null {
    // First, decode unicode escapes if present
    if (htmlString.includes('\\u003c')) {
      // Decode common unicode escapes
      htmlString = htmlString
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0022/g, '"')
        .replace(/\\u0027/g, "'")
        .replace(/\\u0026/g, '&')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }
    
    // Extract data-app-data attribute value from HTML
    // Strategy: Find the JSON object containing "flashcards" by searching for the pattern
    // and then extracting the entire object by matching braces
    
    // First, try to find the JSON object containing "flashcards" by pattern matching
    // Look for &quot;flashcards&quot;: or "flashcards": (handles both HTML-encoded and regular JSON)
    const flashcardPatterns = [
      /&quot;flashcards&quot;\s*:\s*\[/,  // HTML-encoded: &quot;flashcards&quot;:
      /"flashcards"\s*:\s*\[/,           // Regular JSON: "flashcards":
    ];
    
    let flashcardMatch: RegExpMatchArray | null = null;
    
    for (let i = 0; i < flashcardPatterns.length; i++) {
      const match = htmlString.match(flashcardPatterns[i]);
      if (match && match.index !== undefined) {
        flashcardMatch = match;
        break;
      }
    }
    
    if (flashcardMatch && flashcardMatch.index !== undefined) {
      // Found the flashcard pattern, now find the opening brace of the containing object
      // Search backwards from the match to find the opening {
      let jsonStartIndex = -1;
      let braceCount = 0;
      
      for (let i = flashcardMatch.index; i >= 0; i--) {
        const char = htmlString[i];
        if (char === '}') {
          braceCount++;
        } else if (char === '{') {
          if (braceCount === 0) {
            jsonStartIndex = i;
            break;
          }
          braceCount--;
        }
      }
      
      // If we found the opening brace, find the matching closing brace
      if (jsonStartIndex >= 0) {
        braceCount = 0;
        let jsonEndIndex = -1;
        
        for (let i = jsonStartIndex; i < htmlString.length; i++) {
          const char = htmlString[i];
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }
        
        // Extract and parse the JSON
        if (jsonEndIndex > jsonStartIndex) {
          try {
            let jsonString = htmlString.substring(jsonStartIndex, jsonEndIndex)
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&#x2F;/g, '/');
            
            const jsonParsed = JSON.parse(jsonString);
            if (Array.isArray(jsonParsed.flashcards)) {
              return jsonParsed.flashcards;
            }
          } catch (e) {
            // Continue to try other methods
          }
        }
      }
    }
    
    // Fallback: Try regex-based extraction of data-app-data attribute
    let dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*"([\s\S]*?)"\s*>/);
    if (!dataAppDataMatch) {
      dataAppDataMatch = htmlString.match(/data-app-data\s*=\s*'([\s\S]*?)'\s*>/);
    }
    
    if (dataAppDataMatch && dataAppDataMatch[1]) {
      try {
        // Decode HTML entities in the JSON string before parsing
        let jsonString = dataAppDataMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .trim();
        
        const jsonParsed = JSON.parse(jsonString);
        if (Array.isArray(jsonParsed.flashcards)) {
          return jsonParsed.flashcards;
        }
      } catch (e) {
        // Continue searching
      }
    }
    
    return null;
  }
  
  // Recursively search through the data array for HTML strings containing flashcard data
  function searchForHtmlString(obj: any, depth: number = 0): any[] | null {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if it's an HTML string containing data-app-data attribute or flashcard data
      if (obj.includes('data-app-data') || obj.includes('<!doctype html') || 
          obj.includes('<app-root') || obj.includes('\\u003c!doctype') ||
          obj.includes('&quot;flashcards&quot;') || obj.includes('"flashcards"')) {
        const result = extractFlashcardsFromHtmlString(obj);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = searchForHtmlString(item, depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const result = searchForHtmlString(obj[key], depth + 1);
        if (result && result.length > 0) {
          return result;
        }
      }
    }
    
    return null;
  }
  
  // Search through the data array for flashcard data
  const foundFlashcards = searchForHtmlString(dataArray);
  if (foundFlashcards && foundFlashcards.length > 0) {
    flashcardsArray = foundFlashcards;
  } else {
    // Fallback: search through first level of array for other formats
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      
      // Try extracting from HTML string using the helper
      if (typeof item === 'string') {
        const result = extractFlashcardsFromHtmlString(item);
        if (result && result.length > 0) {
          flashcardsArray = result;
          break;
        }
      }
      
      // Check if it's a JSON string with flashcard data (not in HTML)
      if (typeof item === 'string' && item.includes('"flashcards"')) {
        try {
          const jsonParsed = JSON.parse(item);
          if (jsonParsed && typeof jsonParsed === 'object') {
            if (Array.isArray(jsonParsed.flashcards)) {
              flashcardsArray = jsonParsed.flashcards;
              break;
            }
            // Recursively search the parsed object
            const found = findFlashcardsArray(jsonParsed);
            if (found.length > 0) {
              flashcardsArray = found;
              break;
            }
          }
        } catch (e) {
          // Try to extract JSON from the string
          const jsonMatch = item.match(/\{[\s\S]*"flashcards"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const jsonParsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(jsonParsed.flashcards)) {
                flashcardsArray = jsonParsed.flashcards;
                break;
              }
            } catch (e2) {
              // Continue searching
            }
          }
        }
      }
      
      // Check if it's an object with flashcards property
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if ('flashcards' in item && Array.isArray((item as any).flashcards)) {
          flashcardsArray = (item as any).flashcards;
          break;
        }
        // Recursively search the object
        const found = findFlashcardsArray(item);
        if (found.length > 0) {
          flashcardsArray = found;
          break;
        }
      }
    
      // Check if it's an array of flashcard objects
      if (Array.isArray(item) && item.length > 0) {
        const firstItem = item[0];
        if (firstItem && typeof firstItem === 'object' && ('f' in firstItem || 'front' in firstItem)) {
          flashcardsArray = item;
          break;
        }
        // Recursively search nested arrays
        const found = findFlashcardsArray(item);
        if (found.length > 0) {
          flashcardsArray = found;
          break;
        }
      }
    }
  }
  
  // If still not found, recursively search the entire data array
  if (flashcardsArray.length === 0) {
    flashcardsArray = findFlashcardsArray(dataArray);
  }

  // Parse flashcards from the array structure
  const flashcards: Array<{ question: string; answer: string }> = [];

  for (const item of flashcardsArray) {
    if (item && typeof item === 'object') {
      // Handle object format: { f: "front", b: "back" } or { front: "...", back: "..." } or { question: "...", answer: "..." }
      // Expected structure (from mm22.txt):
      // {
      //   "f": "Question text with HTML entities like &#39;",
      //   "b": "Answer text with HTML entities like &#39;"
      // }
      
      // Extract front/question (f, front, or question)
      const frontText = item.f !== undefined ? item.f : (item.front !== undefined ? item.front : item.question);
      // Extract back/answer (b, back, or answer)
      const backText = item.b !== undefined ? item.b : (item.back !== undefined ? item.back : item.answer);
      
      if (frontText !== undefined && backText !== undefined) {
        // Decode HTML entities in both front and back
        const question = decodeHtmlEntities(String(frontText));
        const answer = decodeHtmlEntities(String(backText));
        
        // Only add if we have valid question and answer
        if (question.trim() && answer.trim()) {
          flashcards.push({ question, answer });
        }
      }
    } else if (Array.isArray(item) && item.length >= 2) {
      // Handle array format: [front/question, back/answer, ...]
      const question = decodeHtmlEntities(String(item[0] || ''));
      const answer = decodeHtmlEntities(String(item[1] || ''));
      
      if (question.trim() && answer.trim()) {
        flashcards.push({ question, answer });
      }
    }
  }

  if (flashcards.length === 0) {
    // Provide more helpful error message with structure info
    let responsePreview: string;
    const responseType = typeof originalResponse;
    if (responseType === 'string') {
      responsePreview = (originalResponse as string).substring(0, 500);
    } else if (Array.isArray(originalResponse)) {
      responsePreview = `Array with ${originalResponse.length} items, first item type: ${typeof originalResponse[0]}`;
      if (originalResponse.length > 0 && Array.isArray(originalResponse[0])) {
        responsePreview += `, first element is array with ${originalResponse[0].length} items`;
      }
    } else if (originalResponse && typeof originalResponse === 'object') {
      responsePreview = `Object with keys: ${Object.keys(originalResponse).slice(0, 10).join(', ')}`;
    } else {
      responsePreview = String(originalResponse);
    }
    
    throw new NotebookLMError(
      `No valid flashcards found in flashcard response. ` +
      `Response type: ${responseType}, Preview: ${responsePreview}. ` +
      `Flashcard array found: ${flashcardsArray.length} items. ` +
      `The flashcard data might be in a different format or location than expected. ` +
      `If this is a quiz artifact, use the quiz fetching function instead.`
    );
  }

  // Generate CSV string from flashcards
  // CSV format: "question","answer" with proper escaping for quotes, commas, and newlines
  const csvLines = flashcards.map(card => {
    // Escape quotes and commas in CSV format
    // CSV escaping rules: wrap in quotes if contains comma, quote, or newline
    // Within quoted fields, escape double quotes by doubling them ("")
    const escapeCSV = (text: string): string => {
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    return `${escapeCSV(card.question)},${escapeCSV(card.answer)}`;
  });
  const csv = csvLines.join('\n');

  return {
    flashcards,
    totalCards: flashcards.length,
    csv,
  };
}

/**
 * Recursively search for flashcards array in nested response structure
 */
function findFlashcardsArray(obj: any, depth: number = 0): any[] {
  // Prevent infinite recursion
  if (depth > 15) {
    return [];
  }

  if (Array.isArray(obj)) {
    // Check if this array looks like a flashcards array (array of flashcard objects)
    if (obj.length > 0) {
      const firstItem = obj[0];
      
      // Check if first item is a flashcard object (has "f" and "b" properties)
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        if (('f' in firstItem || 'front' in firstItem) && ('b' in firstItem || 'back' in firstItem)) {
          return obj;
        }
      }
      
      // Check if first item looks like a flashcard structure in array format
      if (Array.isArray(firstItem) && firstItem.length >= 2) {
        // Might be [front, back]
        return obj;
      }
      
      // Recursively search nested arrays
      for (const item of obj) {
        if (Array.isArray(item)) {
          const found = findFlashcardsArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          // Check if this object has a 'flashcards' property
          if (Array.isArray(item.flashcards)) {
            return item.flashcards;
          }
          // Recursively search object properties
          const found = findFlashcardsArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (typeof item === 'string' && item.includes('"flashcards"')) {
          // Try to parse JSON string
          try {
            const jsonParsed = JSON.parse(item);
            if (Array.isArray(jsonParsed.flashcards)) {
              return jsonParsed.flashcards;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }
    }
  } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    // Search object properties
    for (const key in obj) {
      if (key === 'flashcards' && Array.isArray(obj[key])) {
        return obj[key];
      }
      if (Array.isArray(obj[key])) {
        const found = findFlashcardsArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (obj[key] && typeof obj[key] === 'object') {
        const found = findFlashcardsArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (typeof obj[key] === 'string' && obj[key].includes('"flashcards"')) {
        // Try to parse JSON string
        try {
          const jsonParsed = JSON.parse(obj[key]);
          if (Array.isArray(jsonParsed.flashcards)) {
            return jsonParsed.flashcards;
          }
        } catch (e) {
          // Continue searching
        }
      }
    }
  }

  return [];
}

