import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';

export type RootStackParamList = {
  Welcome: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ title: 'Welcome', headerShadowVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
