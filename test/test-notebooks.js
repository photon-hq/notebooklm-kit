#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NotebookLMClient } from '../dist/index.js';

// Load .env file from root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const sdk = new NotebookLMClient({
  authToken: process.env.NOTEBOOKLM_AUTH_TOKEN,
  cookies: process.env.NOTEBOOKLM_COOKIES,
  autoRefresh: true,
  debug: process.env.DEBUG === 'true',
});

async function testNotebooks() {
  let createdNotebookId = null;

  try {
    console.log('🧪 Testing Notebook Operations\n');
    console.log('='.repeat(60));

    // ========================================================================
    // Refresh Token
    // ========================================================================
    console.log('\n1️⃣  Refreshing credentials...');
    try {
      await sdk.refreshCredentials();
      console.log('✅ Credentials refreshed successfully\n');
    } catch (error) {
      console.error('❌ Refresh failed:', error.message);
      console.error('   Please check your NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES');
      console.error('   Make sure they are valid and up-to-date.\n');
      throw error; // Fail fast if refresh fails
    }

    // ========================================================================
    // Test 1: List Notebooks
    // ========================================================================
    console.log('2️⃣  Test 1: List Notebooks');
    console.log('─'.repeat(60));
    const notebooks = await sdk.notebooks.list();
    console.log(`✅ Found ${notebooks.length} notebook(s)`);
    if (notebooks.length > 0) {
      notebooks.slice(0, 3).forEach((nb, i) => {
        console.log(`   ${i + 1}. ${nb.emoji || '📄'} ${nb.title} (${nb.projectId})`);
      });
      if (notebooks.length > 3) {
        console.log(`   ... and ${notebooks.length - 3} more`);
      }
    }
    console.log('');

    // ========================================================================
    // Test 2: Get Notebook
    // ========================================================================
    console.log('3️⃣  Test 2: Get Notebook');
    console.log('─'.repeat(60));
    if (notebooks.length > 0) {
      const firstNotebook = notebooks[0];
      const notebook = await sdk.notebooks.get(firstNotebook.projectId);
      console.log(`✅ Retrieved notebook: ${notebook.emoji || '📄'} ${notebook.title}`);
      console.log(`   ID: ${notebook.projectId}`);
      console.log(`   Title: ${notebook.title}`);
      if (notebook.description) {
        console.log(`   Description: ${notebook.description.substring(0, 50)}...`);
      }
    } else {
      console.log('⚠️  No notebooks found, skipping get test');
    }
    console.log('');

    // ========================================================================
    // Test 3: Create Notebook
    // ========================================================================
    console.log('4️⃣  Test 3: Create Notebook');
    console.log('─'.repeat(60));
    const testTitle = `Test Notebook ${Date.now()}`;
    const newNotebook = await sdk.notebooks.create({
      title: testTitle,
      emoji: '🧪',
    });
    console.log(`✅ Created notebook: ${newNotebook.emoji || '📄'} ${newNotebook.title}`);
    console.log(`   ID: ${newNotebook.projectId}`);
    createdNotebookId = newNotebook.projectId;
    console.log('');

    // ========================================================================
    // Test 4: Update Notebook
    // ========================================================================
    console.log('5️⃣  Test 4: Update Notebook');
    console.log('─'.repeat(60));
    const updatedTitle = `${testTitle} (Updated)`;
    const updatedNotebook = await sdk.notebooks.update(createdNotebookId, {
      title: updatedTitle,
    });
    console.log(`✅ Updated notebook: ${updatedNotebook.emoji || '📄'} ${updatedNotebook.title}`);
    console.log(`   ID: ${updatedNotebook.projectId}`);
    console.log('');

    // ========================================================================
    // Test 5: Delete Notebook
    // ========================================================================
    console.log('6️⃣  Test 5: Delete Notebook');
    console.log('─'.repeat(60));
    await sdk.notebooks.delete(createdNotebookId);
    console.log(`✅ Deleted notebook: ${createdNotebookId}`);
    console.log('');

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('   Error:', error.message);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('Unauthenticated') || error.message.includes('code 16')) {
      console.error('\n💡 Authentication Error Detected:');
      console.error('   Your credentials appear to be invalid or expired.');
      console.error('   Please:');
      console.error('   1. Run extract-credentials.js in your browser to get fresh credentials');
      console.error('   2. Update your .env file with the new NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES');
      console.error('   3. Make sure all HttpOnly cookies are included (check extract-credentials.js output)');
    }
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup: Delete test notebook if it was created
    if (createdNotebookId) {
      try {
        await sdk.notebooks.delete(createdNotebookId);
        console.log(`\n🧹 Cleanup: Deleted test notebook ${createdNotebookId}`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    sdk.dispose();
  }
}

testNotebooks();

