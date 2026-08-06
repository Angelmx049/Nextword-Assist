import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { colors } from '@/src/constants/colors';
import { borders, fontSizes, radii, spacing } from '@/src/constants/theme';
import type { AppRoute } from '@/src/types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ModuleCardProps = {
  title: string;
  route: AppRoute;
  size: number;
  onPress: (route: AppRoute) => void;
  image?: ImageSourcePropType;
  icon?: IconName;
};

export function ModuleCard({
  title,
  route,
  size,
  onPress,
  image,
  icon = 'apps-outline',
}: ModuleCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Abrir módulo ${title}`}
      accessibilityRole="button"
      onPress={() => onPress(route)}
      style={({ pressed }) => [styles.wrapper, { width: size }, pressed && styles.pressed]}
    >
      <View style={[styles.card, { height: size, width: size }]}>
        {image ? (
          <Image resizeMode="contain" source={image} style={styles.image} />
        ) : (
          <Ionicons color={colors.text} name={icon} size={Math.min(46, size * 0.42)} />
        )}
      </View>
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.sm },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    justifyContent: 'center',
  },
  image: { height: '68%', width: '68%' },
  pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  title: {
    color: colors.text,
    fontSize: fontSizes.label,
    fontWeight: '700',
    minHeight: 34,
    textAlign: 'center',
  },
});
