import { spawn } from 'child_process';

const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

export interface AudioMetadata {
  // Basic file info
  fileName: string;
  filePath: string;
  fileSize: number;
  format: string;
  duration: number;
  
  // Audio stream info
  sampleRate: number;
  channels: number;
  bitRate: number;
  codec: string;
  
  // Extended audio info
  audioInfo?: {
    profile?: string;
    level?: string;
    frameRate?: string;
    timeBase?: string;
    startTime?: number;
    disposition?: any;
    tags?: Record<string, string>;
  };
  
  // Video stream info (if present)
  videoInfo?: {
    codec?: string;
    width?: number;
    height?: number;
    frameRate?: string;
    bitRate?: number;
    profile?: string;
    level?: string;
    pixelFormat?: string;
    colorSpace?: string;
    colorRange?: string;
    colorTransfer?: string;
    colorPrimaries?: string;
    disposition?: any;
    tags?: Record<string, string>;
  };
  
  // Format-level metadata
  formatInfo?: {
    startTime?: number;
    bitRate?: number;
    probeScore?: number;
    tags?: Record<string, string>;
  };
  
  // Timestamps and dates
  creationTime?: string;
  modificationTime?: string;
  recordingTime?: string;
  originalTime?: string;
  
  // Location data (if available)
  location?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    locationName?: string;
    locationDescription?: string;
  };
  
  // Device info (if available)
  device?: {
    manufacturer?: string;
    model?: string;
    software?: string;
    firmware?: string;
    serialNumber?: string;
    deviceId?: string;
  };
  
  // Recording info
  recording?: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: string;
    comment?: string;
    track?: string;
    disc?: string;
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
    bpm?: string;
  };
  
  // Technical metadata
  technical?: {
    encoder?: string;
    bitDepth?: number;
    sampleFormat?: string;
    channelLayout?: string;
    compression?: string;
    quality?: string;
    bitrateMode?: string;
    variableBitrate?: boolean;
    constantBitrate?: boolean;
    lossless?: boolean;
    lossy?: boolean;
  };
  
  // ID3 and other tag metadata
  id3Tags?: {
    version?: string;
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    comment?: string;
    genre?: string;
    track?: string;
    disc?: string;
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
    bpm?: string;
    originalArtist?: string;
    originalYear?: string;
    originalFilename?: string;
    url?: string;
    encodedBy?: string;
    encoderSettings?: string;
    playCount?: string;
    rating?: string;
    [key: string]: string | undefined;
  };
  
  // Vorbis comments (for OGG files)
  vorbisComments?: Record<string, string>;
  
  // FLAC metadata
  flacMetadata?: {
    vendor?: string;
    comments?: Record<string, string>;
    seektable?: any;
    application?: any;
    cuesheet?: any;
    picture?: any;
  };
  
  // MP3 specific metadata
  mp3Metadata?: {
    id3v1?: Record<string, string>;
    id3v2?: Record<string, string>;
    xing?: any;
    vbri?: any;
    lame?: any;
  };
  
  // WAV specific metadata
  wavMetadata?: {
    format?: string;
    chunks?: any[];
    bext?: any;
    cue?: any;
    list?: any;
  };
  
  // Broadcast metadata
  broadcast?: {
    station?: string;
    show?: string;
    episode?: string;
    season?: string;
    network?: string;
    callSign?: string;
    frequency?: string;
  };
  
  // Production metadata
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
  
  // Custom metadata
  custom?: Record<string, string>;
}

export class MetadataExtractor {
  private ffprobePath: string;

  constructor() {
    this.ffprobePath = (ffprobeInstaller as any).path;
  }

