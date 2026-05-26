import 'react-native-url-polyfill/auto';
import './global.css';

import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from '@/navigation/RootNavigator';
import { SocialFeedProvider } from '@/contexts/SocialFeedContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

const URDU_FONT_FAMILY = 'NotoNastaliqUrdu';

type DefaultStyledComponent = {
  defaultProps?: {
    style?: unknown;
    [key: string]: unknown;
  };
};

const textComponent = Text as unknown as DefaultStyledComponent;
const textInputComponent = TextInput as unknown as DefaultStyledComponent;
const initialTextStyle = textComponent.defaultProps?.style;
const initialTextInputStyle = textInputComponent.defaultProps?.style;

function setDefaultComponentStyle(component: DefaultStyledComponent, style: unknown) {
  component.defaultProps = {
    ...(component.defaultProps ?? {}),
    style,
  };
}

function UrduTypographyGate({ children }: { children: ReactNode }) {
  const { language } = useLanguage();

  useEffect(() => {
    if (language === 'ur') {
      const urduTextStyle = {
        fontFamily: URDU_FONT_FAMILY,
        writingDirection: 'rtl' as const,
        textAlign: 'right' as const,
        includeFontPadding: true,
      };

      setDefaultComponentStyle(textComponent, [initialTextStyle, urduTextStyle]);
      setDefaultComponentStyle(textInputComponent, [
        initialTextInputStyle,
        {
          ...urduTextStyle,
          textAlignVertical: 'center' as const,
        },
      ]);
      return;
    }

    setDefaultComponentStyle(textComponent, initialTextStyle);
    setDefaultComponentStyle(textInputComponent, initialTextInputStyle);
  }, [language]);

  return <>{children}</>;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoNastaliqUrdu: require('./assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
    NotoNastaliqUrduBold: require('./assets/fonts/NotoNastaliqUrdu-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-muslin">
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="mt-4 text-sm font-black text-slate-500">Preparing Darzi...</Text>
      </View>
    );
  }

  return (
    <LanguageProvider>
      <UrduTypographyGate>
        <SocialFeedProvider>
          <RootNavigator />
          <StatusBar style="dark" />
        </SocialFeedProvider>
      </UrduTypographyGate>
    </LanguageProvider>
  );
}
