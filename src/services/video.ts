/**
 * Video service
 * Handles video overview operations
 */

import { RPCClient } from '../rpc/rpc-client.js';
import * as RPC from '../rpc/rpc-methods.js';
import type { VideoOverview, CreateVideoOverviewOptions } from '../types/video.js';
import { NotebookLMError } from '../types/common.js';

/**
 * Service for video overview operations
 */
export class VideoService {
  constructor(
    private rpc: RPCClient,
    private quota?: import('../utils/quota.js').QuotaManager
  ) {}
  
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
   * });
   * ```
   */
  async create(notebookId: string, options: CreateVideoOverviewOptions = {}): Promise<VideoOverview> {
    const { instructions = '', sourceIds = [] } = options;
    
    // Check quota before creating
    this.quota?.checkQuota('createVideoOverview');
    
    // Build video arguments
    const videoArgs = [
      [2], // Mode
      notebookId,
      [
        null,
        null,
        3,
        [sourceIds.map(id => [id])],
        null,
        null,
        null,
        null,
        [
          null,
          null,
          [
            sourceIds.map(id => [id]),
            'en',
            instructions,
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
          
          // Status
          if (videoData.length > 2 && typeof videoData[2] === 'number') {
            result.isReady = videoData[2] === 2;
          }
        }
      }
      
      return result;
    } catch (error) {
      throw new NotebookLMError(`Failed to parse video creation response: ${(error as Error).message}`);
    }
  }
}

