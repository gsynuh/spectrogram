import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { SampleFormat } from './enums';
import { MetadataExtractor, AudioMetadata } from './metadata-extractor';

const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

export interface AudioData {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
  channels: number;
  sampleFormat: string;
  bitsPerSample: number;
  metadata?: AudioMetadata;
}

export class AudioProcessor {
  private ffmpegPath: string;
  private ffprobePath: string;
  private metadataExtractor: MetadataExtractor;

  constructor() {
    this.ffmpegPath = ffmpegInstaller.path;
    this.ffprobePath = ffprobeInstaller.path;
    this.metadataExtractor = new MetadataExtractor();
  }

  /**
   * Process an audio file and return raw PCM data with metadata
   * @param filePath - Path to the audio file
   * @returns AudioData with samples as Float32Array and metadata
   */
  async processAudioFile(filePath: string): Promise<AudioData> {
    // Extract metadata first
    const metadata = await this.metadataExtractor.extractMetadata(filePath);
    
    const audioInfo = await this.getAudioInfo(filePath);
    
    const pcmData = await this.convertToPCM(filePath, audioInfo.sampleRate, audioInfo.sampleFormat);
    const samples = this.convertToFloat32Array(pcmData, audioInfo.sampleFormat);
    
    return {
      samples,
      sampleRate: audioInfo.sampleRate,
      duration: audioInfo.duration,
      channels: audioInfo.channels,
      sampleFormat: audioInfo.sampleFormat,
      bitsPerSample: audioInfo.bitDepth,
      metadata // Include metadata in the result
    };
  }

