import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    // Get notebook ID and config type from command line
    const notebookId = process.argv[2];
    const configType = process.argv[3] || 'default'; // 'default', 'custom', or 'learning-guide'
    const customText = process.argv[4]; // Required if configType is 'custom'
    const responseLength = process.argv[5] || 'default'; // 'default', 'shorter', or 'longer'
    
    if (!notebookId) {
      console.error('Usage: tsx generation-set-chat-config.ts <notebook-id> [config-type] [custom-text] [response-length]');
      console.error('\nConfig types:');
      console.error('  default        - Default chat configuration');
      console.error('  custom         - Custom prompt (requires custom-text parameter)');
      console.error('  learning-guide - Learning guide configuration');
      console.error('\nResponse lengths: default, shorter, longer');
      console.error('\nExamples:');
      console.error('  tsx generation-set-chat-config.ts <notebook-id> default');
      console.error('  tsx generation-set-chat-config.ts <notebook-id> custom "respond as phd student" longer');
      console.error('  tsx generation-set-chat-config.ts <notebook-id> learning-guide shorter');
      process.exit(1);
    }

    if (configType === 'custom' && !customText) {
      console.error('Error: custom-text is required when config-type is "custom"');
      process.exit(1);
    }

    console.log(`Setting chat configuration for notebook: ${notebookId}`);
    console.log(`Config type: ${configType}`);
    if (configType === 'custom') {
      console.log(`Custom text: ${customText}`);
    }
    console.log(`Response length: ${responseLength}\n`);

    // Build config object
    const config: any = {
      type: configType as 'default' | 'custom' | 'learning-guide',
      responseLength: responseLength as 'default' | 'shorter' | 'longer',
    };

    if (configType === 'custom' && customText) {
      config.customText = customText;
    }

    // Set chat configuration
    const result = await sdk.generation.setChatConfig(notebookId, config);
    
    console.log('Chat configuration set successfully!');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log('─'.repeat(60));
  } catch (error) {
    handleError(error, 'Failed to set chat configuration');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

