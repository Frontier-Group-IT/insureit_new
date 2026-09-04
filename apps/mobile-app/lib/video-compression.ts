import { Video } from 'react-native-compressor';

export type VideoCompressionResult = {
  uri: string;
  compressed: boolean;
};

const COMPRESSION_THRESHOLD_BYTES = 10 * 1024 * 1024;

export async function prepareVideoForUpload(
  uri: string,
  size: number | null | undefined,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  if (size !== null && size !== undefined && size <= COMPRESSION_THRESHOLD_BYTES) {
    onProgress?.(1);
    return { uri, compressed: false };
  }

  const compressedUri = await Video.compress(
    uri,
    { compressionMethod: 'auto' },
    (progress) => onProgress?.(Math.max(0, Math.min(1, progress))),
  );

  if (!compressedUri || compressedUri === uri) {
    onProgress?.(1);
    return { uri, compressed: false };
  }

  onProgress?.(1);
  return { uri: compressedUri, compressed: true };
}
