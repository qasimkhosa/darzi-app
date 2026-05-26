import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { requestCurrentCoordinates, type Coordinates } from '@/utils/location';
import { saveUserRole } from '@/utils/persistence';
import type { UserType } from '@/types/database';

type AuthStep = 'sendOtp' | 'verifyOtp';
type AccountType = Extract<UserType, 'customer' | 'tailor'>;

function normalizePakistanPhone(input: string) {
  const trimmedPhone = input.trim().replace(/\s+/g, '');

  if (trimmedPhone.startsWith('+')) {
    return trimmedPhone;
  }

  if (trimmedPhone.startsWith('0092')) {
    return `+${trimmedPhone.slice(2)}`;
  }

  if (trimmedPhone.startsWith('92')) {
    return `+${trimmedPhone}`;
  }

  if (trimmedPhone.startsWith('0')) {
    return `+92${trimmedPhone.slice(1)}`;
  }

  return `+92${trimmedPhone}`;
}

function getReadableAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes('phone')) {
    return 'Please enter a valid phone number with country code, for example +923001234567.';
  }

  if (message.toLowerCase().includes('token') || message.toLowerCase().includes('otp')) {
    return 'The verification code is invalid or expired. Please check the SMS and try again.';
  }

  return message || 'Authentication failed. Please try again.';
}

function assertSupabaseClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return supabase as any;
}

async function initializeProfile(
  userId: string,
  phone: string,
  selectedAccountType: AccountType,
  tailorShopLocation: Coordinates | null,
) {
  const client = assertSupabaseClient();

  const { data: existingProfile, error: lookupError } = await client
    .from('profiles')
    .select('id,user_type')
    .eq('id', userId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingProfile?.user_type) {
    await saveUserRole(existingProfile.user_type);
    return existingProfile.user_type as AccountType;
  }

  const { error: profileInsertError } = await client.from('profiles').insert({
    id: userId,
    phone,
    user_type: selectedAccountType,
    full_name: null,
    created_at: new Date().toISOString(),
  });

  if (profileInsertError) {
    throw profileInsertError;
  }

  if (selectedAccountType === 'tailor') {
    const { error: tailorInsertError } = await client.from('tailor_profiles').insert({
      id: userId,
      shop_name: 'New Darzi Shop',
      address: null,
      location_lat: tailorShopLocation?.latitude ?? null,
      location_lng: tailorShopLocation?.longitude ?? null,
      pricing_json: {},
      expertise_tags: [],
      rating: 5,
    });

    if (tailorInsertError) {
      throw tailorInsertError;
    }
  }

  await saveUserRole(selectedAccountType);
  return selectedAccountType;
}