  /**
   * Get audio file information using ffprobe
   * @param filePath - Path to the audio file
   * @returns Audio metadata including sample rate, channels, duration, and format info
   */
  private async getAudioInfo(filePath: string): Promise<{ 
    sampleRate: number; 
    channels: number; 
    duration: number;
    sampleFormat: SampleFormat;
    bitDepth: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${stderr}`));
          return;
        }

        try {
          const metadata = JSON.parse(stdout);
          const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');
          
          if (!audioStream) {
            reject(new Error('No audio stream found'));
            return;
          }

          // Detect sample format and bit depth
          const rawSampleFormat = audioStream?.sample_fmt;
          if (!rawSampleFormat) {
            reject(new Error('No sample format found in audio stream'));
            return;
          }
          const sampleFormat = this.parseSampleFormat(rawSampleFormat);
          const bitDepth = this.getBitDepth(sampleFormat);

          const sampleRate = audioStream?.sample_rate;
          const channels = audioStream?.channels;
          const duration = metadata.format?.duration;

          if (!sampleRate) {
            reject(new Error('No sample rate found in audio stream'));
            return;
          }
          if (!channels) {
            reject(new Error('No channel count found in audio stream'));
            return;
          }
          if (!duration) {
            reject(new Error('No duration found in audio stream'));
            return;
          }

          resolve({
            sampleRate: parseInt(sampleRate),
            channels: parseInt(channels),
            duration: parseFloat(duration),
            sampleFormat,
            bitDepth
          });
        } catch (error) {
          reject(new Error(`Failed to parse audio info: ${error}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe error: ${error.message}`));
      });
    });
  }

  /**
   * Parse sample format string to SampleFormat enum
   * @param sampleFormat - Raw sample format string from ffprobe
   * @returns SampleFormat enum value
   */
  private parseSampleFormat(sampleFormat: string): SampleFormat {
    switch (sampleFormat) {
      case 'u8': return SampleFormat.U8;
      case 's16': return SampleFormat.S16;
      case 's32': return SampleFormat.S32;
      case 'flt': return SampleFormat.FLT;
      case 'dbl': return SampleFormat.DBL;
      case 'fltp': 
        console.warn(`Sample format 'fltp' not fully supported, treating as FLT`);
        return SampleFormat.FLT;
      default: 
        console.warn(`Unknown sample format: ${sampleFormat}, treating as unknown`);
        return SampleFormat.UNKNOWN;
    }
  }

  /**
   * Get bit depth from sample format
   * @param sampleFormat - SampleFormat enum value
   * @returns Bit depth in bits
   */
  private getBitDepth(sampleFormat: SampleFormat): number {
    switch (sampleFormat) {
      case SampleFormat.U8: return 8;
      case SampleFormat.S16: return 16;
      case SampleFormat.S32: return 32;
      case SampleFormat.FLT: return 32;
      case SampleFormat.DBL: return 64;
      case SampleFormat.UNKNOWN: return 0; // Unknown format, return 0 to indicate unknown
      default: 
        console.warn(`Unexpected sample format: ${sampleFormat}, treating as unknown`);
        return 0;
    }
  }

  /**
   * Get FFmpeg codec and format based on sample format
   * @param sampleFormat - SampleFormat enum value
   * @returns Object with codec and format strings
   */
  private getFFmpegFormat(sampleFormat: SampleFormat): { codec: string; format: string } {
    switch (sampleFormat) {
      case SampleFormat.U8: return { codec: 'pcm_u8', format: 'u8' };
      case SampleFormat.S16: return { codec: 'pcm_s16le', format: 's16le' };
      case SampleFormat.S32: return { codec: 'pcm_s32le', format: 's32le' };
      case SampleFormat.FLT: return { codec: 'pcm_f32le', format: 'f32le' };
      case SampleFormat.DBL: return { codec: 'pcm_f64le', format: 'f64le' };
      case SampleFormat.UNKNOWN: 
        console.warn(`Unknown sample format for FFmpeg: ${sampleFormat}, using s16le as fallback`);
        return { codec: 'pcm_s16le', format: 's16le' };
      default: 
        console.warn(`Unexpected sample format for FFmpeg: ${sampleFormat}, using s16le as fallback`);
        return { codec: 'pcm_s16le', format: 's16le' };
    }
  }

  /**
   * Convert audio file to raw PCM data using ffmpeg
   * @param filePath - Path to the audio file
   * @param sampleRate - Target sample rate
   * @param sampleFormat - Original sample format from ffprobe
   * @returns Raw PCM data as Buffer
   */
  private async convertToPCM(filePath: string, sampleRate: number, sampleFormat: SampleFormat): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(tmpdir(), `spectrogram_${Date.now()}.pcm`);
      const { codec, format } = this.getFFmpegFormat(sampleFormat);
      
      const ffmpeg = spawn(this.ffmpegPath, [
        '-i', filePath,
        '-ac', '1',
        '-ar', sampleRate.toString(),
        '-acodec', codec,
        '-f', format,
        '-y',
        outputPath
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed: ${stderr}`));
          return;
        }

        try {
          const data = readFileSync(outputPath);
          unlinkSync(outputPath);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  /**
   * Convert PCM buffer to Float32Array
   * @param pcmBuffer - Raw PCM data
   * @param sampleFormat - Original sample format from ffprobe
   * @returns Float32Array with samples in range [-1, 1]
   */
  private convertToFloat32Array(pcmBuffer: Buffer, sampleFormat: SampleFormat): Float32Array {
    switch (sampleFormat) {
      case SampleFormat.U8: {
        const samples = new Float32Array(pcmBuffer.length);
        for (let i = 0; i < samples.length; i++) {
          const sample = pcmBuffer.readUInt8(i);
          samples[i] = (sample - 128) / 128.0; // Convert to [-1, 1]
        }
        return samples;
      }
      case SampleFormat.S16: {
        const samples = new Float32Array(pcmBuffer.length / 2);
        for (let i = 0; i < samples.length; i++) {
          const sample = pcmBuffer.readInt16LE(i * 2);
          samples[i] = sample / 32768.0;
        }
        return samples;
      }
      case SampleFormat.S32: {
        const samples = new Float32Array(pcmBuffer.length / 4);
        for (let i = 0; i < samples.length; i++) {
          const sample = pcmBuffer.readInt32LE(i * 4);
          samples[i] = sample / 2147483648.0; // 2^31
        }
        return samples;
      }
      case SampleFormat.FLT: {
        const samples = new Float32Array(pcmBuffer.length / 4);
        for (let i = 0; i < samples.length; i++) {
          samples[i] = pcmBuffer.readFloatLE(i * 4);
        }
        return samples;
      }
      case SampleFormat.DBL: {
        const samples = new Float32Array(pcmBuffer.length / 8);
        for (let i = 0; i < samples.length; i++) {
          const sample = pcmBuffer.readDoubleLE(i * 8);
          samples[i] = sample; // Convert double to float
        }
        return samples;
      }
             case SampleFormat.UNKNOWN: {
         console.warn(`Unknown sample format for conversion: ${sampleFormat}, using s16 as fallback`);
         // Fallback to 16-bit signed for unknown formats
         const samples = new Float32Array(pcmBuffer.length / 2);
         for (let i = 0; i < samples.length; i++) {
           const sample = pcmBuffer.readInt16LE(i * 2);
           samples[i] = sample / 32768.0;
         }
         return samples;
       }
       default: {
         console.warn(`Unexpected sample format for conversion: ${sampleFormat}, using s16 as fallback`);
         // Fallback to 16-bit signed for unexpected formats
         const samples = new Float32Array(pcmBuffer.length / 2);
         for (let i = 0; i < samples.length; i++) {
           const sample = pcmBuffer.readInt16LE(i * 2);
           samples[i] = sample / 32768.0;
         }
         return samples;
       }
    }
  }
}