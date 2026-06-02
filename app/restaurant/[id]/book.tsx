import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { D, Shadow } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { getAvailableTables, calculateDeposit, createReservation } from "@/lib/api";
import type { Table } from "@/lib/types";

const SCREEN_W = Dimensions.get("window").width;
const MAP_W = SCREEN_W - 40;
const MAP_H = 260;

type Step = 1 | 2 | 3;

function buildDayButtons(): { label: string; date: Date; dayOfWeek: string }[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(12, 0, 0, 0);
    const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short" });
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayOfWeek;
    return { label, date: d, dayOfWeek };
  });
}

const TIME_SLOTS = [
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM",
  "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM",
  "8:00 PM", "9:00 PM", "10:00 PM",
];

const OCCASIONS = ["Birthday", "Anniversary", "Business", "Date Night", "Celebration", "Casual"];

function parseTimeSlot(date: Date, slot: string): Date {
  const d = new Date(date);
  const [time, ampm] = slot.split(" ");
  const [hs, ms] = time.split(":");
  let hour = parseInt(hs, 10);
  const minute = parseInt(ms, 10);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const labels = ["Date & Time", "Choose Table", "Confirm"];
  return (
    <View className="flex-row px-5 py-4 items-center">
      {labels.map((label, i) => {
        const num = (i + 1) as Step;
        const done = num < step;
        const active = num === step;
        return (
          <View key={i} className="flex-row items-center flex-1">
            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
              done
                ? "bg-d-accent border-d-accent"
                : active
                ? "bg-d-bg border-d-accent"
                : "bg-d-bg border-d-border"
            }`}>
              {done ? (
                <Text className="text-[11px] font-bold text-white">✓</Text>
              ) : (
                <Text className={`text-[10px] font-bold ${active ? "text-d-accent" : "text-d-text-dim"}`}>
                  {num}
                </Text>
              )}
            </View>
            <Text className={`text-[10px] font-medium ml-[5px] shrink ${active ? "text-d-text font-bold" : "text-d-text-dim"}`}>
              {label}
            </Text>
            {i < labels.length - 1 && (
              <View className={`flex-1 h-px mx-1 ${done ? "bg-d-accent" : "bg-d-border"}`} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function BookScreen() {
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const dayButtons = buildDayButtons();
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[5]);
  const [partySize, setPartySize] = useState(2);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);

  const [tables, setTables] = useState<Table[]>([]);
  const [bookedIds, setBookedIds] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [anyTable, setAnyTable] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [fetchingTables, setFetchingTables] = useState(false);

  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");

  useEffect(() => {
    supabase.from("Restaurant").select("name").eq("id", restaurantId).single()
      .then(({ data }) => { if (data?.name) setRestaurantName(data.name); });
  }, [restaurantId]);

  const selectedDate = dayButtons[selectedDayIdx].date;
  const dateTime = parseTimeSlot(selectedDate, selectedTime).toISOString();
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  const handleFindTables = useCallback(async () => {
    setFetchingTables(true);
    setSelectedTableId(null);
    setAnyTable(false);
    try {
      const [availability, { count: tableCount }] = await Promise.all([
        getAvailableTables(restaurantId, dateTime),
        supabase.from("Table").select("*", { count: "exact", head: true }).eq("restaurantId", restaurantId),
      ]);
      const deposit = await calculateDeposit(restaurantId, dateTime, tableCount ?? 1);
      setTables(availability.tables);
      setBookedIds(availability.bookedIds);
      setDepositAmount(deposit);
      setStep(2);
    } catch {
      Alert.alert("Error", "Could not load available tables. Please try again.");
    } finally {
      setFetchingTables(false);
    }
  }, [restaurantId, dateTime]);

  const handleConfirm = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }
    const { data: profile } = await supabase
      .from("Profile").select("name").eq("id", user.id).single();

    let tableId = selectedTableId;
    if (anyTable || !tableId) {
      const available = tables.filter((t) => !bookedIds.includes(t.id));
      if (available.length === 0) {
        Alert.alert("No tables", "No available tables for this slot.");
        return;
      }
      tableId = available[0].id;
    }
    if (!tableId) {
      Alert.alert("Select a table", "Please select a table to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const reservation = await createReservation({
        restaurantId,
        tableId,
        dinerId: user.id,
        dinerName: profile?.name ?? user.email ?? "Guest",
        partySize,
        date: dateTime,
        depositAmount,
        dinerNotes: [
          selectedOccasion && `Occasion: ${selectedOccasion}`,
          specialRequests.trim(),
        ].filter(Boolean).join(". ") || undefined,
      });
      if (reservation) {
        router.replace(`/reservation/${reservation.id}`);
      }
    } catch (err: any) {
      Alert.alert("Booking failed", err?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [restaurantId, selectedTableId, anyTable, tables, bookedIds, partySize, dateTime, depositAmount, specialRequests, selectedOccasion]);

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-2 gap-[10px]">
        <TouchableOpacity
          onPress={() => step > 1 ? setStep((step - 1) as Step) : router.back()}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-[12px] bg-d-surface-raised items-center justify-center"
        >
          <Text className="text-[24px] text-d-text leading-7 -mt-0.5">‹</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[17px] font-bold text-d-text tracking-[-0.2px]">
            {step === 1 ? "Date & Time" : step === 2 ? "Choose Table" : "Confirm Booking"}
          </Text>
          <Text className="text-[12px] text-d-text-sub mt-[1px]">{restaurantName}</Text>
        </View>
      </View>

      {/* Step bar */}
      <StepBar step={step} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 1: Date, Time, Party ── */}
        {step === 1 && (
          <View className="px-5 pt-2">
            {/* Date chips */}
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3">Date</Text>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              className="-mx-5"
              contentContainerClassName="px-5 gap-2"
            >
              {dayButtons.map((btn, idx) => {
                const active = idx === selectedDayIdx;
                return (
                  <TouchableOpacity
                    key={idx}
                    className={`border rounded-[14px] px-4 py-[10px] items-center min-w-[76px] ${
                      active
                        ? "bg-d-accent border-d-accent"
                        : "bg-d-surface-raised border-d-border"
                    }`}
                    onPress={() => setSelectedDayIdx(idx)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-bold mb-[2px] ${active ? "text-white" : "text-d-text-sub"}`}>
                      {btn.label}
                    </Text>
                    <Text className={`text-[11px] ${active ? "text-white/75" : "text-d-text-dim"}`}>
                      {btn.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time grid */}
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3 mt-6">Time</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => {
                const active = slot === selectedTime;
                return (
                  <TouchableOpacity
                    key={slot}
                    className={`border rounded-[10px] px-3 py-2 ${
                      active ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"
                    }`}
                    onPress={() => setSelectedTime(slot)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-medium ${active ? "text-white font-semibold" : "text-d-text-sub"}`}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Party size */}
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3 mt-6">Party Size</Text>
            <View className="flex-row items-center bg-d-surface-raised rounded-[16px] border border-d-border p-[6px] self-start">
              <TouchableOpacity
                className={`w-11 h-11 rounded-[12px] bg-d-bg border border-d-border items-center justify-center ${partySize <= 1 ? "opacity-35" : ""}`}
                onPress={() => setPartySize((p) => Math.max(1, p - 1))}
                disabled={partySize <= 1}
                activeOpacity={0.8}
              >
                <Text className="text-[22px] text-d-text leading-7">−</Text>
              </TouchableOpacity>
              <View className="items-center px-6">
                <Text className="text-[32px] font-bold text-d-text tracking-[-1px]">{partySize}</Text>
                <Text className="text-[11px] text-d-text-dim font-medium">{partySize === 1 ? "guest" : "guests"}</Text>
              </View>
              <TouchableOpacity
                className={`w-11 h-11 rounded-[12px] bg-d-bg border border-d-border items-center justify-center ${partySize >= 10 ? "opacity-35" : ""}`}
                onPress={() => setPartySize((p) => Math.min(10, p + 1))}
                disabled={partySize >= 10}
                activeOpacity={0.8}
              >
                <Text className="text-[22px] text-d-text leading-7">+</Text>
              </TouchableOpacity>
            </View>

            {/* Occasion */}
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3 mt-6">
              Occasion <Text className="font-medium normal-case text-d-text-dim">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {OCCASIONS.map((occ) => {
                const active = selectedOccasion === occ;
                return (
                  <TouchableOpacity
                    key={occ}
                    className={`border rounded-full px-[14px] py-2 ${
                      active ? "bg-d-accent-light border-d-accent" : "bg-d-surface-raised border-d-border"
                    }`}
                    onPress={() => setSelectedOccasion(active ? null : occ)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[13px] font-medium ${active ? "text-d-accent font-bold" : "text-d-text-sub"}`}>
                      {occ}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              className={`bg-d-accent rounded-[16px] py-[17px] items-center justify-center mt-6 min-h-[56px] ${fetchingTables ? "opacity-40" : ""}`}
              style={{
                shadowColor: D.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 5,
              }}
              onPress={handleFindTables}
              disabled={fetchingTables}
              activeOpacity={0.88}
            >
              {fetchingTables ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[16px] font-bold text-white">Find Available Tables</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Floor Map ── */}
        {step === 2 && (
          <View className="px-5 pt-2">
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3">Floor Plan</Text>
            <View className="rounded-[14px] overflow-hidden border border-d-border mb-[14px]">
              <Svg width={MAP_W} height={MAP_H}>
                <Rect x={0} y={0} width={MAP_W} height={MAP_H}
                  fill={D.surfaceRaised} stroke={D.border} strokeWidth={1.5} rx={12} />
                {/* Subtle grid */}
                {[MAP_W / 3, MAP_W * 2 / 3].map((x, i) => (
                  <Rect key={i} x={x} y={16} width={0.5} height={MAP_H - 32} fill={D.border} opacity={0.5} />
                ))}
                {[MAP_H / 3, MAP_H * 2 / 3].map((y, i) => (
                  <Rect key={i} x={16} y={y} width={MAP_W - 32} height={0.5} fill={D.border} opacity={0.5} />
                ))}
                {tables.map((table) => {
                  const cx = (table.x / 100) * MAP_W;
                  const cy = (table.y / 100) * MAP_H;
                  const isBooked = bookedIds.includes(table.id);
                  const isSelected = selectedTableId === table.id;

                  let fill: string = D.bg;
                  let stroke: string = D.success;
                  let textColor: string = D.success;

                  if (isBooked) {
                    fill = D.surfaceRaised;
                    stroke = D.textDim;
                    textColor = D.textDim;
                  } else if (isSelected) {
                    fill = D.accent;
                    stroke = D.accentMid;
                    textColor = "#FFFFFF";
                  }

                  return (
                    <G
                      key={table.id}
                      onPress={isBooked ? undefined : () => {
                        setSelectedTableId(table.id);
                        setAnyTable(false);
                      }}
                    >
                      <Circle cx={cx} cy={cy} r={26} fill={fill} stroke={stroke} strokeWidth={2} />
                      <SvgText
                        x={cx} y={cy - 3}
                        textAnchor="middle" alignmentBaseline="middle"
                        fontSize={11} fontWeight="700" fill={textColor}
                      >
                        {table.label}
                      </SvgText>
                      <SvgText
                        x={cx} y={cy + 11}
                        textAnchor="middle" alignmentBaseline="middle"
                        fontSize={8}
                        fill={isBooked ? D.textDim : isSelected ? "rgba(255,255,255,0.8)" : D.textSub}
                      >
                        {table.seats}p
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>

            {/* Map legend */}
            <View className="flex-row gap-[14px] mb-4">
              <View className="flex-row items-center gap-[5px]">
                <View className="w-[14px] h-[14px] rounded-full border-2 bg-d-bg" style={{ borderColor: D.success }} />
                <Text className="text-[11px] text-d-text-dim">Available</Text>
              </View>
              <View className="flex-row items-center gap-[5px]">
                <View className="w-[14px] h-[14px] rounded-full border-2 bg-d-bg" style={{ borderColor: D.textDim }} />
                <Text className="text-[11px] text-d-text-dim">Taken</Text>
              </View>
              <View className="flex-row items-center gap-[5px]">
                <View className="w-[14px] h-[14px] rounded-full border-2" style={{ backgroundColor: D.accent, borderColor: D.accentMid }} />
                <Text className="text-[11px] text-d-text-dim">Selected</Text>
              </View>
            </View>

            {/* Any table option */}
            <TouchableOpacity
              className={`flex-row items-center gap-3 p-[14px] rounded-[14px] border mb-2 ${
                anyTable ? "bg-d-accent-light border-d-accent" : "bg-d-surface-raised border-d-border"
              }`}
              onPress={() => { setAnyTable(true); setSelectedTableId(null); }}
              activeOpacity={0.8}
            >
              <View className={`w-5 h-5 rounded-full border-2 bg-d-bg items-center justify-center ${anyTable ? "border-d-accent" : "border-d-text-dim"}`}>
                {anyTable && <View className="w-[10px] h-[10px] rounded-full bg-d-accent" />}
              </View>
              <View>
                <Text className="text-[14px] font-semibold text-d-text">Best available table</Text>
                <Text className="text-[12px] text-d-text-sub mt-[1px]">We'll pick the best spot for your party</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className={`bg-d-accent rounded-[16px] py-[17px] items-center justify-center mt-6 min-h-[56px] ${(!selectedTableId && !anyTable) ? "opacity-40" : ""}`}
              style={{
                shadowColor: D.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 5,
              }}
              onPress={() => setStep(3)}
              disabled={!selectedTableId && !anyTable}
              activeOpacity={0.88}
            >
              <Text className="text-[16px] font-bold text-white">Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <View className="px-5 pt-2">
            {/* Summary card */}
            <View className="bg-d-surface rounded-[18px] border border-d-border p-5" style={Shadow.md}>
              <Text className="text-[20px] font-bold text-d-text mb-[14px] tracking-[-0.3px]">
                {restaurantName}
              </Text>
              <View className="h-px bg-d-border my-3" />
              {[
                { label: "Date", value: dayButtons[selectedDayIdx].date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) },
                { label: "Time", value: selectedTime },
                { label: "Guests", value: `${partySize} ${partySize === 1 ? "guest" : "guests"}` },
                { label: "Table", value: anyTable ? "Best available" : (selectedTable?.label ?? "—") },
                ...(selectedOccasion ? [{ label: "Occasion", value: selectedOccasion }] : []),
              ].map(({ label, value }) => (
                <View key={label} className="flex-row justify-between items-center mb-2">
                  <Text className="text-[13px] text-d-text-sub font-medium">{label}</Text>
                  <Text className="text-[13px] font-semibold text-d-text flex-1 text-right ml-3">{value}</Text>
                </View>
              ))}
              {depositAmount > 0 && (
                <>
                  <View className="h-px bg-d-border my-3" />
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[13px] font-medium text-d-warning">Deposit Required</Text>
                    <Text className="text-[18px] font-bold text-d-accent flex-1 text-right ml-3">
                      ₱{depositAmount}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Special requests */}
            <Text className="text-[11px] font-bold text-d-text-sub uppercase tracking-[0.8px] mb-3 mt-6">
              Special Requests <Text className="font-medium normal-case text-d-text-dim">(optional)</Text>
            </Text>
            <TextInput
              className="bg-d-surface-raised border border-d-border rounded-[14px] px-[14px] py-3 text-[14px] text-d-text min-h-[88px]"
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Allergies, seating preferences, celebrations…"
              placeholderTextColor={D.textDim}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {depositAmount > 0 && (
              <View className="flex-row items-start gap-2 bg-d-warning-bg rounded-[12px] p-3 mt-[14px]" style={{ borderLeftWidth: 3, borderLeftColor: D.warning }}>
                <Text className="text-[14px] text-d-warning">ⓘ</Text>
                <Text className="text-[12px] text-d-text-sub flex-1 leading-[18px]">
                  A ₱{depositAmount} deposit is required for this time slot and will be collected at the restaurant.
                </Text>
              </View>
            )}

            <TouchableOpacity
              className={`bg-d-accent rounded-[16px] py-[17px] items-center justify-center mt-7 min-h-[56px] ${submitting ? "opacity-40" : ""}`}
              style={{
                shadowColor: D.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 5,
              }}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[16px] font-bold text-white">Confirm Reservation</Text>
              )}
            </TouchableOpacity>

            <Text className="text-center text-[12px] text-d-text-dim mt-[14px]">
              Free cancellation up to 24h before your reservation
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
