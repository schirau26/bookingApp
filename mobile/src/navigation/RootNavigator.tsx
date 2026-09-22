import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdminHomeScreen } from '../screens/AdminHomeScreen';
import { BookScreen } from '../screens/BookScreen';
import { BusinessDetailScreen } from '../screens/BusinessDetailScreen';
import { BusinessFormScreen } from '../screens/BusinessFormScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ManageBusinessScreen } from '../screens/ManageBusinessScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { MyBusinessesScreen } from '../screens/MyBusinessesScreen';
import { OwnerBookingsScreen } from '../screens/OwnerBookingsScreen';
import { OwnerReviewsScreen } from '../screens/OwnerReviewsScreen';
import { ReviewFormScreen } from '../screens/ReviewFormScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ServiceFormScreen } from '../screens/ServiceFormScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import type { AdminStackParamList, CustomerStackParamList, OwnerStackParamList } from './types';

export type { AdminStackParamList, CustomerStackParamList, OwnerStackParamList } from './types';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

const SignedOutStack = createNativeStackNavigator<RootStackParamList>();
const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();
const OwnerStack = createNativeStackNavigator<OwnerStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

const screenOptions = {
  headerShadowVisible: false,
  headerRight: () => <LogoutButton />,
};

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Pressable accessibilityRole="button" onPress={() => void logout()}>
      <Text style={styles.logout}>Log out</Text>
    </Pressable>
  );
}

export function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status !== 'signedIn' || !user ? (
        <SignedOutStack.Navigator>
          <SignedOutStack.Screen
            component={WelcomeScreen}
            name="Welcome"
            options={{ title: 'Welcome', headerShadowVisible: false }}
          />
          <SignedOutStack.Screen
            component={LoginScreen}
            name="Login"
            options={{ title: 'Sign in', headerShadowVisible: false }}
          />
          <SignedOutStack.Screen
            component={RegisterScreen}
            name="Register"
            options={{ title: 'Register', headerShadowVisible: false }}
          />
        </SignedOutStack.Navigator>
      ) : user.role === 'BUSINESS_OWNER' ? (
        <OwnerStack.Navigator screenOptions={screenOptions}>
          <OwnerStack.Screen component={MyBusinessesScreen} name="MyBusinesses" options={{ title: 'My businesses' }} />
          <OwnerStack.Screen component={BusinessFormScreen} name="BusinessForm" options={{ title: 'Business' }} />
          <OwnerStack.Screen component={ManageBusinessScreen} name="ManageBusiness" options={{ title: 'Manage' }} />
          <OwnerStack.Screen component={ServiceFormScreen} name="ServiceForm" options={{ title: 'Service' }} />
          <OwnerStack.Screen component={OwnerBookingsScreen} name="OwnerBookings" options={{ title: 'Bookings' }} />
          <OwnerStack.Screen component={OwnerReviewsScreen} name="OwnerReviews" options={{ title: 'Reviews' }} />
        </OwnerStack.Navigator>
      ) : user.role === 'ADMIN' ? (
        <AdminStack.Navigator screenOptions={screenOptions}>
          <AdminStack.Screen component={AdminHomeScreen} name="AdminHome" options={{ title: 'Admin' }} />
        </AdminStack.Navigator>
      ) : (
        <CustomerStack.Navigator screenOptions={screenOptions}>
          <CustomerStack.Screen component={DiscoverScreen} name="Discover" options={{ title: 'Discover' }} />
          <CustomerStack.Screen
            component={BusinessDetailScreen}
            name="BusinessDetail"
            options={{ title: 'Business' }}
          />
          <CustomerStack.Screen component={BookScreen} name="Book" options={{ title: 'Book' }} />
          <CustomerStack.Screen component={MyBookingsScreen} name="MyBookings" options={{ title: 'My bookings' }} />
          <CustomerStack.Screen component={ReviewFormScreen} name="ReviewForm" options={{ title: 'Review' }} />
        </CustomerStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f4ef',
  },
  logout: {
    color: '#1c1915',
    fontSize: 16,
    fontWeight: '600',
  },
});
