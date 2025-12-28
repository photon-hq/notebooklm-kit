/**
 * Infographic service
 * Handles infographic image fetching and downloading operations
 * 
 * ## Implementation Method
 * 
 * **Infographic Image URLs:**
 * Infographics are stored as images on Google's CDN. The image URLs are typically:
 * - `https://lh3.googleusercontent.com/notebooklm/...`
 * - `https://lh3.google.com/rd-notebooklm/...`
 * 
 * **Response Structure:**
 * The infographic artifact response contains the image URL embedded in the artifact data.
 * The URL is typically found in the artifact's `data` or `content` field.
 * 
 * **Parsing Strategy:**
 * 1. Get artifact using `artifacts.get(infographicId)`
 * 2. Extract image URL from artifact response data
 * 3. Download image from Google CDN URL
 * 4. Save as PNG image file
 * 
 * **URL Pattern:**
 * The infographic URLs follow patterns like:
 * - `https://lh3.googleusercontent.com/notebooklm/AG60hOqzjJ01WrAQYRQUs__QMV6EfUfC6ojJ2ZXGFJrTBdFLsiXvLpOR2KDshs8k06CQue5_j0XBhx9lm8TtrmFG9ulUGVLSwfIPz4UE-XXP2Hy75jbGsOmnQ4MVL0eZVll7Zk02MXrSsOJIKESoaP0xmLml4TJqrW0=w2752-d-h1536`
 * - `https://lh3.google.com/rd-notebooklm/AG60hOoh7CHZRhpJ0k_AZH_WRkkRznN13Q4mEMN7BalDIvrbquzbbz1g_rtklvL8r03s-JrzGC3n3-L6HBXnQWleZ73MeR8gjhTLCAGFL6FfiNMhbMZmSm_LnQRNfpEGzTJttJXaQZ1QvrZ2tcwokpd674Thr1zJcel58139SOh-HJATi_2X_HCuZRIlTq1eH5EBYx92t_cX5Y6B11h8UHVX7IdZt1p9bJSkrA8UTOEf3Bf0auta3YV0Z9BFPDVzS8ig1QerNGBhzZE2IDhhweVGS1EpvlG4t8Jl1Yt_5gDYFSGHAQ=s0-w2752-h1536-d`
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { Artifact } from '../types/artifact.js';
import { NotebookLMError } from '../types/common.js';
import { createHash } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';

/**
 * Infographic image data with download information
 */
export interface InfographicImageData {
  /** 
   * The image URL from Google CDN
   * This is the direct URL to the infographic image
   */
  imageUrl: string;
  /** 
   * Image data as a Uint8Array (for Node.js) or ArrayBuffer (for browser)
   * Only populated if `downloadImage` option is true
   */
  imageData?: Uint8Array | ArrayBuffer;
  /** 
   * Image MIME type (typically 'image/png')
   */
  mimeType?: string;
  /** 
   * Image dimensions if available (from URL parameters)
   */
  width?: number;
  height?: number;
}

/**
 * Options for fetching infographic data
 */
export interface FetchInfographicOptions {
  /** 
   * Whether to download the image data (default: false)
   * If true, the image will be fetched and included in the response
   */
  downloadImage?: boolean;
  /** 
   * Authentication cookies for downloading the image (if required)
   * If not provided, the RPC client's cookies will be used
   */
  cookies?: string;
}

