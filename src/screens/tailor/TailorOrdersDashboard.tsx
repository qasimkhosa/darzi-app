import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  fetchCloudOrdersByTailor,
  formatCloudOrderId,
  resolveActiveTailorProfileId,
  shouldUseLocalCloudFallback,
  toDbOrderStatus,
  toUiOrderStatus,
  updateCloudOrderStatus,
  type CloudOrder,
  type UiOrderStatus,
} from '@/utils/cloudOrders';

type StatusFilter = 'All Orders' | UiOrderStatus;

const statusFilters: StatusFilter[] = [
  'All Orders',
  'In Cutting',
  'Stitching',
  'Ready',
  'Delivered',
];

const statusFlow: UiOrderStatus[] = ['In Cutting', 'Stitching', 'Ready', 'Delivered'];

function formatRupees(value: number) {
  return `Rs. ${value.toLocaleString()}`;
}

function formatDeliveryDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function isUrgentDelivery(isoDate: string) {
  const now = Date.now();
  const deliveryTime = new Date(isoDate).getTime();
  const hoursUntilDelivery = (deliveryTime - now) / (1000 * 60 * 60);
  return hoursUntilDelivery >= 0 && hoursUntilDelivery <= 48;
}

function getNextStatus(status: UiOrderStatus) {
  const currentIndex = statusFlow.indexOf(status);
  return statusFlow[Math.min(currentIndex + 1, statusFlow.length - 1)];
}

function buildWhatsAppUpdateMessage(order: CloudOrder) {
  return `Salam ${order.customer_name.split(' ')[0]}, your order ${formatCloudOrderId(order.id)} is now in the ${toUiOrderStatus(order.status)} phase. Team Darzi.`;
}

function mockLaunchWhatsAppChat(order: CloudOrder) {
  Alert.alert('WhatsApp Update', buildWhatsAppUpdateMessage(order));
}

