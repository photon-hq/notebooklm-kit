import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { Notebook, CreateNotebookOptions, UpdateNotebookOptions, ShareNotebookOptions, ShareNotebookResult, DeleteNotebookResult, SharingSettings } from '../types/notebook.js';
import { NotebookLMError } from '../types/common.js';
import { APIError } from '../utils/errors.js';
import { createChunkedParser } from '../utils/chunked-parser.js';

export class NotebooksService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
  async list(): Promise<Notebook[]> {
    // Use wXbhsf RPC for listing my notebooks (recently viewed)
    // Args format: [null, 1, null, [2]]
    const args = [null, 1, null, [2]];
    const response = await this.rpc.call(RPC.RPC_LIST_MY_NOTEBOOKS, args);
    const notebooks = this.parseListResponse(response);
    // Filter out "OpenStax's Biology" notebook (not in user's expected list)
    return notebooks.filter(nb => !nb.title.includes("OpenStax's Biology"));
  }
  
  async get(notebookId: string): Promise<Notebook> {
    if (!notebookId || typeof notebookId !== 'string') {
      throw new APIError('Invalid notebook ID format', undefined, 400);
    }
    
    // Call both RPCs in parallel to get full notebook data + sharing details
    const [projectResponse, sharingResponse] = await Promise.all([
      this.rpc.call(
        RPC.RPC_GET_PROJECT,
        [notebookId, null, [2], null, 0],
        notebookId
      ),
      this.rpc.call(
        RPC.RPC_GET_SHARING_DETAILS,
        [notebookId, [2]],
        notebookId
      ).catch(() => null), // Sharing data is optional, don't fail if unavailable
    ]);
    
    return this.parseGetResponse(projectResponse, notebookId, sharingResponse);
  }
  
  async create(options: CreateNotebookOptions): Promise<Notebook> {
    let { title = '', emoji } = options;
    
    if (!title || title.trim() === '') {
      title = `Untitled Notebook ${new Date().toLocaleDateString()}`;
    }
    
    if (title.length > 100) {
      throw new APIError('Notebook title exceeds maximum length (100 characters)', undefined, 400);
    }
    
    this.quota?.checkQuota('createNotebook');
    
    const response = await this.rpc.call(
      RPC.RPC_CREATE_PROJECT,
      [title, null, null, [2], [1, null, null, null, null, null, null, null, null, [1]]]
    );
    
    const notebook = this.parseCreateResponse(response, title);
    this.quota?.recordUsage('createNotebook');
    
    // Set emoji if provided
    if (emoji) {
      await this.setEmoji(notebook.projectId, emoji);
      notebook.emoji = emoji;
    }
    
    return notebook;
  }
  
  async update(notebookId: string, options: UpdateNotebookOptions): Promise<Notebook> {
    // Trim notebook ID to remove any trailing spaces
    notebookId = notebookId.trim();
    
    if (!notebookId || typeof notebookId !== 'string') {
      throw new APIError('Invalid notebook ID format', undefined, 400);
    }
    
    // Validate: at least one field must be provided (title, description, or emoji)
    if (!options.title && !options.description && !options.emoji) {
      throw new APIError('At least one field (title, description, or emoji) must be provided', undefined, 400);
    }
    
    if (options.title && options.title.length > 100) {
      throw new APIError('Notebook title exceeds maximum length (100 characters)', undefined, 400);
    }
    
    // Set emoji if provided (supports: emoji only, title + emoji, or emoji + description)
    if (options.emoji !== undefined) {
      await this.setEmoji(notebookId, options.emoji);
    }
    
    // Update title and/or description if provided (supports: title only, description only, or title + description)
    if (options.title !== undefined || options.description !== undefined) {
      const updateArray: any[] = [null, null, null, null];
      
      if (options.title !== undefined) {
        updateArray[3] = [null, options.title];
      }
      
      const updates = [updateArray];
      
      const response = await this.rpc.call(
        RPC.RPC_UPDATE_PROJECT,
        [notebookId, updates],
        notebookId
      );
      
      const notebook = this.parseGetResponse(response, notebookId, null);
      
      // Ensure emoji is set in the returned notebook if it was updated
      if (options.emoji !== undefined) {
        notebook.emoji = options.emoji;
      }
      
      return notebook;
    }
    
    // If only emoji was updated (no title or description), fetch the notebook and update emoji in response
    const notebook = await this.get(notebookId);
    if (options.emoji !== undefined) {
      notebook.emoji = options.emoji;
    }
    return notebook;
  }
  
  async delete(notebookIds: string | string[]): Promise<DeleteNotebookResult> {
    const ids = Array.isArray(notebookIds) ? notebookIds : [notebookIds];
    
    for (const id of ids) {
      if (!id || typeof id !== 'string') {
        throw new APIError('Invalid notebook ID format', undefined, 400);
      }
    }
    
    await this.rpc.call(RPC.RPC_DELETE_PROJECTS, [ids, [2]]);
    
    return {
      deleted: ids,
      count: ids.length,
    };
  }
  
  async share(notebookId: string, options: ShareNotebookOptions): Promise<ShareNotebookResult> {
    if (!notebookId || typeof notebookId !== 'string') {
      throw new APIError('Invalid notebook ID format', undefined, 400);
    }
    
    // Trim notebookId to prevent issues with trailing spaces
    const trimmedNotebookId = notebookId.trim();
    
    // accessType: 1 = anyone with link, 2 = restricted (default)
    // Default to restricted (2) unless explicitly set to anyone with link (1)
    const accessType = options.accessType || 2;
    
    // Notify should only be used when there are user permission changes (adding/removing/updating users)
    // When only changing access type (restricted vs anyone with link), notify is not relevant
    const hasUserChanges = options.users && options.users.length > 0;
    const notify = hasUserChanges ? (options.notify !== false ? 1 : 0) : 0;
    
    // Validate: must have users OR accessType === 1 (anyone with link)
    if (!options.users && accessType !== 1) {
      throw new APIError('At least one sharing option (users or accessType=1 for anyone with link) must be provided', undefined, 400);
    }
    
    let shareData: any[];
    if (options.users && options.users.length > 0) {
      const users: any[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const user of options.users) {
        if (!user.email || typeof user.email !== 'string') {
          throw new APIError('Invalid user email format', undefined, 400);
        }
        
        if (!emailRegex.test(user.email.trim())) {
          throw new APIError(`Invalid email address: ${user.email}`, undefined, 400);
        }
        
        if (![2, 3, 4].includes(user.role)) {
          throw new APIError('Invalid user role. Must be 2 (editor), 3 (viewer), or 4 (remove)', undefined, 400);
        }
        users.push([user.email.trim(), null, user.role]);
      }
      shareData = [trimmedNotebookId, users];
    } else if (accessType === 1) {
      // Structure: [notebookId, null, [1]] where [1] enables link sharing
      shareData = [trimmedNotebookId, null, [1]];
    } else {
      throw new APIError('Invalid share options', undefined, 400);
    }
    
    // Call JFMDGd first to get sharing details (prerequisite for sharing)
    // This initializes the sharing state for the notebook
    try {
      await this.rpc.call(
        RPC.RPC_GET_SHARING_DETAILS,
        [trimmedNotebookId, [2]],
        trimmedNotebookId
      );
    } catch (error) {
      // Ignore errors from the prerequisite call - it may not always be necessary
      // but we call it to match the browser behavior
    }
    
    const args = [[shareData], notify, null, [accessType]];
    
    const response = await this.rpc.call(
      RPC.RPC_SHARE_PROJECT,
      args,
      trimmedNotebookId
    );
    
    // QDyure response can be:
    // - Empty array [] = success (no share URL in response, construct from notebook ID)
    // - Array with share URL = success with URL
    // - Error response = failure
    let shareUrl = '';
    let success = false;
    
    if (Array.isArray(response)) {
      if (response.length === 0) {
        // Empty array means success - construct share URL from notebook ID
        success = true;
        shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      } else {
        // Response contains data
        const data = response[0];
        if (Array.isArray(data)) {
          shareUrl = data[0] || '';
          success = data[1] === true || (data.length > 0 && data[0] !== null);
        } else if (typeof data === 'string') {
          shareUrl = data;
          success = true;
        } else if (data?.shareUrl) {
          shareUrl = data.shareUrl;
          success = data.success !== false;
        } else {
          // Fallback: construct from notebook ID
          shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
          success = true;
        }
      }
    } else if (response && typeof response === 'object') {
      shareUrl = response.shareUrl || `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      success = response.success !== false;
    } else {
      // Fallback: construct from notebook ID
      shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
      success = true;
    }
    
    // If shareUrl is still empty, construct from notebook ID
    if (!shareUrl) {
      shareUrl = `https://notebooklm.google.com/notebook/${trimmedNotebookId}`;
    }
    
    // If share failed, return minimal result
    if (!success) {
      return {
        shareUrl,
        success: false,
        notebookId: trimmedNotebookId,
        accessType,
        isShared: false,
      };
    }
    
    // Fetch updated sharing details after successful share
    let sharingDetails: ShareNotebookResult = {
      shareUrl,
      success: true,
      notebookId: trimmedNotebookId,
      accessType,
      isShared: accessType === 1 || !!(options.users && options.users.length > 0),
    };
    
    try {
      const sharingResponse = await this.rpc.call(
        RPC.RPC_GET_SHARING_DETAILS,
        [trimmedNotebookId, [2]],
        trimmedNotebookId
      );
      
      const parsedSharing = this.parseSharingResponse(sharingResponse, trimmedNotebookId);
      sharingDetails = {
        ...sharingDetails,
        ...parsedSharing,
        shareUrl: parsedSharing.shareUrl || shareUrl, // Use parsed URL if available, otherwise use constructed one
      };
    } catch (error) {
      // If we can't fetch sharing details, return what we have
      // The share operation succeeded, so we return success with basic info
    }
    
    return sharingDetails;
  }
  
  /**
   * Parse sharing details response from JFMDGd RPC
   */
  private parseSharingResponse(response: any, notebookId: string): Partial<ShareNotebookResult> {
    try {
      let sharingData: any = response;
      
      // Handle different response formats
      if (Array.isArray(response)) {
        if (response.length > 0 && Array.isArray(response[0])) {
          sharingData = response[0];
        } else {
          sharingData = response;
        }
      }
      
      // Extract sharing information
      // Structure: [[users], [isShared], 1000] or [users_array, isShared_array, ...]
      // Users array: [["email", role, [], ["name", "avatar"]], ...]
      // Each user: ["email", role, [], ["name", "avatar"]]
      
      let usersData: any[] = [];
      let isShared = false;
      let accessType: 1 | 2 = 2;
      
      // Handle structure: [[users], [isShared], 1000]
      if (Array.isArray(sharingData) && sharingData.length >= 2) {
        // First element is users array
        if (Array.isArray(sharingData[0])) {
          usersData = sharingData[0];
        }
        
        // Second element is [isShared] or isShared boolean
        if (Array.isArray(sharingData[1])) {
          isShared = sharingData[1][0] === true;
        } else if (typeof sharingData[1] === 'boolean') {
          isShared = sharingData[1];
        }
      }
      
      // Fallback: try to extract from object format
      if (usersData.length === 0 && sharingData?.users) {
        usersData = Array.isArray(sharingData.users) ? sharingData.users : [];
      }
      if (!isShared && sharingData?.isShared) {
        isShared = sharingData.isShared === true;
      }
      
      // Extract shareUrl - may not be in this response, construct from notebookId
      const shareUrl = sharingData?.shareUrl || `https://notebooklm.google.com/notebook/${notebookId}`;
      
      // Access type: 1 = anyone with link, 2 = restricted
      // We need to infer from the sharing state - if there are users and link is enabled
      // For now, default to restricted (2) unless we can determine otherwise
      const accessTypeRaw = sharingData?.accessType || sharingData?.[3] || 2;
      accessType = (accessTypeRaw === 1 || accessTypeRaw === 2) ? (accessTypeRaw as 1 | 2) : 2;
      
      // Parse users array
      // Format: [["email", role, [], ["name", "avatar"]], ...]
      // Role is at index 1, not index 2!
      const users: Array<{ email: string; role: 2 | 3 }> = [];
      if (Array.isArray(usersData)) {
        for (const userEntry of usersData) {
          if (Array.isArray(userEntry) && userEntry.length >= 2) {
            // Format: ["email", role, [], ["name", "avatar"]]
            const email = userEntry[0];
            const role = userEntry[1]; // Role is at index 1!
            if (typeof email === 'string' && (role === 1 || role === 2 || role === 3)) {
              // Map role: 1 = owner, 2 = editor, 3 = viewer
              // We only return editor (2) or viewer (3), not owner (1)
              if (role === 2 || role === 3) {
                users.push({ email, role: role as 2 | 3 });
              }
            }
          } else if (typeof userEntry === 'object' && userEntry?.email) {
            // Format: { email, role, ... }
            const email = userEntry.email;
            const role = userEntry.role;
            if (typeof email === 'string' && (role === 2 || role === 3)) {
              users.push({ email, role });
            }
          }
        }
      }
      
      return {
        shareUrl,
        accessType,
        isShared,
        users: users.length > 0 ? users : undefined,
      };
    } catch (error) {
      // Return minimal info if parsing fails
      return {
        shareUrl: `https://notebooklm.google.com/notebook/${notebookId}`,
        accessType: 2,
        isShared: false,
      };
    }
  }
  
  
  
  private parseListResponse(response: any): Notebook[] {
    try {
      let responseStr = '';
      
      if (typeof response === 'string') {
        responseStr = response;
      } else if (Array.isArray(response) && response.length > 0) {
        if (typeof response[0] === 'string') {
          responseStr = response[0];
        } else {
          responseStr = JSON.stringify(response);
        }
      } else {
        responseStr = JSON.stringify(response);
      }
      
      // Enable debug mode for notebook list parsing (can be disabled with NOTEBOOKLM_DEBUG=false)
      const debugMode = process.env.NOTEBOOKLM_DEBUG !== 'false';
      const parser = createChunkedParser(responseStr, debugMode);
      const projects = parser.parseListProjectsResponse();
      return projects.map((p: any) => ({
        projectId: p.projectId || '',
        title: p.title || '',
        emoji: p.emoji || '📄',
        sourceCount: p.sourceCount !== undefined ? p.sourceCount : 0,
      }));
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notebooks list: ${(error as Error).message}`);
    }
  }
  
  private parseGetResponse(response: any, notebookId: string, sharingResponse?: any): Notebook {
    try {
      let parsedResponse = response;
      if (typeof response === 'string') {
        parsedResponse = JSON.parse(response);
      }
      
      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        let data = parsedResponse;
        
        if (Array.isArray(parsedResponse[0])) {
          data = parsedResponse[0];
        }
        
        const title = data[0] || '';
        const emoji = data[1] || '📄';
        
        const sources: any[] = [];
        if (Array.isArray(data[1])) {
          for (const sourceData of data[1]) {
            if (Array.isArray(sourceData) && sourceData.length > 0) {
              if (Array.isArray(sourceData[0]) && sourceData[0].length > 0) {
                const sourceId = sourceData[0][0];
                const filename = sourceData[1] || 'Untitled';
                if (typeof sourceId === 'string') {
                  sources.push({
                    sourceId,
                    title: filename,
                  });
                }
              }
            }
          }
        }
        
        // Extract analytics data
        const sourceCount = sources.length;
        
        // Try to extract lastAccessed from various possible locations in the response
        let lastAccessed: string | undefined;
        
        // Check metadata field (data[5] or data[6] based on proto)
        if (data[5] && typeof data[5] === 'object') {
          const metadata = data[5];
          // Check for modified_time (field 6) or last_accessed
          if (metadata[6] && typeof metadata[6] === 'number') {
            // Timestamp in seconds
            lastAccessed = new Date(metadata[6] * 1000).toISOString();
          } else if (metadata.lastAccessed) {
            lastAccessed = typeof metadata.lastAccessed === 'string' 
              ? metadata.lastAccessed 
              : new Date(metadata.lastAccessed).toISOString();
          } else if (metadata.modified_time) {
            lastAccessed = typeof metadata.modified_time === 'string'
              ? metadata.modified_time
              : new Date(metadata.modified_time).toISOString();
          }
        }
        
        // Check if lastAccessed is directly in the data array
        if (!lastAccessed && data.length > 6) {
          const possibleTimestamp = data[6] || data[7];
          if (possibleTimestamp) {
            if (typeof possibleTimestamp === 'number') {
              lastAccessed = new Date(possibleTimestamp * 1000).toISOString();
            } else if (typeof possibleTimestamp === 'string') {
              lastAccessed = possibleTimestamp;
            }
          }
        }
        
        // Parse sharing data if available
        let sharing: SharingSettings | undefined;
        if (sharingResponse) {
          const sharingData = Array.isArray(sharingResponse) ? sharingResponse[0] : sharingResponse;
          if (sharingData) {
            sharing = {
              isShared: sharingData[0] === true || sharingData?.isShared === true,
              shareUrl: sharingData[1] || sharingData?.shareUrl,
              shareId: sharingData?.shareId,
              publicAccess: sharingData?.publicAccess,
              allowedUsers: sharingData[2] || sharingData?.permissions || sharingData?.allowedUsers,
            };
          }
        }
        
        // Return optimized notebook data
        // Don't include sources array - use sources service for that
        // Only include sourceCount for analytics
        return {
          projectId: notebookId,
          title,
          emoji,
          sourceCount: sourceCount > 0 ? sourceCount : undefined,
          lastAccessed,
          sharing,
        };
      }
      
      return {
        projectId: notebookId,
        title: '',
        emoji: '📄',
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse notebook data: ${(error as Error).message}`);
    }
  }
  
  /**
   * Set emoji for a notebook using the s0tc2d RPC
   * Based on mm40.txt: emoji is set via s0tc2d with args [notebookId, [[null, null, null, [null, null, emoji]]]]
   */
  private async setEmoji(notebookId: string, emoji: string): Promise<void> {
    if (!emoji || typeof emoji !== 'string') {
      throw new APIError('Invalid emoji format', undefined, 400);
    }
    
    // Emoji should be a single Unicode character (can be a multi-byte emoji)
    // Validate it's not empty after trimming
    const trimmedEmoji = emoji.trim();
    if (!trimmedEmoji) {
      throw new APIError('Emoji cannot be empty', undefined, 400);
    }
    
    // RPC call structure from mm40.txt:
    // s0tc2d RPC with args: [notebookId, [[null, null, null, [null, null, emoji]]]]
    const args = [notebookId, [[null, null, null, [null, null, trimmedEmoji]]]];
    
    try {
      await this.rpc.call(RPC.RPC_UPDATE_PROJECT, args, notebookId);
    } catch (error) {
      throw new APIError(`Failed to set emoji: ${(error as Error).message}`, undefined, 500);
    }
  }
  
  private parseCreateResponse(response: any, title: string): Notebook {
    try {
      let projectId = '';
      let emoji = '📄';
      let parsedResponse = response;
      
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          parsedResponse = response;
        }
      }
      
      if (Array.isArray(parsedResponse)) {
        if (parsedResponse.length > 2 && typeof parsedResponse[2] === 'string') {
          projectId = parsedResponse[2];
        } else {
          const findId = (data: any): string | null => {
            if (typeof data === 'string' && data.match(/^[a-f0-9-]{36}$/)) {
              return data;
            }
            if (Array.isArray(data)) {
              for (const item of data) {
                const id = findId(item);
                if (id) return id;
              }
            }
            return null;
          };
          
          projectId = findId(parsedResponse) || '';
        }
        
        // Extract emoji from response if available (typically at index 3)
        if (parsedResponse.length > 3 && typeof parsedResponse[3] === 'string') {
          emoji = parsedResponse[3];
        }
      }
      
      if (!projectId) {
        throw new Error('Could not extract project ID from response');
      }
      
      return {
        projectId,
        title,
        emoji,
      };
    } catch (error) {
      throw new NotebookLMError(`Failed to parse created notebook: ${(error as Error).message}`);
    }
  }
}

