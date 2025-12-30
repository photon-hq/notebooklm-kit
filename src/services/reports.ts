/**
 * Reports service
 * Handles report creation and export operations
 * 
 * ## Implementation Method
 * 
 * **Report Creation:**
 * 1. Use R7cb6c RPC to create a report artifact
 * 2. Report content is stored in the artifact and can be retrieved via artifacts.get()
 * 3. The report content (text) is available in the artifact's `tailored_report` field when state is READY
 * 
 * **Export Process:**
 * 1. Use Krh3pd RPC to export report to Google Docs (type 1) or Google Sheets (type 2)
 * 2. Returns a URL to the created document/sheet
 * 
 * **Report Content:**
 * After a report is created and reaches READY state, the report content (text) can be accessed via:
 * ```typescript
 * const artifact = await artifactsService.get(reportId, notebookId);
 * // Report content is in artifact.tailored_report.content
 * // Report sections are in artifact.tailored_report.sections
 * ```
 * 
 * **Based on:** `rpc/mm32.txt` - Report creation and export RPC calls
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import { NotebookLMError } from '../types/common.js';
import { ArtifactsService } from './artifacts.js';
import { ArtifactType, ArtifactState } from '../types/artifact.js';

/**
 * Options for creating a report
 */
export interface CreateReportOptions {
  /**
   * Instructions for the report generation
   * This is the prompt that guides what the report should contain
   */
  instructions?: string;
  
  /**
   * Source IDs to include in the report
   * If not provided, all sources in the notebook will be used
   */
  sourceIds?: string[];
  
  /**
   * Report title
   */
  title?: string;
  
  /**
   * Report subtitle/description
   */
  subtitle?: string;
  
  /**
   * Language code (default: 'en')
   */
  language?: string;
}

/**
 * Create a report artifact.
 *
 * This function creates a report artifact that synthesizes information from sources
 * in the notebook. The report content will be generated asynchronously.
 *
 * @param rpc - The RPCClient instance.
 * @param notebookId - The ID of the notebook containing the sources.
 * @param options - Options for report creation (instructions, sourceIds, title, subtitle, language).
 * @returns An Artifact object representing the created report.
 * @throws NotebookLMError if the notebook ID is missing or the creation fails.
 *
 * @example
 * ```typescript
 * import { NotebookLMClient } from 'notebooklm-kit';
 *
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 *
 * // Create a report with custom instructions
 * const report = await createReport(
 *   client.getRPCClient(),
 *   'notebook-id',
 *   {
 *     instructions: 'Create a comprehensive briefing document that synthesizes the main themes and ideas from the sources.',
 *     title: 'Briefing Doc',
 *     subtitle: 'Key insights and important quotes',
 *     sourceIds: ['source-id-1', 'source-id-2'],
 *     language: 'en'
 *   }
 * );
 *
 * console.log('Report created:', report.artifactId);
 * console.log('State:', report.state); // Will be CREATING initially
 * ```
 */
export async function createReport(
  rpc: RPCClient,
  notebookId: string,
  options: CreateReportOptions = {}
): Promise<{
  artifactId: string;
  state: ArtifactState;
  title?: string;
}> {
  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  const {
    instructions = '',
    sourceIds = [],
    title = 'Briefing Doc',
    subtitle = 'Key insights and important quotes',
    language = 'en',
  } = options;

  try {
    // Format source IDs as nested arrays: [[[sourceId1]], [[sourceId2]]]
    const formattedSourceIds = sourceIds.map(id => [[id]]);

    // Build the RPC arguments structure for report creation
    // Structure from mm32.txt: [[2], notebookId, [null, null, 2, [sourceIds...], null, null, null, [null, [title, subtitle, null, [sourceIdsFlat], language, instructions]]]]
    const sourceIdsFlat = formattedSourceIds.map(arr => arr[0]); // Flatten from [[[id]]] to [[id]]
    
    const args: any[] = [
      [2], // Mode
      notebookId,
      [
        null,
        null,
        2, // Artifact type: 2 = Report
        formattedSourceIds, // Source IDs at index 3: [[[id1]], [[id2]]]
        null,
        null,
        null,
        [null, [title, subtitle, null, sourceIdsFlat, language, instructions]], // Customization at index 7 (last element): [null, [title, subtitle, null, [[id1], [id2]], language, instructions]]
      ],
    ];

    // Call R7cb6c to create the report
    const response = await rpc.call(
      RPC.RPC_CREATE_REPORT,
      args,
      notebookId
    );

    // Parse the response to extract artifact ID
    const artifactId = extractArtifactIdFromResponse(response);
    
    if (!artifactId) {
      throw new NotebookLMError('Failed to extract artifact ID from report creation response');
    }

    // Return artifact info
    return {
      artifactId,
      state: ArtifactState.CREATING, // Reports start in CREATING state
      title,
    };
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(
      `Failed to create report: ${errorMessage}`
    );
  }
}

