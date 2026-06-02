import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

type Variant = 'maroon' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface BadgeProps {
  label: string;
  variant?: Variant;
}

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  maroon: { bg: Colors.maroonMuted, text: Colors.maroon },
  success: { bg: Colors.successBg, text: Colors.success },
  warning: { bg: Colors.warningBg, text: Colors.warning },
  danger: { bg: Colors.dangerBg, text: Colors.danger },
  info: { bg: Colors.infoBg, text: Colors.info },
  muted: { bg: Colors.surfaceRaised, text: Colors.creamMuted },
};

export default function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
