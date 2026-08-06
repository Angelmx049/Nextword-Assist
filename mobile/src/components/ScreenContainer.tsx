import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/src/constants/colors';

type ScreenContainerProps = PropsWithChildren<{
  backgroundColor?: string;
}>;

export function ScreenContainer({
  backgroundColor = colors.background,
  children,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, width: '100%' },
  content: { flex: 1, width: '100%' },
});
