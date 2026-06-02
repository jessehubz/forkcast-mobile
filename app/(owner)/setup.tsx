import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Restaurant, Table } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupTab = "Info" | "Tables";

interface LocalTable extends Omit<Table, "id"> {
  id: string; // local or db id
  isNew?: boolean;
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({
  restaurant,
  onSaved,
}: {
  restaurant: Restaurant | null;
  onSaved: (r: Restaurant) => void;
}) {
  const [name, setName] = useState(restaurant?.name ?? "");
  const [description, setDescription] = useState(restaurant?.description ?? "");
  const [address, setAddress] = useState(restaurant?.address ?? "");
  const [cuisine, setCuisine] = useState(restaurant?.cuisine ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name ?? "");
      setDescription(restaurant.description ?? "");
      setAddress(restaurant.address ?? "");
      setCuisine(restaurant.cuisine ?? "");
    }
  }, [restaurant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        ownerId: user.id,
        name,
        description,
        address,
        cuisine,
        ...(restaurant?.id ? { id: restaurant.id } : {}),
      };

      const { data, error } = await supabase
        .from("Restaurant")
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      Alert.alert("Saved", "Restaurant info updated.");
      if (data) onSaved(data as Restaurant);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, multi?: boolean) => (
    <View className="mb-4" key={label}>
      <Text className="text-[12px] font-semibold text-d-text-sub mb-1.5 tracking-[0.3px] uppercase">{label}</Text>
      <TextInput
        className={`bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text${multi ? " h-[100px]" : ""}`}
        style={multi ? { textAlignVertical: "top" } : undefined}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Colors.creamDim}
        placeholder={label}
        multiline={multi}
        numberOfLines={multi ? 4 : 1}
      />
    </View>
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pb-5" showsVerticalScrollIndicator={false}>
      {field("Restaurant Name", name, setName)}
      {field("Description", description, setDescription, true)}
      {field("Address", address, setAddress)}
      {field("Cuisine Type", cuisine, setCuisine)}

      <TouchableOpacity className="bg-d-accent rounded-[12px] py-3.5 items-center mt-2" onPress={handleSave} disabled={saving} activeOpacity={0.85}>
        {saving ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Text className="text-[15px] font-semibold text-white">Save Info</Text>
        )}
      </TouchableOpacity>
      <View className="h-10" />
    </ScrollView>
  );
}

// ─── Tables Tab ───────────────────────────────────────────────────────────────

const CANVAS_HEIGHT = 300;
const TABLE_RADIUS = 24;