/**
 * Export a report to Google Docs.
 *
 * This function exports a report artifact to a Google Docs document.
 * The document will be created in the user's Google Drive.
 *
 * @param rpc - The RPCClient instance.
 * @param reportId - The ID of the report artifact to export.
 * @param notebookId - The ID of the notebook containing the report.
 * @param title - Optional title for the exported document (defaults to report title).
 * @returns The URL of the created Google Docs document.
 * @throws NotebookLMError if the report ID or notebook ID is missing, or the export fails.
 *
 * @example
 * ```typescript
 * import { NotebookLMClient, reportToDocs, ArtifactState } from 'notebooklm-kit';
 *
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 *
 * // Ensure the report is ready
 * const artifactsService = new ArtifactsService(client.getRPCClient());
 * let report = await artifactsService.get(reportId, notebookId);
 * while (report.state !== ArtifactState.READY) {
 *   console.log('Report is still being created, waiting...');
 *   await new Promise(resolve => setTimeout(resolve, 5000));
 *   report = await artifactsService.get(reportId, notebookId);
 * }
 *
 * // Export to Google Docs
 * const docUrl = await reportToDocs(
 *   client.getRPCClient(),
 *   reportId,
 *   notebookId,
 *   report.title || 'My Report'
 * );
 *
 * console.log('Report exported to:', docUrl);
 * ```
 */
export async function reportToDocs(
  rpc: RPCClient,
  reportId: string,
  notebookId: string,
  title?: string
): Promise<string> {
  if (!reportId) {
    throw new NotebookLMError('Report ID is required');
  }

  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  try {
    // Get report details to get the title if not provided
    if (!title) {
      const artifactsService = new ArtifactsService(rpc);
      const report = await artifactsService.get(reportId, notebookId);
      title = report.title || 'Report';
    }

    // Build the RPC arguments for export
    // Structure from mm32.txt: [null, artifactId, null, title, 1]
    // Type 1 = Google Docs
    const args: any[] = [
      null,
      reportId,
      null,
      title,
      1, // Export type: 1 = Google Docs
    ];

    // Call Krh3pd to export to Google Docs
    const response = await rpc.call(
      RPC.RPC_EXPORT_REPORT,
      args,
      notebookId
    );

    // Extract the Google Docs URL from the response
    const docUrl = extractExportUrlFromResponse(response);
    
    if (!docUrl) {
      throw new NotebookLMError('Failed to extract Google Docs URL from export response');
    }

    return docUrl;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(
      `Failed to export report to Google Docs: ${errorMessage}`
    );
  }
}

/**
 * Export a report to Google Sheets.
 *
 * This function exports a report artifact to a Google Sheets spreadsheet.
 * The spreadsheet will be created in the user's Google Drive.
 *
 * @param rpc - The RPCClient instance.
 * @param reportId - The ID of the report artifact to export.
 * @param notebookId - The ID of the notebook containing the report.
 * @param title - Optional title for the exported spreadsheet (defaults to report title).
 * @returns The URL of the created Google Sheets spreadsheet.
 * @throws NotebookLMError if the report ID or notebook ID is missing, or the export fails.
 *
 * @example
 * ```typescript
 * import { NotebookLMClient, reportToSheets, ArtifactState } from 'notebooklm-kit';
 *
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 *
 * // Ensure the report is ready
 * const artifactsService = new ArtifactsService(client.getRPCClient());
 * let report = await artifactsService.get(reportId, notebookId);
 * while (report.state !== ArtifactState.READY) {
 *   console.log('Report is still being created, waiting...');
 *   await new Promise(resolve => setTimeout(resolve, 5000));
 *   report = await artifactsService.get(reportId, notebookId);
 * }
 *
 * // Export to Google Sheets
 * const sheetUrl = await reportToSheets(
 *   client.getRPCClient(),
 *   reportId,
 *   notebookId,
 *   report.title || 'My Report'
 * );
 *
 * console.log('Report exported to:', sheetUrl);
 * ```
 */
