import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage, type Language } from '@/context/LanguageContext';
import type { RootStackParamList } from '@/navigation/types';

type LanguageSelectScreenProps = NativeStackScreenProps<RootStackParamList, 'LanguageSelect'>;

const languageOptions: Array<{
  id: Language;
  label: string;
  nativeLabel: string;
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentClass: string;
  textClass: string;
}> = [
  {
    id: 'en',
    label: 'English',
    nativeLabel: 'English',
    helper: 'Use Darzi in English',
    icon: 'globe-outline',
    accentClass: 'bg-teal-600',
    textClass: 'text-teal-700',
  },
  {
    id: 'ur',
    label: 'Urdu',
    nativeLabel: 'اردو',
    helper: 'درزی کو اردو میں استعمال کریں',
    icon: 'language-outline',
    accentClass: 'bg-amber-500',
    textClass: 'text-amber-700',
  },
];

export function LanguageSelectScreen({ navigation }: LanguageSelectScreenProps) {
  const { isHydrated, language, setLanguage, t } = useLanguage();
  const [savingLanguage, setSavingLanguage] = useState<Language | null>(null);

  useEffect(() => {
    if (isHydrated && language) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    }
  }, [isHydrated, language, navigation]);

  const handleSelectLanguage = async (nextLanguage: Language) => {
    setSavingLanguage(nextLanguage);

    try {
      await setLanguage(nextLanguage);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    } catch (error) {
      console.error('[LanguageSelectScreen] Failed to select language', error);
      setSavingLanguage(null);
    }
  };

  if (!isHydrated || language) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-muslin">
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="mt-4 text-sm font-black text-slate-500">Preparing Darzi...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-muslin">
      <View className="flex-1 px-5 py-6">
        <View className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-teal-100" />
        <View className="absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-amber-100" />

        <View className="flex-1 justify-center">
          <View className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-[28px] bg-ink shadow-sm">
              <Ionicons name="cut-outline" size={38} color="#fbbf24" />
            </View>
            <Text className="mt-6 text-center text-4xl font-black leading-[48px] text-ink">
              {t('language.title')}
            </Text>
            <Text className="mt-3 max-w-[310px] text-center text-base font-semibold leading-7 text-slate-600">
              {t('language.subtitle')}
            </Text>
          </View>

          <View className="mt-10 flex-row gap-4">
            {languageOptions.map((option) => {
              const isSaving = savingLanguage === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelectLanguage(option.id)}
                  disabled={savingLanguage !== null}
                  className="min-h-[210px] flex-1 justify-between rounded-[30px] border border-orange-100 bg-white p-5 shadow-sm"
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${option.label}`}
                >
                  <View className={`h-14 w-14 items-center justify-center rounded-2xl ${option.accentClass}`}>
                    {isSaving ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Ionicons name={option.icon} size={27} color="#ffffff" />
                    )}
                  </View>

                  <View>
                    <Text
                      className={`text-3xl font-black ${option.textClass} ${
                        option.id === 'ur' ? 'font-nastaliq text-right leading-[58px]' : ''
                      }`}
                    >
                      {option.nativeLabel}
                    </Text>
                    <Text
                      className={`mt-2 text-sm font-bold leading-6 text-slate-500 ${
                        option.id === 'ur' ? 'font-nastaliq text-right leading-8' : ''
                      }`}
                    >
                      {option.helper}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-8 rounded-[26px] bg-slate-950 px-5 py-5">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="phone-portrait-outline" size={22} color="#fbbf24" />
              </View>
              <Text className="ml-3 flex-1 text-sm font-bold leading-6 text-white/75">
                You can change this later from Profile settings.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
