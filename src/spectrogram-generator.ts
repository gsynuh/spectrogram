import { WindowType, ColorPreset, FrequencyScale, MappingType } from './enums';
import { DEFAULTS, DB_CONSTANTS, WINDOW_CONSTANTS, RENDERING_CONSTANTS } from './constants';
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { AudioData } from './audio-processor';
import { 
  SpectrogramData, 
  SpectrogramFrame, 
  FFTResult, 
  PowerSpectrum, 
  DBSpectrum, 
  GlobalDBRange
} from './types';

const OPTIONS = {
  USE_CANVAS_ANTI_ALIASING: true,
  USE_GLOBAL_DB_RANGE: true,

  // Simplified strategy selection - only keep the most effective algorithms
  DOWNSAMPLE_STRATEGY: 'peak' as 'average' | 'peak',
  UPSAMPLE_STRATEGY: 'bilinear' as 'bilinear' | 'linear',
} as const;

export class SpectrogramGenerator {
  /**
   * Calculate global dB range across all spectrogram frames
   * 
   * This method analyzes the entire spectrogram to determine the minimum and maximum
   * dB values, which are used for consistent color mapping across all frames.
   * 
   * @param audioData - Audio data to analyze
   * @returns Global dB range with min, max, and dynamic range
   */
  public calculateGlobalDbRange(audioData: AudioData): GlobalDBRange {
    const fullSpectrogramData = this.calculateSpectrogram(audioData, 0, audioData.duration, DEFAULTS.FFT_SIZE, DEFAULTS.HOP_SIZE);
    
    let globalMinDb = Infinity;
    let globalMaxDb = -Infinity;
    
    // Iterate through all frames to find global min/max dB values
    for (const frame of fullSpectrogramData.frames) {
      for (const db of frame.frequencyBins) {
        // Filter out extremely low values that are likely noise
        if (db > DB_CONSTANTS.MIN_DB_DISPLAY) {
          globalMinDb = Math.min(globalMinDb, db);
          globalMaxDb = Math.max(globalMaxDb, db);
        }
      }
    }
    
    // Ensure we have valid values
    if (globalMinDb === Infinity) globalMinDb = DB_CONSTANTS.MIN_DB_DISPLAY;
    if (globalMaxDb === -Infinity) globalMaxDb = DB_CONSTANTS.MAX_DB_THEORETICAL;
    
    const dynamicRange = globalMaxDb - globalMinDb;
    
    console.log('');
    console.log(`Global dB range: ${globalMinDb.toFixed(1)}dB to ${globalMaxDb.toFixed(1)}dB (dynamic range: ${dynamicRange.toFixed(1)}dB)`);
    
    return {
      minDb: globalMinDb,
      maxDb: globalMaxDb,
      dynamicRange
    };
  }

  public generateSpectrogram(
    audioData: AudioData,
    outputPath: string,
    width: number,
    height: number,
    colorPreset: ColorPreset,
    frequencyScale: FrequencyScale,
    mappingType: MappingType,
    minFrequency: number | null,
    maxFrequency: number | null,
    minDbParam: number | null,
    maxDbParam: number | null,
    fftSize: number,
    hopSize: number,
    startTime: number = 0,
    endTime?: number
  ): void {
    const requestedDuration = endTime ? (endTime - startTime) : audioData.duration;
    const actualDuration = Math.min(requestedDuration, audioData.duration - startTime);
    
    console.log(`Generating spectrogram for time range: ${startTime.toFixed(2)}s - ${(startTime + actualDuration).toFixed(2)}s`);
    
    const spectrogramData = this.calculateSpectrogram(
      audioData,
      startTime,
      actualDuration,
      fftSize,
      hopSize
    );

    this.createSpectrogramImage(
      spectrogramData,
      outputPath,
      width,
      height,
      colorPreset,
      frequencyScale,
      mappingType,
      minFrequency,
      maxFrequency,
      audioData.sampleRate,
      minDbParam,
      maxDbParam,
      OPTIONS.USE_CANVAS_ANTI_ALIASING
    );
  }

