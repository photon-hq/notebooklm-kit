/**
 * Interactive slide download test function
 * 
 * Based on Manus AI solution for downloading slide images:
 * 1. Lists slide artifacts from a notebook
 * 2. Provides interactive selection
 * 3. Extracts image URLs from artifact data
 * 4. Downloads each image (following redirects)
 * 5. Combines images into PDF
 * 
 * Usage:
 *   
 * Option 1: Using tsx (recommended - install: npm install -D tsx)
 *   NOTEBOOK_ID=your-notebook-id npx tsx examples/slide-download-test.ts
 *   OR: npm install -D tsx && NOTEBOOK_ID=your-notebook-id tsx examples/slide-download-test.ts
 * 
 * Option 2: Compile and run
 *   npm run build
 *   node dist/examples/slide-download-test.js
 * 
 * Option 3: Using ts-node with ESM
 *   npm install -D ts-node @types/node
 *   NOTEBOOK_ID=your-notebook-id node --loader ts-node/esm examples/slide-download-test.ts
 */

import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';
import * as RPC from '../src/rpc/rpc-methods.js';
import { createSDK, handleError } from './utils.js';

// User-Agent header matching browser
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';

/**
 * Create readline interface for interactive prompts
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * Recursively search for slide URLs in the artifact data structure
 * Slides are typically in arrays like: [["https://lh3.googleusercontent.com/notebooklm/...", width, height], ...]
 */
function findSlideUrlsInStructure(data: any, urls: string[] = []): string[] {
  if (!data) {
    return urls;
  }
  
  // If it's an array, check if first element is a URL string
  if (Array.isArray(data)) {
    // Check if this array contains a slide URL (format: [url, width, height])
    if (data.length >= 1 && typeof data[0] === 'string') {
      let potentialUrl = data[0];
      
      // Decode escaped characters first (e.g., \u003d -> =)
      potentialUrl = potentialUrl.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
      
      // Check if it's a notebooklm slide URL
      // Pattern: https://lh3.googleusercontent.com/notebooklm/...=w...?authuser=0
      if (potentialUrl.includes('lh3.googleusercontent.com/notebooklm/')) {
        // Check for the pattern =w (width) or =s (size) which indicates it's a slide image
        if ((potentialUrl.includes('=w') || potentialUrl.includes('=s')) && 
            potentialUrl.includes('?authuser=0')) {
          if (!urls.includes(potentialUrl)) {
            urls.push(potentialUrl);
          }
        }
      }
    }
    
    // Recursively search all elements
    for (const item of data) {
      findSlideUrlsInStructure(item, urls);
    }
  } else if (typeof data === 'object' && data !== null) {
    // Recursively search object values
    for (const value of Object.values(data)) {
      findSlideUrlsInStructure(value, urls);
    }
  } else if (typeof data === 'string') {
    // Check if this string itself is a URL
    let decodedUrl = data.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    if (decodedUrl.includes('lh3.googleusercontent.com/notebooklm/')) {
      if ((decodedUrl.includes('=w') || decodedUrl.includes('=s')) && 
          decodedUrl.includes('?authuser=0')) {
        if (!urls.includes(decodedUrl)) {
          urls.push(decodedUrl);
        }
      }
    }
  }
  
  return urls;
}

/**
 * Extract slide image URLs from artifact RPC response
 * Pattern: https://lh3.googleusercontent.com/notebooklm/[ASSET_ID]=w1376-h768?authuser=0
 * 
 * Based on extract_urls.py pattern:
 * r'https://lh3\.googleusercontent\.com/notebooklm/[^=\s]+=[^?\s]+\?authuser=0'
 */
