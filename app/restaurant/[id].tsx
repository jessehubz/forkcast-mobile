import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { D, CuisinePalette, Shadow } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Restaurant, Table, Reservation } from "@/lib/types";

const SCREEN_W = Dimensions.get("window").width;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

// ─── Cover Art (matching discovery screen) ────────────────────────────────────

function HeroCoverArt({ cuisine }: { cuisine: string }) {
  const key = cuisine in CuisinePalette ? cuisine : "default";
  const { bg, mid } = CuisinePalette[key];
  const h = 280;
  return (
    <View style={{ width: SCREEN_W, height: h, backgroundColor: bg }}>
      <Svg width={SCREEN_W} height={h} style={{ position: "absolute" }}>
        <Circle cx={SCREEN_W * 0.78} cy={h * 0.28} r={h * 0.65} fill={mid} opacity={0.5} />
        <Circle cx={SCREEN_W * 0.12} cy={h * 0.8} r={h * 0.45} fill={mid} opacity={0.3} />
        <Ellipse cx={SCREEN_W * 0.5} cy={h} rx={SCREEN_W * 0.55} ry={h * 0.25} fill={D.accent} opacity={0.15} />
        <Circle cx={SCREEN_W * 0.55} cy={h * 0.5} r={h * 0.12} fill={D.accent} opacity={0.12} />
      </Svg>
      <View className="flex-1 items-center justify-center">
        <Text className="text-[80px] opacity-40">
          {CUISINE_EMOJI[cuisine] ?? "🍽️"}
        </Text>
      </View>
    </View>
  );
}

const CUISINE_EMOJI: Record<string, string> = {
  Italian: "🍝", Japanese: "🍣", Filipino: "🍚", Chinese: "🥢",
  Western: "🥩", Korean: "🍜", French: "🥐", Indian: "🍛",
  Mediterranean: "🫒", default: "🍽️",
};

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function buildHeatmap(reservations: Reservation[]) {
  const grid: Record<string, number> = {};
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const d = new Date(r.date);
    const key = `${d.getDay()}-${d.getHours()}`;
    grid[key] = (grid[key] || 0) + 1;
  }
  return grid;
}

function heatCellColor(count: number, max: number): string {
  if (count === 0 || max === 0) return D.surfaceRaised;
  const t = count / max;
  if (t > 0.6) return D.accent;
  if (t > 0.25) return "#0E6B58";
  return "#0A3830";
}

function computeBestTime(grid: Record<string, number>): string {
  let minKey = "";
  let minVal = Infinity;
  for (const [key, val] of Object.entries(grid)) {
    if (val < minVal) { minVal = val; minKey = key; }
  }
  if (!minKey) return "any time";
  const [dayIdx, hourVal] = minKey.split("-").map(Number);
  const ampm = hourVal < 12 ? "AM" : "PM";
  const h12 = hourVal % 12 === 0 ? 12 : hourVal % 12;
  return `${DAYS[dayIdx]}s at ${h12}${ampm}`;
}

