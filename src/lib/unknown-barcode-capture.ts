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
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
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
    if (!context) return null;
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
    return dataUrl.slice(dataUrl.indexOf(',') + 1) || null;
  } catch {
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