function extractSlideImageUrls(artifactData: any): string[] {
  const urls: string[] = [];
  
  if (!artifactData) {
    return urls;
  }
  
  // First, try structured extraction (more reliable)
  const structuredUrls = findSlideUrlsInStructure(artifactData);
  if (structuredUrls.length > 0) {
    console.log(`Found ${structuredUrls.length} URL(s) using structured extraction\n`);
    return structuredUrls;
  }
  
  // Fallback: string-based regex extraction
  const dataString = JSON.stringify(artifactData);
  
  // Pattern for notebooklm asset URLs (matching extract_urls.py)
  // Format: https://lh3.googleusercontent.com/notebooklm/[ASSET_ID]=w1376-h768?authuser=0
  const urlPattern = /https:\\?\/\\?\/lh3\.googleusercontent\.com\\?\/notebooklm\\?\/[^"'\s\)\]]+\\?u003dw[^"'\s\)\]]+\\?u003d[^"'\s\)\]]+\\?u003dauthuser\\?u003d0/g;
  const matches = dataString.match(urlPattern);
  
  if (matches) {
    for (const match of matches) {
      // Decode escaped characters
      let url = match.replace(/\\/g, '').replace(/u003d/g, '=').replace(/u0026/g, '&');
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
    console.log(`Found ${urls.length} URL(s) using regex pattern\n`);
  }
  
  // Also try a more lenient pattern
  if (urls.length === 0) {
    const lenientPattern = /lh3\.googleusercontent\.com\/notebooklm\/[^"'\s\)\]]+/g;
    const lenientMatches = dataString.match(lenientPattern);
    
    if (lenientMatches) {
      for (const match of lenientMatches) {
        let url = `https://${match}`;
        // Decode escaped characters
        url = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
        // Add ?authuser=0 if not present
        if (!url.includes('authuser=0')) {
          if (!url.includes('?')) {
            url += '?authuser=0';
          } else {
            url += '&authuser=0';
          }
        }
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }
      console.log(`Found ${urls.length} URL(s) using lenient pattern\n`);
    }
  }
  
  return urls;
}

/**
 * Generate SAPISIDHASH from cookies and timestamp
 * Format: SAPISIDHASH <timestamp>_<hash>
 * Hash algorithm: SHA1(timestamp + SAPISID_value + origin)
 * 
 * However, this is complex. For now, we'll try without it first since
 * the mm45.txt curl commands don't show Authorization headers for image requests.
 */
function generateAuthHeader(cookies: string): string | null {
  // Extract SAPISID cookie value
  const sapisidMatch = cookies.match(/SAPISID=([^;]+)/);
  if (!sapisidMatch) {
    return null;
  }
  
  // Note: SAPISIDHASH requires timestamp and SHA1 hash - for now, skip it
  // and rely on cookies only, as the mm45.txt examples show image requests
  // without Authorization headers
  return null; // Return null to skip authorization header for now
}

/**
 * Download image from URL, following redirects
 * Returns the final image data as Buffer
 * 
 * Based on download_slides.py implementation:
 * - Uses cookies, Authorization header, User-Agent, and Referer
 * - Follows 302 redirects from notebooklm to rd-notebooklm
 */
/**
 * Authenticate with Google using Playwright
 * Waits for 2FA completion without navigating away
 */
async function authenticateWithGoogle(page: Page, email: string, password: string): Promise<void> {
  console.log('  Authenticating with Google...');
  
  // Navigate to Google sign-in
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Enter email
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Next"), #identifierNext');
  await page.waitForTimeout(3000);
  
  // Enter password
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Next"), #passwordNext');
  
  // Wait for authentication to complete (may redirect to Google home or show 2FA)
  await page.waitForTimeout(5000);
  
  // Check if we're still on a sign-in page (might need 2FA)
  let currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com/signin')) {
    console.log('  ⚠️  Still on sign-in page - you may need to complete 2FA manually');
    console.log('  Waiting 60 seconds for manual 2FA completion...');
    console.log('  Please complete 2FA in the browser window (do not close it)...');
    
    // Wait for 2FA - check periodically if we've moved off the sign-in page
    let waitedTime = 0;
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 5000; // Check every 5 seconds
    
    while (waitedTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      waitedTime += checkInterval;
      currentUrl = page.url();
      
      // If we're no longer on the sign-in page, authentication is complete
      if (!currentUrl.includes('accounts.google.com/signin')) {
        console.log(`  ✓ Authentication complete after ${waitedTime / 1000} seconds`);
        return;
      }
    }
    
    // After 60 seconds, check one more time
    currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com/signin')) {
      console.log('  ⚠️  Still on sign-in page after 60 seconds');
      console.log('  Waiting additional 30 seconds...');
      await page.waitForTimeout(30000);
      currentUrl = page.url();
    }
  }
  
  console.log('  ✓ Authentication complete');
}

