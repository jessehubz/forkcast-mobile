import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "@/constants/theme";
import type { Restaurant } from "@/lib/types";

// ─── Cuisine emoji map ────────────────────────────────────────────────────────

const CUISINE_EMOJI: Record<string, string> = {
  Filipino: "🍽️",
  Japanese: "🍣",
  Italian: "🍕",
  Chinese: "🥢",
  Korean: "🥩",
  Western: "🥩",
};

function getCuisineEmoji(cuisine: string): string {
  return CUISINE_EMOJI[cuisine] ?? "🍴";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Cover */}
      <View style={styles.cover}>
        <Text style={styles.coverEmoji}>{getCuisineEmoji(restaurant.cuisine)}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        {/* Cuisine badge */}
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>
        </View>

        {/* Address */}
        <Text style={styles.address} numberOfLines={1}>
          {restaurant.address}
        </Text>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <Text style={styles.bestTime} numberOfLines={1}>
            Best time: Evening
          </Text>
          <Text style={styles.arrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#160A0C",
    borderWidth: 1,
    borderColor: "#2E1418",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  cover: {
    height: 120,
    backgroundColor: "#1F0E11",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEmoji: {
    fontSize: 48,
  },
  body: {
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.cream,
    marginBottom: 2,
  },
  cuisineBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#2E1418",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  cuisineText: {
    fontSize: 11,
    color: Colors.creamMuted,
    fontWeight: "500",
  },
  address: {
    fontSize: 12,
    color: Colors.creamDim,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  bestTime: {
    fontSize: 12,
    color: Colors.creamDim,
    flex: 1,
  },
  arrow: {
    fontSize: 16,
    color: Colors.maroon,
    fontWeight: "700",
  },
});
