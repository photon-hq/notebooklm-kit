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
    // Step 1: Standard JSON
    try {
      const projects = this.parseStandardJSON();
      if (projects.length > 0) {
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
    
    // Step 3: Direct scanning
    try {
      const projects = this.parseDirectScan();
      if (projects.length > 0) {
        this.logDebug(`Successfully parsed ${projects.length} projects using direct scan method`);
        return projects;
      }
    } catch (error) {
      this.logDebug(`Direct scan failed: ${(error as Error).message}`);
    }
    
    throw new NotebookLMParseError('Failed to parse projects response with all methods');
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
    
    // Look for chunk containing "wrb.fr"
    for (const chunk of this.rawChunks) {
      if (chunk.includes('"wrb.fr"') && chunk.includes('"wXbhsf"')) {
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
    let projectsData: any[];
    try {
      projectsData = JSON.parse(unescaped);
    } catch (error) {
      // Try parsing as object
      if ((error as Error).message.includes('cannot unmarshal object')) {
        return this.parseAsObject(unescaped);
      }
      throw new Error('Failed to parse project data as array');
    }
    
    // Extract projects
    const projects: any[] = [];
    for (const item of projectsData) {
      if (!Array.isArray(item) || item.length < 3) {
        continue;
      }
      
      const project: any = {
        title: item[0] || '',
        projectId: item[2] || '',
        emoji: item[3] || '📄',
      };
      
      if (project.projectId) {
        projects.push(project);
      }
    }
    
    if (projects.length === 0) {
      throw new Error('Parsed JSON but found no valid projects');
    }
    
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
    // Find wrb.fr section
    const wrbfrPattern = /\[\["wrb\.fr","wXbhsf","(.*?)",/;
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

