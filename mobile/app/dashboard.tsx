import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/src/components/AppHeader';
import { ModuleCard } from '@/src/components/ModuleCard';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { UserInfoBar } from '@/src/components/UserInfoBar';
import { colors } from '@/src/constants/colors';
import { fontSizes, spacing } from '@/src/constants/theme';
import type { AppRoute } from '@/src/types/navigation';

const modules = [
  { title: 'MC', route: '/mc', icon: 'clipboard-outline' },
  { title: 'Gemba Ride', route: '/gemba-ride', icon: 'car-outline' },
  { title: 'Checklist', route: '/checklist', icon: 'checkbox-outline' },
  { title: 'SLAM', route: '/slam', icon: 'warning-outline' },
  { title: 'Safety', route: '/safety', icon: 'shield-checkmark-outline' },
] as const;

const GRID_PADDING = spacing.lg;
const GRID_GAP = spacing.md;

function getCardMetrics(width: number) {
  const columns = width < 340 ? 2 : 3;
  const availableWidth = width - GRID_PADDING * 2 - GRID_GAP * (columns - 1);
  return {
    columns,
    size: Math.min(112, Math.max(84, Math.floor(availableWidth / columns))),
  };
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const metrics = useMemo(() => getCardMetrics(width), [width]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const openModule = (route: AppRoute) => router.push(route);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <AppHeader />
      <UserInfoBar date={now} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>MÓDULOS DEL SISTEMA</Text>
        <View style={styles.titleAccent} />
        <View style={[styles.grid, { gap: GRID_GAP }]}>
          {modules.map((module) => (
            <ModuleCard
              icon={module.icon}
              key={module.route}
              onPress={openModule}
              route={module.route}
              size={metrics.size}
              title={module.title}
            />
          ))}
        </View>
        {metrics.columns === 2 ? (
          <Text style={styles.compactNote}>Vista compacta para pantallas estrechas</Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: GRID_PADDING, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: fontSizes.subtitle, fontWeight: '800' },
  titleAccent: { backgroundColor: colors.primary, height: 4, marginBottom: spacing.xl, marginTop: spacing.sm, width: 86 },
  grid: { alignContent: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  compactNote: { color: colors.textMuted, fontSize: fontSizes.caption, marginTop: spacing.xl, textAlign: 'center' },
});
