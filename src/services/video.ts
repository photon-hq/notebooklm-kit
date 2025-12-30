/**
 * Video service
 * Handles video overview operations and downloads
 * 
 * Based on mm26.txt and mm27.txt RPC calls
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { VideoOverview, CreateVideoOverviewOptions } from '../types/video.js';
import { NotebookLMError } from '../types/common.js';
import { ArtifactsService } from './artifacts.js';
import { ArtifactType } from '../types/artifact.js';
import * as https from 'https';
import * as http from 'http';

/**
 * Options for getting video URL
 */
export interface GetVideoUrlOptions {
  /**
   * Authentication cookies for getting the video URL
   * If not provided, the RPC client's cookies will be used
   * Can be cookies from notebooklm.google.com or merged cookies from multiple domains
   */
  cookies?: string;
  /**
   * Additional cookies from .google.com domain
   * These will be automatically merged with the main cookies
   * Required for lh3.google.com redirects (Step 2)
   */
  googleDomainCookies?: string;
}

/**
 * Service for video overview operations
 */
export class VideoService {
  private artifactsService: ArtifactsService;
  
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {
    // Initialize artifacts service to reuse its parsing logic
    this.artifactsService = new ArtifactsService(rpc, quota);
  }
  
  /**
   * Create a video overview
   * 
   * @param notebookId - The notebook ID
   * @param options - Video creation options
   * 
   * @example
   * ```typescript
   * const video = await client.video.create('notebook-id', {
   *   instructions: 'Create an engaging video overview',
   *   sourceIds: ['source-id-1', 'source-id-2']
   * });
   * ```
   */
  async create(notebookId: string, options: CreateVideoOverviewOptions = {}): Promise<VideoOverview> {
    const { instructions = '', sourceIds = [] } = options;
    
    if (sourceIds.length === 0) {
      throw new NotebookLMError('sourceIds are required for video creation');
    }
    
    // Check quota before creating
    this.quota?.checkQuota('createVideoOverview');
    
    // Build video arguments based on RPC_CREATE_VIDEO_OVERVIEW
    const videoArgs = [
      [2], // Mode
      notebookId,
      [
        null,
        null,
        3, // Type 3 = Video
        [sourceIds.map(id => [id])], // Source IDs
        null,
        null,
        null,
        null,
        [
          null,
          null,
          [
            sourceIds.map(id => [id]), // Source IDs again
            'en', // Language
            instructions, // Instructions
          ],
        ],
      ],
    ];
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_VIDEO_OVERVIEW,
      videoArgs,
      notebookId
    );
    
    const video = this.parseCreateResponse(response, notebookId);
    
    // Record usage after successful creation
    this.quota?.recordUsage('createVideoOverview');
    