function BestTimeChart({ reservations }: { reservations: Reservation[] }) {
  const grid = buildHeatmap(reservations);
  const maxVal = Math.max(0, ...Object.values(grid));
  const bestTime = computeBestTime(grid);
  const cellSize = Math.floor((SCREEN_W - 56 - 28) / 11);

  return (
    <View>
      {/* Grid */}
      <View className="gap-[3px]">
        {/* Hour labels */}
        <View className="flex-row items-center gap-[3px]">
          <View className="w-7" />
          {HOURS.map((h) => {
            const lbl = h === 12 ? "12" : h > 12 ? `${h - 12}p` : `${h}a`;
            return (
              <View key={h} style={{ width: cellSize, alignItems: "center" }}>
                <Text className="text-[8px] text-d-text-dim text-center">{lbl}</Text>
              </View>
            );
          })}
        </View>
        {/* Day rows */}
        {DAYS.map((day, dayIdx) => (
          <View key={day} className="flex-row items-center gap-[3px]">
            <Text className="text-[9px] text-d-text-dim text-right pr-1 w-7">{day.slice(0, 2)}</Text>
            {HOURS.map((hour) => {
              const count = grid[`${dayIdx}-${hour}`] ?? 0;
              return (
                <View
                  key={hour}
                  className="rounded-[3px]"
                  style={{ width: cellSize, height: cellSize, backgroundColor: heatCellColor(count, maxVal) }}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend + best time */}
      <View className="flex-row items-center justify-between mt-3">
        <View className="flex-row items-center gap-1">
          {[0, 0.3, 0.7, 1].map((t, i) => (
            <View
              key={i}
              className="rounded-[2px]"
              style={{ width: 14, height: 10, backgroundColor: heatCellColor(t * maxVal, maxVal) }}
            />
          ))}
          <Text className="text-[10px] text-d-text-dim ml-1">Busy</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-[12px] text-d-text-sub">Best: </Text>
          <Text className="text-[12px] font-bold text-d-accent">{bestTime}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── AI Insight ───────────────────────────────────────────────────────────────

async function getAIInsight(heatmapData: object, restaurantName: string): Promise<string> {
  const cacheKey = `insight-${restaurantName}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { text, ts } = JSON.parse(cached);
      if (Date.now() - ts < 6 * 3600 * 1000) return text;
    }
  } catch {}

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system: "Restaurant analytics assistant. Return exactly one sentence (under 20 words) about the quietest time to visit.",
        messages: [{ role: "user", content: `${restaurantName}: ${JSON.stringify(heatmapData)}` }],
      }),
    });
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now() })); } catch {}
    return text;
  } catch { return ""; }
}

// ─── Quick Info Strip ─────────────────────────────────────────────────────────

function InfoChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View className="flex-row items-center gap-[5px] bg-d-surface-raised rounded-[10px] px-[10px] py-[7px]">
      <Text className="text-[13px]">{icon}</Text>
      <Text className="text-[12px] text-d-text-sub font-medium">{label}</Text>
    </View>
  );
}

// ─── Mock Reviews ─────────────────────────────────────────────────────────────

const MOCK_REVIEWS = [
  { name: "Maria S.", rating: 5, text: "Exceptional. The service was flawless and the food elevated.", date: "May 2025" },
  { name: "James T.", rating: 4, text: "Beautiful setting. Portions could be larger for the price.", date: "Apr 2025" },
  { name: "Ana R.", rating: 5, text: "Worth every peso. Booked for our anniversary and left speechless.", date: "Mar 2025" },
];

function ReviewCard({ review }: { review: typeof MOCK_REVIEWS[0] }) {
  return (
    <View className="bg-d-surface rounded-[14px] border border-d-border p-[14px] mb-[10px]">
      <View className="flex-row items-center gap-[10px] mb-2">
        <View className="w-8 h-8 rounded-full bg-d-accent-light items-center justify-center">
          <Text className="text-[13px] font-bold text-d-accent">{review.name[0]}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-d-text">{review.name}</Text>
          <Text className="text-[11px] text-d-text-dim">{review.date}</Text>
        </View>
        <Text className="text-[13px] text-d-accent tracking-[1px]">{"★".repeat(review.rating)}</Text>
      </View>
      <Text className="text-[13px] text-d-text-sub leading-[19px]">{review.text}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: rest }, { data: tabs }, { data: res }] = await Promise.all([
        supabase.from("Restaurant").select("*").eq("id", id).single(),
        supabase.from("Table").select("*").eq("restaurantId", id),
        supabase.from("Reservation").select("*").eq("restaurantId", id),
      ]);
      setRestaurant(rest ?? null);
      setTables(tabs ?? []);
      setReservations(res ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!restaurant || reservations.length === 0) return;
    const grid = buildHeatmap(reservations);
    if (Object.keys(grid).length === 0) return;
    setAiLoading(true);
    getAIInsight(grid, restaurant.name)
      .then(setAiInsight).catch(() => setAiInsight("")).finally(() => setAiLoading(false));
  }, [restaurant?.name, reservations.length]);

  if (loading) {
    return (
      <View className="flex-1 bg-d-bg items-center justify-center">
        <ActivityIndicator color={D.accent} size="large" />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View className="flex-1 bg-d-bg items-center justify-center">
        <Text className="text-[16px] text-d-text-sub">Restaurant not found.</Text>
      </View>
    );
  }

  const avgRating = (4.2 + (restaurant.name.length % 5) * 0.16).toFixed(1);

  return (
    <View className="flex-1 bg-d-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View className="relative">
          <HeroCoverArt cuisine={restaurant.cuisine} />

          {/* Back button */}
          <SafeAreaView className="absolute top-0 left-0 right-0 z-10" edges={["top"]}>
            <TouchableOpacity className="m-4 w-10 h-10 rounded-full bg-black/40 items-center justify-center" onPress={() => router.back()} activeOpacity={0.85}>
              <Text className="text-[26px] text-white leading-[30px] -mt-0.5">‹</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Hero overlay: name + cuisine */}
          <View className="absolute bottom-0 left-0 right-0 px-5 pt-[14px] pb-[18px] bg-[rgba(8,15,13,0.82)]">
            <View className="mb-2">
              <Text className="text-[26px] font-bold text-white tracking-[-0.5px]" numberOfLines={2}>{restaurant.name}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="rounded-full px-[10px] py-1 bg-[rgba(255,255,255,0.15)]">
                <Text className="text-[11px] font-semibold uppercase text-[rgba(255,255,255,0.85)] tracking-[0.5px]">{restaurant.cuisine}</Text>
              </View>
              <View className="rounded-full px-[10px] py-1 bg-d-accent-light">
                <Text className="text-[12px] font-bold text-d-accent-mid">{`★ ${avgRating}`}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick info strip */}
        <View className="py-[14px] border-b border-d-border">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 gap-2">
            <InfoChip icon="📍" label={restaurant.address} />
            <InfoChip icon="🪑" label={`${tables.length} tables`} />
            <InfoChip icon="🕕" label="6pm–10pm" />
            <InfoChip icon="💳" label="Reservations" />
          </ScrollView>
        </View>

        {/* Description */}
        {restaurant.description && (
          <View className="px-5 pt-5">
            <Text className="text-[14px] text-d-text-sub pb-1 leading-[22px]">{restaurant.description}</Text>
          </View>
        )}

        {/* Best Time Chart — atmospheric AI card */}
        <View
          className="mx-5 mt-4 p-[18px] rounded-[18px] border overflow-hidden bg-[#0A1A16] border-[rgba(30,207,172,0.18)]"
          style={Shadow.sm}
        >
          {/* Smooth gradient atmosphere */}
          <LinearGradient
            colors={["rgba(14,75,56,0.55)", "rgba(8,28,20,0.30)", "transparent"]}
            locations={[0.0, 0.55, 1.0]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="absolute inset-0"
            pointerEvents="none"
          />
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-[16px] font-bold text-d-text mb-0.5 tracking-[-0.2px]">Best Time to Visit</Text>
              <Text className="text-[11px] text-d-text-dim">AI-powered based on real booking patterns</Text>
            </View>
            <View className="bg-d-accent-light rounded-[8px] px-2 py-1">
              <Text className="text-[10px] font-bold text-d-accent tracking-[0.5px]">✦ AI</Text>
            </View>
          </View>

          {reservations.length > 0 ? (
            <BestTimeChart reservations={reservations} />
          ) : (
            <Text className="text-[13px] text-d-text-dim italic">Not enough data yet.</Text>
          )}

          {aiLoading ? (
            <View className="mt-[14px] p-3 bg-d-accent-light rounded-[12px]" style={{ borderLeftWidth: 3, borderLeftColor: D.accent }}>
              <ActivityIndicator color={D.accent} size="small" />
            </View>
          ) : aiInsight ? (
            <View className="mt-[14px] p-3 bg-d-accent-light rounded-[12px]" style={{ borderLeftWidth: 3, borderLeftColor: D.accent }}>
              <Text className="text-[13px] text-d-text italic leading-[19px]">{aiInsight}</Text>
            </View>
          ) : null}
        </View>

        {/* Reviews */}
        <View className="px-5 pt-5">
          <View className="flex-row justify-between items-center mb-[14px]">
            <Text className="text-[18px] font-bold text-d-text tracking-[-0.3px]">Reviews</Text>
            <Text className="text-[13px] text-d-accent font-bold">★ {avgRating} · {MOCK_REVIEWS.length} reviews</Text>
          </View>
          {MOCK_REVIEWS.map((review, i) => (
            <ReviewCard key={i} review={review} />
          ))}
        </View>

        <View className="h-[120px]" />
      </ScrollView>

      {/* Bottom CTA */}
      <View
        className="flex-row items-center bg-d-surface border-t border-d-border px-5 pt-[14px] pb-[30px] gap-[14px]"
        style={Shadow.lg}
      >
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-d-text mb-0.5" numberOfLines={1}>{restaurant.name}</Text>
          <Text className="text-[12px] text-d-success font-semibold">2 slots available tonight</Text>
        </View>
        <TouchableOpacity
          className="bg-d-accent rounded-[14px] px-7 py-[14px]"
          style={Shadow.accent}
          activeOpacity={0.88}
          onPress={() => router.push(`/restaurant/${id}/book` as any)}
        >
          <Text className="text-[16px] font-bold text-white tracking-[0.2px]">Reserve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
