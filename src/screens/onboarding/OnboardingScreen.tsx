import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage, type TranslationKey } from '@/context/LanguageContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';

const onboardingStorageKey = 'has_completed_onboarding';

type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

type OnboardingSlide = {
  id: string;
  title: string;
  subtitle: string;
  iconFamily: 'ionicons' | 'fontawesome';
  iconName: keyof typeof Ionicons.glyphMap | keyof typeof FontAwesome.glyphMap;
  accentClass: string;
  iconBgClass: string;
  iconColor: string;
};

type OnboardingSlideTemplate = Omit<OnboardingSlide, 'title' | 'subtitle'> & {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
};

const slideTemplates: OnboardingSlideTemplate[] = [
  {
    id: 'paper-parchis',
    titleKey: 'onboarding.slide1.title',
    subtitleKey: 'onboarding.slide1.subtitle',
    iconFamily: 'ionicons',
    iconName: 'clipboard-outline',
    accentClass: 'bg-amber-400',
    iconBgClass: 'bg-amber-100',
    iconColor: '#d97706',
  },
  {
    id: 'nearby-masters',
    titleKey: 'onboarding.slide2.title',
    subtitleKey: 'onboarding.slide2.subtitle',
    iconFamily: 'ionicons',
    iconName: 'location-outline',
    accentClass: 'bg-teal-500',
    iconBgClass: 'bg-teal-100',
    iconColor: '#0f766e',
  },
  {
    id: 'style-board',
    titleKey: 'onboarding.slide3.title',
    subtitleKey: 'onboarding.slide3.subtitle',
    iconFamily: 'ionicons',
    iconName: 'sparkles-outline',
    accentClass: 'bg-rose-400',
    iconBgClass: 'bg-rose-100',
    iconColor: '#e11d48',
  },
];

async function hasCompletedOnboarding() {
  try {
    const storedValue = await AsyncStorage.getItem(onboardingStorageKey);
    return storedValue === 'true';
  } catch (error) {
    console.error('[DarziOnboarding] Failed to load onboarding flag', error);
    return false;
  }
}

async function saveOnboardingComplete() {
  try {
    await AsyncStorage.setItem(onboardingStorageKey, 'true');
  } catch (error) {
    console.error('[DarziOnboarding] Failed to save onboarding flag', error);
  }
}

