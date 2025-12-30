/**
 * Slides service
 * Handles slide deck operations and interactive slide downloads
 * 
 * ## Implementation Method
 * 
 * **Download Process:**
 * 1. Get slide artifact from artifacts list
 * 2. Extract PDF download URL from artifact data (contribution.usercontent.google.com/download)
 * 3. Download PDF file from the URL
 * 
 * **Based on:** `rpc/mm31.txt` - Slide deck download RPC calls
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { NotebookLMError } from '../types/common.js';
import { ArtifactsService } from './artifacts.js';
import { ArtifactType } from '../types/artifact.js';
import * as https from 'https';
import * as http from 'http';

/**
 * Download slide deck file by artifact ID
 * 
 * **What it does:** Downloads the complete slide deck PDF file from NotebookLM.
 * This function retrieves the slide artifact, extracts the PDF download URL,
 * and downloads the PDF file.
 * 
 * **Input:**
 * - `rpc` (RPCClient, required): The RPC client instance.
 * - `slideId` (string, required): The ID of the slide artifact to download.
 *   This is the artifactId from `artifacts.list()` or `artifacts.create()`.
 * - `notebookId` (string, required): The notebook ID that contains the slide.
 *   Required to find the slide artifact and get the download URL.
 * 
 * **Output:** Returns an object containing:
 * - `slidesData`: Uint8Array containing the PDF file data
 * - `pdfUrl`: The PDF download URL from which the slides were downloaded
 * - `saveToFile`: An async helper function to save the PDF data to a specified file path.
 * 
 * **Usage Workflow:**
 * 1. Create a slide deck artifact using `client.artifacts.create(notebookId, ArtifactType.SLIDE_DECK, {...})`
 * 2. Poll the slide state using `client.artifacts.get(slideId)` until `state === ArtifactState.READY`
 * 3. Call this function to download the slide deck PDF file
 * 4. Use the `saveToFile` helper to save the PDF to a local file
 * 
 * **Note:**
 * - The slide deck must be in `READY` state before downloading (check with `artifacts.get()`)
 * - The PDF URL is extracted from the artifact data
 * 
 * **Error Handling:**
 * - Throws `NotebookLMError` if the slide ID is missing.
 * - Throws `NotebookLMError` if the slide artifact is not found.
 * - Throws `NotebookLMError` if the API call fails or no PDF URL is found.
 * - Throws `NotebookLMError` if the download fails.
 * 
 * @param rpc - The RPC client instance
 * @param slideId - The slide artifact ID
 * @param notebookId - The notebook ID that contains the slide
 * @returns Promise resolving to an object with slidesData, pdfUrl, and saveToFile helper
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, downloadSlidesFile, ArtifactType, ArtifactState } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Step 1: Create slide deck
 * const slide = await client.artifacts.create('notebook-id', ArtifactType.SLIDE_DECK, {
 *   instructions: 'Create a presentation about...',
 * });
 * 
 * // Step 2: Wait until ready (poll if needed)
 * let slideArtifact = await client.artifacts.get(slide.artifactId);
 * while (slideArtifact.state !== ArtifactState.READY) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   slideArtifact = await client.artifacts.get(slide.artifactId);
 * }
 * 
 * // Step 3: Download slide deck PDF
 * const rpc = client.getRPCClient();
 * const slidesDownload = await downloadSlidesFile(
 *   rpc,
 *   slide.artifactId,
 *   'notebook-id'
 * );
 * 
 * // Step 4: Save to file
 * await slidesDownload.saveToFile('slides.pdf');
 * console.log('Slides saved successfully!');
 * ```
 */
/**
 * Options for downloading slides
 */
export interface DownloadSlidesOptions {
  /**
   * Additional cookies from .google.com domain
   * These will be automatically merged with the main cookies
   * Required for contribution.usercontent.google.com downloads
   */
  googleDomainCookies?: string;
}

