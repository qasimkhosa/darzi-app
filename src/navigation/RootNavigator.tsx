import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { AuthStack } from '@/navigation/stacks/AuthStack';
import { CustomerTabs } from '@/navigation/tabs/CustomerTabs';
import type { RootStackParamList } from '@/navigation/types';
import { LanguageSelectScreen } from '@/screens/language/LanguageSelectScreen';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { loadUserRole } from '@/utils/persistence';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navigationRef = useRef<any>(null);
  const { isHydrated, language } = useLanguage();

  useEffect(() => {
    if (!isHydrated || !language) return undefined;
    if (!isSupabaseConfigured || !supabase) return undefined;

    let active = true;

    async function routeExistingSession() {
      try {
        const { data, error } = await supabase!.auth.getSession();

        if (!active || error || !data.session) return;

        await loadUserRole();
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'CustomerTabs' }],
        });
      } catch (error) {
        if (__DEV__) {
          console.info('[RootNavigator] Failed to hydrate existing Supabase session', error);
        }
      }
    }

    void routeExistingSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      if (session) {
        await loadUserRole();
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'CustomerTabs' }],
        });
        return;
      }

      const currentRouteName = navigationRef.current?.getCurrentRoute?.()?.name;
      if (currentRouteName === 'LanguageSelect' || currentRouteName === 'Onboarding') {
        return;
      }

      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isHydrated, language]);

  if (!isHydrated) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-muslin">
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="mt-4 text-sm font-black text-slate-500">Preparing Darzi...</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={language ? 'Onboarding' : 'LanguageSelect'}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthStack} />
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
