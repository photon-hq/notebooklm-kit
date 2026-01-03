/**
 * Chat with Sources Example
 * =========================
 * 
 * Demonstrates chat with specific source selection:
 * - Chatting with all sources (default)
 * - Chatting with specific sources only
 * - Source filtering and selection
 * - Streaming and non-streaming modes
 * - Citation tracking
 * 
 * Usage:
 *   tsx chat-with-sources.ts <notebook-id> <message> [source-id-1] [source-id-2] ... [--no-stream]
 * 
 * Examples:
 *   # Chat with all sources (default)
 *   tsx chat-with-sources.ts <notebook-id> "Summarize the key findings"
 * 
 *   # Chat with specific sources
 *   tsx chat-with-sources.ts <notebook-id> "Compare these sources" source-1 source-2
 * 
 *   # Non-streaming mode
 *   tsx chat-with-sources.ts <notebook-id> "What is this about?" --no-stream
 */

import { createSDK, handleError } from './utils.js';
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
      if (Array.isArray(rawData[0]) && rawData[0].length > 0) {
        console.log('   First element[0] type:', typeof rawData[0][0]);
        if (typeof rawData[0][0] === 'string') {
          console.log('   First element[0] preview:', rawData[0][0].substring(0, 100));
        }
      }
    }
  }
  
  if (Array.isArray(rawData) && rawData.length > 0) {
    const firstElement = rawData[0];
    if (Array.isArray(firstElement) && firstElement.length > 0) {
      const text = firstElement[0];
      if (typeof text === 'string') {
        if (debug) console.log('✅ [extractTextFromRawData] Extracted text from rawData[0][0]');
        return text;
      }
    } else if (typeof firstElement === 'string') {
      if (debug) console.log('✅ [extractTextFromRawData] Extracted text from rawData[0]');
      return firstElement;
    }
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
 * Select sources from the list
 */
async function selectSources(sources: Source[]): Promise<string[]> {
  if (sources.length === 0) {
    return [];
  }

  const readySources = sources.filter(s => s.status === 'READY' || !s.status);
  
  if (readySources.length === 0) {
    console.log('\n⚠️  No ready sources found. All sources may still be processing.');
    return [];
  }

  console.log('\n📄 Available sources:');
  console.log('─'.repeat(60));
  readySources.forEach((source, i) => {
    const type = source.type || 'UNKNOWN';
    const title = source.title || 'Untitled';
    console.log(`${i + 1}. ${title}`);
    console.log(`   ID: ${source.sourceId}`);
    console.log(`   Type: ${type}`);
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
  // Enable debugging
  const sdk = await createSDK({ debug: true });

  try {
    await sdk.connect();

    // Parse command line arguments (filter out flags)
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    const useStreaming = !process.argv.includes('--no-stream');
    
    const notebookId = args[0];
    const message = args[1];
    const sourceIdsFromArgs = args.slice(2); // Remaining args are source IDs
    
    if (!notebookId || !message) {
      console.error('Usage: tsx chat-with-sources.ts <notebook-id> <message> [source-id-1] [source-id-2] ... [--no-stream]');
      console.error('\nExamples:');
      console.error('  # Chat with all sources');
      console.error('  tsx chat-with-sources.ts <notebook-id> "Summarize the key findings"');
      console.error('');
      console.error('  # Chat with specific sources');
      console.error('  tsx chat-with-sources.ts <notebook-id> "Compare these sources" source-1 source-2');
      console.error('');
      console.error('  # Non-streaming mode');
      console.error('  tsx chat-with-sources.ts <notebook-id> "What is this about?" --no-stream');
      console.error('');
      console.error('  # Interactive source selection (if no source IDs provided)');
      console.error('  tsx chat-with-sources.ts <notebook-id> "What is this about?"');
      process.exit(1);
    }

    console.log(`\n📝 Chatting with notebook: ${notebookId}`);
    console.log(`❓ Question: ${message}`);
    
    // If source IDs provided via command line, use them
    // Otherwise, list sources and allow interactive selection
    let selectedSourceIds: string[] | undefined;
    
    if (sourceIdsFromArgs.length > 0) {
      selectedSourceIds = sourceIdsFromArgs;
      console.log(`\n🎯 Using specific sources from command line (${selectedSourceIds.length}):`);
      selectedSourceIds.forEach((id, i) => {
        console.log(`   ${i + 1}. ${id}`);
      });
      console.log('   💡 Only these sources will be used for context');
    } else {
      // List sources and allow selection
      console.log('\n🔍 Fetching sources...');
      try {
        const sources = await sdk.sources.list(notebookId);
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
            } else {
              console.log('\n🌐 Using all sources in the notebook');
              console.log('   💡 All available sources will be used for context');
            }
          } else {
            console.log('⚠️  No ready sources found. Sources may still be processing.');
            console.log('   💡 Will attempt to use all sources');
          }
        } else {
          console.log('⚠️  No sources found in notebook');
        }
      } catch (error) {
        console.log('⚠️  Could not fetch sources, will use all sources by default');
      }
    }
    
    const chatOptions = selectedSourceIds && selectedSourceIds.length > 0 ? { sourceIds: selectedSourceIds } : undefined;
    
    if (useStreaming) {
      console.log('\n🌊 Response (streaming mode):');
      console.log('─'.repeat(60));
      
      // Stream chat with specific sources (or all if none provided)
      let lastWrittenLength = 0;
      const citations = new Set<number>();
      let conversationId: string | undefined;
      let chunkCount = 0;
      
      for await (const chunk of sdk.generation.chatStream(notebookId, message, chatOptions)) {
        chunkCount++;
        
        // Track conversation ID
        if (chunk.metadata && !conversationId) {
          conversationId = chunk.metadata[0];
        }
        
        // Collect citations
        if (chunk.citations) {
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
      if (citations.size > 0) {
        console.log(`   Citations: [${Array.from(citations).sort((a, b) => a - b).join(', ')}]`);
        console.log('   💡 Citations reference specific sources used in the response');
      } else {
        console.log('   Citations: None');
      }
      if (conversationId) {
        console.log(`   Conversation ID: ${conversationId}`);
      }
    } else {
      console.log('\n📦 Response (non-streaming mode):');
      console.log('─'.repeat(60));
      
      // Non-streaming: Get complete response at once
      const startTime = Date.now();
      const responseData: ChatResponseData = await sdk.generation.chat(notebookId, message, chatOptions);
      const duration = Date.now() - startTime;
      
      // Extract text from rawData
      console.log('\n🔍 [DEBUG] Extracting text from response data...');
      console.log('   Chunks received:', responseData.chunks.length);
      console.log('   Has rawData:', !!responseData.rawData);
      
      const responseText = extractTextFromRawData(responseData.rawData, true) || responseData.text || '';
      
      console.log('   Extracted text length:', responseText.length);
      if (!responseText) {
        console.log('\n⚠️  [DEBUG] No text extracted! Full response data structure:');
        console.log(JSON.stringify(responseData, null, 2).substring(0, 1000));
      }
      
      console.log(responseText || '(No response text extracted)');
      console.log('─'.repeat(60));
      console.log(`\n⏱️  Response time: ${duration}ms`);
      if (responseData.conversationId) {
        console.log(`💬 Conversation ID: ${responseData.conversationId}`);
      }
      if (responseData.citations.length > 0) {
        console.log(`📚 Citations: [${responseData.citations.sort((a, b) => a - b).join(', ')}]`);
      }
    }
    
    console.log('\n💡 Tips:');
    console.log('   - Specify source IDs to focus on specific sources');
    console.log('   - Omit source IDs to use all sources in the notebook');
    console.log('   - Use --no-stream flag to get complete response at once');
    console.log('   - Citations help identify which sources were referenced\n');
    
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
