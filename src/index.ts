#!/usr/bin/env node

import { Command } from 'commander';
import { SpectrogramGenerator } from './spectrogram-generator';
import { AudioProcessor } from './audio-processor';
import { MetadataExtractor } from './metadata-extractor';
import { DEFAULTS, VALID_OPTIONS } from './constants';
import path from 'path';
import fs from 'fs';

import packageJson from '../package.json';

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .argument('<audio-file>', 'Path to the audio file')
  .option('-o, --output <output-file>', 'Output PNG file path (default: <audio-file>.png)')
  .option('-h, --height <height>', `Spectrogram height in pixels (default: ${DEFAULTS.HEIGHT})`, DEFAULTS.HEIGHT.toString())
  .option('-p, --pixels-per-second <pps>', `Pixels per second for width calculation (default: ${DEFAULTS.PIXELS_PER_SECOND})`, DEFAULTS.PIXELS_PER_SECOND.toString())
  .option('-f, --fft-size <size>', `FFT size (default: ${DEFAULTS.FFT_SIZE})`, DEFAULTS.FFT_SIZE.toString())
  .option('--window <type>', `Window function type: ${VALID_OPTIONS.WINDOW_TYPES.join(', ')} (default: ${DEFAULTS.WINDOW_TYPE})`, DEFAULTS.WINDOW_TYPE)
  .option('--hop-size <size>', `Hop size in samples (default: ${DEFAULTS.HOP_SIZE})`, DEFAULTS.HOP_SIZE.toString())
  .option('--color <preset>', `Color preset: ${VALID_OPTIONS.COLOR_PRESETS.join(', ')} (default: ${DEFAULTS.COLOR_PRESET})`, DEFAULTS.COLOR_PRESET)
  .option('--scale <type>', `Frequency scale: ${VALID_OPTIONS.FREQUENCY_SCALES.join(', ')} (default: ${DEFAULTS.FREQUENCY_SCALE})`, DEFAULTS.FREQUENCY_SCALE)
  .option('--mapping <type>', `Intensity mapping: ${VALID_OPTIONS.MAPPING_TYPES.join(', ')} (default: ${DEFAULTS.MAPPING_TYPE})`, DEFAULTS.MAPPING_TYPE)
  .option('--min-freq <hz>', 'Minimum frequency in Hz (default: none)', '')
  .option('--max-freq <hz>', 'Maximum frequency in Hz (default: none)', '')
  .option('--min-db <db>', 'Minimum dB for color mapping (default: auto)', '')
  .option('--max-db <db>', 'Maximum dB for color mapping (default: auto)', '')
  .action(async (audioFile: string, options: any) => {
    try {

      audioFile = audioFile.replace(/\\/g, '/');

      if (!fs.existsSync(audioFile)) {
        console.error(`Error: Audio file '${audioFile}' does not exist.`);
        process.exit(1);
      }

      const outputFile = options.output || `${path.parse(audioFile).name}.png`;
      const finalOutputPath = options.output ? outputFile : path.join(DEFAULTS.OUTPUT_DIR, outputFile);
      
      if (!options.output) {
        const outputDir = path.dirname(finalOutputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      }

      const height = parseInt(options.height);
      const pixelsPerSecond = parseFloat(options.pixelsPerSecond);
      const fftSize = parseInt(options.fftSize);
      const hopSize = parseInt(options.hopSize);
      const minDb = options.minDb ? parseFloat(options.minDb) : null;
      const maxDb = options.maxDb ? parseFloat(options.maxDb) : null;

      const windowType = options.window.toLowerCase();
      if (!VALID_OPTIONS.WINDOW_TYPES.includes(windowType as any)) {
        console.error(`Error: Invalid window type '${options.window}'. Valid options: ${VALID_OPTIONS.WINDOW_TYPES.join(', ')}`);
        process.exit(1);
      }

      const colorPreset = options.color.toLowerCase();
      if (!VALID_OPTIONS.COLOR_PRESETS.includes(colorPreset as any)) {
        console.error(`Error: Invalid color preset '${options.color}'. Valid options: ${VALID_OPTIONS.COLOR_PRESETS.join(', ')}`);
        process.exit(1);
      }

      const frequencyScale = options.scale.toLowerCase();
      if (!VALID_OPTIONS.FREQUENCY_SCALES.includes(frequencyScale as any)) {
        console.error(`Error: Invalid frequency scale '${options.scale}'. Valid options: ${VALID_OPTIONS.FREQUENCY_SCALES.join(', ')}`);
        process.exit(1);
      }

      const mappingType = options.mapping.toLowerCase();
      if (!VALID_OPTIONS.MAPPING_TYPES.includes(mappingType as any)) {
        console.error(`Error: Invalid mapping type '${options.mapping}'. Valid options: ${VALID_OPTIONS.MAPPING_TYPES.join(', ')}`);
        process.exit(1);
      }

      const minFrequency = options.minFreq ? parseFloat(options.minFreq) : null;
      const maxFrequency = options.maxFreq ? parseFloat(options.maxFreq) : null;

      console.log(`Processing audio file: ${audioFile}`);
      console.log('');
      console.log(`Spectrogram height: ${height}px`);
      console.log(`Pixels per second: ${pixelsPerSecond}`);
      console.log(`Color preset : ${colorPreset}`);
      console.log(`Frequency scale: ${frequencyScale}`);
      console.log(`Intensity mapping: ${mappingType}`);
      if (minFrequency) console.log(`Minimum frequency: ${minFrequency}Hz`);
      if (maxFrequency) console.log(`Maximum frequency: ${maxFrequency}Hz`);

      console.log('');
      console.log('Extracting metadata...');
      const metadataExtractor = new MetadataExtractor();
      const audioMetadata = await metadataExtractor.extractMetadata(audioFile);
      
      const metaOutputPath = finalOutputPath.replace('.png', '.meta.json');
      await metadataExtractor.saveMetadata(audioMetadata, metaOutputPath);
      console.log(`Metadata saved to: ${metaOutputPath}`);

      console.log('');
      const audioProcessor = new AudioProcessor();
      const audioData = await audioProcessor.processAudioFile(audioFile);
      
      console.log(`Audio info: ${audioData.channels} channels, ${audioData.sampleRate} Hz, ${audioData.duration.toFixed(6)}s, ${audioData.sampleFormat} (${audioData.bitsPerSample}-bit)`);

      const width = Math.ceil(audioData.duration * pixelsPerSecond);
      const spectrogramGenerator = new SpectrogramGenerator();

      if (width > DEFAULTS.MAX_WIDTH) {
        const numImages = Math.ceil(width / DEFAULTS.MAX_WIDTH);
        const basePath = finalOutputPath.replace('.png', '');
        
        console.log(`Audio is ${width}px wide, splitting into ${numImages} parts of max ${DEFAULTS.MAX_WIDTH}px each`);

        const globalDbRange = spectrogramGenerator.calculateGlobalDbRange(audioData);
        const globalMinDb = globalDbRange.minDb;
        const globalMaxDb = globalDbRange.maxDb;

        console.log('');
        console.log('Generating overview spectrogram...');
        spectrogramGenerator.generateSpectrogram(
          audioData,
          `${basePath}_overview.png`,
          DEFAULTS.MAX_WIDTH,
          height,
          colorPreset,
          frequencyScale,
          mappingType,
          minFrequency,
          maxFrequency,
          globalMinDb,
          globalMaxDb,
          fftSize,
          hopSize
        );

        for (let i = 0; i < numImages; i++) {
          const startTime = (i * DEFAULTS.MAX_WIDTH) / pixelsPerSecond;
          const endTime = Math.min(((i + 1) * DEFAULTS.MAX_WIDTH) / pixelsPerSecond, audioData.duration);
          const timeRange = endTime - startTime;
          const partWidthActual = Math.ceil(timeRange * pixelsPerSecond);
          
          console.log('');
          console.log(`Generating part ${i + 1}/${numImages} (${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s)...`);
          
          spectrogramGenerator.generateSpectrogram(
            audioData,
            `${basePath}_part${i + 1}.png`,
            partWidthActual,
            height,
            colorPreset,
            frequencyScale,
            mappingType,
            minFrequency,
            maxFrequency,
            globalMinDb,
            globalMaxDb,
            fftSize,
            hopSize,
            startTime,
            endTime
          );
        }

        const stitchedOutputPath = `${basePath}_stitched.png`;

        console.log('');
        
        const { ImageStitcher } = await import('./image-stitcher');
        await ImageStitcher.stitchParts({
          basePath,
          numParts: numImages,
          outputPath: stitchedOutputPath,
          height
        });
        
      } else {
        console.log(`Generating single spectrogram image...`);
        spectrogramGenerator.generateSpectrogram(
          audioData,
          finalOutputPath,
          width,
          height,
          colorPreset,
          frequencyScale,
          mappingType,
          minFrequency,
          maxFrequency,
          minDb,
          maxDb,
          fftSize,
          hopSize
        );
      }

      console.log('');
      console.log(`Done.`);
      
    } catch (error) {
      console.error('Error generating spectrogram:', error);
      process.exit(1);
    }
  });

program.parse();