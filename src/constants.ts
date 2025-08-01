import { WindowType, ColorPreset, FrequencyScale, MappingType } from './enums';

/**
 * dB (Decibel) constants for spectrogram visualization
 * 
 * These constants define the dB ranges and thresholds used in spectrogram
 * generation and visualization. dB values are logarithmic representations
 * of power ratios.
 * 
 * @see https://en.wikipedia.org/wiki/Decibel
 */
export const DB_CONSTANTS = {

  MIN_DB_DISPLAY: -120,
  
  MAX_DB_THEORETICAL: 0,
  
  REFERENCE_LEVEL: 1.0,
  
  MIN_POWER_VALUE: 1e-12,
} as const;

/**
 * FFT (Fast Fourier Transform) constants
 * 
 * These constants define parameters for FFT analysis and power spectrum
 * calculation. The FFT converts time-domain signals to frequency-domain
 * representations.
 * 
 * @see https://en.wikipedia.org/wiki/Fast_Fourier_transform
 */
export const FFT_CONSTANTS = {

  DEFAULT_FFT_SIZE: 2048,
  DEFAULT_HOP_SIZE: 512,

} as const;

/**
 * Window function constants
 * 
 * Window functions are applied to audio samples before FFT to reduce
 * spectral leakage and improve frequency resolution.
 * 
 * @see https://en.wikipedia.org/wiki/Window_function
 */
export const WINDOW_CONSTANTS = {

  HANNING_COEFFICIENT: 0.5,
  
  HAMMING_COEFFICIENT_A: 0.54,
  HAMMING_COEFFICIENT_B: 0.46,
  
  BLACKMAN_COEFFICIENT_A: 0.42,
  BLACKMAN_COEFFICIENT_B: 0.5,
  BLACKMAN_COEFFICIENT_C: 0.08,
  
  RECTANGULAR_COEFFICIENT: 1.0,
} as const;

/**
 * Canvas and rendering constants
 */
export const RENDERING_CONSTANTS = {
  MAX_CANVAS_SIZE: 16384,
} as const;

export const DEFAULTS = {
  OUTPUT_DIR: 'output',

  HEIGHT: 768,
  MAX_WIDTH: 2048,

  PIXELS_PER_SECOND: 96, 

  FFT_SIZE: FFT_CONSTANTS.DEFAULT_FFT_SIZE,
  HOP_SIZE: FFT_CONSTANTS.DEFAULT_HOP_SIZE,

  WINDOW_TYPE: WindowType.HANNING,
  COLOR_PRESET: ColorPreset.INFERNO,
  FREQUENCY_SCALE: FrequencyScale.BARK,
  MAPPING_TYPE: MappingType.POWER,

  MIN_FREQUENCY: null,
  MAX_FREQUENCY: null,

  MIN_DB: DB_CONSTANTS.MIN_DB_DISPLAY,
  MAX_DB: DB_CONSTANTS.MAX_DB_THEORETICAL,
} as const;

export const VALID_OPTIONS = {
  WINDOW_TYPES: Object.values(WindowType),
  COLOR_PRESETS: Object.values(ColorPreset),
  FREQUENCY_SCALES: Object.values(FrequencyScale),
  MAPPING_TYPES: Object.values(MappingType),
} as const;

export { WindowType, ColorPreset, FrequencyScale, MappingType };