import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '@/screens/customer/ProfileScreen';
import { NewOrderScreen } from '@/screens/tailor/NewOrderScreen';
import { ShowcaseUploadScreen } from '@/screens/tailor/ShowcaseUploadScreen';
import type { ProfileStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="NewOrder" component={NewOrderScreen} />
      <Stack.Screen name="ShowcaseUpload" component={ShowcaseUploadScreen} />
    </Stack.Navigator>
  );
}