export function AuthScreen() {
  const navigation = useNavigation<any>();
  const [authStep, setAuthStep] = useState<AuthStep>('sendOtp');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [phoneNumber, setPhoneNumber] = useState('+92');
  const [smsCode, setSmsCode] = useState('');
  const [tailorShopLocation, setTailorShopLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const normalizedPhoneNumber = useMemo(
    () => normalizePakistanPhone(phoneNumber),
    [phoneNumber],
  );

  const canSendOtp = normalizedPhoneNumber.length >= 12;
  const canVerifyOtp = smsCode.trim().length === 6;

  const goToMainApp = () => {
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs' }],
    });
  };

  const captureTailorShopLocation = async (showDeniedMessage = true) => {
    setLocationMessage('');
    setLocationLoading(true);

    try {
      const result = await requestCurrentCoordinates();

      if (!result.granted) {
        if (showDeniedMessage) {
          setLocationMessage('Location was not saved. Customers can still find you by Darzi ID.');
        }

        return null;
      }

      setTailorShopLocation(result.coordinates);
      setLocationMessage('Shop location saved for Near Me discovery.');

      return result.coordinates;
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      await saveUserRole(accountType);
      goToMainApp();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setErrorMessage('');

    if (!canSendOtp) {
      setErrorMessage('Enter a valid mobile number, for example +923001234567.');
      return;
    }

    setLoading(true);

    try {
      const client = assertSupabaseClient();
      const { error } = await client.auth.signInWithOtp({
        phone: normalizedPhoneNumber,
      });

      if (error) {
        throw error;
      }

      setPhoneNumber(normalizedPhoneNumber);
      setAuthStep('verifyOtp');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage('');

    if (!canVerifyOtp) {
      setErrorMessage('Enter the 6-digit SMS code sent to your phone.');
      return;
    }

    setLoading(true);

    try {
      const client = assertSupabaseClient();
      const { data, error } = await client.auth.verifyOtp({
        phone: normalizedPhoneNumber,
        token: smsCode.trim(),
        type: 'sms',
      });

      if (error) {
        throw error;
      }

      const userId = data?.user?.id ?? data?.session?.user?.id;
      if (!userId) {
        throw new Error('Could not read authenticated user after OTP verification.');
      }

      const signupLocation =
        accountType === 'tailor'
          ? tailorShopLocation ?? (await captureTailorShopLocation(false))
          : null;

      await initializeProfile(userId, normalizedPhoneNumber, accountType, signupLocation);
      goToMainApp();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center"
      >
        <View className="overflow-hidden rounded-[34px] bg-ink p-5 shadow-sm">
          <View className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-thread/50" />
          <View className="absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-amber-500/35" />
          <View className="h-16 w-16 items-center justify-center rounded-[24px] bg-white/10">
            <Ionicons name="cut-outline" size={34} color="#fbbf24" />
          </View>
          <Text className="mt-6 text-xs font-black uppercase tracking-[2px] text-amber-300">
            Darzi Secure Login
          </Text>
          <Text className="mt-3 text-4xl font-black leading-[44px] text-white">
            {authStep === 'sendOtp' ? 'Verify your phone' : 'Enter SMS code'}
          </Text>
          <Text className="mt-3 text-base font-semibold leading-6 text-white/75">
            {authStep === 'sendOtp'
              ? 'Use your mobile number to access customer parchis, tailor dashboard, and cloud orders.'
              : `We sent a 6-digit verification code to ${normalizedPhoneNumber}.`}
          </Text>
        </View>

        <View className="mt-5 rounded-[30px] border border-orange-100 bg-white p-5 shadow-sm">
          {errorMessage ? (
            <View className="mb-4 flex-row rounded-2xl bg-red-50 px-4 py-3">
              <Ionicons name="warning-outline" size={20} color="#dc2626" />
              <Text className="ml-2 flex-1 text-sm font-bold leading-5 text-red-700">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {authStep === 'sendOtp' ? (
            <>
              <Text className="text-xs font-black uppercase tracking-wide text-slate-500">
                Account Type
              </Text>
              <View className="mt-3 flex-row rounded-2xl bg-slate-100 p-1">
                <AccountTypeButton
                  active={accountType === 'customer'}
                  icon="person-outline"
                  label="I am a Customer"
                  onPress={() => setAccountType('customer')}
                />
                <AccountTypeButton
                  active={accountType === 'tailor'}
                  icon="storefront-outline"
                  label="I am a Tailor"
                  onPress={() => setAccountType('tailor')}
                />
              </View>

              {accountType === 'tailor' ? (
                <TailorLocationPermissionCard
                  coordinates={tailorShopLocation}
                  loading={locationLoading}
                  message={locationMessage}
                  onCapture={() => {
                    void captureTailorShopLocation();
                  }}
                />
              ) : null}

              <Text className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">
                Mobile Number
              </Text>
              <View className="mt-2 flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <FontAwesome name="phone" size={18} color="#0f766e" />
                <TextInput
                  value={phoneNumber}
                  onChangeText={(value) => setPhoneNumber(value.replace(/[^\d+]/g, '').slice(0, 16))}
                  editable={!loading}
                  keyboardType="phone-pad"
                  maxLength={16}
                  placeholder="+923001234567"
                  placeholderTextColor="#94a3b8"
                  className="ml-3 flex-1 text-lg font-black text-ink"
                />
              </View>

              <PrimaryButton
                disabled={!canSendOtp || loading}
                icon="send-outline"
                label="Send Verification Code"
                loading={loading}
                onPress={handleSendOtp}
              />

              {__DEV__ ? (
                <DemoButton disabled={loading} onPress={handleDemoLogin} />
              ) : null}
            </>
          ) : (
            <>
              <View className="items-center rounded-[26px] bg-teal-50 px-5 py-5">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white">
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color="#0f766e" />
                </View>
                <Text className="mt-3 text-sm font-black uppercase tracking-wide text-thread">
                  Enter 6-Digit Code
                </Text>
                <TextInput
                  value={smsCode}
                  onChangeText={(value) => setSmsCode(value.replace(/\D/g, '').slice(0, 6))}
                  editable={!loading}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  placeholder="000000"
                  placeholderTextColor="#94a3b8"
                  className="mt-3 w-full rounded-2xl bg-white px-5 py-4 text-center text-3xl font-black tracking-[8px] text-ink"
                />
              </View>

              <PrimaryButton
                disabled={!canVerifyOtp || loading}
                icon="checkmark-circle-outline"
                label="Verify & Login"
                loading={loading}
                onPress={handleVerifyOtp}
              />

              <Pressable
                onPress={() => {
                  setAuthStep('sendOtp');
                  setSmsCode('');
                  setErrorMessage('');
                }}
                disabled={loading}
                className="mt-4 items-center rounded-2xl bg-slate-50 px-5 py-4"
                accessibilityRole="button"
              >
                <Text className="text-sm font-black text-slate-600">Change phone number</Text>
              </Pressable>

              {__DEV__ ? (
                <DemoButton disabled={loading} onPress={handleDemoLogin} />
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function DemoButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mt-4 flex-row items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-teal-50 px-5 py-4"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons name="construct-outline" size={19} color="#0f766e" />
      <Text className="ml-2 text-sm font-black text-thread">Continue in Demo Mode</Text>
    </Pressable>
  );
}

function TailorLocationPermissionCard({
  coordinates,
  loading,
  message,
  onCapture,
}: {
  coordinates: Coordinates | null;
  loading: boolean;
  message: string;
  onCapture: () => void;
}) {
  return (
    <View className="mt-4 rounded-[24px] border border-teal-100 bg-teal-50 p-4">
      <View className="flex-row items-start">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white">
          <Ionicons name="location-outline" size={22} color="#0f766e" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-black text-ink">Save shop location</Text>
          <Text className="mt-1 text-xs font-bold leading-5 text-slate-600">
            This lets customers discover your shop through Near Me, distance, and rating filters.
          </Text>
        </View>
      </View>

      {coordinates ? (
        <View className="mt-3 rounded-2xl bg-white px-4 py-3">
          <Text className="text-xs font-black uppercase tracking-wide text-thread">
            GPS saved
          </Text>
          <Text className="mt-1 text-xs font-bold text-slate-500">
            {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
          </Text>
        </View>
      ) : null}

      {message ? (
        <Text className="mt-3 text-xs font-bold leading-5 text-slate-600">{message}</Text>
      ) : null}

      <Pressable
        onPress={onCapture}
        disabled={loading}
        className={`mt-3 flex-row items-center justify-center rounded-2xl px-4 py-3 ${
          loading ? 'bg-slate-300' : 'bg-thread'
        }`}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Ionicons name={coordinates ? 'refresh-outline' : 'navigate-outline'} size={18} color="#ffffff" />
        )}
        <Text className="ml-2 text-sm font-black text-white">
          {coordinates ? 'Update Shop Location' : 'Allow & Save Location'}
        </Text>
      </Pressable>
    </View>
  );
}

function AccountTypeButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center rounded-xl px-3 py-3 ${
        active ? 'bg-thread' : 'bg-transparent'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={17} color={active ? '#ffffff' : '#64748b'} />
      <Text className={`ml-2 text-xs font-black ${active ? 'text-white' : 'text-slate-500'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  disabled,
  icon,
  label,
  loading,
  onPress,
}: {
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mt-5 flex-row items-center justify-center rounded-2xl px-5 py-4 ${
        disabled ? 'bg-slate-300' : 'bg-thread'
      }`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Ionicons name={icon} size={21} color="#ffffff" />
      )}
      <Text className="ml-2 text-base font-black text-white">{label}</Text>
    </Pressable>
  );
}
