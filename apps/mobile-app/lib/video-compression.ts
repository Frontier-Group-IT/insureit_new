export type VideoCompressionResult = {
  uri: string;
  compressed: boolean;
};

export async function prepareVideoForUpload(
  uri: string,
  _size: number | null | undefined,
  onProgress?: (progress: number) => void,
): Promise<VideoCompressionResult> {
  onProgress?.(1);
  return { uri, compressed: false };
}
