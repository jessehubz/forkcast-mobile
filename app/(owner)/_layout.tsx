import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { O } from "@/constants/theme";

const ICONS: Record<string, string> = {
  dashboard:    "⊞",
  floor:        "⬡",
  reservations: "▦",
  insights:     "▣",
  setup:        "⊙",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View className="items-center justify-center w-8 h-7">
      <Text style={{ fontSize: 16, lineHeight: 20, color: focused ? O.accent : O.textDim }}>
        {ICONS[name] ?? "●"}
      </Text>
      {focused && <View className="w-1 h-1 rounded-full bg-o-accent mt-[2px]" />}
    </View>
  );
}

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: O.surface,
          borderTopColor: O.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: O.accent,
        tabBarInactiveTintColor: O.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
          color: O.textSub,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="floor"
        options={{
          title: "Floor",
          tabBarIcon: ({ focused }) => <TabIcon name="floor" focused={focused} />,
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
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ focused }) => <TabIcon name="insights" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="setup"
        options={{
          title: "Setup",
          tabBarIcon: ({ focused }) => <TabIcon name="setup" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
