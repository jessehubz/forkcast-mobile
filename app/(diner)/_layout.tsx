import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { D } from "@/constants/theme";

// Text-based icons — crisp on all densities, no image assets needed
const TAB_ICONS: Record<string, string> = {
  index:        "⌂",
  map:          "◎",
  reservations: "▦",
  profile:      "◉",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View className="items-center justify-center w-8 h-7">
      <Text style={{ fontSize: 18, lineHeight: 22, color: focused ? D.accent : D.textDim }}>
        {TAB_ICONS[name] ?? "●"}
      </Text>
      {focused && <View className="w-[18px] h-[3px] rounded-sm bg-d-accent mt-[3px]" />}
    </View>
  );
}

export default function DinerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: D.surface,
          borderTopColor: D.borderLight,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: D.accent,
        tabBarInactiveTintColor: D.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: "Bookings",
          tabBarIcon: ({ focused }) => <TabIcon name="reservations" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
