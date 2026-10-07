/**
 * @soryos/agent
 * Image Tool - Enable image input and analysis for agents
 * 
 * This tool allows agents to receive images from users
 * and process them for analysis, OCR, or design feedback.
 */

import { ToolDefinition, ToolResult } from '../types';
import { ImageManager, ImageUploadResult, ImageAnalysisResult } from '@soryos/images';

/**
 * Image tool definition
 */
export const imageToolDefinition: ToolDefinition = {
  id: 'image_input',
  name: 'image_input',
  description: 'Receive image input from the user for analysis, OCR, or design feedback',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Source of the image (file, url, clipboard, camera)',
        enum: ['file', 'url', 'clipboard', 'camera'],
      },
      analysisType: {
        type: 'string',
        description: 'Type of analysis to perform on the image',
        enum: ['description', 'ocr', 'objects', 'colors', 'layout', 'mockup', 'none'],
      },
      prompt: {
        type: 'string',
        description: 'Optional prompt for custom image analysis',
      },
      maxSizeMB: {
        type: 'number',
        description: 'Maximum image size in MB (default: 10)',
      },
      allowedFormats: {
        type: 'array',
        description: 'Allowed image formats',
        items: { type: 'string' },
      },
    },
    required: [],
  },
};

/**
 * Image tool handler
 */
export class ImageTool {
  private imageManager: ImageManager;

  constructor(imageManager?: ImageManager) {
    this.imageManager = imageManager || new ImageManager();
  }

  /**
   * Execute image input tool
   */
  async execute(params: {
    source?: string;
    analysisType?: string;
    prompt?: string;
    maxSizeMB?: number;
    allowedFormats?: string[];
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // For now, we return the upload request status
      // The actual upload is handled by the frontend
      const result: ToolResult = {
        toolName: 'image_input',
        output: JSON.stringify({
          status: 'awaiting_upload',
          source: params.source || 'file',
          analysisType: params.analysisType || 'none',
          message: `Please upload an image for ${params.analysisType || 'analysis'}`,
          timestamp: Date.now(),
        }),
        isError: false,
        success: true,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'request_upload',
          source: params.source,
          analysisType: params.analysisType,
          maxSizeMB: params.maxSizeMB || 10,
          allowedFormats: params.allowedFormats || ['png', 'jpeg', 'jpg', 'webp', 'gif'],
        },
      };

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolName: 'image_input',
        output: '',
        isError: true,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'error',
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Process uploaded image
   */
  async processImage(
    sessionId: string,
    image: Blob | File | string,
    analysisType?: string,
    prompt?: string
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Upload image
      const uploadResult: ImageUploadResult = {
        success: true,
        id: `img-${Date.now()}`,
        url: typeof image === 'string' ? image : URL.createObjectURL(image),
        base64: typeof image === 'string' && image.startsWith('data:') ? image : '',
        blob: image instanceof Blob ? image : new Blob([image]),
        file: image instanceof File ? image : undefined,
        format: this.getFormat(image),
        width: 0, // Would be set by actual upload
        height: 0,
        sizeBytes: image instanceof Blob ? image.size : 0,
        sessionId,
        timestamp: Date.now(),
      };

      // For now, return upload result
      // In a real implementation, we would also perform analysis
      
      const analysisResult: Partial<ImageAnalysisResult> = {
        analysisType: analysisType || 'none',
        provider: 'soryos',
        timestamp: Date.now(),
        sessionId,
      };

      if (analysisType === 'ocr') {
        analysisResult.results = [{ type: 'text', content: 'OCR text would be extracted here', confidence: 0.95 }];
      } else if (analysisType === 'description') {
        analysisResult.results = [{ type: 'description', content: 'Image description would be generated here' }];
      }

      return {
        toolName: 'image_input',
        output: JSON.stringify({
          status: 'completed',
          upload: {
            id: uploadResult.id,
            url: uploadResult.url,
            format: uploadResult.format,
            sizeBytes: uploadResult.sizeBytes,
          },
          analysis: analysisResult,
          timestamp: Date.now(),
        }),
        isError: false,
        success: true,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'process_image',
          analysisType: analysisType,
          format: uploadResult.format,
          sizeBytes: uploadResult.sizeBytes,
          sessionId,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolName: 'image_input',
        output: '',
        isError: true,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'error',
          error: errorMessage,
          sessionId,
        },
      };
    }
  }

  /**
   * Process mockup/image for design analysis
   */
  async processMockup(
    sessionId: string,
    image: Blob | File | string,
    description?: string
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Upload mockup
      const uploadResult = await this.processImage(sessionId, image, 'mockup');

      // In a real implementation, we would analyze the mockup
      // and provide design feedback
      
      return {
        ...uploadResult,
        metadata: {
          ...uploadResult.metadata,
          action: 'process_mockup',
          description,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolName: 'image_input',
        output: '',
        isError: true,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'error',
          error: errorMessage,
          sessionId,
        },
      };
    }
  }

  /**
   * Get image format from blob or file
   */
  private getFormat(image: Blob | File | string): string {
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        const type = image.split(',')[0].split(':')[1].split(';')[0];
        if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('gif')) return 'gif';
        if (type.includes('svg')) return 'svg';
        return 'unknown';
      }
      return 'url';
    }

    const type = (image as Blob).type.toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('svg')) return 'svg';
    return 'unknown';
  }

  /**
   * Check if image input is supported
   */
  isSupported(): boolean {
    return ImageManager.isSupported();
  }

  /**
   * Get available analysis types
   */
  getAvailableAnalysisTypes(): string[] {
    return ['description', 'ocr', 'objects', 'colors', 'layout', 'mockup', 'none'];
  }
}

/**
 * Create image tool instance
 */
export function createImageTool(imageManager?: ImageManager): ImageTool {
  return new ImageTool(imageManager);
}

/**
 * Singleton image tool instance
 */
let globalImageTool: ImageTool | null = null;

/**
 * Get or create global image tool
 */
export function getImageTool(imageManager?: ImageManager): ImageTool {
  if (!globalImageTool) {
    globalImageTool = new ImageTool(imageManager);
  }
  return globalImageTool;
}
