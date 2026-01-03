/**
 * Chat Basic Example
 * ==================
 * 
 * Demonstrates basic chat functionality with NotebookLM:
 * - Streaming and non-streaming modes
 * - Citation extraction
 * - Conversation metadata tracking
 * - Error handling
 * 
 * Usage:
 *   tsx chat-basic.ts <notebook-id> [message] [--no-stream]
 * 
 * Examples:
 *   # Interactive mode (prompts for notebook and message)
 *   tsx chat-basic.ts
 * 
 *   # With notebook ID and message
 *   tsx chat-basic.ts <notebook-id> "What are the key findings?"
 * 
 *   # Non-streaming mode (get complete response at once)
 *   tsx chat-basic.ts <notebook-id> "What are the key findings?" --no-stream
 */

import { createSDK, handleError } from './utils.js';
import type { Notebook } from '../src/types/notebook.js';
import type { Source } from '../src/types/source.js';
import { SourceStatus } from '../src/types/source.js';
import type { StreamChunk } from '../src/utils/streaming-client.js';
import type { ChatResponseData } from '../src/types/common.js';
import * as readline from 'readline';

/**
 * Extract text from rawData (the full response structure from API)
 * The rawData structure from the API is an array where:
 * - First element is an array: ["text", null, metadata, null, formatting]
 * - The text is at rawData[0][0]
 */
function extractTextFromRawData(rawData: any, debug: boolean = false): string {
  if (!rawData) {
    if (debug) console.log('🔍 [extractTextFromRawData] rawData is null/undefined');
    return '';
  }
  
  if (debug) {
    console.log('\n🔍 [extractTextFromRawData] Raw data structure:');
    console.log('   Type:', Array.isArray(rawData) ? 'Array' : typeof rawData);
    console.log('   Length:', Array.isArray(rawData) ? rawData.length : 'N/A');
    if (Array.isArray(rawData) && rawData.length > 0) {
      console.log('   First element type:', Array.isArray(rawData[0]) ? 'Array' : typeof rawData[0]);
      if (Array.isArray(rawData[0])) {
        console.log('   First element length:', rawData[0].length);
        if (rawData[0].length > 0) {
          console.log('   First element[0] type:', typeof rawData[0][0]);
          if (typeof rawData[0][0] === 'string') {
            console.log('   First element[0] preview:', rawData[0][0].substring(0, 100));
          } else {
            console.log('   First element[0] value:', rawData[0][0]);
          }
        }
      } else if (typeof rawData[0] === 'string') {
        console.log('   First element (string) preview:', rawData[0].substring(0, 100));
      }
    }
  }
  
  // rawData is an array: [["text", null, metadata, null, formatting], ...]
  if (Array.isArray(rawData) && rawData.length > 0) {
    const firstElement = rawData[0];
    if (Array.isArray(firstElement) && firstElement.length > 0) {
      const text = firstElement[0];
      if (typeof text === 'string') {
        if (debug) console.log('✅ [extractTextFromRawData] Extracted text from rawData[0][0], length:', text.length);
        return text;
      } else {
        if (debug) console.log('⚠️  [extractTextFromRawData] rawData[0][0] is not a string, type:', typeof text);
      }
    } else if (typeof firstElement === 'string') {
      // Sometimes the text might be directly in the first element
      if (debug) console.log('✅ [extractTextFromRawData] Extracted text from rawData[0], length:', firstElement.length);
      return firstElement;
    } else {
      if (debug) console.log('⚠️  [extractTextFromRawData] First element is neither array nor string');
    }
  } else {
    if (debug) console.log('⚠️  [extractTextFromRawData] rawData is not an array or is empty');
  }
  
  return '';
}

/**
 * Prompt user for input
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Select a notebook from the list
 */
