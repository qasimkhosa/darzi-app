import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import type { AuthStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AuthHome"
        component={AuthScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
