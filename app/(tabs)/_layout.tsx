import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { WOLV } from "@/constants/wolv-theme";

const icons = {
  index: "home",
  markets: "show-chart",
  trade: "swap-horiz",
  portfolio: "pie-chart",
  wallet: "account-balance-wallet",
} as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarButton: HapticTab,
      tabBarActiveTintColor: WOLV.amber,
      tabBarInactiveTintColor: WOLV.muted,
      tabBarStyle: { height: 58 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding, backgroundColor: WOLV.bg, borderTopColor: WOLV.border, borderTopWidth: 1, elevation: 0 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.2 },
      tabBarIcon: ({ color, size }) => <MaterialIcons name={icons[route.name as keyof typeof icons] as any} color={color} size={size || 20} />,
    })}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="markets" options={{ title: "Markets" }} />
      <Tabs.Screen name="trade" options={{ title: "Trade" }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
    </Tabs>
  );
}
