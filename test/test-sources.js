#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
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

async function testSources() {
  const sourceIds = {
    url: null,
    text: null,
    pdf: null,
    png: null,
    youtube: null,
  };

  try {
    console.log('🧪 Testing Source Operations\n');
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
    // Test 1: Add Source from URL
    // ========================================================================
    console.log('2️⃣  Test 1: Add Source from URL');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const urlSourceId = await sdk.sources.addFromURL(NOTEBOOK_ID, {
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        title: 'AI Wikipedia Article',
      });
      sourceIds.url = urlSourceId;
      console.log(`✅ Added URL source: ${urlSourceId}`);
      console.log('   URL: https://en.wikipedia.org/wiki/Artificial_intelligence\n');
    } catch (error) {
      console.error(`❌ Failed to add URL source: ${error.message}\n`);
    }

    // ========================================================================
    // Test 2: Add Source from Text
    // ========================================================================
    console.log('3️⃣  Test 2: Add Source from Text');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const textSourceId = await sdk.sources.addFromText(NOTEBOOK_ID, {
        title: 'VANDIT KUMAR TEXT SAMPLE',
        content: `VANDIT KUMAR TEXT SAMPLE,, PEWPEWPEPWPEPWEPWPEPSV JHJHSBDJHFBS`,
      });
      sourceIds.text = textSourceId;
      console.log(`✅ Added text source: ${textSourceId}`);
      console.log('   Title: VANDIT KUMAR TEXT SAMPLE\n');
    } catch (error) {
      console.error(`❌ Failed to add text source: ${error.message}\n`);
    }

    // ========================================================================
    // Test 3: Add Source from PDF File
    // ========================================================================
    console.log('4️⃣  Test 3: Add Source from PDF File');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const pdfPath = join(__dirname, 'resume.pdf');
      const pdfBuffer = readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString('base64');

      const pdfSourceId = await sdk.sources.addFromFile(NOTEBOOK_ID, {
        content: pdfBase64,
        fileName: 'resume.pdf',
        mimeType: 'application/pdf',
      });
      sourceIds.pdf = pdfSourceId;
      console.log(`✅ Added PDF source: ${pdfSourceId}`);
      console.log('   File: resume.pdf\n');
    } catch (error) {
      console.error(`❌ Failed to add PDF source: ${error.message}\n`);
    }

    // ========================================================================
    // Test 4: Add Source from PNG File
    // ========================================================================
    console.log('5️⃣  Test 4: Add Source from PNG File');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const pngPath = join(__dirname, 'NotebookLM Mind Map.png');
      const pngBuffer = readFileSync(pngPath);
      const pngBase64 = pngBuffer.toString('base64');

      const pngSourceId = await sdk.sources.addFromFile(NOTEBOOK_ID, {
        content: pngBase64,
        fileName: 'NotebookLM Mind Map.png',
        mimeType: 'image/png',
      });
      sourceIds.png = pngSourceId;
      console.log(`✅ Added PNG source: ${pngSourceId}`);
      console.log('   File: NotebookLM Mind Map.png\n');
    } catch (error) {
      console.error(`❌ Failed to add PNG source: ${error.message}\n`);
    }

    // ========================================================================
    // Test 5: Add YouTube Source
    // ========================================================================
    console.log('6️⃣  Test 5: Add YouTube Source');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const youtubeSourceId = await sdk.sources.addYouTube(NOTEBOOK_ID, {
        urlOrId: 'https://www.youtube.com/watch?v=ANAyXxA5vtc',
      });
      sourceIds.youtube = youtubeSourceId;
      console.log(`✅ Added YouTube source: ${youtubeSourceId}`);
      console.log('   URL: https://www.youtube.com/watch?v=ANAyXxA5vtc\n');
    } catch (error) {
      console.error(`❌ Failed to add YouTube source: ${error.message}\n`);
    }

    // ========================================================================
    // Test 6: Check Processing Status
    // ========================================================================
    console.log('7️⃣  Test 6: Check Processing Status');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const status = await sdk.sources.pollProcessing(NOTEBOOK_ID);
      console.log(`✅ Processing status checked`);
      console.log(`   All ready: ${status.allReady}`);
      console.log(`   Still processing: ${status.processing.length > 0 ? status.processing.join(', ') : 'none'}\n`);
    } catch (error) {
      console.error(`❌ Failed to check processing status: ${error.message}\n`);
    }

    // ========================================================================
    // Test 7: Add Batch (Optional)
    // ========================================================================
    console.log('8️⃣  Test 7: Add Batch Sources (Optional)');
    console.log('────────────────────────────────────────────────────────────');
    try {
      const batchSourceIds = await sdk.sources.addBatch(NOTEBOOK_ID, {
        sources: [
          {
            type: 'url',
            url: 'https://en.wikipedia.org/wiki/Machine_learning',
            title: 'Machine Learning Batch Source',
          },
          {
            type: 'text',
            title: 'Quick Notes Batch Source',
            content: 'This is a batch-added text source for testing purposes.',
          },
        ],
      });
      console.log(`✅ Added batch sources: ${batchSourceIds.length} sources`);
      console.log(`   Source IDs: ${batchSourceIds.join(', ')}\n`);
    } catch (error) {
      console.error(`❌ Failed to add batch sources: ${error.message}\n`);
    }

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log('Source IDs created:');
    if (sourceIds.url) console.log(`  ✅ URL: ${sourceIds.url}`);
    if (sourceIds.text) console.log(`  ✅ Text: ${sourceIds.text}`);
    if (sourceIds.pdf) console.log(`  ✅ PDF: ${sourceIds.pdf}`);
    if (sourceIds.png) console.log(`  ✅ PNG: ${sourceIds.png}`);
    if (sourceIds.youtube) console.log(`  ✅ YouTube: ${sourceIds.youtube}`);
    console.log('\n✅ All source tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    sdk.dispose();
    console.log('SDK disposed.');
  }
}

testSources();