async function getPostOnboardingRoute() {
  if (!isSupabaseConfigured || !supabase) return 'Auth' as const;

  try {
    const { data } = await supabase.auth.getSession();
    return data.session ? 'CustomerTabs' as const : 'Auth' as const;
  } catch (error) {
    console.error('[DarziOnboarding] Failed to read Supabase session', error);
    return 'Auth' as const;
  }
}

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [checkingFirstRun, setCheckingFirstRun] = useState(true);
  const slides = useMemo(
    () =>
      slideTemplates.map((slide) => ({
        id: slide.id,
        title: t(slide.titleKey),
        subtitle: t(slide.subtitleKey),
        iconFamily: slide.iconFamily,
        iconName: slide.iconName,
        accentClass: slide.accentClass,
        iconBgClass: slide.iconBgClass,
        iconColor: slide.iconColor,
      })),
    [t],
  );
  const lastSlideActive = activeIndex === slides.length - 1;

  useEffect(() => {
    let active = true;

    async function checkFirstRun() {
      const completed = await hasCompletedOnboarding();

      if (!active) return;

      if (completed) {
        const routeName = await getPostOnboardingRoute();
        navigation.reset({
          index: 0,
          routes: [{ name: routeName }],
        });
        return;
      }

      setCheckingFirstRun(false);
    }

    void checkFirstRun();

    return () => {
      active = false;
    };
  }, [navigation]);

  const completeOnboarding = async () => {
    await saveOnboardingComplete();
    const routeName = await getPostOnboardingRoute();
    navigation.reset({
      index: 0,
      routes: [{ name: routeName }],
    });
  };

  const goToNextSlide = () => {
    if (lastSlideActive) {
      void completeOnboarding();
      return;
    }

    const nextIndex = Math.min(activeIndex + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
  };

  if (checkingFirstRun) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-muslin">
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="mt-4 text-sm font-bold text-slate-500">Preparing Darzi...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-muslin">
      <View className="flex-1">
        <View className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-amber-200/70" />
        <View className="absolute -left-24 bottom-16 h-72 w-72 rounded-full bg-teal-100" />

        <View className="z-10 flex-row items-center justify-between px-5 pt-4">
          <View>
            <Text className="text-xs font-black uppercase tracking-[2px] text-thread">
              Darzi
            </Text>
            <Text className="mt-1 text-lg font-black text-ink">{t('onboarding.brandSubtitle')}</Text>
          </View>
          <Pressable
            onPress={completeOnboarding}
            className="rounded-full bg-white px-5 py-3 shadow-sm"
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text className="text-sm font-black text-slate-600">{t('common.skip')}</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item }) => (
            <OnboardingSlideCard
              slide={item}
              width={width}
              localFirstTitle={t('onboarding.localFirst')}
              localFirstBody={t('onboarding.localFirstBody')}
            />
          )}
        />

        <View className="px-5 pb-8">
          <View className="mb-6 flex-row items-center justify-center">
            {slides.map((slide, index) => (
              <View
                key={slide.id}
                className={`mx-1.5 h-2.5 rounded-full ${
                  activeIndex === index ? 'w-9 bg-thread' : 'w-2.5 bg-slate-300'
                }`}
              />
            ))}
          </View>

          <Pressable
            onPress={goToNextSlide}
            className={`flex-row items-center justify-center rounded-[24px] px-5 py-5 ${
              lastSlideActive ? 'bg-ink' : 'bg-thread'
            }`}
            accessibilityRole="button"
            accessibilityLabel={lastSlideActive ? 'Get started' : 'Next onboarding slide'}
          >
            <Text className="text-lg font-black text-white">
              {lastSlideActive ? t('onboarding.cta') : t('common.next')}
            </Text>
            <Ionicons
              name={lastSlideActive ? 'checkmark-circle-outline' : 'arrow-forward-circle-outline'}
              size={23}
              color="#ffffff"
              style={{ marginLeft: 10 }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function OnboardingSlideCard({
  localFirstBody,
  localFirstTitle,
  slide,
  width,
}: {
  localFirstBody: string;
  localFirstTitle: string;
  slide: OnboardingSlide;
  width: number;
}) {
  return (
    <View style={{ width }} className="justify-center px-5 pb-4 pt-8">
      <View className="overflow-hidden rounded-[38px] bg-white p-6 shadow-sm">
        <View className={`absolute right-0 top-0 h-24 w-28 rounded-bl-[56px] ${slide.accentClass}`} />
        <View className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-orange-100" />

        <View className={`h-24 w-24 items-center justify-center rounded-[32px] ${slide.iconBgClass}`}>
          {slide.iconFamily === 'fontawesome' ? (
            <FontAwesome
              name={slide.iconName as keyof typeof FontAwesome.glyphMap}
              size={42}
              color={slide.iconColor}
            />
          ) : (
            <Ionicons
              name={slide.iconName as keyof typeof Ionicons.glyphMap}
              size={48}
              color={slide.iconColor}
            />
          )}
        </View>

        <View className="mt-8">
          <Text className="text-4xl font-black leading-[46px] text-ink">{slide.title}</Text>
          <Text className="mt-5 text-lg font-semibold leading-8 text-slate-600">
            {slide.subtitle}
          </Text>
        </View>

        <View className="mt-8 rounded-[28px] bg-slate-950 px-5 py-5">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Ionicons name="scan-outline" size={25} color="#fbbf24" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
                {localFirstTitle}
              </Text>
              <Text className="mt-1 text-sm font-bold leading-6 text-white/75">
                {localFirstBody}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export { onboardingStorageKey };
