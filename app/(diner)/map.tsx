import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/types";

// Only import map-related modules on native
let MapView: any = null;
let Marker: any = null;
let Location: any = null;

if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require("expo-location");
}

const CUISINES = ["All", "Filipino", "Japanese", "Italian", "Chinese", "Western", "Korean"];

const MANILA_REGION = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a0a0c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a0a0c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7A6059" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2E1418" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a0a0c" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3D1B20" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#2E1418" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0D0507" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#160A0C" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1F0E11" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2E1418" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#5C1019" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#7A6059" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#160A0C" }] },
];

function getMarkerCoord(restaurant: Restaurant, index: number) {
  if (restaurant.lat != null && restaurant.lng != null) {
    return { latitude: restaurant.lat, longitude: restaurant.lng };
  }
  return {
    latitude: MANILA_REGION.latitude + (index % 5) * 0.012 - 0.024,
    longitude: MANILA_REGION.longitude + (Math.floor(index / 5)) * 0.014 - 0.028,
  };
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(200)).current;

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web" && Location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      }

      const { data } = await supabase.from("Restaurant").select("*");
      setRestaurants(data ?? []);
    })();
  }, []);

  const filteredRestaurants = restaurants.filter((r) =>
    selectedCuisine === "All" ||
    r.cuisine?.toLowerCase() === selectedCuisine.toLowerCase()
  );

  const handleMarkerPress = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: 200,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSelectedRestaurant(null));
  };

  const handleNearMe = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 500);
  };

  if (Platform.OS === "web") {
    return (
      <SafeAreaView className="flex-1 bg-d-bg" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-d-text-sub text-[16px]">Map is not available on web.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={['top']}>
      <View className="flex-1">
        {/* Map */}
        <MapView
          ref={mapRef}
          className="flex-1"
          initialRegion={MANILA_REGION}
          customMapStyle={DARK_MAP_STYLE}
          showsUserLocation={!!userLocation}
          onPress={selectedRestaurant ? handleDismiss : undefined}
        >
          {filteredRestaurants.map((restaurant, index) => (
            <Marker
              key={restaurant.id}
              coordinate={getMarkerCoord(restaurant, index)}
              onPress={() => handleMarkerPress(restaurant)}
            >
              <View className="w-9 h-9 rounded-[18px] bg-d-accent items-center justify-center border-2" style={{ borderColor: Colors.maroonLight }}>
                <Text className="text-[16px]">🍴</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Cuisine filter bar */}
        <View className="absolute top-4 left-0 right-0 z-10">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 gap-2"
          >
            {CUISINES.map((cuisine) => {
              const active = selectedCuisine === cuisine;
              return (
                <TouchableOpacity
                  key={cuisine}
                  className={`px-3.5 py-2 rounded-[20px] border ${active ? "bg-d-accent border-d-accent" : "bg-d-surface border-d-border"}`}
                  onPress={() => setSelectedCuisine(cuisine)}
                  activeOpacity={0.75}
                >
                  <Text className={`text-[13px] font-medium ${active ? "text-white" : "text-d-text-sub"}`}>
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Near Me button */}
        <TouchableOpacity
          className="absolute top-[68px] right-4 z-10 bg-d-accent px-3.5 py-[9px] rounded-[20px]"
          onPress={handleNearMe}
          activeOpacity={0.85}
        >
          <Text className="text-white text-[13px] font-semibold">Near Me</Text>
        </TouchableOpacity>

        {/* Selected restaurant card */}
        {selectedRestaurant && (
          <Animated.View
            className="absolute bottom-0 left-0 right-0 bg-d-surface rounded-tl-[20px] rounded-tr-[20px] border-t border-d-border p-5 pb-8"
            style={{ transform: [{ translateY: slideAnim }] }}
          >
            <TouchableOpacity className="absolute top-3.5 right-[18px] w-7 h-7 items-center justify-center" onPress={handleDismiss}>
              <Text className="text-[22px] text-d-text-dim leading-[26px]">×</Text>
            </TouchableOpacity>

            <Text className="text-[20px] font-bold text-d-text mb-2 pr-8">{selectedRestaurant.name}</Text>
            <View className="flex-row items-center mb-2">
              <View className="bg-d-border rounded-[20px] px-2.5 py-[3px]">
                <Text className="text-[12px] text-d-text-sub font-medium">{selectedRestaurant.cuisine}</Text>
              </View>
            </View>
            <Text className="text-[13px] text-d-text-dim mb-4" numberOfLines={2}>
              {selectedRestaurant.address}
            </Text>
            <TouchableOpacity
              className="bg-d-accent rounded-[12px] py-3.5 items-center"
              activeOpacity={0.85}
              onPress={() => {
                handleDismiss();
                router.push(`/restaurant/${selectedRestaurant.id}` as any);
              }}
            >
              <Text className="text-white text-[15px] font-bold">Reserve a Table</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}
