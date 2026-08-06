import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/src/constants/colors';
import { borders, fontSizes, radii, spacing } from '@/src/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel = label,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.onPrimary,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.pressed, opacity: 0.85 },
  label: {
    color: colors.onPrimary,
    fontSize: fontSizes.body,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
