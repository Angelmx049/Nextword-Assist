import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { borders, radii, spacing } from '@/src/constants/theme';

const logo = require('@/assets/images/assist-logo.png');

export function AppHeader() {
  return (
    <View style={styles.header}>
      <Image accessibilityLabel="Logotipo Assist" resizeMode="contain" source={logo} style={styles.logo} />
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Abrir notificaciones, 3 pendientes"
          accessibilityRole="button"
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.onSecondary} name="notifications-outline" size={23} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel="Cerrar sesión"
          accessibilityRole="button"
          onPress={() => router.replace('/login')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.onSecondary} name="log-out-outline" size={24} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  logo: { height: 44, width: 154 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: { opacity: 0.7 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.destructive,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    height: 19,
    justifyContent: 'center',
    minWidth: 19,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -5,
    top: -6,
  },
  badgeText: { color: colors.surface, fontSize: 11, fontWeight: '800' },
});
