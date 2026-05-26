import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View } from 'react-native';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function Screen({ children, scroll = true }: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-muslin">
        <View className="flex-1 px-5 py-4">{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-muslin">
      <ScrollView className="flex-1" contentContainerClassName="px-5 py-4 pb-10">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
