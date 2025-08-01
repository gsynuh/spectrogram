/**
 * Window function types for FFT analysis
 * 
 * Window functions are applied to audio samples before FFT to reduce spectral leakage
 * and improve frequency resolution. Each window has different characteristics:
 * 
 * @see https://en.wikipedia.org/wiki/Window_function
 */
export enum WindowType {
  /**
   * Hanning window (also called Hann window)
   * 
   * A raised cosine window that provides good frequency resolution with moderate
   * sidelobe suppression. Named after Julius von Hann, it's one of the most
   * commonly used windows in spectral analysis.
   * 
   * Characteristics:
   * - Main lobe width: 8π/N radians
   * - Peak sidelobe level: -31.5 dB
   * - Roll-off rate: -18 dB/octave
   * 
   * @see https://en.wikipedia.org/wiki/Hann_function
   */
  HANNING = 'hanning',

  /**
   * Hamming window
   * 
   * A modified Hanning window that reduces the first sidelobe at the expense
   * of slightly wider main lobe. Named after Richard Hamming, it's optimized
   * for reducing the nearest sidelobe level.
   * 
   * Characteristics:
   * - Main lobe width: 8π/N radians
   * - Peak sidelobe level: -43 dB
   * - Roll-off rate: -6 dB/octave
   * 
   * @see https://en.wikipedia.org/wiki/Window_function#Hamming_window
   */
  HAMMING = 'hamming',

  /**
   * Blackman window
   * 
   * A window with very low sidelobe levels, providing excellent sidelobe
   * suppression at the cost of wider main lobe. Named after Ralph Beebe Blackman.
   * 
   * Characteristics:
   * - Main lobe width: 12π/N radians
   * - Peak sidelobe level: -58 dB
   * - Roll-off rate: -18 dB/octave
   * 
   * @see https://en.wikipedia.org/wiki/Window_function#Blackman_window
   */
  BLACKMAN = 'blackman',

  /**
   * Rectangular window (no window)
   * 
   * No windowing applied - equivalent to multiplying by 1.0. Provides the
   * narrowest main lobe but highest sidelobe levels, leading to spectral leakage.
   * 
   * Characteristics:
   * - Main lobe width: 4π/N radians
   * - Peak sidelobe level: -13 dB
   * - Roll-off rate: -6 dB/octave
   * 
   * @see https://en.wikipedia.org/wiki/Window_function#Rectangular_window
   */
  RECTANGULAR = 'rectangular'
}

/**
 * Color presets for spectrogram visualization
 * 
 * Different color schemes for representing intensity values in spectrograms.
 * Each scheme has different perceptual characteristics and use cases.
 */
export enum ColorPreset {
  /**
   * Gray scale (dark = high intensity)
   * 
   * Traditional spectrogram color scheme where dark areas represent high
   * intensity. Good for detailed analysis and printing.
   * 
   * @see https://en.wikipedia.org/wiki/Spectrogram#Color_representation
   */
  GRAY = 'gray',

  /**
   * Inverted gray scale (bright = high intensity)
   * 
   * Inverted gray scale where bright areas represent high intensity.
   * Often preferred for screen viewing and modern displays.
   */
  INVGRAY = 'invgray',

  /**
   * Heat map (black → red → yellow → white)
   * 
   * Color scheme mimicking heat maps, where colors progress from black
   * (cold/low intensity) through red and yellow to white (hot/high intensity).
   * Good for intuitive intensity perception.
   * 
   * @see https://en.wikipedia.org/wiki/Heat_map
   */
  HEAT = 'heat',

  /**
   * Inferno color map (black → purple → red → yellow → white)
   * 
   * Color scheme similar to Audacity's default, progressing from black through
   * purple, red, and yellow to white. Provides good contrast and is popular
   * in audio analysis software.
   * 
   * @see https://matplotlib.org/stable/tutorials/colors/colormaps.html#inferno
   */
  INFERNO = 'inferno'
}

/**
 * Frequency scale types for spectrogram visualization
 * 
 * Different frequency scales transform how frequency is displayed on the y-axis.
 * Each scale has different perceptual and analytical advantages.
 */
export enum FrequencyScale {
  /**
   * Linear frequency scale
   * 
   * Standard linear mapping where equal pixel distances represent equal
   * frequency differences. Good for technical analysis and precise frequency
   * measurements.
   * 
   * @see https://en.wikipedia.org/wiki/Spectrogram#Frequency_scales
   */
  LINEAR = 'linear',

  /**
   * Logarithmic frequency scale
   * 
   * Frequency is mapped logarithmically, making equal pixel distances
   * represent equal frequency ratios. Better for musical analysis and
   * wide frequency ranges.
   * 
   * @see https://en.wikipedia.org/wiki/Logarithmic_scale
   */
  LOG = 'log',

  /**
   * Mel scale (perceptually uniform)
   * 
   * Frequency mapped to mel scale, which approximates human auditory
   * perception. Equal mel distances are perceived as equal pitch differences.
   * Excellent for speech and music analysis.
   * 
   * @see https://en.wikipedia.org/wiki/Mel_scale
   */
  MEL = 'mel',

