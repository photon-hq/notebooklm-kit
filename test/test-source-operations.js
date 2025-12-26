#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NotebookLMClient } from '../dist/index.js';

// Load .env file from root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN,
  cookies: process.env.NOTEBOOKLM_COOKIES,
  autoRefresh: true,
  debug: process.env.DEBUG === 'true',
});

const NOTEBOOK_ID = '9c40da15-f909-4042-bb9e-47fa370b5e3b'; // "VANDIT KUMAR"

async function testSourceOperations() {
  const testSourceIds = {
    url: null,
    text: null,
    toUpdate: null,
    
    toDelete: null,
  };

  try {
    console.log('🧪 Testing Core Source Operations\n');
    console.log('='.repeat(60));
    console.log(`Notebook ID: ${NOTEBOOK_ID}\n`);

    // ========================================================================
    // Refresh Token
    // ========================================================================
    console.log('1️⃣  Refreshing credentials...');
    try {
      await sdk.refreshCredentials();
      console.log('✅ Credentials refreshed successfully.\n');
    } catch (error) {
      console.error(`❌ Refresh failed: ${error.message}`);
      console.error('   Please ensure your auth token and cookies are valid.\n');
      sdk.dispose();
      process.exit(1);
    }

    // ========================================================================
    // Setup: Create test sources
    // ========================================================================
    console.log('2️⃣  Setup: Creating test sources...');
    console.log('────────────────────────────────────────────────────────────');
    
    try {
      // Create a URL source for update test
      const urlSourceId = await sdk.sources.addFromURL(NOTEBOOK_ID, {
        url: 'https://en.wikipedia.org/wiki/Machine_learning',
        title: 'Machine Learning - Original Title',
      });
      testSourceIds.toUpdate = urlSourceId;
      console.log(`✅ Created URL source for update test: ${urlSourceId}`);
      console.log('   Title: Machine Learning - Original Title\n');
    } catch (error) {
      console.error(`❌ Failed to create URL source: ${error.message}\n`);
    }

    try {
      // Create a URL source for delete test
      const deleteSourceId = await sdk.sources.addFromURL(NOTEBOOK_ID, {
        url: 'https://en.wikipedia.org/wiki/Deep_learning',
        title: 'Deep Learning - To Be Deleted',
      });
      testSourceIds.toDelete = deleteSourceId;
      console.log(`✅ Created URL source for delete test: ${deleteSourceId}`);
      console.log('   Title: Deep Learning - To Be Deleted\n');
    } catch (error) {
      console.error(`❌ Failed to create URL source: ${error.message}\n`);
    }

    // Wait a bit for sources to be created
    console.log('⏳ Waiting 3 seconds for sources to be created...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========================================================================
    // Test 1: Update Source
    // ========================================================================
    console.log('3️⃣  Test 1: Update Source Metadata');
    console.log('────────────────────────────────────────────────────────────');
    
    if (testSourceIds.toUpdate) {
      try {
        const newTitle = 'Machine Learning - Updated Title';
        await sdk.sources.update(NOTEBOOK_ID, testSourceIds.toUpdate, {
          title: newTitle,
        });
        console.log(`✅ Updated source: ${testSourceIds.toUpdate}`);
        console.log(`   New title: ${newTitle}`);
        console.log('   Note: Verify the title change in NotebookLM UI\n');
      } catch (error) {
        console.error(`❌ Failed to update source: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Skipping update test - no source created\n');
    }

    // ========================================================================
    // Test 2: Delete Source (Single)
    // ========================================================================
    console.log('4️⃣  Test 2: Delete Source (Single)');
    console.log('────────────────────────────────────────────────────────────');
    
    if (testSourceIds.toDelete) {
      try {
        await sdk.sources.delete(NOTEBOOK_ID, testSourceIds.toDelete);
        console.log(`✅ Deleted source: ${testSourceIds.toDelete}`);
        console.log('   Note: Source has been permanently removed\n');
      } catch (error) {
        console.error(`❌ Failed to delete source: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Skipping delete test - no source created\n');
    }


    // ========================================================================
    // Cleanup: Delete remaining test sources
    // ========================================================================
    console.log('6️⃣  Cleanup: Deleting remaining test sources...');
    console.log('────────────────────────────────────────────────────────────');
    
    const cleanupIds = [
      testSourceIds.toUpdate,
    ].filter(id => id !== null);
    
    if (cleanupIds.length > 0) {
      try {
        // Delete sources one by one
        for (const id of cleanupIds) {
          try {
            await sdk.sources.delete(NOTEBOOK_ID, id);
            console.log(`✅ Deleted source: ${id}`);
          } catch (error) {
            console.error(`❌ Failed to delete source ${id}: ${error.message}`);
          }
        }
        console.log('');
      } catch (error) {
        console.error(`❌ Failed to cleanup: ${error.message}\n`);
      }
    } else {
      console.log('ℹ️  No sources to cleanup\n');
    }

    console.log('='.repeat(60));
    console.log('✅ All core source operation tests completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ An unexpected error occurred during testing:');
    console.error('   Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    sdk.dispose();
    console.log('\nSDK disposed.');
  }
}

testSourceOperations();

