import * as NativeDocumentPicker from 'expo-document-picker/build/index';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export * from 'expo-document-picker/build/index';

type PickerOptions = Parameters<typeof NativeDocumentPicker.getDocumentAsync>[0];
type PickerResult = Awaited<ReturnType<typeof NativeDocumentPicker.getDocumentAsync>>;
type VideoSource = 'camera' | 'files' | 'cancel';

function isVideoOnlyRequest(options?: PickerOptions) {
  const rawType = options?.type;
  const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
  return types.length === 1 && String(types[0]).trim().toLowerCase() === 'video/*';
}

function canceledResult(): PickerResult {
  return { canceled: true, assets: null } as PickerResult;
}

function chooseVideoSource(): Promise<VideoSource> {
  if (Platform.OS === 'web') return Promise.resolve('files');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: VideoSource) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(
      'Upload Accident Video',
      'Choose how you want to add the video.',
      [
        { text: 'Camera', onPress: () => finish('camera') },
        { text: 'Gallery / File', onPress: () => finish('files') },
        { text: 'Cancel', style: 'cancel', onPress: () => finish('cancel') },
      ],
      { cancelable: true, onDismiss: () => finish('cancel') },
    );
  });
}

function videoMimeType(name: string, mimeType?: string | null) {
  if (mimeType?.trim()) return mimeType;
  const lower = name.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  return 'video/mp4';
}

function cameraVideoName(fileName?: string | null, mimeType?: string | null) {
  if (fileName?.trim()) return fileName.trim();
  const normalized = mimeType?.toLowerCase() ?? '';
  const extension = normalized === 'video/quicktime'
    ? 'mov'
    : normalized === 'video/webm'
      ? 'webm'
      : normalized === 'video/x-matroska'
        ? 'mkv'
        : normalized === 'video/x-msvideo'
          ? 'avi'
          : 'mp4';
  return `accident-video-${Date.now()}.${extension}`;
}

async function captureVideoWithCamera(): Promise<PickerResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera permission needed',
        'Allow camera access to record an accident video, or choose Gallery / File instead.',
      );
      return canceledResult();
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return canceledResult();

    const asset = result.assets[0];
    const name = cameraVideoName(asset.fileName, asset.mimeType);
    return {
      canceled: false,
      assets: [{
        name,
        uri: asset.uri,
        mimeType: videoMimeType(name, asset.mimeType),
        size: asset.fileSize ?? undefined,
        lastModified: Date.now(),
      }],
    } as PickerResult;
  } catch {
    Alert.alert(
      'Camera unavailable',
      'The camera could not be opened. Please try again or choose Gallery / File.',
    );
    return canceledResult();
  }
}

export async function getDocumentAsync(options?: PickerOptions): Promise<PickerResult> {
  if (!isVideoOnlyRequest(options)) return NativeDocumentPicker.getDocumentAsync(options);

  const source = await chooseVideoSource();
  if (source === 'camera') return captureVideoWithCamera();
  if (source === 'files') return NativeDocumentPicker.getDocumentAsync(options);
  return canceledResult();
}
