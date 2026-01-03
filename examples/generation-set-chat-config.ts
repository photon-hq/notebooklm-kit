/**
 * Set Chat Configuration Example
 * ===============================
 * 
 * Demonstrates chat configuration options:
 * - Default configuration
 * - Custom prompt configuration
 * - Learning guide configuration
 * - Response length settings (default, shorter, longer)
 * 
 * Chat configuration affects how NotebookLM responds to your questions:
 * - Default: Standard conversational responses
 * - Custom: Responses following a custom instruction/persona
 * - Learning Guide: Educational responses optimized for learning
 * 
 * Usage:
 *   tsx generation-set-chat-config.ts <notebook-id> [config-type] [custom-text] [response-length]
 * 
 * Examples:
 *   # Set default configuration
 *   tsx generation-set-chat-config.ts <notebook-id> default
 * 
 *   # Set custom configuration with custom prompt
 *   tsx generation-set-chat-config.ts <notebook-id> custom "respond as a PhD student" longer
 * 
 *   # Set learning guide configuration
 *   tsx generation-set-chat-config.ts <notebook-id> learning-guide shorter
 */

import { createSDK, handleError } from './utils.js';
import type { ChatConfig } from '../src/types/common.js';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect();

    // Get notebook ID and config type from command line
    const notebookId = process.argv[2];
    const configType = process.argv[3] || 'default'; // 'default', 'custom', or 'learning-guide'
    const customText = process.argv[4]; // Required if configType is 'custom'
    const responseLength = process.argv[5] || 'default'; // 'default', 'shorter', or 'longer'
    
    if (!notebookId) {
      console.error('Usage: tsx generation-set-chat-config.ts <notebook-id> [config-type] [custom-text] [response-length]');
      console.error('\n📋 Configuration Types:');
      console.error('   default        - Standard conversational responses (default)');
      console.error('   custom         - Custom prompt/persona (requires custom-text parameter)');
      console.error('   learning-guide - Educational responses optimized for learning');
      console.error('\n📏 Response Lengths:');
      console.error('   default        - Standard length responses (default)');
      console.error('   shorter        - Concise, brief responses');
      console.error('   longer         - Detailed, comprehensive responses');
      console.error('\n💡 Examples:');
      console.error('   # Default configuration');
      console.error('   tsx generation-set-chat-config.ts <notebook-id> default');
      console.error('');
      console.error('   # Custom prompt with longer responses');
      console.error('   tsx generation-set-chat-config.ts <notebook-id> custom "respond as phd student" longer');
      console.error('');
      console.error('   # Learning guide with shorter responses');
      console.error('   tsx generation-set-chat-config.ts <notebook-id> learning-guide shorter');
      process.exit(1);
    }

    // Validate configuration
    if (configType === 'custom' && !customText) {
      console.error('❌ Error: custom-text is required when config-type is "custom"');
      console.error('\nExample:');
      console.error('  tsx generation-set-chat-config.ts <notebook-id> custom "respond as a PhD student"');
      process.exit(1);
    }

    if (!['default', 'custom', 'learning-guide'].includes(configType)) {
      console.error(`❌ Error: Invalid config-type "${configType}"`);
      console.error('   Valid options: default, custom, learning-guide');
      process.exit(1);
    }

    if (!['default', 'shorter', 'longer'].includes(responseLength)) {
      console.error(`❌ Error: Invalid response-length "${responseLength}"`);
      console.error('   Valid options: default, shorter, longer');
      process.exit(1);
    }

    console.log(`\n⚙️  Setting chat configuration for notebook: ${notebookId}`);
    console.log('─'.repeat(60));
    console.log(`📋 Configuration Type: ${configType}`);
    
    if (configType === 'custom') {
      console.log(`📝 Custom Text: "${customText}"`);
      console.log('   💡 Responses will follow this custom instruction/persona');
    } else if (configType === 'learning-guide') {
      console.log('   💡 Responses will be optimized for educational purposes');
    } else {
      console.log('   💡 Standard conversational responses');
    }
    
    console.log(`📏 Response Length: ${responseLength}`);
    if (responseLength === 'shorter') {
      console.log('   💡 Responses will be concise and brief');
    } else if (responseLength === 'longer') {
      console.log('   💡 Responses will be detailed and comprehensive');
    } else {
      console.log('   💡 Standard length responses');
    }
    console.log('─'.repeat(60));
    console.log('\n⏳ Applying configuration...\n');

    // Build type-safe config object
    const config: ChatConfig = {
      type: configType as 'default' | 'custom' | 'learning-guide',
      responseLength: responseLength as 'default' | 'shorter' | 'longer',
      ...(configType === 'custom' && customText ? { customText } : {}),
    };

    // Set chat configuration
    const result = await sdk.generation.setChatConfig(notebookId, config);
    
    console.log('✅ Chat configuration set successfully!');
    console.log('─'.repeat(60));
    
    if (result) {
      console.log('📄 Response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('(Configuration applied - no response data)');
    }
    console.log('─'.repeat(60));
    
    console.log('\n💡 Next Steps:');
    console.log('   - Start chatting with your notebook to see the new configuration in action');
    console.log('   - Use chat-basic.ts or chat-conversation.ts to test the configuration');
    console.log('   - Change configuration anytime by running this script again\n');
    
  } catch (error) {
    handleError(error, 'Failed to set chat configuration');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