  /**
   * Calculate spectrogram data using FFT (Fast Fourier Transform)
   * 
   * This method performs the core spectrogram calculation by:
   * 1. Dividing audio into overlapping frames
   * 2. Applying window functions to reduce spectral leakage
   * 3. Computing FFT to convert time-domain to frequency-domain
   * 4. Calculating power spectrum (magnitude squared)
   * 5. Converting to dB scale for visualization
   * 
   * @param audioData - Audio data to analyze
   * @param startTime - Start time in seconds
   * @param duration - Duration to analyze in seconds
   * @param fftSize - FFT size in samples (must be power of 2)
   * @param hopSize - Hop size in samples (overlap between frames)
   * @returns Complete spectrogram data structure
   */
  private calculateSpectrogram(
    audioData: AudioData,
    startTime: number,
    duration: number,
    fftSize: number,
    hopSize: number
  ): SpectrogramData {
    // Clamp duration to not exceed actual audio length
    const actualDuration = Math.min(duration, audioData.duration - startTime);
    
    const startFrame = Math.floor(startTime * audioData.sampleRate);
    const endFrame = Math.floor((startTime + actualDuration) * audioData.sampleRate);
    
    // Calculate number of frames for this time range
    const numFrames = Math.floor((endFrame - startFrame - fftSize) / hopSize) + 1;
    
    // Process all frames for this time range
    const frames: SpectrogramFrame[] = [];
    
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = startFrame + frame * hopSize;
      const endSample = Math.min(startSample + fftSize, audioData.samples.length);
      
      // Get samples for this frame
      const frameSamples = new Float32Array(fftSize);
      const availableSamples = endSample - startSample;
      
      // Copy available samples, pad with zeros if needed
      for (let i = 0; i < availableSamples; i++) {
        frameSamples[i] = audioData.samples[startSample + i];
      }
      
      // Apply window function to reduce spectral leakage
      const windowedSamples = this.applyWindow(frameSamples, WindowType.HANNING);
      
      // Perform FFT to convert time-domain to frequency-domain
      const fftResult = this.performFFT(windowedSamples);
      
      // Calculate power spectrum from FFT result
      const powerSpectrum = this.calculatePowerSpectrum(fftResult, fftSize);
      
      // Convert power spectrum to dB scale
      const dbSpectrum = this.convertToDBSpectrum(powerSpectrum, fftSize);
      
      // Create frame with metadata
      const frameTime = startTime + (frame * hopSize) / audioData.sampleRate;
      const frameDuration = hopSize / audioData.sampleRate;
      
      frames.push({
        frequencyBins: dbSpectrum.dbValues,
        timePosition: frameTime,
        frameDuration
      });
    }
    
    // Calculate metadata
    const frequencyResolution = audioData.sampleRate / fftSize;
    const timeResolution = hopSize / audioData.sampleRate;
    const numFrequencyBins = fftSize / 2;
    
