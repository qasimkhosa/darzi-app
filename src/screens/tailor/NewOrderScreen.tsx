import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { ScannableQrCode } from '@/components/ScannableQrCode';
import { useLanguage } from '@/context/LanguageContext';
import type { ProfileStackParamList } from '@/navigation/types';
import {
  activeTailorShopName,
  ensureCustomerProfile,
  formatCloudOrderId,
  formatDeliveryLabel,
  insertCloudOrder,
  measurementRecordToJson,
  resolveActiveTailorProfileId,
  shouldUseLocalCloudFallback,
  type CloudOrder,
} from '@/utils/cloudOrders';

type SuitType = 'Gents Shalwar Kameez' | 'Kurta' | 'Sherwani' | 'Ladies Suit' | 'Lehnga';

type MeasurementField = {
  key: string;
  label: string;
  localName: string;
  defaultValue: number;
  custom?: boolean;
};

type SavedOrder = CloudOrder;

const MAX_MEASUREMENT_INCHES = 160;
const MAX_NAME_LENGTH = 80;
const MAX_MOBILE_LENGTH = 16;
const MAX_MONEY_LENGTH = 7;
const MAX_DELIVERY_DATE_LENGTH = 40;
const MAX_CUSTOM_MEASUREMENT_LABEL_LENGTH = 36;

const suitTypes: SuitType[] = [
  'Gents Shalwar Kameez',
  'Kurta',
  'Sherwani',
  'Ladies Suit',
  'Lehnga',
];

const measurementFieldsBySuitType: Record<SuitType, MeasurementField[]> = {
  'Gents Shalwar Kameez': [
    { key: 'length', label: 'Length', localName: 'Lambaai', defaultValue: 40 },
    { key: 'shoulders', label: 'Shoulders', localName: 'Teera', defaultValue: 18 },
    { key: 'sleeves', label: 'Sleeves', localName: 'Aasteen', defaultValue: 23 },
    { key: 'chest', label: 'Chest', localName: 'Chaati', defaultValue: 22 },
    { key: 'collar', label: 'Collar', localName: 'Hala / Bain', defaultValue: 15.5 },
    { key: 'ghera', label: 'Ghera', localName: 'Daman Ghera', defaultValue: 24 },
    { key: 'shalwarLength', label: 'Shalwar Length', localName: 'Shalwar Lambaai', defaultValue: 38 },
  ],
  Kurta: [
    { key: 'length', label: 'Kurta Length', localName: 'Lambaai', defaultValue: 41 },
    { key: 'shoulders', label: 'Shoulders', localName: 'Teera', defaultValue: 18 },
    { key: 'sleeves', label: 'Sleeves', localName: 'Aasteen', defaultValue: 23 },
    { key: 'chest', label: 'Chest', localName: 'Chaati', defaultValue: 22 },
    { key: 'collar', label: 'Collar', localName: 'Hala / Bain', defaultValue: 15.25 },
    { key: 'ghera', label: 'Ghera', localName: 'Daman Ghera', defaultValue: 25 },
  ],
  Sherwani: [
    { key: 'length', label: 'Sherwani Length', localName: 'Lambaai', defaultValue: 42 },
    { key: 'shoulders', label: 'Shoulders', localName: 'Teera', defaultValue: 18.5 },
    { key: 'sleeves', label: 'Sleeves', localName: 'Aasteen', defaultValue: 24 },
    { key: 'chest', label: 'Chest', localName: 'Chaati', defaultValue: 22.5 },
    { key: 'waist', label: 'Waist', localName: 'Kamar', defaultValue: 20 },
    { key: 'collar', label: 'Collar', localName: 'Band Gala', defaultValue: 15.5 },
    { key: 'frontOpen', label: 'Front Open', localName: 'Samnay Patti', defaultValue: 29 },
  ],
  'Ladies Suit': [
    { key: 'shirtLength', label: 'Shirt Length', localName: 'Kameez Lambaai', defaultValue: 39 },
    { key: 'shoulders', label: 'Shoulders', localName: 'Teera', defaultValue: 15 },
    { key: 'sleeves', label: 'Sleeves', localName: 'Aasteen', defaultValue: 21 },
    { key: 'chest', label: 'Chest', localName: 'Chaati', defaultValue: 19 },
    { key: 'waist', label: 'Waist', localName: 'Kamar', defaultValue: 17 },
    { key: 'daman', label: 'Daman', localName: 'Daman Ghera', defaultValue: 27 },
    { key: 'trouserLength', label: 'Trouser Length', localName: 'Pajama Lambaai', defaultValue: 37 },
  ],
  Lehnga: [
    { key: 'blouseLength', label: 'Blouse Length', localName: 'Choli Lambaai', defaultValue: 15 },
    { key: 'shoulders', label: 'Shoulders', localName: 'Teera', defaultValue: 14.5 },
    { key: 'sleeves', label: 'Sleeves', localName: 'Aasteen', defaultValue: 19 },
    { key: 'chest', label: 'Chest', localName: 'Chaati', defaultValue: 18.5 },
    { key: 'waist', label: 'Waist', localName: 'Kamar', defaultValue: 16 },
    { key: 'lehngaLength', label: 'Lehnga Length', localName: 'Lehnga Lambaai', defaultValue: 42 },
    { key: 'flare', label: 'Flare', localName: 'Ghera', defaultValue: 120 },
  ],
};