/**
 * Fetch infographic image URL and optionally download the image
 * 
 * **What it does:** Retrieves the infographic image URL from the artifact and optionally
 * downloads the actual image data. Infographics are stored as PNG images on Google's CDN.
 * 
 * **Input:**
 * - `infographicId` (string, required): The ID of the infographic artifact to fetch.
 *   You can obtain this ID from `artifacts.list()` or `artifacts.create()`.
 * - `notebookId` (string, optional): The notebook ID that contains the infographic.
 *   Providing this ensures the correct source-path is set for the RPC call.
 * - `options` (FetchInfographicOptions, optional): Configuration options:
 *   - `downloadImage` (boolean): Whether to download the image data (default: false)
 *   - `cookies` (string): Authentication cookies if needed for image download
 * 
 * **Output:** Returns `InfographicImageData` object containing:
 * - `imageUrl`: The direct URL to the infographic image on Google CDN
 * - `imageData`: Image data as Uint8Array/ArrayBuffer (if `downloadImage` is true)
 * - `mimeType`: Image MIME type (typically 'image/png')
 * - `width`, `height`: Image dimensions if available from URL
 * 
 * **Usage Workflow:**
 * 1. Create an infographic artifact using `artifacts.create(notebookId, ArtifactType.INFOGRAPHIC, {...})`
 * 2. Poll the artifact state using `artifacts.get(infographicId)` until `state === ArtifactState.READY`
 * 3. Call this function to get the image URL (and optionally download the image)
 * 4. Use the image URL directly or save the image data to a file
 * 
 * **Note:**
 * - The infographic must be in `READY` state before fetching (check with `artifacts.get()`)
 * - Attempting to fetch a infographic that's still `CREATING` may return incomplete or no data
 * - The image URL is a direct link to Google's CDN - you can use it directly in `<img>` tags
 * - Some image URLs may require authentication cookies for download
 * - Image URLs include size parameters (e.g., `=w2752-h1536`) that can be modified
 * 
 * **Error Handling:**
 * - Throws `NotebookLMError` if the infographic ID is missing
 * - Throws `NotebookLMError` if the API call fails
 * - Throws `NotebookLMError` if no image URL is found in the response
 * 
 * @param rpc - RPC client instance
 * @param infographicId - The infographic artifact ID
 * @param notebookId - Optional notebook ID (recommended for proper source-path)
 * @param options - Fetch options (downloadImage, cookies)
 * @returns Promise resolving to InfographicImageData
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, fetchInfographic } from 'notebooklm-kit';
 * import { ArtifactType, ArtifactState } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Step 1: Create infographic artifact
 * const infographic = await client.artifacts.create(
 *   'notebook-id',
 *   ArtifactType.INFOGRAPHIC,
 *   { title: 'My Infographic' }
 * );
 * 
 * // Step 2: Wait until ready (poll if needed)
 * let artifact = infographic;
 * while (artifact.state === ArtifactState.CREATING) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   artifact = await client.artifacts.get(infographic.artifactId);
 * }
 * 
 * // Step 3: Fetch infographic image URL
 * const rpc = client.getRPCClient();
 * const infographicData = await fetchInfographic(
 *   rpc,
 *   infographic.artifactId,
 *   'notebook-id'
 * );
 * 
 * console.log(`Infographic URL: ${infographicData.imageUrl}`);
 * 
 * // Step 4: Download the image
 * const infographicWithImage = await fetchInfographic(
 *   rpc,
 *   infographic.artifactId,
 *   'notebook-id',
 *   { downloadImage: true }
 * );
 * 
 * // Step 5: Save image to file (Node.js example)
 * import fs from 'fs';
 * fs.writeFileSync(
 *   'infographic.png',
 *   Buffer.from(infographicWithImage.imageData as Uint8Array)
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Simple usage - just get the URL
 * const rpc = client.getRPCClient();
 * const infographicData = await fetchInfographic(
 *   rpc,
 *   'infographic-id-123',
 *   'notebook-id-456'
 * );
 * 
 * // Use URL in HTML
 * console.log(`<img src="${infographicData.imageUrl}" alt="Infographic" />`);
 * 
 * // Or download and save
 * const withImage = await fetchInfographic(rpc, 'infographic-id-123', 'notebook-id-456', {
 *   downloadImage: true
 * });
 * 
 * // Save to file
 * if (withImage.imageData) {
 *   fs.writeFileSync('infographic.png', Buffer.from(withImage.imageData as Uint8Array));
 * }
 * ```
 */
