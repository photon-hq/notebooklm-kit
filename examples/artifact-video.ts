import { createSDK, handleError } from './utils.js';
import { ArtifactType, ArtifactState } from '../src/types/artifact.js';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// User-Agent header matching browser
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';

/**
 * Authenticate with Google using Playwright
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
  const currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com/signin')) {
    console.log('  ⚠️  Still on sign-in page - you may need to complete 2FA manually');
    console.log('  Waiting 60 seconds for manual 2FA completion...');
    await page.waitForTimeout(60000);
    
    // Check again after waiting
    const urlAfterWait = page.url();
    if (urlAfterWait.includes('accounts.google.com/signin')) {
      console.log('  ⚠️  Still on sign-in page after 60 seconds');
      console.log('  Waiting additional 30 seconds...');
      await page.waitForTimeout(30000);
    }
  }
  
  console.log('  ✓ Authentication complete');
}

/**
 * Download video using Node's http/https with cookies from Playwright
 * More reliable for large video files
 */
async function downloadVideoWithHttp(
  url: string,
  context: BrowserContext
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    // Get cookies from Playwright context
    context.cookies().then(cookies => {
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Cookie': cookieString,
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
        },
      };
      
      const req = httpModule.request(options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        const contentLength = res.headers['content-length'];
        const totalSize = contentLength ? parseInt(contentLength, 10) : null;
        let downloadedSize = 0;
        
        // Show download progress
        if (totalSize) {
          console.log(`  Downloading video (${(totalSize / 1024 / 1024).toFixed(2)} MB)...`);
          console.log(`  Progress: [${' '.repeat(50)}] 0%`);
        } else {
          console.log(`  Downloading video (size unknown, this may take a while)...`);
        }
        
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          downloadedSize += chunk.length;
          
          // Update progress if we know the total size
          if (totalSize) {
            const percentage = Math.floor((downloadedSize / totalSize) * 100);
            const filled = Math.floor((downloadedSize / totalSize) * 50);
            const progressBar = '='.repeat(filled) + ' '.repeat(50 - filled);
            process.stdout.write(`\r  Progress: [${progressBar}] ${percentage}%`);
          }
        });
        
        res.on('end', () => {
          if (totalSize) {
            process.stdout.write(`\r  Progress: [${'='.repeat(50)}] 100%\n`);
          }
          const videoBuffer = Buffer.concat(chunks);
          
          if (videoBuffer.length === 0) {
            reject(new Error('Empty response from server'));
            return;
          }
          
          // Basic validation
          const text = videoBuffer.toString('utf-8', 0, Math.min(500, videoBuffer.length));
          if (text.includes('Sign in') || text.includes('accounts.google.com') || (text.includes('<html') && !text.includes('video'))) {
            reject(new Error('Received HTML instead of video - authentication may be required'));
            return;
          }
          
          console.log(`  ✓ Video downloaded (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          resolve(videoBuffer);
        });
        
        res.on('error', (error: Error) => {
          reject(new Error(`Error downloading video: ${error.message}`));
        });
      });
      
      req.on('error', (error: Error) => {
        reject(new Error(`Request error: ${error.message}`));
      });
      
      req.end();
    }).catch(reject);
  });
}

/**
 * Download video using Playwright to get final URL, then Node http to download
 */
async function downloadVideoWithPlaywright(
  url: string,
  page: Page,
  context: BrowserContext
): Promise<Buffer> {
  try {
    console.log(`  Navigating to video URL to get final download URL...`);
    
    // Navigate to the initial URL - this will trigger redirects
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 180000 
    });
    
    if (!response) {
      throw new Error('No response from server');
    }
    
    // Wait for redirects to complete
    await page.waitForTimeout(5000);
    
    // Get the final URL after redirects
    let finalUrl = page.url();
    console.log(`  Final URL after redirects: ${finalUrl.substring(0, 100)}...`);
    
    // Check if we got redirected to a sign-in page
    if (finalUrl.includes('accounts.google.com/signin')) {
      console.log('  ⚠️  Redirected to sign-in page, waiting 60 seconds for authentication...');
      console.log('  Please complete authentication in the browser window...');
      await page.waitForTimeout(60000);
      finalUrl = page.url();
      
      if (finalUrl.includes('accounts.google.com/signin')) {
        console.log('  ⚠️  Still on sign-in page, waiting additional 30 seconds...');
        await page.waitForTimeout(30000);
        finalUrl = page.url();
      }
      
      // Retry navigation if still on sign-in
      if (finalUrl.includes('accounts.google.com/signin')) {
        console.log('  Retrying video URL after authentication...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
        await page.waitForTimeout(5000);
        finalUrl = page.url();
      }
    }
    
    if (finalUrl.includes('accounts.google.com/signin')) {
      throw new Error('Authentication required - still on sign-in page after waiting');
    }
    
    // Now download using Node's http/https with cookies from Playwright
    console.log(`  Downloading video using direct HTTP connection...`);
    return await downloadVideoWithHttp(finalUrl, context);
  } catch (error: any) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
}

async function main() {
  const sdk = await createSDK();
  
  // Declare browser variables outside try block so they're accessible in finally
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const videoId = process.env.ARTIFACT_ID || 'your-video-id';
    const outputDir = process.env.OUTPUT_DIR || './downloads';

    console.log('=== Video Artifact Download ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Video ID: ${videoId}`);
    console.log(`Output Directory: ${outputDir}\n`);

    // First, get the video artifact to check its state
    console.log('=== Checking Video Status ===\n');
    const video = await sdk.artifacts.get(videoId, notebookId);

    console.log(`Title: ${video.title}`);
    console.log(`State: ${video.state}\n`);

    if (video.state !== ArtifactState.READY) {
      if (video.state === ArtifactState.CREATING) {
        console.log('Video is still being created. Please wait and try again.');
      } else if (video.state === ArtifactState.FAILED) {
        console.log('Video creation failed.');
      }
      sdk.dispose();
      process.exit(1);
    }

    console.log('✓ Video is ready\n');
    
    // Get video URL
    if (!video.videoData) {
      throw new Error('Video URL not available. The video may not be ready yet.');
    }

    console.log('=== Video URL ===\n');
    console.log(`Video URL: ${video.videoData}\n`);

    // Set up browser for downloading video (requires authentication)
    console.log('=== Setting up Browser for Video Download ===\n');
    
    // Get Google credentials for browser login
    const googleEmail = process.env.GOOGLE_EMAIL;
    const googlePassword = process.env.GOOGLE_PASSWORD;
    
    if (!googleEmail || !googlePassword) {
      throw new Error('GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables are required for downloading videos.');
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
    
    console.log('  ✓ Authentication complete\n');
    
    // Now download video using the authenticated browser
    console.log('=== Downloading Video ===\n');
    console.log('Downloading video as MP4...\n');
    
    const videoBuffer = await downloadVideoWithPlaywright(video.videoData, page, context);
    
    // Save video to file
    console.log('\n=== Saving Video ===\n');
    await fs.mkdir(outputDir, { recursive: true });
    
    const sanitizedTitle = (video.title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const videoPath = path.join(outputDir, `${sanitizedTitle}.mp4`);
    await fs.writeFile(videoPath, videoBuffer);
    
    console.log(`✓ Video saved successfully!`);
    console.log(`  Saved to: ${videoPath}`);
    console.log(`  Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    // Note about get() vs download()
    console.log('=== Note ===\n');
    console.log('Use get() to get the video URL:');
    console.log('  const video = await sdk.artifacts.get(videoId, notebookId);');
    console.log('  console.log(`Video URL: ${video.videoData}`);\n');
    console.log('Use download() to download the video file (requires browser authentication):');
    console.log('  const result = await sdk.artifacts.download(videoId, outputDir, notebookId);');
    console.log('  console.log(`Video saved to: ${result.filePath}`);\n');

    // Close browser after download is complete
    if (browser) {
      await browser.close();
      console.log('✓ Browser closed\n');
    }
    
    console.log('=== Download Complete ===');
  } catch (error) {
    handleError(error, 'Failed to download video');
  } finally {
    // Ensure browser is closed on error
    if (browser) {
      await browser.close();
    }
    sdk.dispose();
    process.exit(0);
  }
}

main().catch(console.error);

