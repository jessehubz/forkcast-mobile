import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { D, statusColor, statusLabel } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { cancelReservation } from "@/lib/api";
import type { Reservation, Waitlist } from "@/lib/types";

type ActiveTab = "upcoming" | "past" | "waitlists";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} · ${h12}:${m} ${ampm}`;
}

function canCancel(r: Reservation): boolean {
  if (r.status === "cancelled" || r.status === "completed") return false;
  return (new Date(r.date).getTime() - Date.now()) / 3600000 > 24;
}

function StatusBadge({ status }: { status: string }) {
  const col = statusColor(status);
  return (
    <View className="px-[10px] py-1 rounded-full shrink-0" style={{ backgroundColor: col + "20" }}>
      <Text className="text-[11px] font-bold tracking-[0.2px]" style={{ color: col }}>{statusLabel(status)}</Text>
    </View>
  );
}

function ReservationCard({ reservation: r, showCancel, onCancel }: {
  reservation: Reservation; showCancel: boolean; onCancel: () => void;
}) {
  const router = useRouter();
  return (
    <TouchableOpacity
      className="bg-d-surface rounded-[16px] border border-d-border p-[18px]"
      activeOpacity={0.88}
      onPress={() => router.push(`/reservation/${r.id}` as any)}
    >
      {/* Restaurant name + status */}
      <View className="flex-row items-center justify-between mb-2 gap-2">
        <Text className="text-[16px] font-bold text-d-text flex-1 tracking-[0.2px]" numberOfLines={1}>{r.restaurant?.name ?? "Restaurant"}</Text>
        <StatusBadge status={r.status} />
      </View>

      {/* Date */}
      <Text className="text-[13px] text-d-text-sub mb-[10px] font-medium">{formatDate(r.date)}</Text>

      {/* Meta chips */}
      <View className="flex-row gap-2">
        <View className="bg-d-surface-raised rounded-[8px] px-[10px] py-[5px]">
          <Text className="text-[12px] text-d-text-sub font-medium">{r.partySize} {r.partySize === 1 ? "guest" : "guests"}</Text>
        </View>
        {r.table && (
          <View className="bg-d-surface-raised rounded-[8px] px-[10px] py-[5px]">
            <Text className="text-[12px] text-d-text-sub font-medium">Table {r.table.label}</Text>
          </View>
        )}
      </View>

      {showCancel && canCancel(r) && (
        <TouchableOpacity
          className="mt-[14px] border-[1.5px] border-d-danger/60 rounded-[10px] py-[10px] items-center bg-d-danger-bg"
          onPress={(e) => { e.stopPropagation(); onCancel(); }}
          activeOpacity={0.8}
        >
          <Text className="text-d-danger text-[13px] font-semibold">Cancel Reservation</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function WaitlistCard({ entry, onLeave }: { entry: Waitlist; onLeave: () => void }) {
  return (
    <View className="bg-d-surface rounded-[16px] border border-d-border p-[18px]">
      <View className="flex-row items-center justify-between mb-2 gap-2">
        <Text className="text-[16px] font-bold text-d-text flex-1 tracking-[0.2px]" numberOfLines={1}>{entry.restaurant?.name ?? "Restaurant"}</Text>
        <View className="px-[10px] py-1 rounded-full shrink-0 bg-d-warning-bg">
          <Text className="text-[11px] font-bold tracking-[0.2px] text-d-warning">Waitlisted</Text>
        </View>
      </View>
      <Text className="text-[13px] text-d-text-sub mb-[10px] font-medium">{formatDate(entry.date)}</Text>
      <View className="flex-row gap-2">
        <View className="bg-d-surface-raised rounded-[8px] px-[10px] py-[5px]">
          <Text className="text-[12px] text-d-text-sub font-medium">{entry.partySize} {entry.partySize === 1 ? "guest" : "guests"}</Text>
        </View>
      </View>
      <TouchableOpacity className="mt-[14px] border-[1.5px] border-d-danger/60 rounded-[10px] py-[10px] items-center bg-d-danger-bg" onPress={onLeave} activeOpacity={0.8}>
        <Text className="text-d-danger text-[13px] font-semibold">Leave Waitlist</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ tab }: { tab: ActiveTab }) {
  const cfg = {
    upcoming: { emoji: "🗓", title: "No upcoming bookings", sub: "Reserve a table to get started" },
    past:     { emoji: "◷",  title: "No past bookings",    sub: "Your dining history will appear here" },
    waitlists:{ emoji: "⏳", title: "No active waitlists", sub: "Join a waitlist when your preferred slot is full" },
  }[tab];
  return (
    <View className="items-center pt-16">
      <Text className="text-[48px] mb-[14px]">{cfg.emoji}</Text>
      <Text className="text-[17px] font-bold text-d-text mb-[6px]">{cfg.title}</Text>
      <Text className="text-[14px] text-d-text-dim text-center px-8 leading-5">{cfg.sub}</Text>
    </View>
  );
}

export default function ReservationsScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("upcoming");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = async (uid: string) => {
    const [{ data: resData }, { data: wlData }] = await Promise.all([
      supabase.from("Reservation")
        .select("*, restaurant:Restaurant(*), table:Table(*)")
        .eq("dinerId", uid).order("date", { ascending: true }),
      supabase.from("Waitlist")
        .select("*, restaurant:Restaurant(*)")
        .eq("dinerId", uid),
    ]);
    setReservations(resData ?? []);
    setWaitlists(wlData ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setUserId(user.id); await fetchData(user.id); }
      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const upcoming = reservations.filter(
    (r) => new Date(r.date) >= now && r.status !== "cancelled" && r.status !== "completed"
  );
  const past = reservations.filter(
    (r) => new Date(r.date) < now || r.status === "completed" || r.status === "cancelled"
  );

  const handleCancel = async (id: string) => {
    await cancelReservation(id);
    if (userId) await fetchData(userId);
  };
  const handleLeaveWaitlist = async (id: string) => {
    await supabase.from("Waitlist").delete().eq("id", id);
    if (userId) await fetchData(userId);
  };

  const TABS: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "upcoming",  label: "Upcoming",  count: upcoming.length },
    { key: "past",      label: "Past" },
    { key: "waitlists", label: "Waitlists", count: waitlists.length },
  ];

  const listData = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : [];

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={["top"]}>
      {/* Header */}
      <View className="px-[22px] pt-5 pb-[6px]">
        <Text className="text-[30px] font-bold text-d-text tracking-[-0.5px]">My Bookings</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-[22px] py-[14px] gap-[8px]">
        {TABS.map(({ key, label, count }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              className={`flex-row items-center px-[14px] py-[8px] rounded-full border gap-[5px] ${active ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.75}
            >
              <Text className={`text-[13px] font-medium ${active ? "text-white font-semibold" : "text-d-text-sub"}`}>{label}</Text>
              {count !== undefined && count > 0 && (
                <View className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${active ? "bg-white/25" : "bg-d-border"}`}>
                  <Text className={`text-[10px] font-bold ${active ? "text-white" : "text-d-text-sub"}`}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "waitlists" ? (
        <FlatList
          data={waitlists}
          keyExtractor={(i) => i.id}
          contentContainerClassName="px-5 pb-8 gap-3"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState tab="waitlists" />}
          renderItem={({ item }) => (
            <WaitlistCard entry={item} onLeave={() => handleLeaveWaitlist(item.id)} />
          )}
        />
      ) : (
        <FlatList
          data={loading ? [] : listData}
          keyExtractor={(i) => i.id}
          contentContainerClassName="px-5 pb-8 gap-3"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={loading ? null : <EmptyState tab={activeTab} />}
          renderItem={({ item }) => (
            <ReservationCard
              reservation={item}
              showCancel={activeTab === "upcoming"}
              onCancel={() => handleCancel(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
