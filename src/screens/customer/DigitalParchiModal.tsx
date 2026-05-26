import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ScannableQrCode } from '@/components/ScannableQrCode';

export type ParchiStatus =
  | 'Order Placed'
  | 'In Cutting'
  | 'Stitching'
  | 'Ready for Pickup'
  | 'Delivered';

export type OrderMeasurement = {
  label: string;
  value: string;
};

export type DigitalParchiReceipt = {
  id: string;
  tailorName: string;
  darziId: number;
  orderId: string;
  itemType: string;
  dueDateIso: string;
  estimatedDelivery: string;
  status: ParchiStatus;
  qrPayload?: string;
  measurements: OrderMeasurement[];
  totalFee: number;
  advancePaid: number;
};

const timelineSteps: ParchiStatus[] = [
  'Order Placed',
  'In Cutting',
  'Stitching',
  'Ready for Pickup',
];

function formatRupees(value: number) {
  return `Rs. ${value.toLocaleString()}`;
}

function getDaysUntilDue(dueDateIso: string) {
  const dueTime = new Date(dueDateIso).getTime();
  const diffMs = dueTime - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getDueDateLabel(dueDateIso: string) {
  const daysUntilDue = getDaysUntilDue(dueDateIso);

  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} day overdue`;
  if (daysUntilDue === 0) return 'Ready today';
  if (daysUntilDue === 1) return 'Ready tomorrow';
  return `Ready in ${daysUntilDue} days`;
}

function isStepComplete(currentStatus: ParchiStatus, step: (typeof timelineSteps)[number]) {
  if (currentStatus === 'Delivered') return true;
  return timelineSteps.indexOf(step) <= timelineSteps.indexOf(currentStatus);
}

export function DigitalParchiModal({
  onClose,
  parchi,
  visible,
}: {
  onClose: () => void;
  parchi: DigitalParchiReceipt | null;
  visible: boolean;
}) {
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const translateY = useRef(new Animated.Value(48)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMeasurementsOpen(false);
      translateY.setValue(48);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 140,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacity, translateY, visible]);

  if (!parchi) return null;

  const remainingAmount = Math.max(parchi.totalFee - parchi.advancePaid, 0);
  const qrPayload = parchi.qrPayload ?? `darzi://order/${encodeURIComponent(parchi.id)}`;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View className="flex-1 bg-slate-950/70 px-4 py-8">
        <Animated.View
          style={{ opacity, transform: [{ translateY }] }}
          className="flex-1 overflow-hidden rounded-[32px] bg-muslin"
        >
          <View className="flex-row items-start justify-between bg-ink px-5 pb-5 pt-6">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
                Digital Parchi
              </Text>
              <Text className="mt-2 text-3xl font-black text-white">{parchi.tailorName}</Text>
              <Text className="mt-1 text-sm font-bold text-white/70">
                Darzi ID: #{parchi.darziId}  •  Order {parchi.orderId}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/10"
              accessibilityRole="button"
              accessibilityLabel="Close receipt"
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="p-5 pb-8">
            <View className="rounded-[26px] border border-orange-100 bg-white p-5 shadow-sm">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Item Type
                  </Text>
                  <Text className="mt-1 text-2xl font-black text-ink">{parchi.itemType}</Text>
                </View>
                <View className="rounded-2xl bg-amber-100 px-4 py-3">
                  <Text className="text-xs font-black uppercase tracking-wide text-amber-700">
                    Due Date
                  </Text>
                  <Text className="mt-1 text-base font-black text-amber-900">
                    {getDueDateLabel(parchi.dueDateIso)}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-5 rounded-[26px] border border-teal-100 bg-white p-5 shadow-sm">
              <Text className="text-lg font-black text-ink">Workflow Progress</Text>
              <View className="mt-5">
                {timelineSteps.map((step, index) => {
                  const complete = isStepComplete(parchi.status, step);
                  const isLast = index === timelineSteps.length - 1;

                  return (
                    <View key={step} className="flex-row">
                      <View className="items-center">
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-full ${
                            complete ? 'bg-thread' : 'bg-slate-200'
                          }`}
                        >
                          <Ionicons
                            name={complete ? 'checkmark' : 'ellipse-outline'}
                            size={20}
                            color={complete ? '#ffffff' : '#94a3b8'}
                          />
                        </View>
                        {!isLast ? (
                          <View className={`h-10 w-1 ${complete ? 'bg-thread' : 'bg-slate-200'}`} />
                        ) : null}
                      </View>
                      <View className="ml-4 flex-1 pb-5">
                        <Text className={`text-base font-black ${complete ? 'text-ink' : 'text-slate-400'}`}>
                          {step}
                        </Text>
                        <Text className={`mt-1 text-xs font-semibold ${complete ? 'text-slate-500' : 'text-slate-400'}`}>
                          {complete ? 'Completed in workflow' : 'Waiting for tailor update'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="mt-5 rounded-[26px] border border-orange-100 bg-white p-5 shadow-sm">
              <Pressable
                onPress={() => setMeasurementsOpen((current) => !current)}
                className="flex-row items-center justify-between"
                accessibilityRole="button"
                accessibilityLabel="View order measurements"
              >
                <View className="flex-row items-center">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
                    <Ionicons name="resize-outline" size={22} color="#0f766e" />
                  </View>
                  <Text className="ml-3 text-lg font-black text-ink">View Order Measurements</Text>
                </View>
                <Ionicons
                  name={measurementsOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#0f172a"
                />
              </Pressable>

              {measurementsOpen ? (
                <View className="mt-5 flex-row flex-wrap">
                  {parchi.measurements.map((measurement) => (
                    <View
                      key={measurement.label}
                      className="mb-3 mr-3 min-w-[128px] flex-1 rounded-2xl bg-orange-50 px-4 py-3"
                    >
                      <Text className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {measurement.label}
                      </Text>
                      <Text className="mt-1 text-2xl font-black text-ink">{measurement.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                  <FontAwesome name="money" size={21} color="#d97706" />
                </View>
                <Text className="ml-3 text-lg font-black text-ink">Transaction Ledger</Text>
              </View>
              <View className="mt-5 gap-3">
                <LedgerRow label="Total Stitching Fee" value={formatRupees(parchi.totalFee)} />
                <LedgerRow label="Advance Paid" value={formatRupees(parchi.advancePaid)} />
                <View className="flex-row items-center justify-between rounded-2xl bg-teal-50 px-4 py-4">
                  <Text className="flex-1 pr-3 text-sm font-black text-thread">
                    Remaining Amount to Pay at Shop
                  </Text>
                  <Text className="text-lg font-black text-ink">{formatRupees(remainingAmount)}</Text>
                </View>
              </View>
            </View>

            <View className="mt-5 rounded-[28px] border border-teal-100 bg-white p-5 shadow-sm">
              <View className="items-center rounded-[24px] bg-slate-50 p-6">
                <View className="items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-3">
                  <ScannableQrCode value={qrPayload} size={188} />
                </View>
                <Text className="mt-5 text-center text-xl font-black text-ink">
                  Counter Pickup QR
                </Text>
                <Text className="mt-2 text-center text-sm font-semibold leading-6 text-slate-600">
                  Show this QR code to the master at the shop counter during pickup to
                  instantly verify your suit.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="mt-5 flex-row items-center justify-center rounded-2xl bg-ink px-5 py-4"
              accessibilityRole="button"
              accessibilityLabel="Close receipt"
            >
              <Ionicons name="close-circle-outline" size={21} color="#ffffff" />
              <Text className="ml-2 text-base font-black text-white">Close Receipt</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <Text className="text-sm font-bold text-slate-500">{label}</Text>
      <Text className="text-sm font-black text-ink">{value}</Text>
    </View>
  );
}
