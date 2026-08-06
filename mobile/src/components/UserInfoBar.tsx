import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { borders, fontSizes, spacing } from '@/src/constants/theme';

type UserInfoBarProps = {
  date: Date;
};

export function UserInfoBar({ date }: UserInfoBarProps) {
  const dateText = date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeText = date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.bar}>
      <View>
        <Text style={styles.user}>admin</Text>
        <Text style={styles.role}>SUPERVISOR</Text>
      </View>
      <View style={styles.dateBlock}>
        <Text style={styles.time}>{timeText}</Text>
        <Text style={styles.date}>{dateText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderBottomColor: colors.secondary,
    borderBottomWidth: borders.thin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  user: { color: colors.text, fontSize: fontSizes.subtitle, fontWeight: '800' },
  role: { color: colors.text, fontSize: fontSizes.caption, fontWeight: '700', letterSpacing: 0.8 },
  dateBlock: { alignItems: 'flex-end' },
  time: { color: colors.text, fontSize: fontSizes.subtitle, fontWeight: '800' },
  date: { color: colors.text, fontSize: fontSizes.caption, textTransform: 'uppercase' },
});
