import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "@/constants/theme";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}

export default function StarRating({
  value,
  onChange,
  size = 24,
  readonly = false,
}: StarRatingProps) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        if (readonly) {
          return (
            <Text
              key={star}
              style={[
                styles.star,
                { fontSize: size, color: filled ? Colors.maroonLight : Colors.border },
              ]}
            >
              ★
            </Text>
          );
        }
        return (
          <TouchableOpacity
            key={star}
            onPress={() => onChange?.(star)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text
              style={[
                styles.star,
                { fontSize: size, color: filled ? Colors.maroonLight : Colors.border },
              ]}
            >
              ★
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  star: {
    lineHeight: undefined,
  },
});
