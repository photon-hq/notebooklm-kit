import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NotebookLMClient } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

export function createSDK(): NotebookLMClient {
  const authToken = process.env.NOTEBOOKLM_AUTH_TOKEN;
  const cookies = process.env.NOTEBOOKLM_COOKIES;

  if (!authToken || !cookies) {
    throw new Error('NOTEBOOKLM_AUTH_TOKEN and NOTEBOOKLM_COOKIES must be set in .env file');
  }

  return new NotebookLMClient({
    authToken,
    cookies,
    autoRefresh: true,
  });
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