export async function reportToSheets(
  rpc: RPCClient,
  reportId: string,
  notebookId: string,
  title?: string
): Promise<string> {
  if (!reportId) {
    throw new NotebookLMError('Report ID is required');
  }

  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  try {
    // Get report details to get the title if not provided
    if (!title) {
      const artifactsService = new ArtifactsService(rpc);
      const report = await artifactsService.get(reportId, notebookId);
      title = report.title || 'Report';
    }

    // Build the RPC arguments for export
    // Structure from mm32.txt: [null, artifactId, null, title, 2]
    // Type 2 = Google Sheets
    const args: any[] = [
      null,
      reportId,
      null,
      title,
      2, // Export type: 2 = Google Sheets
    ];

    // Call Krh3pd to export to Google Sheets
    const response = await rpc.call(
      RPC.RPC_EXPORT_REPORT,
      args,
      notebookId
    );

    // Extract the Google Sheets URL from the response
    const sheetUrl = extractExportUrlFromResponse(response);
    
    if (!sheetUrl) {
      throw new NotebookLMError('Failed to extract Google Sheets URL from export response');
    }

    return sheetUrl;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(
      `Failed to export report to Google Sheets: ${errorMessage}`
    );
  }
}

/**
 * Extract artifact ID from R7cb6c response
 */