function createInitialMeasurements(suitType: SuitType) {
  return measurementFieldsBySuitType[suitType].reduce<Record<string, number>>((next, field) => {
    return { ...next, [field.key]: field.defaultValue };
  }, {});
}

function formatInches(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}"`;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, MAX_MONEY_LENGTH);
}

function createDeliveryDateIso(deliveryDateLabel: string) {
  const parsedDeliveryDate = new Date(deliveryDateLabel);

  if (Number.isFinite(parsedDeliveryDate.getTime())) {
    return parsedDeliveryDate.toISOString();
  }

  return new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
}

function createLocalOrderId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function NewOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [suitType, setSuitType] = useState<SuitType>('Gents Shalwar Kameez');
  const [measurements, setMeasurements] = useState(() => createInitialMeasurements('Gents Shalwar Kameez'));
  const [customFields, setCustomFields] = useState<MeasurementField[]>([]);
  const [customMeasurementName, setCustomMeasurementName] = useState('');
  const [customMeasurementValue, setCustomMeasurementValue] = useState('');
  const [totalBill, setTotalBill] = useState('3500');
  const [advancePaid, setAdvancePaid] = useState('1500');
  const [deliveryDate, setDeliveryDate] = useState('30 May 2026');
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [latestOrder, setLatestOrder] = useState<SavedOrder | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const fields = useMemo(
    () => [...measurementFieldsBySuitType[suitType], ...customFields],
    [customFields, suitType],
  );
  const totalBillNumber = parseMoney(totalBill);
  const advancePaidNumber = parseMoney(advancePaid);
  const remainingBalance = Math.max(totalBillNumber - advancePaidNumber, 0);

  const canGenerate = useMemo(() => {
    return customerName.trim().length > 0 && mobileNumber.trim().length > 0 && totalBillNumber > 0;
  }, [customerName, mobileNumber, totalBillNumber]);

  const handleSuitTypeChange = (nextSuitType: SuitType) => {
    setSuitType(nextSuitType);
    setMeasurements(createInitialMeasurements(nextSuitType));
    setCustomFields([]);
    setCustomMeasurementName('');
    setCustomMeasurementValue('');
  };

  const updateMeasurement = (key: string, nextValue: number) => {
    const normalizedValue = Math.min(
      MAX_MEASUREMENT_INCHES,
      Math.max(0, Math.round(nextValue * 4) / 4),
    );
    setMeasurements((current) => ({ ...current, [key]: normalizedValue }));
  };

  const handleAddCustomMeasurement = () => {
    const trimmedName = customMeasurementName.trim();
    const parsedValue = Number(customMeasurementValue);

    if (!trimmedName || !Number.isFinite(parsedValue)) {
      Alert.alert('Custom measurement missing', 'Add a measurement name and size in inches.');
      return;
    }

    const normalizedKeyBase = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28);
    const baseKey = `custom_${normalizedKeyBase || 'measurement'}`;
    const existingKeys = new Set(fields.map((field) => field.key));
    const nextKey = existingKeys.has(baseKey) ? `${baseKey}_${customFields.length + 1}` : baseKey;
    const normalizedValue = Math.min(MAX_MEASUREMENT_INCHES, Math.max(0, Math.round(parsedValue * 4) / 4));
    const nextField: MeasurementField = {
      key: nextKey,
      label: trimmedName.slice(0, MAX_CUSTOM_MEASUREMENT_LABEL_LENGTH),
      localName: 'Custom',
      defaultValue: normalizedValue,
      custom: true,
    };

    setCustomFields((currentFields) => [...currentFields, nextField]);
    setMeasurements((currentMeasurements) => ({
      ...currentMeasurements,
      [nextKey]: normalizedValue,
    }));
    setCustomMeasurementName('');
    setCustomMeasurementValue('');
  };

  const removeCustomMeasurement = (key: string) => {
    setCustomFields((currentFields) => currentFields.filter((field) => field.key !== key));
    setMeasurements((currentMeasurements) => {
      const { [key]: _removedMeasurement, ...remainingMeasurements } = currentMeasurements;
      return remainingMeasurements;
    });
  };

  const handleGenerateParchi = async () => {
    if (savingOrder) return;

    if (!canGenerate) {
      Alert.alert('Missing order details', 'Add customer name, mobile number, and total bill first.');
      return;
    }

    setSavingOrder(true);

    try {
      const createdAt = new Date().toISOString();
      const deliveryDateIso = createDeliveryDateIso(deliveryDate);
      const customerId = await ensureCustomerProfile(customerName, mobileNumber);
      const tailorId = await resolveActiveTailorProfileId();
      const insertedOrder = await insertCloudOrder({
        customer_id: customerId,
        tailor_id: tailorId,
        customer_name: customerName.trim(),
        customer_mobile: mobileNumber.trim(),
        suit_type: suitType,
        delivery_date: deliveryDateIso,
        measurements_json: measurementRecordToJson(measurements),
        total_bill: totalBillNumber,
        advance_paid: advancePaidNumber,
        remaining_balance: remainingBalance,
        status: 'pending',
        qr_code_str: `darzi://order/pending-${Date.now()}`,
        created_at: createdAt,
      });

      setSavedOrders((current) => [insertedOrder, ...current]);
      setLatestOrder(insertedOrder);
      setSuccessVisible(true);
    } catch (error) {
      shouldUseLocalCloudFallback(error);
      const createdAt = new Date().toISOString();
      const localOrder: SavedOrder = {
        id: createLocalOrderId(),
        customer_id: null,
        tailor_id: null,
        customer_name: customerName.trim(),
        customer_mobile: mobileNumber.trim(),
        suit_type: suitType,
        delivery_date: createDeliveryDateIso(deliveryDate),
        measurements_json: measurementRecordToJson(measurements),
        total_bill: totalBillNumber,
        advance_paid: advancePaidNumber,
        remaining_balance: remainingBalance,
        status: 'pending',
        qr_code_str: `darzi://order/local-${Date.now()}`,
        created_at: createdAt,
      };

      setSavedOrders((current) => [localOrder, ...current]);
      setLatestOrder(localOrder);
      setSuccessVisible(true);
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
          accessibilityRole="button"
          accessibilityLabel="Go back to profile"
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-3xl font-black text-ink">New Digital Parchi</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-500">
            Local measurement book for walk-in customers
          </Text>
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
        <SectionHeader
          icon="person-add-outline"
          title="Customer Info"
          subtitle={`${savedOrders.length} cloud parchis generated this session`}
        />
        <View className="mt-5 gap-4">
          <InputField
            label="Customer Name"
            value={customerName}
            onChangeText={(value) => setCustomerName(value.slice(0, MAX_NAME_LENGTH))}
            placeholder="e.g. Ahmed Raza"
            maxLength={MAX_NAME_LENGTH}
          />
          <InputField
            label="Mobile Number"
            value={mobileNumber}
            onChangeText={(value) => setMobileNumber(value.replace(/[^\d+]/g, '').slice(0, MAX_MOBILE_LENGTH))}
            placeholder="03xx xxxxxxx"
            keyboardType="phone-pad"
            maxLength={MAX_MOBILE_LENGTH}
          />
        </View>
      </View>

      <View className="mt-5">
        <SectionHeader
          icon="shirt-outline"
          title="Suit Type"
          subtitle="Changing type updates the measurement matrix"
        />
        <View className="mt-4">
          <View className="flex-row flex-wrap">
            {suitTypes.map((type) => (
              <Pressable
                key={type}
                onPress={() => handleSuitTypeChange(type)}
                className={`mb-3 mr-3 rounded-full border px-4 py-3 ${
                  suitType === type ? 'border-thread bg-thread' : 'border-orange-100 bg-white'
                }`}
              >
                <Text className={`text-sm font-black ${suitType === type ? 'text-white' : 'text-slate-700'}`}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
        <SectionHeader
          icon="resize-outline"
          title="Measurement Tape"
          subtitle="Quarter-inch controls for fast shop-floor entry"
        />
        <View className="mt-5">
          {fields.map((field) => (
            <MeasurementInput
              key={field.key}
              field={field}
              value={measurements[field.key] ?? field.defaultValue}
              onChange={(nextValue) => updateMeasurement(field.key, nextValue)}
              onRemove={field.custom ? () => removeCustomMeasurement(field.key) : undefined}
            />
          ))}
        </View>

        <View className="mt-2 rounded-[24px] border border-dashed border-teal-200 bg-teal-50 p-4">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
              <Ionicons name="add-circle-outline" size={22} color="#0f766e" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-black text-ink">Add Custom Measurement</Text>
              <Text className="mt-1 text-xs font-bold text-slate-500">
                Add anything not listed, like cuff, hip, arm hole, or trouser bottom.
              </Text>
            </View>
          </View>
          <View className="mt-4 gap-3">
            <InputField
              label="Measurement Name"
              value={customMeasurementName}
              onChangeText={(value) => setCustomMeasurementName(value.slice(0, MAX_CUSTOM_MEASUREMENT_LABEL_LENGTH))}
              placeholder="e.g. Arm Hole"
              maxLength={MAX_CUSTOM_MEASUREMENT_LABEL_LENGTH}
            />
            <InputField
              label="Size in Inches"
              value={customMeasurementValue}
              onChangeText={(value) => setCustomMeasurementValue(value.replace(/[^\d.]/g, '').slice(0, 6))}
              placeholder="e.g. 10.5"
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <Pressable
            onPress={handleAddCustomMeasurement}
            className="mt-4 flex-row items-center justify-center rounded-2xl bg-ink px-5 py-4"
            accessibilityRole="button"
            accessibilityLabel="Add custom measurement to order"
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text className="ml-2 text-base font-black text-white">Add to Measurement Tape</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-5 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
        <SectionHeader
          icon="receipt-outline"
          title="Billing & Delivery"
          subtitle="Remaining balance updates automatically"
        />
        <View className="mt-5 gap-4">
          <InputField
            label="Total Stitching Bill (Rs.)"
            value={totalBill}
            onChangeText={(value) => setTotalBill(sanitizeMoneyInput(value))}
            placeholder="3500"
            keyboardType="numeric"
            maxLength={MAX_MONEY_LENGTH}
          />
          <InputField
            label="Advance Paid (Rs.)"
            value={advancePaid}
            onChangeText={(value) => setAdvancePaid(sanitizeMoneyInput(value))}
            placeholder="1500"
            keyboardType="numeric"
            maxLength={MAX_MONEY_LENGTH}
          />
          <InputField
            label="Delivery Date"
            value={deliveryDate}
            onChangeText={(value) => setDeliveryDate(value.slice(0, MAX_DELIVERY_DATE_LENGTH))}
            placeholder="30 May 2026"
            icon="calendar-outline"
            maxLength={MAX_DELIVERY_DATE_LENGTH}
          />
        </View>

        <View className="mt-5 rounded-2xl bg-teal-50 p-4">
          <Text className="text-xs font-black uppercase tracking-wide text-thread">
            Remaining Balance
          </Text>
          <Text className="mt-1 text-4xl font-black text-ink">
            Rs. {remainingBalance.toLocaleString()}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleGenerateParchi}
        className={`mt-6 flex-row items-center justify-center rounded-2xl px-5 py-5 ${
          canGenerate ? 'bg-thread' : 'bg-slate-300'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Generate digital parchi"
        disabled={!canGenerate || savingOrder}
      >
        {savingOrder ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Ionicons name="cut-outline" size={23} color="#ffffff" />
        )}
        <Text className="ml-2 text-lg font-black text-white">
          {savingOrder ? 'Saving to Cloud...' : 'Generate Digital Parchi'}
        </Text>
      </Pressable>

      <SuccessModal
        order={latestOrder}
        visible={successVisible}
        onClose={() => setSuccessVisible(false)}
      />
    </Screen>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-row items-center">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
        <Ionicons name={icon} size={24} color="#0f766e" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-xl font-black text-ink">{title}</Text>
        <Text className="mt-1 text-xs font-bold text-slate-500">{subtitle}</Text>
      </View>
    </View>
  );
}

function InputField({
  icon,
  keyboardType = 'default',
  label,
  maxLength,
  onChangeText,
  placeholder,
  value,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View>
      <Text className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        {icon ? <Ionicons name={icon} size={18} color="#0f766e" /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          maxLength={maxLength}
          className={`${icon ? 'ml-2' : ''} flex-1 text-base font-bold text-ink`}
        />
      </View>
    </View>
  );
}

function MeasurementInput({
  field,
  onChange,
  onRemove,
  value,
}: {
  field: MeasurementField;
  onChange: (value: number) => void;
  onRemove?: () => void;
  value: number;
}) {
  const { t } = useLanguage();
  const translatedLabel =
    {
      length: t('measurement.length'),
      shoulders: t('measurement.shoulders'),
      sleeves: t('measurement.sleeves'),
      chest: t('measurement.chest'),
    }[field.key] ?? field.label;
  const handleTextChange = (text: string) => {
    const parsed = Number(text.replace('"', ''));
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <View className="mb-4 rounded-2xl bg-orange-50 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-black text-ink">{translatedLabel}</Text>
          <Text className="mt-1 text-xs font-bold text-slate-500">{field.localName}</Text>
        </View>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-red-50"
            accessibilityRole="button"
            accessibilityLabel={`Remove ${field.label}`}
          >
            <Ionicons name="trash-outline" size={18} color="#b91c1c" />
          </Pressable>
        ) : null}
        <Text className="text-2xl font-black text-thread">{formatInches(value)}</Text>
      </View>

      <View className="flex-row items-center">
        <StepButton
          disabled={value <= 0}
          icon="remove"
          onPress={() => onChange(value - 0.25)}
        />
        <View className="mx-3 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <TextInput
            value={String(value)}
            onChangeText={handleTextChange}
            keyboardType="numeric"
            maxLength={6}
            textAlign="center"
            className="text-xl font-black text-ink"
          />
        </View>
        <StepButton
          disabled={value >= MAX_MEASUREMENT_INCHES}
          icon="add"
          onPress={() => onChange(value + 0.25)}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  disabled = false,
  onPress,
}: {
  disabled?: boolean;
  icon: 'add' | 'remove';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 w-12 items-center justify-center rounded-2xl ${
        disabled ? 'bg-slate-300' : 'bg-ink'
      }`}
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'Increase measurement' : 'Decrease measurement'}
    >
      <Ionicons name={icon} size={24} color="#ffffff" />
    </Pressable>
  );
}

function SuccessModal({
  onClose,
  order,
  visible,
}: {
  onClose: () => void;
  order: SavedOrder | null;
  visible: boolean;
}) {
  const checkScale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (visible) {
      checkScale.setValue(0.4);
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }
  }, [checkScale, visible]);

  const handlePrint = () => {
    Alert.alert('Print Receipt', 'Mocking Bluetooth print for customer receipt.');
  };

  const handleShare = () => {
    Alert.alert('WhatsApp Receipt', 'Mocking WhatsApp share with receipt image/PDF.');
  };

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-muslin px-5 py-10">
        <View className="flex-1 justify-center">
          <Animated.View
            style={{ transform: [{ scale: checkScale }] }}
            className="self-center rounded-full bg-emerald-100 p-6"
          >
            <Ionicons name="checkmark-circle" size={86} color="#16a34a" />
          </Animated.View>

          <Text className="mt-5 text-center text-3xl font-black text-ink">
            Digital Parchi Generated
          </Text>
          <Text className="mt-2 text-center text-lg font-black text-thread">
            {formatCloudOrderId(order.id)}
          </Text>

          <View className="mt-7 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Customer Receipt
                </Text>
                <Text className="mt-1 text-2xl font-black text-ink">{order.customer_name}</Text>
                <Text className="mt-1 text-sm font-bold text-slate-500">
                  {order.customer_mobile}
                </Text>
              </View>
              <View className="items-center justify-center rounded-2xl border-2 border-slate-900 bg-white p-2">
                <ScannableQrCode value={order.qr_code_str ?? `darzi://order/${order.id}`} size={112} />
              </View>
            </View>

            <View className="mt-5 gap-3">
              <ReceiptLine label="Shop" value={activeTailorShopName} />
              <ReceiptLine label="Suit Type" value={order.suit_type} />
              <ReceiptLine label="Delivery Date" value={formatDeliveryLabel(order.delivery_date)} />
              <ReceiptLine label="Total Bill" value={`Rs. ${order.total_bill.toLocaleString()}`} />
              <ReceiptLine label="Advance Paid" value={`Rs. ${order.advance_paid.toLocaleString()}`} />
              <ReceiptLine
                label="Remaining"
                value={`Rs. ${order.remaining_balance.toLocaleString()}`}
                important
              />
            </View>
          </View>
        </View>

        <View className="gap-3">
          <Pressable
            onPress={handlePrint}
            className="flex-row items-center justify-center rounded-2xl bg-ink px-5 py-4"
          >
            <Ionicons name="print-outline" size={21} color="#ffffff" />
            <Text className="ml-2 text-base font-black text-white">Print Receipt (Bluetooth)</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            className="flex-row items-center justify-center rounded-2xl bg-emerald-600 px-5 py-4"
          >
            <FontAwesome name="whatsapp" size={21} color="#ffffff" />
            <Text className="ml-2 text-base font-black text-white">Share Receipt via WhatsApp</Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            className="items-center justify-center rounded-2xl bg-white px-5 py-4"
          >
            <Text className="text-base font-black text-slate-700">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ReceiptLine({
  important = false,
  label,
  value,
}: {
  important?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View className={`flex-row items-center justify-between rounded-2xl px-4 py-3 ${important ? 'bg-teal-50' : 'bg-slate-50'}`}>
      <Text className="text-sm font-bold text-slate-500">{label}</Text>
      <Text className={`text-sm font-black ${important ? 'text-thread' : 'text-ink'}`}>{value}</Text>
    </View>
  );
}
