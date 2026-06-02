import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`variant_${variant}`],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.maroon : Colors.white}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },

  // Variants
  variant_primary: {
    backgroundColor: Colors.maroon,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.maroon,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: Colors.danger,
  },

  // Sizes
  size_sm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  size_md: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },

  // Label base
  label: {
    fontWeight: '600',
  },

  // Label colors by variant
  label_primary: {
    color: Colors.white,
  },
  label_outline: {
    color: Colors.maroon,
  },
  label_ghost: {
    color: Colors.creamMuted,
  },
  label_danger: {
    color: Colors.white,
  },

  // Label sizes
  labelSize_sm: {
    fontSize: 13,
  },
  labelSize_md: {
    fontSize: 15,
  },
  labelSize_lg: {
    fontSize: 16,
  },
});
