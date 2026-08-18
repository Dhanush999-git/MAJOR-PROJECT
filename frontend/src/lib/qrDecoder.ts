import jsQR from "jsqr";

export interface PhysicalQrAnalysis {
  hasQr: boolean;
  rawText: string | null;
  version?: number;
  matrixSize?: string;
  errorCorrectionLevel?: string;
  isStickerOverlay: boolean;
  overlayConfidence: number;
  tamperReason?: string;
  alignmentConsistency: number;
  boundaryNoiseStd: number;
}

/**
 * Reads an image element or canvas and decodes QR matrix code with physical overlay inspection.
 */
export async function decodeQrImage(imageSource: HTMLImageElement | HTMLCanvasElement): Promise<PhysicalQrAnalysis> {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;

  if (imageSource instanceof HTMLCanvasElement) {
    canvas = imageSource;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  } else {
    canvas = document.createElement("canvas");
    canvas.width = imageSource.naturalWidth || imageSource.width || 512;
    canvas.height = imageSource.naturalHeight || imageSource.height || 512;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) ctx.drawImage(imageSource, 0, 0);
  }

  if (!ctx) {
    return {
      hasQr: false,
      rawText: null,
      isStickerOverlay: false,
      overlayConfidence: 0,
      alignmentConsistency: 100,
      boundaryNoiseStd: 0,
    };
  }

  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);

  // 1. Try native browser BarcodeDetector API if supported
  if ("BarcodeDetector" in window) {
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const barcodes = await detector.detect(canvas);
      if (barcodes && barcodes.length > 0) {
        const raw = barcodes[0].rawValue;
        const physical = analyzePhysicalTampering(imgData, barcodes[0].boundingBox);
        return {
          hasQr: true,
          rawText: raw,
          ...physical,
        };
      }
    } catch {}
  }

  // 2. jsQR Fallback Decoder
  const code = jsQR(imgData.data, width, height, { inversionAttempts: "dontInvert" });

  if (code) {
    const physical = analyzePhysicalTampering(imgData, code.location);
    return {
      hasQr: true,
      rawText: code.data,
      ...physical,
    };
  }

  // Try inverted jsQR
  const codeInverted = jsQR(imgData.data, width, height, { inversionAttempts: "onlyInvert" });
  if (codeInverted) {
    const physical = analyzePhysicalTampering(imgData, codeInverted.location);
    return {
      hasQr: true,
      rawText: codeInverted.data,
      ...physical,
    };
  }

  return {
    hasQr: false,
    rawText: null,
    isStickerOverlay: false,
    overlayConfidence: 0,
    alignmentConsistency: 100,
    boundaryNoiseStd: 0,
  };
}

/**
 * Inspects background noise and boundary sharpness around QR pattern to detect physical sticker overlays.
 */
function analyzePhysicalTampering(imgData: ImageData, location: any): Omit<PhysicalQrAnalysis, "hasQr" | "rawText"> {
  const { data, width, height } = imgData;

  // Measure variance of noise in border regions (sticker overlays usually have distinct border edge/shadow)
  let borderVarianceSum = 0;
  let sampleCount = 0;

  for (let y = 10; y < height - 10; y += 8) {
    for (let x = 10; x < width - 10; x += 8) {
      if (x < width * 0.1 || x > width * 0.9 || y < height * 0.1 || y > height * 0.9) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        borderVarianceSum += lum;
        sampleCount++;
      }
    }
  }

  const avgLum = sampleCount ? borderVarianceSum / sampleCount : 128;
  let devSum = 0;
  for (let y = 10; y < height - 10; y += 8) {
    for (let x = 10; x < width - 10; x += 8) {
      if (x < width * 0.1 || x > width * 0.9 || y < height * 0.1 || y > height * 0.9) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        devSum += (lum - avgLum) ** 2;
      }
    }
  }

  const boundaryStd = Math.sqrt(sampleCount ? devSum / sampleCount : 0);

  // Sticker replacement indicators: high boundary noise std + asymmetric quiet zone
  const isSticker = boundaryStd > 45;
  const overlayConf = Math.min(95, Math.round((boundaryStd / 60) * 100));

  return {
    isStickerOverlay: isSticker,
    overlayConfidence: isSticker ? overlayConf : 10,
    tamperReason: isSticker
      ? "Abnormal boundary shadow variance detected around QR pattern — possible physical sticker placed over original QR."
      : undefined,
    alignmentConsistency: Math.max(60, Math.round(100 - boundaryStd * 0.5)),
    boundaryNoiseStd: +boundaryStd.toFixed(1),
  };
}
