import { createSDK, handleError } from './utils.js';
import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

async function main() {
  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding File Source ===\n');
    console.log('Note: Large files (>200MB or >500k words) are automatically chunked\n');

    // Example 1: Add file from Buffer (Node.js)
    console.log('1. Adding file from Buffer...');
    
    // Create a sample text file in memory
    const fileContent = Buffer.from(`
# Research Document

## Introduction
This is a sample research document.

## Key Points
1. Point one
2. Point two
3. Point three
    `.trim());
    
    const result1 = await sdk.sources.add.file(notebookId, {
      content: fileContent,
      fileName: 'research-document.txt',
      mimeType: 'text/plain',
    });
    
    if (typeof result1 === 'string') {
      console.log(`Added file source (Buffer)`);
      console.log(`Source ID: ${result1}\n`);
    } else {
      console.log(`Added file source (auto-chunked)`);
      console.log(`Uploaded ${result1.chunks?.length || 0} chunks`);
      console.log(`Source IDs: ${result1.allSourceIds?.join(', ')}\n`);
    }

    // Example 2: Add file from base64 string
    console.log('2. Adding file from base64 string...');
    const base64Content = fileContent.toString('base64');
    const result2 = await sdk.sources.add.file(notebookId, {
      content: base64Content,
      fileName: 'research-document-base64.txt',
    });
    
    if (typeof result2 === 'string') {
      console.log(`Added file source (base64)`);
      console.log(`Source ID: ${result2}\n`);
    } else {
      console.log(`Added file source (auto-chunked)`);
      console.log(`Uploaded ${result2.chunks?.length || 0} chunks`);
      console.log(`Source IDs: ${result2.allSourceIds?.join(', ')}\n`);
    }

    // Example 3: Add actual file from filesystem (if file exists)
    const filePath = process.env.FILE_PATH;
    if (filePath && existsSync(filePath)) {
      console.log('3. Adding file from filesystem...');
      const fileBuffer = readFileSync(filePath);
      const fileName = basename(filePath);
      const result3 = await sdk.sources.add.file(notebookId, {
        content: fileBuffer,
        fileName: fileName,
      });
      
      if (typeof result3 === 'string') {
        console.log(`Added file: ${fileName}`);
        console.log(`Source ID: ${result3}\n`);
      } else {
        console.log(`Added file: ${fileName} (auto-chunked)`);
        console.log(`Uploaded ${result3.chunks?.length || 0} chunks`);
        console.log(`Source IDs: ${result3.allSourceIds?.join(', ')}\n`);
      }
    } else {
      console.log('3. Set FILE_PATH in .env to add a file from filesystem\n');
    }

    // Check processing status
    const status = await sdk.sources.status(notebookId);
    console.log(`Processing: ${status.processing.length} sources still processing`);
  } catch (error) {
    handleError(error, 'Failed to add file source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

