/**
 * Extract dynamic page metadata (bl, f.sid, SNlM0e) from the NotebookLM page.
 *
 * Google periodically rotates the build version (`bl`) and session identifier
 * (`f.sid`).  Hard-coding stale values eventually leads to 503 errors on
 * certain RPC endpoints (e.g. MutateAccount / hT54vc).
 *
 * This utility fetches the NotebookLM landing page with the caller's session
 * cookies and extracts the current values from the inline JavaScript payload.
 */

export interface PageMetadata {
  /** Build version, e.g. "boq_labs-tailwind-frontend_20260226.08_p0" */
  bl: string | null;
  /** Session ID (FdrFJe value) */
  fsid: string | null;
  /** Auth token (SNlM0e value) */
  authToken: string | null;
}

/**
 * Fetch the NotebookLM page and extract bl, f.sid, and SNlM0e.
 *
 * @param cookies - Cookie header string for an authenticated session
 * @returns Extracted metadata (null fields when extraction fails)
 */
export async function extractPageMetadata(cookies: string): Promise<PageMetadata> {
  const res = await fetch('https://notebooklm.google.com/', {
    headers: {
      'Cookie': cookies,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    return { bl: null, fsid: null, authToken: null };
  }

  const body = await res.text();

  // bl: appears as a quoted string in the page source
  const blMatch = body.match(/boq_labs-tailwind-frontend_[^"'\s,]+/);

  // f.sid (FdrFJe): JSON key-value inside the page's config object
  const fsidMatch = body.match(/FdrFJe":"([^"]+)"/);

  // SNlM0e: auth token embedded in WIZ_global_data
  const authMatch = body.match(/SNlM0e":"([^"]+)"/);

  return {
    bl: blMatch ? blMatch[0] : null,
    fsid: fsidMatch ? fsidMatch[1] : null,
    authToken: authMatch ? authMatch[1] : null,
  };
}
