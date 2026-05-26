import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { ProfileStack } from '@/navigation/stacks/ProfileStack';
import type { CustomerTabParamList } from '@/navigation/types';
import { DiscoverScreen } from '@/screens/customer/DiscoverScreen';
import { FeedScreen } from '@/screens/customer/LookbookScreen';
import { OrdersScreen } from '@/screens/customer/OrdersScreen';

const Tabs = createBottomTabNavigator<CustomerTabParamList>();

const tabBarIconByRoute: Record<keyof CustomerTabParamList, keyof typeof Ionicons.glyphMap> = {
  Discover: 'search-outline',
  Feed: 'images-outline',
  Orders: 'receipt-outline',
  Profile: 'person-circle-outline',
};

export function CustomerTabs() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: shouldHideTabBar(route)
          ? { display: 'none' }
          : {
              borderTopColor: '#e2e8f0',
              height: 62 + bottomInset,
              paddingBottom: bottomInset,
              paddingTop: 8,
            },
        tabBarIcon: ({ color }) => (
          <TabIcon color={color} glyph={tabBarIconByRoute[route.name]} />
        ),
      })}
    >
      <Tabs.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: t('nav.discover') }}
      />
      <Tabs.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: t('nav.lookbook') }}
      />
      <Tabs.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: t('nav.orders') }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: t('nav.profile') }}
      />
    </Tabs.Navigator>
  );
}

function shouldHideTabBar(route: { name: keyof CustomerTabParamList }) {
  if (route.name !== 'Profile') return false;

  const focusedRouteName = getFocusedRouteNameFromRoute(route as never) ?? 'ProfileHome';
  return focusedRouteName !== 'ProfileHome';
}

function TabIcon({ color, glyph }: { color: string; glyph: keyof typeof Ionicons.glyphMap }) {
  return (
    <Text>
      <Ionicons name={glyph} size={22} color={color} />
    </Text>
  );
}
