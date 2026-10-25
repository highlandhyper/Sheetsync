'use client';

const MAX_CAPTURE_DIMENSION = 900;

/**
 * Captures the central scan area from the already-authorized Html5Qrcode camera.
 * Returns JPEG base64 without a data-URL prefix, or null if no usable frame exists.
 */
export function captureBarcodeScanImage(regionId: string): string | null {
  try {
    const region = document.getElementById(regionId);
    const video = region?.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      console.warn('[UNKNOWN_BARCODE_CAPTURE] No video element found in scanner region:', regionId);
      return null;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      console.warn('[UNKNOWN_BARCODE_CAPTURE] Camera frame not ready', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
      return null;
    }

    // Html5Qrcode's scan box is centered. Crop to the central 70% to avoid
    // storing unnecessary surroundings and keep uploads small.
    const sourceWidth = Math.floor(video.videoWidth * 0.7);
    const sourceHeight = Math.floor(video.videoHeight * 0.7);
    const sourceX = Math.floor((video.videoWidth - sourceWidth) / 2);
    const sourceY = Math.floor((video.videoHeight - sourceHeight) / 2);
    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
    canvas.height = Math.max(1, Math.floor(sourceHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      console.warn('[UNKNOWN_BARCODE_CAPTURE] Could not create canvas context.');
      return null;
    }
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    const imageBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (!imageBase64) {
      console.warn('[UNKNOWN_BARCODE_CAPTURE] Canvas returned an empty image.');
      return null;
    }
    console.info('[UNKNOWN_BARCODE_CAPTURE] Image captured', {
      width: canvas.width,
      height: canvas.height,
      imageLength: imageBase64.length,
    });
    return imageBase64;
  } catch (error) {
    console.error('[UNKNOWN_BARCODE_CAPTURE] Camera frame capture threw an error:', error);
    return null;
  }
}

export function normalizeBarcodeForLookup(value: string): string {
  return String(value || '').trim().replace(/^0+/, '');
}

export function productBarcodeExists(products: Array<{ barcode?: string | null }>, barcode: string): boolean {
  const normalized = normalizeBarcodeForLookup(barcode);
  if (!normalized) return true;
  return products.some(product => {
    const candidate = String(product.barcode || '').trim();
    return candidate === String(barcode || '').trim() || normalizeBarcodeForLookup(candidate) === normalized;
  });
}
