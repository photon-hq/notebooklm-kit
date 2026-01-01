/**
 * Authentication management for NotebookLM
 * Handles auto-login, credential extraction, and credential storage
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { NotebookLMAuthError } from '../types/common.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/**
 * Credentials structure
 */
export interface Credentials {
  authToken: string;
  cookies: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Google email for auto-login */
  email?: string;
  /** Google password for auto-login */
  password?: string;
  /** Enable headless mode for browser (default: true) */
  headless?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Get credentials storage path
 * Saves to project root (current working directory) for easy access
 */
function getCredentialsPath(): string {
  // Save in project root (current working directory)
  // This is where you run the script from (e.g., notebooklm-kit/)
  const projectRoot = process.cwd();
  return path.join(projectRoot, 'credentials.json');
}

/**
 * Ensure credentials directory exists
 */
async function ensureCredentialsDir(): Promise<void> {
  const credsPath = getCredentialsPath();
  const dir = path.dirname(credsPath);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save credentials to disk
 */
export async function saveCredentials(credentials: Credentials): Promise<void> {
  await ensureCredentialsDir();
  const credsPath = getCredentialsPath();
  await fs.writeFile(credsPath, JSON.stringify(credentials, null, 2), 'utf-8');
}

/**
 * Load credentials from disk
 */
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const credsPath = getCredentialsPath();
    const data = await fs.readFile(credsPath, 'utf-8');
    return JSON.parse(data) as Credentials;
  } catch (error) {
    // File doesn't exist or invalid
    return null;
  }
}

/**
 * Delete saved credentials
 */
export async function deleteCredentials(): Promise<void> {
  try {
    const credsPath = getCredentialsPath();
    await fs.unlink(credsPath);
  } catch (error) {
    // File doesn't exist, ignore
  }
}

/**
 * Authenticate with Google using Playwright
 */
async function authenticateWithGoogle(page: Page, email: string, password: string, debug: boolean = false): Promise<void> {
  if (debug) {
    console.log('Authenticating with Google...');
  }
  
  // Navigate to Google sign-in
  await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Enter email
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Next"), #identifierNext, button[type="button"]:has-text("Next")');
  await page.waitForTimeout(2000);
  
  // Enter password
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Next"), #passwordNext, button[type="button"]:has-text("Next")');
  
  // Wait for authentication to complete
  await page.waitForTimeout(3000);
  
  // Check if we're still on sign-in page (2FA or other issues)
  const currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com/signin') || currentUrl.includes('challenge')) {
    throw new NotebookLMAuthError(
      'Authentication requires additional steps (2FA, verification, etc.). ' +
      'Please use manual authentication with NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES environment variables instead.'
    );
  }
  
  if (debug) {
    console.log('✓ Google authentication successful');
  }
}

/**
 * Extract credentials from NotebookLM page
 */
async function extractCredentials(page: Page, debug: boolean = false): Promise<Credentials> {
  if (debug) {
    console.log('Navigating to NotebookLM...');
  }
  
  // Navigate to NotebookLM
  await page.goto('https://notebooklm.google.com/', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  // Wait for page to load
  await page.waitForTimeout(5000);
  
  // Check if we're still on sign-in page
  const currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com/signin')) {
    throw new NotebookLMAuthError('Failed to access NotebookLM - authentication may have failed');
  }
  
  // Extract auth token from window.WIZ_global_data.SNlM0e
  if (debug) {
    console.log('Extracting auth token...');
  }
  
  let authToken: string | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    authToken = await page.evaluate(() => {
      // @ts-ignore
      return window.WIZ_global_data?.SNlM0e || null;
    });
    
    if (authToken) {
      break;
    }
    
    if (debug && attempt < 5) {
      console.log(`Waiting for auth token... (attempt ${attempt + 1}/10)`);
    }
    await page.waitForTimeout(2000);
  }
  
  if (!authToken) {
    // Try one more time with longer wait
    await page.waitForTimeout(5000);
    authToken = await page.evaluate(() => {
      // @ts-ignore
      return window.WIZ_global_data?.SNlM0e || null;
    });
  }
  
  if (!authToken) {
    throw new NotebookLMAuthError('Failed to extract auth token. The page may still be loading.');
  }
  
  // COMMENTED OUT: Automatic cookie extraction
  // Extract cookies from browser context
  // if (debug) {
  //   console.log('Extracting cookies...');
  // }
  // 
  // const cookies = await page.context().cookies();
  // const cookieString = cookies
  //   .map(cookie => `${cookie.name}=${cookie.value}`)
  //   .join('; ');
  // 
  // if (!cookieString || cookieString.length < 100) {
  //   throw new NotebookLMAuthError('Failed to extract cookies - cookie string too short or empty');
  // }
  
  // Return only auth token - cookies will be entered manually
  return {
    authToken,
    cookies: '', // Will be filled manually
  };
}