function mergeOrderByCreatedAt(currentOrders: CloudOrder[], incomingOrder: CloudOrder) {
  const dedupedOrders = currentOrders.filter((order) => order.id !== incomingOrder.id);
  return [incomingOrder, ...dedupedOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function TailorOrdersDashboard() {
  const [orders, setOrders] = useState<CloudOrder[]>([]);
  const [activeTailorId, setActiveTailorId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('All Orders');
  const [actionPickerOrderId, setActionPickerOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const hydrateOrders = useCallback(async () => {
    setLoading(true);

    try {
      const tailorId = await resolveActiveTailorProfileId();
      const cloudOrders = await fetchCloudOrdersByTailor(tailorId);
      setActiveTailorId(tailorId);
      setOrders(cloudOrders);
    } catch (error) {
      shouldUseLocalCloudFallback(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void hydrateOrders();
    }, [hydrateOrders]),
  );

  useEffect(() => {
    if (!activeTailorId || !isSupabaseConfigured || !supabase) return undefined;
    const supabaseClient = supabase;

    const channel = supabaseClient
      .channel(`public:orders:tailor:${activeTailorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tailor_id=eq.${activeTailorId}`,
        },
        (payload) => {
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            setOrders((currentOrders) =>
              mergeOrderByCreatedAt(currentOrders, payload.new as CloudOrder),
            );
            return;
          }

          if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
            const deletedOrderId = (payload.old as { id?: unknown }).id;
            if (typeof deletedOrderId === 'string') {
              setOrders((currentOrders) =>
                currentOrders.filter((order) => order.id !== deletedOrderId),
              );
            }
          }
        },
      )
      .subscribe((status, error) => {
        if (__DEV__ && (error || status === 'CHANNEL_ERROR')) {
          console.info('[TailorOrdersDashboard] Realtime unavailable, continuing locally', error);
        }
      });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [activeTailorId]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'All Orders') return orders;
    return orders.filter((order) => toUiOrderStatus(order.status) === activeFilter);
  }, [activeFilter, orders]);

  const statusCounts = useMemo(() => {
    return statusFilters.reduce<Record<StatusFilter, number>>((next, status) => {
      return {
        ...next,
        [status]: status === 'All Orders'
          ? orders.length
          : orders.filter((order) => toUiOrderStatus(order.status) === status).length,
      };
    }, {
      'All Orders': 0,
      'In Cutting': 0,
      Stitching: 0,
      Ready: 0,
      Delivered: 0,
    });
  }, [orders]);

  const updateOrderStatus = async (orderId: string, status: UiOrderStatus) => {
    setUpdatingOrderId(orderId);

    try {
      const dbStatus = toDbOrderStatus(status);
      await updateCloudOrderStatus(orderId, dbStatus);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: dbStatus } : order,
        ),
      );
      setActionPickerOrderId(null);
    } catch (error) {
      shouldUseLocalCloudFallback(error);
      Alert.alert('Status update failed', 'Could not update this order in Supabase. Please try again.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <View className="mt-7">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-black text-ink">Active Orders Workspace</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-500">
            Live Supabase orders, realtime status changes, and customer updates.
          </Text>
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
          {loading ? (
            <ActivityIndicator color="#0f766e" />
          ) : (
            <Ionicons name="cloud-done-outline" size={25} color="#0f766e" />
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-5"
        contentContainerClassName="pr-4"
      >
        {statusFilters.map((status) => (
          <StatusFilterChip
            key={status}
            active={activeFilter === status}
            count={statusCounts[status]}
            label={status}
            onPress={() => setActiveFilter(status)}
          />
        ))}
      </ScrollView>

      <View className="mt-5 gap-4">
        {loading ? (
          <View className="items-center rounded-[24px] border border-orange-100 bg-white p-8 shadow-sm">
            <ActivityIndicator color="#0f766e" />
            <Text className="mt-3 text-sm font-bold text-slate-500">Loading cloud orders...</Text>
          </View>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <TailorOrderCard
              key={order.id}
              actionPickerOpen={actionPickerOrderId === order.id}
              onToggleActions={() =>
                setActionPickerOrderId((current) => (current === order.id ? null : order.id))
              }
              onUpdateStatus={(status) => void updateOrderStatus(order.id, status)}
              order={order}
              updating={updatingOrderId === order.id}
            />
          ))
        ) : (
          <View className="rounded-[24px] border border-orange-100 bg-white p-5 shadow-sm">
            <Text className="text-lg font-black text-ink">No cloud orders found</Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Generate a new digital parchi or confirm the active tailor profile exists in Supabase.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusFilterChip({
  active,
  count,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  label: StatusFilter;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-3 flex-row items-center rounded-full border px-4 py-3 ${
        active ? 'border-thread bg-thread' : 'border-orange-100 bg-white'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text className={`text-sm font-black ${active ? 'text-white' : 'text-slate-700'}`}>
        {label}
      </Text>
      <View className={`ml-2 rounded-full px-2 py-0.5 ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
        <Text className={`text-xs font-black ${active ? 'text-white' : 'text-slate-500'}`}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const TailorOrderCard = memo(function TailorOrderCard({
  actionPickerOpen,
  onToggleActions,
  onUpdateStatus,
  order,
  updating,
}: {
  actionPickerOpen: boolean;
  onToggleActions: () => void;
  onUpdateStatus: (status: UiOrderStatus) => void;
  order: CloudOrder;
  updating: boolean;
}) {
  const uiStatus = toUiOrderStatus(order.status);
  const urgent = isUrgentDelivery(order.delivery_date);
  const nextStatus = getNextStatus(uiStatus);
  const isTerminal = uiStatus === 'Delivered';

  return (
    <View
      className={`rounded-[28px] border p-5 shadow-sm ${
        urgent ? 'border-red-200 bg-red-50' : 'border-orange-100 bg-white'
      }`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-black text-ink">{order.customer_name}</Text>
          <View className="mt-2 flex-row items-center">
            <Text className="text-sm font-bold text-slate-500">{order.customer_mobile}</Text>
            <Pressable
              onPress={() => mockLaunchWhatsAppChat(order)}
              className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-emerald-100"
              accessibilityRole="button"
              accessibilityLabel={`Send WhatsApp update to ${order.customer_name}`}
            >
              <FontAwesome name="whatsapp" size={20} color="#16a34a" />
            </Pressable>
          </View>
        </View>
        <StatusBadge status={uiStatus} />
      </View>

      <View className="mt-5 flex-row flex-wrap">
        <InfoPill icon="cut-outline" label={order.suit_type} />
        <InfoPill icon="receipt-outline" label={formatCloudOrderId(order.id)} />
      </View>

      <View className={`mt-4 flex-row items-center rounded-2xl px-4 py-3 ${urgent ? 'bg-red-100' : 'bg-slate-50'}`}>
        <Ionicons
          name={urgent ? 'alarm-outline' : 'time-outline'}
          size={19}
          color={urgent ? '#dc2626' : '#475569'}
        />
        <View className="ml-2 flex-1">
          <Text className={`text-xs font-black uppercase tracking-wide ${urgent ? 'text-red-600' : 'text-slate-500'}`}>
            Delivery Deadline
          </Text>
          <Text className={`mt-0.5 text-base font-black ${urgent ? 'text-red-700' : 'text-ink'}`}>
            {formatDeliveryDate(order.delivery_date)}
          </Text>
        </View>
        {urgent ? (
          <Text className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
            Eid rush
          </Text>
        ) : null}
      </View>

      <View className="mt-4 rounded-2xl bg-slate-900 p-4">
        <Text className="text-xs font-black uppercase tracking-wide text-slate-300">
          Financial Summary
        </Text>
        <View className="mt-3 flex-row justify-between">
          <MoneyStat label="Total" value={formatRupees(order.total_bill)} />
          <MoneyStat label="Advance" value={formatRupees(order.advance_paid)} />
          <MoneyStat label="Remaining" value={formatRupees(order.remaining_balance)} highlight />
        </View>
      </View>

      <Pressable
        onPress={onToggleActions}
        className="mt-4 flex-row items-center justify-center rounded-2xl bg-thread px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel={`Progress status for ${formatCloudOrderId(order.id)}`}
        disabled={updating}
      >
        {updating ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Ionicons name="arrow-forward-circle-outline" size={21} color="#ffffff" />
        )}
        <Text className="ml-2 text-base font-black text-white">
          {updating
            ? 'Updating Status...'
            : isTerminal
              ? 'View Status Actions'
              : `Progress Status to ${nextStatus}`}
        </Text>
      </Pressable>

      {actionPickerOpen ? (
        <StatusActionPicker
          currentStatus={uiStatus}
          disabled={updating}
          onUpdateStatus={onUpdateStatus}
        />
      ) : null}
    </View>
  );
});

function InfoPill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="mb-2 mr-2 flex-row items-center rounded-full bg-orange-50 px-3 py-2">
      <Ionicons name={icon} size={15} color="#0f766e" />
      <Text className="ml-1 text-xs font-black text-slate-700">{label}</Text>
    </View>
  );
}

function MoneyStat({
  highlight = false,
  label,
  value,
}: {
  highlight?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View className="mr-2 flex-1">
      <Text className="text-xs font-bold text-slate-400">{label}</Text>
      <Text className={`mt-1 text-sm font-black ${highlight ? 'text-amber-300' : 'text-white'}`}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: UiOrderStatus }) {
  const tone = {
    'In Cutting': {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      icon: 'cut-outline',
      color: '#92400e',
    },
    Stitching: {
      bg: 'bg-teal-100',
      text: 'text-teal-800',
      icon: 'construct-outline',
      color: '#115e59',
    },
    Ready: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      icon: 'checkmark-circle-outline',
      color: '#166534',
    },
    Delivered: {
      bg: 'bg-slate-200',
      text: 'text-slate-700',
      icon: 'cube-outline',
      color: '#334155',
    },
  }[status];

  return (
    <View className={`flex-row items-center rounded-full px-3 py-1.5 ${tone.bg}`}>
      <Ionicons name={tone.icon as keyof typeof Ionicons.glyphMap} size={15} color={tone.color} />
      <Text className={`ml-1 text-xs font-black ${tone.text}`}>{status}</Text>
    </View>
  );
}

function StatusActionPicker({
  currentStatus,
  disabled,
  onUpdateStatus,
}: {
  currentStatus: UiOrderStatus;
  disabled: boolean;
  onUpdateStatus: (status: UiOrderStatus) => void;
}) {
  const nextStatus = getNextStatus(currentStatus);

  return (
    <View className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
      <Text className="text-sm font-black text-ink">Choose workflow step</Text>
      <Text className="mt-1 text-xs font-semibold text-slate-500">
        Updates are written directly to the Supabase orders table.
      </Text>

      {currentStatus !== 'Delivered' ? (
        <Pressable
          onPress={() => onUpdateStatus(nextStatus)}
          disabled={disabled}
          className="mt-3 flex-row items-center justify-center rounded-2xl bg-ink px-4 py-3"
        >
          <Ionicons name="trending-up-outline" size={18} color="#ffffff" />
          <Text className="ml-2 text-sm font-black text-white">Move to {nextStatus}</Text>
        </Pressable>
      ) : null}

      <View className="mt-3 flex-row flex-wrap">
        {statusFlow.map((status) => (
          <Pressable
            key={status}
            onPress={() => onUpdateStatus(status)}
            disabled={disabled}
            className={`mb-2 mr-2 rounded-full px-3 py-2 ${
              currentStatus === status ? 'bg-thread' : 'bg-white'
            }`}
          >
            <Text className={`text-xs font-black ${currentStatus === status ? 'text-white' : 'text-slate-700'}`}>
              {status}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export { mockLaunchWhatsAppChat, buildWhatsAppUpdateMessage };