export async function downloadSlidesFile(
  rpc: RPCClient,
  slideId: string,
  notebookId: string,
  options: DownloadSlidesOptions = {}
): Promise<{
  slidesData: Uint8Array;
  pdfUrl: string;
  saveToFile: (path: string) => Promise<void>;
}> {
  if (!slideId) {
    throw new NotebookLMError('Slide ID is required');
  }
  
  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  try {
    // Get slide artifact from artifacts list
    const artifactsService = new ArtifactsService(rpc);
    const artifacts = await artifactsService.list(notebookId);
    const slideArtifact = artifacts.find(a => 
      a.artifactId === slideId &&
      a.type === ArtifactType.SLIDE_DECK
    );
    
    if (!slideArtifact) {
      throw new NotebookLMError(
        `No slide deck found for slide ID ${slideId}. Make sure the slide deck exists in the notebook.`
      );
    }
    
    // Get raw RPC response for artifacts list - PDF URL is embedded in this response
    // RPC_GET_ARTIFACT (BnLyuf) fails with 400 for slide decks, so we use the list response
    let pdfUrl: string | null = null;
    
    try {
      // Get the raw list response - this contains the PDF URL
      const artifactsListResponse = await rpc.call(
        RPC.RPC_LIST_ARTIFACTS,
        [[2], notebookId],
        notebookId
      );
      
      // Extract PDF URL from the raw list response
      pdfUrl = extractPdfUrl(artifactsListResponse);
      
      // If not found, try searching specifically in the slide deck entry
      if (!pdfUrl && Array.isArray(artifactsListResponse)) {
        // Find the slide deck entry in the response
        // Structure: [[[artifactId, title, type, sources, state, ...], ...]]
        for (const artifactEntry of artifactsListResponse) {
          if (Array.isArray(artifactEntry) && artifactEntry.length > 0) {
            const artifactId = artifactEntry[0];
            if (artifactId === slideId) {
              // This is our slide deck - search within it
              pdfUrl = extractPdfUrl(artifactEntry);
              if (pdfUrl) break;
            }
          }
        }
      }
    } catch (error) {
      // Continue to try other methods
    }
    
    // Fallback: try to get artifact details (may fail, but worth trying)
    if (!pdfUrl) {
      try {
        const artifactDetails = await artifactsService.get(slideId, notebookId);
        pdfUrl = extractPdfUrl(artifactDetails);
      } catch (error) {
        // RPC_GET_ARTIFACT fails for slide decks, this is expected
      }
    }
    
    if (!pdfUrl) {
      throw new NotebookLMError(
        `No PDF download URL found for slide ID ${slideId}. The slide deck may not be ready yet. ` +
        `Please check that the slide deck is in READY state.`
      );
    }
    
    // Normalize the URL: decode unicode escapes (\u003d -> =, \u0026 -> &) and add authuser=0
    pdfUrl = normalizePdfUrl(pdfUrl);
    
    // Log the PDF URL for visibility - display prominently in terminal
    console.log('\n' + '═'.repeat(80));
    console.log('📄 PDF Download URL');
    console.log('═'.repeat(80));
    console.log(pdfUrl);
    console.log('═'.repeat(80) + '\n');
    
    // Get cookies for download
    const rpcCookies = rpc.getCookies();
    
    // Merge cookies if googleDomainCookies provided (similar to video downloads)
    let finalCookies = rpcCookies;
    if (options.googleDomainCookies) {
      const cookieMap = new Map<string, string>();
      
      // Add google.com cookies first (lower priority)
      if (options.googleDomainCookies) {
        options.googleDomainCookies.split(';').forEach(c => {
          const [name, ...valueParts] = c.trim().split('=');
          if (name && valueParts.length > 0) {
            cookieMap.set(name, valueParts.join('='));
          }
        });
      }
      
      // Add notebooklm cookies (higher priority - override)
      if (rpcCookies) {
        rpcCookies.split(';').forEach(c => {
          const [name, ...valueParts] = c.trim().split('=');
          if (name && valueParts.length > 0) {
            cookieMap.set(name, valueParts.join('='));
          }
        });
      }
      
      finalCookies = Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }
    
    if (!finalCookies || !finalCookies.trim()) {
      throw new NotebookLMError(
        'Cookies are required for downloading PDF. ' +
        'Please ensure the RPC client has cookies configured or provide googleDomainCookies in options.'
      );
    }
    
    // Download the PDF file from the URL
    const slidesData = await downloadPdfFromUrl(pdfUrl, finalCookies);

    // Return result with saveToFile helper
    return {
      slidesData,
      pdfUrl,
      saveToFile: async (path: string) => {
        // Try Node.js environment
        try {
          const fsModule: any = await import('fs/promises' as any).catch(() => null);
          
          if (fsModule?.writeFile) {
            await fsModule.writeFile(path, slidesData);
            return;
          }
        } catch {
          // Fall through to browser
        }
        
        // Browser environment - create download link
        if (typeof Blob !== 'undefined') {
          // Convert Uint8Array to ArrayBuffer for Blob compatibility
          const buffer = new ArrayBuffer(slidesData.length);
          const view = new Uint8Array(buffer);
          view.set(slidesData);
          const blob = new Blob([buffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = path;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          throw new NotebookLMError('Cannot save file: unsupported environment');
        }
      },
    };
  } catch (error: any) {
    throw new NotebookLMError(
      `Failed to download slide deck file for slide ID ${slideId}: ${error.message}`
    );
  }
}

/**
 * Normalize PDF URL by decoding escape sequences and adding authuser parameter
 * 
 * @param url - The raw PDF URL (may contain escapes like \u003d, \u0026, \=, or \&)
 * @returns Normalized URL with proper = and & characters, and authuser=0 if missing
 */
function normalizePdfUrl(url: string): string {
  if (!url) {
    return url;
  }
  
  // Decode unicode escape sequences
  // \u003d = =
  // \u0026 = &
  let normalized = url
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&');
  
  // Decode backslash escape sequences
  // \= = =
  // \& = &
  normalized = normalized
    .replace(/\\=/g, '=')
    .replace(/\\&/g, '&');
  
  // Add &authuser=0 if not already present
  if (!normalized.includes('authuser=')) {
    // Check if URL already has query parameters
    if (normalized.includes('?')) {
      normalized += '&authuser=0';
    } else {
      normalized += '?authuser=0';
    }
  }
  
  return normalized;
}

/**
 * Extract PDF download URL from artifact data
 * 
 * @param artifact - The artifact object
 * @returns PDF download URL or null if not found
 */
function extractPdfUrl(artifact: any): string | null {
  if (!artifact) {
    return null;
  }
  
  // Convert to string first to search for URL patterns
  const artifactString = JSON.stringify(artifact);
  
  // Look for contribution.usercontent.google.com/download URL pattern
  // Pattern: https://contribution.usercontent.google.com/download?c=...&filename=...pdf
  const urlPattern = /https?:\/\/contribution\.usercontent\.google\.com\/download[^\s"',\]\}]+/g;
  const matches = artifactString.match(urlPattern);
  
  if (matches && matches.length > 0) {
    // Return the first match (should be the PDF URL)
    return matches[0];
  }
  
  // Also try recursive search for nested structures
  const searchForPdfUrl = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if string contains PDF URL pattern
      if (obj.includes('contribution.usercontent.google.com/download')) {
        // Extract full URL if it's embedded in a string
        const urlMatch = obj.match(/https?:\/\/[^\s"',\]\}]+contribution\.usercontent\.google\.com\/download[^\s"',\]\}]+/);
        if (urlMatch) {
          return urlMatch[0];
        }
        // If the string itself is the URL
        if (obj.startsWith('http://') || obj.startsWith('https://')) {
          return obj;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForPdfUrl(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      // Check object properties - prioritize certain keys
      const priorityKeys = ['url', 'downloadUrl', 'pdfUrl', 'fileUrl', 'download', 'pdf', 'file'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const found = searchForPdfUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      
      // Check all properties
      for (const key in obj) {
        if (key.toLowerCase().includes('url') || 
            key.toLowerCase().includes('download') ||
            key.toLowerCase().includes('pdf') ||
            key.toLowerCase().includes('file')) {
          const found = searchForPdfUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      
      // Also search all values
      for (const value of Object.values(obj)) {
        const found = searchForPdfUrl(value, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return searchForPdfUrl(artifact);
}

/**
 * Download PDF file from URL
 * 
 * @param url - PDF download URL
 * @param cookies - Authentication cookies
 * @returns Promise resolving to PDF data as Uint8Array
 */
function downloadPdfFromUrl(
  url: string,
  cookies: string
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    // Build headers similar to video download - contribution.usercontent.google.com requires proper auth
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Cookie': cookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity', // Don't use compression for binary data
        'Referer': 'https://notebooklm.google.com/',
        'Origin': 'https://notebooklm.google.com',
        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
      },
    };
    
    const req = httpModule.request(options, (res) => {
      // Check for redirects first
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const location = res.headers.location;
        // Handle relative redirects
        const redirectUrl = location.startsWith('http') 
          ? location 
          : `${urlObj.protocol}//${urlObj.hostname}${location}`;
        // Follow redirect
        return downloadPdfFromUrl(redirectUrl, cookies)
          .then(resolve)
          .catch(reject);
      }
      
      // Handle error status codes
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        // Handle redirects first
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const location = res.headers.location;
          const redirectUrl = location.startsWith('http') 
            ? location 
            : `${urlObj.protocol}//${urlObj.hostname}${location}`;
          return downloadPdfFromUrl(redirectUrl, cookies)
            .then(resolve)
            .catch(reject);
        }
        
        // For 400/401/403 errors, read response to diagnose
        if (res.statusCode === 400 || res.statusCode === 401 || res.statusCode === 403) {
          const errorChunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            errorChunks.push(chunk);
          });
          res.on('end', () => {
            const responseBuffer = Buffer.concat(errorChunks);
            const responseText = responseBuffer.toString('utf-8');
            const responseLength = responseBuffer.length;
            
            // Check response headers for clues
            const contentType = res.headers['content-type'] || '';
            const location = res.headers.location || '';
            
            if (location) {
              // Redirect to sign-in page
              reject(new NotebookLMError(
                `Authentication required. The PDF download URL requires valid Google authentication cookies. ` +
                `HTTP ${res.statusCode}. Redirected to: ${location}`
              ));
            } else if (responseText.includes('Sign in') || responseText.includes('accounts.google.com') || responseText.includes('<html')) {
              reject(new NotebookLMError(
                `Authentication required. The PDF download URL requires valid Google authentication cookies. ` +
                `HTTP ${res.statusCode}. Response indicates sign-in required. ` +
                `Content-Type: ${contentType}, Response length: ${responseLength} bytes`
              ));
            } else if (responseLength === 0) {
              reject(new NotebookLMError(
                `Failed to download PDF: HTTP ${res.statusCode}. Empty response body. ` +
                `This may indicate an authentication issue. ` +
                `URL: ${url.substring(0, 150)}`
              ));
            } else {
              // Show response preview (first 500 chars)
              const preview = responseText.substring(0, 500);
              reject(new NotebookLMError(
                `Failed to download PDF: HTTP ${res.statusCode}. ` +
                `Content-Type: ${contentType}, Response length: ${responseLength} bytes. ` +
                `Response preview: ${preview}${responseText.length > 500 ? '...' : ''}`
              ));
            }
          });
          res.on('error', (err: Error) => {
            reject(new NotebookLMError(`Error reading error response: ${err.message}`));
          });
          return;
        }
        
        reject(new NotebookLMError(`Failed to download PDF: HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const pdfData = Buffer.concat(chunks);
        
        // Check if we got HTML instead of PDF (likely a redirect to sign-in)
        if (pdfData.length > 0 && pdfData[0] !== 0x25) { // PDF starts with %PDF (0x25 = %)
          const text = pdfData.toString('utf-8', 0, Math.min(500, pdfData.length));
          if (text.includes('Sign in') || text.includes('accounts.google.com') || text.includes('<html')) {
            reject(new NotebookLMError(
              `Authentication required. The PDF download URL requires valid Google authentication cookies. ` +
              `Received HTML sign-in page instead of PDF.`
            ));
            return;
          }
        }
        
        resolve(new Uint8Array(pdfData));
      });
      
      res.on('error', (error: Error) => {
        reject(new NotebookLMError(`Error downloading PDF: ${error.message}`));
      });
    });
    
    req.on('error', (error: Error) => {
      reject(new NotebookLMError(`Request error: ${error.message}`));
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new NotebookLMError('PDF download request timed out'));
    });
    
    req.end();
  });
}

