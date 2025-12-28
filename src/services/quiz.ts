/**
 * Quiz service
 * Handles quiz data fetching operations
 * 
 * ## Implementation Method
 * 
 * **RPC Method:** `RPC_GET_QUIZ_DATA` (RPC ID: `v9rmvd`)
 * 
 * **Response Structure:**
 * The RPC returns a large JSON string (often 1MB+) with the structure:
 * ```
 * [["artifactId", "title", type, [[[sourceIds]]], ..., quizData]]
 * ```
 * 
 * **Key Challenge:**
 * The actual quiz data is NOT directly in the response array. Instead, it's embedded
 * within an HTML string that contains a `data-app-data` attribute. The HTML string
 * is typically nested deep within the response array structure.
 * 
 * **Parsing Strategy:**
 * 1. **Initial Parse:** Parse the JSON string response into a nested array structure
 * 2. **Recursive Search:** Recursively search through all nested arrays/objects to find
 *    HTML strings containing `data-app-data` attribute or quiz patterns
 * 3. **HTML Extraction:** Extract the JSON from the `data-app-data` attribute value
 * 4. **Pattern Matching:** Search for `&quot;quiz&quot;:` or `"quiz":` patterns in HTML
 * 5. **Brace Matching:** Use brace counting to extract the complete JSON object containing
 *    the quiz data (handles nested objects correctly)
 * 6. **Entity Decoding:** Decode HTML entities (`&quot;` → `"`, `&amp;` → `&`, etc.)
 *    and Unicode escapes (`\u003c` → `<`, etc.)
 * 7. **JSON Parse:** Parse the decoded JSON string to get the quiz array
 * 8. **Question Mapping:** Map the quiz array items to `QuizQuestion` format, handling
 *    both object format (`{question, answerOptions}`) and array format
 * 
 * **Why This Approach:**
 * - The response can be extremely large (1.3MB+), so we need efficient searching
 * - The HTML string can be nested at any depth in the array structure
 * - The JSON in `data-app-data` is HTML-encoded, requiring entity decoding
 * - The quiz data structure matches the format shown in `rpc/mm20.txt`
 * 
 * **Fallback Mechanisms:**
 * - If recursive search fails, fall back to first-level array scanning
 * - If HTML extraction fails, try direct JSON pattern matching
 * - If quiz array not found, recursively search using `findQuizArray` helper
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { QuizData, QuizQuestion } from '../types/artifact.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Fetch quiz data by quiz ID
 * 
 * **What it does:** Retrieves the complete quiz data including all questions, 
 * answer options, correct answers, and explanations/rationales.
 * 
 * **Input:**
 * - `quizId` (string, required): The ID of the quiz artifact to fetch
 * - `notebookId` (string, optional): The notebook ID that contains the quiz.
 *   Providing this ensures the correct source-path is set for the RPC call.
 * 
 * **Output:** Returns `QuizData` object containing:
 * - `questions`: Array of quiz questions, each with:
 *   - `question`: The question text
 *   - `options`: Array of answer option strings
 *   - `correctAnswer`: Index of the correct answer (0-based)
 *   - `explanation`: Optional explanation/rationale for the answer
 * - `totalQuestions`: Total number of questions in the quiz
 * 
 * **Note:**
 * - The quiz must be in `READY` state before fetching (check with `artifacts.get()`)
 * - This function uses the `RPC_GET_QUIZ_DATA` RPC method which is specifically 
 *   designed for quiz and flashcard artifacts
 * 
 * @param quizId - The quiz artifact ID
 * @param notebookId - Optional notebook ID (recommended for proper source-path)
 * @returns Promise resolving to QuizData
 * 
 * @example
 * ```typescript
 * import { RPCClient } from 'notebooklm-kit';
 * 
 * const rpc = new RPCClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Fetch quiz data
 * const quizData = await fetchQuizData(rpc, 'quiz-id-123', 'notebook-id-456');
 * 
 * console.log(`Quiz has ${quizData.totalQuestions} questions`);
 * 
 * // Iterate through questions
 * quizData.questions.forEach((q, index) => {
 *   console.log(`Question ${index + 1}: ${q.question}`);
 *   console.log(`Correct answer: ${q.options[q.correctAnswer]}`);
 *   if (q.explanation) {
 *     console.log(`Explanation: ${q.explanation}`);
 *   }
 * });
 * ```
 */
