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
import { useRouter } from "expo-router";
import { O, ownerStatusColor, ownerStatusBg } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Reservation } from "@/lib/types";

type FilterTab = "All" | "Upcoming" | "Pending";

interface DinerProfile { id: string; noShowCount: number }

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isUpcoming(dateStr: string): boolean { return new Date(dateStr) > new Date(); }

function StatusPill({ status }: { status: string }) {
  const col = ownerStatusColor(status);
  const bg = ownerStatusBg(status);
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
  return (
    <View className="flex-row items-center px-2 py-1 rounded-[8px] gap-1" style={{ backgroundColor: bg }}>
      <View className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: col }} />
      <Text className="text-[10px] font-bold" style={{ color: col }}>{label}</Text>
    </View>
  );
}

function ReservationCard({
  reservation: res, dinerProfile, onApprove, onReject, onPress,
}: {
  reservation: Reservation;
  dinerProfile?: DinerProfile;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPress: () => void;
}) {
  const isHighRisk = (dinerProfile?.noShowCount ?? 0) >= 2;
  const isPending = res.status === "pending";

  return (
    <TouchableOpacity
      className="bg-o-surface border border-o-border rounded-[16px] p-4"
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Top row */}
      <View className="flex-row items-start gap-[10px]">
        <View className="flex-1">
          <View className="flex-row items-center gap-[6px] mb-[3px]">
            <Text className="text-[16px] font-bold text-white shrink tracking-[-0.2px]" numberOfLines={1}>
              {res.dinerName}
            </Text>
            {isHighRisk && (
              <View className="bg-o-danger-bg rounded-[6px] px-[6px] py-[2px]">
                <Text className="text-[9px] font-bold text-o-danger uppercase tracking-[0.4px]">risk</Text>
              </View>
            )}
          </View>
          <Text className="text-[12px] text-o-text-sub mb-[2px]">
            {formatDateTime(res.date)} · {res.partySize} guests
          </Text>
          {(res as any).table?.label && (
            <Text className="text-[11px] text-o-text-dim font-medium">Table {(res as any).table.label}</Text>
          )}
        </View>
        <StatusPill status={res.status} />
      </View>

      {/* Notes */}
      {res.dinerNotes && (
        <View className="mt-[10px] p-[10px] bg-o-surface rounded-[10px]" style={{ borderLeftWidth: 2, borderLeftColor: O.accent + "60" }}>
          <Text className="text-[12px] text-o-text-sub italic leading-[18px]">"{res.dinerNotes}"</Text>
        </View>
      )}

      {/* Pending actions */}
      {isPending && (
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            className="flex-1 py-[10px] rounded-[12px] items-center border bg-o-accent-warm border-o-accent/40"
            onPress={() => onApprove(res.id)}
            activeOpacity={0.8}
          >
            <Text className="text-[13px] font-bold text-o-accent">Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-[10px] rounded-[12px] items-center border bg-o-danger-bg"
            style={{ borderColor: O.danger + "40" }}
            onPress={() => onReject(res.id)}
            activeOpacity={0.8}
          >
            <Text className="text-[13px] font-bold text-o-danger">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ReservationsScreen() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dinerProfiles, setDinerProfiles] = useState<Record<string, DinerProfile>>({});
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rest } = await supabase
      .from("Restaurant").select("id").eq("ownerId", user.id).single();
    if (!rest) { setLoading(false); return; }

    const { data: resData } = await supabase
      .from("Reservation").select("*, table:Table(*)")
      .eq("restaurantId", rest.id).order("date", { ascending: true });
    const all: Reservation[] = resData ?? [];
    setReservations(all);

    const ids = [...new Set(all.map((r) => r.dinerId))];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("Profile").select("id, noShowCount").in("id", ids);
      const map: Record<string, DinerProfile> = {};
      (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
      setDinerProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    await supabase.from("Reservation").update({ status: "approved" }).eq("id", id);
    loadData();
  };

  const handleReject = (id: string) => {
    Alert.alert("Reject Reservation", "This will notify the guest.", [
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

  const filtered = reservations.filter((r) => {
    if (activeTab === "Upcoming") return isUpcoming(r.date) && r.status !== "cancelled";
    if (activeTab === "Pending") return r.status === "pending";
    return true;
  });

  const pendingCount = reservations.filter((r) => r.status === "pending").length;
  const TABS: { key: FilterTab; label: string; badge?: number }[] = [
    { key: "All",      label: "All" },
    { key: "Upcoming", label: "Upcoming" },
    { key: "Pending",  label: "Pending", badge: pendingCount },
  ];

  return (
    <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
      {/* Header */}
      <View className="px-[22px] pt-5 pb-[6px]">
        <Text className="text-[30px] font-bold text-white tracking-[-0.5px]">Bookings</Text>
      </View>

      {/* Filter tabs */}
      <View className="flex-row px-5 py-3 gap-2">
        {TABS.map(({ key, label, badge }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              className={`flex-row items-center px-[14px] py-2 rounded-full border gap-[5px] ${
                active ? "bg-o-accent border-o-accent" : "bg-o-surface border-o-border"
              }`}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.75}
            >
              <Text className={`text-[13px] font-medium ${active ? "text-white font-semibold" : "text-o-text-sub"}`}>
                {label}
              </Text>
              {badge !== undefined && badge > 0 && (
                <View
                  className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : O.border }}
                >
                  <Text className={`text-[10px] font-bold ${active ? "text-white" : "text-o-text-sub"}`}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={O.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-5 gap-[10px]"
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View className="items-center pt-16">
              <Text className="text-[16px] font-bold text-o-text-sub mb-[5px]">No reservations</Text>
              <Text className="text-[13px] text-o-text-dim text-center">
                {activeTab === "Pending" ? "All caught up — no pending requests" : "Nothing here yet"}
              </Text>
            </View>
          ) : (
            filtered.map((res) => (
              <ReservationCard
                key={res.id}
                reservation={res}
                dinerProfile={dinerProfiles[res.dinerId]}
                onApprove={handleApprove}
                onReject={handleReject}
                onPress={() => router.push(`/reservation/${res.id}` as any)}
              />
            ))
          )}
          <View className="h-20" />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute right-5 bottom-6 w-14 h-14 rounded-full bg-o-accent items-center justify-center"
        style={{
          shadowColor: O.accent,
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
        onPress={() => router.push("/owner/add-reservation" as any)}
        activeOpacity={0.85}
      >
        <Text className="text-[28px] text-white font-light leading-8">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