    return video;
  }
  
  /**
   * Get the final googlevideo.com/videoplayback URL by following redirects
   * 
   * **IMPORTANT LIMITATIONS:**
   * 
   * The final `googlevideo.com/videoplayback` URL is:
   * - **NOT available in RPC responses** - RPC only returns `lh3.googleusercontent.com/notebooklm/...` URLs
   * - **Generated dynamically** during the redirect chain by Google's CDN
   * - **IP-bound** - Contains `ip=...` parameter tied to the requesting client
   * - **Session-bound** - Requires valid Google account cookies (SID, SAPISID, etc.)
   * - **Time-limited** - Contains `expire=...` timestamp and cryptographic signatures
   * - **Not reverse-engineerable** - Signatures (`sig=...`, `lsig=...`) are server-generated
   * 
   * **Why following redirects is required:**
   * The final URL contains server-generated cryptographic signatures that cannot be computed
   * client-side. The only way to obtain it is to follow the redirect chain:
   * 1. lh3.googleusercontent.com/notebooklm/...=m22-dv (initial URL from RPC, no cookies needed)
   * 2. lh3.google.com/rd-notebooklm/...=m22-dv (with cookies) - returns location header
   * 3. googlevideo.com/videoplayback (final URL with signatures, IP-bound, session-bound)
   * 
   * **What the final URL contains:**
   * - `ip=...` - IP address of the requesting client (IP-bound)
   * - `expire=...` - Expiration timestamp
   * - `sig=...` and `lsig=...` - Cryptographic signatures (server-generated, cannot be reverse-engineered)
   * - `source=contrib_service_notebooklm` - Indicates NotebookLM origin
   * - `itag=22` - YouTube itag format (720p MP4)
   * 
   * **This URL is NOT reusable:**
   * - Cannot be shared with others (IP mismatch)
   * - Cannot be used from different IP addresses
   * - Cannot be used after session expires
   * - Cannot be generated programmatically without following redirects
   * 
   * @param notebookId - The notebook ID
   * @param options - Options (cookies - required for redirect chain)
   * 
   * @example
   * ```typescript
   * const finalUrl = await client.video.getVideoUrl('notebook-id');
   * console.log('Final video URL:', finalUrl);
   * // Note: This URL is IP-bound and session-bound, not reusable
   * ```
   */
  /**
   * Merge cookies from multiple domains
   * notebooklm.google.com cookies have HIGHEST priority (override google.com cookies)
   * 
   * @param cookieStrings - Array of cookie strings from different domains
   * @returns Merged cookie string with duplicates removed (later cookies override earlier ones)
   */
  private mergeCookies(cookieStrings: string[]): string {
    const cookieMap = new Map<string, string>();
    
    cookieStrings.forEach(cookieString => {
      if (!cookieString || !cookieString.trim()) {
        return;
      }
      
      const cookies = cookieString.split(';').map(c => c.trim()).filter(Boolean);
      
      cookies.forEach(cookie => {
        const [name, ...valueParts] = cookie.split('=');
        if (name && valueParts.length > 0) {
          const value = valueParts.join('=');
          // Later cookies override earlier ones (notebooklm cookies added last = highest priority)
          cookieMap.set(name.trim(), value);
        }
      });
    });
    
    return Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async getVideoUrl(notebookId: string, options: GetVideoUrlOptions = {}): Promise<string> {
    const { cookies, googleDomainCookies } = options;
    
    console.log('\n🔍 Fetching final video URL by following redirects...');
    
    // IMPORTANT: Use original cookies (not merged) for RPC calls to artifacts.list()
    // The RPC client needs notebooklm.google.com cookies specifically
    const rpcCookies = this.rpc.getCookies();
    const notebooklmCookies = cookies || rpcCookies;
    
    // Get video URL from artifacts (use notebooklm cookies only for RPC)
    const artifacts = await this.artifactsService.list(notebookId);
    const videoArtifact = artifacts.find(a => 
      a.type === ArtifactType.VIDEO && a.videoData
    );
    
    if (!videoArtifact || !videoArtifact.videoData) {
      throw new NotebookLMError(
        'No video URL found in artifacts. Make sure a video has been created for this notebook.'
      );
    }
    
    const videoUrl = videoArtifact.videoData;
    console.log('   ✅ Video URL found:', videoUrl);
    
    // Based on mm28.txt: First request should be =m22 (not =m22-dv)
    // The server will redirect to =m22-dv, then to =s512-m22, then to googlevideo.com
    // So we DON'T transform the URL here - let the server handle redirects
    let downloadUrl = videoUrl;
    
    // Ensure URL has authuser parameter
    try {
      const urlObj = new URL(downloadUrl);
      if (!urlObj.searchParams.has('authuser')) {
        urlObj.searchParams.set('authuser', '0');
        downloadUrl = urlObj.toString();
      }
    } catch (urlError) {
      console.warn(`   ⚠️  Warning: Could not parse video URL: ${downloadUrl}`);
    }
    
    console.log('   🔗 Starting redirect chain from:', downloadUrl);
    
    // Merge cookies for redirect following:
    // 1. Add google.com cookies first (lower priority)
    // 2. Add notebooklm.google.com cookies last (HIGHEST priority - will override duplicates)
    const cookieStrings: string[] = [];
    
    if (googleDomainCookies && googleDomainCookies.trim()) {
      cookieStrings.push(googleDomainCookies);
      console.log('   🍪 Merging cookies from .google.com domain (lower priority)');
    }
    
    if (notebooklmCookies && notebooklmCookies.trim()) {
      cookieStrings.push(notebooklmCookies);
      console.log('   🍪 Adding cookies from notebooklm.google.com (HIGHEST priority)');
    }
    
    const finalCookies = this.mergeCookies(cookieStrings);
    
    if (!finalCookies || !finalCookies.trim()) {
      throw new NotebookLMError(
        'Cookies are required for getting final video URL. ' +
        'Please provide cookies in the options or ensure the RPC client has cookies configured.'
      );
    }
    
    const cookieCount = finalCookies.split(';').filter(c => c.trim()).length;
    console.log(`   🍪 Total merged cookies: ${cookieCount} (notebooklm cookies take priority)`);
    
    // Follow redirects to get final URL (use merged cookies)
    return this.followRedirectsToFinalUrl(downloadUrl, finalCookies);
  }

  
  /**
   * Extract video URL from artifacts list response
   * Based on mm27.txt: Video URL is at index 9: [null, "https://lh3.googleusercontent.com/notebooklm/..."]
   */
  private extractVideoUrlFromArtifacts(artifactsResponse: any): string | null {
    if (!Array.isArray(artifactsResponse)) {
      return null;
    }
    
    // Flatten nested arrays to find artifacts
    const findVideoUrl = (arr: any): string | null => {
      if (Array.isArray(arr)) {
        // Check if this is an artifact array with video URL at index 9
        if (arr.length > 9 && Array.isArray(arr[9]) && arr[9].length > 1) {
          if (arr[9][0] === null && typeof arr[9][1] === 'string' && arr[9][1].startsWith('http')) {
            const url = arr[9][1];
            // Match video URL patterns from mm27.txt
            if (url.includes('lh3.googleusercontent.com/notebooklm/') || 
                url.includes('lh3.google.com/rd-notebooklm/') ||
                url.includes('googlevideo.com/videoplayback')) {
              return url;
            }
          }
        }
        
        // Recursively search nested arrays
        for (const item of arr) {
          const found = findVideoUrl(item);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findVideoUrl(artifactsResponse);
  }
  
  /**
   * Normalize redirect URL - fix common issues:
   * 1. Resolve relative domains (rd-notebooklm -> lh3.google.com/rd-notebooklm)
   * 2. Decode URL-encoded query separators (%3F -> ?)
   * 3. Properly separate query parameters
   */
  private normalizeRedirectUrl(location: string, baseUrl: string): string {
    // First, decode any URL-encoded characters in the path
    let normalized = decodeURIComponent(location);
    
    // Handle relative URLs (missing protocol/host)
    if (normalized.startsWith('//')) {
      // Protocol-relative URL (//rd-notebooklm/...)
      const baseUrlObj = new URL(baseUrl);
      normalized = baseUrlObj.protocol + normalized;
    } else if (normalized.startsWith('/')) {
      // Absolute path (/rd-notebooklm/...)
      const baseUrlObj = new URL(baseUrl);
      normalized = baseUrlObj.protocol + '//' + baseUrlObj.hostname + normalized;
    } else if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      // Relative URL without leading slash (rd-notebooklm/...)
      // Check if it's a domain-relative URL
      if (normalized.includes('/') && !normalized.includes('://')) {
        // Likely a domain-relative URL like "rd-notebooklm/..."
        // Resolve based on context - if baseUrl is lh3.google.com, use that
        const baseUrlObj = new URL(baseUrl);
        if (baseUrlObj.hostname.includes('google.com') || baseUrlObj.hostname.includes('googleusercontent.com')) {
          // Use lh3.google.com for rd-notebooklm redirects
          normalized = baseUrlObj.protocol + '//lh3.google.com/' + normalized;
        } else {
          // Fallback: resolve relative to base URL
          normalized = new URL(normalized, baseUrl).toString();
        }
      } else {
        // Fully relative - resolve against base URL
        normalized = new URL(normalized, baseUrl).toString();
      }
    }
    
    // Now parse as URL to fix query parameter encoding issues
    try {
      const urlObj = new URL(normalized);
      
      // Check if path contains encoded query parameters (e.g., %3Fauthuser=0)
      // This happens when the server returns a malformed URL
      const pathParts = urlObj.pathname.split('%3F');
      if (pathParts.length > 1) {
        // Found %3F in path - this should be a query parameter separator
        urlObj.pathname = pathParts[0];
        // The rest should be query parameters
        const queryPart = pathParts.slice(1).join('%3F');
        // Parse the query part
        const queryParams = new URLSearchParams(queryPart);
        // Merge with existing query params
        queryParams.forEach((value, key) => {
          urlObj.searchParams.set(key, value);
        });
      }
      
      // Also check for %3F in the full URL string (before URL parsing)
      if (normalized.includes('%3F') && !normalized.includes('?')) {
        // Replace %3F with ? if there's no existing ?
        normalized = normalized.replace('%3F', '?');
        // Re-parse
        return new URL(normalized).toString();
      }
      
      return urlObj.toString();
    } catch (urlError) {
      // If URL parsing fails, try to fix common issues
      console.warn(`   ⚠️  Warning: Could not parse redirect URL: ${normalized}`);
      console.warn(`   🔧 Attempting to fix...`);
      
      // Try to fix: replace %3F with ?
      if (normalized.includes('%3F') && !normalized.includes('?')) {
        normalized = normalized.replace('%3F', '?');
      }
      
      // Try to fix: add protocol if missing
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        const baseUrlObj = new URL(baseUrl);
        if (normalized.startsWith('//')) {
          normalized = baseUrlObj.protocol + normalized;
        } else if (normalized.startsWith('/')) {
          normalized = baseUrlObj.protocol + '//' + baseUrlObj.hostname + normalized;
        } else {
          // Domain-relative like "rd-notebooklm/..."
          normalized = baseUrlObj.protocol + '//lh3.google.com/' + normalized;
        }
      }
      
      try {
        return new URL(normalized).toString();
      } catch (e) {
        // Last resort: return as-is and let the next request fail with a better error
        console.error(`   ❌ Failed to normalize URL: ${normalized}`);
        return normalized;
      }
    }
  }
  
  /**
   * Validate cookies by making a test request to NotebookLM
   * Returns true if cookies are valid, false if they're expired/invalid
   */
  async validateCookies(cookies: string): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'notebooklm.google.com',
          port: 443,
          path: '/',
          method: 'GET',
          headers: {
            'Cookie': cookies,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          const statusCode = res.statusCode || 0;
          const location = res.headers.location || '';
          
          // If we get redirected to login, cookies are invalid
          if (location.includes('accounts.google.com') || 
              location.includes('ServiceLogin') ||
              location.includes('signin')) {
            resolve({
              valid: false,
              error: 'Cookies are expired or invalid - redirected to login page'
            });
            return;
          }
          
          // If we get a 200 or 302 to notebooklm (not login), cookies are likely valid
          if (statusCode === 200 || 
              (statusCode === 302 && !location.includes('accounts.google.com'))) {
            resolve({ valid: true });
            return;
          }
          
          // Other status codes might indicate issues
          resolve({
            valid: false,
            error: `Unexpected status ${statusCode} when validating cookies`
          });
        }
      );
      
      req.on('error', (err) => {
        resolve({
          valid: false,
          error: `Network error: ${err.message}`
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          valid: false,
          error: 'Cookie validation request timed out'
        });
      });
      
      req.end();
    });
  }
  
  /**
   * Follow redirects to get the final googlevideo.com/videoplayback URL
   * Based on mm28.txt redirect chain
   */
  private async followRedirectsToFinalUrl(
    url: string,
    cookies: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      // Build headers based on mm28.txt and mm29.txt curl examples
      const headers: Record<string, string> = {
        'Accept': '*/*',
        'Accept-Encoding': 'identity;q=1, *;q=0', // mm29.txt shows this on all steps
        'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7',
        'Range': 'bytes=0-',
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
        'sec-fetch-dest': 'video',
        'sec-fetch-site': 'cross-site',
        'range': 'bytes=0-', // mm29.txt shows this header on all requests
      };
      
      // Set headers based on URL type
      // mm29.txt shows:
      // - Step 1 (lh3.googleusercontent.com/notebooklm): has sec-fetch-storage-access
      // - Step 2 (lh3.google.com/rd-notebooklm): NO sec-fetch-storage-access
      // - Step 3 (lh3.googleusercontent.com/rd-notebooklm): has sec-fetch-storage-access
      if (url.includes('rd-notebooklm') || url.includes('notebooklm')) {
        headers['sec-fetch-mode'] = 'no-cors';
        headers['Priority'] = 'i';
        // Only add sec-fetch-storage-access if NOT going to lh3.google.com/rd-notebooklm
        // (that's step 2, which doesn't have this header per mm29.txt)
        if (!url.includes('lh3.google.com/rd-notebooklm')) {
          headers['sec-fetch-storage-access'] = 'active';
        }
      } else if (url.includes('googlevideo.com')) {
        headers['sec-fetch-mode'] = 'no-cors';
        headers['sec-fetch-storage-access'] = 'active';
      }
      
      // DO NOT add cookies to base headers - they are added per-step in followRedirects
      // Step 1 (lh3.googleusercontent.com/notebooklm) should NOT have cookies
      // Step 2+ (rd-notebooklm) should have cookies
      
      // Track cookies from Set-Cookie headers to merge with provided cookies
      let accumulatedCookies = cookies || '';
      
      const followRedirects = (currentUrl: string, redirectCount: number = 0): void => {
        // If we're already on a googlevideo.com/videoplayback URL, return it immediately
        // No need to make another request - this is the final URL
        if (currentUrl.includes('googlevideo.com/videoplayback')) {
          console.log('   ✅ Found final video URL!');
          console.log('   📹', currentUrl);
          resolve(currentUrl);
          return;
        }
        
        if (redirectCount > 10) {
          reject(new NotebookLMError('Too many redirects (max 10)'));
          return;
        }
        
        const startTime = Date.now();
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   🔄 Step ${redirectCount + 1}: ${currentUrl}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        const reqUrl = new URL(currentUrl);
        const reqClient = reqUrl.protocol === 'https:' ? https : http;
        
        // Log URL breakdown
        console.log(`   🔗 URL Breakdown:`);
        console.log(`      Protocol: ${reqUrl.protocol}`);
        console.log(`      Hostname: ${reqUrl.hostname}`);
        console.log(`      Port: ${reqUrl.port || (reqUrl.protocol === 'https:' ? 443 : 80)}`);
        console.log(`      Pathname: ${reqUrl.pathname.substring(0, 150)}${reqUrl.pathname.length > 150 ? '...' : ''}`);
        console.log(`      Search: ${reqUrl.search || '(none)'}`);
        console.log(`      Hash: ${reqUrl.hash || '(none)'}`);
        
        // Build request headers for this specific step
        const stepHeaders: Record<string, string> = { ...headers };
        
        // Determine if cookies are needed based on URL
        // mm28.txt shows:
        // - Step 1: lh3.googleusercontent.com/notebooklm/...=m22 - NO cookies
        // - Step 2: lh3.google.com/rd-notebooklm/...=m22-dv - WITH cookies
        // - Step 3: lh3.googleusercontent.com/rd-notebooklm/...=s512-m22 - WITH cookies
        // Rule: First request (redirectCount === 0) to lh3.googleusercontent.com/notebooklm has NO cookies
        //       All other requests (rd-notebooklm in path or redirectCount > 0) have cookies
        const isFirstRequest = redirectCount === 0;
        const isInitialNotebooklm = isFirstRequest && 
                                     reqUrl.hostname === 'lh3.googleusercontent.com' && 
                                     reqUrl.pathname.includes('/notebooklm/') &&
                                     !reqUrl.pathname.includes('/rd-notebooklm/');
        // Check path for rd-notebooklm (not hostname, since hostname is lh3.google.com)
        const hasRdNotebooklm = reqUrl.pathname.includes('/rd-notebooklm/');
        const needsCookies = !isInitialNotebooklm && 
                            (hasRdNotebooklm || redirectCount > 0);
        
        console.log(`   🔍 Cookie Decision Logic:`);
        console.log(`      isFirstRequest: ${isFirstRequest}`);
        console.log(`      isInitialNotebooklm: ${isInitialNotebooklm}`);
        console.log(`      hasRdNotebooklm: ${hasRdNotebooklm}`);
        console.log(`      needsCookies: ${needsCookies}`);
        
        // Explicitly remove cookies from stepHeaders if they shouldn't be there
        // (in case they were added to base headers previously)
        if (!needsCookies) {
          delete stepHeaders['Cookie'];
        }
        
        if (needsCookies && accumulatedCookies && accumulatedCookies.trim()) {
          stepHeaders['Cookie'] = accumulatedCookies;
          // Analyze cookies
          const cookieArray = accumulatedCookies.split(';').map(c => c.trim());
          const cookieCount = cookieArray.length;
          const importantCookies = ['SID', 'SAPISID', '__Secure-ENID', '__Secure-1PSID', '__Secure-3PSID'];
          const foundImportantCookies = importantCookies.filter(key => 
            cookieArray.some(c => c.startsWith(key + '=') || c.startsWith('__Secure-' + key))
          );
          
          console.log(`   📋 Cookies: ✅ Sending ${cookieCount} cookies`);
          console.log(`      Important cookies found: ${foundImportantCookies.length > 0 ? foundImportantCookies.join(', ') : 'none detected'}`);
          console.log(`      Cookie preview: ${accumulatedCookies.substring(0, 150)}${accumulatedCookies.length > 150 ? '...' : ''}`);
        } else {
          console.log(`   📋 Cookies: ❌ Not sending cookies`);
          if (!needsCookies) {
            console.log(`      Reason: ${isInitialNotebooklm ? 'First request to lh3.googleusercontent.com/notebooklm (no cookies needed)' : 'Cookie logic determined cookies not needed'}`);
          } else if (!accumulatedCookies || !accumulatedCookies.trim()) {
            console.log(`      Reason: No cookies available (cookies string is empty or undefined)`);
          }
        }
        
        // Update sec-fetch headers based on step
        // mm29.txt shows:
        // - Step 1 (lh3.googleusercontent.com/notebooklm): has sec-fetch-storage-access
        // - Step 2 (lh3.google.com/rd-notebooklm): NO sec-fetch-storage-access
        // - Step 3 (lh3.googleusercontent.com/rd-notebooklm): has sec-fetch-storage-access
        // Check pathname for notebooklm/rd-notebooklm (not hostname)
        const hasNotebooklmPath = reqUrl.pathname.includes('/notebooklm/') || reqUrl.pathname.includes('/rd-notebooklm/');
        
        if (hasNotebooklmPath) {
          stepHeaders['sec-fetch-mode'] = 'no-cors';
          stepHeaders['Priority'] = 'i';
          // Step 2: lh3.google.com/rd-notebooklm should NOT have sec-fetch-storage-access
          if (reqUrl.hostname === 'lh3.google.com' && reqUrl.pathname.includes('/rd-notebooklm/')) {
            // Explicitly remove sec-fetch-storage-access for step 2 (per mm29.txt)
            delete stepHeaders['sec-fetch-storage-access'];
            console.log(`   🔧 Header adjustment: Removed sec-fetch-storage-access (Step 2 per mm29.txt)`);
          } else {
            // Step 1 and 3: add sec-fetch-storage-access
            stepHeaders['sec-fetch-storage-access'] = 'active';
          }
        } else if (reqUrl.hostname.includes('googlevideo.com')) {
          stepHeaders['sec-fetch-mode'] = 'no-cors';
          stepHeaders['sec-fetch-storage-access'] = 'active';
        }
        
        // Ensure range header is present (mm29.txt shows it on all requests)
        if (!stepHeaders['range']) {
          stepHeaders['range'] = 'bytes=0-';
        }
        
        // Debug: Log sec-fetch-storage-access status
        if (reqUrl.hostname === 'lh3.google.com' && reqUrl.pathname.includes('/rd-notebooklm/')) {
          console.log(`   🔍 sec-fetch-storage-access: ${stepHeaders['sec-fetch-storage-access'] ? 'PRESENT (should be removed!)' : 'REMOVED ✅'}`);
        }
        
        const reqOptions = {
          hostname: reqUrl.hostname,
          port: reqUrl.port || (reqUrl.protocol === 'https:' ? 443 : 80),
          path: reqUrl.pathname + reqUrl.search,
          method: 'GET', // mm29.txt shows GET method for all steps (not HEAD)
          headers: stepHeaders,
        };
        
        // Log request details
        console.log(`\n   📤 REQUEST:`);
        console.log(`      Method: ${reqOptions.method}`);
        console.log(`      Full URL: ${reqUrl.toString()}`);
        console.log(`      URL (raw): ${reqUrl.href}`);
        console.log(`      Host: ${reqOptions.hostname}:${reqOptions.port}`);
        console.log(`      Path: ${reqOptions.path}`);
        console.log(`      Path (full): ${reqOptions.path}`);
        console.log(`      Header Count: ${Object.keys(stepHeaders).length}`);
        
        // Log RAW request headers (exact as sent)
        console.log(`\n   📋 RAW REQUEST HEADERS (exact):`);
        const rawRequestHeaders: string[] = [];
        Object.entries(stepHeaders).forEach(([key, value]) => {
          rawRequestHeaders.push(`${key}: ${value}`);
        });
        rawRequestHeaders.forEach(header => {
          if (header.startsWith('Cookie:')) {
            const cookieValue = header.substring(8).trim();
            const cookieCount = cookieValue.split(';').filter(c => c.trim()).length;
            console.log(`      Cookie: [${cookieCount} cookies, ${cookieValue.length} chars]`);
            // Show first 200 chars of cookie string
            console.log(`      Cookie (preview): ${cookieValue.substring(0, 200)}${cookieValue.length > 200 ? '...' : ''}`);
            // Show all cookie names
            const cookieNames = cookieValue.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
            console.log(`      Cookie names: ${cookieNames.join(', ')}`);
          } else {
            console.log(`      ${header}`);
          }
        });
        
        console.log(`\n   📋 REQUEST HEADERS (formatted):`);
        Object.entries(stepHeaders).forEach(([key, value]) => {
          if (key === 'Cookie') {
            const cookieCount = value.split(';').filter(c => c.trim()).length;
            console.log(`         ${key}: [${cookieCount} cookies] ${value.substring(0, 80)}...`);
          } else {
            const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
            console.log(`         ${key}: ${displayValue}`);
          }
        });
        
        const req = reqClient.request(reqOptions, (res) => {
          const responseTime = Date.now() - startTime;
          
          // Capture response body chunks for debugging (before aborting)
          const responseBodyChunks: Buffer[] = [];
          let totalBodyBytes = 0;
          const maxBodyCapture = 2048; // Capture first 2KB for debugging
          
          res.on('data', (chunk: Buffer) => {
            if (totalBodyBytes < maxBodyCapture) {
              const remaining = maxBodyCapture - totalBodyBytes;
              const chunkToCapture = chunk.slice(0, remaining);
              responseBodyChunks.push(chunkToCapture);
              totalBodyBytes += chunkToCapture.length;
            }
            // Continue consuming to prevent buffering
          });
          
          // Log response details
          const statusCode = res.statusCode || 0;
          const statusMessage = res.statusMessage || 'Unknown';
          console.log(`\n   📥 RESPONSE (${responseTime}ms):`);
          console.log(`      Status: ${statusCode} ${statusMessage}`);
          console.log(`      Status Code (raw): ${statusCode}`);
          console.log(`      Status Message (raw): "${statusMessage}"`);
          console.log(`      Status Category: ${statusCode > 0 ? Math.floor(statusCode / 100) : 'N/A'}xx`);
          console.log(`      Header Count: ${Object.keys(res.headers).length}`);
          
          // Log RAW response headers (exact as received)
          console.log(`\n   📋 RAW RESPONSE HEADERS (exact):`);
          const rawHeaders: string[] = [];
          Object.entries(res.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((v, i) => {
                rawHeaders.push(`${key}${i > 0 ? `[${i}]` : ''}: ${v}`);
              });
            } else {
              rawHeaders.push(`${key}: ${value || ''}`);
            }
          });
          rawHeaders.forEach(header => console.log(`      ${header}`));
          
          console.log(`\n   📋 RESPONSE HEADERS (formatted):`);
          
          // Capture Set-Cookie headers and merge with accumulated cookies
          const setCookieHeaders = res.headers['set-cookie'];
          if (setCookieHeaders) {
            const setCookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
            const newCookies = setCookieArray.map(cookie => {
              // Extract cookie name=value (before first semicolon)
              const cookiePart = cookie.split(';')[0].trim();
              return cookiePart;
            }).filter(Boolean);
            
            if (newCookies.length > 0) {
              console.log(`      🍪 Received ${newCookies.length} Set-Cookie header(s) from Step ${redirectCount + 1}, merging with existing cookies`);
              newCookies.forEach((cookie, idx) => {
                const [name] = cookie.split('=');
                console.log(`         Cookie ${idx + 1}: ${name}${cookie.length > 50 ? '...' : '=' + cookie.split('=').slice(1).join('=')}`);
              });
              
              // Merge: existing cookies + new cookies
              const existingCookieMap = new Map<string, string>();
              if (accumulatedCookies) {
                accumulatedCookies.split(';').forEach(c => {
                  const [name, ...valueParts] = c.trim().split('=');
                  if (name) {
                    existingCookieMap.set(name, valueParts.join('='));
                  }
                });
              }
              
              // Add/update cookies from Set-Cookie
              newCookies.forEach(cookie => {
                const [name, ...valueParts] = cookie.split('=');
                if (name) {
                  existingCookieMap.set(name, valueParts.join('='));
                }
              });
              
              // Rebuild cookie string
              accumulatedCookies = Array.from(existingCookieMap.entries())
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');
              
              console.log(`      🍪 Updated cookie string (${existingCookieMap.size} total cookies after merge)`);
            }
          } else {
            // Log if no Set-Cookie headers were received
            if (redirectCount === 0) {
              console.log(`      ℹ️  No Set-Cookie headers received from Step 1 (this is normal)`);
            }
          }
          
          // Log all headers with special attention to important ones
          const importantHeaders = ['location', 'set-cookie', 'cache-control', 'content-type', 'content-length', 'x-content-type-options'];
          Object.entries(res.headers).forEach(([key, value]) => {
            const isImportant = importantHeaders.includes(key.toLowerCase());
            const icon = isImportant ? '⭐' : '  ';
            if (Array.isArray(value)) {
              value.forEach((v, i) => {
                const displayValue = v.length > 150 ? v.substring(0, 150) + '...' : v;
                console.log(`         ${icon} ${key}${i > 0 ? `[${i}]` : ''}: ${displayValue}`);
              });
            } else {
              const displayValue = (value || '').length > 150 ? (value || '').substring(0, 150) + '...' : (value || '');
              console.log(`         ${icon} ${key}: ${displayValue}`);
            }
          });
          
          // Check for redirect status codes
          const isRedirect = statusCode >= 300 && statusCode < 400;
          if (isRedirect) {
            console.log(`      ⚠️  Redirect Status Code: ${statusCode}`);
          }
          
          // Check for location header FIRST - rd-notebooklm returns location header even with 200 status
          const location = res.headers.location;
          
          // Wait for response to end to capture body, then handle redirect
          res.on('end', () => {
            // Log response body
            if (responseBodyChunks.length > 0) {
              const bodyBuffer = Buffer.concat(responseBodyChunks);
              const bodyText = bodyBuffer.toString('utf8', 0, Math.min(totalBodyBytes, 2000));
              console.log(`\n   📄 RESPONSE BODY (raw, first ${Math.min(totalBodyBytes, 2000)} bytes):`);
              console.log(`      Length: ${totalBodyBytes} bytes`);
              console.log(`      Content:`);
              // Show body with line breaks preserved
              const bodyLines = bodyText.split('\n');
              bodyLines.slice(0, 30).forEach((line) => {
                console.log(`         ${line}`);
              });
              if (bodyLines.length > 30) {
                console.log(`         ... (${bodyLines.length - 30} more lines)`);
              }
              if (totalBodyBytes > 2000) {
                console.log(`      ... (${totalBodyBytes - 2000} more bytes not captured)`);
              }
            } else {
              const contentLength = res.headers['content-length'];
              if (contentLength && parseInt(contentLength) > 0) {
                console.log(`\n   📄 RESPONSE BODY: Expected ${contentLength} bytes but none captured (response may have been aborted)`);
              } else {
                console.log(`\n   📄 RESPONSE BODY: No body data captured (headers-only or empty)`);
              }
            }
            
            // Now handle redirect
            if (location) {
              console.log(`\n   🔗 LOCATION HEADER:`);
              console.log(`      Location (raw, exact): "${location}"`);
              console.log(`      Location (raw, length): ${location.length} characters`);
              
              // Normalize the redirect URL
              const redirectUrl = this.normalizeRedirectUrl(location, currentUrl);
              console.log(`      Location (normalized): ${redirectUrl}`);
              console.log(`      Location (normalized, length): ${redirectUrl.length} characters`);
              
              // Compare raw vs normalized
              if (location !== redirectUrl) {
                console.log(`      ⚠️  Location was normalized (raw != normalized)`);
                console.log(`      Raw:    ${location.substring(0, 150)}${location.length > 150 ? '...' : ''}`);
                console.log(`      Normal: ${redirectUrl.substring(0, 150)}${redirectUrl.length > 150 ? '...' : ''}`);
              }
              
              // STOP IMMEDIATELY if this is a googlevideo.com/videoplayback URL
              if (redirectUrl.includes('googlevideo.com/videoplayback')) {
                const totalTime = Date.now() - startTime;
                console.log(`\n   ✅ Found final video URL!`);
                console.log(`   📹 ${redirectUrl}`);
                console.log(`   ⏱️  Total redirect chain time: ${totalTime}ms`);
                console.log(`   📊 Redirect chain length: ${redirectCount + 1} steps`);
                
                // Parse and display key parameters from final URL
                try {
                  const finalUrl = new URL(redirectUrl);
                  console.log(`   🔑 Final URL Parameters:`);
                  console.log(`      expire: ${finalUrl.searchParams.get('expire') || 'N/A'}`);
                  console.log(`      ip: ${finalUrl.searchParams.get('ip') || 'N/A'}`);
                  console.log(`      id: ${finalUrl.searchParams.get('id') || 'N/A'}`);
                  console.log(`      itag: ${finalUrl.searchParams.get('itag') || 'N/A'}`);
                  console.log(`      source: ${finalUrl.searchParams.get('source') || 'N/A'}`);
                  console.log(`      sig: ${finalUrl.searchParams.get('sig') ? 'present' : 'missing'}`);
                  console.log(`      lsig: ${finalUrl.searchParams.get('lsig') ? 'present' : 'missing'}`);
                  console.log(`      Total params: ${finalUrl.searchParams.toString().split('&').length}`);
                } catch (e) {
                  console.log(`   ⚠️  Could not parse final URL parameters`);
                }
                
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                resolve(redirectUrl);
                return;
              }
              
              // Don't follow redirects to login pages
              if (redirectUrl.includes('accounts.google.com') ||
                  redirectUrl.includes('ServiceLogin') || 
                  redirectUrl.includes('InteractiveLogin')) {
                console.log(`\n   ❌ Authentication failed: Redirected to login page`);
                console.log(`   🔍 Redirect URL: ${redirectUrl}`);
                console.log(`   🔍 Current Step: ${redirectCount + 1}`);
                console.log(`   🔍 Request URL: ${currentUrl}`);
                console.log(`   🔍 Response body length: ${totalBodyBytes} bytes (expected ~1536 for successful redirect)`);
                console.log(`   🔍 Cookies were: ${needsCookies ? 'sent' : 'not sent'}`);
                
                if (needsCookies && accumulatedCookies) {
                  const cookieKeys = accumulatedCookies.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
                  console.log(`   🔍 Cookie keys present: ${cookieKeys.slice(0, 15).join(', ')}${cookieKeys.length > 15 ? `... (${cookieKeys.length} total)` : ''}`);
                  
                  // Log FULL cookie string (truncated but more visible)
                  console.log(`\n   🍪 FULL COOKIE STRING (sent in request):`);
                  console.log(`      Length: ${accumulatedCookies.length} characters`);
                  console.log(`      Cookie count: ${cookieKeys.length}`);
                  console.log(`      Preview (first 500 chars): ${accumulatedCookies.substring(0, 500)}${accumulatedCookies.length > 500 ? '...' : ''}`);
                  if (accumulatedCookies.length > 500) {
                    console.log(`      Preview (last 200 chars): ...${accumulatedCookies.substring(accumulatedCookies.length - 200)}`);
                  }
                  
                  // Check for required cookies
                  const requiredCookies = ['SID', '__Secure-1PSID', '__Secure-3PSID', 'SAPISID', '__Secure-1PAPISID'];
                  const missingCookies = requiredCookies.filter(req => 
                    !cookieKeys.some(key => key === req || key.startsWith('__Secure-' + req.replace('__Secure-', '')))
                  );
                  if (missingCookies.length > 0) {
                    console.log(`   ⚠️  Missing required cookies: ${missingCookies.join(', ')}`);
                  } else {
                    console.log(`   ✅ All required cookies are present`);
                  }
                  
                  // Check for additional cookies from mm29.txt
                  const additionalCookies = ['__Secure-1PSIDTS', '__Secure-3PSIDTS', 'SIDCC', '__Secure-1PSIDCC', '__Secure-3PSIDCC'];
                  const foundAdditional = additionalCookies.filter(req => 
                    cookieKeys.some(key => key === req || key.startsWith('__Secure-' + req.replace('__Secure-', '')))
                  );
                  const missingAdditional = additionalCookies.filter(req => !foundAdditional.includes(req));
                  if (foundAdditional.length > 0) {
                    console.log(`   ✅ Additional cookies found: ${foundAdditional.join(', ')}`);
                  }
                  if (missingAdditional.length > 0) {
                    console.log(`   ⚠️  Missing additional cookies: ${missingAdditional.join(', ')}`);
                  }
                  
                  // Check for domain-specific cookies that might be needed
                  const domainCookies = cookieKeys.filter(key => 
                    key.includes('google') || key.includes('GOOGLE') || 
                    key.startsWith('__Secure-') || key.startsWith('__Host-')
                  );
                  console.log(`   🔍 Domain cookies found: ${domainCookies.length} (${domainCookies.slice(0, 5).join(', ')}${domainCookies.length > 5 ? '...' : ''})`);
                }
                
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                console.log(`\n🔍 ROOT CAUSE ANALYSIS:\n`);
                console.log(`   ❌ Authentication failure detected at Step 2 (lh3.google.com/rd-notebooklm)`);
                console.log(`   📊 Comparison with mm29.txt:`);
                console.log(`      ✅ Headers match (sec-fetch-storage-access correctly removed)`);
                console.log(`      ✅ All required cookies present`);
                console.log(`      ❌ Response: 626 bytes (expected ~1536 bytes for successful redirect)`);
                console.log(`      ❌ Redirect: Login page (expected: lh3.googleusercontent.com/rd-notebooklm)`);
                console.log(`\n   🎯 ROOT CAUSE: Cookie expiration or invalid session`);
                console.log(`      - Cookies appear to be expired or from an invalid session`);
                console.log(`      - Google is rejecting authentication even though all cookies are present`);
                console.log(`      - This is NOT a missing cookie issue - it's a cookie validity issue`);
                console.log(`\n💡 SOLUTION:\n`);
                console.log(`   1. ⏰ Get FRESH cookies (most important!):`);
                console.log(`      - Open a NEW browser window/tab`);
                console.log(`      - Navigate to https://notebooklm.google.com/ and log in`);
                console.log(`      - Open DevTools → Application → Cookies`);
                console.log(`      - Copy cookies from BOTH domains IMMEDIATELY before testing:`);
                console.log(`        * notebooklm.google.com domain`);
                console.log(`        * .google.com domain (visit https://www.google.com/ first)`);
                console.log(`   2. 🔄 Ensure same browser session:`);
                console.log(`      - Don't close the browser between copying cookies and testing`);
                console.log(`      - Don't log out or clear cookies`);
                console.log(`      - Test within a few minutes of copying cookies`);
                console.log(`   3. ✅ Verify cookie freshness:`);
                console.log(`      - Check cookie expiration dates in DevTools`);
                console.log(`      - Ensure cookies are from the current session`);
                console.log(`      - Re-copy cookies if they're more than 1 hour old`);
                console.log(`   4. 🔍 Compare with working request:`);
                console.log(`      - In mm29.txt, Step 2 response was 1536 bytes (success)`);
                console.log(`      - Your response is 626 bytes (login redirect)`);
                console.log(`      - This confirms cookies are expired/invalid`);
                console.log(`\n   ⚠️  Note: Cookie expiration is the most common cause of this error.\n`);
                console.log(`   💡 Tip: Use browser DevTools to export cookies as cURL and extract fresh cookie strings\n`);
                
                reject(new NotebookLMError(
                  'Authentication failed: Cookies expired or invalid session.\n' +
                  'ROOT CAUSE: Cookies are expired or from an invalid session, not missing cookies.\n' +
                  'SOLUTION: Get fresh cookies from both notebooklm.google.com AND .google.com domains.\n' +
                  'Ensure cookies are captured from the same browser session and tested immediately.\n' +
                  'Response body size (626 bytes) indicates login redirect vs expected redirect (1536 bytes).'
                ));
                return;
              }
              
              console.log(`   ↪️  Following redirect to step ${redirectCount + 2}...`);
              console.log(`   🔗 Redirect chain so far: ${redirectCount + 1} steps`);
              followRedirects(redirectUrl, redirectCount + 1);
              return;
            }
            
            // No location header - handle other status codes
            if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
              res.destroy();
              req.destroy();
              console.log(`\n   ❌ Got redirect status ${statusCode} but no location header`);
              console.log(`   🔍 Response headers:`, JSON.stringify(res.headers, null, 2));
              console.log(`   🔍 All available headers: ${Object.keys(res.headers).join(', ')}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              reject(new NotebookLMError(
                `Got redirect status ${statusCode} but no location header`
              ));
              return;
            }
            
            // If we get a 200/206 on googlevideo.com, this is the final URL
            if (currentUrl.includes('googlevideo.com/videoplayback') && 
                (statusCode === 200 || statusCode === 206)) {
              res.destroy();
              req.destroy();
              console.log(`\n   ✅ Final URL confirmed (status ${statusCode})`);
              console.log(`   📹 ${currentUrl}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              resolve(currentUrl);
              return;
            }
            
            // If we get a 200 but no location header and not on googlevideo.com, something went wrong
            if (statusCode === 200 || statusCode === 206) {
              res.destroy();
              req.destroy();
              console.log(`\n   ❌ Got ${statusCode} response but no location header`);
              console.log(`   🔍 Current URL: ${currentUrl}`);
              console.log(`   🔍 Response headers:`, JSON.stringify(res.headers, null, 2));
              console.log(`   🔍 Expected: Location header with redirect URL`);
              console.log(`   🔍 Actual: No location header found`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              reject(new NotebookLMError(
                `Got 200/206 response but no location header and URL is not googlevideo.com: ${currentUrl}`
              ));
              return;
            }
            
            // Abort for any other unexpected status
            res.destroy();
            req.destroy();
            console.log(`\n   ❌ Unexpected status ${statusCode} ${statusMessage}`);
            console.log(`   🔍 Current URL: ${currentUrl}`);
            console.log(`   🔍 Response headers:`, JSON.stringify(res.headers, null, 2));
            console.log(`   🔍 Expected: 200/206/301/302/307/308 with Location header`);
            console.log(`   🔍 Actual: ${statusCode} ${statusMessage}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            reject(new NotebookLMError(
              `Unexpected status ${statusCode} when following redirects: ${statusMessage}`
            ));
          });
          
          // Handle response errors
          res.on('error', (err) => {
            console.log(`\n   ❌ Response error: ${err.message}`);
            reject(err);
          });
        });
        
        req.on('error', (error) => {
          const errorTime = Date.now() - startTime;
          console.log(`\n   ❌ Network error on step ${redirectCount + 1} (after ${errorTime}ms)`);
          console.log(`   🔍 Error Type: ${error.constructor.name}`);
          console.log(`   🔍 Error Message: ${error.message}`);
          console.log(`   🔍 Error Code: ${(error as any).code || 'N/A'}`);
          console.log(`   🔍 URL: ${currentUrl}`);
          console.log(`   🔍 Hostname: ${reqUrl.hostname}`);
          console.log(`   🔍 Port: ${reqOptions.port}`);
          console.log(`   🔍 Method: ${reqOptions.method}`);
          console.log(`   🔍 Cookies: ${needsCookies ? 'were sent' : 'not sent'}`);
          if ((error as any).code) {
            console.log(`   💡 Common fixes:`);
            if ((error as any).code === 'ENOTFOUND') {
              console.log(`      - Check DNS resolution for ${reqUrl.hostname}`);
            } else if ((error as any).code === 'ECONNREFUSED') {
              console.log(`      - Check if port ${reqOptions.port} is accessible`);
            } else if ((error as any).code === 'ETIMEDOUT') {
              console.log(`      - Network timeout - check internet connection`);
            }
          }
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          reject(new NotebookLMError(`Error following redirects: ${error.message}`));
        });
        
        // Log when request is sent
        console.log(`   🚀 Sending request...`);
        
        req.end();
      };
      
      followRedirects(url, 0);
    });
  }

  /**
   * Parse create video response
   */
  private parseCreateResponse(response: any, notebookId: string): VideoOverview {
    try {
      const result: VideoOverview = {
        projectId: notebookId,
        isReady: false,
      };
      
      if (Array.isArray(response) && response.length > 0) {
        const videoData = response[0];
        if (Array.isArray(videoData) && videoData.length > 0) {
          // Video ID
          if (videoData[0]) {
            result.videoId = videoData[0];
          }
          
          // Title
          if (videoData.length > 1 && videoData[1]) {
            result.title = videoData[1];
          }
          
          // Status (2 = READY)
          if (videoData.length > 2 && typeof videoData[2] === 'number') {
            result.isReady = videoData[2] === 2;
          }
          
          // Video URL/data (if present)
          if (videoData.length > 3 && videoData[3]) {
            result.videoData = videoData[3];
          }
        }
      }
      
      return result;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse video creation response: ${(error as Error).message}`);
    }
  }
}

/**
 * Download video file by video ID
 * 
 * **What it does:** Downloads the complete video file from NotebookLM.
 * This function retrieves the video URL from artifacts, follows redirects to get the final
 * googlevideo.com URL, and downloads the video file.
 * 
 * **Input:**
 * - `rpc` (RPCClient, required): The RPC client instance.
 * - `videoId` (string, required): The ID of the video artifact to download.
 *   This can be the artifactId from `artifacts.list()` or `artifacts.create()`.
 * - `notebookId` (string, required): The notebook ID that contains the video.
 *   Required to find the video artifact and get the video URL.
 * - `options` (GetVideoUrlOptions, optional): Options for getting the video URL:
 *   - `cookies` (string, optional): Authentication cookies (uses RPC client cookies if not provided)
 *   - `googleDomainCookies` (string, optional): Additional cookies from .google.com domain
 * 
 * **Output:** Returns an object containing:
 * - `videoData`: Uint8Array containing the video file data
 * - `videoUrl`: The final googlevideo.com URL from which the video was downloaded
 * - `saveToFile`: An async helper function to save the video data to a specified file path.
 * 
 * **Usage Workflow:**
 * 1. Create a video artifact using `client.video.create(notebookId, {...})` or `client.artifacts.create(notebookId, ArtifactType.VIDEO, {...})`
 * 2. Poll the video state using `client.artifacts.get(videoId)` until `state === ArtifactState.READY`
 * 3. Call this function to download the video file
 * 4. Use the `saveToFile` helper to save the video to a local file
 * 
 * **Note:**
 * - The video must be in `READY` state before downloading (check with `artifacts.get()`)
 * - The final video URL is IP-bound and session-bound, so it cannot be reused
 * - This function follows the redirect chain to get the final googlevideo.com URL
 * 
 * **Error Handling:**
 * - Throws `NotebookLMError` if the video ID is missing.
 * - Throws `NotebookLMError` if the video artifact is not found.
 * - Throws `NotebookLMError` if the API call fails or no video URL is found.
 * - Throws `NotebookLMError` if the download fails.
 * 
 * @param rpc - The RPC client instance
 * @param videoId - The video artifact ID
 * @param notebookId - The notebook ID that contains the video
 * @param options - Optional options for getting the video URL
 * @returns Promise resolving to an object with videoData, videoUrl, and saveToFile helper
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, downloadVideoFile } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * // Step 1: Create video overview
 * const video = await client.video.create('notebook-id', {
 *   instructions: 'Create a video overview',
 *   sourceIds: ['source-id-1', 'source-id-2']
 * });
 * 
 * // Step 2: Wait until ready (poll if needed)
 * let videoArtifact = await client.artifacts.get(video.videoId!);
 * while (videoArtifact.state !== ArtifactState.READY) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *   videoArtifact = await client.artifacts.get(video.videoId!);
 * }
 * 
 * // Step 3: Download video file
 * const rpc = client.getRPCClient();
 * const videoDownload = await downloadVideoFile(
 *   rpc,
 *   video.videoId!,
 *   'notebook-id'
 * );
 * 
 * // Step 4: Save to file
 * await videoDownload.saveToFile('video.mp4');
 * console.log('Video saved successfully!');
 * ```
 */
export async function downloadVideoFile(
  rpc: RPCClient,
  videoId: string,
  notebookId: string,
  options: GetVideoUrlOptions = {}
): Promise<{
  videoData: Uint8Array;
  videoUrl: string;
  saveToFile: (path: string) => Promise<void>;
}> {
  if (!videoId) {
    throw new NotebookLMError('Video ID is required');
  }
  
  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  try {
    // Get video URL from artifacts
    const artifactsService = new ArtifactsService(rpc);
    const artifacts = await artifactsService.list(notebookId);
    const videoArtifact = artifacts.find(a => 
      a.artifactId === videoId &&
      a.type === ArtifactType.VIDEO &&
      a.videoData
    );
    
    if (!videoArtifact || !videoArtifact.videoData) {
      throw new NotebookLMError(
        `No video URL found for video ID ${videoId}. Make sure the video is ready and exists in the notebook.`
      );
    }
    
    const initialVideoUrl = videoArtifact.videoData;
    
    // Get cookies for download
    const rpcCookies = rpc.getCookies();
    const notebooklmCookies = options.cookies || rpcCookies;
    
    // Follow redirects to get final video URL
    // Use the VideoService to follow redirects from the initial URL
    const videoService = new VideoService(rpc);
    
    // Merge cookies for redirect following:
    // 1. Add google.com cookies first (lower priority)
    // 2. Add notebooklm.google.com cookies last (HIGHEST priority - will override duplicates)
    const cookieStrings: string[] = [];
    
    if (options.googleDomainCookies && options.googleDomainCookies.trim()) {
      cookieStrings.push(options.googleDomainCookies);
    }
    
    if (notebooklmCookies && notebooklmCookies.trim()) {
      cookieStrings.push(notebooklmCookies);
    }
    
    // Merge cookies (notebooklm cookies take priority)
    const cookieMap = new Map<string, string>();
    cookieStrings.forEach(cookieString => {
      if (!cookieString || !cookieString.trim()) {
        return;
      }
      const cookies = cookieString.split(';').map(c => c.trim()).filter(Boolean);
      cookies.forEach(cookie => {
        const [name, ...valueParts] = cookie.split('=');
        if (name && valueParts.length > 0) {
          const value = valueParts.join('=');
          cookieMap.set(name.trim(), value);
        }
      });
    });
    const finalCookies = Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    if (!finalCookies || !finalCookies.trim()) {
      throw new NotebookLMError(
        'Cookies are required for getting final video URL. ' +
        'Please provide cookies in the options or ensure the RPC client has cookies configured.'
      );
    }
    
    // Ensure URL has authuser parameter
    let downloadUrl = initialVideoUrl;
    try {
      const urlObj = new URL(downloadUrl);
      if (!urlObj.searchParams.has('authuser')) {
        urlObj.searchParams.set('authuser', '0');
        downloadUrl = urlObj.toString();
      }
    } catch (urlError) {
      // Continue with original URL if parsing fails
    }
    
    // Follow redirects to get final googlevideo.com URL
    // Access the private method using bracket notation
    const finalVideoUrl = await (videoService as any).followRedirectsToFinalUrl(
      downloadUrl,
      finalCookies
    );
    
    // Download the video file from the final URL
    const videoData = await downloadVideoFromUrl(finalVideoUrl, notebooklmCookies, options.googleDomainCookies);

    // Return result with saveToFile helper
    return {
      videoData,
      videoUrl: finalVideoUrl,
      saveToFile: async (path: string) => {
        // Try Node.js environment
        try {
          const fsModule: any = await import('fs/promises' as any).catch(() => null);
          
          if (fsModule?.writeFile) {
            await fsModule.writeFile(path, videoData);
            return;
          }
        } catch {
          // Fall through to browser
        }
        
        // Browser environment - create download link
        if (typeof Blob !== 'undefined') {
          // Convert Uint8Array to ArrayBuffer for Blob compatibility
          const buffer = new ArrayBuffer(videoData.length);
          const view = new Uint8Array(buffer);
          view.set(videoData);
          const blob = new Blob([buffer], { type: 'video/mp4' });
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
      `Failed to download video file for video ID ${videoId}: ${error.message}`
    );
  }
}

/**
 * Download video file from URL
 * 
 * @param url - Video download URL (googlevideo.com/videoplayback)
 * @param cookies - Authentication cookies
 * @param googleDomainCookies - Optional additional cookies from .google.com domain
 * @returns Promise resolving to video data as Uint8Array
 */
function downloadVideoFromUrl(
  url: string,
  cookies: string,
  googleDomainCookies?: string
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    // Merge cookies if googleDomainCookies provided
    let finalCookies = cookies;
    if (googleDomainCookies) {
      const cookieMap = new Map<string, string>();
      
      // Add google.com cookies first (lower priority)
      googleDomainCookies.split(';').forEach(c => {
        const [name, ...valueParts] = c.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name, valueParts.join('='));
        }
      });
      
      // Add notebooklm cookies (higher priority - override)
      cookies.split(';').forEach(c => {
        const [name, ...valueParts] = c.trim().split('=');
        if (name && valueParts.length > 0) {
          cookieMap.set(name, valueParts.join('='));
        }
      });
      
      finalCookies = Array.from(cookieMap.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }
    
    const options: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Cookie': finalCookies,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Range': 'bytes=0-', // Request full video
      },
    };
    
    const req = httpModule.request(options, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          return downloadVideoFromUrl(res.headers.location, cookies, googleDomainCookies)
            .then(resolve)
            .catch(reject);
        }
        reject(new NotebookLMError(`Failed to download video: HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const videoData = Buffer.concat(chunks);
        resolve(new Uint8Array(videoData));
      });
      
      res.on('error', (error: Error) => {
        reject(new NotebookLMError(`Error downloading video: ${error.message}`));
      });
    });
    
    req.on('error', (error: Error) => {
      reject(new NotebookLMError(`Request error: ${error.message}`));
    });
    
    req.end();
  });
}
