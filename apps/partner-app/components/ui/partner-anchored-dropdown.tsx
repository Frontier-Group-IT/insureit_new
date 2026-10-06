import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

type AnchorRect = { x: number; y: number; width: number; height: number };

export function PartnerAnchoredDropdown({
  visible,
  onDismiss,
  children,
  menu,
  menuWidth = 160,
  matchAnchorWidth = false,
  align = 'left',
  offsetX = 0,
  offsetY = 4,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  menu: ReactNode;
  menuWidth?: number;
  matchAnchorWidth?: boolean;
  align?: 'left' | 'right';
  offsetX?: number;
  offsetY?: number;
}) {
  const anchorRef = useRef<View>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const measureAnchor = () => {
    requestAnimationFrame(() => {
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        setAnchorRect({ x, y, width, height });
      });
    });
  };

  useEffect(() => {
    if (visible) measureAnchor();
  }, [visible, windowWidth, windowHeight]);

  const resolvedWidth = anchorRect
    ? Math.min(matchAnchorWidth ? anchorRect.width : menuWidth, Math.max(0, windowWidth - 16))
    : menuWidth;
  const unclampedLeft = anchorRect
    ? align === 'right'
      ? anchorRect.x + anchorRect.width - resolvedWidth + offsetX
      : anchorRect.x + offsetX
    : 8;
  const left = Math.max(8, Math.min(unclampedLeft, Math.max(8, windowWidth - resolvedWidth - 8)));
  const top = anchorRect ? anchorRect.y + anchorRect.height + offsetY : 0;

  return (
    <>
      <View ref={anchorRef} collapsable={false} onLayout={visible ? measureAnchor : undefined}>
        {children}
      </View>

      <Modal
        animationType="none"
        onRequestClose={onDismiss}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View accessibilityViewIsModal style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close dropdown"
            accessibilityRole="button"
            onPress={onDismiss}
            style={StyleSheet.absoluteFill}
          />
          {anchorRect ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.menuHost,
                {
                  left,
                  top: Math.min(top, Math.max(8, windowHeight - 16)),
                  width: resolvedWidth,
                },
              ]}
            >
              {menu}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  menuHost: {
    position: 'absolute',
    zIndex: 2,
  },
});
