import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { D, CuisinePalette } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.42);  // hero takes top 42% of screen

// ─────────────────────────────────────────────────────────────────────────────
//  UI MAP — where to find / edit each visual section
// ─────────────────────────────────────────────────────────────────────────────
//
//  AtmosphericBackground  (line ~48)
//    └─ The green gradient glow behind everything. Edit colors/intensity here.
//       Three stacked LinearGradients: vertical up-light, horizontal centering,
//       bright core spotlight.
//
//  HERO SECTION  (hero — inside DiscoverScreen's FlatList ListHeaderComponent)
//    ├─ Greeting text       → heroGreeting   (font size, color, spacing)
//    ├─ Headline            → heroHeadline   (big display text, 44px bold)
//    └─ Search bar          → heroSearch / heroSearchFocused
//                             (frosted glass look — rgba bg + teal border)
//
//  CUISINE FILTER CHIPS  (chip / chipActive)
//    └─ Horizontal scroll row of cuisine pills below the hero.
//       Edit CUISINES array to change which filters appear.
//
//  TONIGHT'S PICK (FeaturedCard)
//    └─ Full-width 260px photo card — first restaurant in filtered list.
//       CoverArt component generates the visual background (SVG circles).
//       Text overlay: featuredName, featuredSub, featuredAvail.
//
//  MORE PLACES GRID (GridCard)
//    └─ 2-column grid of remaining restaurants.
//       Photo area: 110px. Info below: gridName, gridCuisine, gridAvail.
//
//  STATES
//    ├─ Loading  → SkeletonPulse components (pulsing grey placeholders)
//    ├─ Error    → errorCard  (connection problem card with Retry button)
//    └─ Empty    → emptyWrap  (no results message)
//
// ─────────────────────────────────────────────────────────────────────────────

const CUISINES = ["All", "Filipino", "Japanese", "Italian", "Chinese", "Western", "Korean", "French"];

const CUISINE_EMOJI: Record<string, string> = {
  Filipino: "🍚", Japanese: "🍣", Italian: "🍝", Chinese: "🥢",
  Western: "🥩", Korean: "🍜", French: "🥐", Indian: "🍛",
  Mediterranean: "🫒", default: "🍽️",
};

const AVAIL = ["3 tables", "Available", "2 slots open", "Book tonight", "Last table", "5 openings"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getHeadline(): string {
  const h = new Date().getHours();
  if (h < 12) return "Starting your\nday right?";
  if (h < 17) return "What's good\ntonight?";
  return "Ready for\na great meal?";
}

// ── Atmospheric background — smooth gradient like the reference (not circles) ───
function AtmosphericBackground() {
  return (
    <View className="absolute inset-0" pointerEvents="none">
      {/* Layer 1: vertical up-lighting from bottom — creates the "floor glow" */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(10,52,38,0.54)",
          "rgba(13,72,52,0.68)",
          "rgba(8,30,20,0.44)",
        ]}
        locations={[0.05, 0.48, 0.68, 1.0]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        className="absolute inset-0"
      />
      {/* Layer 2: horizontal centering — concentrates glow toward center */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(16,88,64,0.42)",
          "transparent",
        ]}
        locations={[0.0, 0.5, 1.0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: "absolute",
          top: SCREEN_H * 0.28,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Layer 3: bright core spotlight — the "light source" */}
      <LinearGradient
        colors={[
          "rgba(20,115,84,0.48)",
          "rgba(12,65,48,0.22)",
          "transparent",
        ]}
        locations={[0.0, 0.55, 1.0]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{
          position: "absolute",
          bottom: 0,
          left: SCREEN_W * 0.05,
          right: SCREEN_W * 0.05,
          height: SCREEN_H * 0.55,
        }}
      />
    </View>
  );
}

// ── SVG cover art ─────────────────────────────────────────────────────────────
function CoverArt({ cuisine, height, width }: { cuisine: string; height: number; width: number }) {
  const key = cuisine in CuisinePalette ? cuisine : "default";
  const { bg, mid } = CuisinePalette[key];
  return (
    <View style={{ height, backgroundColor: bg }} className="w-full">
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Circle cx={width * 0.80} cy={height * 0.28} r={height * 0.72} fill={mid}      opacity={0.52} />
        <Circle cx={width * 0.10} cy={height * 0.80} r={height * 0.55} fill={mid}      opacity={0.32} />
        <Ellipse cx={width * 0.50} cy={height}       rx={width * 0.55}  ry={height * 0.30} fill={D.accent} opacity={0.14} />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text style={{ fontSize: height * 0.28, opacity: 0.35 }}>{CUISINE_EMOJI[cuisine] ?? "🍽️"}</Text>
      </View>
    </View>
  );
}

// ── Glowing dot (live availability indicator) ─────────────────────────────────
function GlowDot({ size = 7 }: { size?: number }) {
  return (
    <View style={{ width: size * 2.2, height: size * 2.2, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: D.accent, opacity: 0.28 }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: D.accent }} />
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonPulse({ w, h, r = 10 }: { w: number | string; h: number; r?: number }) {
  const opacity = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.18, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: D.surfaceRaised, opacity }} />;
}