async function selectNotebook(notebooks: Notebook[]): Promise<string> {
  if (notebooks.length === 0) {
    throw new Error('No notebooks found. Please create a notebook first.');
  }

  console.log('\n📚 Available notebooks:');
  console.log('─'.repeat(60));
  notebooks.forEach((notebook, i) => {
    const emoji = notebook.emoji || '📄';
    const sources = notebook.sourceCount || 0;
    console.log(`${i + 1}. ${emoji} ${notebook.title}`);
    console.log(`   ID: ${notebook.projectId}`);
    console.log(`   Sources: ${sources}\n`);
  });
  console.log('─'.repeat(60));

  while (true) {
    const selection = await promptUser(`\nSelect a notebook (1-${notebooks.length}): `);
    const index = parseInt(selection, 10) - 1;
    
    if (index >= 0 && index < notebooks.length) {
      return notebooks[index].projectId;
    }
    
    console.error(`❌ Invalid selection. Please enter a number between 1 and ${notebooks.length}.`);
  }
}

/**
 * Select sources from the list
 */
async function selectSources(sources: Source[]): Promise<string[]> {
  if (sources.length === 0) {
    return [];
  }

  // Filter to only ready sources
  const readySources = sources.filter(s => s.status === SourceStatus.READY || !s.status);
  
  if (readySources.length === 0) {
    console.log('\n⚠️  No ready sources found. All sources may still be processing.');
    return [];
  }

  console.log('\n📄 Available sources:');
  console.log('─'.repeat(60));
  readySources.forEach((source, i) => {
    const type = source.type || 'UNKNOWN';
    const title = source.title || 'Untitled';
    const status = source.status || 'READY';
    console.log(`${i + 1}. ${title}`);
    console.log(`   ID: ${source.sourceId}`);
    console.log(`   Type: ${type}`);
    console.log(`   Status: ${status}`);
    if (source.url) {
      console.log(`   URL: ${source.url}`);
    }
    console.log();
  });
  console.log('─'.repeat(60));

  const selection = await promptUser(
    `\nSelect sources (comma-separated numbers, e.g., 1,2,3 or 'all' for all sources): `
  );
  
  if (selection.toLowerCase().trim() === 'all') {
    return readySources.map(s => s.sourceId);
  }

  const indices = selection.split(',').map(s => parseInt(s.trim(), 10) - 1);
  const selectedSources: string[] = [];
  
  for (const index of indices) {
    if (index >= 0 && index < readySources.length) {
      selectedSources.push(readySources[index].sourceId);
    } else {
      console.error(`⚠️  Invalid selection: ${index + 1} (skipping)`);
    }
  }
  
  return selectedSources;
}

