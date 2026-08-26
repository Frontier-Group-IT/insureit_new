import { Video } from 'react-native-compressor';

const VIDEO_COMPRESSION_THRESHOLD_BYTES = 10 * 1024 * 1024;

export type VideoCompressionResult = {
  uri: string;
  compressed: boolean;
};

export async function prepareVideoForUpload(
  uri: string,
  size: number | null | undefined,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  if (!size || size <= VIDEO_COMPRESSION_THRESHOLD_BYTES) {
    return { uri, compressed: false };
  }

  try {
    const compressedUri = await Video.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: 720,
        bitrate: 1_800_000,
        minimumFileSizeForCompress: 10,
        progressDivider: 5,
      },
      (progress) => onProgress?.(Math.max(0, Math.min(1, progress))),
    );

    return { uri: compressedUri || uri, compressed: Boolean(compressedUri && compressedUri !== uri) };
  } catch (error) {
    console.warn('Accident video compression failed; using original video', error);
    return { uri, compressed: false };
  }
}
