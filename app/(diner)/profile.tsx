import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { D, Shadow } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type MenuItem = { icon: string; label: string; sublabel?: string; onPress: () => void; danger?: boolean };

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reservationCount, setReservationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profileData }, { count }] = await Promise.all([
          supabase.from("Profile").select("*").eq("id", user.id).single(),
          supabase.from("Reservation")
            .select("*", { count: "exact", head: true })
            .eq("dinerId", user.id).eq("status", "completed"),
        ]);
        if (profileData) setProfile(profileData as Profile);
        setReservationCount(count ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const noShowCount = profile?.noShowCount ?? 0;
  const displayName = profile?.name ?? "Guest";
  const displayEmail = profile?.email ?? "";

  const menuGroups: { title?: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        { icon: "✎", label: "Edit Profile", sublabel: "Name, photo, preferences", onPress: () => router.push("/settings" as any) },
        { icon: "⊞", label: "Notifications",sublabel: "Reservations, reminders",  onPress: () => router.push("/settings" as any) },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "?", label: "Help Center",  sublabel: "FAQs and contact",          onPress: () => {} },
        { icon: "⎋", label: "Sign Out",     danger: true,                          onPress: handleSignOut },
      ],
    },
  ];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-d-bg-warm" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-d-text-dim text-[15px]">Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-d-bg-warm" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-[22px] pt-5 pb-1">
          <Text className="text-[30px] font-bold text-d-text tracking-[-0.5px]">Profile</Text>
        </View>

        {/* No-show warning */}
        {noShowCount >= 2 && (
          <View className="flex-row items-start gap-3 bg-d-warning-bg border border-d-warning/40 rounded-[14px] mx-5 mt-4 p-[14px]">
            <View className="w-7 h-7 rounded-full bg-d-warning/30 items-center justify-center mt-[1px]">
              <Text className="text-[14px] font-extrabold text-d-warning">!</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-d-warning mb-[3px]">Reliability Notice</Text>
              <Text className="text-[13px] text-d-text-sub leading-[18px]">
                You have {noShowCount} no-show{noShowCount > 1 ? "s" : ""} on record.
                Future reservations may require a deposit.
              </Text>
            </View>
          </View>
        )}

        {/* Avatar section */}
        <View className="items-center pt-7 pb-6">
          <View className="w-[88px] h-[88px] rounded-full border-2 border-d-accent/40 items-center justify-center mb-[14px]">
            <View className="w-[76px] h-[76px] rounded-full bg-d-accent-light items-center justify-center">
              <Text className="text-[26px] font-bold text-d-accent">{getInitials(displayName)}</Text>
            </View>
          </View>
          <Text className="text-[22px] font-bold text-d-text tracking-[-0.3px] mb-1">{displayName}</Text>
          <Text className="text-[14px] text-d-text-sub">{displayEmail}</Text>
        </View>

        {/* Stats */}
        <View className="flex-row mx-5 mb-7 bg-d-surface rounded-[16px] border border-d-border overflow-hidden" style={Shadow.sm}>
          <View className="flex-1 items-center py-[18px]">
            <Text className="text-[26px] font-bold text-d-text tracking-[-0.5px] mb-[3px]">{reservationCount}</Text>
            <Text className="text-[11px] text-d-text-dim font-semibold uppercase tracking-[0.3px]">Meals</Text>
          </View>
          <View className="w-px bg-d-border my-4" />
          <View className="flex-1 items-center py-[18px]">
            <Text
              className="text-[26px] font-bold text-d-text tracking-[-0.5px] mb-[3px]"
              style={noShowCount > 0 ? { color: D.danger } : undefined}
            >
              {noShowCount}
            </Text>
            <Text className="text-[11px] text-d-text-dim font-semibold uppercase tracking-[0.3px]">No-shows</Text>
          </View>
          <View className="w-px bg-d-border my-4" />
          <View className="flex-1 items-center py-[18px]">
            <Text className="text-[26px] font-bold text-d-text tracking-[-0.5px] mb-[3px]">{Math.max(0, reservationCount - noShowCount)}</Text>
            <Text className="text-[11px] text-d-text-dim font-semibold uppercase tracking-[0.3px]">On-time</Text>
          </View>
        </View>

        {/* Menu groups */}
        {menuGroups.map(({ title, items }) => (
          <View key={title} className="mb-5">
            {title && <Text className="text-[11px] font-bold text-d-text-dim uppercase tracking-[0.8px] px-7 mb-2">{title}</Text>}
            <View className="mx-5 bg-d-surface rounded-[16px] border border-d-border overflow-hidden" style={Shadow.sm}>
              {items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  className={`flex-row items-center py-[14px] px-4 gap-3 ${idx < items.length - 1 ? "border-b border-d-border" : ""}`}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View className={`w-[34px] h-[34px] rounded-[10px] items-center justify-center ${item.danger ? "bg-d-danger-bg" : "bg-d-surface-raised"}`}>
                    <Text className="text-[16px]" style={{ color: item.danger ? D.danger : D.text }}>{item.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-[15px] font-semibold ${item.danger ? "text-d-danger" : "text-d-text"}`}>{item.label}</Text>
                    {item.sublabel && <Text className="text-[12px] text-d-text-dim mt-[1px]">{item.sublabel}</Text>}
                  </View>
                  {!item.danger && <Text className="text-[20px] text-d-text-dim leading-6">›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text className="text-center text-[12px] text-d-text-dim mt-2">Forkcast v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
