import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen, SecondaryButton } from '../components/Form';
import { PopIn } from '../components/motion';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen tone="ink">
      <PopIn>
        <View style={styles.mark}>
          <Ionicons color={colors.ink} name="car-outline" size={36} />
        </View>
      </PopIn>
      <Text style={styles.eyebrow}>Urban Glow Car Wash</Text>
      <Text style={styles.title}>Clean car. Great impression.</Text>
      <Text style={styles.body}>We clean, you shine.</Text>
      <PrimaryButton label="Sign in" onPress={() => navigation.navigate('Login')} />
      <SecondaryButton
        label="Create an account"
        onPress={() => navigation.navigate('Register')}
        outline
        tone="light"
      />
      <StatusBar style="light" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.lime,
    borderRadius: 22,
    height: 84,
    justifyContent: 'center',
    marginBottom: 28,
    width: 84,
  },
  eyebrow: {
    color: colors.lime,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.white,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 46,
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    color: colors.onInk,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 28,
    textAlign: 'center',
  },
});
