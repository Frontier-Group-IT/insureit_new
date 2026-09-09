import * as NativeDocumentPicker from 'expo-document-picker/build/index';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export * from 'expo-document-picker/build/index';

type PickerOptions = Parameters<typeof NativeDocumentPicker.getDocumentAsync>[0];
type PickerResult = Awaited<ReturnType<typeof NativeDocumentPicker.getDocumentAsync>>;
type VideoSource = 'camera' | 'files' | 'cancel';
type VideoSourceVisibilityListener = (visible: boolean) => void;

let pendingVideoSourceResolve: ((source: VideoSource) => void) | null = null;
const videoSourceVisibilityListeners = new Set<VideoSourceVisibilityListener>();

function isVideoOnlyRequest(options?: PickerOptions) {
  const rawType = options?.type;
  const types = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];
  return types.length === 1 && String(types[0]).trim().toLowerCase() === 'video/*';
}

function canceledResult(): PickerResult {
  return { canceled: true, assets: null } as PickerResult;
}

function emitVideoSourceVisibility() {
  const visible = Boolean(pendingVideoSourceResolve);
  for (const listener of videoSourceVisibilityListeners) listener(visible);
}

function finishVideoSourceSelection(source: VideoSource) {
  const resolve = pendingVideoSourceResolve;
  pendingVideoSourceResolve = null;
  emitVideoSourceVisibility();
  resolve?.(source);
}

function chooseVideoSource(): Promise<VideoSource> {
  if (Platform.OS === 'web') return Promise.resolve('files');

  return new Promise((resolve) => {
    if (pendingVideoSourceResolve) {
      const previousResolve = pendingVideoSourceResolve;
      pendingVideoSourceResolve = null;
      previousResolve('cancel');
    }
    pendingVideoSourceResolve = resolve;
    emitVideoSourceVisibility();
  });
}

function subscribeVideoSourceVisibility(listener: VideoSourceVisibilityListener) {
  videoSourceVisibilityListeners.add(listener);
  listener(Boolean(pendingVideoSourceResolve));
  return () => {
    videoSourceVisibilityListeners.delete(listener);
  };
}

export function ClaimVideoSourceModalHost() {
  const [visible, setVisible] = useState(Boolean(pendingVideoSourceResolve));

  useEffect(() => subscribeVideoSourceVisibility(setVisible), []);

  if (Platform.OS === 'web') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => finishVideoSourceSelection('cancel')}
    >
      <View style={styles.sourceBackdrop}>
        <View accessibilityRole="menu" accessibilityLabel="Upload Accident Video" style={styles.sourceCard}>
          <View style={styles.sourceHeader}>
            <View style={styles.sourceTitleGroup}>
              <View style={styles.sourceHeaderIcon}>
                <MaterialCommunityIcons name="video" size={27} color="#0A43A3" />
              </View>
              <Text style={styles.sourceTitle}>Upload Accident Video</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close video source options"
              hitSlop={10}
              onPress={() => finishVideoSourceSelection('cancel')}
              style={({ pressed }) => [styles.sourceClose, pressed && styles.sourceClosePressed]}
            >
              <MaterialCommunityIcons name="close" size={29} color="#536783" />
            </Pressable>
          </View>

          <View style={styles.sourceOptions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Record accident video with camera"
              onPress={() => finishVideoSourceSelection('camera')}
              style={({ pressed }) => [styles.sourceOption, styles.cameraOption, pressed && styles.sourceOptionPressed]}
            >
              <View style={[styles.sourceOptionIcon, styles.cameraIcon]}>
                <MaterialCommunityIcons name="camera" size={30} color="#0A43A3" />
              </View>
              <Text style={styles.sourceOptionText}>Camera</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose accident video from gallery or files"
              onPress={() => finishVideoSourceSelection('files')}
              style={({ pressed }) => [styles.sourceOption, styles.galleryOption, pressed && styles.sourceOptionPressed]}
            >
              <View style={[styles.sourceOptionIcon, styles.galleryIcon]}>
                <MaterialCommunityIcons name="image-multiple" size={30} color="#7C3AED" />
              </View>
              <Text style={styles.sourceOptionText}>Gallery / File</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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

const styles = StyleSheet.create({
  sourceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 18, 42, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sourceCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: '#071D49',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 18,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sourceTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sourceHeaderIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: {
    flex: 1,
    color: '#071D49',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  sourceClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceClosePressed: {
    backgroundColor: '#EEF3F9',
  },
  sourceOptions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 14,
  },
  sourceOption: {
    flex: 1,
    minHeight: 154,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  cameraOption: {
    backgroundColor: '#EFF6FF',
    borderColor: '#CFE0F5',
  },
  galleryOption: {
    backgroundColor: '#F7F1FF',
    borderColor: '#E3D4FA',
  },
  sourceOptionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  sourceOptionIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cameraIcon: {
    backgroundColor: '#DCEEFF',
  },
  galleryIcon: {
    backgroundColor: '#EADFFF',
  },
  sourceOptionText: {
    color: '#071D49',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
});