    return {
      frames,
      sampleRate: audioData.sampleRate,
      fftSize,
      hopSize,
      duration: actualDuration,
      numFrequencyBins,
      frequencyResolution,
      timeResolution
    };
  }

  /**
   * Calculate power spectrum from FFT result
   * 
   * The power spectrum is calculated as the magnitude squared of each complex
   * FFT coefficient: |X(k)|² = real(k)² + imag(k)²
   * 
   * This represents the power at each frequency bin and is the fundamental
   * quantity used in spectral analysis.
   * 
   * @param fftResult - FFT result containing complex numbers
   * @param fftSize - FFT size used for analysis
   * @returns Power spectrum with magnitude-squared values
   */
  private calculatePowerSpectrum(fftResult: FFTResult, fftSize: number): PowerSpectrum {
    const powerValues = new Array(fftSize / 2);
    
    // Calculate power spectrum for each frequency bin
    for (let i = 0; i < fftSize / 2; i++) {
      const real = fftResult.complexValues[i * 2];
      const imag = fftResult.complexValues[i * 2 + 1];
      
      // Power = magnitude squared = real² + imag²
      powerValues[i] = real * real + imag * imag;
    }
    
    const frequencyResolution = fftResult.size > 0 ? 1.0 / fftResult.size : 0;
    
    return {
      powerValues,
      numBins: fftSize / 2,
      frequencyResolution
    };
  }

  /**
   * Convert power spectrum to dB scale
   * 
   * dB (decibel) is a logarithmic scale that represents power ratios.
   * The formula is: dB = 10 * log₁₀(power / reference_level)
   * 
   * This conversion is necessary because:
   * 1. Human hearing is logarithmic (we perceive loudness logarithmically)
   * 2. Audio signals have a wide dynamic range (quiet sounds to loud sounds)
   * 3. dB scale compresses this range for better visualization
   * 
   * @param powerSpectrum - Power spectrum with magnitude-squared values
   * @param fftSize - FFT size for normalization
   * @returns dB spectrum with logarithmic values
   */
  private convertToDBSpectrum(powerSpectrum: PowerSpectrum, fftSize: number): DBSpectrum {
    // Normalization factor to account for FFT scaling
    const normalizationFactor = fftSize * fftSize;
    const referenceLevel = DB_CONSTANTS.REFERENCE_LEVEL;
    
    const dbValues = powerSpectrum.powerValues.map(power => {
      // Normalize power by FFT size squared
      const normalizedPower = power / normalizationFactor;
      
      // Convert to dB: 10 * log₁₀(power / reference)
      // Use minimum threshold to avoid log(0)
      if (normalizedPower > DB_CONSTANTS.MIN_POWER_VALUE) {
        return 10 * Math.log10(normalizedPower / referenceLevel);
      } else {
        return DB_CONSTANTS.MIN_DB_DISPLAY;
      }
    });
    
    // Calculate min/max for this spectrum
    const minDb = Math.min(...dbValues);
    const maxDb = Math.max(...dbValues);
    
    return {
      dbValues,
      numBins: powerSpectrum.numBins,
      referenceLevel,
      minDb,
      maxDb
    };
  }

  /**
   * Apply window function to reduce spectral leakage
   * 
   * Window functions are applied to audio samples before FFT to reduce
   * spectral leakage - a phenomenon where energy from one frequency
   * "leaks" into adjacent frequency bins.
   * 
   * Different window functions have different trade-offs:
   * - Rectangular: No window, narrowest main lobe, highest sidelobes
   * - Hanning: Good balance of main lobe width and sidelobe suppression
   * - Hamming: Optimized to reduce first sidelobe
   * - Blackman: Very low sidelobes, wider main lobe
   * 
   * @param samples - Audio samples to window
   * @param windowType - Type of window function to apply
   * @returns Windowed samples
   */
  private applyWindow(samples: Float32Array, windowType: WindowType): Float32Array {
    const windowed = new Float32Array(samples.length);
    
    for (let i = 0; i < samples.length; i++) {
      let windowValue = WINDOW_CONSTANTS.RECTANGULAR_COEFFICIENT;
      
      switch (windowType) {
        case WindowType.HANNING:
          // Hanning window: 0.5 * (1 - cos(2π * i / (N-1)))
          windowValue = WINDOW_CONSTANTS.HANNING_COEFFICIENT * 
            (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
          break;
          
        case WindowType.HAMMING:
          // Hamming window: 0.54 - 0.46 * cos(2π * i / (N-1))
          windowValue = WINDOW_CONSTANTS.HAMMING_COEFFICIENT_A - 
            WINDOW_CONSTANTS.HAMMING_COEFFICIENT_B * 
            Math.cos((2 * Math.PI * i) / (samples.length - 1));
          break;
          
        case WindowType.BLACKMAN:
          // Blackman window: 0.42 - 0.5*cos(2π*i/(N-1)) + 0.08*cos(4π*i/(N-1))
          const term1 = WINDOW_CONSTANTS.BLACKMAN_COEFFICIENT_A;
          const term2 = WINDOW_CONSTANTS.BLACKMAN_COEFFICIENT_B * 
            Math.cos((2 * Math.PI * i) / (samples.length - 1));
          const term3 = WINDOW_CONSTANTS.BLACKMAN_COEFFICIENT_C * 
            Math.cos((4 * Math.PI * i) / (samples.length - 1));
          windowValue = term1 - term2 + term3;
          break;
          
        case WindowType.RECTANGULAR:
          windowValue = WINDOW_CONSTANTS.RECTANGULAR_COEFFICIENT;
          break;
      }
      
      windowed[i] = samples[i] * windowValue;
    }
    
    return windowed;
  }

  /**
   * Perform FFT using Cooley-Tukey algorithm
   * 
   * The FFT (Fast Fourier Transform) converts a time-domain signal to
   * frequency-domain representation. The Cooley-Tukey algorithm is a
   * divide-and-conquer approach that requires the input size to be a
   * power of 2 for optimal efficiency.
   * 
   * The result is stored as interleaved complex numbers:
   * [real₀, imag₀, real₁, imag₁, real₂, imag₂, ...]
   * 
   * @param samples - Windowed audio samples
   * @returns FFT result with complex numbers
   */
  private performFFT(samples: Float32Array): FFTResult {
    const n = samples.length;
    const complexValues = new Float32Array(n * 2); // Complex numbers: [real, imag, real, imag, ...]
    
    // Bit-reverse permutation for in-place FFT
    for (let i = 0; i < n; i++) {
      const reversed = this.reverseBits(i, Math.log2(n));
      complexValues[i * 2] = samples[reversed];
      complexValues[i * 2 + 1] = 0; // Initialize imaginary part to 0
    }
    
    // FFT computation using Cooley-Tukey algorithm
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const angleStep = (-2 * Math.PI) / size;
      
      for (let start = 0; start < n; start += size) {
        for (let i = 0; i < halfSize; i++) {
          const angle = angleStep * i;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          // Get even and odd components
          const evenReal = complexValues[(start + i) * 2];
          const evenImag = complexValues[(start + i) * 2 + 1];
          const oddReal = complexValues[(start + i + halfSize) * 2];
          const oddImag = complexValues[(start + i + halfSize) * 2 + 1];
          
          // Complex multiplication: (cos + j*sin) * (oddReal + j*oddImag)
          const tempReal = cos * oddReal - sin * oddImag;
          const tempImag = cos * oddImag + sin * oddReal;
          
          // Butterfly operation
          complexValues[(start + i + halfSize) * 2] = evenReal - tempReal;
          complexValues[(start + i + halfSize) * 2 + 1] = evenImag - tempImag;
          complexValues[(start + i) * 2] = evenReal + tempReal;
          complexValues[(start + i) * 2 + 1] = evenImag + tempImag;
        }
      }
    }
    
    return {
      complexValues,
      size: n
    };
  }

  /**
   * Reverse bits for FFT bit-reversal
   * 
   * This is used in the FFT bit-reversal permutation step to reorder
   * the input samples for in-place computation.
   * 
   * @param x - Number to reverse
   * @param bits - Number of bits to reverse
   * @returns Bit-reversed number
   */
  private reverseBits(x: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (x & 1);
      x >>= 1;
    }
    return result;
  }

  /**
   * Create PNG image from spectrogram data
   * 
   * This method converts the spectrogram data into a visual image by:
   * 1. Resampling data to fit target dimensions
   * 2. Mapping dB values to colors using specified presets
   * 3. Applying frequency scale transformations
   * 4. Rendering to PNG format
   * 
   * @param spectrogramData - Complete spectrogram data
   * @param outputPath - Output file path
   * @param width - Image width in pixels
   * @param height - Image height in pixels
   * @param colorPreset - Color scheme to use
   * @param frequencyScale - Frequency scale transformation
   * @param mappingType - Intensity mapping type
   * @param minFrequency - Minimum frequency (Hz) or null for auto
   * @param maxFrequency - Maximum frequency (Hz) or null for auto
   * @param sampleRate - Audio sample rate
   * @param minDbParam - Minimum dB or null for auto
   * @param maxDbParam - Maximum dB or null for auto
   * @param antiAliasing - Enable canvas anti-aliasing
   */
  private createSpectrogramImage(
    spectrogramData: SpectrogramData,
    outputPath: string,
    width: number,
    height: number,
    colorPreset: ColorPreset,
    frequencyScale: FrequencyScale,
    mappingType: MappingType,
    minFrequency: number | null,
    maxFrequency: number | null,
    sampleRate: number,
    minDbParam: number | null,
    maxDbParam: number | null,
    antiAliasing: boolean = true
  ): void {

    // Use provided dB range or defaults
    const minDb = minDbParam !== null ? minDbParam : DB_CONSTANTS.MIN_DB_DISPLAY;
    const maxDb = maxDbParam !== null ? maxDbParam : DB_CONSTANTS.MAX_DB_THEORETICAL;

    // Validate canvas size to prevent memory issues
    if (width > RENDERING_CONSTANTS.MAX_CANVAS_SIZE || height > RENDERING_CONSTANTS.MAX_CANVAS_SIZE) {
      throw new Error(`Canvas size too large: ${width}x${height}. Maximum allowed: ${RENDERING_CONSTANTS.MAX_CANVAS_SIZE}x${RENDERING_CONSTANTS.MAX_CANVAS_SIZE}`);
    }
    
    // Convert spectrogram data to 2D array for resampling
    const rawData = spectrogramData.frames.map(frame => [...frame.frequencyBins]);
    
    // Resample spectrogram data to fit target width
    const resampledData = this.resampleSpectrogram(rawData, width);
    

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = antiAliasing;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    

    const dbRange = maxDb - minDb;
    
    for (let x = 0; x < width; x++) {
      const frameIndex = Math.min(Math.floor(x * resampledData.length / width), resampledData.length - 1);
      const frame = resampledData[frameIndex];
      
      for (let y = 0; y < height; y++) {

        const freqIndex = this.getFrequencyIndex(y, height, frame.length, frequencyScale, sampleRate, minFrequency, maxFrequency);
        const db = frame[freqIndex] || minDb;
        
        // Normalize dB value to [0, 1] range
        const normalized = db > minDb ? (db - minDb) / dbRange : 0;
        const clamped = Math.max(0, Math.min(1, normalized));
        
        // Apply intensity mapping transformation
        const mapped = this.applyMapping(clamped, mappingType);
        
        // Get color for this intensity value
        const color = this.getColor(mapped, colorPreset);
        
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
  }



  /**
   * Average-based downsampling to preserve more information
   * @param spectrogramData - Input spectrogram data
   * @param targetWidth - Target width
   * @returns Downsampled data
   */
  private averageDownsample(spectrogramData: number[][], targetWidth: number): number[][] {
    const numFrames = spectrogramData.length;
    const step = numFrames / targetWidth;
    const resampled: number[][] = [];
    
    for (let i = 0; i < targetWidth; i++) {
      const startFrame = Math.floor(i * step);
      const endFrame = Math.min(Math.floor((i + 1) * step), numFrames);
      const numFramesInWindow = endFrame - startFrame;
      
      if (numFramesInWindow === 0) {
        // Fallback to nearest neighbor
        const frameIndex = Math.min(startFrame, numFrames - 1);
        resampled.push([...spectrogramData[frameIndex]]);
        continue;
      }
      
      // Average all frames in this window
      const averagedFrame = new Array(spectrogramData[0].length).fill(0);
      
      for (let frameIdx = startFrame; frameIdx < endFrame; frameIdx++) {
        const frame = spectrogramData[frameIdx];
        for (let freqIdx = 0; freqIdx < frame.length; freqIdx++) {
          averagedFrame[freqIdx] += frame[freqIdx];
        }
      }
      
      // Normalize by number of frames
      for (let freqIdx = 0; freqIdx < averagedFrame.length; freqIdx++) {
        averagedFrame[freqIdx] /= numFramesInWindow;
      }
      
      resampled.push(averagedFrame);
    }
    
    return resampled;
  }

  /**
   * Peak-preserving downsampling for overview images
   * Keeps the maximum value in each window to preserve important events
   * @param spectrogramData - Input spectrogram data
   * @param targetWidth - Target width
   * @returns Downsampled data
   */
  private peakPreservingDownsample(spectrogramData: number[][], targetWidth: number): number[][] {
    const numFrames = spectrogramData.length;
    const step = numFrames / targetWidth;
    const resampled: number[][] = [];
    
    for (let i = 0; i < targetWidth; i++) {
      const startFrame = Math.floor(i * step);
      const endFrame = Math.min(Math.floor((i + 1) * step), numFrames);
      const numFramesInWindow = endFrame - startFrame;
      
      if (numFramesInWindow === 0) {
        // Fallback to nearest neighbor
        const frameIndex = Math.min(startFrame, numFrames - 1);
        resampled.push([...spectrogramData[frameIndex]]);
        continue;
      }
      
      // Find the peak value in each frequency bin for this window
      const peakFrame = new Array(spectrogramData[0].length).fill(-Infinity);
      
      for (let frameIdx = startFrame; frameIdx < endFrame; frameIdx++) {
        const frame = spectrogramData[frameIdx];
        for (let freqIdx = 0; freqIdx < frame.length; freqIdx++) {
          peakFrame[freqIdx] = Math.max(peakFrame[freqIdx], frame[freqIdx]);
        }
      }
      
      resampled.push(peakFrame);
    }
    
    return resampled;
  }



  /**
   * Linear interpolation upsampling for faster processing
   * @param spectrogramData - Input spectrogram data
   * @param targetWidth - Target width
   * @returns Upsampled data
   */
  private linearUpsample(spectrogramData: number[][], targetWidth: number): number[][] {
    const numFrames = spectrogramData.length;
    const resampled: number[][] = [];
    
    for (let i = 0; i < targetWidth; i++) {

      const frameIndex = targetWidth === 1 ? 0 : (i / (targetWidth - 1)) * (numFrames - 1);
      const frameIndexFloor = Math.floor(frameIndex);
      const frameIndexCeil = Math.min(frameIndexFloor + 1, numFrames - 1);
      const timeInterpFactor = frameIndex - frameIndexFloor;
      
      const frameFloor = spectrogramData[frameIndexFloor];
      const frameCeil = spectrogramData[frameIndexCeil];
      
      const interpolatedFrame = frameFloor.map((value, freqIndex) => {
        const valueCeil = frameCeil[freqIndex];
        return value + timeInterpFactor * (valueCeil - value);
      });
      
      resampled.push(interpolatedFrame);
    }
    
    return resampled;
  }

  /**
   * Bilinear interpolation upsampling for 2D image generation
   * Interpolates both time and frequency axes for smoother results
   * @param spectrogramData - Input spectrogram data
   * @param targetWidth - Target width
   * @returns Upsampled data
   */
  private bilinearUpsample(spectrogramData: number[][], targetWidth: number): number[][] {
    const numFrames = spectrogramData.length;
    const numFreqBins = spectrogramData[0].length;
    const resampled: number[][] = [];
    
    for (let i = 0; i < targetWidth; i++) {
      // Time axis interpolation
      const frameIndex = (i / (targetWidth - 1)) * (numFrames - 1);
      const frameIndexFloor = Math.floor(frameIndex);
      const frameIndexCeil = Math.min(frameIndexFloor + 1, numFrames - 1);
      const timeInterpFactor = frameIndex - frameIndexFloor;
      
      const frameFloor = spectrogramData[frameIndexFloor];
      const frameCeil = spectrogramData[frameIndexCeil];
      
      // Bilinear interpolation for each frequency bin
      const interpolatedFrame = new Array(numFreqBins);
      
      for (let freqIdx = 0; freqIdx < numFreqBins; freqIdx++) {
        // Get the four corner values for bilinear interpolation
        const v00 = frameFloor[freqIdx]; // Bottom-left
        const v10 = frameCeil[freqIdx];  // Bottom-right
        
        // Frequency axis interpolation (if we had more frequency bins)
        // For now, we interpolate between adjacent frequency bins
        const freqInterpFactor = (freqIdx / (numFreqBins - 1)) % 1;
        const v01 = freqIdx < numFreqBins - 1 ? frameFloor[freqIdx + 1] : v00; // Top-left
        const v11 = freqIdx < numFreqBins - 1 ? frameCeil[freqIdx + 1] : v10;  // Top-right
        
        // Bilinear interpolation formula
        const c0 = v00 * (1 - timeInterpFactor) + v10 * timeInterpFactor;
        const c1 = v01 * (1 - timeInterpFactor) + v11 * timeInterpFactor;
        const interpolatedValue = c0 * (1 - freqInterpFactor) + c1 * freqInterpFactor;
        
        interpolatedFrame[freqIdx] = interpolatedValue;
      }
      
      resampled.push(interpolatedFrame);
    }
    
    return resampled;
  }



  /**
   * Resample spectrogram data to fit target width using adaptive strategies
   * @param spectrogramData - Original spectrogram data
   * @param targetWidth - Target width in pixels
   * @returns Resampled spectrogram data
   */
  private resampleSpectrogram(spectrogramData: number[][], targetWidth: number): number[][] {
    const numFrames = spectrogramData.length;
    
    if (numFrames === 0) {
      return [];
    }
    
    if (numFrames === targetWidth) {
      // Perfect match, no resampling needed
      return spectrogramData;
    }
    
    let resampled: number[][] = [];
    let algorithm: string;
    
    if (numFrames < targetWidth) {

      resampled = this.selectUpsamplingStrategy(spectrogramData, targetWidth);
      algorithm = `${OPTIONS.UPSAMPLE_STRATEGY} upsampling`;

    } else {

      resampled = this.selectDownsampleStrategy(spectrogramData, targetWidth);
      algorithm = `${OPTIONS.DOWNSAMPLE_STRATEGY} downsampling`;
      
    }
    
    console.log(`Resampled ${numFrames} frames to ${resampled.length} frames using ${algorithm}`);
    return resampled;
  }

  private selectUpsamplingStrategy(spectrogramData: number[][], targetWidth: number): number[][] {
    switch (OPTIONS.UPSAMPLE_STRATEGY) {
      case 'linear':
        return this.linearUpsample(spectrogramData, targetWidth);
      case 'bilinear':
        return this.bilinearUpsample(spectrogramData, targetWidth);
    }
  }

  /**
   * Select the appropriate downsampling strategy based on configuration
   * @param spectrogramData - Input spectrogram data
   * @param targetWidth - Target width
   * @returns Downsampled data using selected strategy
   */
  private selectDownsampleStrategy(spectrogramData: number[][], targetWidth: number): number[][] {
    switch (OPTIONS.DOWNSAMPLE_STRATEGY) {
      case 'peak':
        return this.peakPreservingDownsample(spectrogramData, targetWidth);
      case 'average':
      default:
        return this.averageDownsample(spectrogramData, targetWidth);
    }
  }

  /**
   * Get frequency index based on frequency scale transformation
   */
  private getFrequencyIndex(y: number, height: number, numFrequencies: number, scale: FrequencyScale, sampleRate: number, minFrequency: number | null, maxFrequency: number | null): number {
    const normalizedY = (height - 1 - y) / (height - 1); // 0 at bottom, 1 at top
    
    let frequencyRatio: number;
    
    // If frequency range is specified, map directly to that range
    if (minFrequency !== null || maxFrequency !== null) {
      const minFreq = minFrequency || 0;
      const maxFreq = maxFrequency || sampleRate / 2;
      
      // Map the pixel position directly to the frequency range
      const freq = minFreq + normalizedY * (maxFreq - minFreq);
      frequencyRatio = freq / (sampleRate / 2);
    } else {
      // Use the original frequency scale transformations
      switch (scale) {
        case FrequencyScale.LINEAR:
          frequencyRatio = normalizedY;
          break;
          
        case FrequencyScale.LOG:
          frequencyRatio = Math.pow(10, normalizedY * Math.log10(0.5));
          break;
          
        case FrequencyScale.MEL:
          const melMin = this.hzToMel(0);
          const melMax = this.hzToMel(sampleRate / 2);
          const mel = melMin + normalizedY * (melMax - melMin);
          const freq = this.melToHz(mel);
          frequencyRatio = freq / (sampleRate / 2);
          break;
          
        case FrequencyScale.BARK:
          const barkMin = this.hzToBark(0);
          const barkMax = this.hzToBark(sampleRate / 2);
          const bark = barkMin + normalizedY * (barkMax - barkMin);
          const freqBark = this.barkToHz(bark);
          frequencyRatio = freqBark / (sampleRate / 2);
          break;
          
        case FrequencyScale.ERB:
          const erbMin = this.hzToErb(0);
          const erbMax = this.hzToErb(sampleRate / 2);
          const erb = erbMin + normalizedY * (erbMax - erbMin);
          const freqErb = this.erbToHz(erb);
          frequencyRatio = freqErb / (sampleRate / 2);
          break;
          
        default:
          frequencyRatio = normalizedY;
      }
    }
    
    frequencyRatio = Math.max(0, Math.min(1, frequencyRatio));
    return Math.floor(frequencyRatio * (numFrequencies - 1));
  }

  /**
   * Convert Hz to Mel scale
   */
  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert Mel to Hz
   */
  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Convert Hz to Bark scale
   */
  private hzToBark(hz: number): number {
    return 13 * Math.atan(0.00076 * hz) + 3.5 * Math.atan(Math.pow(hz / 7500, 2));
  }

  /**
   * Convert Bark to Hz (simplified accurate inverse)
   */
  private barkToHz(bark: number): number {
    // Simplified but accurate inverse
    if (bark <= 0) return 0;
    if (bark >= 26) return 20000;
    
    // Use a more stable approximation
    const a = 26.81;
    const b = 1960;
    const c = 0.53;
    
    return b * (bark + c) / (a - bark);
  }

  /**
   * Convert Hz to ERB scale
   */
  private hzToErb(hz: number): number {
    return 21.4 * Math.log10(1 + hz / 229);
  }

  /**
   * Convert ERB to Hz
   */
  private erbToHz(erb: number): number {
    return 229 * (Math.pow(10, erb / 21.4) - 1);
  }

  /**
   * Apply mapping transformation to a normalized value (0-1)
   * @param normalized - Input value in range [0, 1]
   * @param mappingType - Type of intensity mapping to apply
   * @returns Mapped value in range [0, 1]
   */
  private applyMapping(normalized: number, mappingType: MappingType): number {
    // Clamp input to valid range
    const clamped = Math.max(0, Math.min(1, normalized));
    
    switch (mappingType) {
      case MappingType.LINEAR:
        return clamped;
        
      case MappingType.LOG:
        return Math.log10(1 + clamped * 9) / Math.log10(10);
        
      case MappingType.POWER:
        return Math.pow(clamped, 2.1);
        
      case MappingType.SQRT:
        return Math.pow(clamped, 0.5);
        
      case MappingType.SIGMOID:
        return 1 / (1 + Math.exp(-(clamped - 0.5) * 4));
        
      default:
        return clamped;
    }
  }

  /**
   * Get color for a normalized value (0-1) based on color preset
   */
  private getColor(normalized: number, colorPreset: ColorPreset): { r: number; g: number; b: number } {
    switch (colorPreset) {
      case ColorPreset.GRAY:
        const intensity = Math.floor(normalized * 255);
        return { r: 255 - intensity, g: 255 - intensity, b: 255 - intensity };
      
      case ColorPreset.INVGRAY:
        const intensity2 = Math.floor(normalized * 255);
        return { r: intensity2, g: intensity2, b: intensity2 };
      
      case ColorPreset.HEAT:
        return this.heatMap(normalized);
      
      case ColorPreset.INFERNO:
        return this.infernoMap(normalized);
      
      default:
        const intensity3 = Math.floor(normalized * 255);
        return { r: intensity3, g: intensity3, b: intensity3 };
    }
  }

  /**
   * Heat color map (black → red → yellow → white)
   * 
   * Standard heat map implementation following the common pattern:
   * - Black (0,0,0) to Red (255,0,0) 
   * - Red (255,0,0) to Yellow (255,255,0)
   * - Yellow (255,255,0) to White (255,255,255)
   * 
   * @param t - Normalized value [0,1]
   * @returns RGB color values
   */
  private heatMap(t: number): { r: number; g: number; b: number } {
    // Clamp to valid range
    t = Math.max(0, Math.min(1, t));
    
    if (t < 0.33) {
      // Black to Red: (0,0,0) → (255,0,0)
      const factor = t / 0.33;
      return { r: Math.floor(factor * 255), g: 0, b: 0 };
    } else if (t < 0.67) {
      // Red to Yellow: (255,0,0) → (255,255,0)
      const factor = (t - 0.33) / 0.34;
      return { r: 255, g: Math.floor(factor * 255), b: 0 };
    } else {
      // Yellow to White: (255,255,0) → (255,255,255)
      const factor = (t - 0.67) / 0.33;
      return { r: 255, g: 255, b: Math.floor(factor * 255) };
    }
  }

  /**
   * Inferno color map (black → purple → red → orange → yellow → white)
   * 
   * Based on matplotlib's inferno colormap, which is perceptually uniform
   * and provides excellent contrast for spectrogram visualization.
   * 
   * @param t - Normalized value [0,1]
   * @returns RGB color values
   */
  private infernoMap(t: number): { r: number; g: number; b: number } {
    // Clamp to valid range
    t = Math.max(0, Math.min(1, t));
    
    if (t < 0.2) {
      // Black to dark purple: (0,0,0) → (50,0,100)
      const factor = t / 0.2;
      return { r: Math.floor(factor * 50), g: 0, b: Math.floor(factor * 100) };
    } else if (t < 0.4) {
      // Dark purple to purple: (50,0,100) → (150,0,200)
      const factor = (t - 0.2) / 0.2;
      return { r: Math.floor(50 + factor * 100), g: 0, b: Math.floor(100 + factor * 100) };
    } else if (t < 0.6) {
      // Purple to red: (150,0,200) → (255,0,0)
      const factor = (t - 0.4) / 0.2;
      return { r: Math.floor(150 + factor * 105), g: 0, b: Math.floor(200 - factor * 200) };
    } else if (t < 0.8) {
      // Red to orange: (255,0,0) → (255,128,0)
      const factor = (t - 0.6) / 0.2;
      return { r: 255, g: Math.floor(factor * 128), b: 0 };
    } else {
      // Orange to yellow/white: (255,128,0) → (255,255,255)
      const factor = (t - 0.8) / 0.2;
      return { r: 255, g: Math.floor(128 + factor * 127), b: Math.floor(factor * 255) };
    }
  }
}