  /**
   * Extract comprehensive metadata from an audio file
   * @param filePath - Path to the audio file
   * @returns Promise<AudioMetadata> with all available metadata
   */
  async extractMetadata(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        '-show_private_data',
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
          const rawMetadata = JSON.parse(stdout);
          const metadata = this.parseMetadata(rawMetadata, filePath);
          resolve(metadata);
        } catch (error) {
          reject(new Error(`Failed to parse metadata: ${error}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe error: ${error.message}`));
      });
    });
  }

  async saveMetadata(metadata: AudioMetadata, outputPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Parse raw ffprobe output into structured metadata
   * @param rawMetadata - Raw JSON from ffprobe
   * @param filePath - Original file path
   * @returns Structured AudioMetadata object
   */
  private parseMetadata(rawMetadata: any, filePath: string): AudioMetadata {
    const format = rawMetadata.format || {};
    const audioStream = rawMetadata.streams?.find((s: any) => s.codec_type === 'audio') || null;
    const videoStream = rawMetadata.streams?.find((s: any) => s.codec_type === 'video') || null;
    
    const metadata: AudioMetadata = {
      fileName: filePath.split(/[/\\]/).pop() || '',
      filePath: filePath,
      fileSize: parseInt(format.size) || 0,
      format: format.format_name || '',
      duration: parseFloat(format.duration) || 0,
      
      sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : 0,
      channels: audioStream?.channels ? parseInt(audioStream.channels) : 0,
      bitRate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : (format.bit_rate ? parseInt(format.bit_rate) : 0),
      codec: audioStream?.codec_name || '',
      
      technical: {
        encoder: audioStream?.codec_long_name || '',
        bitDepth: this.extractBitDepth(audioStream),
        sampleFormat: audioStream?.sample_fmt || '',
        channelLayout: audioStream?.channel_layout || ''
      },
      
      custom: {}
    };

    // Extract extended audio info
    if (audioStream) {
      metadata.audioInfo = {
        profile: audioStream.profile,
        level: audioStream.level,
        frameRate: audioStream.r_frame_rate,
        timeBase: audioStream.time_base,
        startTime: parseFloat(audioStream.start_time || '0'),
        disposition: audioStream.disposition,
        tags: audioStream.tags || {}
      };
    }

    // Extract video info if present
    if (videoStream) {
      metadata.videoInfo = {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        frameRate: videoStream.r_frame_rate,
        bitRate: parseInt(videoStream.bit_rate),
        profile: videoStream.profile,
        level: videoStream.level,
        pixelFormat: videoStream.pix_fmt,
        colorSpace: videoStream.color_space,
        colorRange: videoStream.color_range,
        colorTransfer: videoStream.color_transfer,
        colorPrimaries: videoStream.color_primaries,
        disposition: videoStream.disposition,
        tags: videoStream.tags || {}
      };
    }

    // Extract format info
    if (format) {
      metadata.formatInfo = {
        startTime: parseFloat(format.start_time),
        bitRate: parseInt(format.bit_rate),
        probeScore: format.probe_score,
        tags: format.tags || {}
      };
    }

    // Extract timestamps
    if (format.tags) {
      metadata.creationTime = format.tags.creation_time || format.tags.date || format.tags.DATE;
      metadata.modificationTime = format.tags.modification_time;
      metadata.recordingTime = format.tags.recording_time || format.tags.recorded_date;
      metadata.originalTime = format.tags.original_time || format.tags.original_date;
    }

    // Extract location data
    if (format.tags) {
      const location = this.extractLocationData(format.tags);
      if (location) {
        metadata.location = location;
      }
    }

    // Extract device info
    if (format.tags) {
      const device = this.extractDeviceData(format.tags);
      if (device) {
        metadata.device = device;
      }
    }

    // Extract recording info
    if (format.tags) {
      const recording = this.extractRecordingData(format.tags);
      if (recording) {
        metadata.recording = recording;
      }
    }

    // Extract technical metadata
    if (format.tags || audioStream) {
      const technical = this.extractTechnicalData(format.tags || {}, audioStream);
      if (technical) {
        metadata.technical = { ...metadata.technical, ...technical };
      }
    }

    // Extract ID3 tags
    if (format.tags) {
      const id3Tags = this.extractID3Tags(format.tags);
      if (Object.keys(id3Tags).length > 0) {
        metadata.id3Tags = id3Tags;
      }
    }

    // Extract format-specific metadata
    if (format.format_name) {
      const formatSpecific = this.extractFormatSpecificMetadata(format, audioStream, format.tags || {});
      if (formatSpecific) {
        Object.assign(metadata, formatSpecific);
      }
    }

    // Extract broadcast metadata
    if (format.tags) {
      const broadcast = this.extractBroadcastData(format.tags);
      if (broadcast) {
        metadata.broadcast = broadcast;
      }
    }

    // Extract production metadata
    if (format.tags) {
      const production = this.extractProductionData(format.tags);
      if (production) {
        metadata.production = production;
      }
    }

    // Extract custom metadata
    if (format.tags) {
      metadata.custom = this.extractCustomMetadata(format.tags);
    }

    return metadata;
  }

  /**
   * Extract bit depth from audio stream
   * @param audioStream - Audio stream object from ffprobe
   * @returns Bit depth in bits
   */
  private extractBitDepth(audioStream: any): number {
    if (!audioStream) return 0;
    
    const sampleFmt = audioStream.sample_fmt;
    if (!sampleFmt) return 0;

    switch (sampleFmt) {
      case 'u8': return 8;
      case 's16': return 16;
      case 's32': return 32;
      case 'flt': return 32;
      case 'dbl': return 64;
      case 'fltp': return 32;
      default: 
        console.warn(`Unknown sample format in metadata: ${sampleFmt}, returning 0`);
        return 0; // Unknown format, return 0 to indicate unknown
    }
  }

  /**
   * Extract location data from tags
   * @param tags - Format tags object
   * @returns Location object or null
   */
  private extractLocationData(tags: any): any {
    const location: any = {};

    // Try various location tag formats
    const lat = tags.latitude || tags.lat || tags.gps_latitude || tags.GPS_LATITUDE || 
                tags['com.apple.quicktime.location.ISO6709'] || tags['©xyz'] || tags['©gps'] ||
                tags['location.latitude'] || tags['gps.latitude'] || tags['geo.lat'];
    const lon = tags.longitude || tags.lon || tags.gps_longitude || tags.GPS_LONGITUDE || 
                tags['com.apple.quicktime.location.ISO6709'] || tags['©xyz'] || tags['©gps'] ||
                tags['location.longitude'] || tags['gps.longitude'] || tags['geo.lon'];
    const alt = tags.altitude || tags.gps_altitude || tags.GPS_ALTITUDE || 
                tags['com.apple.quicktime.location.altitude'] || tags['©xyz'] || tags['©gps'] ||
                tags['location.altitude'] || tags['gps.altitude'] || tags['geo.alt'];

    // Try to parse location from ISO6709 format (common in M4A files)
    if (tags['com.apple.quicktime.location.ISO6709']) {
      const iso6709 = tags['com.apple.quicktime.location.ISO6709'];
      const parsed = this.parseISO6709Location(iso6709);
      if (parsed) {
        location.latitude = parsed.latitude;
        location.longitude = parsed.longitude;
        location.altitude = parsed.altitude;
      }
    }

    // Try to parse location from ©xyz format (QuickTime location)
    if (tags['©xyz']) {
      const xyz = tags['©xyz'];
      const parsed = this.parseXYZLocation(xyz);
      if (parsed) {
        location.latitude = parsed.latitude;
        location.longitude = parsed.longitude;
        location.altitude = parsed.altitude;
      }
    }

    // Try to parse location from ©gps format
    if (tags['©gps']) {
      const gps = tags['©gps'];
      const parsed = this.parseGPSLocation(gps);
      if (parsed) {
        location.latitude = parsed.latitude;
        location.longitude = parsed.longitude;
        location.altitude = parsed.altitude;
      }
    }

    // Try to parse location from other common formats
    if (tags['location.coordinates']) {
      const coords = tags['location.coordinates'];
      const parsed = this.parseCoordinateString(coords);
      if (parsed) {
        location.latitude = parsed.latitude;
        location.longitude = parsed.longitude;
        location.altitude = parsed.altitude;
      }
    }

    // Try to parse location from JSON format
    if (tags['location.json']) {
      try {
        const locationJson = JSON.parse(tags['location.json']);
        if (locationJson.lat && locationJson.lon) {
          location.latitude = parseFloat(locationJson.lat);
          location.longitude = parseFloat(locationJson.lon);
          location.altitude = locationJson.alt ? parseFloat(locationJson.alt) : 0;
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }

    // Standard GPS coordinates
    if (lat && !location.latitude) {
      location.latitude = parseFloat(lat);
    }
    if (lon && !location.longitude) {
      location.longitude = parseFloat(lon);
    }
    if (alt && !location.altitude) {
      location.altitude = parseFloat(alt);
    }

    // Location name and description
    location.locationName = tags.location_name || tags.LOCATION_NAME || 
                           tags['com.apple.quicktime.location.name'] || 
                           tags['©nam'] || tags['©loc'] ||
                           tags['location.name'] || tags['geo.name'];
    location.locationDescription = tags.location_description || tags.LOCATION_DESCRIPTION || 
                                 tags['com.apple.quicktime.location.description'] || 
                                 tags['©cmt'] || tags['©loc'] ||
                                 tags['location.description'] || tags['geo.description'];

    return Object.keys(location).length > 0 ? location : null;
  }

  /**
   * Parse ISO6709 location format (common in M4A files)
   * @param iso6709 - ISO6709 location string
   * @returns Parsed location object or null
   */
  private parseISO6709Location(iso6709: string): any {
    try {
      // ISO6709 format: +DDMMSS.SSSS+DDDMMSS.SSSS+AAAA.AAA/
      // Example: +3747.1234+12228.5678+0000.000/
      const match = iso6709.match(/^([+-])(\d{2})(\d{2})(\d{2}\.\d+)([+-])(\d{3})(\d{2})(\d{2}\.\d+)([+-])(\d{4}\.\d+)/);
      if (match) {
        const [, latSign, latDeg, latMin, latSec, lonSign, lonDeg, lonMin, lonSec, altSign, alt] = match;
        
        const latitude = (latSign === '+' ? 1 : -1) * 
                        (parseInt(latDeg) + parseInt(latMin) / 60 + parseFloat(latSec) / 3600);
        const longitude = (lonSign === '+' ? 1 : -1) * 
                         (parseInt(lonDeg) + parseInt(lonMin) / 60 + parseFloat(lonSec) / 3600);
        const altitude = (altSign === '+' ? 1 : -1) * parseFloat(alt);
        
        return { latitude, longitude, altitude };
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Parse XYZ location format (QuickTime location)
   * @param xyz - XYZ location string
   * @returns Parsed location object or null
   */
  private parseXYZLocation(xyz: string): any {
    try {
      // XYZ format is often binary data, but sometimes contains text coordinates
      // This is a simplified parser - actual implementation might need binary parsing
      if (xyz.includes(',')) {
        const coords = xyz.split(',').map(c => parseFloat(c.trim()));
        if (coords.length >= 2) {
          return {
            latitude: coords[0],
            longitude: coords[1],
            altitude: coords[2] || 0
          };
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Parse GPS location format
   * @param gps - GPS location string
   * @returns Parsed location object or null
   */
  private parseGPSLocation(gps: string): any {
    try {
      // GPS format can vary - try common patterns
      if (gps.includes(',')) {
        const coords = gps.split(',').map(c => parseFloat(c.trim()));
        if (coords.length >= 2) {
          return {
            latitude: coords[0],
            longitude: coords[1],
            altitude: coords[2] || 0
          };
        }
      }
      
      // Try JSON format
      if (gps.startsWith('{') || gps.startsWith('[')) {
        const parsed = JSON.parse(gps);
        if (parsed.lat && parsed.lon) {
          return {
            latitude: parseFloat(parsed.lat),
            longitude: parseFloat(parsed.lon),
            altitude: parsed.alt ? parseFloat(parsed.alt) : 0
          };
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Parse coordinate string in various formats
   * @param coords - Coordinate string
   * @returns Parsed location object or null
   */
  private parseCoordinateString(coords: string): any {
    try {
      // Try comma-separated format: "lat,lon,alt"
      if (coords.includes(',')) {
        const parts = coords.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          return {
            latitude: parseFloat(parts[0]),
            longitude: parseFloat(parts[1]),
            altitude: parts[2] ? parseFloat(parts[2]) : 0
          };
        }
      }

      // Try space-separated format: "lat lon alt"
      if (coords.includes(' ')) {
        const parts = coords.split(' ').filter(p => p.trim());
        if (parts.length >= 2) {
          return {
            latitude: parseFloat(parts[0]),
            longitude: parseFloat(parts[1]),
            altitude: parts[2] ? parseFloat(parts[2]) : 0
          };
        }
      }

      // Try semicolon-separated format: "lat;lon;alt"
      if (coords.includes(';')) {
        const parts = coords.split(';').map(p => p.trim());
        if (parts.length >= 2) {
          return {
            latitude: parseFloat(parts[0]),
            longitude: parseFloat(parts[1]),
            altitude: parts[2] ? parseFloat(parts[2]) : 0
          };
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Extract device information from tags
   * @param tags - Format tags object
   * @returns Device object or null
   */
  private extractDeviceData(tags: any): any {
    const device: any = {};

    // Try various device tag formats
    device.manufacturer = tags.manufacturer || tags.make || tags.Make;
    device.model = tags.model || tags.Model;
    device.software = tags.software || tags.encoder || tags.encoded_by;

    return Object.values(device).some(v => v) ? device : null;
  }

  /**
   * Extract recording information from tags
   * @param tags - Format tags object
   * @returns Recording object or null
   */
  private extractRecordingData(tags: any): any {
    const recording: any = {};

    // Try various recording tag formats
    recording.title = tags.title || tags.TITLE;
    recording.artist = tags.artist || tags.ARTIST;
    recording.album = tags.album || tags.ALBUM;
    recording.genre = tags.genre || tags.GENRE;
    recording.year = tags.year || tags.YEAR || tags.date;
    recording.comment = tags.comment || tags.COMMENT;

    return Object.values(recording).some(v => v) ? recording : null;
  }

  /**
   * Extract technical metadata from tags and audio stream
   * @param tags - Format tags object
   * @param audioStream - Audio stream object from ffprobe
   * @returns Technical metadata object or null
   */
  private extractTechnicalData(tags: any, audioStream: any): any {
    const technical: any = {};

    // Try various technical tag formats
    technical.encoder = audioStream?.codec_long_name || tags.encoder || tags.ENCODER;
    technical.bitDepth = this.extractBitDepth(audioStream);
    technical.sampleFormat = audioStream?.sample_fmt || tags.sample_fmt || tags.SAMPLE_FMT;
    technical.channelLayout = audioStream?.channel_layout || tags.channel_layout || tags.CHANNEL_LAYOUT;
    technical.compression = tags.compression_mode || tags.COMPRESSION_MODE;
    technical.quality = tags.quality || tags.QUALITY;
    technical.bitrateMode = tags.bitrate_mode || tags.BITRATE_MODE;
    technical.variableBitrate = tags.variable_bitrate || tags.VARIABLE_BITRATE;
    technical.constantBitrate = tags.constant_bitrate || tags.CONSTANT_BITRATE;
    technical.lossless = tags.lossless || tags.LOSSLESS;
    technical.lossy = tags.lossy || tags.LOSSY;

    return Object.keys(technical).length > 0 ? technical : null;
  }

  /**
   * Extract ID3 tags from tags
   * @param tags - Format tags object
   * @returns ID3 tags object
   */
  private extractID3Tags(tags: any): any {
    const id3Tags: any = {};

    // Try various ID3 tag formats
    id3Tags.version = tags.id3v2_version || tags.ID3v2_version;
    id3Tags.title = tags.title || tags.TITLE;
    id3Tags.artist = tags.artist || tags.ARTIST;
    id3Tags.album = tags.album || tags.ALBUM;
    id3Tags.year = tags.year || tags.YEAR || tags.date;
    id3Tags.comment = tags.comment || tags.COMMENT;
    id3Tags.genre = tags.genre || tags.GENRE;
    id3Tags.track = tags.track || tags.TRACK;
    id3Tags.disc = tags.disc || tags.DISC;
    id3Tags.composer = tags.composer || tags.COMPOSER;
    id3Tags.conductor = tags.conductor || tags.CONDUCTOR;
    id3Tags.performer = tags.performer || tags.PERFORMER;
    id3Tags.publisher = tags.publisher || tags.PUBLISHER;
    id3Tags.copyright = tags.copyright || tags.COPYRIGHT;
    id3Tags.language = tags.language || tags.LANGUAGE;
    id3Tags.lyrics = tags.lyrics || tags.LYRICS;
    id3Tags.mood = tags.mood || tags.MOOD;
    id3Tags.tempo = tags.tempo || tags.TEMPO;
    id3Tags.key = tags.key || tags.KEY;
    id3Tags.bpm = tags.bpm || tags.BPM;
    id3Tags.originalArtist = tags.original_artist || tags.ORIGINAL_ARTIST;
    id3Tags.originalYear = tags.original_year || tags.ORIGINAL_YEAR;
    id3Tags.originalFilename = tags.original_filename || tags.ORIGINAL_FILENAME;
    id3Tags.url = tags.url || tags.URL;
    id3Tags.encodedBy = tags.encoded_by || tags.ENCODED_BY;
    id3Tags.encoderSettings = tags.encoder_settings || tags.ENCODER_SETTINGS;
    id3Tags.playCount = tags.play_count || tags.PLAY_COUNT;
    id3Tags.rating = tags.rating || tags.RATING;

    return Object.keys(id3Tags).length > 0 ? id3Tags : null;
  }

  /**
   * Extract format-specific metadata (e.g., Vorbis comments, FLAC metadata)
   * @param format - Format object from ffprobe
   * @param audioStream - Audio stream object from ffprobe
   * @param tags - Format tags object
   * @returns Format-specific metadata object or null
   */
  private extractFormatSpecificMetadata(format: any, audioStream: any, tags: any): any {
    const formatSpecific: any = {};

    // Vorbis comments (for OGG files)
    if (format.format_name === 'ogg') {
      formatSpecific.vorbisComments = audioStream?.tags || {};
    }

    // FLAC metadata
    if (format.format_name === 'flac') {
      formatSpecific.flacMetadata = {
        vendor: audioStream?.vendor || tags.VENDOR,
        comments: audioStream?.comments || tags.COMMENTS,
        seektable: audioStream?.seektable,
        application: audioStream?.application,
        cuesheet: audioStream?.cuesheet,
        picture: audioStream?.picture
      };
    }

    // MP3 specific metadata
    if (format.format_name === 'mp3') {
      formatSpecific.mp3Metadata = {
        id3v1: audioStream?.id3v1 || tags.ID3v1,
        id3v2: audioStream?.id3v2 || tags.ID3v2,
        xing: audioStream?.xing || tags.XING,
        vbri: audioStream?.vbri || tags.VBRI,
        lame: audioStream?.lame || tags.LAME
      };
    }

    // WAV specific metadata
    if (format.format_name === 'wav') {
      formatSpecific.wavMetadata = {
        format: audioStream?.format || tags.FORMAT,
        chunks: audioStream?.chunks,
        bext: audioStream?.bext || tags.BEXT,
        cue: audioStream?.cue || tags.CUE,
        list: audioStream?.list || tags.LIST
      };
    }

    return Object.keys(formatSpecific).length > 0 ? formatSpecific : null;
  }

  /**
   * Extract broadcast metadata from tags
   * @param tags - Format tags object
   * @returns Broadcast metadata object or null
   */
  private extractBroadcastData(tags: any): any {
    const broadcast: any = {};

    // Try various broadcast tag formats
    broadcast.station = tags.station || tags.STATION;
    broadcast.show = tags.show || tags.SHOW;
    broadcast.episode = tags.episode || tags.EPISODE;
    broadcast.season = tags.season || tags.SEASON;
    broadcast.network = tags.network || tags.NETWORK;
    broadcast.callSign = tags.call_sign || tags.CALL_SIGN;
    broadcast.frequency = tags.frequency || tags.FREQUENCY;

    return Object.keys(broadcast).length > 0 ? broadcast : null;
  }

  /**
   * Extract production metadata from tags
   * @param tags - Format tags object
   * @returns Production metadata object or null
   */
  private extractProductionData(tags: any): any {
    const production: any = {};

    // Try various production tag formats
    production.producer = tags.producer || tags.PRODUCER;
    production.engineer = tags.engineer || tags.ENGINEER;
    production.mixer = tags.mixer || tags.MIXER;
    production.arranger = tags.arranger || tags.ARRANGER;
    production.studio = tags.studio || tags.STUDIO;
    production.session = tags.session || tags.SESSION;
    production.take = tags.take || tags.TAKE;
    production.project = tags.project || tags.PROJECT;

    return Object.keys(production).length > 0 ? production : null;
  }

  /**
   * Extract custom metadata from tags
   * @param tags - Format tags object
   * @returns Custom metadata object
   */
  private extractCustomMetadata(tags: any): Record<string, string> {
    const custom: Record<string, string> = {};
    
    // Extract all tags that aren't standard metadata
    const standardKeys = [
      'creation_time', 'modification_time', 'date', 'DATE',
      'latitude', 'longitude', 'altitude', 'lat', 'lon',
      'manufacturer', 'make', 'Make', 'model', 'Model',
      'software', 'encoder', 'encoded_by',
      'title', 'TITLE', 'artist', 'ARTIST', 'album', 'ALBUM',
      'genre', 'GENRE', 'year', 'YEAR', 'comment', 'COMMENT'
    ];

    for (const [key, value] of Object.entries(tags)) {
      if (!standardKeys.includes(key) && typeof value === 'string') {
        custom[key] = value;
      }
    }

    return custom;
  }
}