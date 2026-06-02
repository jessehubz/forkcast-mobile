import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { O } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Reservation, Restaurant } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const HOURS_LABEL = ["11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p"];
const AI_CACHE_TTL = 6 * 3600 * 1000;

// ─── AI Insight ───────────────────────────────────────────────────────────────

interface AIStats {
  totalReservations: number;
  noShowRate: number;
  peakSlot: string;
  slowDay: string;
  avgPartySize: number;
}

async function fetchInsightBullets(restaurantId: string, stats: AIStats): Promise<string[]> {
  const cacheKey = `ai_insights2_${restaurantId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { ts, bullets } = JSON.parse(cached);
      if (Date.now() - ts < AI_CACHE_TTL) return bullets;
    }
  } catch {}

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!apiKey) return ["Enable your Anthropic API key to see AI recommendations."];

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
        max_tokens: 256,
        messages: [{
          role: "user",
          content: `Restaurant analytics. Return EXACTLY 3 short bullets starting with "• " under 80 chars each. No other text.\n\nMetrics: reservations=${stats.totalReservations}, no-show=${(stats.noShowRate*100).toFixed(1)}%, peak=${stats.peakSlot}, slowest=${stats.slowDay}, avg-party=${stats.avgPartySize.toFixed(1)}`,
        }],
      }),
    });
    const json = await res.json();
    const bullets = (json?.content?.[0]?.text ?? "")
      .split("\n").map((l: string) => l.trim()).filter((l: string) => l.startsWith("•")).slice(0, 3);
    if (bullets.length > 0) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), bullets }));
      return bullets;
    }
  } catch {}
  return [
    "• Consider promotions on your slowest day to boost traffic.",
    "• Deposit policy can reduce no-shows significantly.",
    "• Promote peak slots for faster table turns.",
  ];
}

function AIInsightCard({ restaurantId, stats }: { restaurantId: string; stats: AIStats | null }) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!stats) return;
    setLoading(true);
    if (force) {
      try { await AsyncStorage.removeItem(`ai_insights2_${restaurantId}`); } catch {}
    }
    const result = await fetchInsightBullets(restaurantId, stats);
    setBullets(result);
    setLoading(false);
  }, [restaurantId, stats]);

  useEffect(() => { load(); }, [load]);

  return (
    <View
      className="bg-o-surface rounded-[16px] border border-o-border p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: O.accent }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="bg-o-accent-warm rounded-[6px] px-2 py-[3px]">
          <Text className="text-[9px] font-bold text-o-accent tracking-[0.8px]">✦ AI RECOMMENDATIONS</Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} disabled={loading}>
          <Text className="text-[12px] text-o-text-sub font-medium">{loading ? "…" : "Refresh"}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={O.accent} size="small" className="mt-2.5" />
      ) : (
        bullets.map((b, i) => (
          <View key={i} className="flex-row items-start gap-2 mb-1.5">
            <View
              className="w-[5px] h-[5px] rounded-[2.5px] mt-[5px] shrink-0"
              style={{ backgroundColor: O.accent }}
            />
            <Text className="text-[13px] text-o-text leading-[19px] flex-1">{b.replace(/^• /, "")}</Text>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return O.bgSurface;
  const t = Math.min(count / max, 1);
  if (t > 0.7) return O.accent;
  if (t > 0.35) return O.accentWarm.replace("#3A1E0E", "#6A3420");
  return "#3A2010";
}

function Heatmap({ grid, maxVal }: { grid: number[][]; maxVal: number }) {
  const CELL_W = 26;
  const CELL_H = 18;
  return (
    <View className="pr-2">
      {/* Hour labels */}
      <View className="flex-row items-center mb-1">
        <View style={{ width: 30 }} />
        {HOURS_LABEL.map((h, i) => (
          <View key={i} style={{ width: CELL_W, alignItems: "center" }}>
            <Text className="text-[8px] text-o-text-dim text-center">{h}</Text>
          </View>
        ))}
      </View>
      {/* Day rows */}
      {DAYS_SHORT.map((day, di) => (
        <View key={di} className="flex-row items-center mb-[3px]">
          <Text className="text-[10px] text-o-text-sub font-semibold" style={{ width: 30 }}>{day}</Text>
          {HOURS.map((_, hi) => {
            const count = grid[di][hi];
            return (
              <TouchableOpacity
                key={hi}
                style={{ width: CELL_W, height: CELL_H, backgroundColor: heatColor(count, maxVal), marginRight: 2, borderRadius: 3 }}
                onPress={() => Alert.alert(`${DAYS_SHORT[di]}s ${HOURS_LABEL[hi]}`, `${count} reservation${count !== 1 ? "s" : ""}`)}
                activeOpacity={0.7}
              />
            );
          })}
        </View>
      ))}
      {/* Color scale */}
      <View className="flex-row items-center gap-[3px] mt-2 pl-[30px]">
        <Text className="text-[9px] text-o-text-dim mx-[3px]">Quiet</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <View
            key={i}
            style={{ width: 14, height: 10, borderRadius: 2, backgroundColor: heatColor(t * maxVal, maxVal) }}
          />
        ))}
        <Text className="text-[9px] text-o-text-dim mx-[3px]">Busy</Text>
      </View>
    </View>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function DayBarChart({ dayCounts }: { dayCounts: number[] }) {
  const max = Math.max(...dayCounts, 1);
  const maxIdx = dayCounts.indexOf(Math.max(...dayCounts));
  return (
    <View className="flex-row items-end h-[140px] gap-1.5">
      {dayCounts.map((count, i) => {
        const height = Math.max(4, (count / max) * 96);
        const isPeak = i === maxIdx;
        return (
          <View key={i} className="flex-1 items-center h-[140px] justify-end">
            <Text className="text-[10px] mb-1" style={{ color: isPeak ? O.accent : O.textDim }}>{count}</Text>
            <View className="flex-1 w-full justify-end" style={{ maxHeight: 104 }}>
              <View
                style={{ height, backgroundColor: isPeak ? O.accent : O.surfaceHigh, width: "100%", borderRadius: 5, minHeight: 4 }}
              />
            </View>
            <Text className="text-[10px] mt-[5px] font-semibold" style={{ color: isPeak ? O.accent : O.textSub }}>{DAYS_SHORT[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="bg-o-surface border border-o-border rounded-[14px] px-[18px] py-4 items-center min-w-[96px]">
      <Text className="text-[26px] font-bold text-o-text tracking-[-0.5px] mb-[3px]">{value}</Text>
      <Text className="text-[11px] text-o-text-sub font-semibold text-center">{label}</Text>
      {sub && <Text className="text-[10px] text-o-text-dim mt-[1px]">{sub}</Text>}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rest } = await supabase
        .from("Restaurant").select("*").eq("ownerId", user.id).single();
      if (!rest) { setLoading(false); return; }
      setRestaurant(rest);

      const { data: resData } = await supabase
        .from("Reservation").select("*").eq("restaurantId", rest.id);
      const all: Reservation[] = resData ?? [];
      setReservations(all);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const last30 = all.filter((r) => new Date(r.date) >= cutoff);
      const noShows = last30.filter((r) => r.status === "no_show").length;
      const noShowRate = last30.length > 0 ? noShows / last30.length : 0;
      const avgPartySize = last30.length > 0
        ? last30.reduce((s, r) => s + r.partySize, 0) / last30.length : 0;
      const hourCounts: Record<number, number> = {};
      last30.forEach((r) => { const h = new Date(r.date).getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1; });
      const ph = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 18);
      const peakSlot = `${ph % 12 || 12}${ph < 12 ? "am" : "pm"}`;
      const dc = Array(7).fill(0);
      last30.forEach((r) => { dc[new Date(r.date).getDay()]++; });
      const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      setAiStats({ totalReservations: last30.length, noShowRate, peakSlot, slowDay: DAYS[dc.indexOf(Math.min(...dc))], avgPartySize });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={O.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Compute metrics
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const tonightCovers = reservations.filter(
    (r) => { const d = new Date(r.date); return d >= todayStart && d <= todayEnd && r.status !== "cancelled"; }
  ).reduce((s, r) => s + r.partySize, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekRevenue = reservations
    .filter((r) => new Date(r.date) >= weekStart && r.depositPaid)
    .reduce((s, r) => s + (r.depositAmount ?? 0), 0);

  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
  const last30 = reservations.filter((r) => new Date(r.date) >= cutoff30);
  const noShowPct = last30.length > 0
    ? ((last30.filter((r) => r.status === "no_show").length / last30.length) * 100).toFixed(0) : "0";
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalThisMonth = reservations.filter(
    (r) => new Date(r.date) >= monthStart && r.status !== "cancelled"
  ).length;
  const cancelled = reservations.filter((r) => r.status === "cancelled").length;
  const cancellationRate = reservations.length > 0
    ? ((cancelled / reservations.length) * 100).toFixed(0) : "0";

  const dayCounts = Array(7).fill(0);
  reservations.forEach((r) => { dayCounts[new Date(r.date).getDay()]++; });

  const grid: number[][] = Array.from({ length: 7 }, () => Array(HOURS.length).fill(0));
  reservations.forEach((r) => {
    const d = new Date(r.date);
    const hi = HOURS.indexOf(d.getHours());
    if (hi !== -1) grid[d.getDay()][hi]++;
  });
  const maxVal = Math.max(...grid.flat(), 1);

  const uniqueDiners = new Set(reservations.map((r) => r.dinerId)).size;
  const dinerCounts: Record<string, number> = {};
  reservations.forEach((r) => { dinerCounts[r.dinerId] = (dinerCounts[r.dinerId] ?? 0) + 1; });
  const returning = Object.values(dinerCounts).filter((c) => c > 1).length;
  const returningPct = uniqueDiners > 0 ? ((returning / uniqueDiners) * 100).toFixed(0) : "0";
  const avgPartySize = reservations.length > 0
    ? (reservations.reduce((s, r) => s + r.partySize, 0) / reservations.length).toFixed(1) : "0";

  return (
    <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-[22px] pt-5 pb-4">
          <Text className="text-[13px] text-o-text-sub font-medium mb-0.5">{restaurant?.name ?? ""}</Text>
          <Text className="text-[30px] font-bold text-o-text tracking-[-0.5px]">Insights</Text>
        </View>

        {/* KPI pills — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
          contentContainerClassName="px-5 gap-2.5"
        >
          <KPICard label="Tonight" value={String(tonightCovers)} sub="covers" />
          <KPICard label="Week Revenue" value={`₱${(weekRevenue/1000).toFixed(1)}k`} />
          <KPICard label="No-Shows" value={`${noShowPct}%`} sub="last 30d" />
          <KPICard label="This Month" value={String(totalThisMonth)} sub="bookings" />
          <KPICard label="Cancellations" value={`${cancellationRate}%`} />
        </ScrollView>

        {/* AI Card */}
        {restaurant && aiStats && (
          <View className="px-5 mb-7">
            <AIInsightCard restaurantId={restaurant.id} stats={aiStats} />
          </View>
        )}

        {/* Occupancy Heatmap */}
        <View className="px-5 mb-7">
          <Text className="text-[17px] font-bold text-o-text tracking-[-0.3px] mb-[3px]">Occupancy Heatmap</Text>
          <Text className="text-[12px] text-o-text-dim mb-3.5">Reservations by day and time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Heatmap grid={grid} maxVal={maxVal} />
          </ScrollView>
        </View>

        {/* Day Performance */}
        <View className="px-5 mb-7">
          <Text className="text-[17px] font-bold text-o-text tracking-[-0.3px] mb-[3px]">Day Performance</Text>
          <Text className="text-[12px] text-o-text-dim mb-3.5">Total reservations per day of week</Text>
          <DayBarChart dayCounts={dayCounts} />
        </View>

        {/* Guest Insights */}
        <View className="px-5 mb-7">
          <Text className="text-[17px] font-bold text-o-text tracking-[-0.3px] mb-[3px]">Guest Insights</Text>
          <View className="flex-row gap-2.5">
            <View className="flex-1 bg-o-surface border border-o-border rounded-[14px] py-4 items-center">
              <Text className="text-[24px] font-bold text-o-text tracking-[-0.5px] mb-1">{uniqueDiners}</Text>
              <Text className="text-[11px] text-o-text-sub font-medium text-center">Unique Diners</Text>
            </View>
            <View className="flex-1 bg-o-surface border border-o-border rounded-[14px] py-4 items-center">
              <Text className="text-[24px] font-bold tracking-[-0.5px] mb-1 text-o-accent">{returningPct}%</Text>
              <Text className="text-[11px] text-o-text-sub font-medium text-center">Returning</Text>
            </View>
            <View className="flex-1 bg-o-surface border border-o-border rounded-[14px] py-4 items-center">
              <Text className="text-[24px] font-bold text-o-text tracking-[-0.5px] mb-1">{avgPartySize}</Text>
              <Text className="text-[11px] text-o-text-sub font-medium text-center">Avg Party</Text>
            </View>
          </View>
        </View>

        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
}
