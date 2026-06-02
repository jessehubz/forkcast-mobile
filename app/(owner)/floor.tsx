import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";
import { O } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Reservation, Restaurant, Table } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TableStatus = "open" | "reserved" | "seated" | "flagged";

interface TableWithStatus extends Table {
  status: TableStatus;
  reservation?: Reservation;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TableStatus, string> = {
  open:     "#5A9EE8",
  reserved: "#C9922A",
  seated:   "#4A8FC0",
  flagged:  "#E05050",
};

const STATUS_LABEL: Record<TableStatus, string> = {
  open:     "Open",
  reserved: "Reserved",
  seated:   "Seated",
  flagged:  "No-Show Risk",
};

const STATUS_BG: Record<TableStatus, string> = {
  open:     "#162438",
  reserved: "#2A1C08",
  seated:   "#0F1E2E",
  flagged:  "#2C1818",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTableStatus(table: Table, reservations: Reservation[]): { status: TableStatus; reservation?: Reservation } {
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const ago15 = new Date(now.getTime() - 15 * 60 * 1000);

  const relevant = reservations.filter(
    (r) => r.tableId === table.id && !["cancelled", "completed", "no_show"].includes(r.status)
  );

  for (const res of relevant) {
    if (res.status === "seated") return { status: "seated", reservation: res };
  }
  for (const res of relevant) {
    const d = new Date(res.date);
    if ((res.status === "confirmed" || res.status === "approved") &&
      d <= ago15 && d >= new Date(now.getTime() - 4 * 60 * 60 * 1000)) {
      return { status: "flagged", reservation: res };
    }
  }
  for (const res of relevant) {
    const d = new Date(res.date);
    if ((res.status === "confirmed" || res.status === "approved") && d >= now && d <= in2h) {
      return { status: "reserved", reservation: res };
    }
  }
  return { status: "open" };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ─── Pulsing overlay for flagged tables ───────────────────────────────────────

function PulsingRing({ cx, cy, r, onPress }: { cx: number; cy: number; r: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 10 },
        { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r },
      ]}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
          { borderRadius: r, backgroundColor: STATUS_COLOR.flagged, opacity: anim },
        ]}
      />
    </TouchableOpacity>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

