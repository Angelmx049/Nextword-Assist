import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormInput } from '@/src/components/FormInput';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { colors } from '@/src/constants/colors';
import { borders, fontSizes, radii, shadows, spacing } from '@/src/constants/theme';

const logo = require('@/assets/images/assist-logo.png');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ScreenContainer>
      <View style={styles.topStripe} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Image accessibilityLabel="Logotipo Assist" resizeMode="contain" source={logo} style={styles.logo} />
            <Text style={styles.subtitle}>SISTEMA DE OPERACIONES LOGÍSTICAS</Text>
            <View style={styles.form}>
              <FormInput
                accessibilityLabel="Usuario"
                autoCapitalize="none"
                icon="person-outline"
                label="USUARIO"
                onChangeText={setUsername}
                placeholder="Ingrese su usuario"
                value={username}
              />
              <FormInput
                accessibilityLabel="Contraseña"
                icon="lock-closed-outline"
                label="CONTRASEÑA"
                onChangeText={setPassword}
                onRightIconPress={() => setShowPassword((visible) => !visible)}
                placeholder="Ingrese su contraseña"
                rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                rightIconAccessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                secureTextEntry={!showPassword}
                value={password}
              />
              <View style={styles.roleGroup}>
                <Text style={styles.label}>ROL</Text>
                <Pressable
                  accessibilityLabel="Rol seleccionado: Supervisor"
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.roleField, pressed && styles.rolePressed]}
                >
                  <Ionicons color={colors.textMuted} name="briefcase-outline" size={20} />
                  <Text style={styles.roleText}>Supervisor</Text>
                  <Ionicons color={colors.textMuted} name="chevron-down" size={20} />
                </Pressable>
              </View>
              <PrimaryButton label="INICIAR SESIÓN" onPress={() => router.replace('/dashboard')} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topStripe: { backgroundColor: colors.primary, height: 8 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  formCard: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    maxWidth: 440,
    padding: spacing.xl,
    width: '100%',
    ...shadows.card,
  },
  logo: { alignSelf: 'center', height: 92, width: '88%' },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.label,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  form: { gap: spacing.lg },
  roleGroup: { gap: spacing.sm },
  label: { color: colors.text, fontSize: fontSizes.label, fontWeight: '700', letterSpacing: 0.4 },
  roleField: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: borders.strong,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  rolePressed: { opacity: 0.75 },
  roleText: { color: colors.text, flex: 1, fontSize: fontSizes.body, paddingHorizontal: spacing.md },
});
