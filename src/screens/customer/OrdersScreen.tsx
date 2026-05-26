import { Text, View } from 'react-native';
import { buildOrderDeepLink } from '@/utils/deepLinks';
import { Screen } from '@/components/Screen';

const orderId = '8f4949e1-7a4a-4932-9f59-7b7e8f3b1981';

export function OrdersScreen() {
  return (
    <Screen>
      <Text className="text-3xl font-black text-ink">My Orders</Text>
      <Text className="mt-2 text-base text-slate-600">
        Digital receipts for every parchi, with realtime status from the tailor.
      </Text>

      <View className="mt-7 rounded-3xl bg-white p-5 shadow-sm">
        <Text className="text-xs font-bold uppercase tracking-wide text-thread">
          Current parchi
        </Text>
        <Text className="mt-3 text-xl font-extrabold text-ink">Blue waistcoat fitting</Text>
        <Text className="mt-2 text-base text-slate-600">Status: stitching</Text>
        <Text className="mt-4 rounded-2xl bg-orange-50 p-4 text-xs font-semibold text-slate-700">
          QR payload: {buildOrderDeepLink(orderId)}
        </Text>
      </View>
    </Screen>
  );
}
