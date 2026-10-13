import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { BookScreen } from '../screens/BookScreen';
import { InvoiceScreen } from '../screens/InvoiceScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ManageBusinessScreen } from '../screens/ManageBusinessScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { OwnerBookingsScreen } from '../screens/OwnerBookingsScreen';
import { OwnerReviewsScreen } from '../screens/OwnerReviewsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ReviewFormScreen } from '../screens/ReviewFormScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ServiceFormScreen } from '../screens/ServiceFormScreen';
import { WashHomeScreen } from '../screens/WashHomeScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors } from '../theme/colors';
import type {
  BookingsStackParamList,
  CustomerRootParamList,
  CustomerTabParamList,
  HomeStackParamList,
  InboxStackParamList,
  OwnerHomeStackParamList,
  OwnerManageStackParamList,
  OwnerRootParamList,
  OwnerTabParamList,
  ProfileStackParamList,
} from './types';

export type { CustomerRootParamList, OwnerRootParamList } from './types';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const SignedOutStack = createNativeStackNavigator<RootStackParamList>();
const CustomerRoot = createNativeStackNavigator<CustomerRootParamList>();
const OwnerRoot = createNativeStackNavigator<OwnerRootParamList>();
const CustomerTabs = createBottomTabNavigator<CustomerTabParamList>();
const OwnerTabs = createBottomTabNavigator<OwnerTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const InboxStack = createNativeStackNavigator<InboxStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const OwnerHomeStack = createNativeStackNavigator<OwnerHomeStackParamList>();
const OwnerManageStack = createNativeStackNavigator<OwnerManageStackParamList>();

const stackScreenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '700' as const },
  contentStyle: { backgroundColor: colors.canvas },
};

function CustomerTabIcon({
  name,
  label,
  focused,
}: {
  name: 'home' | 'calendar' | 'notifications' | 'person';
  label: string;
  focused: boolean;
}) {
  const icon = (focused ? name : `${name}-outline`) as IconName;
  return (
    <View style={[styles.customerTab, focused ? styles.customerTabActive : null]}>
      <Ionicons color={focused ? colors.white : colors.muted} name={icon} size={18} />
      {focused ? (
        <Text numberOfLines={1} style={styles.customerTabLabel}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function TabIcon({
  name,
  focused,
}: {
  name: 'home' | 'storefront' | 'notifications' | 'person';
  focused: boolean;
}) {
  const icon = (focused ? name : `${name}-outline`) as IconName;
  return (
    <View style={[styles.tabIcon, focused ? styles.tabIconActive : null]}>
      <Ionicons color={focused ? colors.ink : colors.muted} name={icon} size={22} />
    </View>
  );
}

const tabScreenOptions = {
  headerShown: false,
  tabBarShowLabel: false,
  tabBarStyle: {
    backgroundColor: colors.card,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
};

function CustomerHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen component={WashHomeScreen} name="WashHome" options={{ headerShown: false }} />
    </HomeStack.Navigator>
  );
}

function CustomerBookingsStack() {
  return (
    <BookingsStack.Navigator screenOptions={stackScreenOptions}>
      <BookingsStack.Screen component={MyBookingsScreen} name="MyBookings" options={{ title: 'My bookings' }} />
    </BookingsStack.Navigator>
  );
}

function InboxStackScreen() {
  return (
    <InboxStack.Navigator screenOptions={stackScreenOptions}>
      <InboxStack.Screen component={NotificationsScreen} name="Notifications" options={{ title: 'Inbox' }} />
    </InboxStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions}>
      <ProfileStack.Screen component={ProfileScreen} name="Profile" options={{ title: 'Profile' }} />
    </ProfileStack.Navigator>
  );
}

function CustomerTabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <CustomerTabs.Navigator
      screenOptions={{
        ...tabScreenOptions,
        tabBarIconStyle: styles.customerTabSlot,
        tabBarStyle: {
          ...tabScreenOptions.tabBarStyle,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <CustomerTabs.Screen
        component={CustomerHomeStack}
        name="HomeTab"
        options={{
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ focused }) => <CustomerTabIcon focused={focused} label="Home" name="home" />,
        }}
      />
      <CustomerTabs.Screen
        component={CustomerBookingsStack}
        name="BookingsTab"
        options={{
          tabBarAccessibilityLabel: 'Bookings',
          tabBarIcon: ({ focused }) => <CustomerTabIcon focused={focused} label="Bookings" name="calendar" />,
        }}
      />
      <CustomerTabs.Screen
        component={InboxStackScreen}
        name="InboxTab"
        options={{
          tabBarAccessibilityLabel: 'Inbox',
          tabBarIcon: ({ focused }) => (
            <CustomerTabIcon focused={focused} label="Inbox" name="notifications" />
          ),
        }}
      />
      <CustomerTabs.Screen
        component={ProfileStackScreen}
        name="ProfileTab"
        options={{
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ focused }) => <CustomerTabIcon focused={focused} label="Profile" name="person" />,
        }}
      />
    </CustomerTabs.Navigator>
  );
}

