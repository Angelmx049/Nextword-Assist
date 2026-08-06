import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors } from '@/src/constants/colors';
import { borders, fontSizes, radii, spacing } from '@/src/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type FormInputProps = TextInputProps & {
  label: string;
  icon: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  rightIconAccessibilityLabel?: string;
};

export function FormInput({
  label,
  icon,
  rightIcon,
  onRightIconPress,
  rightIconAccessibilityLabel,
  ...inputProps
}: FormInputProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Ionicons color={colors.textMuted} name={icon} size={20} />
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          {...inputProps}
        />
        {rightIcon && onRightIconPress ? (
          <Pressable
            accessibilityLabel={rightIconAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={10}
            onPress={onRightIconPress}
            style={styles.rightAction}
          >
            <Ionicons color={colors.textMuted} name={rightIcon} size={22} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: {
    color: colors.text,
    fontSize: fontSizes.label,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    flexDirection: 'row',
    minHeight: 50,
    paddingLeft: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rightAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 48,
  },
});
