import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { O, ownerStatusColor, ownerStatusBg } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Reservation, Restaurant } from "@/lib/types";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function GlowBackground() {
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <View style={gl.blob1} />
      <View style={gl.blob2} />
    </View>
  );
}
const gl = StyleSheet.create({
  blob1: {
    position: "absolute",
    top: -60,
    left: SCREEN_W * 0.25,
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    backgroundColor: "#C9922A",
    opacity: 0.14,
  },
  blob2: {
    position: "absolute",
    top: SCREEN_W * 0.9,
    right: -40,
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    backgroundColor: "#7A4A12",
    opacity: 0.09,
  },
});

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function isTodayLocal(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function isLast30Days(dateStr: string): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return new Date(dateStr) >= cutoff;
}

// ─── AI Insight ───────────────────────────────────────────────────────────────

interface AIStats {
  totalReservations: number;
  noShowRate: number;
  peakSlot: string;
  slowDay: string;
  avgPartySize: number;
}

async function fetchAIInsights(restaurantId: string, stats: AIStats): Promise<string[]> {
  const cacheKey = `ai_insights_${restaurantId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { ts, bullets } = JSON.parse(cached);
      if (Date.now() - ts < 6 * 3600 * 1000) return bullets;
    }
  } catch {}

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!apiKey) return ["Enable your Anthropic API key to see AI insights."];

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
          content: `Restaurant analytics assistant. Return EXACTLY 3 short bullet recommendations. Each starts with "• " and is under 80 chars. No other text.\n\nStats: reservations=${stats.totalReservations}, no-show=${(stats.noShowRate*100).toFixed(1)}%, peak=${stats.peakSlot}, slowest=${stats.slowDay}, avg-party=${stats.avgPartySize.toFixed(1)}`,
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
    "• Promote slow days with a special prix-fixe to drive mid-week covers.",
    "• Deposit policy during peak slots can significantly cut no-shows.",
    "• Your peak slot is in high demand — consider a waitlist option.",
  ];
}

function AIInsightCard({ restaurantId, stats }: { restaurantId: string; stats: AIStats | null }) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!stats) return;
    setLoading(true);
    if (force) {
      try { await AsyncStorage.removeItem(`ai_insights_${restaurantId}`); } catch {}
    }
    const result = await fetchAIInsights(restaurantId, stats);
    setBullets(result);
    setLoading(false);
  }, [restaurantId, stats]);

  useEffect(() => { load(); }, [load]);

  return (
    <View className="mx-5 mb-4 bg-o-surface rounded-[16px] border border-o-border p-4" style={{ borderLeftWidth: 3, borderLeftColor: O.accent }}>
      <View className="flex-row justify-between items-center mb-[10px]">
        <View className="bg-o-accent-warm rounded-[6px] px-2 py-[3px]">
          <Text className="text-[11px] font-bold text-o-accent tracking-[0.5px]">✦ AI</Text>
        </View>
        <TouchableOpacity onPress={() => load(true)} disabled={loading}>
          <Text className="text-[12px] text-o-text-sub font-medium">{loading ? "thinking…" : "Refresh"}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={O.accent} size="small" style={{ marginTop: 10 }} />
      ) : (
        bullets.map((b, i) => (
          <Text key={i} className="text-[13px] text-o-text mt-[3px] leading-5">{b}</Text>
        ))
      )}
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ title, value, sub, accent }: {
  title: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <View className={`w-[47.5%] rounded-[16px] border p-4 gap-[6px] ${
      accent ? "bg-o-accent-warm border-o-accent/40" : "bg-o-surface border-o-border"
    }`}>
      <Text className={`text-[36px] font-bold tracking-[-1px] ${accent ? "text-o-accent" : "text-o-text"}`}>
        {value}
      </Text>
      <Text className={`text-[13px] font-semibold mb-[2px] ${accent ? "text-o-accent/80" : "text-o-text-sub"}`}>
        {title}
      </Text>
      {sub && (
        <Text className={`text-[11px] ${accent ? "text-o-accent/60" : "text-o-text-dim"}`}>{sub}</Text>
      )}
    </View>
  );
}

// ─── Revenue Bar ──────────────────────────────────────────────────────────────

function RevenueBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(1, target > 0 ? current / target : 0);
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct, width]);

  return (
    <View className="mx-5 mb-4 bg-o-surface rounded-[16px] border border-o-border p-[18px]">
      <View className="flex-row justify-between mb-3">
        <Text className="text-[14px] font-semibold text-o-text">Monthly Revenue</Text>
        <Text className="text-[14px] font-bold text-o-accent">{(pct * 100).toFixed(0)}%</Text>
      </View>
      <View className="h-[6px] bg-o-border rounded-full overflow-hidden mb-[10px]">
        <Animated.View
          className="h-[6px] bg-o-accent rounded-full"
          style={{ width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[13px] font-bold text-o-text">₱{current.toLocaleString()}</Text>
        <Text className="text-[13px] text-o-text-dim">of ₱{target.toLocaleString()}</Text>
      </View>
    </View>
  );
}

// ─── Reservation Row ──────────────────────────────────────────────────────────

interface DinerProfile { id: string; noShowCount: number; name: string }

function ReservationRow({
  reservation,
  dinerProfile,
  onApprove,
  onReject,
  onPress,
}: {
  reservation: Reservation;
  dinerProfile?: DinerProfile;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onPress: () => void;
}) {
  const isPending = reservation.status === "pending";
  const isHighRisk = (dinerProfile?.noShowCount ?? 0) >= 2;
  const statusCol = ownerStatusColor(reservation.status);
  const statusBg = ownerStatusBg(reservation.status);

  return (
    <TouchableOpacity
      className="flex-row items-center bg-o-surface border border-o-border rounded-[14px] p-[14px] mb-2 gap-3"
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Time column */}
      <View className="items-center w-[52px] gap-[5px]">
        <Text className="text-[12px] font-bold text-o-text text-center">{formatTime(reservation.date)}</Text>
        <View className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: statusCol }} />
      </View>

      {/* Main content */}
      <View className="flex-1 gap-[2px]">
        <View className="flex-row items-center gap-[6px]">
          <Text className="text-[14px] font-bold text-o-text shrink" numberOfLines={1}>{reservation.dinerName}</Text>
          {isHighRisk && (
            <View className="bg-o-danger-bg rounded-[6px] px-[6px] py-[2px]">
              <Text className="text-[9px] font-bold text-o-danger uppercase tracking-[0.4px]">risk</Text>
            </View>
          )}
        </View>
        <Text className="text-[12px] text-o-text-sub">
          {reservation.partySize} guests
          {(reservation as any).table?.label ? ` · ${(reservation as any).table.label}` : ""}
        </Text>
        {reservation.dinerNotes && (
          <Text className="text-[11px] text-o-text-dim italic" numberOfLines={1}>"{reservation.dinerNotes}"</Text>
        )}
      </View>

      {/* Status / Actions */}
      {isPending && onApprove && onReject ? (
        <View className="flex-row gap-[6px]">
          <TouchableOpacity
            className="w-9 h-9 rounded-[10px] bg-o-accent-warm items-center justify-center border border-o-accent/40"
            onPress={() => onApprove(reservation.id)}
            activeOpacity={0.8}
          >
            <Text className="text-[14px] font-bold text-o-accent">✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-9 h-9 rounded-[10px] bg-o-danger-bg items-center justify-center"
            onPress={() => onReject(reservation.id)}
            activeOpacity={0.8}
          >
            <Text className="text-[14px] font-bold text-o-danger">✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="px-2 py-1 rounded-[8px]" style={{ backgroundColor: statusBg }}>
          <Text className="text-[10px] font-bold" style={{ color: statusCol }}>
            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [pendingReservations, setPendingReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [dinerProfiles, setDinerProfiles] = useState<Record<string, DinerProfile>>({});
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rest } = await supabase
      .from("Restaurant").select("*").eq("ownerId", user.id).single();
    if (!rest) { setLoading(false); return; }
    setRestaurant(rest);

    const [{ data: tbl }, { data: allRes }] = await Promise.all([
      supabase.from("Table").select("*").eq("restaurantId", rest.id),
      supabase.from("Reservation")
        .select("*, table:Table(*)")
        .eq("restaurantId", rest.id)
        .order("date", { ascending: true }),
    ]);

    setTables(tbl ?? []);
    const allR: Reservation[] = allRes ?? [];
    setAllReservations(allR);

    const todayR = allR.filter((r) => isTodayLocal(r.date) && r.status !== "cancelled");
    setTodayReservations(todayR);

    const pendingR = allR.filter((r) => r.status === "pending");
    setPendingReservations(pendingR);

    // Diner profiles for risk badges
    const dinerIds = [...new Set(todayR.map((r) => r.dinerId))];
    if (dinerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("Profile").select("id, name, noShowCount").in("id", dinerIds);
      const map: Record<string, DinerProfile> = {};
      (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
      setDinerProfiles(map);
    }

    // AI stats
    const last30 = allR.filter((r) => isLast30Days(r.date));
    const noShows = last30.filter((r) => r.status === "no_show").length;
    const noShowRate = last30.length > 0 ? noShows / last30.length : 0;
    const avgPartySize = last30.length > 0
      ? last30.reduce((s, r) => s + r.partySize, 0) / last30.length : 0;
    const hourCounts: Record<number, number> = {};
    last30.forEach((r) => { const h = new Date(r.date).getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1; });
    const peakH = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 18);
    const peakSlot = `${peakH % 12 || 12}${peakH < 12 ? "am" : "pm"}`;
    const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayCounts = Array(7).fill(0);
    last30.forEach((r) => { dayCounts[new Date(r.date).getDay()]++; });
    const slowDay = DAYS[dayCounts.indexOf(Math.min(...dayCounts))];
    setAiStats({ totalReservations: last30.length, noShowRate, peakSlot, slowDay, avgPartySize });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    await supabase.from("Reservation").update({ status: "approved" }).eq("id", id);
    loadData();
  };

  const handleReject = (id: string) => {
    Alert.alert("Reject reservation?", "This will notify the guest.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive",
        onPress: async () => {
          await supabase.from("Reservation").update({ status: "rejected" }).eq("id", id);
          loadData();
        },
      },
    ]);
  };

  // Computed stats
  const tonightCovers = todayReservations.reduce((s, r) => s + r.partySize, 0);
  const last30 = allReservations.filter((r) => isLast30Days(r.date));
  const noShowRate = last30.length > 0
    ? ((last30.filter((r) => r.status === "no_show").length / last30.length) * 100).toFixed(0) : "0";
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const reservedTableIds = new Set(
    allReservations.filter((r) => {
      const d = new Date(r.date);
      return d >= now && d <= in2h && !["cancelled","completed","no_show"].includes(r.status);
    }).map((r) => r.tableId)
  );
  const tablesAvailableNow = Math.max(0, tables.length - reservedTableIds.size);
  const thisWeekTotal = allReservations.filter((r) => isThisWeek(r.date) && r.status !== "cancelled").length;
  const monthRevenue = allReservations
    .filter((r) => {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return new Date(r.date) >= s && r.depositPaid;
    })
    .reduce((s, r) => s + (r.depositAmount ?? 0), 0);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={O.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
      <GlowBackground />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-[22px] pt-4 pb-1">
          <Text className="text-[11px] text-o-text-dim font-semibold uppercase tracking-[0.8px]">
            {getDateLabel()}
          </Text>
        </View>
        <View className="flex-row items-start justify-between px-[22px] pt-2 pb-5">
          <View className="flex-1">
            <Text className="text-[15px] text-o-text-dim font-normal mb-[2px] tracking-[0.1px]">
              {getGreeting()},
            </Text>
            <Text className="text-[28px] font-bold text-o-text tracking-[-0.6px]" numberOfLines={1}>
              {restaurant?.name ?? "Your Restaurant"}
            </Text>
          </View>
          <View className="flex-row items-center gap-[5px] bg-o-accent-warm rounded-full px-[10px] py-[6px] border mt-[6px]" style={{ borderColor: O.accent + "30" }}>
            <View className="w-[6px] h-[6px] rounded-full bg-o-accent" />
            <Text className="text-[11px] text-o-accent font-bold tracking-[0.5px]">Live</Text>
          </View>
        </View>

        {/* KPI Grid */}
        <View className="flex-row flex-wrap px-5 gap-[10px] mb-4">
          <KPICard title="Tonight's Covers" value={String(tonightCovers)} sub="guests booked" accent />
          <KPICard title="No-Show Rate" value={`${noShowRate}%`} sub="last 30 days" />
          <KPICard title="Tables Free" value={String(tablesAvailableNow)} sub="available now" />
          <KPICard title="This Week" value={String(thisWeekTotal)} sub="reservations" />
        </View>

        {/* Revenue Progress */}
        <RevenueBar current={monthRevenue} target={100000} />

        {/* Needs Attention */}
        {pendingReservations.length > 0 && (
          <View className="px-5 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[16px] font-bold text-o-text tracking-[-0.2px]">Needs Attention</Text>
              <View className="bg-o-accent rounded-[10px] min-w-5 h-5 items-center justify-center px-[5px]">
                <Text className="text-[11px] font-bold text-white">{pendingReservations.length}</Text>
              </View>
            </View>
            {pendingReservations.map((res) => (
              <ReservationRow
                key={res.id}
                reservation={res}
                dinerProfile={dinerProfiles[res.dinerId]}
                onApprove={handleApprove}
                onReject={handleReject}
                onPress={() => router.push(`/reservation/${res.id}` as any)}
              />
            ))}
          </View>
        )}

        {/* AI Insight Card */}
        {restaurant && aiStats && (
          <AIInsightCard restaurantId={restaurant.id} stats={aiStats} />
        )}

        {/* Tonight's Timeline */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[16px] font-bold text-o-text tracking-[-0.2px]">Tonight</Text>
            <TouchableOpacity onPress={() => router.push("/(owner)/reservations" as any)}>
              <Text className="text-[13px] text-o-accent font-semibold">See all</Text>
            </TouchableOpacity>
          </View>

          {todayReservations.length === 0 ? (
            <View className="items-center py-7 bg-o-surface rounded-[14px] border border-o-border">
              <Text className="text-[14px] font-semibold text-o-text-sub mb-1">No reservations tonight</Text>
              <Text className="text-[12px] text-o-text-dim">A quiet evening ahead</Text>
            </View>
          ) : (
            todayReservations.map((res) => (
              <ReservationRow
                key={res.id}
                reservation={res}
                dinerProfile={dinerProfiles[res.dinerId]}
                onPress={() => router.push(`/reservation/${res.id}` as any)}
              />
            ))
          )}
        </View>

        {/* View Full Schedule CTA */}
        <TouchableOpacity
          className="mx-5 mt-2 bg-o-accent rounded-[14px] py-4 items-center"
          style={{
            shadowColor: O.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 5,
          }}
          onPress={() => router.push("/(owner)/reservations" as any)}
          activeOpacity={0.85}
        >
          <Text className="text-[15px] font-bold text-white tracking-[0.2px]">View Full Schedule</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