function extractArtifactIdFromResponse(response: any): string | null {
  if (!response) {
    return null;
  }

  // The response structure is typically deeply nested
  // Try to find a UUID-like string (artifact ID format)
  const searchForArtifactId = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if it's a UUID-like string (artifact ID format)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(obj)) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = searchForArtifactId(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      // Check common keys
      if (obj.artifactId) {
        return obj.artifactId;
      }
      if (obj.id) {
        return obj.id;
      }
      
      // Search all values
      for (const value of Object.values(obj)) {
        const found = searchForArtifactId(value, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  };

  return searchForArtifactId(response);
}

/**
 * Report content structure
 */
export interface ReportContent {
  title: string;
  content: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

/**
 * Get report content from an artifact.
 * 
 * This function retrieves the full report content (title, main content, and sections)
 * from a report artifact that is in READY state.
 * 
 * @param rpc - The RPCClient instance.
 * @param reportId - The ID of the report artifact.
 * @param notebookId - The ID of the notebook containing the report.
 * @returns Report content with title, main content, and sections.
 * @throws NotebookLMError if the report ID or notebook ID is missing, the report is not found,
 *         or the report content cannot be extracted.
 * 
 * @example
 * ```typescript
 * import { NotebookLMClient, getReportContent } from 'notebooklm-kit';
 * 
 * const client = new NotebookLMClient({
 *   authToken: 'your-token',
 *   cookies: 'your-cookies',
 * });
 * 
 * const rpc = client.getRPCClient();
 * const reportContent = await getReportContent(rpc, 'report-id', 'notebook-id');
 * console.log('Report Title:', reportContent.title);
 * console.log('Report Content:', reportContent.content);
 * ```
 */
export async function getReportContent(
  rpc: RPCClient,
  reportId: string,
  notebookId: string
): Promise<ReportContent> {
  if (!reportId) {
    throw new NotebookLMError('Report ID is required');
  }
  
  if (!notebookId) {
    throw new NotebookLMError('Notebook ID is required');
  }

  try {
    const artifactsService = new ArtifactsService(rpc);
    
    // Get artifact details (for title)
    let artifactTitle = 'Report';
    try {
      const artifact = await artifactsService.get(reportId, notebookId);
      artifactTitle = artifact.title || 'Report';
    } catch {
      // If get fails, try listing to get title
      const artifacts = await artifactsService.list(notebookId);
      const reportArtifact = artifacts.find(a => a.artifactId === reportId);
      if (reportArtifact) {
        artifactTitle = reportArtifact.title || 'Report';
      }
    }
    
    // BnLyuf (RPC_GET_ARTIFACT) fails with HTTP 400 for reports
    // Use gArtLc (RPC_LIST_ARTIFACTS) instead to get the full artifact data
    const listResponse = await rpc.call(
      RPC.RPC_LIST_ARTIFACTS,
      [[2], notebookId],
      notebookId
    );
    
    // Find the specific report entry in the list response
    const reportEntry = findReportEntryInListResponse(listResponse, reportId);
    
    if (!reportEntry) {
      throw new NotebookLMError(
        `Report ${reportId} not found in artifacts list. Make sure the report exists and is in READY state.`
      );
    }
    
    // Extract report content from the entry
    const reportContent = extractReportContentFromResponse(reportEntry, artifactTitle);
    
    if (!reportContent) {
      throw new NotebookLMError(
        `Failed to extract report content for report ID ${reportId}. ` +
        `The report data structure may be incomplete. Make sure the report is in READY state.`
      );
    }
    
    return reportContent;
  } catch (error: any) {
    const errorMessage = error instanceof NotebookLMError ? error.message : String(error);
    throw new NotebookLMError(
      `Failed to get report content for report ID ${reportId}: ${errorMessage}`
    );
  }
}

/**
 * Format report content as Markdown
 */
export function formatReportAsMarkdown(report: ReportContent): string {
  let markdown = `# ${report.title}\n\n`;
  
  if (report.content) {
    markdown += `${report.content}\n\n`;
  }
  
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      markdown += `## ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
    }
  }
  
  return markdown;
}

/**
 * Format report content as plain text
 */
export function formatReportAsText(report: ReportContent): string {
  let text = `${report.title}\n`;
  text += '='.repeat(report.title.length) + '\n\n';
  
  if (report.content) {
    text += `${report.content}\n\n`;
  }
  
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      text += `${section.title}\n`;
      text += '-'.repeat(section.title.length) + '\n\n';
      text += `${section.content}\n\n`;
    }
  }
  
  return text;
}

/**
 * Format report content as HTML
 */
export function formatReportAsHTML(report: ReportContent): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #1a73e8;
      border-bottom: 2px solid #1a73e8;
      padding-bottom: 10px;
    }
    h2 {
      color: #5f6368;
      margin-top: 30px;
    }
    p {
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
`;
  
  if (report.content) {
    html += `  <div>${formatTextAsHTML(report.content)}</div>\n`;
  }
  
  if (report.sections && report.sections.length > 0) {
    for (const section of report.sections) {
      html += `  <h2>${escapeHtml(section.title)}</h2>\n`;
      html += `  <div>${formatTextAsHTML(section.content)}</div>\n`;
    }
  }
  
  html += `</body>
</html>`;
  
  return html;
}

/**
 * Format report content as JSON
 */
export function formatReportAsJSON(report: ReportContent): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Find the specific report entry within the raw RPC_LIST_ARTIFACTS response.
 * Similar to findSlideEntryInListResponse but for reports.
 *
 * @param listResponse - The raw response from RPC_LIST_ARTIFACTS.
 * @param reportId - The ID of the report to find.
 * @returns The array entry for the report, or null if not found.
 */
function findReportEntryInListResponse(listResponse: any, reportId: string): any | null {
  if (!Array.isArray(listResponse) || listResponse.length === 0) {
    return null;
  }

  // The actual list of artifacts is usually deeply nested, e.g., response[0][0] or response[0][1]
  // We need to find the array that contains artifact entries like [artifactId, title, type, ...]
  const searchRecursive = (data: any): any | null => {
    if (Array.isArray(data)) {
      for (const item of data) {
        // An artifact entry typically starts with its ID (string)
        if (Array.isArray(item) && typeof item[0] === 'string' && item[0] === reportId) {
          // Further check if it looks like a report (type 2)
          // The type is usually at index 2 or 3
          if (item.includes(2) || item.some((val: any) => val === 2)) {
            return item;
          }
        }
        const found = searchRecursive(item);
        if (found) return found;
      }
    }
    return null;
  };

  return searchRecursive(listResponse);
}

/**
 * Extract report content from RPC response
 * The report content can be in various formats:
 * - As a nested object with tailored_report field
 * - As a JSON string that needs parsing
 * - As a deeply nested array structure
 */
function extractReportContentFromResponse(response: any, defaultTitle: string): ReportContent | null {
  if (!response) {
    return null;
  }

  // Search for report structure: { title, content, sections: [{ title, content }] }
  const searchForReport = (obj: any, depth = 0): ReportContent | null => {
    if (depth > 20) return null; // Prevent infinite recursion, allow deeper search for nested arrays
    
    // Check if object has report-like structure
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      // Check for tailored_report structure
      if (obj.tailored_report) {
        const report = obj.tailored_report;
        if (report.title || report.content) {
          return {
            title: report.title || defaultTitle,
            content: report.content || '',
            sections: report.sections || [],
          };
        }
      }
      
      // Check if object itself is a report structure
      if (typeof obj.title === 'string' && typeof obj.content === 'string') {
        return {
          title: obj.title || defaultTitle,
          content: obj.content || '',
          sections: obj.sections || [],
        };
      }
      
      // Search in nested objects
      for (const value of Object.values(obj)) {
        const found = searchForReport(value, depth + 1);
        if (found) return found;
      }
    } else if (Array.isArray(obj)) {
      // For arrays, search each element
      for (const item of obj) {
        const found = searchForReport(item, depth + 1);
        if (found) return found;
      }
      
      // Also check if the array itself contains report-like data
      // Look for patterns like [..., "title", "content", ...] or [..., {title, content}, ...]
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        
        // Check if we have a title string followed by content string
        if (typeof item === 'string' && item.length > 10) {
          // Could be title or content - check next item
          if (i + 1 < obj.length && typeof obj[i + 1] === 'string' && obj[i + 1].length > 50) {
            // Likely title and content pair
            return {
              title: item || defaultTitle,
              content: obj[i + 1] || '',
              sections: [],
            };
          }
        }
      }
    } else if (typeof obj === 'string') {
      // Try to parse as JSON string (common in RPC responses)
      if ((obj.startsWith('{') || obj.startsWith('[')) && obj.length > 10) {
        try {
          const parsed = JSON.parse(obj);
          const found = searchForReport(parsed, depth + 1);
          if (found) return found;
        } catch {
          // Not valid JSON, continue
        }
      }
      
      // Check if string contains report-like patterns
      // Look for JSON-like structures within the string
      const jsonMatch = obj.match(/\{"title":\s*"[^"]+",\s*"content":\s*"[^"]+"/);
      if (jsonMatch) {
        try {
          // Try to extract and parse the JSON
          const startIdx = obj.indexOf('{');
          const endIdx = obj.lastIndexOf('}');
          if (startIdx >= 0 && endIdx > startIdx) {
            const jsonStr = obj.substring(startIdx, endIdx + 1);
            const parsed = JSON.parse(jsonStr);
            const found = searchForReport(parsed, depth + 1);
            if (found) return found;
          }
        } catch {
          // Continue searching
        }
      }
    }
    
    return null;
  };

  return searchForReport(response);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format plain text as HTML (preserve line breaks)
 */
function formatTextAsHTML(text: string): string {
  return escapeHtml(text)
    .split('\n')
    .map((line) => line.trim() ? `<p>${line}</p>` : '<br>')
    .join('\n');
}

/**
 * Extract export URL from Krh3pd response
 */
function extractExportUrlFromResponse(response: any): string | null {
  if (!response) {
    return null;
  }

  // Convert to string first to search for URL patterns
  const responseString = JSON.stringify(response);
  
  // Look for Google Docs or Sheets URL patterns
  const docsPattern = /https?:\/\/docs\.google\.com\/document\/d\/[^\s"',\]\}]+/g;
  const sheetsPattern = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/[^\s"',\]\}]+/g;
  
  const docsMatch = responseString.match(docsPattern);
  if (docsMatch && docsMatch[0]) {
    return docsMatch[0];
  }
  
  const sheetsMatch = responseString.match(sheetsPattern);
  if (sheetsMatch && sheetsMatch[0]) {
    return sheetsMatch[0];
  }

  // Also try recursive search for nested structures
  const searchForUrl = (obj: any, depth = 0): string | null => {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (typeof obj === 'string') {
      // Check if string contains Google Docs/Sheets URL
      if (obj.includes('docs.google.com/document/') || obj.includes('docs.google.com/spreadsheets/')) {
        // Extract full URL if it's embedded in a string
        const urlMatch = obj.match(/https?:\/\/docs\.google\.com\/(document|spreadsheets)\/d\/[^\s"',\]\}]+/);
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
        const found = searchForUrl(item, depth + 1);
        if (found) return found;
      }
    } else if (obj && typeof obj === 'object') {
      // Check object properties - prioritize certain keys
      const priorityKeys = ['url', 'documentUrl', 'sheetUrl', 'exportUrl', 'link', 'href'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const found = searchForUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      
      // Check all properties
      for (const key in obj) {
        if (key.toLowerCase().includes('url') || 
            key.toLowerCase().includes('link') ||
            key.toLowerCase().includes('href')) {
          const found = searchForUrl(obj[key], depth + 1);
          if (found) return found;
        }
      }
      
      // Also search all values
      for (const value of Object.values(obj)) {
        const found = searchForUrl(value, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return searchForUrl(response);
}