function OwnerHomeStackScreen() {
  return (
    <OwnerHomeStack.Navigator screenOptions={stackScreenOptions}>
      <OwnerHomeStack.Screen component={OwnerBookingsScreen} name="OwnerQueue" options={{ title: 'Today' }} />
    </OwnerHomeStack.Navigator>
  );
}

function OwnerManageStackScreen() {
  return (
    <OwnerManageStack.Navigator screenOptions={stackScreenOptions}>
      <OwnerManageStack.Screen component={ManageBusinessScreen} name="ManageBusiness" options={{ title: 'Wash' }} />
    </OwnerManageStack.Navigator>
  );
}

function OwnerTabNavigator() {
  return (
    <OwnerTabs.Navigator screenOptions={tabScreenOptions}>
      <OwnerTabs.Screen
        component={OwnerHomeStackScreen}
        name="HomeTab"
        options={{
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" />,
        }}
      />
      <OwnerTabs.Screen
        component={OwnerManageStackScreen}
        name="ManageTab"
        options={{
          tabBarAccessibilityLabel: 'Wash',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="storefront" />,
        }}
      />
      <OwnerTabs.Screen
        component={InboxStackScreen}
        name="InboxTab"
        options={{
          tabBarAccessibilityLabel: 'Inbox',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="notifications" />,
        }}
      />
      <OwnerTabs.Screen
        component={ProfileStackScreen}
        name="ProfileTab"
        options={{
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="person" />,
        }}
      />
    </OwnerTabs.Navigator>
  );
}

export function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status !== 'signedIn' || !user ? (
        <SignedOutStack.Navigator screenOptions={stackScreenOptions}>
          <SignedOutStack.Screen component={WelcomeScreen} name="Welcome" options={{ headerShown: false }} />
          <SignedOutStack.Screen component={LoginScreen} name="Login" options={{ title: 'Sign in' }} />
          <SignedOutStack.Screen component={RegisterScreen} name="Register" options={{ title: 'Register' }} />
        </SignedOutStack.Navigator>
      ) : user.role === 'BUSINESS_OWNER' ? (
        <OwnerRoot.Navigator screenOptions={stackScreenOptions}>
          <OwnerRoot.Screen component={OwnerTabNavigator} name="OwnerTabs" options={{ headerShown: false }} />
          <OwnerRoot.Screen component={ServiceFormScreen} name="ServiceForm" options={{ title: 'Package' }} />
          <OwnerRoot.Screen component={OwnerReviewsScreen} name="OwnerReviews" options={{ title: 'Reviews' }} />
          <OwnerRoot.Screen component={InvoiceScreen} name="Invoice" options={{ title: 'Invoice' }} />
        </OwnerRoot.Navigator>
      ) : (
        <CustomerRoot.Navigator screenOptions={stackScreenOptions}>
          <CustomerRoot.Screen component={CustomerTabNavigator} name="CustomerTabs" options={{ headerShown: false }} />
          <CustomerRoot.Screen component={BookScreen} name="Book" options={{ title: 'Book a wash' }} />
          <CustomerRoot.Screen component={ReviewFormScreen} name="ReviewForm" options={{ title: 'Review' }} />
          <CustomerRoot.Screen component={InvoiceScreen} name="Invoice" options={{ title: 'Invoice' }} />
        </CustomerRoot.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  tabIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 48,
  },
  tabIconActive: {
    backgroundColor: colors.lime,
  },
  customerTabSlot: {
    height: 48,
    width: 76,
  },
  customerTab: {
    alignItems: 'center',
    borderRadius: 16,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  customerTabActive: {
    backgroundColor: colors.blue,
  },
  customerTabLabel: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
