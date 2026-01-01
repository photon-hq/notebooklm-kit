import { createSDK, handleError } from './utils.js';
import * as readline from 'readline';

/**
 * Prompt user for input
 */
function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for notebook ID
 */
async function promptNotebookId(rl: readline.Interface): Promise<string> {
  const envNotebookId = process.env.NOTEBOOK_ID;
  if (envNotebookId) {
    const useEnv = await question(rl, `Notebook ID from env: ${envNotebookId}\nUse this? (Y/n): `);
    if (!useEnv || useEnv.toLowerCase() === 'y' || useEnv.toLowerCase() === 'yes') {
      return envNotebookId;
    }
  }
  
  const notebookId = await question(rl, 'Enter Notebook ID: ');
  if (!notebookId) {
    throw new Error('Notebook ID is required');
  }
  return notebookId;
}

/**
 * Extract file ID from Google Drive URL or return as-is if it's already an ID
 */
function extractFileIdFromUrl(input: string): string {
  // If it's already a file ID (doesn't look like a URL), return as-is
  if (!input.includes('://') && !input.includes('/')) {
    return input;
  }
  
  // Try common Google Drive URL patterns
  const patterns = [
    // docs.google.com/document/d/FILE_ID/...
    /docs\.google\.com\/[^\/]+\/d\/([a-zA-Z0-9_-]+)/,
    // drive.google.com/file/d/FILE_ID/...
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    // drive.google.com/open?id=FILE_ID
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    // drive.google.com/open?id=FILE_ID&...
    /[?&]id=([a-zA-Z0-9_-]+)/,
    // Generic /d/FILE_ID pattern
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // If no pattern matched, assume it's already a file ID
  return input;
}

/**
 * Prompt for Google Drive File ID or URL
 */
async function promptFileId(rl: readline.Interface): Promise<string> {
  const envFileId = process.env.GOOGLE_DRIVE_FILE_ID;
  if (envFileId) {
    const useEnv = await question(rl, `File ID from env: ${envFileId}\nUse this? (Y/n): `);
    if (!useEnv || useEnv.toLowerCase() === 'y' || useEnv.toLowerCase() === 'yes') {
      return extractFileIdFromUrl(envFileId);
    }
  }
  
  console.log('\nYou can paste either:');
  console.log('  • A Google Drive URL (e.g., https://docs.google.com/document/d/FILE_ID/edit)');
  console.log('  • A Google Drive File ID (e.g., 1kVJu1NZmhCHoQRWS1RmldOkC4n4f6WNST_N4upJuba4)');
  console.log('\nCommon URL formats:');
  console.log('  • https://docs.google.com/document/d/FILE_ID/edit');
  console.log('  • https://drive.google.com/file/d/FILE_ID/view');
  console.log('  • https://drive.google.com/open?id=FILE_ID');
  
  const input = await question(rl, '\nEnter Google Drive URL or File ID: ');
  if (!input) {
    throw new Error('File ID or URL is required');
  }
  
  const fileId = extractFileIdFromUrl(input);
  if (!fileId) {
    throw new Error('Could not extract File ID from the provided input');
  }
  
  // Show extracted ID if it was different from input
  if (fileId !== input) {
    console.log(`\n✓ Extracted File ID: ${fileId}`);
  }
  
  return fileId;
}

/**
 * Prompt for optional title
 */
async function promptTitle(rl: readline.Interface): Promise<string | undefined> {
  const title = await question(rl, 'Enter title (optional, press Enter to skip): ');
  return title || undefined;
}

/**
 * Prompt for optional MIME type
 */
async function promptMimeType(rl: readline.Interface): Promise<string | undefined> {
  console.log('\nCommon MIME types:');
  console.log('  1. Google Docs: application/vnd.google-apps.document');
  console.log('  2. Google Sheets: application/vnd.google-apps.spreadsheet');
  console.log('  3. Google Slides: application/vnd.google-apps.presentation');
  console.log('  4. PDF: application/pdf');
  console.log('  5. Custom (or press Enter to auto-detect)');
  
  const choice = await question(rl, '\nChoose option (1-5) or press Enter to skip: ');
  
  const mimeTypeMap: Record<string, string> = {
    '1': 'application/vnd.google-apps.document',
    '2': 'application/vnd.google-apps.spreadsheet',
    '3': 'application/vnd.google-apps.presentation',
    '4': 'application/pdf',
  };
  
  if (choice && mimeTypeMap[choice]) {
    return mimeTypeMap[choice];
  } else if (choice === '5') {
    const custom = await question(rl, 'Enter custom MIME type: ');
    return custom || undefined;
  }
  
  return undefined;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    console.log('=== Adding Google Drive Source ===\n');

    // Prompt for required fields
    const notebookId = await promptNotebookId(rl);
    const fileId = await promptFileId(rl);
    
    // Prompt for optional fields
    const title = await promptTitle(rl);
    const mimeType = await promptMimeType(rl);

    rl.close();

    console.log('\nAdding Google Drive source...\n');

    // Add Google Drive file using batch method (drive() is deprecated)
    const sourceIds = await sdk.sources.add.batch(notebookId, {
      sources: [{
        type: 'gdrive',
        fileId: fileId,
        title: title,
        mimeType: mimeType,
      }],
    });

    if (!sourceIds || sourceIds.length === 0) {
      throw new Error('Failed to add Google Drive source - no source ID returned');
    }

    const sourceId = sourceIds[0];

    console.log('✅ Successfully added Google Drive source');
    console.log(`   File ID: ${fileId}`);
    if (title) {
      console.log(`   Title: ${title}`);
    }
    if (mimeType) {
      console.log(`   MIME Type: ${mimeType}`);
    }
    console.log(`   Source ID: ${sourceId}\n`);

    // Check processing status
    const status = await sdk.sources.status(notebookId);
    if (status.processing.includes(sourceId)) {
      console.log('⏳ Source is still processing...');
    } else {
      console.log('✅ Source is ready!');
    }

    console.log('\nNote: Google Drive sources may take longer to process.');
  } catch (error) {
    rl.close();
    handleError(error, 'Failed to add Google Drive source');
  } finally {
    sdk.dispose();
    process.exit(0);
  }
}

main().catch(console.error);

