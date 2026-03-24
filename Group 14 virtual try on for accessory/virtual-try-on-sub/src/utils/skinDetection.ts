/**
 * Categorizes skin tone using the YCrCb color space.
 * 
 * Formulas used (ITU-R BT.601):
 * Cb = 128 - 0.168736*R - 0.331264*G + 0.5*B
 * Cr = 128 + 0.5*R - 0.418688*G - 0.081312*B
 * 
 * Per request: Y (Luminance) is ignored to focus purely on chrominance clusters.
 */

let toneHistory: string[] = [];
export const categorizeSkinTone = (r: number, g: number, b: number): string => {
  // Convert normalized RGB to Cb and Cr
  const cb = 128 - (0.168736 * r) - (0.331264 * g) + (0.5 * b);
  const cr = 128 + (0.5 * r) - (0.418688 * g) - (0.081312 * b);

  /**
   * Classification Logic based on Cr-Cb Clusters:
   * By normalizing lighting (CLAHE) before this step, the values are 
   * significantly more stable across different camera sensors and rooms.
   */

  // 1.Deep tones first
  if (cr > 165) {
    return 'deep';
  }

  // 2. Tan tones
  if (cr > 150) {
    return 'tan';
  }

  // 3. Olive tones
  if (cr < 142 && cb < 116) {
    return 'olive';
  }

  // 4. Light tones (make threshold stricter)
  if (cb > 130 && cr < 150) {
    return 'light';
  }

  // 5. Medium: The default cluster for balanced Cr/Cb values.
  return 'medium';
};

/**
 * Normalizes lighting using Local Contrast Stretching (CLAHE-like).
 * This ensures that even in dark or overexposed patches, the relative
 * color differences (chrominance) are amplified and stabilized for extraction.
 */
const applyLocalNormalization = (data: Uint8ClampedArray) => {
  const l = data.length;
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  // 1. Identify the local color range
  for (let i = 0; i < l; i += 4) {
    minR = Math.min(minR, data[i]);
    maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]);
    maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]);
    maxB = Math.max(maxB, data[i + 2]);
  }

  // 2. Limit contrast to prevent noise amplification (the 'CL' in CLAHE)
  // We ensure a minimum range to avoid blown-out noise in flat dark areas.
  const rangeR = Math.max(30, maxR - minR);
  const rangeG = Math.max(30, maxG - minG);
  const rangeB = Math.max(30, maxB - minB);

  // 3. Redistribute/Stretch (Equalization proxy)
  for (let i = 0; i < l; i += 4) {
    data[i] = ((data[i] - minR) / rangeR) * 255;
    data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
    data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
  }
};

/**
 * Samples a region of the source, applies lighting normalization (CLAHE), 
 * converts to average YCrCb (ignoring Y), and returns the category.
 */
export const detectSkinToneFromMedia = (
  source: HTMLVideoElement | HTMLImageElement,
  x: number, // 0-1 normalized
  y: number, // 0-1 normalized
  isMirrored: boolean = false
): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'medium';

  // Use a 20x20 patch for more robust histogram data
  canvas.width = 20;
  canvas.height = 20;

  const width = (source instanceof HTMLVideoElement ? source.videoWidth : source.width) || 1;
  const height = (source instanceof HTMLVideoElement ? source.videoHeight : source.height) || 1;

  const srcX = (isMirrored ? (1 - x) : x) * width;
  const srcY = y * height;

  try {
    // 1. Capture the local skin patch
    ctx.drawImage(source, srcX - 10, srcY - 10, 20, 20, 0, 0, 20, 20);
    const imageData = ctx.getImageData(0, 0, 20, 20);
    const data = imageData.data;
    
    // 2. Normalize lighting BEFORE skin detection (CLAHE-inspired)
    applyLocalNormalization(data);
    
    // 3. Aggregate results
    
    let r = 0, g = 0, b = 0;
    let validPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];

      // Basic skin mask filter
      if (
        pr > 40 &&
        pg > 20 &&
        pb > 20 &&
        Math.max(pr, pg, pb) - Math.min(pr, pg, pb) > 15 &&
        Math.abs(pr - pg) > 15 &&
        pr > pg &&
        pr > pb
      ) {
        r += pr;
        g += pg;
        b += pb;
        validPixels++;
      }
    }

    // If no valid skin pixels found, fallback
    if (validPixels === 0) {
      return 'medium';
    }

  const detected = categorizeSkinTone(
  r / validPixels,
  g / validPixels,
  b / validPixels
);

toneHistory.push(detected);
if (toneHistory.length > 10) {
  toneHistory.shift();
}

const counts: Record<string, number> = {};
for (const tone of toneHistory) {
  counts[tone] = (counts[tone] || 0) + 1;
}

return Object.keys(counts).reduce((a, b) =>
  counts[a] > counts[b] ? a : b
);
  } catch (e) {
    return 'medium';
  }
};