/**
 * Generate Document Guides Example
 * =================================
 * 
 * Demonstrates document guide generation:
 * - Generate guides for all sources in a notebook
 * - Generate guides for a specific source
 * - Guide structure and content
 * 
 * Document guides provide structured summaries and key information
 * about your sources, making them easier to understand and reference.
 * 
 * Usage:
 *   tsx generation-document-guides.ts <notebook-id> [source-id]
 * 
 * Examples:
 *   # Generate guides for all sources
 *   tsx generation-document-guides.ts <notebook-id>
 * 
 *   # Generate guides for a specific source
 *   tsx generation-document-guides.ts <notebook-id> <source-id>
 */

import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = await createSDK();  

  try {
    await sdk.connect();

    // Get notebook ID and optional source ID from command line
    const notebookId = process.argv[2];
    const sourceId = process.argv[3];
    
    if (!notebookId) {
      console.error('Usage: tsx generation-document-guides.ts <notebook-id> [source-id]');
      console.error('\nExamples:');
      console.error('  # Generate guides for all sources');
      console.error('  tsx generation-document-guides.ts <notebook-id>');
      console.error('');
      console.error('  # Generate guides for a specific source');
      console.error('  tsx generation-document-guides.ts <notebook-id> <source-id>');
      console.error('');
      console.error('💡 Document guides provide structured summaries and key information');
      console.error('   about your sources, making them easier to understand and reference.');
      process.exit(1);
    }

    console.log(`\n📚 Generating document guides`);
    console.log(`📝 Notebook ID: ${notebookId}`);
    
    if (sourceId) {
      console.log(`🎯 Source ID: ${sourceId}`);
      console.log('   💡 Generating guide for this specific source only');
    } else {
      console.log('🌐 Scope: All sources');
      console.log('   💡 Generating guides for all sources in the notebook');
    }
    
    console.log('\n⏳ Generating guides... (this may take a moment)');
    console.log('─'.repeat(60));

    // Generate document guides (for all sources or specific source)
    try {
      const startTime = Date.now();
      const guides = await sdk.generation.generateDocumentGuides(notebookId, sourceId);
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Document guides generated in ${duration}ms`);
      console.log('─'.repeat(60));
      
      if (Array.isArray(guides) && guides.length > 0) {
        console.log(`\n📊 Found ${guides.length} guide(s):\n`);
        
        guides.forEach((guide: any, index: number) => {
          console.log(`📄 Guide ${index + 1}:`);
          console.log('─'.repeat(60));
          
          // Display guide structure
          if (typeof guide === 'object' && guide !== null) {
            // Try to extract meaningful information
            if (guide.title) {
              console.log(`   Title: ${guide.title}`);
            }
            if (guide.content) {
              console.log(`   Content: ${typeof guide.content === 'string' ? guide.content.substring(0, 200) + '...' : 'Available'}`);
            }
            if (guide.sections) {
              console.log(`   Sections: ${Array.isArray(guide.sections) ? guide.sections.length : 'N/A'}`);
            }
            
            // Show full structure
            console.log('\n   Full structure:');
            console.log(JSON.stringify(guide, null, 4));
          } else {
            console.log(JSON.stringify(guide, null, 2));
          }
          
          console.log('─'.repeat(60));
          if (index < guides.length - 1) {
            console.log();
          }
        });
      } else if (guides && typeof guides === 'object') {
        console.log('\n📄 Guide structure:');
        console.log(JSON.stringify(guides, null, 2));
      } else {
        console.log('\n⚠️  No guide data returned');
        console.log('   This may indicate:');
        console.log('   - Sources are still processing');
        console.log('   - No sources found in the notebook');
        console.log('   - Guide generation is in progress');
      }
      
      console.log('─'.repeat(60));
      
      console.log('\n💡 Tips:');
      console.log('   - Document guides help you quickly understand source content');
      console.log('   - Guides are automatically generated when sources are added');
      console.log('   - You can regenerate guides anytime using this script');
      console.log('   - Use guides to get overviews before diving into full content\n');
      
    } catch (error) {
      console.error('\n❌ Failed to generate document guides');
      console.error('─'.repeat(60));
      throw error;
    }
  } catch (error) {
    handleError(error, 'Failed to generate document guides');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);