function TablesTab({ restaurantId }: { restaurantId: string | null }) {
  const [tables, setTables] = useState<LocalTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(320);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editLabel, setEditLabel] = useState("");
  const [editSeats, setEditSeats] = useState(2);
  const dragActive = useRef<string | null>(null);
  const tablePositions = useRef<Record<string, { x: number; y: number }>>({});

  // Load existing tables
  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("Table").select("*").eq("restaurantId", restaurantId);
      const loaded: LocalTable[] = (data ?? []).map((t: any) => ({ ...t }));
      setTables(loaded);
      loaded.forEach((t) => { tablePositions.current[t.id] = { x: t.x, y: t.y }; });
      setLoading(false);
    })();
  }, [restaurantId]);

  const selectedTable = tables.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedTable) {
      setEditLabel(selectedTable.label);
      setEditSeats(selectedTable.seats);
    }
  }, [selectedId]);

  const addTable = () => {
    const id = `new_${Date.now()}`;
    const t: LocalTable = { id, restaurantId: restaurantId ?? "", label: `T${tables.length + 1}`, seats: 2, x: 50, y: 50, isNew: true };
    setTables((prev) => [...prev, t]);
    tablePositions.current[id] = { x: 50, y: 50 };
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<LocalTable>) => {
    if (!selectedId) return;
    setTables((prev) => prev.map((t) => t.id === selectedId ? { ...t, ...patch } : t));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    Alert.alert("Delete Table", "Remove this table?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          setTables((prev) => prev.filter((t) => t.id !== selectedId));
          delete tablePositions.current[selectedId];
          setSelectedId(null);
        }
      },
    ]);
  };

  const handleSaveLayout = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      // Sync drag positions
      const synced = tables.map((t) => {
        const pos = tablePositions.current[t.id];
        return { ...t, x: pos?.x ?? t.x, y: pos?.y ?? t.y };
      });

      // Delete existing
      await supabase.from("Table").delete().eq("restaurantId", restaurantId);

      // Re-create all
      const inserts = synced.map(({ id, isNew, ...rest }) => ({
        restaurantId,
        label: rest.label,
        seats: rest.seats,
        x: rest.x,
        y: rest.y,
      }));

      if (inserts.length > 0) {
        const { data, error } = await supabase.from("Table").insert(inserts).select();
        if (error) throw error;
        const reloaded: LocalTable[] = (data ?? []).map((t: any) => ({ ...t }));
        setTables(reloaded);
        reloaded.forEach((t) => { tablePositions.current[t.id] = { x: t.x, y: t.y }; });
        setSelectedId(null);
      } else {
        setTables([]);
      }

      Alert.alert("Saved", "Floor layout saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Build PanResponders per table
  const panResponders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({}).current;

  const getPanResponder = (tableId: string) => {
    if (panResponders[tableId]) return panResponders[tableId];

    const pr = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragActive.current = tableId;
        setSelectedId(tableId);
      },
      onPanResponderMove: (_, gs) => {
        const pos = tablePositions.current[tableId];
        if (!pos) return;
        const dx = (gs.dx / canvasWidth) * 100;
        const dy = (gs.dy / CANVAS_HEIGHT) * 100;
        const newX = Math.max(5, Math.min(95, pos.x + dx));
        const newY = Math.max(5, Math.min(95, pos.y + dy));
        tablePositions.current[tableId] = { x: newX, y: newY };
        // Force re-render by updating tables array
        setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, x: newX, y: newY } : t));
      },
      onPanResponderRelease: (_, gs) => {
        dragActive.current = null;
      },
    });

    panResponders[tableId] = pr;
    return pr;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={Colors.maroonLight} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pb-5" showsVerticalScrollIndicator={false}>
      {/* Canvas */}
      <View
        className="w-full bg-d-surface-raised rounded-[16px] border border-d-border overflow-hidden mb-3.5"
        style={{ height: CANVAS_HEIGHT }}
        onLayout={(e) => setCanvasWidth(e.nativeEvent.layout.width)}
      >
        <Svg width={canvasWidth} height={CANVAS_HEIGHT} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {tables.map((table) => {
            const cx = (table.x / 100) * canvasWidth;
            const cy = (table.y / 100) * CANVAS_HEIGHT;
            const isSelected = table.id === selectedId;
            return (
              <Circle
                key={`c_${table.id}`}
                cx={cx}
                cy={cy}
                r={TABLE_RADIUS}
                fill={isSelected ? Colors.maroon : Colors.border}
                stroke={isSelected ? Colors.maroonLight : Colors.border}
                strokeWidth={2}
                opacity={0.9}
              />
            );
          })}
          {tables.map((table) => {
            const cx = (table.x / 100) * canvasWidth;
            const cy = (table.y / 100) * CANVAS_HEIGHT;
            return (
              <SvgText
                key={`l_${table.id}`}
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill={isSelected ? Colors.white : Colors.cream}
                fontSize={11}
                fontWeight="600"
              >
                {table.label}
              </SvgText>
            );
          })}
        </Svg>

        {/* Invisible drag responders positioned over each table */}
        {tables.map((table) => {
          const cx = (table.x / 100) * canvasWidth;
          const cy = (table.y / 100) * CANVAS_HEIGHT;
          const pr = getPanResponder(table.id);
          return (
            <View
              key={`drag_${table.id}`}
              style={[
                { position: "absolute", backgroundColor: "transparent" },
                {
                  left: cx - TABLE_RADIUS,
                  top: cy - TABLE_RADIUS,
                  width: TABLE_RADIUS * 2,
                  height: TABLE_RADIUS * 2,
                  borderRadius: TABLE_RADIUS,
                },
              ]}
              {...pr.panHandlers}
            />
          );
        })}
      </View>

      {/* Add Table */}
      <TouchableOpacity className="border border-d-border rounded-[12px] border-dashed py-3 items-center mb-4" onPress={addTable} activeOpacity={0.8}>
        <Text className="text-[14px] text-d-text-sub font-medium">+ Add Table</Text>
      </TouchableOpacity>

      {/* Edit Panel */}
      {selectedTable && (
        <View className="bg-d-surface border border-d-border rounded-[14px] p-4 mb-4">
          <Text className="text-[14px] font-bold text-d-text mb-3.5">Edit Table</Text>

          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-d-text-sub mb-1.5 tracking-[0.3px] uppercase">Label</Text>
            <TextInput
              className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
              value={editLabel}
              onChangeText={(v) => { setEditLabel(v); updateSelected({ label: v }); }}
              placeholderTextColor={Colors.creamDim}
              placeholder="e.g. T1"
            />
          </View>

          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-d-text-sub mb-1.5 tracking-[0.3px] uppercase">Seats</Text>
            <View className="flex-row items-center gap-4">
              <TouchableOpacity
                className="w-9 h-9 bg-d-surface-raised border border-d-border rounded-[8px] items-center justify-center"
                onPress={() => { const v = Math.max(1, editSeats - 1); setEditSeats(v); updateSelected({ seats: v }); }}
              >
                <Text className="text-[20px] text-d-text leading-[22px]">−</Text>
              </TouchableOpacity>
              <Text className="text-[18px] font-bold text-d-text min-w-[32px] text-center">{editSeats}</Text>
              <TouchableOpacity
                className="w-9 h-9 bg-d-surface-raised border border-d-border rounded-[8px] items-center justify-center"
                onPress={() => { const v = editSeats + 1; setEditSeats(v); updateSelected({ seats: v }); }}
              >
                <Text className="text-[20px] text-d-text leading-[22px]">+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            className="mt-3 py-2.5 items-center border rounded-[10px]"
            style={{ borderColor: Colors.danger + "66", backgroundColor: "#3D101033" }}
            onPress={deleteSelected}
            activeOpacity={0.8}
          >
            <Text className="text-[13px] text-d-danger font-semibold">Delete Table</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Save Layout */}
      <TouchableOpacity className="bg-d-accent rounded-[12px] py-3.5 items-center mt-2" onPress={handleSaveLayout} disabled={saving} activeOpacity={0.85}>
        {saving ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Text className="text-[15px] font-semibold text-white">Save Layout</Text>
        )}
      </TouchableOpacity>

      <View className="h-10" />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const [activeTab, setActiveTab] = useState<SetupTab>("Info");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("Restaurant").select("*").eq("ownerId", user.id).single();
      setRestaurant(data ?? null);
      setLoading(false);
    })();
  }, []);

  const TABS: SetupTab[] = ["Info", "Tables"];

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
        <Text className="text-[28px] font-bold text-d-text">Setup</Text>
        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
          <Text className="text-[15px] text-d-danger font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Tab selector */}
      <View className="flex-row px-5 gap-2 mb-4">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`px-5 py-2.5 rounded-[20px] border ${activeTab === tab ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text className={`text-[14px] ${activeTab === tab ? "text-white font-semibold" : "text-d-text-sub font-medium"}`}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.maroonLight} size="large" />
        </View>
      ) : activeTab === "Info" ? (
        <InfoTab restaurant={restaurant} onSaved={setRestaurant} />
      ) : (
        <TablesTab restaurantId={restaurant?.id ?? null} />
      )}
    </SafeAreaView>
  );
}