  /**
   * Bark scale (auditory frequency scale)
   * 
   * Frequency mapped to Bark scale, another perceptually uniform scale
   * based on critical bandwidths of the human auditory system. Good for
   * psychoacoustic analysis and speech processing.
   * 
   * @see https://en.wikipedia.org/wiki/Bark_scale
   */
  BARK = 'bark',

  /**
   * ERB scale (Equivalent Rectangular Bandwidth)
   * 
   * Frequency mapped to ERB scale, which represents the bandwidth of
   * auditory filters. More accurate than Bark scale for modeling human
   * auditory perception, especially at higher frequencies.
   * 
   * @see https://en.wikipedia.org/wiki/Equivalent_rectangular_bandwidth
   */
  ERB = 'erb'
}

/**
 * Intensity mapping types for spectrogram visualization
 * 
 * Different mathematical transformations applied to intensity values before
 * color mapping. Each affects how the dynamic range is displayed.
 */
export enum MappingType {
  /**
   * Linear mapping
   * 
   * No transformation applied - intensity values are mapped linearly to colors.
   * Preserves the original dynamic range but may not show subtle details well.
   */
  LINEAR = 'linear',

  /**
   * Logarithmic mapping
   * 
   * Applies logarithmic transformation to emphasize lower intensity values
   * and compress higher values. Good for revealing quiet sounds and details
   * in the presence of loud signals.
   * 
   * @see https://en.wikipedia.org/wiki/Logarithmic_scale
   */
  LOG = 'log',

  /**
   * Power mapping (exponential)
   * 
   * Applies power transformation (typically power of 1.8) to emphasize
   * high-intensity signals and suppress subtle content. Makes strong signals
   * stand out more prominently.
   */
  POWER = 'power',

  /**
   * Square root mapping
   * 
   * Applies square root transformation to emphasize subtle content and
   * compress high intensities. Reveals weak signals and fine details
   * that might be hidden with linear mapping.
   */
  SQRT = 'sqrt',

  /**
   * Sigmoid mapping
   * 
   * Applies sigmoid (S-curve) transformation that provides smooth compression
   * of both low and high values while preserving mid-range details. Good
   * general-purpose mapping for spectrograms.
   * 
   * @see https://en.wikipedia.org/wiki/Sigmoid_function
   */
  SIGMOID = 'sigmoid'
}

/**
 * Audio format types for processing
 * 
 * Supported audio data formats for internal processing. These determine
 * how audio samples are represented in memory.
 */
export enum AudioFormat {
  /**
   * PCM signed 16-bit little-endian
   * 
   * Standard format for most audio files. 16-bit provides 96 dB dynamic range.
   * Little-endian byte order is standard on most systems.
   * 
   * @see https://en.wikipedia.org/wiki/Pulse-code_modulation
   */
  PCM_S16LE = 'pcm_s16le',

  /**
   * PCM 32-bit float little-endian
   * 
   * High-precision format with extended dynamic range. 32-bit float provides
   * approximately 144 dB dynamic range and is used in professional audio.
   * 
   * @see https://en.wikipedia.org/wiki/Single-precision_floating-point_format
   */
  PCM_F32LE = 'pcm_f32le'
}

/**
 * Sample format types detected by ffprobe
 * 
 * Audio sample formats as reported by FFmpeg's ffprobe. These represent
 * the actual format of audio data in the source files.
 */
export enum SampleFormat {
  /**
   * 8-bit unsigned integer
   * 
   * Low-quality format with limited dynamic range (~48 dB). Rarely used
   * in modern audio files except for very old recordings.
   */
  U8 = 'u8',

  /**
   * 16-bit signed integer
   * 
   * Standard format for most audio files. Provides 96 dB dynamic range
   * and is the most common format for consumer audio.
   */
  S16 = 's16',

  /**
   * 32-bit signed integer
   * 
   * High-precision format with extended dynamic range (~144 dB). Used
   * in professional audio recording and processing.
   */
  S32 = 's32',

  /**
   * 32-bit floating point
   * 
   * Professional audio format with maximum dynamic range and precision.
   * Standard in digital audio workstations and professional audio software.
   */
  FLT = 'flt',

  /**
   * 64-bit floating point (double precision)
   * 
   * Highest precision format with maximum dynamic range. Used in scientific
   * audio analysis and high-end professional audio processing.
   */
  DBL = 'dbl',

  /**
   * 32-bit floating point (single precision)
   * 
   * High-precision format with extended dynamic range. Used in professional
   * audio analysis and high-end professional audio processing.
   */
  FLTP = 'fltp',

  /**
   * Unknown or unsupported sample format
   * 
   * Used when ffprobe reports a sample format that is not recognized
   * or supported by the system. The actual format string is preserved
   * for debugging purposes.
   */
  UNKNOWN = 'unknown'

}