/**
 * Download image using Playwright (headless browser)
 */
async function downloadImageWithPlaywright(
  url: string,
  page: Page
): Promise<Buffer> {
  try {
    // Navigate to the image URL - Playwright will handle redirects automatically
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    
    if (!response) {
      throw new Error('No response from server');
    }
    
    // Check if we got redirected to a sign-in page
    const finalUrl = page.url();
    if (finalUrl.includes('accounts.google.com/signin')) {
      throw new Error('Authentication required - redirected to sign-in page');
    }
    
    // Check response status
    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }
    
    // Get the response body as buffer
    const imageBuffer = await response.body();
    
    // Validate it's an image (basic check)
    const isValidImage = imageBuffer.length > 0 && (
      (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) || // PNG
      (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) || // JPEG
      (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46) // RIFF (WebP)
    );
    
    if (!isValidImage) {
      // Check if it's HTML (redirect to sign-in)
      const text = imageBuffer.toString('utf-8', 0, Math.min(500, imageBuffer.length));
      if (text.includes('Sign in') || text.includes('accounts.google.com') || text.includes('<html')) {
        throw new Error('Authentication required - received HTML instead of image');
      }
      throw new Error('Downloaded data is not a valid image');
    }
    
    return Buffer.from(imageBuffer);
  } catch (error: any) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Combine images into PDF using a simple approach
 * Note: This requires pdf-lib or similar library, or we can save images separately
 * For now, we'll save images and provide instructions to combine them
 */
async function saveImages(
  images: Buffer[],
  outputDir: string,
  slideTitle: string
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  
  const savedPaths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const imagePath = path.join(outputDir, `slide_${i + 1}.png`);
    await fs.writeFile(imagePath, images[i]);
    savedPaths.push(imagePath);
    console.log(`  Saved slide ${i + 1}/${images.length}: ${imagePath}`);
  }
  
  return savedPaths;
}

