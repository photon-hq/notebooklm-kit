/**
 * Chunked response decoder for batchexecute format
 * Handles the complex chunked format with size indicators
 */

import type { RPCResponse } from '../types/common.js';
import { isErrorResponse } from './errors.js';

/**
 * Parse chunked response from batchexecute
 * Format: <chunk-length>\n<chunk-data>\n<chunk-length>\n<chunk-data>...
 */
export function parseChunkedResponse(raw: string, debug: boolean = false): RPCResponse[] {
  const log = (_msg: string) => {
    // Debug logging disabled
  };
  
  // Remove prefix if present
  let data = raw.trim().replace(/^\)\]\}'/, '');
  
  const lines = data.split('\n');
  const chunks: string[] = [];
  let collecting = false;
  let chunkSize = 0;
  let chunkData: string[] = [];
  
  log(`Processing ${lines.length} lines`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines when not collecting
    if (!collecting && line.trim() === '') {
      continue;
    }
    
    // If not collecting, this should be a chunk size
    if (!collecting) {
      const size = parseInt(line.trim(), 10);
      
      if (isNaN(size)) {
        // Not a number - might be direct JSON
        if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
          chunks.push(line);
          log(`Found direct JSON chunk: ${line.substring(0, 100)}...`);
        }
        continue;
      }
      
      chunkSize = size;
      collecting = true;
      chunkData = [];
      log(`Expecting chunk of ${chunkSize} bytes`);
      continue;
    }
    
    // Collecting chunk data
    chunkData.push(line);
    
    const currentSize = chunkData.join('\n').length;
    
    // Check if we've collected enough data
    if (currentSize >= chunkSize) {
      const chunk = chunkData.join('\n');
      chunks.push(chunk);
      log(`Collected full chunk (${currentSize} bytes)`);
      collecting = false;
      chunkSize = 0;
      chunkData = [];
    }
  }
  
  // Handle partial chunk
  if (collecting && chunkData.length > 0) {
    const chunk = chunkData.join('\n');
    chunks.push(chunk);
    log(`Added partial chunk (${chunk.length} of ${chunkSize} bytes)`);
  }
  
  // If no chunks but we have data, treat all as one chunk
  if (chunks.length === 0 && lines.length > 0) {
    const allData = lines.join('\n');
    if (allData.trim()) {
      chunks.push(allData);
      log('Treating all lines as single chunk');
    }
  }
  
  log(`Found ${chunks.length} chunks`);
  
  // Process chunks
  return processChunks(chunks, debug);
}

/**
 * Process chunks and extract RPC responses
 */
function processChunks(chunks: string[], debug: boolean = false): RPCResponse[] {
  const log = (_msg: string) => {
    // Debug logging disabled
  };
  
  if (chunks.length === 0) {
    throw new Error('No chunks found');
  }
  
  const allResponses: RPCResponse[] = [];
  
  for (const chunk of chunks) {
    // Check for numeric-only responses (error codes)
    const trimmed = chunk.trim();
    if (/^\d+$/.test(trimmed) && trimmed.length <= 10) {
      const code = parseInt(trimmed, 10);
      // Skip success codes
      if (code !== 0 && code !== 1) {
        log(`Found numeric error code: ${code}`);
        allResponses.push({
          index: 0,
          id: 'numeric',
          data: code,
        });
      }
      continue;
    }
    
    // Try to parse as JSON
    try {
      let data: any;
      
      // Try parsing as array of arrays
      try {
        data = JSON.parse(chunk);
      } catch {
        // Try unescaping and parsing
        const unescaped = chunk.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        data = JSON.parse(unescaped);
      }
      
      // Handle different formats
      let responseArrays: any[][];
      
      if (Array.isArray(data)) {
        if (data.length > 0 && Array.isArray(data[0])) {
          responseArrays = data as any[][];
        } else {
          responseArrays = [data];
        }
      } else {
        continue;
      }
      
      // Extract responses
      const responses = extractResponses(responseArrays);
      allResponses.push(...responses);
      
    } catch (error) {
      // Try manual extraction if JSON parsing fails
      if (chunk.includes('wrb.fr')) {
        log(`JSON parse failed, trying manual extraction`);
        const response = extractWRBResponse(chunk);
        if (response) {
          allResponses.push(response);
        }
      }
    }
  }
  
  if (allResponses.length === 0) {
    throw new Error('No valid responses found in chunks');
  }
  
  return allResponses;
}

