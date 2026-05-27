import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
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
import {
  clearPendingWhatsAppAuthChallenge,
  loadPendingWhatsAppAuthChallenge,
  savePendingWhatsAppAuthChallenge,
  saveUserRole,
  type PersistedWhatsAppAuthChallenge,
} from '@/utils/persistence';
import {
  createRemoteWhatsAppAuthChallenge,
  createWhatsAppAuthChallenge,
  fetchRemoteWhatsAppAuthStatus,
  isWhatsAppChallengeExpired,
  openWhatsAppAuthMessage,
} from '@/utils/whatsappAuth';
import type { UserType } from '@/types/database';

type AuthStep = 'sendOtp' | 'verifyOtp' | 'whatsappPending';
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

  if (message.toLowerCase().includes('whatsapp_auth_challenges')) {
    return 'WhatsApp login storage is not deployed yet. Run the latest Supabase migration, then try again.';
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
  const [pendingWhatsAppChallenge, setPendingWhatsAppChallenge] =
    useState<PersistedWhatsAppAuthChallenge | null>(null);
  const [tailorShopLocation, setTailorShopLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const normalizedPhoneNumber = useMemo(
    () => normalizePakistanPhone(phoneNumber),
    [phoneNumber],
  );

  const canSendOtp = normalizedPhoneNumber.length >= 12;
  const canVerifyOtp = smsCode.trim().length === 6;
  const busy = loading || whatsappLoading;

  useEffect(() => {
    let active = true;

    async function hydrateWhatsAppChallenge() {
      const challenge = await loadPendingWhatsAppAuthChallenge();
      if (!active || !challenge) return;

      if (isWhatsAppChallengeExpired(challenge)) {
        await clearPendingWhatsAppAuthChallenge();
        return;
      }

      setPendingWhatsAppChallenge(challenge);
      setPhoneNumber(challenge.phone);
      setAccountType(challenge.accountType);
      setAuthStep('whatsappPending');
      setInfoMessage('You have a pending WhatsApp login request. Send the message, then check verification.');
    }

    void hydrateWhatsAppChallenge();

    return () => {
      active = false;
    };
  }, []);

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
    setInfoMessage('');

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
    setInfoMessage('');

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

  const handleStartWhatsAppLogin = async () => {
    setErrorMessage('');
    setInfoMessage('');

    if (!canSendOtp) {
      setErrorMessage('Enter a valid mobile number, for example +923001234567.');
      return;
    }

    setWhatsappLoading(true);

    try {
      const challenge = createWhatsAppAuthChallenge(normalizedPhoneNumber, accountType);
      const client = assertSupabaseClient();

      await createRemoteWhatsAppAuthChallenge(client, challenge);
      await savePendingWhatsAppAuthChallenge(challenge);
      await openWhatsAppAuthMessage(challenge);

      setPendingWhatsAppChallenge(challenge);
      setPhoneNumber(challenge.phone);
      setAuthStep('whatsappPending');
      setInfoMessage('WhatsApp opened with your Darzi login code. Send the message, then return here.');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleReopenWhatsAppLogin = async () => {
    if (!pendingWhatsAppChallenge) return;

    setErrorMessage('');
    setInfoMessage('');
    setWhatsappLoading(true);

    try {
      await openWhatsAppAuthMessage(pendingWhatsAppChallenge);
      setInfoMessage('WhatsApp opened again. Send the exact pre-filled message to continue.');
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleCheckWhatsAppVerification = async () => {
    setErrorMessage('');
    setInfoMessage('');

    if (!pendingWhatsAppChallenge) {
      setErrorMessage('Start a WhatsApp login request first.');
      setAuthStep('sendOtp');
      return;
    }

    if (isWhatsAppChallengeExpired(pendingWhatsAppChallenge)) {
      await clearPendingWhatsAppAuthChallenge();
      setPendingWhatsAppChallenge(null);
      setAuthStep('sendOtp');
      setErrorMessage('That WhatsApp login code expired. Start a fresh WhatsApp login request.');
      return;
    }

    setWhatsappLoading(true);

    try {
      const client = assertSupabaseClient();
      const status = await fetchRemoteWhatsAppAuthStatus(client, pendingWhatsAppChallenge);

      if (!status || status.status === 'pending') {
        setInfoMessage('Still waiting for the Darzi WhatsApp webhook to verify this message.');
        return;
      }

      if (status.status === 'expired') {
        await clearPendingWhatsAppAuthChallenge();
        setPendingWhatsAppChallenge(null);
        setAuthStep('sendOtp');
        setErrorMessage('That WhatsApp login code expired. Start a fresh request.');
        return;
      }

      if (status.status === 'rejected') {
        await clearPendingWhatsAppAuthChallenge();
        setPendingWhatsAppChallenge(null);
        setAuthStep('sendOtp');
        setErrorMessage('WhatsApp verification was rejected. Please check the phone number and try again.');
        return;
      }

      const { data, error } = await client.auth.signInAnonymously();

      if (error) {
        throw new Error(
          'WhatsApp verified, but Supabase anonymous sign-in is not enabled yet. Enable Anonymous Sign-Ins or connect the verification Edge Function to issue a session.',
        );
      }

      const userId = data?.user?.id ?? data?.session?.user?.id;
      if (!userId) {
        throw new Error('WhatsApp verified, but the app could not create a Supabase session.');
      }

      const signupLocation =
        pendingWhatsAppChallenge.accountType === 'tailor'
          ? tailorShopLocation ?? (await captureTailorShopLocation(false))
          : null;

      await initializeProfile(
        userId,
        status.phone,
        pendingWhatsAppChallenge.accountType,
        signupLocation,
      );
      await clearPendingWhatsAppAuthChallenge();
      setPendingWhatsAppChallenge(null);
      goToMainApp();
    } catch (error) {
      setErrorMessage(getReadableAuthError(error));
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleUseSmsInstead = async () => {
    setErrorMessage('');
    setInfoMessage('');
    await clearPendingWhatsAppAuthChallenge();
    setPendingWhatsAppChallenge(null);
    setAuthStep('sendOtp');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="justify-center"
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
            {authStep === 'sendOtp'
              ? 'Verify your phone'
              : authStep === 'verifyOtp'
                ? 'Enter SMS code'
                : 'Send WhatsApp code'}
          </Text>
          <Text className="mt-3 text-base font-semibold leading-6 text-white/75">
            {authStep === 'sendOtp'
              ? 'Use your mobile number to access customer parchis, tailor dashboard, and cloud orders.'
              : authStep === 'verifyOtp'
                ? `We sent a 6-digit verification code to ${normalizedPhoneNumber}.`
                : 'Open WhatsApp, send your Darzi code to our business number, then return to verify.'}
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

          {infoMessage ? (
            <View className="mb-4 flex-row rounded-2xl bg-emerald-50 px-4 py-3">
              <Ionicons name="information-circle-outline" size={20} color="#047857" />
              <Text className="ml-2 flex-1 text-sm font-bold leading-5 text-emerald-800">
                {infoMessage}
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
                disabled={!canSendOtp || busy}
                icon="logo-whatsapp"
                label="Sign in with WhatsApp (Free)"
                loading={whatsappLoading}
                variant="whatsapp"
                onPress={handleStartWhatsAppLogin}
              />

              <View className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3">
                <Text className="text-xs font-bold leading-5 text-emerald-800">
                  This opens WhatsApp with a unique Darzi code. Because you send the first message,
                  the login request uses Meta's customer-initiated service window instead of paid SMS.
                </Text>
              </View>

              <PrimaryButton
                disabled={!canSendOtp || busy}
                icon="send-outline"
                label="Use SMS OTP Instead"
                loading={loading}
                onPress={handleSendOtp}
              />

              {__DEV__ ? (
                <DemoButton disabled={busy} onPress={handleDemoLogin} />
              ) : null}
            </>
          ) : authStep === 'verifyOtp' ? (
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
                disabled={!canVerifyOtp || busy}
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
                disabled={busy}
                className="mt-4 items-center rounded-2xl bg-slate-50 px-5 py-4"
                accessibilityRole="button"
              >
                <Text className="text-sm font-black text-slate-600">Change phone number</Text>
              </Pressable>

              {__DEV__ ? (
                <DemoButton disabled={busy} onPress={handleDemoLogin} />
              ) : null}
            </>
          ) : (
            <WhatsAppPendingPanel
              challenge={pendingWhatsAppChallenge}
              loading={whatsappLoading}
              onCheck={handleCheckWhatsAppVerification}
              onOpen={handleReopenWhatsAppLogin}
              onUseSms={handleUseSmsInstead}
            />
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

function WhatsAppPendingPanel({
  challenge,
  loading,
  onCheck,
  onOpen,
  onUseSms,
}: {
  challenge: PersistedWhatsAppAuthChallenge | null;
  loading: boolean;
  onCheck: () => void;
  onOpen: () => void;
  onUseSms: () => void;
}) {
  return (
    <View>
      <View className="items-center rounded-[26px] bg-emerald-50 px-5 py-5">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white">
          <FontAwesome name="whatsapp" size={34} color="#16a34a" />
        </View>
        <Text className="mt-3 text-sm font-black uppercase tracking-wide text-emerald-700">
          WhatsApp Login Code
        </Text>
        <Text className="mt-2 text-4xl font-black tracking-[2px] text-ink">
          {challenge?.challengeCode ?? 'DZ------'}
        </Text>
        <Text className="mt-3 text-center text-sm font-bold leading-5 text-slate-600">
          Send the pre-filled WhatsApp message from {challenge?.phone ?? 'your phone'}.
          Darzi will verify the inbound message through the WhatsApp Business webhook.
        </Text>
        {challenge ? (
          <Text className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-emerald-700">
            Expires {new Date(challenge.expiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : null}
      </View>

      <PrimaryButton
        disabled={loading || !challenge}
        icon="logo-whatsapp"
        label="Open WhatsApp Again"
        loading={false}
        variant="whatsapp"
        onPress={onOpen}
      />

      <PrimaryButton
        disabled={loading || !challenge}
        icon="refresh-outline"
        label="I Sent It - Check Verification"
        loading={loading}
        onPress={onCheck}
      />

      <Pressable
        onPress={onUseSms}
        disabled={loading}
        className="mt-4 items-center rounded-2xl bg-slate-50 px-5 py-4"
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
      >
        <Text className="text-sm font-black text-slate-600">Use SMS OTP instead</Text>
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
  variant = 'primary',
  onPress,
}: {
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading: boolean;
  variant?: 'primary' | 'whatsapp';
  onPress: () => void;
}) {
  const enabledClassName = variant === 'whatsapp' ? 'bg-emerald-600' : 'bg-thread';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mt-5 flex-row items-center justify-center rounded-2xl px-5 py-4 ${
        disabled ? 'bg-slate-300' : enabledClassName
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