async function main() {
  // Parse arguments (filter out flags)
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const useStreaming = !process.argv.includes('--no-stream');
  
  // Only enable debug in streaming mode (cleaner output for --no-stream)
  const sdk = await createSDK({ debug: useStreaming });

  try {
    await sdk.connect();
    
    // List notebooks
    console.log('🔍 Fetching notebooks...');
    const notebooks: Notebook[] = await sdk.notebooks.list();
    
    // Select notebook
    const notebookId = args[0] || await selectNotebook(notebooks);
    const selectedNotebook = notebooks.find(nb => nb.projectId === notebookId);
    
    if (!selectedNotebook && !args[0]) {
      throw new Error(`Notebook ${notebookId} not found`);
    }
    
    // List sources and allow selection
    console.log('\n🔍 Fetching sources...');
    let sources: Source[] = [];
    let selectedSourceIds: string[] | undefined;
    
    try {
      sources = await sdk.sources.list(notebookId);
      console.log(`✅ Found ${sources.length} source(s)`);
      
      if (sources.length > 0) {
        const readySources = sources.filter(s => s.status === SourceStatus.READY || !s.status);
        if (readySources.length > 0) {
          const selectSourcesAnswer = await promptUser('\n🎯 Select specific sources? (y/n, default: n - use all): ');
          if (selectSourcesAnswer.toLowerCase().trim() === 'y') {
            selectedSourceIds = await selectSources(sources);
            if (selectedSourceIds.length === 0) {
              console.log('⚠️  No sources selected, using all sources');
              selectedSourceIds = undefined;
            } else {
              console.log(`\n✅ Selected ${selectedSourceIds.length} source(s) for chat`);
            }
          }
        } else {
          console.log('⚠️  No ready sources found. Sources may still be processing.');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not fetch sources, will use all sources by default');
    }
    
    // Get message from command line or prompt
    let message = args[1];
    if (!message) {
      message = await promptUser('\n💬 Enter your message: ');
    }
    
    if (!message) {
      console.error('❌ Message is required.');
      process.exit(1);
    }

    console.log(`\n📝 Chatting with notebook: ${selectedNotebook?.emoji || '📄'} ${selectedNotebook?.title || notebookId}`);
    console.log(`❓ Question: ${message}`);
    if (selectedSourceIds && selectedSourceIds.length > 0) {
      console.log(`🎯 Using ${selectedSourceIds.length} selected source(s)`);
    } else {
      console.log(`🌐 Using all available sources`);
    }
    console.log();
    
    if (useStreaming) {
      console.log('🌊 Response (streaming mode):');
      console.log('─'.repeat(60));
      
      // Stream chat with the notebook (uses all sources by default)
      let lastWrittenLength = 0;
      let conversationId: string | undefined;
      let messageIds: [string, string] | undefined;
      const citations = new Set<number>();
      let chunkCount = 0;
      
      for await (const chunk of sdk.generation.chatStream(
        notebookId, 
        message,
        selectedSourceIds && selectedSourceIds.length > 0 ? { sourceIds: selectedSourceIds } : undefined
      )) {
        chunkCount++;
        
        // Track conversation ID and message IDs from metadata
        if (chunk.metadata && !conversationId) {
          conversationId = chunk.metadata[0];
          messageIds = chunk.metadata.slice(0, 2) as [string, string];
        }
        
        // Collect citations
        if (chunk.citations && chunk.citations.length > 0) {
          chunk.citations.forEach(citation => citations.add(citation));
        }
        
        // Print response text as it streams (only new content)
        const textToWrite = chunk.response || chunk.text || '';
        if (textToWrite.length > lastWrittenLength) {
          const newText = textToWrite.substring(lastWrittenLength);
          process.stdout.write(newText);
          lastWrittenLength = textToWrite.length;
        }
      }
    
      console.log('\n' + '─'.repeat(60));
      
      // Display metadata
      console.log('\n📊 Response Metadata:');
      console.log(`   Chunks received: ${chunkCount}`);
      if (conversationId) {
        console.log(`   Conversation ID: ${conversationId}`);
        console.log('   💡 Use this ID to continue the conversation or delete chat history');
      }
      if (messageIds) {
        console.log(`   Message IDs: ${messageIds[0]}, ${messageIds[1]}`);
      }
      if (citations.size > 0) {
        const sortedCitations = Array.from(citations).sort((a, b) => a - b);
        console.log(`   Citations: [${sortedCitations.join(', ')}]`);
        console.log('   💡 Citations reference specific sources in your notebook');
      } else {
        console.log('   Citations: None');
      }
      
      console.log('\n💡 Tip: Use --no-stream flag to get complete response at once');
    } else {
      // Non-streaming: Get complete response at once
      const startTime = Date.now();
      const responseData: ChatResponseData = await sdk.generation.chat(
        notebookId, 
        message,
        selectedSourceIds && selectedSourceIds.length > 0 ? { sourceIds: selectedSourceIds } : undefined
      );
      const duration = Date.now() - startTime;
      
      // Extract text from rawData (the full response structure)
      let responseText = '';
      if (responseData.rawData) {
        responseText = extractTextFromRawData(responseData.rawData, false); // Disable debug output
      }
      
      // Fallback to processed text if rawData extraction failed
      if (!responseText && responseData.text) {
        responseText = responseData.text;
      }
      
      // Display the response
      console.log(responseText || '(No response text extracted)');
      
      // Display important metadata
      console.log('\n' + '─'.repeat(60));
      if (responseData.conversationId) {
        console.log(`💬 Conversation ID: ${responseData.conversationId}`);
      }
      if (responseData.citations && responseData.citations.length > 0) {
        const sortedCitations = responseData.citations.sort((a, b) => a - b);
        console.log(`📚 Citations: [${sortedCitations.join(', ')}]`);
      }
      console.log(`⏱️  Response time: ${duration}ms`);
    }
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
