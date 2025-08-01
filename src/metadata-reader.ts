import sharp from 'sharp';

// Define SpectrogramMetadata interface locally since png-metadata-writer was deleted
export interface SpectrogramMetadata {
  originalFile: string;
  originalFileName: string;
  originalFileSize: number;
  originalFormat: string;
  originalDuration: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
  codec: string;
  creationTime?: string;
  modificationTime?: string;
  recordingTime?: string;
  originalTime?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    locationName?: string;
    locationDescription?: string;
  };
  device?: {
    manufacturer?: string;
    model?: string;
    firmware?: string;
    serialNumber?: string;
    deviceId?: string;
  };
  recording?: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    track?: number;
    disc?: number;
    composer?: string;
    conductor?: string;
    performer?: string;
    publisher?: string;
    copyright?: string;
    language?: string;
    lyrics?: string;
    mood?: string;
    tempo?: string;
    key?: string;
    bpm?: number;
  };
  technical?: {
    encoder?: string;
    bitDepth?: number;
    sampleFormat?: string;
    channelLayout?: string;
    compression?: string;
    quality?: number;
    bitrateMode?: string;
    variableBitrate?: boolean;
    constantBitrate?: boolean;
    lossless?: boolean;
    lossy?: boolean;
  };
  broadcast?: {
    station?: string;
    show?: string;
    episode?: string;
    season?: string;
    network?: string;
    callSign?: string;
    frequency?: string;
  };
  production?: {
    producer?: string;
    engineer?: string;
    mixer?: string;
    arranger?: string;
    studio?: string;
    session?: string;
    take?: string;
    project?: string;
  };
  spectrogramInfo: {
    generationTime: string;
    timeRange: { start: number; end: number };
    parameters: {
      height: number;
      width: number;
      pixelsPerSecond: number;
      fftSize: number;
      hopSize: number;
      windowType: string;
      colorPreset: string;
      frequencyScale: string;
      mappingType: string;
    };
  };
  custom?: Record<string, any>;
}