export async function fetchInfographic(
  rpc: RPCClient,
  infographicId: string,
  notebookId?: string,
  options: FetchInfographicOptions = {}
): Promise<InfographicImageData> {
  if (!infographicId) {
    throw new NotebookLMError('Infographic ID is required');
  }

  let response: any;
  let imageUrl: string | null = null;

  try {
    // Try to get artifact details directly
    response = await rpc.call(
      RPC.RPC_GET_ARTIFACT,
      [infographicId],
      notebookId // Pass notebookId to set correct source-path
    );

    // Parse the response to extract image URL
    imageUrl = extractImageUrlFromResponse(response);
  } catch (error: any) {
    // RPC_GET_ARTIFACT returns 400 for infographics (similar to quizzes/flashcards)
    // Fall back to using list() to find the artifact
    const is400Error = error.message?.includes('400') || 
                      error.message?.includes('Bad Request') ||
                      (error instanceof NotebookLMError && error.message?.includes('400'));
    
    if (is400Error && notebookId) {
      // Fallback: Use list artifacts to find the infographic
      try {
        const listResponse = await rpc.call(
          RPC.RPC_LIST_ARTIFACTS,
          [[2], notebookId], // Filter: 2 = all artifacts
          notebookId
        );

        // Find the specific artifact in the list
        const artifact = findArtifactInListResponse(listResponse, infographicId);
        
        if (artifact) {
          // Extract image URL from the artifact data in list response
          imageUrl = extractImageUrlFromResponse(artifact);
        } else {
          throw new NotebookLMError(
            `Infographic ${infographicId} not found in list response`
          );
        }
      } catch (listError: any) {
        throw new NotebookLMError(
          `Failed to fetch infographic for ID ${infographicId}: RPC_GET_ARTIFACT failed (400) and list fallback also failed: ${listError.message}`,
          error
        );
      }
    } else {
      // Re-throw if it's not a 400 error or we don't have notebookId
      throw new NotebookLMError(
        `Failed to fetch infographic for ID ${infographicId}: ${error.message}`,
        error
      );
    }
  }

  if (!imageUrl) {
    throw new NotebookLMError(
      `No image URL found in infographic response for ID ${infographicId}`
    );
  }

  // Ensure URL has authuser parameter for authenticated access
  try {
    const urlObj = new URL(imageUrl);
    if (!urlObj.searchParams.has('authuser')) {
      urlObj.searchParams.set('authuser', '0');
      imageUrl = urlObj.toString();
    }
  } catch (urlError) {
    // If URL parsing fails, use original URL
    console.warn(`Warning: Could not parse image URL: ${imageUrl}`);
  }

  // Parse dimensions from URL if available
  const dimensions = parseDimensionsFromUrl(imageUrl);

  const result: InfographicImageData = {
    imageUrl,
    mimeType: 'image/png', // Infographics are typically PNG
    ...dimensions,
  };

  // Optionally download the image
  if (options.downloadImage) {
    console.log('\n🔐 Cookie Debug Info:');
    console.log('   Options cookies provided:', options.cookies ? 'Yes' : 'No');
    const rpcCookies = rpc.getCookies();
    console.log('   RPC client cookies available:', rpcCookies ? 'Yes' : 'No');
    if (rpcCookies) {
      console.log('   RPC cookies length:', rpcCookies.length);
      console.log('   RPC cookies preview:', rpcCookies.substring(0, 100) + '...');
    }
    
    const cookies = options.cookies || rpcCookies;
    console.log('   Final cookies to use:', cookies ? 'Yes' : 'No');
    if (cookies) {
      console.log('   Final cookies length:', cookies.length);
      console.log('   Has SAPISID:', cookies.includes('SAPISID=') ? 'Yes' : 'No');
    }
    
    if (!cookies || !cookies.trim()) {
      throw new NotebookLMError(
        'Cookies are required for downloading infographic images. ' +
        'Please provide cookies in the options or ensure the RPC client has cookies configured.'
      );
    }
    
    console.log('\n📥 Starting image download...');
    console.log('   Image URL:', imageUrl);
    const imageData = await downloadImageFromUrl(
      imageUrl,
      cookies
    );
    console.log('   ✅ Image downloaded successfully');
    console.log('   Image data size:', imageData instanceof ArrayBuffer 
      ? `${(imageData.byteLength / 1024).toFixed(2)} KB`
      : `${(imageData.length / 1024).toFixed(2)} KB`);
    result.imageData = imageData;
  }

  return result;
}

/**
 * Find artifact in list response by artifact ID
 * 
 * The list response structure is typically: [[artifact1, artifact2, ...]] or [[[...]]]
 * Each artifact is an array where the first element is the artifact ID
 * This follows the same parsing logic as ArtifactsService.parseListResponse()
 */
