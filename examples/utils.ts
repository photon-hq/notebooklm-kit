import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'node:fs';
import { NotebookLMClient } from '../src/index.js';
import { chromium, Browser } from 'playwright';
import * as readline from 'readline';

/**
 * Find project root directory by looking for package.json
 * Works regardless of where the script is executed from
 * Always returns the directory containing package.json
 */
function findProjectRoot(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));
  
  // Walk up the directory tree to find project root (package.json)
  let root = currentDir;
  const maxDepth = 10; // Prevent infinite loops
  let depth = 0;
  
  while (depth < maxDepth) {
    // Check for package.json in current directory
    if (existsSync(join(root, 'package.json'))) {
      return root;
    }
    
    const parent = resolve(root, '..');
    // If we've reached the filesystem root, stop
    if (parent === root) {
      break;
    }
    root = parent;
    depth++;
  }
  
  // Fallback: if we're in examples/, assume parent is root
  if (currentDir.endsWith('examples')) {
    return resolve(currentDir, '..');
  }
  
  // Last resort: return current directory
  return currentDir;
}

const projectRoot = findProjectRoot();
const envPath = join(projectRoot, '.env');

// Suppress dotenv log messages
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: any, encoding?: any, cb?: any) => {
  if (typeof chunk === 'string' && chunk.includes('[dotenv@')) {
    return true; // Suppress dotenv messages
  }
  return originalStdoutWrite(chunk, encoding, cb);
};

// Load .env from project root (always)
dotenv.config({ path: envPath });
// Restore stdout
process.stdout.write = originalStdoutWrite;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/**
 * Wait for user input (press Enter)
 */
function waitForEnter(prompt: string = 'Press Enter to continue...'): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Extract credentials from NotebookLM page using browser
 * Opens visible browser, waits for manual login, then extracts cookies and auth token
 */
async function extractCredentialsFromBrowser(waitSeconds: number = 60, keepOpen: boolean = false): Promise<{ authToken: string; cookies: string; browser?: Browser }> {
  console.log(`\n🌐 Opening browser (visible mode)...`);
  console.log(`⏳ You have ${waitSeconds} seconds to manually log in to NotebookLM (including 2FA)...\n`);

  const browser: Browser = await chromium.launch({ headless: false });
  
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    
    // Navigate to NotebookLM
    await page.goto('https://notebooklm.google.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // Wait for user to manually log in
    console.log(`Waiting ${waitSeconds} seconds for manual authentication...`);
    await page.waitForTimeout(waitSeconds * 1000);
    
    // Extract auth token
    console.log('Extracting credentials...');
    let authToken: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      authToken = await page.evaluate(() => {
        // @ts-ignore
        return window.WIZ_global_data?.SNlM0e || null;
      });
      
      if (authToken) {
        break;
      }
      
      console.log(`Waiting for auth token... (attempt ${attempt + 1}/10)`);
      await page.waitForTimeout(2000);
    }
    
    if (!authToken) {
      throw new Error('Failed to extract auth token. Make sure you are logged in to NotebookLM.');
    }
    
    // Extract cookies
    const cookies = await page.context().cookies();
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    if (!cookieString || cookieString.length < 100) {
      throw new Error('Failed to extract cookies - cookie string too short or empty');
    }
    
    console.log('✓ Credentials extracted successfully\n');
    
    if (keepOpen) {
      console.log('🌐 Browser will stay open. Press Enter when you\'re done...\n');
      await waitForEnter();
      await browser.close();
    }
    
    return {
      authToken,
      cookies: cookieString,
    };
  } finally {
    if (!keepOpen) {
      await browser.close();
    }
  }
}

/**
 * Create and initialize SDK with auto-login
 * Uses auto-login by default (GOOGLE_EMAIL, GOOGLE_PASSWORD from env)
 * Falls back to manual credentials if provided (NOTEBOOKLM_AUTH_TOKEN, NOTEBOOKLM_COOKIES)
 * Or extracts credentials from visible browser if EXTRACT_COOKIES=true
 */
export async function createSDK(config?: { debug?: boolean }): Promise<NotebookLMClient> {
  const googleEmail = process.env.GOOGLE_EMAIL;
  const googlePassword = process.env.GOOGLE_PASSWORD;
  const authToken = process.env.NOTEBOOKLM_AUTH_TOKEN;
  const cookies = process.env.NOTEBOOKLM_COOKIES;
  const extractCookies = process.env.EXTRACT_COOKIES === 'true';

  // Option 1: Extract cookies from visible browser
  if (extractCookies) {
    const waitSeconds = parseInt(process.env.EXTRACT_WAIT_SECONDS || '60', 10);
    const keepOpen = process.env.KEEP_BROWSER_OPEN === 'true';
    const credentials = await extractCredentialsFromBrowser(waitSeconds, keepOpen);
    
    console.log('💡 Credentials extracted! Add these to your .env file:\n');
    console.log(`NOTEBOOKLM_AUTH_TOKEN="${credentials.authToken}"`);
    console.log(`NOTEBOOKLM_COOKIES="${credentials.cookies}"\n`);
    
    return new NotebookLMClient({
      authToken: credentials.authToken,
      cookies: credentials.cookies,
      autoRefresh: true,
      enforceQuotas: false,
      debug: config?.debug,
    });
  }

  // Option 2: Auto-login with email/password (priority - opens visible browser)
  if (googleEmail && googlePassword) {
    return new NotebookLMClient({
      auth: {
        email: googleEmail,
        password: googlePassword,
        headless: false, // Visible browser for manual intervention
      },
      autoRefresh: true,
      enforceQuotas: false,
      debug: config?.debug,
    });
  }

  // Option 3: Manual credentials from env (fallback only)
  if (authToken && cookies) {
    return new NotebookLMClient({
      authToken,
      cookies,
      autoRefresh: true,
      enforceQuotas: false,
      debug: config?.debug,
    });
  }

  // No credentials provided
  throw new Error(
    'Authentication required. Provide one of:\n' +
    '  - EXTRACT_COOKIES=true (opens browser to extract cookies manually)\n' +
    '  - GOOGLE_EMAIL and GOOGLE_PASSWORD (for auto-login with visible browser)\n' +
    '  - NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES (for manual credentials)\n' +
    'Set these in your .env file'
  );
}

export function handleError(error: unknown, context: string): never {
  if (error instanceof Error) {
    console.error(`${context}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`${context}:`, error);
  }
  process.exit(1);
}

