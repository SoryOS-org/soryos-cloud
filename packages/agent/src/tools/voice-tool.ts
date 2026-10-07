/**
 * @soryos/agent
 * Voice Tool - Enable voice input for agents
 * 
 * This tool allows agents to receive voice input from users
 * and process it as text commands.
 */

import { ToolDefinition, ToolResult } from '../types';
import { VoiceManager, VoiceInputResult } from '@soryos/voice';

/**
 * Voice tool definition
 */
export const voiceToolDefinition: ToolDefinition = {
  id: 'voice_input',
  name: 'voice_input',
  description: 'Receive voice input from the user and convert it to text for processing',
  category: 'web',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Optional prompt to display to the user before recording',
      },
      maxDurationMs: {
        type: 'number',
        description: 'Maximum recording duration in milliseconds (default: 300000 = 5 minutes)',
      },
      language: {
        type: 'string',
        description: 'Language for speech recognition (default: en-US)',
      },
      provider: {
        type: 'string',
        description: 'Voice provider to use (default: web-speech-api)',
        enum: ['web-speech-api', 'whisper', 'google', 'azure', 'aws'],
      },
    },
    required: [],
  },
};

/**
 * Voice tool handler
 */
export class VoiceTool {
  private voiceManager: VoiceManager;

  constructor(voiceManager?: VoiceManager) {
    this.voiceManager = voiceManager || new VoiceManager();
  }

  /**
   * Execute voice input tool
   */
  async execute(params: {
    prompt?: string;
    maxDurationMs?: number;
    language?: string;
    provider?: string;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Initialize voice manager if not already done
      if (!this.voiceManager.getRecorder()) {
        await this.voiceManager.initialize({
          maxDurationMs: params.maxDurationMs,
        }, {
          provider: params.provider as any,
          language: params.language,
        });
      }

      // Start recording
      await this.voiceManager.startRecording();

      // Return intermediate response with recording started
      const recordingStartResult: ToolResult = {
        toolName: 'voice_input',
        output: JSON.stringify({
          status: 'recording_started',
          message: params.prompt || 'Speak now...',
          timestamp: Date.now(),
        }),
        isError: false,
        success: true,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'start_recording',
          provider: params.provider || 'web-speech-api',
          language: params.language || 'en-US',
        },
      };

      // Note: In a real implementation, we would wait for the user to stop recording
      // and then transcribe the audio. This is handled by the frontend UI.
      // For now, we return the recording started status.
      
      return recordingStartResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolName: 'voice_input',
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
   * Process recorded audio and return transcription
   */
  async processRecording(sessionId: string): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Stop recording
      const audioBuffer = await this.voiceManager.stopRecording();

      // Transcribe audio
      const result: VoiceInputResult = {
        success: true,
        text: '',
        audio: audioBuffer,
        durationMs: Date.now() - startTime,
        provider: 'web-speech-api',
        confidence: 1.0,
        timestamp: Date.now(),
        sessionId,
      };

      // Note: In a real implementation, we would use the transcriber
      // For now, we return a placeholder
      
      return {
        toolName: 'voice_input',
        output: JSON.stringify({
          status: 'completed',
          text: result.text,
          durationMs: result.durationMs,
          provider: result.provider,
          confidence: result.confidence,
          sessionId: result.sessionId,
        }),
        isError: false,
        success: true,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'transcribe',
          provider: result.provider,
          durationMs: result.durationMs,
          sessionId: result.sessionId,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        toolName: 'voice_input',
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
   * Check if voice input is supported
   */
  isSupported(): boolean {
    return VoiceManager.isSupported();
  }

  /**
   * Get available voice providers
   */
  getAvailableProviders(): string[] {
    return ['web-speech-api', 'whisper', 'google', 'azure', 'aws'];
  }
}

/**
 * Create voice tool instance
 */
export function createVoiceTool(voiceManager?: VoiceManager): VoiceTool {
  return new VoiceTool(voiceManager);
}

/**
 * Singleton voice tool instance
 */
let globalVoiceTool: VoiceTool | null = null;

/**
 * Get or create global voice tool
 */
export function getVoiceTool(voiceManager?: VoiceManager): VoiceTool {
  if (!globalVoiceTool) {
    globalVoiceTool = new VoiceTool(voiceManager);
  }
  return globalVoiceTool;
}