/**
 * Main test function
 */
  async function main() {
    const rl = createReadlineInterface();
    
    // Declare browser variables outside try block so they're accessible in finally
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    
    try {
      // Initialize SDK using credentials from env
      console.log('=== Initializing SDK ===\n');
      const sdk = await createSDK();
      await sdk.connect();
      console.log('✓ SDK connected successfully\n');
    
    // First verify credentials by trying to list notebooks
    console.log('=== Verifying Credentials and Listing Notebooks ===\n');
    let notebooks;
    try {
        notebooks = await sdk.notebooks.list();
      console.log(`✓ Credentials valid. Found ${notebooks.length} notebook(s)\n`);
    } catch (error: any) {
      if (error.message?.includes('Permission denied') || error.message?.includes('290')) {
        throw new Error(
          'Permission denied: Your credentials may be expired or invalid.\n' +
          'Please verify your credentials are current and try again.'
        );
      }
      throw error;
    }
    
    // Prompt user to select a notebook
    if (notebooks.length === 0) {
      throw new Error('No notebooks found in your account.');
    }
    
    console.log('Available notebooks:\n');
    notebooks.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.title || 'Untitled'} (${n.projectId})`);
    });
    console.log();
    const notebookSelection = await question(rl, `Select notebook (1-${notebooks.length}) or enter notebook ID: `);
    
    let notebookId: string;
    const selectionNum = parseInt(notebookSelection, 10);
    if (!isNaN(selectionNum) && selectionNum >= 1 && selectionNum <= notebooks.length) {
      notebookId = notebooks[selectionNum - 1].projectId.trim();
      console.log(`✓ Selected notebook: ${notebooks[selectionNum - 1].title || 'Untitled'}`);
      console.log(`  Notebook ID: ${notebookId}\n`);
    } else {
      // Treat as notebook ID
      notebookId = notebookSelection.trim();
      const notebookExists = notebooks.some(n => n.projectId.trim() === notebookId);
      if (!notebookExists) {
        console.warn(`⚠ Warning: Notebook ID "${notebookId}" not found in your notebooks.`);
        const continueAnyway = await question(rl, 'Continue anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
          throw new Error('Aborted by user');
        }
      }
    }
    
    console.log('=== Listing Slide Artifacts ===\n');
    console.log(`Fetching artifacts for notebook: ${notebookId}\n`);
    
    let artifacts;
    try {
      artifacts = await sdk.artifacts.list(notebookId);
    } catch (error: any) {
      console.error(`\n✗ Error listing artifacts: ${error.message}`);
      if (error.message?.includes('Not found') || error.message?.includes('404')) {
        console.error(`\nThe notebook "${notebookId}" may not exist, or you may not have access to it.`);
        console.error(`\nPlease verify:`);
        console.error(`  1. The notebook ID is correct: ${notebookId}`);
        console.error(`  2. You have access to this notebook`);
        console.error(`  3. The notebook exists in your account`);
        console.error(`\nYou can try:`);
        console.error(`  - Use the second notebook ID from the list above`);
        console.error(`  - Or set NOTEBOOK_ID environment variable directly`);
        throw new Error(`Notebook not found or access denied: ${notebookId}`);
      }
      throw error;
    }
    const slideArtifacts = artifacts.filter(
      a => a.type === ArtifactType.SLIDE_DECK && a.state === ArtifactState.READY
    );
    
    if (slideArtifacts.length === 0) {
      console.log('No ready slide decks found in this notebook.');
      return;
    }
    
    console.log(`Found ${slideArtifacts.length} slide deck(s):\n`);
    slideArtifacts.forEach((artifact, index) => {
      console.log(`  ${index + 1}. ${artifact.title || 'Untitled'} (${artifact.artifactId})`);
    });
    
    console.log();
    const selection = await question(rl, `Select slide deck (1-${slideArtifacts.length}): `);
    const selectedIndex = parseInt(selection, 10) - 1;
    
    if (selectedIndex < 0 || selectedIndex >= slideArtifacts.length) {
      throw new Error('Invalid selection');
    }
    
    const selectedArtifact = slideArtifacts[selectedIndex];
    console.log(`\nSelected: ${selectedArtifact.title || 'Untitled'} (${selectedArtifact.artifactId})\n`);
    
    console.log('=== Extracting Image URLs ===\n');
    
    // Use the list response (which was working) to extract slide URLs
    // RPC_GET_ARTIFACT gives 400 errors, so we'll extract from the list response
    const rpc = await sdk.getRPCClient();
    const artifactsListResponse = await rpc.call(
      RPC.RPC_LIST_ARTIFACTS,
      [[2], notebookId], // [2] is artifact type filter for SLIDE_DECK
      notebookId
    );
    
    // Parse the response - it might be double-encoded JSON (string containing JSON)
    let parsedResponse = artifactsListResponse;
    if (typeof artifactsListResponse === 'string') {
      try {
        parsedResponse = JSON.parse(artifactsListResponse);
        // Might be double-encoded (JSON string inside JSON string)
        if (typeof parsedResponse === 'string') {
          parsedResponse = JSON.parse(parsedResponse);
        }
      } catch (e) {
        // Already parsed or not valid JSON string
      }
    }
    
    // Helper function to extract slide URLs from a slide deck artifact
    // Slides are in format: [["https://...", width, height], ...]
    function extractSlideUrlsFromArtifact(artifact: any, maxDepth = 15): string[] {
      const urls: string[] = [];
      
      function searchForSlides(obj: any, depth = 0): void {
        if (depth > maxDepth) {
          return; // Prevent infinite recursion
        }
        
        if (Array.isArray(obj)) {
          // Check if this is a slide array: [url_string, width_int, height_int]
          if (obj.length >= 3 && 
              typeof obj[0] === 'string' && 
              obj[0].includes('lh3.googleusercontent.com/notebooklm/') &&
              (obj[0].includes('=w') || obj[0].includes('=s')) &&
              typeof obj[1] === 'number' &&
              typeof obj[2] === 'number') {
            // Get the full URL string (it should already be complete with =w1376-h768)
            let url = String(obj[0]);
            // Decode any escaped characters (from JSON encoding) - handle Unicode escapes
            url = url.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\u002f/g, '/');
            // Ensure the URL is complete - it should end with =w1376-h768 or similar
            // Add ?authuser=0 if not present (required for download)
            if (!url.includes('?')) {
              url += '?authuser=0';
            } else if (!url.includes('authuser=0')) {
              // Check if query string exists but doesn't have authuser
              url += '&authuser=0';
            }
            // Only add if we haven't seen it before and it has the correct format
            if (!urls.includes(url) && (url.includes('=w') || url.includes('=s'))) {
              urls.push(url);
            }
            return; // Don't recurse into the width/height numbers
          }
          
          // Recursively search all elements
          for (const item of obj) {
            searchForSlides(item, depth + 1);
          }
        } else if (typeof obj === 'object' && obj !== null) {
          for (const value of Object.values(obj)) {
            searchForSlides(value, depth + 1);
          }
        } else if (typeof obj === 'string' && obj.includes('lh3.googleusercontent.com/notebooklm') && (obj.includes('=w') || obj.includes('=s'))) {
          // Direct URL string (might be in a different format)
          let url = obj.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
          if (!url.includes('?')) {
            url += '?authuser=0';
          } else if (!url.includes('authuser=0')) {
            url += '&authuser=0';
          }
          if (!urls.includes(url)) {
            urls.push(url);
          }
        }
      }
      
      searchForSlides(artifact);
      return urls;
    }
    
    // Find the specific slide deck artifact in the list response
    let imageUrls: string[] = [];
    if (Array.isArray(parsedResponse)) {
      // Response is [[artifact1, artifact2, ...]]
      const artifacts = Array.isArray(parsedResponse[0]) ? parsedResponse[0] : parsedResponse;
      
      console.log(`Searching through ${artifacts.length} artifacts for ${selectedArtifact.artifactId}...\n`);
      
      for (const artifactEntry of artifacts) {
        if (Array.isArray(artifactEntry) && artifactEntry.length > 0) {
          const artifactId = artifactEntry[0];
          if (artifactId === selectedArtifact.artifactId) {
            // This is our slide deck - extract image URLs from this specific artifact ONLY
            console.log(`✓ Found artifact entry for ${selectedArtifact.artifactId} at position ${artifacts.indexOf(artifactEntry)}, extracting URLs...\n`);
            imageUrls = extractSlideUrlsFromArtifact(artifactEntry);
            console.log(`Extracted ${imageUrls.length} URLs from artifact entry\n`);
            break;
          }
        }
      }
    }
    
    // If not found in specific artifact, search the entire response as fallback
    if (imageUrls.length === 0) {
      console.log('⚠ URLs not found in specific artifact entry, searching entire response...\n');
      imageUrls = extractSlideUrlsFromArtifact(parsedResponse);
    }
    
    if (imageUrls.length === 0) {
      console.error('No image URLs found in artifact data.');
      console.error('\nTo debug:');
      console.error(`1. The slide deck may not be ready or the format may have changed.`);
      console.error(`2. Try checking the artifact state with: await sdk.artifacts.get('${selectedArtifact.artifactId}')`);
      throw new Error('No image URLs found in artifact data.');
    }
    
    // Remove duplicates and sort
    imageUrls = Array.from(new Set(imageUrls));
    
    // Filter to only include URLs with the correct format (=w or =s followed by numbers)
    // This helps exclude wrong URLs from other artifacts
    const validImageUrls = imageUrls.filter(url => {
      // Must have =w or =s followed by numbers, and should end with ?authuser=0 or have it added
      return url.includes('=w') || url.includes('=s');
    });
    
    if (validImageUrls.length < imageUrls.length) {
      console.log(`Filtered ${imageUrls.length} URLs down to ${validImageUrls.length} valid slide URLs\n`);
    }
    imageUrls = validImageUrls;
    
    console.log(`Found ${imageUrls.length} slide image URL(s)\n`);
    
    // Show first URL for debugging - verify format matches mm45.txt
    if (imageUrls.length > 0) {
      const firstUrl = imageUrls[0];
      console.log(`First URL (complete, for verification):`);
      console.log(`${firstUrl}\n`);
      console.log(`Format verification:`);
      console.log(`  Has =w1376-h768: ${firstUrl.includes('=w1376-h768') ? '✓' : '✗'}`);
      console.log(`  Has ?authuser=0: ${firstUrl.includes('?authuser=0') ? '✓' : '✗'}`);
      console.log(`  Ends with: ...${firstUrl.substring(Math.max(0, firstUrl.length - 35))}\n`);
    }
    
    // Set up browser for downloading slides (requires authentication)
    console.log('\n=== Setting up Browser for Slide Download ===\n');
    
    // Get Google credentials for browser login
    const googleEmail = process.env.GOOGLE_EMAIL;
    const googlePassword = process.env.GOOGLE_PASSWORD;
    
    if (!googleEmail || !googlePassword) {
      throw new Error('GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables are required for downloading slides.');
    }
    
    // Launch browser and create page
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Authenticate with Google (this will handle 2FA and wait)
    console.log('=== Authenticating with Google ===\n');
    await authenticateWithGoogle(page, googleEmail, googlePassword);
    
    // Wait a bit after authentication to ensure session is established
    await page.waitForTimeout(2000);
    
    console.log('  ✓ Authentication complete, ready to download images\n');
    
    // Now download images using the authenticated browser
    console.log('\n=== Downloading Images ===\n');
    
    const images: Buffer[] = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      console.log(`Downloading slide ${i + 1}/${imageUrls.length}...`);
      console.log(`  URL: ${url}`);
      console.log(`  URL length: ${url.length} chars`);
      
      try {
        const imageData = await downloadImageWithPlaywright(url, page);
        images.push(imageData);
        console.log(`  ✓ Downloaded (${(imageData.length / 1024).toFixed(2)} KB)\n`);
      } catch (error: any) {
        console.error(`  ✗ Failed: ${error.message}\n`);
        // Continue with other images even if one fails
      }
    }
    
    if (images.length === 0) {
      throw new Error('No images were successfully downloaded');
    }
    
    console.log(`\n✓ Successfully downloaded ${images.length} slide image(s) in memory`);
    
    // Save images to files
    console.log('\n=== Saving Images ===\n');
    const outputDir = process.env.OUTPUT_DIR || './downloads';
    const sanitizedTitle = (selectedArtifact.title || 'slides').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const slideOutputDir = path.join(outputDir, sanitizedTitle);
    
    const savedPaths = await saveImages(images, slideOutputDir, selectedArtifact.title || 'slides');
    console.log(`\n✓ Successfully saved ${savedPaths.length} slide image(s) to: ${slideOutputDir}`);
      
    // Close browser after all downloads are complete
    if (browser) {
      await browser.close();
      console.log('\n✓ Browser closed');
    }
    
    sdk.dispose();
    } catch (error: any) {
      handleError(error, 'Failed to download slides');
    } finally {
      // Ensure browser is closed on error
      if (browser) {
        await browser.close();
      }
      rl.close();
    }
}

// Run if called directly
main().catch(console.error);

export { main as testSlideDownload };