export async function fetchQuizData(
  rpc: RPCClient,
  quizId: string,
  notebookId?: string
): Promise<QuizData> {
  if (!quizId) {
    throw new NotebookLMError('Quiz ID is required');
  }

  try {
    // Call RPC_GET_QUIZ_DATA with quiz ID
    const response = await rpc.call(
      RPC.RPC_GET_QUIZ_DATA,
      [quizId],
      notebookId // Pass notebookId to set correct source-path
    );

    // Parse the response into QuizData format
    return parseQuizResponse(response, quizId);
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to fetch quiz data for quiz ID ${quizId}: ${error.message}`,
      error
    );
  }
}

/**
 * Decode HTML entities in a string
 * Handles both named entities (&quot;) and numeric entities (&#39;, &#x27;)
 * This is needed because the quiz data contains HTML-encoded strings like:
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
 * Parse RPC response into QuizData format
 * 
 * **Implementation Details:**
 * See the file-level documentation for the complete parsing strategy.
 * 
 * **Response Structure:**
 * The RPC returns a large JSON string (often 1MB+) with structure:
 * `[["artifactId", "title", type, [[[sourceIds]]], ..., quizData]]`
 * 
 * **Key Finding:**
 * The quiz data is NOT directly accessible. It's embedded in an HTML string
 * (nested deep in the array) within a `data-app-data` attribute. The HTML contains
 * HTML-encoded JSON like: `data-app-data="{&quot;quiz&quot;:[...]}"`
 * 
 * **Parsing Steps:**
 * 1. Parse JSON string → nested array
 * 2. Recursively search for HTML strings with `data-app-data` or quiz patterns
 * 3. Extract JSON from `data-app-data` attribute (or find quiz pattern directly)
 * 4. Decode HTML entities (`&quot;` → `"`, etc.) and Unicode escapes
 * 5. Parse decoded JSON to get quiz array
 * 6. Map quiz items to `QuizQuestion` format
 * 
 * **Quiz Data Format (from mm20.txt):**
 * ```json
 * {
 *   "quiz": [
 *     {
 *       "question": "...",
 *       "answerOptions": [
 *         { "text": "...", "isCorrect": true/false, "rationale": "..." }
 *       ],
 *       "hint": "..."
 *     }
 *   ]
 * }
 * ```
 * 
 * @param response - Raw RPC response (JSON string or parsed object)
 * @param quizId - Quiz ID for error messages
 * @returns Parsed QuizData
 */
function parseQuizResponse(response: any, quizId?: string): QuizData {
  // The response from RPC_GET_QUIZ_DATA (v9rmvd) is a JSON string
  // Structure: [["artifactId", "title", type, [[[sourceIds]]], ..., quizData]]
  // When parsed, it becomes: [[artifactId, title, type, sourceIds, ...quizData...]]
  
  const originalResponse = response;
  let parsed: any = response;
  
  // Parse JSON string if needed
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      throw new NotebookLMError(
        `Failed to parse quiz response as JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  
  // The response is an array containing one element: [[artifactId, title, type, ...]]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new NotebookLMError(
      `Unexpected response structure: expected array with at least one element, got ${typeof parsed}`
    );
  }
  
  // Get the inner array: [artifactId, title, type, sourceIds, ...quizData...]
  const dataArray = parsed[0];
  if (!Array.isArray(dataArray)) {
    throw new NotebookLMError(
      `Unexpected response structure: first element should be an array, got ${typeof dataArray}`
    );
  }
  
  // The structure is: [artifactId, title, type, sourceIds, number, null, null, null, ..., quizData]
  // Based on the terminal output, we need to find where the quiz data starts
  // The quiz data is likely a JSON string or object somewhere in this array
  
  // Look for quiz data - it could be:
  // 1. A JSON string containing {"quiz": [...]}
  // 2. An object with a "quiz" property
  // 3. An array of question objects
  
  let quizArray: any[] = [];
  
  // Helper function to extract quiz data from an HTML string
  function extractQuizFromHtmlString(htmlString: string): any[] | null {
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
    // The attribute value is typically a large HTML-encoded JSON string
    // Strategy: Find the JSON object containing "quiz" by searching for the pattern
    // and then extracting the entire object by matching braces
    
    // First, try to find the JSON object containing "quiz" by pattern matching
    // Look for &quot;quiz&quot;: or "quiz": (handles both HTML-encoded and regular JSON)
    const quizPatterns = [
      /&quot;quiz&quot;\s*:\s*\[/,  // HTML-encoded: &quot;quiz&quot;:
      /"quiz"\s*:\s*\[/,           // Regular JSON: "quiz":
    ];
    
    let quizMatch: RegExpMatchArray | null = null;
    
    for (let i = 0; i < quizPatterns.length; i++) {
      const match = htmlString.match(quizPatterns[i]);
      if (match && match.index !== undefined) {
        quizMatch = match;
        break;
      }
    }
    
    if (quizMatch && quizMatch.index !== undefined) {
      // Found the quiz pattern, now find the opening brace of the containing object
      // Search backwards from the match to find the opening {
      let jsonStartIndex = -1;
      let braceCount = 0;
      
      for (let i = quizMatch.index; i >= 0; i--) {
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
            if (Array.isArray(jsonParsed.quiz)) {
              return jsonParsed.quiz;
            }
            // If quiz is not directly in the object, return null and let the recursive search handle it
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
        // This converts &quot; to " so JSON.parse works
        // Note: We decode &#39; here too, which is fine as it's inside string values
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
        if (Array.isArray(jsonParsed.quiz)) {
          // Return the quiz array - values may still contain HTML entities like &#39;
          // These will be decoded later when we process each question/option
          return jsonParsed.quiz;
        }
        // If quiz is not directly in the object, return null and let the recursive search handle it
      } catch (e) {
        // Continue searching
      }
    }
    
    return null;
  }
  
  // Recursively search through the data array for HTML strings containing quiz data
  function searchForHtmlString(obj: any, depth: number = 0): any[] | null {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if it's an HTML string containing data-app-data attribute or quiz data
      if (obj.includes('data-app-data') || obj.includes('<!doctype html') || 
          obj.includes('<app-root') || obj.includes('\\u003c!doctype') ||
          obj.includes('&quot;quiz&quot;') || obj.includes('"quiz"')) {
        const result = extractQuizFromHtmlString(obj);
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
  
  // Search through the data array for quiz data
  // Based on mm20.txt, the quiz data is embedded in HTML as data-app-data attribute
  // The HTML string might be nested deep in the array structure
  const foundQuiz = searchForHtmlString(dataArray);
  if (foundQuiz && foundQuiz.length > 0) {
    quizArray = foundQuiz;
  } else {
    // Fallback: search through first level of array for other formats
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      
      // Try extracting from HTML string using the helper
      if (typeof item === 'string') {
        const result = extractQuizFromHtmlString(item);
        if (result && result.length > 0) {
          quizArray = result;
          break;
        }
      }
      
      // Check if it's a JSON string with quiz data (not in HTML)
      if (typeof item === 'string' && item.includes('"quiz"')) {
        try {
        const jsonParsed = JSON.parse(item);
        if (jsonParsed && typeof jsonParsed === 'object') {
          if (Array.isArray(jsonParsed.quiz)) {
            quizArray = jsonParsed.quiz;
            break;
          }
          // Recursively search the parsed object
          const found = findQuizArray(jsonParsed);
          if (found.length > 0) {
            quizArray = found;
            break;
          }
        }
      } catch (e) {
        // Try to extract JSON from the string
        const jsonMatch = item.match(/\{[\s\S]*"quiz"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const jsonParsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(jsonParsed.quiz)) {
              quizArray = jsonParsed.quiz;
              break;
            }
          } catch (e2) {
            // Continue searching
          }
        }
      }
      
      // Check if it's an object with quiz property
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if ('quiz' in item && Array.isArray((item as any).quiz)) {
          quizArray = (item as any).quiz;
          break;
        }
        // Recursively search the object
        const found = findQuizArray(item);
        if (found.length > 0) {
          quizArray = found;
          break;
        }
      }
    
    // Check if it's an array of question objects
    if (Array.isArray(item) && item.length > 0) {
      const firstItem = item[0];
      if (firstItem && typeof firstItem === 'object' && 'question' in firstItem) {
        quizArray = item;
        break;
      }
      // Recursively search nested arrays
      const found = findQuizArray(item);
      if (found.length > 0) {
        quizArray = found;
        break;
      }
    }
  }
  }
  }
  
  // If still not found, recursively search the entire data array
  if (quizArray.length === 0) {
    quizArray = findQuizArray(dataArray);
  }

  // Parse questions from the array structure
  const questions: QuizQuestion[] = [];

  for (const item of quizArray) {
    if (Array.isArray(item) && item.length > 0) {
      // Handle array format: [question, options[], correctIndex, explanation?, ...]
      const questionData = item;
      
      if (questionData.length >= 3) {
        const question: QuizQuestion = {
          question: String(questionData[0] || ''),
          options: Array.isArray(questionData[1]) 
            ? questionData[1].map((opt: any) => String(opt || ''))
            : [],
          correctAnswer: Number(questionData[2]) || 0,
          explanation: questionData[3] ? String(questionData[3]) : undefined,
        };

        // Only add if we have a valid question
        if (question.question && question.options.length > 0) {
          questions.push(question);
        }
      }
    } else if (item && typeof item === 'object') {
      // Handle object format: { question, options, correctAnswer, explanation }
      // Also handle: { question, answerOptions: [{text, isCorrect, rationale}], hint }
      // 
      // Expected structure (from actual API responses):
      // {
      //   "question": "Question text with HTML entities like &#39;",
      //   "answerOptions": [
      //     {
      //       "text": "Option text",
      //       "isCorrect": true/false,
      //       "rationale": "Explanation with HTML entities like &#39;"
      //     },
      //     ...
      //   ],
      //   "hint": "Hint text with HTML entities like &#39;"
      // }
      
      // Extract options and their rationales
      // Priority: answerOptions (has rationales) > options (simple array)
      let options: string[] = [];
      let optionReasons: string[] | undefined = [];
      let correctAnswerFromOptions: number | null = null; // Track if we found correct answer in answerOptions
      
      // Prefer answerOptions if it exists (has more data: text, isCorrect, rationale)
      // Structure from mm20.txt: answerOptions is array of {text, isCorrect, rationale}
      // Check for answerOptions first (this is the format with hints and rationales)
      if (item.answerOptions && Array.isArray(item.answerOptions) && item.answerOptions.length > 0) {
        // answerOptions format with objects containing text, isCorrect, rationale
        optionReasons = []; // Ensure it's initialized as an array
        options = item.answerOptions.map((opt: any) => {
          if (typeof opt === 'object' && opt !== null) {
            // Extract text - decode HTML entities (may contain &#39; etc.)
            const optText = opt.text ? decodeHtmlEntities(String(opt.text)) : String(opt || '');
            
            // Extract rationale if available - decode HTML entities
            // Every option should have a rationale according to mm20.txt structure
            if (opt.rationale !== undefined && opt.rationale !== null && String(opt.rationale).trim() !== '') {
              optionReasons!.push(decodeHtmlEntities(String(opt.rationale)));
            } else {
              // If rationale is missing, push empty string to maintain array alignment
              optionReasons!.push('');
            }
            
            return optText;
          }
          // Fallback for non-object options
          optionReasons!.push('');
          return decodeHtmlEntities(String(opt || ''));
        });
        
        // Find correct answer index by checking isCorrect flag
        // According to mm20.txt, the source of truth is the isCorrect flag in answerOptions
        const foundCorrectIndex = item.answerOptions.findIndex((opt: any) => 
          typeof opt === 'object' && opt !== null && opt.isCorrect === true
        );
        if (foundCorrectIndex !== -1) {
          correctAnswerFromOptions = foundCorrectIndex;
        }
      } else if (item.options && Array.isArray(item.options)) {
        // Simple array format (no rationales available)
        options = item.options.map((opt: any) => decodeHtmlEntities(String(opt || '')));
      }
      
      // Extract correct answer index
      // Priority: If we found correct answer in answerOptions (isCorrect flag), use that (source of truth)
      // Otherwise, fall back to item.correctAnswer or item.correctIndex fields
      const correctAnswer = correctAnswerFromOptions !== null
        ? correctAnswerFromOptions
        : typeof item.correctAnswer === 'number'
        ? item.correctAnswer
        : typeof item.correctIndex === 'number'
        ? item.correctIndex
        : 0;
      
      // Extract reasoning (rationale for correct answer)
      // According to mm20.txt, the correct answer's rationale is in answerOptions[correctIndex].rationale
      // The rationale field in answerOptions contains the explanation for why that option is correct/incorrect
      let reasoning: string | undefined = undefined;
      if (item.answerOptions && Array.isArray(item.answerOptions) && correctAnswer >= 0 && correctAnswer < item.answerOptions.length) {
        const correctOption = item.answerOptions[correctAnswer];
        if (correctOption && typeof correctOption === 'object' && correctOption !== null) {
          // Extract the rationale for the correct answer option
          if (correctOption.rationale !== undefined && correctOption.rationale !== null && String(correctOption.rationale).trim() !== '') {
            reasoning = decodeHtmlEntities(String(correctOption.rationale));
          }
        }
      }
      
      // Fallback to explanation or rationale if reasoning not found (for backward compatibility)
      if (!reasoning || reasoning.trim() === '') {
        if (item.explanation !== undefined && item.explanation !== null && String(item.explanation).trim() !== '') {
          reasoning = decodeHtmlEntities(String(item.explanation));
        } else if (item.rationale !== undefined && item.rationale !== null && String(item.rationale).trim() !== '') {
          reasoning = decodeHtmlEntities(String(item.rationale));
        }
      }
      
      // Extract hint - structure from mm20.txt shows hint is at question level
      // Try multiple possible field names and decode HTML entities
      // Note: hint should be at the question object level according to mm20.txt
      let hint: string | undefined = undefined;
      if (item.hint !== undefined && item.hint !== null) {
        hint = decodeHtmlEntities(String(item.hint));
      } else if (item.hintText !== undefined && item.hintText !== null) {
        hint = decodeHtmlEntities(String(item.hintText));
      }
      
      // Clean up optionReasons: only set to undefined if we truly have no rationales
      // Keep the array if we have at least one non-empty rationale
      if (optionReasons && optionReasons.length > 0) {
        const hasAnyRationale = optionReasons.some(r => r && r.trim().length > 0);
        if (!hasAnyRationale) {
          optionReasons = undefined;
        }
      } else {
        optionReasons = undefined;
      }
      
      // Decode HTML entities in question text
      const questionText = decodeHtmlEntities(String(item.question || ''));
      
      const question: QuizQuestion = {
        question: questionText,
        options,
        correctAnswer,
        explanation: reasoning, // Keep for backward compatibility
        reasoning,
        hint,
        optionReasons,
      };

      // Only add if we have a valid question
      if (question.question && question.options.length > 0) {
        questions.push(question);
      }
    }
  }

  if (questions.length === 0) {
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
      `No valid questions found in quiz response. ` +
      `Response type: ${responseType}, Preview: ${responsePreview}. ` +
      `Quiz array found: ${quizArray.length} items. ` +
      `The quiz data might be in a different format or location than expected. ` +
      `If this is a flashcard artifact, use the flashcard fetching function instead.`
    );
  }

  return {
    questions,
    totalQuestions: questions.length,
  };
}

/**
 * Recursively search for quiz array in nested response structure
 */
function findQuizArray(obj: any, depth: number = 0): any[] {
  // Prevent infinite recursion
  if (depth > 15) {
    return [];
  }

  if (Array.isArray(obj)) {
    // Check if this array looks like a quiz array (array of question objects)
    if (obj.length > 0) {
      const firstItem = obj[0];
      
      // Check if first item is a question object (from mm20.txt format)
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        if ('question' in firstItem && 'answerOptions' in firstItem) {
          return obj;
        }
      }
      
      // Check if first item looks like a question structure in array format
      if (Array.isArray(firstItem) && firstItem.length >= 3) {
        // Might be [question, options[], correctIndex, ...]
        return obj;
      }
      
      // Recursively search nested arrays
      for (const item of obj) {
        if (Array.isArray(item)) {
          const found = findQuizArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          // Check if this object has a 'quiz' property
          if (Array.isArray(item.quiz)) {
            return item.quiz;
          }
          // Recursively search object properties
          const found = findQuizArray(item, depth + 1);
          if (found.length > 0) {
            return found;
          }
        } else if (typeof item === 'string' && item.includes('"quiz"')) {
          // Try to parse JSON string
          try {
            const jsonParsed = JSON.parse(item);
            if (Array.isArray(jsonParsed.quiz)) {
              return jsonParsed.quiz;
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
      if (key === 'quiz' && Array.isArray(obj[key])) {
        return obj[key];
      }
      if (Array.isArray(obj[key])) {
        const found = findQuizArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (obj[key] && typeof obj[key] === 'object') {
        const found = findQuizArray(obj[key], depth + 1);
        if (found.length > 0) {
          return found;
        }
      } else if (typeof obj[key] === 'string' && obj[key].includes('"quiz"')) {
        // Try to parse JSON string
        try {
          const jsonParsed = JSON.parse(obj[key]);
          if (Array.isArray(jsonParsed.quiz)) {
            return jsonParsed.quiz;
          }
        } catch (e) {
          // Continue searching
        }
      }
    }
  }

  return [];
}