export class MetadataReader {
  /**
   * Read and display metadata from a PNG file
   * @param filePath - Path to the PNG file
   * @returns Promise<void>
   */
  async readAndDisplayMetadata(filePath: string): Promise<void> {
    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();
      
      console.log(`\nMetadata for: ${filePath}`);
      console.log('=' .repeat(50));
      
      if (metadata.xmp) {
        console.log('\nXMP Data:');
        console.log(`  Raw XMP data present (${metadata.xmp.length} bytes)`);
        
        // Try to parse XMP as JSON
        try {
          const xmpJson = JSON.parse(metadata.xmp.toString('utf8'));
          console.log('\n📋 PARSED XMP METADATA:');
          console.log(JSON.stringify(xmpJson, null, 2));
          
          // Extract spectrogram-specific metadata from XMP
          const spectrogramMetadata = this.extractSpectrogramMetadataFromXmp(metadata.xmp);
          if (spectrogramMetadata) {
            console.log('\nSpectrogram Metadata (from XMP):');
            this.displaySpectrogramMetadata(spectrogramMetadata);
          }
        } catch (error) {
          console.log('  Could not parse XMP as JSON');
        }
      } else {
        console.log('\nXMP Data: Not present');
      }
      
      if (metadata.icc) {
        console.log('\nICC Profile:');
        console.log(`  Present: Yes (${metadata.icc.length} bytes)`);
      }
      
      // Display basic image info
      console.log('\nImage Information:');
      console.log(`  Format: ${metadata.format}`);
      console.log(`  Width: ${metadata.width}px`);
      console.log(`  Height: ${metadata.height}px`);
      console.log(`  Channels: ${metadata.channels}`);
      console.log(`  Depth: ${metadata.depth} bits`);
      if (metadata.density) {
        if (typeof metadata.density === 'object' && metadata.density !== null) {
          const density = metadata.density as any;
          if (density.x) console.log(`  Density: ${density.x} DPI`);
        } else {
          console.log(`  Density: ${metadata.density} DPI`);
        }
      }
    } catch (error) {
      console.error(`Failed to read metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Extract spectrogram-specific metadata from XMP data
   * @param xmp - XMP data object
   * @returns SpectrogramMetadata or null
   */
  private extractSpectrogramMetadataFromXmp(xmp: any): SpectrogramMetadata | null {
    try {
      // If xmp is a Buffer, try to parse it as JSON
      if (Buffer.isBuffer(xmp)) {
        const jsonData = JSON.parse(xmp.toString('utf8'));
        
        // Return the parsed metadata
        return {
          originalFile: jsonData.originalFile || 'Unknown',
          originalFileName: jsonData.originalFileName || 'Unknown',
          originalFileSize: jsonData.originalFileSize || 0,
          originalFormat: jsonData.originalFormat || 'Unknown',
          originalDuration: jsonData.originalDuration || 0,
          sampleRate: jsonData.sampleRate || 0,
          channels: jsonData.channels || 0,
          bitRate: jsonData.bitRate || 0,
          codec: jsonData.codec || 'Unknown',
          creationTime: jsonData.creationTime,
          modificationTime: jsonData.modificationTime,
          location: jsonData.location,
          device: jsonData.device,
          recording: jsonData.recording,
          technical: jsonData.technical,
          broadcast: jsonData.broadcast,
          production: jsonData.production,
          spectrogramInfo: jsonData.spectrogramInfo || {
            generationTime: 'Unknown',
            timeRange: { start: 0, end: 0 },
            parameters: {
              height: 0,
              width: 0,
              pixelsPerSecond: 0,
              fftSize: 0,
              hopSize: 0,
              windowType: 'Unknown',
              colorPreset: 'Unknown',
              frequencyScale: 'Unknown',
              mappingType: 'Unknown'
            }
          },
          custom: jsonData.custom
        };
      }
      
      // Fallback to checking for common XMP tags
      if (xmp['Xmp.xmp.CreatorTool'] || xmp['Xmp.xmp.MetadataDate'] || xmp['Xmp.xmp.Keywords']) {
        return {
          originalFile: 'Unknown',
          originalFileName: 'Unknown',
          originalFileSize: 0,
          originalFormat: 'Unknown',
          originalDuration: 0,
          sampleRate: 0,
          channels: 0,
          bitRate: 0,
          codec: 'Unknown',
          spectrogramInfo: {
            generationTime: 'Unknown',
            timeRange: { start: 0, end: 0 },
            parameters: {
              height: 0,
              width: 0,
              pixelsPerSecond: 0,
              fftSize: 0,
              hopSize: 0,
              windowType: 'Unknown',
              colorPreset: 'Unknown',
              frequencyScale: 'Unknown',
              mappingType: 'Unknown'
            }
          }
        };
      }
    } catch (error) {
      console.log('Failed to parse XMP data:', error);
    }
    return null;
  }

  /**
   * Display spectrogram-specific metadata
   * @param metadata - SpectrogramMetadata object
   */
  private displaySpectrogramMetadata(metadata: SpectrogramMetadata): void {
    if (metadata.originalFile) {
      console.log(`  Original File: ${metadata.originalFile}`);
    }
    if (metadata.originalFileName) {
      console.log(`  Original File Name: ${metadata.originalFileName}`);
    }
    if (metadata.originalFileSize) {
      console.log(`  Original File Size: ${metadata.originalFileSize} bytes`);
    }
    if (metadata.originalFormat) {
      console.log(`  Original Format: ${metadata.originalFormat}`);
    }
    if (metadata.originalDuration) {
      console.log(`  Original Duration: ${metadata.originalDuration}s`);
    }
    if (metadata.sampleRate) {
      console.log(`  Sample Rate: ${metadata.sampleRate} Hz`);
    }
    if (metadata.channels) {
      console.log(`  Channels: ${metadata.channels}`);
    }
    if (metadata.bitRate) {
      console.log(`  Bit Rate: ${metadata.bitRate} bps`);
    }
    if (metadata.codec) {
      console.log(`  Codec: ${metadata.codec}`);
    }
    if (metadata.spectrogramInfo) {
      if (metadata.spectrogramInfo.generationTime) {
        console.log(`  Generation Time: ${metadata.spectrogramInfo.generationTime}`);
      }
      if (metadata.spectrogramInfo.timeRange) {
        console.log(`  Time Range: ${metadata.spectrogramInfo.timeRange.start}s - ${metadata.spectrogramInfo.timeRange.end}s`);
      }
      if (metadata.spectrogramInfo.parameters) {
        const params = metadata.spectrogramInfo.parameters;
        console.log(`  Parameters: ${params.width}x${params.height}px, ${params.pixelsPerSecond}pps, ${params.fftSize} FFT, ${params.windowType} window`);
      }
    }
    if (metadata.creationTime) {
      console.log(`  Creation Time: ${metadata.creationTime}`);
    }
    if (metadata.recordingTime) {
      console.log(`  Recording Time: ${metadata.recordingTime}`);
    }
    if (metadata.originalTime) {
      console.log(`  Original Time: ${metadata.originalTime}`);
    }
    if (metadata.location) {
      console.log(`  Location: ${metadata.location.latitude}, ${metadata.location.longitude}`);
      if (metadata.location.locationName) {
        console.log(`  Location Name: ${metadata.location.locationName}`);
      }
      if (metadata.location.locationDescription) {
        console.log(`  Location Description: ${metadata.location.locationDescription}`);
      }
    }
    if (metadata.device) {
      console.log(`  Device: ${metadata.device.manufacturer} ${metadata.device.model}`);
      if (metadata.device.firmware) {
        console.log(`  Device Firmware: ${metadata.device.firmware}`);
      }
      if (metadata.device.serialNumber) {
        console.log(`  Device Serial: ${metadata.device.serialNumber}`);
      }
      if (metadata.device.deviceId) {
        console.log(`  Device ID: ${metadata.device.deviceId}`);
      }
    }
    if (metadata.recording) {
      const rec = metadata.recording;
      if (rec.title) console.log(`  Title: ${rec.title}`);
      if (rec.artist) console.log(`  Artist: ${rec.artist}`);
      if (rec.album) console.log(`  Album: ${rec.album}`);
      if (rec.genre) console.log(`  Genre: ${rec.genre}`);
      if (rec.year) console.log(`  Year: ${rec.year}`);
      if (rec.track) console.log(`  Track: ${rec.track}`);
      if (rec.disc) console.log(`  Disc: ${rec.disc}`);
      if (rec.composer) console.log(`  Composer: ${rec.composer}`);
      if (rec.conductor) console.log(`  Conductor: ${rec.conductor}`);
      if (rec.performer) console.log(`  Performer: ${rec.performer}`);
      if (rec.publisher) console.log(`  Publisher: ${rec.publisher}`);
      if (rec.copyright) console.log(`  Copyright: ${rec.copyright}`);
      if (rec.language) console.log(`  Language: ${rec.language}`);
      if (rec.lyrics) console.log(`  Lyrics: ${rec.lyrics}`);
      if (rec.mood) console.log(`  Mood: ${rec.mood}`);
      if (rec.tempo) console.log(`  Tempo: ${rec.tempo}`);
      if (rec.key) console.log(`  Key: ${rec.key}`);
      if (rec.bpm) console.log(`  BPM: ${rec.bpm}`);
    }
    if (metadata.technical) {
      const tech = metadata.technical;
      if (tech.encoder) console.log(`  Encoder: ${tech.encoder}`);
      if (tech.bitDepth) console.log(`  Bit Depth: ${tech.bitDepth}`);
      if (tech.sampleFormat) console.log(`  Sample Format: ${tech.sampleFormat}`);
      if (tech.channelLayout) console.log(`  Channel Layout: ${tech.channelLayout}`);
      if (tech.compression) console.log(`  Compression: ${tech.compression}`);
      if (tech.quality) console.log(`  Quality: ${tech.quality}`);
      if (tech.bitrateMode) console.log(`  Bitrate Mode: ${tech.bitrateMode}`);
      if (tech.variableBitrate !== undefined) console.log(`  Variable Bitrate: ${tech.variableBitrate}`);
      if (tech.constantBitrate !== undefined) console.log(`  Constant Bitrate: ${tech.constantBitrate}`);
      if (tech.lossless !== undefined) console.log(`  Lossless: ${tech.lossless}`);
      if (tech.lossy !== undefined) console.log(`  Lossy: ${tech.lossy}`);
    }
    if (metadata.broadcast) {
      const bc = metadata.broadcast;
      if (bc.station) console.log(`  Broadcast Station: ${bc.station}`);
      if (bc.show) console.log(`  Broadcast Show: ${bc.show}`);
      if (bc.episode) console.log(`  Broadcast Episode: ${bc.episode}`);
      if (bc.season) console.log(`  Broadcast Season: ${bc.season}`);
      if (bc.network) console.log(`  Broadcast Network: ${bc.network}`);
      if (bc.callSign) console.log(`  Broadcast Call Sign: ${bc.callSign}`);
      if (bc.frequency) console.log(`  Broadcast Frequency: ${bc.frequency}`);
    }
    if (metadata.production) {
      const prod = metadata.production;
      if (prod.producer) console.log(`  Producer: ${prod.producer}`);
      if (prod.engineer) console.log(`  Engineer: ${prod.engineer}`);
      if (prod.mixer) console.log(`  Mixer: ${prod.mixer}`);
      if (prod.arranger) console.log(`  Arranger: ${prod.arranger}`);
      if (prod.studio) console.log(`  Studio: ${prod.studio}`);
      if (prod.session) console.log(`  Session: ${prod.session}`);
      if (prod.take) console.log(`  Take: ${prod.take}`);
      if (prod.project) console.log(`  Project: ${prod.project}`);
    }
  }
}