/**
 * Extract RPC responses from parsed data
 */
function extractResponses(data: any[][]): RPCResponse[] {
  const responses: RPCResponse[] = [];
  
  for (const rpcData of data) {
    if (rpcData.length < 3) {
      continue;
    }
    
    // Check for wrb.fr response type
    const rpcType = rpcData[0];
    if (rpcType !== 'wrb.fr') {
      continue;
    }
    
    const id = rpcData[1] as string;
    if (!id) {
      continue;
    }
    
    const response: RPCResponse = {
      id,
      index: 0,
      data: null,
    };
    
    // Try position 2 for data
    let responseData: any = null;
    
    if (rpcData[2] !== null && rpcData[2] !== undefined) {
      if (typeof rpcData[2] === 'string') {
        response.data = rpcData[2];
        responseData = rpcData[2];
      } else {
        responseData = rpcData[2];
      }
    }
    
    // If position 2 is null, try position 5
    if (responseData === null && rpcData.length > 5 && rpcData[5] !== null) {
      responseData = rpcData[5];
    }
    
    // Set data
    if (responseData !== null && response.data === null) {
      response.data = responseData;
    }
    
    // Parse index from position 6
    if (rpcData.length > 6) {
      if (rpcData[6] === 'generic') {
        response.index = 0;
      } else if (typeof rpcData[6] === 'string') {
        response.index = parseInt(rpcData[6], 10) || 0;
      }
    }
    
    responses.push(response);
  }
  
  return responses;
}

/**
 * Manually extract wrb.fr response from unparseable chunk
 */
function extractWRBResponse(chunk: string): RPCResponse | null {
  // Try to parse as JSON first
  try {
    const data = JSON.parse(chunk);
    if (Array.isArray(data)) {
      const responses = extractResponses([data]);
      if (responses.length > 0) {
        return responses[0];
      }
    }
  } catch {
    // Continue with manual extraction
  }
  
  // Find wrb.fr
  const wrbIndex = chunk.indexOf('wrb.fr');
  if (wrbIndex < 0) {
    return null;
  }
  
  // Try to extract ID (comes after wrb.fr)
  let idStart = wrbIndex + 6; // length of "wrb.fr"
  while (idStart < chunk.length && (chunk[idStart] === ',' || chunk[idStart] === '"' || chunk[idStart] === ' ')) {
    idStart++;
  }
  
  let idEnd = idStart;
  while (idEnd < chunk.length && chunk[idEnd] !== '"' && chunk[idEnd] !== ',' && chunk[idEnd] !== ' ') {
    idEnd++;
  }
  
  if (idStart >= idEnd) {
    return null;
  }
  
  const id = chunk.substring(idStart, idEnd);
  
  // Look for JSON data after ID
  const dataStart = chunk.indexOf('{', idEnd);
  if (dataStart >= 0) {
    const dataEnd = findJSONEnd(chunk, dataStart, '{', '}');
    if (dataEnd > dataStart) {
      const jsonData = chunk.substring(dataStart, dataEnd);
      try {
        const parsed = JSON.parse(jsonData);
        return {
          index: 0,
          id,
          data: parsed,
        };
      } catch {
        // Return with raw string data
        return {
          index: 0,
          id,
          data: jsonData,
        };
      }
    }
  }
  
  // Try array format
  const arrayStart = chunk.indexOf('[', idEnd);
  if (arrayStart >= 0) {
    const arrayEnd = findJSONEnd(chunk, arrayStart, '[', ']');
    if (arrayEnd > arrayStart) {
      const jsonData = chunk.substring(arrayStart, arrayEnd);
      try {
        const parsed = JSON.parse(jsonData);
        return {
          index: 0,
          id,
          data: parsed,
        };
      } catch {
        return {
          index: 0,
          id,
          data: jsonData,
        };
      }
    }
  }
  
  // No data found
  return {
    index: 0,
    id,
    data: null,
  };
}

/**
 * Find the end of a JSON object or array
 */
function findJSONEnd(s: string, start: number, openChar: string, closeChar: string): number {
  let count = 0;
  let inQuotes = false;
  let escaped = false;
  
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (c === '\\' && inQuotes) {
      escaped = true;
      continue;
    }
    
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    
    if (!inQuotes) {
      if (c === openChar) {
        count++;
      } else if (c === closeChar) {
        count--;
        if (count === 0) {
          return i + 1;
        }
      }
    }
  }
  
  return s.length;
}

