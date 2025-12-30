/**
 * Chunked response parser for NotebookLM's special response format
 * Handles the complex chunked format used by NotebookLM API responses
 */

import { NotebookLMParseError } from '../types/common.js';

/**
 * Chunked response parser
 * Specialized parser for NotebookLM's chunked response format
 */
export class ChunkedResponseParser {
  private rawChunks: string[] = [];
  private cleanedData: string = '';
  
  constructor(
    private raw: string,
    private debug: boolean = false
  ) {}
  
  /**
   * Parse list of projects from response
   */
  parseListProjectsResponse(): any[] {
    // Initialize chunks
    this.rawChunks = this.extractChunks();
    
    // Try different parsing methods
    // Step 1: Standard JSON (preferred method for wXbhsf)
    try {
      const projects = this.parseStandardJSON();
      if (projects.length >= 0) { // Allow empty arrays
        this.logDebug(`Successfully parsed ${projects.length} projects using standard JSON method`);
        return projects;
      }
    } catch (error) {
      this.logDebug(`Standard JSON parsing failed: ${(error as Error).message}, trying regex method`);
    }
    
    // Step 2: Regex-based extraction
    try {
      const projects = this.parseWithRegex();
      if (projects.length > 0) {
        this.logDebug(`Successfully parsed ${projects.length} projects using regex method`);
        return projects;
      }
    } catch (error) {
      this.logDebug(`Regex parsing failed: ${(error as Error).message}, trying direct scan method`);
    }
    
    // Step 3: Direct scanning (last resort - may extract sources, so we filter)
    try {
      const allProjects = this.parseDirectScan();
      if (allProjects.length > 0) {
        // Filter out sources: only keep items where projectId matches a notebook ID pattern
        // Notebooks have titles, sources don't (or have different structure)
        const projects = allProjects.filter((p: any) => {
          // If title is empty or looks like a source title, skip it
          if (!p.title || p.title.trim() === '') return false;
          // If title looks like a file name (has extension), might be a source
          if (/\.(pdf|png|jpg|jpeg|mp3|mp4|txt)$/i.test(p.title)) return false;
          return true;
        });
        this.logDebug(`Successfully parsed ${projects.length} projects using direct scan method (filtered from ${allProjects.length} total)`);
        return projects;
      }
    } catch (error) {
      this.logDebug(`Direct scan failed: ${(error as Error).message}`);
    }
    
    // Step 4: Check if response indicates empty list (metadata-only response)
    try {
      if (this.checkEmptyResponse()) {
        this.logDebug('Response appears to be empty list (metadata only)');
        return [];
      }
    } catch (error) {
      this.logDebug(`Empty response check failed: ${(error as Error).message}`);
    }
    
    throw new NotebookLMParseError('Failed to parse projects response with all methods');
  }
  
  /**
   * Check if response is an empty list (metadata-only)
   */
  private checkEmptyResponse(): boolean {
    // Look for metadata-only response patterns
    // Pattern: [null, [pagination], [metadata], ...] without actual project data
    for (const chunk of this.rawChunks) {
      if (chunk.includes('"wrb.fr"') && (chunk.includes('"hT54vc"') || chunk.includes('"ozz5Z"'))) {
        try {
          const parsed = JSON.parse(chunk);
          if (Array.isArray(parsed) && parsed.length >= 3 && typeof parsed[2] === 'string') {
            const innerData = JSON.parse(JSON.parse(`"${parsed[2]}"`));
            // Check if it's a metadata-only structure (no project arrays)
            if (Array.isArray(innerData) && innerData.length > 0) {
              // If first element is null and structure looks like metadata, likely empty
              if (innerData[0] === null && !this.containsProjectData(innerData)) {
                return true;
              }
            }
          }
        } catch {
          // Continue to other checks
        }
      }
    }
    return false;
  }
  