// ── Featured card — photo-style, text overlay at bottom ───────────────────────
function FeaturedCard({ restaurant, idx }: { restaurant: Restaurant; idx: number }) {
  const router = useRouter();
  const avail = AVAIL[idx % AVAIL.length];
  const rating = (4.2 + (idx % 4) * 0.15).toFixed(1);
  const cardW = SCREEN_W - 40;

  return (
    <TouchableOpacity
      className="mx-5 rounded-[16px] overflow-hidden bg-d-surface"
      activeOpacity={0.90}
      onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
    >
      {/* Cover art fills entire card */}
      <View className="h-[260px] overflow-hidden">
        <CoverArt cuisine={restaurant.cuisine} height={260} width={cardW} />

        {/* Two-step overlay: mid-transparent → dark at bottom */}
        <View className="absolute bottom-[80px] left-0 right-0 h-[80px] bg-[rgba(8,15,13,0.35)]" />
        <View className="absolute bottom-0 left-0 right-0 h-[110px] bg-[rgba(8,15,13,0.82)]" />

        {/* Content pinned to bottom */}
        <View className="absolute bottom-0 left-0 right-0 px-[18px] pb-[18px] pt-3">
          <View className="flex-row items-center gap-[6px] mb-2">
            <GlowDot />
            <Text className="text-[12px] text-d-accent font-semibold">{avail}</Text>
            <View className="flex-1" />
            <View className="rounded-[10px] px-2 py-[3px] border bg-[rgba(30,207,172,0.14)] border-[rgba(30,207,172,0.25)]">
              <Text className="text-[12px] text-d-accent font-bold">★ {rating}</Text>
            </View>
          </View>
          <Text className="text-[22px] font-bold text-d-text mb-1 tracking-[-0.5px]" numberOfLines={1}>{restaurant.name}</Text>
          <Text className="text-[13px] text-d-text-sub" numberOfLines={1}>
            {restaurant.cuisine}{restaurant.address ? ` · ${restaurant.address}` : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Grid card — photo at top, info below ──────────────────────────────────────
function GridCard({ restaurant, idx }: { restaurant: Restaurant; idx: number }) {
  const router = useRouter();
  const avail = AVAIL[(idx + 2) % AVAIL.length];
  const rating = (4.0 + (idx % 5) * 0.16).toFixed(1);
  const cardW = (SCREEN_W - 52) / 2;

  return (
    <TouchableOpacity
      className="flex-1 bg-d-surface rounded-[14px] overflow-hidden border border-d-border"
      activeOpacity={0.88}
      onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
    >
      {/* Photo area */}
      <View className="h-[110px] overflow-hidden">
        <CoverArt cuisine={restaurant.cuisine} height={110} width={cardW} />
        <View className="absolute bottom-0 left-0 right-0 h-[40px] bg-[rgba(8,15,13,0.55)]" />
      </View>

      {/* Info area */}
      <View className="p-3">
        <Text className="text-[14px] font-bold text-d-text mb-[3px] tracking-[-0.1px]" numberOfLines={1}>{restaurant.name}</Text>
        <Text className="text-[11px] text-d-text-sub mb-2">{restaurant.cuisine}</Text>
        <View className="flex-row items-center gap-[5px]">
          <GlowDot size={5} />
          <Text className="text-[11px] text-d-accent font-semibold flex-1">{avail}</Text>
          <Text className="text-[11px] text-d-text-sub font-semibold">★ {rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled && user) {
          const { data: profile } = await supabase
            .from("Profile").select("name").eq("id", user.id).single();
          if (!cancelled && profile?.name) setUserName(profile.name);
        }
        const { data, error: fetchErr } = await supabase
          .from("Restaurant").select("*").order("createdAt", { ascending: false });
        if (fetchErr) throw fetchErr;
        if (!cancelled) setRestaurants(data ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retryCount]);

  const filtered = restaurants.filter((r) => {
    const cuisineOk = selectedCuisine === "All" ||
      r.cuisine?.toLowerCase() === selectedCuisine.toLowerCase();
    const searchOk = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.cuisine ?? "").toLowerCase().includes(search.toLowerCase());
    return cuisineOk && searchOk;
  });

  const firstName = userName ? userName.split(" ")[0] : "";
  const featured = filtered[0];
  const grid = filtered.slice(1);

  return (
    <View className="flex-1 bg-d-bg">
      <AtmosphericBackground />
      <SafeAreaView className="flex-1 bg-transparent" edges={["top"]}>
      <FlatList
        data={loading || error ? [] : grid}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 20, gap: 12, marginBottom: 12 }}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        ListHeaderComponent={
          <>
            {/* ═══ HERO SECTION — gradient shows through from AtmosphericBackground ═ */}
            <View
              style={{ height: HERO_H }}
              className="overflow-hidden bg-transparent px-[22px] pt-[14px] justify-start"
            >
              {/* Small greeting — sits at the very top, understated */}
              <Text className="text-[14px] font-medium text-d-text-sub tracking-[0.1px] mb-[10px]">
                {getGreeting()}{firstName ? `, ${firstName}` : ""}
              </Text>

              {/* Large display headline — bold, white, owns the space */}
              <Text className="text-[44px] font-bold text-d-text mb-6 tracking-[-1.6px] leading-[50px]">{getHeadline()}</Text>

              {/* Frosted glass search bar — floats in the gradient */}
              <View
                className={`flex-row items-center rounded-[14px] px-4 py-[14px] gap-[10px] border ${
                  searchFocused
                    ? "bg-[rgba(14,60,50,0.72)] border-[rgba(30,207,172,0.50)]"
                    : "bg-[rgba(14,60,50,0.58)] border-[rgba(30,207,172,0.22)]"
                }`}
              >
                <Text className="text-[18px] text-[rgba(228,239,232,0.55)]">⌕</Text>
                <TextInput
                  className="flex-1 text-[15px] text-d-text p-0"
                  placeholder="Search restaurants…"
                  placeholderTextColor="rgba(228, 239, 232, 0.38)"
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Text className="text-[16px] text-[rgba(228,239,232,0.45)]">✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ═══ CONTENT SECTION — dark base begins here ════════════════════ */}

            {/* Cuisine filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pt-5 pb-[22px] gap-2"
            >
              {CUISINES.map((c) => {
                const active = selectedCuisine === c;
                return (
                  <TouchableOpacity
                    key={c}
                    className={`px-4 py-2 rounded-full border ${active ? "bg-d-accent border-d-accent" : "bg-d-surface-raised border-d-border"}`}
                    onPress={() => setSelectedCuisine(c)}
                    activeOpacity={0.75}
                  >
                    <Text className={`text-[13px] font-medium ${active ? "text-d-bg font-bold" : "text-d-text-sub"}`}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Loading ── */}
            {loading ? (
              <View className="px-5 pt-1">
                <SkeletonPulse w={SCREEN_W - 40} h={260} r={16} />
                <View className="h-5" />
                <View className="flex-row px-5 gap-3 mb-3">
                  <SkeletonPulse w={(SCREEN_W - 52) / 2} h={195} r={14} />
                  <SkeletonPulse w={(SCREEN_W - 52) / 2} h={195} r={14} />
                </View>
              </View>

            /* ── Error ── */
            ) : error ? (
              <View className="mx-5 mt-4 items-center py-12 bg-d-surface rounded-[16px] border border-d-border">
                <Text className="text-[34px] text-d-warning mb-3">⚠</Text>
                <Text className="text-[16px] font-bold text-d-text mb-1">Connection problem</Text>
                <Text className="text-[13px] text-d-text-sub">Check your Wi-Fi and try again</Text>
                <TouchableOpacity
                  className="mt-5 bg-d-accent rounded-[10px] px-7 py-3"
                  style={{
                    shadowColor: D.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                  onPress={() => setRetryCount(c => c + 1)}
                  activeOpacity={0.82}
                >
                  <Text className="text-[14px] font-bold text-d-bg">Retry</Text>
                </TouchableOpacity>
              </View>

            /* ── No results ── */
            ) : filtered.length === 0 ? (
              <View className="mx-5 mt-4 items-center py-12">
                <Text className="text-[16px] font-bold text-d-text-sub mb-1">No restaurants found</Text>
                <Text className="text-[13px] text-d-text-dim text-center">Try a different filter</Text>
              </View>

            /* ── Content ── */
            ) : (
              <>
                {/* Section label */}
                <View className="flex-row items-center gap-[10px] px-5 mb-3">
                  <Text className="text-[10px] text-d-accent font-bold tracking-[1.8px] uppercase">TONIGHT'S PICK</Text>
                </View>

                {/* Featured card — full width, photo style */}
                {featured && <FeaturedCard restaurant={featured} idx={0} />}

                {/* Grid section header */}
                {grid.length > 0 && (
                  <View className="flex-row items-center gap-[10px] px-5 mb-3 mt-[26px]">
                    <Text className="text-[18px] font-bold text-d-text tracking-[-0.3px]">More Places</Text>
                    <View className="w-6 h-6 rounded-full bg-d-surface-raised border border-d-border items-center justify-center">
                      <Text className="text-[11px] font-bold text-d-text-sub">{grid.length}</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        }
        ListEmptyComponent={null}
        renderItem={({ item, index }) => <GridCard restaurant={item} idx={index} />}
      />
      </SafeAreaView>
    </View>
  );
}
