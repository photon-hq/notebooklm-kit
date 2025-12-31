import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NotebookLMClient } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Create and initialize SDK with auto-login
 * Uses auto-login by default (GOOGLE_EMAIL, GOOGLE_PASSWORD from env)
 * Falls back to manual credentials if provided (NOTEBOOKLM_AUTH_TOKEN, NOTEBOOKLM_COOKIES)
 */
export function createSDK(): NotebookLMClient {
  const googleEmail = process.env.GOOGLE_EMAIL;
  const googlePassword = process.env.GOOGLE_PASSWORD;
  const authToken = process.env.NOTEBOOKLM_AUTH_TOKEN;
  const cookies = process.env.NOTEBOOKLM_COOKIES;

  // Prefer auto-login if email/password are provided
  if (googleEmail && googlePassword) {
    return new NotebookLMClient({
      auth: {
        email: googleEmail,
        password: googlePassword,
        headless: true, // Run in headless mode for examples
      },
      autoRefresh: true,
      // Quota enforcement disabled by default
      enforceQuotas: false,
    });
  }

  // Fallback to manual credentials
  if (authToken && cookies) {
    return new NotebookLMClient({
      authToken,
      cookies,
      autoRefresh: true,
      // Quota enforcement disabled by default
      enforceQuotas: false,
    });
  }

  // No credentials provided
  throw new Error(
    'Authentication required. Provide either:\n' +
    '  - GOOGLE_EMAIL and GOOGLE_PASSWORD (for auto-login)\n' +
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