/**
 * Prompt for cookies input from terminal
 */
function promptForCookies(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n📋 Please copy cookies from your browser:');
    console.log('   1. Open DevTools (F12) in the browser');
    console.log('   2. Go to Network tab');
    console.log('   3. Click on any request to notebooklm.google.com');
    console.log('   4. Copy the "Cookie" header value');
    console.log('   5. Paste it below\n');
    
    rl.question('Enter cookies: ', (cookies: string) => {
      rl.close();
      resolve(cookies.trim());
    });
  });
}

/**
 * Auto-login and extract credentials using Playwright
 */
export async function autoLogin(config: AuthConfig = {}): Promise<Credentials> {
  const { email, password, headless = true, debug = false } = config;
  
  if (!email || !password) {
    throw new NotebookLMAuthError(
      'Email and password are required for auto-login. ' +
      'Provide them via environment variables (GOOGLE_EMAIL, GOOGLE_PASSWORD) or config.'
    );
  }
  
  let browser: Browser | undefined;
  
  try {
    // Launch browser
    browser = await chromium.launch({ headless });
    
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Authenticate with Google
    await authenticateWithGoogle(page, email, password, debug);
    
    // Extract auth token from NotebookLM
    const partialCredentials = await extractCredentials(page, debug);
    
    // Prompt for cookies manually
    const cookies = await promptForCookies();
    
    if (!cookies || cookies.length < 100) {
      throw new NotebookLMAuthError('Invalid cookies - cookie string too short or empty');
    }
    
    const credentials: Credentials = {
      authToken: partialCredentials.authToken,
      cookies: cookies,
    };
    
    // Save credentials for future use
    await saveCredentials(credentials);
    
    return credentials;
  } catch (error) {
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get credentials from various sources
 * Priority: 1. Provided credentials 2. Environment variables 3. Saved credentials 4. Auto-login
 */
export async function getCredentials(
  providedCredentials?: Partial<Credentials>,
  config: AuthConfig = {}
): Promise<Credentials> {
  // 1. Use provided credentials if complete
  if (providedCredentials?.authToken && providedCredentials?.cookies) {
    return providedCredentials as Credentials;
  }
  
  // 2. Try environment variables
  const envAuthToken = process.env.NOTEBOOKLM_AUTH_TOKEN;
  const envCookies = process.env.NOTEBOOKLM_COOKIES;
  
  if (envAuthToken && envCookies) {
    return {
      authToken: envAuthToken,
      cookies: envCookies,
    };
  }
  
  // 3. Try saved credentials first (before auto-login)
  // This allows saved credentials to be reused without re-authenticating
  // Skip if FORCE_REAUTH=true is set
  if (process.env.FORCE_REAUTH !== 'true') {
  const savedCredentials = await loadCredentials();
    if (savedCredentials && savedCredentials.authToken && savedCredentials.cookies) {
    return savedCredentials;
    }
  }
  
  // 4. Try auto-login if email/password available (only if no saved credentials)
  const email = config.email || process.env.GOOGLE_EMAIL;
  const password = config.password || process.env.GOOGLE_PASSWORD;
  
  if (email && password) {
    return await autoLogin({ ...config, email, password });
  }
  
  throw new NotebookLMAuthError(
    'No credentials available. Provide credentials via:\n' +
    '  - Config: { authToken, cookies }\n' +
    '  - Environment: NOTEBOOKLM_AUTH_TOKEN, NOTEBOOKLM_COOKIES\n' +
    '  - Saved credentials: credentials.json in project root\n' +
    '  - Auto-login: GOOGLE_EMAIL, GOOGLE_PASSWORD (no 2FA)'
  );
}