  /**
   * Check if data structure contains project-like data
   */
  private containsProjectData(data: any): boolean {
    if (!Array.isArray(data)) return false;
    
    // Look for arrays that look like projects: [title, ..., projectId, emoji, ...]
    for (const item of data) {
      if (Array.isArray(item) && item.length >= 3) {
        // Check if it has a UUID-like projectId at position 2
        const possibleId = item[2];
        if (typeof possibleId === 'string' && /^[a-f0-9-]{36}$/i.test(possibleId)) {
          return true;
        }
      }
      // Recursively check nested arrays
      if (Array.isArray(item) && this.containsProjectData(item)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Extract and clean chunks from raw response
   */
  private extractChunks(): string[] {
    // Remove typical chunked response header
    let cleanedResponse = this.raw.trim().replace(/^\)\]\}'/, '');
    
    // Handle trailing digits (chunk size indicators)
    if (cleanedResponse.length > 0) {
      cleanedResponse = cleanedResponse.replace(/\n\d+$/, '');
    }
    
    this.cleanedData = cleanedResponse;
    
    // Split by newline
    const chunks = cleanedResponse.split('\n');
    
    // Filter out numeric-only chunks (chunk size indicators)
    return chunks.filter(chunk => !this.isNumeric(chunk.trim()));
  }
  
  /**
   * Parse using standard JSON techniques
   */
  private parseStandardJSON(): any[] {
    let jsonSection = '';
    
    // First, check if the raw response is already a valid JSON array (direct JSON, not chunked)
    try {
      const directParse = JSON.parse(this.raw.trim());
      if (Array.isArray(directParse)) {
        // This is a direct JSON array - parse it directly
        this.logDebug('Response is a direct JSON array, parsing directly');
        // Handle triple-nested structure: [[[notebook1], [notebook2], ...]]
        let projectsData = directParse;
        if (Array.isArray(directParse) && directParse.length === 1 && Array.isArray(directParse[0])) {
          projectsData = directParse[0];
        }
        return this.parseProjectsArray(projectsData);
      }
    } catch {
      // Not a direct JSON array, continue with chunked parsing
    }
    
    // Look for chunk containing "wrb.fr" with project list RPCs
    for (const chunk of this.rawChunks) {
      if (chunk.includes('"wrb.fr"') && (chunk.includes('"hT54vc"') || chunk.includes('"wXbhsf"') || chunk.includes('"ozz5Z"'))) {
        jsonSection = chunk;
        break;
      }
    }
    
    if (!jsonSection) {
      throw new Error('Failed to find JSON section containing wrb.fr');
    }
    
    // Try to parse as JSON
    let wrbResponse: any[];
    try {
      wrbResponse = JSON.parse(jsonSection);
    } catch {
      // Try extracting just the array part
      const arrayStart = jsonSection.indexOf('[[');
      const arrayEnd = jsonSection.lastIndexOf(']]');
      
      if (arrayStart >= 0 && arrayEnd > arrayStart) {
        const arrayString = jsonSection.substring(arrayStart, arrayEnd + 2);
        wrbResponse = JSON.parse(arrayString);
      } else {
        throw new Error('Failed to parse JSON');
      }
    }
    
    if (wrbResponse.length < 3) {
      throw new Error(`Unexpected response format: array too short (len=${wrbResponse.length})`);
    }
    
    // Extract projects data from position 2
    let projectsRaw: string;
    if (typeof wrbResponse[2] === 'string') {
      projectsRaw = wrbResponse[2];
    } else {
      throw new Error(`Unexpected type for project data: ${typeof wrbResponse[2]}`);
    }
    
    // Unescape the JSON string
    let unescaped: string;
    try {
      unescaped = JSON.parse(`"${projectsRaw}"`);
    } catch {
      throw new Error('Failed to unescape project data');
    }
    
    // Parse as array
    let projectsData: any;
    try {
      projectsData = JSON.parse(unescaped);
    } catch (error) {
      // Try parsing as object
      if ((error as Error).message.includes('cannot unmarshal object')) {
        return this.parseAsObject(unescaped);
      }
      throw new Error('Failed to parse project data as array');
    }
    
    // Check if this is a metadata-only response (empty list)
    if (Array.isArray(projectsData) && projectsData.length >= 2) {
      // Empty list response pattern: [null, [pagination], [metadata], ...]
      // First element is null, second is pagination [1,100,50,500000], third is metadata
      if (projectsData[0] === null && 
          Array.isArray(projectsData[1]) && 
          projectsData[1].length === 4 &&
          typeof projectsData[1][0] === 'number') {
        // This is a valid empty list response - return empty array
        this.logDebug('Recognized empty list response (metadata-only structure)');
        return [];
      }
    }
    
    // Parse the projects data array
    return this.parseProjectsArray(projectsData);
  }
  
  /**
   * Parse projects array into notebook objects
   */
  private parseProjectsArray(projectsData: any): any[] {
    // Handle different response structures
    const projects: any[] = [];
    
    // Helper to check if a string looks like a UUID (notebook ID)
    const isUUIDLike = (str: any): boolean => {
      if (typeof str !== 'string') return false;
      // UUID format: 8-4-4-4-12 hex digits with dashes
      return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str);
    };
    
    // Handle triple-nested structure: [[[notebook1], [notebook2], ...]]
    // wXbhsf returns: [[[title, [sources...], notebook_id, emoji, ...], ...]]
    let notebooksArray = projectsData;
    if (Array.isArray(projectsData) && projectsData.length === 1 && Array.isArray(projectsData[0])) {
      // Triple-nested: use the inner array
      notebooksArray = projectsData[0];
    }
    
    // Case 1: notebooksArray is an array of notebook arrays
    if (Array.isArray(notebooksArray)) {
      this.logDebug(`Processing ${notebooksArray.length} items in notebooks array`);
      for (const item of notebooksArray) {
        if (!Array.isArray(item) || item.length < 3) {
          this.logDebug(`Skipping item: not array or too short (len=${item.length})`);
          continue;
        }
        
        // wXbhsf structure: [title, [sources...] or null, notebook_id, emoji, ...]
        // CRITICAL: Skip if this looks like a source array (nested inside notebook)
        // Sources have structure: [[source_id], source_title, ...] where source_id is at index 0
        // Notebooks have structure: [title, [sources...], notebook_id, emoji] where title is at index 0
        const firstElement = item[0];
        
        // If first element is an array containing a UUID (source ID), this is a source, skip it
        if (Array.isArray(firstElement) && firstElement.length > 0 && isUUIDLike(firstElement[0])) {
          this.logDebug(`Skipping source: first element is array with UUID ${firstElement[0]}`);
          continue; // This is a source, not a notebook
        }
        
        const title = item[0];
        const sourcesOrId = item[1];
        const possibleId = item[2];
        const emoji = item[3];
        
        // Pattern 1: [title, [sources...] or null, notebook_id, emoji] - wXbhsf format
        // Validate: 
        // - index 0 (title) must be a string (can be empty)
        // - index 1 (sourcesOrId) must be an array (sources) OR null
        // - index 2 (possibleId) must be a valid UUID (notebook ID)
        // - index 3 (emoji) is optional
        if (typeof title === 'string' && (Array.isArray(sourcesOrId) || sourcesOrId === null) && isUUIDLike(possibleId)) {
          // Additional validation: if sourcesOrId is an array, verify it contains source structures
          // Sources have structure: [[source_id], source_title, ...]
          if (Array.isArray(sourcesOrId) && sourcesOrId.length > 0) {
            const firstSource = sourcesOrId[0];
            // If first source doesn't look like a source array ([[source_id], ...]), skip
            if (!Array.isArray(firstSource) || firstSource.length === 0 || !Array.isArray(firstSource[0])) {
              this.logDebug(`Skipping item: sources array doesn't contain valid source structures`);
              continue;
            }
          }
          
          // Count sources: sourcesOrId is either null or an array of sources
          const sourceCount = Array.isArray(sourcesOrId) ? sourcesOrId.length : 0;
          
          const project: any = {
            title: title.trim() || 'Untitled notebook',
            projectId: possibleId,
            emoji: typeof emoji === 'string' && emoji.trim() ? emoji : '📄',
            sourceCount,
          };
          
          this.logDebug(`Extracted notebook: ${project.title} (${possibleId}) with ${sourceCount} sources`);
          projects.push(project);
          continue; // Skip to next item
        }
        
        // Pattern 2: [title, ..., projectId, emoji] - simpler format (no nested sources, sourcesOrId is not an array)
        // Only use this if pattern 1 didn't match and index 1 is NOT an array or null
        if (typeof title === 'string' && !Array.isArray(sourcesOrId) && sourcesOrId !== null && isUUIDLike(possibleId)) {
          // No sources in this format
          const project: any = {
            title: title.trim() || 'Untitled notebook',
            projectId: possibleId,
            emoji: typeof emoji === 'string' && emoji.trim() ? emoji : '📄',
            sourceCount: 0,
          };
          
          this.logDebug(`Extracted notebook (pattern 2): ${project.title} (${possibleId}) with 0 sources`);
          projects.push(project);
        } else {
          this.logDebug(`Skipping item: doesn't match notebook pattern (title=${typeof title}, sourcesOrId=${typeof sourcesOrId}, possibleId=${typeof possibleId})`);
        }
      }
    }
    
    this.logDebug(`Total notebooks extracted: ${projects.length}`);
    
    // If no projects found, return empty array (valid empty list)
    return projects;
  }
  
