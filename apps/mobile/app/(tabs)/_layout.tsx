import { Tabs } from "expo-router";
import { LayoutDashboard, BedDouble, Calendar, Users, MoreHorizontal } from "lucide-react-native";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: "#0f172a",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          headerTitle: "StayFlow",
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: "Rooms",
          tabBarIcon: ({ color, size }) => <BedDouble size={size} color={color} />,
          headerTitle: "Rooms",
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
          headerTitle: "Bookings",
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: "Guests",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          headerTitle: "Guests",
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} />,
          headerTitle: "More",
        }}
      />
    </Tabs>
  );
}
