/**
 * Chat Conversation Example
 * =========================
 * 
 * Demonstrates multi-turn conversations with NotebookLM:
 * - Conversation history tracking
 * - Conversation ID management
 * - Follow-up questions with context
 * - Streaming and non-streaming modes
 * - Citation tracking across multiple messages
 * 
 * Usage:
 *   tsx chat-conversation.ts <notebook-id> [--no-stream]
 * 
 * Examples:
 *   # Streaming mode (default)
 *   tsx chat-conversation.ts <notebook-id>
 * 
 *   # Non-streaming mode
 *   tsx chat-conversation.ts <notebook-id> --no-stream
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
  const sdk = await createSDK({ debug: false });

  try {
    await sdk.connect();

    // Parse arguments (filter out flags)
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    const useStreaming = !process.argv.includes('--no-stream');
    
    // Get notebook ID from command line
    const notebookId = args[0];
    
    if (!notebookId) {
      console.error('Usage: tsx chat-conversation.ts <notebook-id> [--no-stream]');
      console.error('\nExample:');
      console.error('  tsx chat-conversation.ts <notebook-id>');
      console.error('  tsx chat-conversation.ts <notebook-id> --no-stream');
      process.exit(1);
    }

    console.log(`\n💬 Starting conversation with notebook: ${notebookId}\n`);

    // List sources and allow selection
    console.log('🔍 Fetching sources...');
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
              console.log(`\n✅ Selected ${selectedSourceIds.length} source(s) for chat\n`);
            }
          }
        } else {
          console.log('⚠️  No ready sources found. Sources may still be processing.\n');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not fetch sources, will use all sources by default\n');
    }
    
    const chatOptions = selectedSourceIds ? { sourceIds: selectedSourceIds } : undefined;

    // ========================================================================
    // First Message
    // ========================================================================
    const message1 = 'What are the key findings?';
    console.log(`👤 User: ${message1}`);
    console.log('─'.repeat(60));
    console.log('🤖 Assistant: ');
    
    let response1 = '';
    let conversationId: string | undefined;
    const citations1 = new Set<number>();
    
    if (useStreaming) {
      // Streaming mode
      let lastWrittenLength1 = 0;
      for await (const chunk of sdk.generation.chatStream(notebookId, message1, chatOptions)) {
        // Track conversation ID from first message
        if (chunk.metadata && !conversationId) {
          conversationId = chunk.metadata[0];
        }
        
        // Collect citations
        if (chunk.citations) {
          chunk.citations.forEach(citation => citations1.add(citation));
        }
        
        const textToWrite = chunk.response || chunk.text || '';
        if (textToWrite.length > lastWrittenLength1) {
          const newText = textToWrite.substring(lastWrittenLength1);
          process.stdout.write(newText);
          lastWrittenLength1 = textToWrite.length;
          response1 = textToWrite; // Keep full response for conversation history
        }
      }
      
      console.log('\n' + '─'.repeat(60));
      if (citations1.size > 0) {
        console.log(`📚 Citations: [${Array.from(citations1).sort((a, b) => a - b).join(', ')}]`);
      }
    } else {
      // Non-streaming mode
      const responseData1: ChatResponseData = await sdk.generation.chat(notebookId, message1, chatOptions);
      response1 = extractTextFromRawData(responseData1.rawData, true) || responseData1.text || '';
      if (responseData1.conversationId && !conversationId) {
        conversationId = responseData1.conversationId;
      }
      if (responseData1.citations) {
        responseData1.citations.forEach(c => citations1.add(c));
      }
      console.log(response1 || '(No response text extracted)');
      console.log('─'.repeat(60));
    }
    console.log();

    // ========================================================================
    // Second Message (Follow-up with conversation history)
    // ========================================================================
    const message2 = 'Tell me more about the methodology';
    console.log(`👤 User: ${message2}`);
    console.log('─'.repeat(60));
    console.log('🤖 Assistant: ');
    
    // For continuing conversations, use the conversation ID from the first message
    // Note: The conversationHistory parameter is for reference - message IDs should be
    // extracted from previous responses' metadata for proper conversation continuity
    const conversationOptions = {
      conversationId: conversationId, // Use the conversation ID from first message
      conversationHistory: [
        { message: message1, role: 'user' as const },
        { message: response1, role: 'assistant' as const }
      ],
      ...(selectedSourceIds && selectedSourceIds.length > 0 ? { sourceIds: selectedSourceIds } : {})
    };
    
    let response2 = '';
    const citations2 = new Set<number>();
    
    if (useStreaming) {
      // Streaming mode
      let lastWrittenLength2 = 0;
      for await (const chunk of sdk.generation.chatStream(notebookId, message2, conversationOptions)) {
        // Collect citations
        if (chunk.citations) {
          chunk.citations.forEach(citation => citations2.add(citation));
        }
        
        const textToWrite = chunk.response || chunk.text || '';
        if (textToWrite.length > lastWrittenLength2) {
          const newText = textToWrite.substring(lastWrittenLength2);
          process.stdout.write(newText);
          lastWrittenLength2 = textToWrite.length;
          response2 = textToWrite; // Keep full response
        }
      }
      
      console.log('\n' + '─'.repeat(60));
      if (citations2.size > 0) {
        console.log(`📚 Citations: [${Array.from(citations2).sort((a, b) => a - b).join(', ')}]`);
      }
    } else {
      // Non-streaming mode
      const responseData2: ChatResponseData = await sdk.generation.chat(notebookId, message2, conversationOptions);
      response2 = extractTextFromRawData(responseData2.rawData, true) || responseData2.text || '';
      if (responseData2.citations) {
        responseData2.citations.forEach(c => citations2.add(c));
      }
      console.log(response2 || '(No response text extracted)');
      console.log('─'.repeat(60));
    }
    
    // ========================================================================
    // Summary
    // ========================================================================
    console.log('\n📊 Conversation Summary:');
    console.log('─'.repeat(60));
    if (conversationId) {
      console.log(`✅ Conversation ID: ${conversationId}`);
      console.log('   💡 Use this ID to:');
      console.log('      - Continue the conversation in another session');
      console.log('      - Delete this conversation history');
      console.log('      - Track conversation across multiple interactions');
    }
    
    const allCitations = new Set([...citations1, ...citations2]);
    if (allCitations.size > 0) {
      console.log(`📚 Total unique citations: [${Array.from(allCitations).sort((a, b) => a - b).join(', ')}]`);
    }
    
    console.log(`💬 Messages exchanged: 2`);
    console.log(`📝 Mode: ${useStreaming ? 'Streaming' : 'Non-streaming'}`);
    console.log('─'.repeat(60));
    
    console.log('\n💡 Tips:');
    console.log('   - Use conversationHistory to maintain context across messages');
    console.log('   - Conversation ID is auto-generated and tracked automatically');
    console.log('   - Use --no-stream flag to get complete responses at once');
    console.log('   - Citations help you identify which sources were referenced\n');
    
  } catch (error) {
    handleError(error, 'Failed to chat');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
