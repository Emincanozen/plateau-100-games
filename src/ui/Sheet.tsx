import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Text';
import { Row } from './Surface';

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { c, radius, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} />
      <View
        style={{
          backgroundColor: c.bgElevated,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.lg,
          maxHeight: '82%',
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.borderStrong,
            marginBottom: space.md,
          }}
        />
        {title ? (
          <Row between style={{ marginBottom: space.md }}>
            <Txt variant="h3">{title}</Txt>
            <Pressable onPress={onClose} hitSlop={10}>
              <Txt variant="label" tone="dim">
                Fermer
              </Txt>
            </Pressable>
          </Row>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}