  /**
   * Parse as object format
   */
  private parseAsObject(data: string): any[] {
    const projectMap = JSON.parse(data);
    const projects: any[] = [];
    
    for (const [key, value] of Object.entries(projectMap)) {
      if (this.isUUIDLike(key)) {
        const proj: any = {
          projectId: key,
          title: '',
          emoji: '📄',
        };
        
        if (typeof value === 'object' && value !== null) {
          const objValue = value as any;
          proj.title = objValue.title || objValue.name || `Project ${key.substring(0, 8)}`;
          if (objValue.emoji) {
            proj.emoji = objValue.emoji;
          }
        }
        
        projects.push(proj);
      }
    }
    
    if (projects.length === 0) {
      throw new Error('No projects found in object format');
    }
    
    return projects;
  }
  
  /**
   * Parse using regex patterns
   */
  private parseWithRegex(): any[] {
    // Find wrb.fr section (supports hT54vc, wXbhsf, and ozz5Z RPC IDs)
    const wrbfrPattern = /\[\["wrb\.fr","(?:hT54vc|wXbhsf|ozz5Z)","(.*?)",/;
    const matches = this.cleanedData.match(wrbfrPattern);
    
    if (!matches || matches.length < 2) {
      throw new Error('Could not find project data section in response');
    }
    
    // Unescape
    let projectDataStr = matches[1];
    projectDataStr = projectDataStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    this.logDebug(`Project data string (first 100 chars): ${projectDataStr.substring(0, 100)}`);
    
    // Find projects
    const projects: any[] = [];
    const titlePattern = /\[\[\["([^"]+?)"/g;
    let match: RegExpExecArray | null;
    
    while ((match = titlePattern.exec(projectDataStr)) !== null) {
      const title = match[1];
      if (!title) continue;
      
      // Look for project ID near title
      const idPattern = new RegExp(`\\["${this.escapeRegex(title)}"[^\\]]*?,[^\\]]*?,"([a-zA-Z0-9-]+)"`);
      const idMatch = projectDataStr.match(idPattern);
      
      let projectId = '';
      if (idMatch && idMatch[1]) {
        projectId = idMatch[1];
      } else {
        // Try to find UUID-like pattern nearby
        const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;
        const titleIndex = projectDataStr.indexOf(title);
        if (titleIndex > 0) {
          const searchEnd = Math.min(titleIndex + 500, projectDataStr.length);
          const uuidMatch = projectDataStr.substring(titleIndex, searchEnd).match(uuidPattern);
          if (uuidMatch) {
            projectId = uuidMatch[0];
          }
        }
      }
      
      if (!projectId) continue;
      
      // Look for emoji
      let emoji = '📄';
      const projectIdIndex = projectDataStr.indexOf(projectId);
      if (projectIdIndex > 0) {
        const searchEnd = Math.min(projectIdIndex + 100, projectDataStr.length);
        const emojiPattern = /"([^"]{1,5})"/g;
        const emojiSection = projectDataStr.substring(projectIdIndex, searchEnd);
        let emojiMatch: RegExpExecArray | null;
        
        while ((emojiMatch = emojiPattern.exec(emojiSection)) !== null) {
          if (emojiMatch[1] && emojiMatch[1].length <= 2) {
            emoji = emojiMatch[1];
            break;
          }
        }
      }
      
      projects.push({ title, projectId, emoji });
    }
    
    if (projects.length === 0) {
      throw new Error('No projects found using regex patterns');
    }
    
    return projects;
  }
  
  /**
   * Parse using direct scanning
   */
  private parseDirectScan(): any[] {
    // Find all UUID patterns
    const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g;
    const uuidMatches = this.cleanedData.match(uuidPattern) || [];
    
    if (uuidMatches.length === 0) {
      throw new Error('No UUID-like project IDs found in the response');
    }
    
    // Deduplicate
    const uniqueIds = Array.from(new Set(uuidMatches));
    const projects: any[] = [];
    
    for (const id of uniqueIds) {
      const project: any = {
        projectId: id,
        title: '',
        emoji: '📄',
      };
      
      // Find title near ID
      const idIndex = this.cleanedData.indexOf(id);
      if (idIndex > 0) {
        const beforeStart = Math.max(0, idIndex - 500);
        const beforeText = this.cleanedData.substring(beforeStart, idIndex);
        
        // Look for title in quotes
        const titlePattern = /"([^"]{3,100})"/g;
        const titleMatches: string[] = [];
        let titleMatch: RegExpExecArray | null;
        
        while ((titleMatch = titlePattern.exec(beforeText)) !== null) {
          if (titleMatch[1]) {
            titleMatches.push(titleMatch[1]);
          }
        }
        
        if (titleMatches.length > 0) {
          project.title = titleMatches[titleMatches.length - 1]; // Closest to ID
        }
        
        // Look for emoji after ID
        const afterEnd = Math.min(this.cleanedData.length, idIndex + 100);
        const afterText = this.cleanedData.substring(idIndex, afterEnd);
        const emojiPattern = /"([^"]{1,2})"/;
        const emojiMatch = afterText.match(emojiPattern);
        
        if (emojiMatch && emojiMatch[1]) {
          project.emoji = emojiMatch[1];
        }
      }
      
      if (!project.title) {
        project.title = `Notebook ${id.substring(0, 8)}`;
      }
      
      projects.push(project);
    }
    
    return projects;
  }
  
  // ========================================================================
  // Helper methods
  // ========================================================================
  
  private isNumeric(s: string): boolean {
    return /^\d+$/.test(s.trim());
  }
  
  private isUUIDLike(s: string): boolean {
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  private logDebug(message: string): void {
    if (this.debug && typeof console !== 'undefined') {
      console.log(`[ChunkedParser] ${message}`);
    }
  }
}

/**
 * Create a chunked response parser
 */
export function createChunkedParser(raw: string, debug: boolean = false): ChunkedResponseParser {
  return new ChunkedResponseParser(raw, debug);
}