function TableModal({
  visible, table, onClose, onRefresh,
}: { visible: boolean; table: TableWithStatus | null; onClose: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const res = table?.reservation;

  const updateStatus = async (status: string) => {
    if (!res) return;
    setLoading(true);
    try {
      await supabase.from("Reservation").update({ status }).eq("id", res.id);
      if (status === "no_show") {
        const { data: profile } = await supabase
          .from("Profile").select("noShowCount").eq("id", res.dinerId).single();
        await supabase.from("Profile")
          .update({ noShowCount: ((profile?.noShowCount ?? 0) + 1) })
          .eq("id", res.dinerId);
      }
      onRefresh();
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update.");
    } finally {
      setLoading(false);
    }
  };

  if (!table) return null;
  const statusColor = STATUS_COLOR[table.status];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/75 justify-end">
        <View className="bg-o-surface rounded-tl-[28px] rounded-tr-[28px] border border-o-border px-5 pt-3 pb-9">
          {/* Handle */}
          <View className="w-9 h-1 rounded-[2px] bg-o-border self-center mb-4" />

          {/* Header */}
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-[22px] font-bold text-o-text tracking-[-0.3px] mb-1.5">Table {table.label}</Text>
              <View
                className="flex-row items-center gap-[5px] px-2.5 py-1 rounded-[8px] self-start"
                style={{ backgroundColor: STATUS_BG[table.status] }}
              >
                <View
                  className="w-1.5 h-1.5 rounded-[3px]"
                  style={{ backgroundColor: statusColor }}
                />
                <Text className="text-[12px] font-bold" style={{ color: statusColor }}>{STATUS_LABEL[table.status]}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-[10px] bg-o-surface-high items-center justify-center" activeOpacity={0.7}>
              <Text className="text-[14px] text-o-text-sub">✕</Text>
            </TouchableOpacity>
          </View>

          {res ? (
            <>
              <View className="bg-o-bg-surface rounded-[14px] p-4 border border-o-border mb-4">
                <Text className="text-[18px] font-bold text-o-text mb-1">{res.dinerName}</Text>
                <Text className="text-[13px] text-o-text-sub">{res.partySize} guests · {formatTime(res.date)}</Text>
                {res.dinerNotes && <Text className="text-[12px] text-o-text-dim italic mt-1.5">"{res.dinerNotes}"</Text>}
              </View>

              <View className="gap-2">
                <TouchableOpacity
                  className="rounded-[14px] py-[15px] items-center border"
                  style={{ backgroundColor: O.accentWarm, borderColor: O.accent + "40" }}
                  onPress={() => updateStatus("seated")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text className="text-[15px] font-bold text-o-accent">Mark Seated</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="rounded-[14px] py-[15px] items-center border bg-o-surface-high border-o-border"
                  onPress={() => updateStatus("completed")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text className="text-[15px] font-bold text-o-text-sub">Mark Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="rounded-[14px] py-[15px] items-center border bg-o-danger-bg"
                  style={{ borderColor: O.danger + "40" }}
                  onPress={() => updateStatus("no_show")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text className="text-[15px] font-bold text-o-danger">Mark No-Show</Text>
                </TouchableOpacity>
              </View>

              {loading && <ActivityIndicator color={O.accent} className="mt-3" />}
            </>
          ) : (
            <Text className="text-[14px] text-o-text-dim text-center py-5">No active reservation for this table.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const MAP_W = 340;
const MAP_H = 280;
const TABLE_R = 24;

export default function FloorScreen() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<TableWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableWithStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const channelRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rest } = await supabase
      .from("Restaurant").select("*").eq("ownerId", user.id).single();
    if (!rest) { setLoading(false); return; }
    setRestaurant(rest);

    const [{ data: tblData }, { data: resData }] = await Promise.all([
      supabase.from("Table").select("*").eq("restaurantId", rest.id),
      supabase.from("Reservation")
        .select("*, table:Table(*)")
        .eq("restaurantId", rest.id)
        .gte("date", new Date(Date.now() - 4 * 3600 * 1000).toISOString())
        .lte("date", new Date(Date.now() + 3 * 3600 * 1000).toISOString()),
    ]);

    const reservations: Reservation[] = resData ?? [];
    setTables(
      (tblData ?? []).map((t: Table) => {
        const { status, reservation } = getTableStatus(t, reservations);
        return { ...t, status, reservation };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rest } = await supabase
        .from("Restaurant").select("id").eq("ownerId", user.id).single();
      if (!rest) return;
      const channel = supabase
        .channel(`floor_${rest.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "Reservation", filter: `restaurantId=eq.${rest.id}` }, () => loadData())
        .subscribe();
      channelRef.current = channel;
    };
    subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={O.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Status summary counts
  const counts = (Object.keys(STATUS_COLOR) as TableStatus[]).map((st) => ({
    status: st,
    count: tables.filter((t) => t.status === st).length,
  }));

  return (
    <SafeAreaView className="flex-1 bg-o-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="pb-12 items-center" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="w-full flex-row items-start justify-between px-[22px] pt-5 pb-4">
          <View>
            <Text className="text-[13px] text-o-text-sub font-medium mb-0.5">{restaurant?.name ?? ""}</Text>
            <Text className="text-[30px] font-bold text-o-text tracking-[-0.5px]">Floor Map</Text>
          </View>
          <TouchableOpacity
            className="bg-o-accent rounded-[12px] px-3.5 py-[9px] mt-1.5"
            onPress={() => router.push("/owner/add-reservation" as any)}
            activeOpacity={0.85}
          >
            <Text className="text-[13px] font-bold text-white">+  Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary row */}
        <View className="flex-row gap-2 px-5 mb-5 self-stretch">
          {counts.map(({ status, count }) => (
            <View
              key={status}
              className="flex-1 bg-o-surface border rounded-[12px] py-3 items-center"
              style={{ borderColor: STATUS_COLOR[status] + "30" }}
            >
              <Text className="text-[22px] font-bold tracking-[-0.5px]" style={{ color: STATUS_COLOR[status] }}>{count}</Text>
              <Text className="text-[9px] text-o-text-dim font-semibold uppercase tracking-[0.3px] mt-0.5 text-center">{STATUS_LABEL[status]}</Text>
            </View>
          ))}
        </View>

        {/* SVG Floor Map */}
        <View style={{ width: MAP_W + 8 }}>
          {/* Map legend */}
          <View className="flex-row flex-wrap gap-2.5 px-1 mb-2.5">
            {(Object.keys(STATUS_COLOR) as TableStatus[]).map((st) => (
              <View key={st} className="flex-row items-center gap-[5px]">
                <View className="w-2 h-2 rounded-[4px]" style={{ backgroundColor: STATUS_COLOR[st] }} />
                <Text className="text-[11px] text-o-text-sub font-medium">{STATUS_LABEL[st]}</Text>
              </View>
            ))}
          </View>

          {/* Map */}
          <View
            className="rounded-[14px] overflow-hidden border border-o-border"
            style={{ width: MAP_W, height: MAP_H }}
          >
            <Svg width={MAP_W} height={MAP_H}>
              {/* Floor outline */}
              <Rect
                x={2} y={2}
                width={MAP_W - 4} height={MAP_H - 4}
                fill={O.bgSurface}
                stroke={O.border}
                strokeWidth={1.5}
                rx={12}
              />
              {/* Grid lines */}
              {[80, 160, 240].map((x) => (
                <Rect key={`vl${x}`} x={x} y={16} width={0.5} height={MAP_H - 32}
                  fill={O.border} opacity={0.4} />
              ))}
              {[70, 140, 210].map((y) => (
                <Rect key={`hl${y}`} x={16} y={y} width={MAP_W - 32} height={0.5}
                  fill={O.border} opacity={0.4} />
              ))}

              {/* Tables */}
              {tables.map((table) => {
                if (table.status === "flagged") return null; // rendered as pulsing overlay
                const cx = (table.x / 100) * MAP_W;
                const cy = (table.y / 100) * MAP_H;
                const col = STATUS_COLOR[table.status];

                return (
                  <React.Fragment key={table.id}>
                    <Circle
                      cx={cx} cy={cy} r={TABLE_R}
                      fill={STATUS_BG[table.status]}
                      stroke={col}
                      strokeWidth={1.5}
                      onPress={() => {
                        setSelectedTable(table);
                        setModalVisible(true);
                      }}
                    />
                    <SvgText
                      x={cx} y={cy - 2}
                      textAnchor="middle" alignmentBaseline="middle"
                      fontSize={11} fontWeight="700" fill={col}
                      onPress={() => {
                        setSelectedTable(table);
                        setModalVisible(true);
                      }}
                    >
                      {table.label}
                    </SvgText>
                    <SvgText
                      x={cx} y={cy + 12}
                      textAnchor="middle" alignmentBaseline="middle"
                      fontSize={8} fill={col} opacity={0.7}
                    >
                      {table.seats}p
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Pulsing flagged overlays */}
            {tables
              .filter((t) => t.status === "flagged")
              .map((table) => {
                const cx = (table.x / 100) * MAP_W;
                const cy = (table.y / 100) * MAP_H;
                return (
                  <PulsingRing
                    key={`pulse_${table.id}`}
                    cx={cx} cy={cy} r={TABLE_R}
                    onPress={() => {
                      setSelectedTable(table);
                      setModalVisible(true);
                    }}
                  />
                );
              })}
          </View>
        </View>
      </ScrollView>

      {/* Action Modal */}
      <TableModal
        visible={modalVisible}
        table={selectedTable}
        onClose={() => setModalVisible(false)}
        onRefresh={loadData}
      />
    </SafeAreaView>
  );
}
