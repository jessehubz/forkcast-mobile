import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Table } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get("window").width;
const MAP_WIDTH = SCREEN_WIDTH - 40;
const MAP_HEIGHT = 260;
const TABLE_RADIUS = 22;

const TIME_SLOTS = [
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDayButtons(): { label: string; shortLabel: string; date: Date }[] {
  const now = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(12, 0, 0, 0);
    let label: string;
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tmrw";
    else label = d.toLocaleDateString("en-US", { weekday: "short" });
    const shortLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { label, shortLabel, date: d };
  });
}

function parseTimeSlot(baseDate: Date, slot: string): Date {
  const d = new Date(baseDate);
  const [time, ampm] = slot.split(" ");
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddReservationScreen() {
  const router = useRouter();

  // Form state
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"approved" | "pending">("approved");

  // Date/time
  const dayButtons = buildDayButtons();
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[4]);

  // Table selection
  const [tables, setTables] = useState<Table[]>([]);
  const [bookedTableIds, setBookedTableIds] = useState<Set<string>>(new Set());
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [anyTable, setAnyTable] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Derived datetime
  const selectedDate = dayButtons[selectedDayIdx].date;
  const dateTime = parseTimeSlot(selectedDate, selectedTime).toISOString();

  // ─── Load tables when date/time change ───────────────────────────────────

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setSelectedTableId(null);
    setAnyTable(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rest } = await supabase
        .from("Restaurant")
        .select("id")
        .eq("ownerId", user.id)
        .single();
      if (!rest) return;

      // Fetch all active tables
      const { data: tblData } = await supabase
        .from("Table")
        .select("*")
        .eq("restaurantId", rest.id);

      // Fetch booked table IDs for a ±2h window around the selected slot
      const slotStart = new Date(dateTime);
      slotStart.setHours(slotStart.getHours() - 2);
      const slotEnd = new Date(dateTime);
      slotEnd.setHours(slotEnd.getHours() + 2);

      const { data: resData } = await supabase
        .from("Reservation")
        .select("tableId")
        .eq("restaurantId", rest.id)
        .not("status", "in", '("cancelled","completed","no_show")')
        .gte("date", slotStart.toISOString())
        .lte("date", slotEnd.toISOString());

      setTables(tblData ?? []);
      setBookedTableIds(new Set((resData ?? []).map((r: any) => r.tableId)));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load tables.");
    } finally {
      setTablesLoading(false);
    }
  }, [dateTime]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      Alert.alert("Guest name required", "Please enter the guest's name.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: rest } = await supabase
        .from("Restaurant")
        .select("id")
        .eq("ownerId", user.id)
        .single();
      if (!rest) throw new Error("Restaurant not found.");

      // Resolve tableId
      let tableId = selectedTableId;
      if (anyTable || !tableId) {
        const available = tables.filter((t) => !bookedTableIds.has(t.id));
        if (available.length === 0) {
          Alert.alert("No tables available", "All tables are booked for this slot.");
          setSubmitting(false);
          return;
        }
        tableId = available[0].id;
      }

      // Insert reservation — use owner's id as dinerId for phone bookings
      const { error } = await supabase.from("Reservation").insert({
        restaurantId: rest.id,
        tableId,
        dinerId: user.id,
        dinerName: guestName.trim(),
        partySize,
        date: dateTime,
        status,
        depositAmount: 0,
        depositPaid: false,
        ownerNotes: notes.trim() || null,
      });

      if (error) throw error;

      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center px-4 pt-3 pb-2 gap-2.5">
            <TouchableOpacity onPress={() => router.back()} className="p-1" activeOpacity={0.7}>
              <Text className="text-[24px] text-d-text leading-[28px]">←</Text>
            </TouchableOpacity>
            <Text className="text-[20px] font-bold text-d-text">New Reservation</Text>
          </View>

          {/* ── Guest Name ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Guest Name</Text>
            <TextInput
              className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3.5 text-[15px] text-d-text"
              value={guestName}
              onChangeText={setGuestName}
              placeholder="e.g. Maria Santos"
              placeholderTextColor={Colors.creamDim}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          {/* ── Party Size ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Party Size</Text>
            <View className="flex-row items-center gap-6">
              <TouchableOpacity
                className={`w-11 h-11 rounded-[22px] bg-d-surface-raised border border-d-border items-center justify-center${partySize <= 1 ? " opacity-35" : ""}`}
                onPress={() => setPartySize((p) => Math.max(1, p - 1))}
                disabled={partySize <= 1}
                activeOpacity={0.8}
              >
                <Text className="text-[22px] text-d-text leading-[26px]">−</Text>
              </TouchableOpacity>
              <Text className="text-[28px] font-bold text-d-text min-w-[40px] text-center">{partySize}</Text>
              <TouchableOpacity
                className={`w-11 h-11 rounded-[22px] bg-d-surface-raised border border-d-border items-center justify-center${partySize >= 20 ? " opacity-35" : ""}`}
                onPress={() => setPartySize((p) => Math.min(20, p + 1))}
                disabled={partySize >= 20}
                activeOpacity={0.8}
              >
                <Text className="text-[22px] text-d-text leading-[26px]">+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Date ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 gap-2"
              className="-mx-5"
            >
              {dayButtons.map((btn, idx) => {
                const active = idx === selectedDayIdx;
                return (
                  <TouchableOpacity
                    key={idx}
                    className={`rounded-[12px] px-3.5 py-2.5 items-center min-w-[70px] border ${active ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
                    onPress={() => setSelectedDayIdx(idx)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-bold ${active ? "text-white" : "text-d-text-sub"}`}>
                      {btn.label}
                    </Text>
                    <Text className={`text-[11px] mt-0.5 ${active ? "text-white opacity-80" : "text-d-text-dim"}`}>
                      {btn.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Time ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Time</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 gap-2"
              className="-mx-5"
            >
              {TIME_SLOTS.map((slot) => {
                const active = slot === selectedTime;
                return (
                  <TouchableOpacity
                    key={slot}
                    className={`rounded-[20px] px-3.5 py-2 border ${active ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
                    onPress={() => setSelectedTime(slot)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] ${active ? "text-white font-semibold" : "text-d-text-sub font-medium"}`}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Select Table (SVG floor map) ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Select Table</Text>

            {tablesLoading ? (
              <View className="h-[120px] items-center justify-center bg-d-surface-raised rounded-[14px] border border-d-border mb-2.5">
                <ActivityIndicator color={Colors.maroonLight} />
              </View>
            ) : tables.length === 0 ? (
              <View className="h-[120px] items-center justify-center bg-d-surface-raised rounded-[14px] border border-d-border mb-2.5">
                <Text className="text-[14px] text-d-text-dim">No tables configured yet.</Text>
              </View>
            ) : (
              <View
                className="bg-d-surface-raised rounded-[14px] border border-d-border overflow-hidden mb-2.5"
                style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
              >
                <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
                  {tables.map((table) => {
                    const cx = (table.x / 100) * MAP_WIDTH;
                    const cy = (table.y / 100) * MAP_HEIGHT;
                    const isBooked = bookedTableIds.has(table.id);
                    const isSelected = selectedTableId === table.id;

                    let fillColor: string;
                    let strokeColor: string;
                    let textColor: string;

                    if (isSelected) {
                      fillColor = Colors.maroon;
                      strokeColor = Colors.maroonLight;
                      textColor = Colors.white;
                    } else if (isBooked) {
                      fillColor = Colors.surfaceRaised;
                      strokeColor = Colors.danger;
                      textColor = Colors.danger;
                    } else {
                      fillColor = Colors.surfaceRaised;
                      strokeColor = Colors.success;
                      textColor = Colors.success;
                    }

                    return (
                      <G
                        key={table.id}
                        onPress={
                          isBooked
                            ? undefined
                            : () => {
                                setSelectedTableId(table.id);
                                setAnyTable(false);
                              }
                        }
                      >
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={TABLE_RADIUS}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={2}
                          opacity={isBooked ? 0.5 : 1}
                        />
                        <SvgText
                          x={cx}
                          y={cy - 2}
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={11}
                          fontWeight="700"
                          fill={textColor}
                        >
                          {table.label}
                        </SvgText>
                        <SvgText
                          x={cx}
                          y={cy + 11}
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fontSize={9}
                          fill={isSelected ? Colors.cream : Colors.creamDim}
                        >
                          {table.seats}p
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
            )}

            {/* Legend */}
            <View className="flex-row items-center gap-1.5 mb-3">
              <View
                className="w-3.5 h-3.5 rounded-[7px] border-2 bg-d-surface-raised"
                style={{ borderColor: Colors.success }}
              />
              <Text className="text-[11px] text-d-text-dim mr-2">Available</Text>
              <View
                className="w-3.5 h-3.5 rounded-[7px] border-2 bg-d-surface-raised"
                style={{ borderColor: Colors.danger }}
              />
              <Text className="text-[11px] text-d-text-dim mr-2">Taken</Text>
              <View
                className="w-3.5 h-3.5 rounded-[7px] border-2"
                style={{ backgroundColor: Colors.maroon, borderColor: Colors.maroonLight }}
              />
              <Text className="text-[11px] text-d-text-dim mr-2">Selected</Text>
            </View>

            {/* Any table option */}
            <TouchableOpacity
              className="flex-row items-center gap-2.5 py-2"
              onPress={() => {
                setAnyTable(true);
                setSelectedTableId(null);
              }}
              activeOpacity={0.7}
            >
              <View
                className={`w-[18px] h-[18px] rounded-[9px] border-2 ${anyTable ? "bg-d-accent border-d-accent" : "border-d-text-dim bg-transparent"}`}
              />
              <Text className="text-[14px] text-d-text-sub font-medium">Any available table</Text>
            </TouchableOpacity>
          </View>

          {/* ── Notes ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Notes</Text>
            <TextInput
              className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[14px] text-d-text min-h-[96px]"
              style={{ textAlignVertical: "top" }}
              value={notes}
              onChangeText={setNotes}
              placeholder="Allergies, special occasion, seating preferences..."
              placeholderTextColor={Colors.creamDim}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* ── Status ── */}
          <View className="px-5 mb-6">
            <Text className="text-[12px] font-semibold text-d-text-sub uppercase tracking-[0.5px] mb-2.5">Status</Text>
            <View className="flex-row gap-2.5">
              {(["approved", "pending"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  className={`px-5 py-2.5 rounded-[20px] border ${status === s ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
                  onPress={() => setStatus(s)}
                  activeOpacity={0.8}
                >
                  <Text className={`text-[14px] font-semibold ${status === s ? "text-white" : "text-d-text-sub"}`}>
                    {s === "approved" ? "Approved" : "Pending"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            className={`mx-5 mt-2 bg-d-accent rounded-[14px] py-4 items-center justify-center min-h-[52px]${submitting ? " opacity-50" : ""}`}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text className="text-[16px] font-bold text-white">Create Reservation</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
