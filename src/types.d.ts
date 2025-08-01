declare module '@ffprobe-installer/ffprobe' {
  const path: string;
  export default { path };
}

declare module '@ffmpeg-installer/ffmpeg' {
  const path: string;
  export default { path };
}

/**
 * Represents a single frame of spectrogram data
 * Each frame contains dB values for different frequency bins
 */
export interface SpectrogramFrame {
  readonly frequencyBins: readonly number[];
  readonly timePosition: number;
  readonly frameDuration: number;
}

/**
 * Complete spectrogram data structure
 * Contains all frames and metadata about the spectrogram
 */
export interface SpectrogramData {

  readonly frames: readonly SpectrogramFrame[];
  readonly sampleRate: number;
  readonly fftSize: number;
  readonly hopSize: number;
  readonly duration: number;
  readonly numFrequencyBins: number;
  readonly frequencyResolution: number;
  readonly timeResolution: number;
}

/**
 * FFT result structure containing complex numbers
 * Each complex number is represented as [real, imaginary] pairs
 */
export interface FFTResult {
  readonly complexValues: Float32Array;
  readonly size: number;
}

/**
 * Power spectrum data structure
 * Contains magnitude-squared values for each frequency bin
 */
export interface PowerSpectrum {
  readonly powerValues: readonly number[];
  readonly numBins: number;
  readonly frequencyResolution: number;
}

/**
 * dB spectrum data structure
 * Contains decibel values for each frequency bin
 */
export interface DBSpectrum {
  readonly dbValues: readonly number[];
  readonly numBins: number;
  readonly referenceLevel: number;
  readonly minDb: number;
  readonly maxDb: number;
}

/**
 * Global dB range for spectrogram visualization
 */
export interface GlobalDBRange {
  readonly minDb: number;
  readonly maxDb: number;
  readonly dynamicRange: number;
}

/**
 * Window function parameters
 */
export interface WindowParameters {
  readonly windowType: WindowType;
  readonly size: number;
  readonly coefficients: readonly number[];
}

/**
 * FFT analysis parameters
 */
export interface FFTAnalysisParameters {
  readonly fftSize: number;
  readonly hopSize: number;
  readonly windowType: WindowType;
  readonly applyWindow: boolean;
  readonly normalizationFactor: number;
  readonly referenceLevel: number;
  readonly minDbThreshold: number;
}