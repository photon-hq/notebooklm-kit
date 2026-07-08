import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { NotebookLMClient } from '../src/index.js';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
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
const DEFAULT_OPENCLAW_CREDS_PATH = join(homedir(), '.openclaw', 'secrets', 'notebooklm-creds.json');
const DEFAULT_PLAYWRIGHT_PROFILE_DIR = join(homedir(), '.openclaw', 'playwright', 'notebooklm-profile');
const DEFAULT_NOTEBOOKLM_LOGIN_URL = 'https://notebooklm.google.com/';
const DEFAULT_GOOGLE_COOKIE_DOMAIN = 'google.com';

type SameSitePolicy = 'Strict' | 'Lax' | 'None';

interface PlaywrightCookieParam {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSitePolicy;
}

interface OpenClawNotebookLMCreds {
  cookies?: string;
  cookieCount?: number;
  playwrightCookies?: PlaywrightCookieParam[];
  [key: string]: unknown;
}

export interface NotebookLMBrowserSession {
  context: BrowserContext;
  page: Page;
  loginResolution: 'persistent-session' | 'saved-cookies' | 'manual-login';
  credsPath: string;
}

function parseBooleanEnv(raw: string | undefined): boolean | undefined {
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function isSshSession(): boolean {
  return Boolean(
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.SSH_TTY
  );
}

function resolveHeadlessMode(defaultValue: boolean): boolean {
  const explicit = parseBooleanEnv(process.env.NOTEBOOKLM_HEADLESS);
  if (explicit !== undefined) {
    return explicit;
  }
  // SSH sessions commonly have no WindowServer/GUI access.
  if (isSshSession()) {
    return true;
  }
  return defaultValue;
}

export function resolveDevAuthUser(): string {
  const rawAuthUser = process.env.NOTEBOOKLM_DEV_AUTHUSER?.trim();
  if (!rawAuthUser) {
    return '0';
  }

  if (/^\d+$/.test(rawAuthUser)) {
    return rawAuthUser;
  }

  console.warn(
    `[notebooklm-kit] Invalid NOTEBOOKLM_DEV_AUTHUSER="${rawAuthUser}". Falling back to "0".`
  );
  return '0';
}

function getOpenClawCredsPath(explicitPath?: string): string {
  const envPath = process.env.OPENCLAW_NOTEBOOKLM_CREDS_PATH?.trim();
  if (explicitPath?.trim()) {
    return explicitPath.trim();
  }
  if (envPath) {
    return envPath;
  }
  return DEFAULT_OPENCLAW_CREDS_PATH;
}

async function readOpenClawCreds(explicitPath?: string): Promise<{ path: string; data: OpenClawNotebookLMCreds }> {
  const targetPath = getOpenClawCredsPath(explicitPath);
  try {
    const existingText = await readFile(targetPath, 'utf-8');
    const parsed = JSON.parse(existingText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Credentials file must contain a JSON object at ${targetPath}`);
    }
    return {
      path: targetPath,
      data: parsed as OpenClawNotebookLMCreds,
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {
        path: targetPath,
        data: {},
      };
    }
    throw new Error(`Failed to read credentials file at ${targetPath}: ${error?.message || String(error)}`);
  }
}

function domainMatchesHost(domain: string | undefined, host: string): boolean {
  if (!domain) {
    return true;
  }
  const normalizedDomain = normalizeCookieDomain(domain).toLowerCase();
  const normalizedHost = host.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function cookiePriority(cookie: { domain?: string; path?: string; expires?: number }, host: string, index: number): number {
  const domain = normalizeCookieDomain(cookie.domain || host).toLowerCase();
  const normalizedHost = host.toLowerCase();
  const domainScore = domain === normalizedHost ? 10000 : domain.length;
  const pathScore = (cookie.path || '/').length;
  const expiryScore = typeof cookie.expires === 'number' && cookie.expires > 0 ? Math.min(cookie.expires, 9999999999) / 10000000000 : 0;
  return domainScore + pathScore / 1000 + expiryScore / 10000 + index / 100000000;
}

export function cookieStringFromCookies(
  cookies: Array<{ name: string; value: string; domain?: string; path?: string; expires?: number }>,
  targetUrl: string = DEFAULT_NOTEBOOKLM_LOGIN_URL
): string {
  const targetHost = new URL(targetUrl).hostname;
  const selected = new Map<string, { cookie: { name: string; value: string; domain?: string; path?: string; expires?: number }; priority: number }>();

  cookies.forEach((cookie, index) => {
    if (!cookie.name || cookie.name.includes('\uFFFD') || cookie.value.includes('\uFFFD')) {
      return;
    }
    if (!domainMatchesHost(cookie.domain, targetHost)) {
      return;
    }

    const priority = cookiePriority(cookie, targetHost, index);
    const current = selected.get(cookie.name);
    if (!current || priority > current.priority) {
      selected.set(cookie.name, { cookie, priority });
    }
  });

  return [...selected.values()]
    .map(({ cookie }) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function normalizeSameSite(value: unknown): SameSitePolicy | undefined {
  if (value === 'Strict' || value === 'Lax' || value === 'None') {
    return value;
  }
  return undefined;
}

function normalizeCookieDomain(domain: string): string {
  return domain.trim().replace(/^\./, '');
}

function sanitizeCookieParam(raw: unknown): PlaywrightCookieParam | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const value = typeof candidate.value === 'string' ? candidate.value : '';
  if (!name) {
    return null;
  }

  const sanitized: PlaywrightCookieParam = {
    name,
    value,
    secure: typeof candidate.secure === 'boolean' ? candidate.secure : true,
    httpOnly: typeof candidate.httpOnly === 'boolean' ? candidate.httpOnly : false,
  };

  if (typeof candidate.expires === 'number') {
    sanitized.expires = candidate.expires;
  }
  const sameSite = normalizeSameSite(candidate.sameSite);
  if (sameSite) {
    sanitized.sameSite = sameSite;
  }

  if (typeof candidate.url === 'string' && candidate.url.startsWith('http')) {
    sanitized.url = candidate.url;
    return sanitized;
  }

  if (typeof candidate.domain === 'string' && candidate.domain.trim()) {
    sanitized.domain = normalizeCookieDomain(candidate.domain);
    sanitized.path = typeof candidate.path === 'string' && candidate.path.trim() ? candidate.path : '/';
    return sanitized;
  }

  Object.assign(sanitized, notebookLMCookieScope(name));
  return sanitized;
}

function notebookLMCookieScope(name: string): Pick<PlaywrightCookieParam, 'url' | 'domain' | 'path'> {
  if (name.startsWith('__Host-')) {
    return { url: DEFAULT_NOTEBOOKLM_LOGIN_URL };
  }
  return { domain: DEFAULT_GOOGLE_COOKIE_DOMAIN, path: '/' };
}

function normalizeCookieParamForAddCookies(cookie: PlaywrightCookieParam): PlaywrightCookieParam | null {
  if (cookie.name.includes('\uFFFD') || cookie.value.includes('\uFFFD')) {
    return null;
  }

  if (cookie.name.startsWith('__Host-')) {
    const { domain: _domain, path: _path, ...urlCookie } = cookie;
    return { ...urlCookie, url: cookie.url || DEFAULT_NOTEBOOKLM_LOGIN_URL };
  }

  const normalized: PlaywrightCookieParam = { ...cookie };

  if (normalized.url) {
    const { domain: _domain, path: _path, ...urlCookie } = normalized;
    return urlCookie;
  }

  if (normalized.domain) {
    normalized.domain = normalizeCookieDomain(normalized.domain);
    normalized.path = normalized.path || '/';
  } else {
    Object.assign(normalized, notebookLMCookieScope(normalized.name));
  }

  return normalized;
}

export function parseSavedCookieStringForAddCookies(cookieString: string): PlaywrightCookieParam[] {
  return cookieString
    .split(';')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        return null;
      }
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name) {
        return null;
      }
      return sanitizeCookieParam({
        name,
        value,
        ...notebookLMCookieScope(name),
      });
    })
    .map(cookie => cookie ? normalizeCookieParamForAddCookies(cookie) : null)
    .filter((cookie): cookie is PlaywrightCookieParam => cookie !== null);
}

function parseCookieStringToCookieParams(cookieString: string): PlaywrightCookieParam[] {
  return parseSavedCookieStringForAddCookies(cookieString);
}

function extractCookieParamsFromCreds(data: OpenClawNotebookLMCreds): PlaywrightCookieParam[] {
  if (Array.isArray(data.playwrightCookies) && data.playwrightCookies.length > 0) {
    const sanitized = data.playwrightCookies
      .map(cookie => sanitizeCookieParam(cookie))
      .filter((cookie): cookie is PlaywrightCookieParam => cookie !== null);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  if (typeof data.cookies === 'string' && data.cookies.trim()) {
    return parseCookieStringToCookieParams(data.cookies);
  }

  return [];
}

async function writeCookiesToOpenClawSecrets(
  cookies: string,
  playwrightCookies: PlaywrightCookieParam[],
  explicitPath?: string
): Promise<string> {
  const { path: targetPath, data: currentData } = await readOpenClawCreds(explicitPath);
  const updatedData: OpenClawNotebookLMCreds = {
    ...currentData,
    cookies,
    cookieCount: cookies.split(';').map(pair => pair.trim()).filter(Boolean).length,
    playwrightCookies,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(updatedData, null, 2)}\n`, 'utf-8');
  return targetPath;
}

function isGoogleLoginUrl(url: string): boolean {
  return url.includes('accounts.google.com') || url.includes('ServiceLogin');
}

async function isNotebookLMAuthenticated(page: Page, loginUrl: string): Promise<boolean> {
  await page.goto(loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(1200);

  const currentUrl = page.url();
  if (isGoogleLoginUrl(currentUrl)) {
    return false;
  }

  const hasAuthToken = await page.evaluate(() => {
    const wizData = (window as any)?.WIZ_global_data;
    const token = wizData?.SNlM0e;
    return typeof token === 'string' && token.length > 10;
  }).catch(() => false);
  if (hasAuthToken) {
    return true;
  }

  const hasGoogleSignInLink = await page
    .locator('a[href*="accounts.google.com"]')
    .first()
    .isVisible()
    .catch(() => false);

  return !hasGoogleSignInLink;
}

async function applySavedCookiesIfAvailable(
  context: BrowserContext,
  explicitPath?: string
): Promise<{ applied: boolean; count: number; path: string }> {
  const { path: credsPath, data } = await readOpenClawCreds(explicitPath);
  const cookieParams = extractCookieParamsFromCreds(data);
  const cookiesForContext = cookieParams
    .map(cookie => normalizeCookieParamForAddCookies(cookie))
    .filter((cookie): cookie is PlaywrightCookieParam => cookie !== null);
  if (cookiesForContext.length === 0) {
    return { applied: false, count: 0, path: credsPath };
  }

  await context.addCookies(cookiesForContext);
  return { applied: true, count: cookiesForContext.length, path: credsPath };
}

async function persistContextCookies(
  context: BrowserContext,
  explicitPath?: string
): Promise<{ path: string; cookiesLength: number }> {
  const cookies = await context.cookies();
  const cookieString = cookieStringFromCookies(cookies);
  if (!cookieString || cookieString.length < 100) {
    throw new Error('Cookie capture failed: cookie string is empty or too short.');
  }

  const serializedCookies = cookies
    .map(cookie => sanitizeCookieParam(cookie))
    .filter((cookie): cookie is PlaywrightCookieParam => cookie !== null);
  const filePath = await writeCookiesToOpenClawSecrets(cookieString, serializedCookies, explicitPath);
  return {
    path: filePath,
    cookiesLength: cookieString.length,
  };
}

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
      viewport: { width: 1920, height: 1080 }
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

export async function createAuthenticatedNotebookLMBrowserSession(options?: {
  credsPath?: string;
  loginUrl?: string;
  userDataDir?: string;
  headless?: boolean;
}): Promise<NotebookLMBrowserSession> {
  const loginUrl = options?.loginUrl || DEFAULT_NOTEBOOKLM_LOGIN_URL;
  const userDataDir =
    options?.userDataDir?.trim() ||
    process.env.NOTEBOOKLM_PLAYWRIGHT_PROFILE_DIR?.trim() ||
    DEFAULT_PLAYWRIGHT_PROFILE_DIR;
  const resolvedHeadless = resolveHeadlessMode(options?.headless ?? false);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: resolvedHeadless,
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    let loginResolution: NotebookLMBrowserSession['loginResolution'] = 'manual-login';
    let credsPath = getOpenClawCredsPath(options?.credsPath);

    if (await isNotebookLMAuthenticated(page, loginUrl)) {
      loginResolution = 'persistent-session';
    } else {
      const restored = await applySavedCookiesIfAvailable(context, options?.credsPath);
      credsPath = restored.path;

      if (restored.applied) {
        console.log(`Loaded ${restored.count} saved cookie(s) from ${restored.path}`);
      }

      if (restored.applied && await isNotebookLMAuthenticated(page, loginUrl)) {
        loginResolution = 'saved-cookies';
      } else {
        if (resolvedHeadless) {
          throw new Error(
            'NotebookLM authentication requires interactive login, but headless mode is enabled. ' +
            'Over SSH, run once on a GUI session to persist cookies, or provide NOTEBOOKLM_AUTH_TOKEN/NOTEBOOKLM_COOKIES.'
          );
        }
        console.log('\nSaved cookies are missing or expired. Manual login is required.\n');
        await waitForEnter('Login is complete? Press Enter to continue: ');
        if (!await isNotebookLMAuthenticated(page, loginUrl)) {
          throw new Error('Manual login verification failed. Please complete NotebookLM login and try again.');
        }
        loginResolution = 'manual-login';
      }
    }

    const persisted = await persistContextCookies(context, options?.credsPath);
    credsPath = persisted.path;
    console.log(`Updated cookies at: ${credsPath}`);

    return {
      context,
      page,
      loginResolution,
      credsPath,
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function exportCookiesToOpenClawSecrets(options?: {
  credsPath?: string;
  loginUrl?: string;
  userDataDir?: string;
}): Promise<{ filePath: string; cookiesLength: number; loginResolution: NotebookLMBrowserSession['loginResolution'] }> {
  const resolvedHeadless = resolveHeadlessMode(false);
  if (resolvedHeadless) {
    console.log('\n🌐 Opening browser (headless mode) for NotebookLM session bootstrap...\n');
  } else {
    console.log('\n🌐 Opening browser (visible mode) for NotebookLM session bootstrap...\n');
  }

  const session = await createAuthenticatedNotebookLMBrowserSession({
    credsPath: options?.credsPath,
    loginUrl: options?.loginUrl,
    userDataDir: options?.userDataDir,
    headless: resolvedHeadless,
  });
  try {
    const cookies = await session.context.cookies();
    const cookieString = cookieStringFromCookies(cookies);

    return {
      filePath: session.credsPath,
      cookiesLength: cookieString.length,
      loginResolution: session.loginResolution,
    };
  } finally {
    await session.context.close();
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
  const authUser = resolveDevAuthUser();

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
      authUser,
      autoRefresh: true,
      enforceQuotas: false,
      debug: config?.debug,
    });
  }

  // Option 2: Auto-login with email/password (priority - opens visible browser)
  if (googleEmail && googlePassword) {
    const resolvedHeadless = resolveHeadlessMode(false);
    return new NotebookLMClient({
      auth: {
        email: googleEmail,
        password: googlePassword,
        headless: resolvedHeadless,
      },
      authUser,
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
      authUser,
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