function findArtifactInListResponse(listResponse: any, artifactId: string): any | null {
  try {
    // Handle string response (JSON string that needs parsing)
    let data = listResponse;
    if (typeof listResponse === 'string') {
      try {
        data = JSON.parse(listResponse);
      } catch {
        // If parsing fails, try to handle as raw string
        data = listResponse;
      }
    }
    
    if (!Array.isArray(data)) {
      return null;
    }
    
    // Response might be nested: [[[...]]] or [[...]]
    // Keep unwrapping until we find an array where first element looks like an artifact
    let unwrappedData: any = data;
    
    // Keep unwrapping while we have nested arrays
    while (Array.isArray(unwrappedData) && unwrappedData.length > 0 && Array.isArray(unwrappedData[0])) {
      // Check if data[0][0] looks like an artifact (starts with string ID)
      // If the first element of the first nested array is a string (artifact ID), stop unwrapping
      const firstItem = unwrappedData[0];
      if (Array.isArray(firstItem) && firstItem.length > 0 && typeof firstItem[0] === 'string' && firstItem[0].length > 10) {
        // This looks like an artifact array, stop unwrapping
        break;
      }
      unwrappedData = unwrappedData[0];
    }
    
    // Now unwrappedData should be an array of artifacts: [[artifact1], [artifact2], ...] or [artifact1, artifact2, ...]
    const artifactArray: any[] = Array.isArray(unwrappedData) ? unwrappedData : [];
    
    // Search for the artifact with matching ID
    for (const item of artifactArray) {
      // Handle both cases: item is already an array [artifact_data] or item is nested [[artifact_data]]
      let artifactData = item;
      
      // If item is nested array, unwrap once more
      if (Array.isArray(item) && item.length > 0 && Array.isArray(item[0])) {
        artifactData = item[0];
      }
      
      // Check if this artifact matches the ID we're looking for
      if (Array.isArray(artifactData) && artifactData.length > 0 && artifactData[0] === artifactId) {
        return artifactData; // Found the artifact
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract image URL from artifact response
 * 
 * The image URL is typically found in the response data structure.
 * It matches patterns like:
 * - `https://lh3.googleusercontent.com/notebooklm/...`
 * - `https://lh3.google.com/rd-notebooklm/...`
 */
function extractImageUrlFromResponse(response: any): string | null {
  // Helper function to recursively search for image URLs
  function findImageUrl(obj: any, depth: number = 0): string | null {
    if (depth > 15) return null; // Prevent infinite recursion

    if (typeof obj === 'string') {
      // Check if this string is an image URL
      if (
        obj.includes('lh3.googleusercontent.com') ||
        obj.includes('lh3.google.com/rd-notebooklm')
      ) {
        // Verify it's a notebooklm infographic URL
        if (obj.includes('notebooklm') || obj.includes('rd-notebooklm')) {
          return obj;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const url = findImageUrl(item, depth + 1);
        if (url) return url;
      }
    } else if (obj && typeof obj === 'object') {
      // Check common property names
      const urlFields = ['imageUrl', 'url', 'image_url', 'src', 'data', 'content', 'image'];
      for (const field of urlFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const url = findImageUrl(obj[field], depth + 1);
          if (url) return url;
        }
      }
      
      // Recursively search object properties
      for (const key in obj) {
        const url = findImageUrl(obj[key], depth + 1);
        if (url) return url;
      }
    }

    return null;
  }

  // Parse response if it's a string
  let parsed: any = response;
  if (typeof response === 'string') {
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      // If parsing fails, search in the string itself
      const urlMatch = response.match(/https:\/\/lh3\.(googleusercontent\.com|google\.com\/rd-notebooklm)\/[^\s"']+/);
      if (urlMatch) {
        return urlMatch[0];
      }
    }
  }

  return findImageUrl(parsed);
}

/**
 * Parse image dimensions from URL parameters
 * 
 * URLs often include size parameters like:
 * - `=w2752-h1536` (width=2752, height=1536)
 * - `=s0-w2752-h1536-d` (size=0, width=2752, height=1536, download)
 */
function parseDimensionsFromUrl(url: string): { width?: number; height?: number } {
  const dimensions: { width?: number; height?: number } = {};

  // Match patterns like =w2752-h1536 or =s0-w2752-h1536-d
  const widthMatch = url.match(/[=-]w(\d+)/);
  const heightMatch = url.match(/[=-]h(\d+)/);

  if (widthMatch) {
    dimensions.width = parseInt(widthMatch[1], 10);
  }
  if (heightMatch) {
    dimensions.height = parseInt(heightMatch[1], 10);
  }

  return dimensions;
}

/**
 * Extract SAPISID from cookies and generate auth hash
 */
function extractSAPISID(cookies: string): string | null {
  const parts = cookies.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('SAPISID=')) {
      return trimmed.substring('SAPISID='.length);
    }
  }
  return null;
}

/**
 * Generate SAPISIDHASH for authorization
 * Format: SHA1(timestamp + " " + SAPISID + " " + origin)
 */
function generateSAPISIDHASH(sapisid: string, timestamp: number): string {
  const origin = 'https://notebooklm.google.com';
  const data = `${timestamp} ${sapisid} ${origin}`;
  
  // Use crypto module (Node.js)
  const hash = createHash('sha1');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Pre-authenticate by calling play.google.com/log
 * This step is required before downloading some infographic images
 * Based on mm25.txt: the browser calls this endpoint before downloading
 */
async function preAuthenticateForDownload(cookies: string): Promise<void> {
  console.log('      🔑 preAuthenticateForDownload: Starting');
  const sapisid = extractSAPISID(cookies);
  console.log('         SAPISID found:', sapisid ? 'Yes' : 'No');
  if (sapisid) {
    console.log('         SAPISID preview:', sapisid.substring(0, 20) + '...');
  }
  
  if (!sapisid) {
    // If no SAPISID, skip pre-auth (some downloads work without it)
    console.log('         ⚠️  No SAPISID found, skipping pre-auth');
    return;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    console.log('         Timestamp:', timestamp);
    const authHash = generateSAPISIDHASH(sapisid, timestamp);
    console.log('         Auth hash generated:', authHash.substring(0, 20) + '...');
    
    // Build auth string for URL parameter: SAPISIDHASH+hash+SAPISID1PHASH+hash+SAPISID3PHASH+hash
    // Based on mm25.txt line 368, the auth parameter goes in the URL with + signs
    const authString = `SAPISIDHASH+${authHash}+SAPISID1PHASH+${authHash}+SAPISID3PHASH+${authHash}`;
    
    // Call play.google.com/log endpoint (this is a tracking/analytics endpoint that also validates session)
    // Based on mm25.txt line 368, URL format: hasfast=true&auth=...&authuser=0&format=json
    // Construct URL manually - encode the hash but preserve + signs by encoding them as %2B
    // The hash itself should be encoded, but + signs need to be %2B
    const encodedAuth = authString.replace(/\+/g, '%2B');
    const logUrl = `https://play.google.com/log?hasfast=true&auth=${encodedAuth}&authuser=0&format=json`;
    console.log('         Pre-auth URL:', logUrl.substring(0, 150) + '...');
    console.log('         Using URL auth parameter format (mm25.txt line 368)');
    
    // Make a simple POST request (we don't need the response, just the auth validation)
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    console.log('         Environment:', isNode ? 'Node.js' : 'Browser');
    
    if (isNode) {
      const urlObj = new URL(logUrl);
      console.log('         Making HTTPS request to:', urlObj.hostname + urlObj.pathname);
      
      await new Promise<void>((resolve) => {
        // Build the request body - using format from mm25.txt line 391 but with current timestamps
        // This is an analytics payload that validates the session
        // Update timestamps to current time
        const currentTimestamp = Date.now();
        const currentTimestampSec = Math.floor(currentTimestamp / 1000);
        // Use a simplified but valid analytics payload format
        // The exact format from mm25.txt may have expired, so we use a minimal valid format
        const requestBody = `[[1,null,null,null,null,null,null,null,null,null,[null,null,null,null,"en",null,"boq_labs-tailwind-frontend_20250129.00_p0",null,[[["Microsoft Edge","143"],["Chromium","143"],["Not A(Brand","24"]],0,"macOS","15.2.0","arm","","143.0.3650.96"],[3,1]]],2090,[["${currentTimestamp}",null,null,null,null,null,null,null,null,null,null,null,null,null,-19800,[null,[""]],null,null,null,null,1,null,null,"[[[${currentTimestampSec},0,0],1],null,null,[1,null,3,null,null,null,null,null,null,null,null,null,null,[[1]],[{}]],null,null,null,null,[]]"]],"${currentTimestamp}",null,null,null,null,null,null,null,null,null,null,null,null,null,[[null,[null,null,null,null,null,null,null,null,null,null,null,null,96797242]],9]]]`;
        
        const req = https.request({
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cookie': cookies,
            'Origin': 'https://notebooklm.google.com',
            'Priority': 'u=4, i', // mm25.txt line 374 uses u=4, i
            'Referer': 'https://notebooklm.google.com/',
            'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-arch': '"arm"',
            'sec-ch-ua-bitness': '"64"',
            'sec-ch-ua-form-factors': '"Desktop"',
            'sec-ch-ua-full-version': '"143.0.3650.96"',
            'sec-ch-ua-full-version-list': '"Microsoft Edge";v="143.0.3650.96", "Chromium";v="143.0.7499.147", "Not A(Brand";v="24.0.0.0"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-model': '""',
            'sec-ch-ua-platform': '"macOS"',
            'sec-ch-ua-platform-version': '"15.2.0"',
            'sec-ch-ua-wow64': '?0',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'no-cors', // mm25.txt line 388 uses no-cors
            'sec-fetch-site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          },
        }, (res: any) => {
          console.log('         Pre-auth response status:', res.statusCode);
          let responseBody = '';
          
          // Collect response body for debugging
          res.on('data', (chunk: Buffer) => {
            responseBody += chunk.toString();
          });
          
          res.on('end', () => {
            if (res.statusCode !== 200) {
              console.log('         ⚠️  Pre-auth failed, response body (first 200 chars):', responseBody.substring(0, 200));
            } else {
              console.log('         ✅ Pre-auth request completed successfully');
            }
            resolve();
          });
        });
        
        req.on('error', (err: Error) => {
          console.log('         ⚠️  Pre-auth request error:', err.message);
          // Don't fail the download if pre-auth fails - just continue
          resolve();
        });
        
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(); // Don't fail if timeout
        });
        
        // Send the request body (simplified analytics payload based on mm25.txt)
        req.write(requestBody);
        req.end();
      });
    } else {
      // Browser environment - use fetch
      try {
        await fetch(logUrl, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cookie': cookies,
            'Origin': 'https://notebooklm.google.com',
            'Referer': 'https://notebooklm.google.com/',
          },
          body: '[]',
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Don't fail the download if pre-auth fails
      }
    }
  } catch {
    // Don't fail the download if pre-auth fails - just continue
  }
}

/**
 * Download image from URL
 * 
 * Downloads the image data from the Google CDN URL.
 * Strategy:
 * 1. Pre-authenticate by calling play.google.com/log (if cookies available)
 * 2. Try downloading with cookies first (most reliable)
 * 3. If that fails, try without cookies (some URLs work without auth)
 * 4. Uses Node.js https/http modules in Node.js for better cookie/redirect handling
 * 5. Falls back to fetch API in browser environments
 */
async function downloadImageFromUrl(
  url: string,
  cookies?: string
): Promise<Uint8Array | ArrayBuffer> {
  console.log('\n🌐 downloadImageFromUrl called');
  console.log('   URL:', url);
  console.log('   Cookies provided:', cookies ? 'Yes' : 'No');
  if (cookies) {
    console.log('   Cookies length:', cookies.length);
    console.log('   Cookies trimmed:', cookies.trim().length > 0 ? 'Yes' : 'No');
  }
  
  // Try multiple strategies to download the image
  // Strategy 1: Skip pre-auth and try direct download (some URLs work without it)
  // Strategy 2: Try with pre-auth
  // Strategy 3: Try different header combinations
  
  const tryDownload = async (useCookies: boolean, skipPreAuth: boolean = false, useFetch: boolean = false): Promise<Uint8Array | ArrayBuffer> => {
    console.log(`\n   🔄 Attempting download (with cookies: ${useCookies}, skip pre-auth: ${skipPreAuth}, use fetch: ${useFetch})...`);
    // Check if we're in Node.js environment
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    console.log(`   Environment: ${isNode ? 'Node.js' : 'Browser'}`);
    
    // Pre-authenticate if we have cookies and not skipping
    if (useCookies && cookies && cookies.trim() && !skipPreAuth) {
      console.log('   🔑 Pre-authenticating via play.google.com/log...');
      try {
        await preAuthenticateForDownload(cookies);
        console.log('   ✅ Pre-authentication completed');
      } catch (preAuthError: any) {
        console.log('   ⚠️  Pre-auth failed, continuing anyway:', preAuthError.message);
      }
    } else if (useCookies && cookies && cookies.trim() && skipPreAuth) {
      console.log('   ⏭️  Skipping pre-authentication (strategy: direct download)');
    }
    
    // Use fetch API if requested (browser-like, handles cookies/redirects differently)
    // Node.js 18+ has built-in fetch, so we can use it
    if (useFetch) {
      if (typeof fetch !== 'undefined') {
        console.log('   🌐 Using fetch API for download');
        return downloadWithFetch(url, useCookies ? cookies : undefined);
      } else {
        console.log('   ⚠️  Fetch API not available, falling back to Node.js http');
      }
    }
    
    // Use Node.js http module
    if (isNode) {
      return downloadWithNodeHttp(url, useCookies ? cookies : undefined);
    } else {
      return downloadWithFetch(url, useCookies ? cookies : undefined);
    }
  };

  // Multiple strategies to try:
  // 1. Direct download with cookies (skip pre-auth) using Node.js http - fastest
  // 2. Download with cookies + pre-auth using Node.js http
  // 3. Download using fetch API (browser-like, handles cookies/redirects differently)
  // 4. Download without cookies (some URLs work without auth)
  const strategies = [
    { name: 'Direct download with cookies (no pre-auth, Node.js http)', useCookies: true, skipPreAuth: true, useFetch: false },
    { name: 'Download with cookies + pre-auth (Node.js http)', useCookies: true, skipPreAuth: false, useFetch: false },
    { name: 'Download with cookies using fetch API', useCookies: true, skipPreAuth: true, useFetch: true },
    { name: 'Download without cookies', useCookies: false, skipPreAuth: false, useFetch: false },
  ];
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    // Skip strategies that require cookies if we don't have them
    if (strategy.useCookies && (!cookies || !cookies.trim())) {
      console.log(`   ⏭️  Skipping Strategy ${i + 1} (no cookies available)`);
      continue;
    }
    
    console.log(`\n   📋 Strategy ${i + 1}: ${strategy.name}...`);
    
    try {
      const result = await tryDownload(strategy.useCookies, strategy.skipPreAuth, strategy.useFetch);
      console.log(`   ✅ Strategy ${i + 1} succeeded!`);
      return result;
    } catch (error: any) {
      lastError = error;
      const isAuthError = error.message?.includes('403') || 
                         error.message?.includes('401') ||
                         error.message?.includes('Authentication') ||
                         error.message?.includes('login page') ||
                         error.message?.includes('Forbidden') ||
                         error.message?.includes('Unauthorized');
      
      console.log(`   ❌ Strategy ${i + 1} failed:`, error.message);
      
      // Continue to next strategy if we have more
      if (i < strategies.length - 1) {
        console.log(`   ⏭️  Trying next strategy...`);
        continue;
      }
    }
  }
  
  // All strategies failed
  if (lastError instanceof NotebookLMError) {
    throw lastError;
  }
  throw new NotebookLMError(
    `All download strategies failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Download using Node.js https/http modules (better cookie/redirect handling)
 */
async function downloadWithNodeHttp(
  url: string,
  cookies?: string
): Promise<Uint8Array> {
  console.log('      📡 downloadWithNodeHttp: Starting HTTP request');
  console.log('         URL:', url);
  console.log('         Cookies in headers:', cookies ? 'Yes' : 'No');
  if (cookies) {
    console.log('         Cookie header length:', cookies.length);
  }
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    // Build headers based on mm24.txt curl examples
    const headers: Record<string, string> = {
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
      'Referer': 'https://notebooklm.google.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-arch': '"arm"',
      'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-form-factors': '"Desktop"',
      'sec-ch-ua-full-version': '"143.0.3650.96"',
      'sec-ch-ua-full-version-list': '"Microsoft Edge";v="143.0.3650.96", "Chromium";v="143.0.7499.147", "Not A(Brand";v="24.0.0.0"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""',
      'sec-ch-ua-platform': '"macOS"',
      'sec-ch-ua-platform-version': '"15.2.0"',
      'sec-ch-ua-wow64': '?0',
      'sec-fetch-dest': 'image',
      'sec-fetch-site': 'cross-site',
    };

    // Set sec-fetch-mode based on URL type (from mm24.txt)
    if (url.includes('rd-notebooklm')) {
      // rd-notebooklm URLs use no-cors and may need cookies
      headers['sec-fetch-mode'] = 'no-cors';
      if (cookies && cookies.trim()) {
        headers['Cookie'] = cookies;
        headers['sec-fetch-storage-access'] = 'active';
        headers['Priority'] = 'u=1, i';
        console.log('         Added Cookie header and sec-fetch-storage-access for rd-notebooklm URL');
      }
    } else if (url.includes('notebooklm')) {
      // lh3.googleusercontent.com/notebooklm URLs - these may redirect to rd-notebooklm
      // Try different header combinations based on mm24.txt examples
      headers['Priority'] = 'i'; // mm24.txt line 33
      headers['sec-fetch-site'] = 'cross-site'; // mm24.txt line 48
      if (cookies && cookies.trim()) {
        // Strategy: Try no-cors first (mm24.txt line 7-28 shows this works)
        // Some examples use cors with origin, but no-cors seems more reliable
        headers['Cookie'] = cookies;
        headers['sec-fetch-mode'] = 'no-cors'; // mm24.txt line 25 - try no-cors first
        headers['sec-fetch-storage-access'] = 'active'; // mm24.txt line 27
        // Don't add Origin for no-cors mode (mm24.txt line 7-28 doesn't have it)
        console.log('         Added Cookie header, no-cors mode, sec-fetch-storage-access, Priority i for notebooklm URL');
      } else {
        // Without cookies: use no-cors and sec-fetch-storage-access (mm24.txt line 7-28)
        headers['sec-fetch-mode'] = 'no-cors'; // mm24.txt line 25
        headers['sec-fetch-storage-access'] = 'active'; // mm24.txt line 27
        console.log('         Added sec-fetch-storage-access, no-cors mode, Priority i for notebooklm URL (no cookies)');
      }
    } else {
      // Other Google CDN URLs
      headers['sec-fetch-mode'] = 'no-cors';
      if (cookies && cookies.trim()) {
        headers['Cookie'] = cookies;
        headers['sec-fetch-storage-access'] = 'active';
        console.log('         Added Cookie header and sec-fetch-storage-access');
      } else {
        console.log('         ⚠️  No cookies to add to headers');
      }
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
      maxRedirects: 5,
    };

    const makeRequest = (currentUrl: string, redirectCount: number = 0): void => {
      if (redirectCount > 5) {
        reject(new NotebookLMError('Too many redirects'));
        return;
      }

      const reqUrl = new URL(currentUrl);
      const reqClient = reqUrl.protocol === 'https:' ? https : http;
      
      // Update headers for rd-notebooklm URLs (mm24.txt line 92-112)
      const isRdNotebooklm = currentUrl.includes('rd-notebooklm');
      const requestHeaders = { ...headers };
      
      if (isRdNotebooklm && cookies && cookies.trim()) {
        // For rd-notebooklm URLs with cookies, use priority: u=1, i and no-cors (mm24.txt line 96, 110)
        requestHeaders['Priority'] = 'u=1, i'; // mm24.txt line 96
        requestHeaders['sec-fetch-mode'] = 'no-cors'; // mm24.txt line 110
        requestHeaders['sec-fetch-site'] = 'cross-site'; // mm24.txt line 111
        console.log('         🔄 Updated headers for rd-notebooklm URL: priority u=1, i, no-cors');
      }
      
      const reqOptions = {
        hostname: reqUrl.hostname,
        port: reqUrl.port || (reqUrl.protocol === 'https:' ? 443 : 80),
        path: reqUrl.pathname + reqUrl.search,
        method: 'GET',
        headers: requestHeaders,
      };

      // Always pass cookies through redirects if available
      if (cookies && cookies.trim()) {
        reqOptions.headers['Cookie'] = cookies;
      }

      const req = reqClient.request(reqOptions, (res: any) => {
        // Check content-type first - if it's HTML, it's likely a login page (403/401)
        const contentType = res.headers['content-type'] || '';
        const isHtmlResponse = contentType.includes('text/html');
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // Consume response
          const redirectUrl = res.headers.location;
          let fullRedirectUrl = redirectUrl;
          
          if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            fullRedirectUrl = `${reqUrl.protocol}//${reqUrl.hostname}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`;
          }
          
          console.log(`         ↪️  Redirect ${res.statusCode} to: ${fullRedirectUrl.substring(0, 100)}...`);
          
          // If redirecting to accounts.google.com (login page), it means auth failed
          // But let's try following one more redirect in case it redirects back to the image
          if (fullRedirectUrl.includes('accounts.google.com')) {
            console.log('         ⚠️  Redirect to login page detected');
            // Try following one more redirect in case it's a temporary redirect
            if (redirectCount < 3) {
              console.log('         ⏭️  Following login redirect (may redirect back to image)...');
              makeRequest(fullRedirectUrl, redirectCount + 1);
              return;
            } else {
              console.log('         ❌ Too many redirects to login page - authentication failed');
              reject(new NotebookLMError(
                `Authentication failed: URL redirected to login page. Cookies may be expired or invalid.`
              ));
              return;
            }
          }
          
          // Update headers for rd-notebooklm URLs if we're redirecting to one
          if (fullRedirectUrl.includes('rd-notebooklm') && cookies && cookies.trim()) {
            console.log('         🔄 Redirecting to rd-notebooklm - updating headers for authenticated request');
            // For rd-notebooklm URLs, use priority: u=1, i (mm24.txt line 96)
            // Headers will be updated in the next request via makeRequest
          }
          
          makeRequest(fullRedirectUrl, redirectCount + 1);
          return;
        }

        // Handle errors - check if it's HTML (login page) vs actual error
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          console.log(`         ❌ HTTP Error: ${res.statusCode} ${res.statusMessage || 'Error'}`);
          if (isHtmlResponse) {
            console.log('         ⚠️  Response is HTML (likely login page) - authentication failed');
          }
          console.log('         Response headers:', JSON.stringify(res.headers, null, 2));
          let errorMsg = `HTTP ${res.statusCode} ${res.statusMessage || 'Error'}`;
          if (res.statusCode === 403) {
            errorMsg += `. Authentication required${cookies ? ' (cookies may be invalid or expired)' : ' (no cookies provided)'}`;
            console.log('         🔒 403 Forbidden - Authentication issue');
            console.log('         Cookies were provided:', cookies ? 'Yes' : 'No');
            if (isHtmlResponse) {
              errorMsg += ' - Server returned HTML login page';
            }
          }
          reject(new NotebookLMError(errorMsg));
          return;
        }
        
        console.log(`         ✅ HTTP ${res.statusCode} - Success`);

        // Collect response data
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          console.log(`         📦 Received chunk: ${chunk.length} bytes (total: ${chunks.reduce((sum, c) => sum + c.length, 0)} bytes)`);
        });
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`         ✅ Complete response received: ${buffer.length} bytes`);
          
          // Validate it's an image
          const firstBytes = buffer.slice(0, 200);
          const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
          const isPNG = firstBytes.slice(0, 8).equals(pngSig);
          const isJPEG = firstBytes.length >= 3 && firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF;
          
          const sample = firstBytes.toString('utf-8');
          const isHTML = sample.trim().startsWith('<!') || sample.includes('<html') || sample.includes('accounts.google.com');
          
          if (isHTML) {
            reject(new NotebookLMError(`Received HTML instead of image (authentication error)`));
            return;
          }
          
          if (!isPNG && !isJPEG) {
            const contentType = res.headers['content-type'] || '';
            if (!contentType.startsWith('image/')) {
              reject(new NotebookLMError(`Not a valid image. Content-Type: ${contentType}`));
              return;
            }
          }

          resolve(new Uint8Array(buffer));
        });
      });

      req.on('error', (err: Error) => {
        reject(new NotebookLMError(`Request error: ${err.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new NotebookLMError('Request timeout'));
      });

      req.end();
    };

    makeRequest(url);
  });
}

/**
 * Download using fetch API (for browser environments)
 */
async function downloadWithFetch(
  url: string,
  cookies?: string
): Promise<Uint8Array | ArrayBuffer> {
  const headers: Record<string, string> = {
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
    'Referer': 'https://notebooklm.google.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  };

  // Add Origin header for CORS requests (some URLs require it)
  if (url.includes('rd-notebooklm') || url.includes('notebooklm')) {
    headers['Origin'] = 'https://notebooklm.google.com';
  }

  if (cookies && cookies.trim()) {
    headers['Cookie'] = cookies;
    // Add sec-fetch-storage-access for authenticated requests
    headers['sec-fetch-storage-access'] = 'active';
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    if (response.status === 403) {
      errorMessage += `. Authentication required${cookies ? ' (cookies may be invalid)' : ' (no cookies provided)'}`;
    }
    throw new NotebookLMError(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const firstBytes = new Uint8Array(arrayBuffer.slice(0, 200));
  
  const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const isPNG = firstBytes.length >= 8 && firstBytes.slice(0, 8).every((byte, index) => byte === pngSignature[index]);
  const isJPEG = firstBytes.length >= 3 && firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF;
  
  const textDecoder = new TextDecoder();
  const sample = textDecoder.decode(firstBytes);
  const isHTML = sample.trim().startsWith('<!') || sample.includes('<html') || sample.includes('accounts.google.com');
  
  if (isHTML) {
    throw new NotebookLMError(`Received HTML instead of image (authentication error)`);
  }
  
  if (!isPNG && !isJPEG && !contentType.startsWith('image/')) {
    throw new NotebookLMError(`Not a valid image. Content-Type: ${contentType}`);
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(arrayBuffer);
  }
  return arrayBuffer;
}

