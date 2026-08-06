import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { colors } from '@/src/constants/colors';
import { fontSizes, spacing } from '@/src/constants/theme';

type ModulePlaceholderProps = {
  name: string;
};

export function ModulePlaceholder({ name }: ModulePlaceholderProps) {
  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{name}</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.message}>La funcionalidad de este módulo se implementará en una fase posterior.</Text>
        <PrimaryButton
          accessibilityLabel={`Regresar al dashboard desde ${name}`}
          label="REGRESAR AL DASHBOARD"
          onPress={() => router.replace('/dashboard')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, justifyContent: 'center', minHeight: 64, paddingHorizontal: spacing.lg },
  headerTitle: { color: colors.onPrimary, fontSize: fontSizes.subtitle, fontWeight: '800', textTransform: 'uppercase' },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: fontSizes.title, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: fontSizes.body, marginBottom: spacing.xl, marginTop: spacing.md, maxWidth: 360, textAlign: 'center' },
});
