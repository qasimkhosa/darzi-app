import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { ScannableQrCode } from '@/components/ScannableQrCode';
import { type TranslationKey, useLanguage } from '@/context/LanguageContext';
import { type SocialFeedPost, useSocialFeed } from '@/contexts/SocialFeedContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProfileStackParamList } from '@/navigation/types';
import {
  activeTailorDarziId,
  activeTailorShopName,
  fetchAuthenticatedProfilePhone,
  fetchCloudOrdersByCustomerMobile,
  formatCloudOrderId,
  formatDeliveryLabel,
  formatMeasurementLabel,
  jsonToMeasurementRecord,
  toCustomerParchiStatus,
  type CloudOrder,
} from '@/utils/cloudOrders';
import {
  loadLocalReviews,
  loadUserRole,
  saveLocalReviews,
  saveUserRole,
  type PersistedReview,
} from '@/utils/persistence';
import {
  DigitalParchiModal,
  type DigitalParchiReceipt,
} from '@/screens/customer/DigitalParchiModal';
import {
  ReviewSubmissionModal,
  type ReviewSubmission,
} from '@/screens/customer/ReviewSubmissionModal';
import { TailorOrdersDashboard } from '@/screens/tailor/TailorOrdersDashboard';
import { buildTailorDeepLink } from '@/utils/deepLinks';

type ProfileRole = 'customer' | 'tailor';
type CustomerProfileTab = 'tracking' | 'styleBoard';
type VaultMeasurement = {
  id: string;
  label: string;
  labelKey?: TranslationKey;
  value: string;
  custom?: boolean;
};

const defaultVaultMeasurements: VaultMeasurement[] = [
  { id: 'kameezLength', labelKey: 'measurement.kameezLength', label: 'Kameez Length', value: '40"' },
  { id: 'chest', labelKey: 'measurement.chest', label: 'Chest / Chaati', value: '22"' },
  { id: 'sleeves', labelKey: 'measurement.sleeves', label: 'Sleeves / Aasteen', value: '23"' },
  { id: 'shoulders', labelKey: 'measurement.shoulders', label: 'Shoulders / Teera', value: '18"' },
  { id: 'shalwarLength', labelKey: 'measurement.shalwarLength', label: 'Shalwar Length', value: '38"' },
  { id: 'collar', labelKey: 'measurement.collar', label: 'Collar', value: '15.5"' },
];

function normalizeMeasurementValue(value: string) {
  const cleanedValue = value.replace(/[^\d.]/g, '').slice(0, 6);
  return cleanedValue.length > 0 ? `${cleanedValue}"` : '';
}

function cloudOrderToDigitalParchi(order: CloudOrder): DigitalParchiReceipt {
  const measurementRecord = jsonToMeasurementRecord(order.measurements_json);
  const measurementsFromOrder = Object.entries(measurementRecord).map(([key, value]) => ({
    label: formatMeasurementLabel(key),
    value: `${value}"`,
  }));

  return {
    id: order.id,
    tailorName: activeTailorShopName,
    darziId: activeTailorDarziId,
    orderId: formatCloudOrderId(order.id),
    itemType: order.suit_type,
    dueDateIso: order.delivery_date,
    estimatedDelivery: formatDeliveryLabel(order.delivery_date),
    status: toCustomerParchiStatus(order.status),
    qrPayload: order.qr_code_str ?? `darzi://order/${encodeURIComponent(order.id)}`,
    totalFee: order.total_bill,
    advancePaid: order.advance_paid,
    measurements: measurementsFromOrder.length > 0 ? measurementsFromOrder : [
      { label: 'Measurements', value: 'Saved' },
    ],
  };
}

function mergeCloudOrderParchi(currentParchis: DigitalParchiReceipt[], cloudOrder: CloudOrder) {
  const incomingParchi = cloudOrderToDigitalParchi(cloudOrder);
  const dedupedParchis = currentParchis.filter((parchi) => parchi.id !== incomingParchi.id);

  return [incomingParchi, ...dedupedParchis].sort(
    (a, b) => new Date(b.dueDateIso).getTime() - new Date(a.dueDateIso).getTime(),
  );
}

const shopMetrics = [
  {
    id: 'orders',
    label: 'Total Active Orders',
    value: '26',
    helper: '8 due this week',
    icon: 'albums-outline',
    tone: 'teal',
  },
  {
    id: 'earnings',
    label: 'Monthly Earnings (Rs.)',
    value: '186,500',
    helper: '+18% vs last month',
    icon: 'cash-outline',
    tone: 'amber',
  },
  {
    id: 'rating',
    label: 'Average Rating',
    value: '4.8',
    helper: '218 customer reviews',
    icon: 'star-outline',
    tone: 'slate',
  },
] as const;

export function ProfileScreen() {
  const { t } = useLanguage();
  const [activeRole, setActiveRole] = useState<ProfileRole>('customer');
  const [roleHydrated, setRoleHydrated] = useState(false);
  const canSwitchRoles = __DEV__;

  useEffect(() => {
    let active = true;

    async function hydrateRole() {
      const localRole = await loadUserRole();

      if (!active) return;

      if (localRole) {
        setActiveRole(localRole);
      }

      setRoleHydrated(true);
    }

    void hydrateRole();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (roleHydrated) {
      void saveUserRole(activeRole);
    }
  }, [activeRole, roleHydrated]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-3xl font-black text-ink">{t('profile.title')}</Text>
          <Text className="mt-2 text-base leading-6 text-slate-600">
            {t('profile.subtitle')}
          </Text>
        </View>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
          <Ionicons name={activeRole === 'customer' ? 'person-outline' : 'storefront-outline'} size={26} color="#0f766e" />
        </View>
      </View>

      {canSwitchRoles ? <RoleSwitcher activeRole={activeRole} onChange={setActiveRole} /> : null}

      {activeRole === 'customer' ? <CustomerProfileView /> : <TailorDashboardView />}
    </Screen>
  );
}

function RoleSwitcher({
  activeRole,
  onChange,
}: {
  activeRole: ProfileRole;
  onChange: (role: ProfileRole) => void;
}) {
  const { t } = useLanguage();

  return (
    <View className="mt-6 rounded-2xl bg-white p-1 shadow-sm">
      <View className="flex-row">
        <RoleButton
          active={activeRole === 'customer'}
          icon="person-outline"
          label={t('profile.viewCustomer')}
          onPress={() => onChange('customer')}
        />
        <RoleButton
          active={activeRole === 'tailor'}
          icon="cut-outline"
          label={t('profile.viewTailor')}
          onPress={() => onChange('tailor')}
        />
      </View>
    </View>
  );
}

function RoleButton({
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
      <Ionicons name={icon} size={18} color={active ? '#ffffff' : '#64748b'} />
      <Text className={`ml-2 text-xs font-black ${active ? 'text-white' : 'text-slate-500'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function LanguageActionRow() {
  const { language, t, toggleLanguage } = useLanguage();
  const nextLanguageLabel = language === 'ur' ? 'English' : 'اردو';

  return (
    <Pressable
      onPress={() => {
        void toggleLanguage();
      }}
      className="mb-5 flex-row items-center rounded-[24px] border border-teal-100 bg-white px-5 py-4 shadow-sm"
      accessibilityRole="button"
      accessibilityLabel="Change app language"
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
        <Ionicons name="language-outline" size={24} color="#0f766e" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-black text-ink">{t('language.change')}</Text>
        <Text className="mt-1 text-xs font-bold text-slate-500">
          {language === 'ur' ? t('language.currentUrdu') : t('language.currentEnglish')}
        </Text>
      </View>
      <View className="rounded-full bg-ink px-3 py-2">
        <Text className="text-xs font-black text-white">{nextLanguageLabel}</Text>
      </View>
    </Pressable>
  );
}

function CustomerProfileView() {
  const { t } = useLanguage();
  const { posts, savedPostIds, toggleBookmarkPost } = useSocialFeed();
  const [activeCustomerTab, setActiveCustomerTab] = useState<CustomerProfileTab>('tracking');
  const [customerMobile, setCustomerMobile] = useState<string | null>(null);
  const [customerParchis, setCustomerParchis] = useState<DigitalParchiReceipt[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedParchi, setSelectedParchi] = useState<DigitalParchiReceipt | null>(null);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<DigitalParchiReceipt | null>(null);
  const [selectedStylePost, setSelectedStylePost] = useState<SocialFeedPost | null>(null);
  const [reviews, setReviews] = useState<PersistedReview[]>([]);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Record<string, true>>({});
  const [tailorRatings, setTailorRatings] = useState<Record<number, { averageRating: number; reviewCount: number }>>({
    118: { averageRating: 4.9, reviewCount: 86 },
    433: { averageRating: 4.8, reviewCount: 218 },
    567: { averageRating: 4.7, reviewCount: 143 },
    901: { averageRating: 4.9, reviewCount: 51 },
  });

  const handleReviewSubmit = (submission: ReviewSubmission) => {
    const nextReview: PersistedReview = {
      id: `review-${submission.orderId}-${Date.now()}`,
      orderId: submission.orderId,
      tailorId: submission.tailorId,
      rating: submission.rating,
      feedback: submission.feedback,
      createdAt: new Date().toISOString(),
    };
    const nextReviews = [nextReview, ...reviews.filter((review) => review.orderId !== submission.orderId)];
    setReviews(nextReviews);
    void saveLocalReviews(nextReviews);
    setReviewedOrderIds((current) => ({
      ...current,
      [submission.orderId]: true,
    }));
    setTailorRatings((current) => {
      const existingRating = current[submission.tailorId] ?? {
        averageRating: 5,
        reviewCount: 0,
      };
      const nextReviewCount = existingRating.reviewCount + 1;
      const nextAverageRating = Number(
        (
          (existingRating.averageRating * existingRating.reviewCount + submission.rating) /
          nextReviewCount
        ).toFixed(1),
      );

      return {
        ...current,
        [submission.tailorId]: {
          averageRating: nextAverageRating,
          reviewCount: nextReviewCount,
        },
      };
    });
  };

  useEffect(() => {
    let active = true;

    async function hydrateReviews() {
      const localReviews = await loadLocalReviews();
      if (!active) return;

      setReviews(localReviews);
      setReviewedOrderIds(
        localReviews.reduce<Record<string, true>>((next, review) => {
          return {
            ...next,
            [review.orderId]: true,
          };
        }, {}),
      );
    }

    void hydrateReviews();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrateCustomerProfile() {
      try {
        const profilePhone = await fetchAuthenticatedProfilePhone();
        if (active) {
          setCustomerMobile(profilePhone);
        }
      } catch (error) {
        console.error('[CustomerProfileView] Failed to load customer profile phone', error);
        if (active) {
          setCustomerMobile(null);
        }
      }
    }

    void hydrateCustomerProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrateCustomerOrders() {
      if (!customerMobile) {
        setCustomerParchis([]);
        return;
      }

      setOrdersLoading(true);

      try {
        const cloudOrders = await fetchCloudOrdersByCustomerMobile(customerMobile);
        if (!active) return;

        setCustomerParchis(cloudOrders.map(cloudOrderToDigitalParchi));
      } catch (error) {
        console.error('[CustomerProfileView] Failed to load customer cloud orders', error);
      } finally {
        if (active) {
          setOrdersLoading(false);
        }
      }
    }

    void hydrateCustomerOrders();

    return () => {
      active = false;
    };
  }, [customerMobile]);

  useEffect(() => {
    if (!customerMobile || !isSupabaseConfigured || !supabase) return undefined;
    const supabaseClient = supabase;

    const channel = supabaseClient
      .channel('public:orders:customer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_mobile=eq.${customerMobile}`,
        },
        (payload) => {
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            setCustomerParchis((currentParchis) =>
              mergeCloudOrderParchi(currentParchis, payload.new as CloudOrder),
            );
            return;
          }

          if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
            const deletedOrderId = (payload.old as { id?: unknown }).id;
            if (typeof deletedOrderId === 'string') {
              setCustomerParchis((currentParchis) =>
                currentParchis.filter((parchi) => parchi.id !== deletedOrderId),
              );
            }
          }
        },
      )
      .subscribe((status, error) => {
        if (__DEV__ && (error || status === 'CHANNEL_ERROR')) {
          console.info('[CustomerProfileView] Realtime customer orders unavailable, continuing locally', error);
        }
      });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [customerMobile]);

  useEffect(() => {
    if (!selectedParchi) return;

    const refreshedParchi = customerParchis.find((parchi) => parchi.id === selectedParchi.id);
    if (refreshedParchi && refreshedParchi.status !== selectedParchi.status) {
      setSelectedParchi(refreshedParchi);
    }
  }, [customerParchis, selectedParchi]);

  const savedPosts = useMemo(() => {
    return savedPostIds
      .map((postId) => posts.find((post) => post.id === postId))
      .filter((post): post is SocialFeedPost => post !== undefined);
  }, [posts, savedPostIds]);

  return (
    <View className="mt-6">
      <LanguageActionRow />
      <MeasurementVaultCard />
      <View className="mt-6">
        <View className="rounded-[28px] border border-orange-100 bg-white p-2 shadow-sm">
          <View className="flex-row">
            <CustomerSectionTab
              active={activeCustomerTab === 'tracking'}
              count={customerParchis.length}
              countLabel="orders"
              icon="receipt-outline"
              label={t('profile.trackingParchis')}
              onPress={() => setActiveCustomerTab('tracking')}
            />
            <CustomerSectionTab
              active={activeCustomerTab === 'styleBoard'}
              count={savedPosts.length}
              countLabel="saved"
              icon="bookmark-outline"
              label={t('profile.styleBoard')}
              onPress={() => setActiveCustomerTab('styleBoard')}
            />
          </View>
        </View>

        {activeCustomerTab === 'tracking' ? (
          <View className="mt-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-black text-ink">{t('profile.activeParchis')}</Text>
              <View className="flex-row items-center">
                {ordersLoading ? <ActivityIndicator color="#0f766e" size="small" /> : null}
                <Text className="ml-2 text-sm font-bold text-slate-500">
                  {customerParchis.length} orders
                </Text>
              </View>
            </View>
            <View className="mt-4 gap-4">
              {customerParchis.length > 0 ? (
                customerParchis.map((parchi) => (
                  <ParchiCard
                    key={parchi.id}
                    averageRating={tailorRatings[parchi.darziId]?.averageRating}
                    onPress={() => setSelectedParchi(parchi)}
                    onReviewPress={(event) => {
                      event.stopPropagation();
                      setSelectedReviewOrder(parchi);
                    }}
                    parchi={parchi}
                    reviewed={reviewedOrderIds[parchi.id] === true}
                  />
                ))
              ) : (
                <View className="rounded-[24px] border border-dashed border-orange-200 bg-white p-5">
                  <Text className="text-lg font-black text-ink">No active parchis found</Text>
                  <Text className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Orders will appear here when they are linked to your authenticated phone number.
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <StyleBoardSection
            onPostPress={setSelectedStylePost}
            savedPosts={savedPosts}
          />
        )}
      </View>
      <DigitalParchiModal
        onClose={() => setSelectedParchi(null)}
        parchi={selectedParchi}
        visible={selectedParchi !== null}
      />
      <ReviewSubmissionModal
        onClose={() => setSelectedReviewOrder(null)}
        onSubmit={handleReviewSubmit}
        targetOrder={selectedReviewOrder}
        visible={selectedReviewOrder !== null}
      />
      <StyleBoardDetailModal
        onClose={() => setSelectedStylePost(null)}
        onToggleBookmark={toggleBookmarkPost}
        post={selectedStylePost}
        visible={selectedStylePost !== null}
      />
    </View>
  );
}

function CustomerSectionTab({
  active,
  count,
  countLabel,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count: number;
  countLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-[22px] px-3 py-3 ${active ? 'bg-thread' : 'bg-transparent'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View className="flex-row items-center justify-center">
        <Ionicons name={icon} size={17} color={active ? '#ffffff' : '#64748b'} />
        <Text className={`ml-2 text-xs font-black ${active ? 'text-white' : 'text-slate-500'}`}>
          {label}
        </Text>
      </View>
      <Text className={`mt-1 text-center text-[11px] font-bold ${active ? 'text-white/80' : 'text-slate-400'}`}>
        {count} {countLabel}
      </Text>
    </Pressable>
  );
}

function StyleBoardSection({
  onPostPress,
  savedPosts,
}: {
  onPostPress: (post: SocialFeedPost) => void;
  savedPosts: SocialFeedPost[];
}) {
  const { t } = useLanguage();

  return (
    <View className="mt-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-black text-ink">{t('profile.savedDesigns')}</Text>
          <Text className="mt-1 text-xs font-bold leading-5 text-slate-500">
            {t('profile.styleBoardHelper')}
          </Text>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
          <Ionicons name="grid-outline" size={21} color="#0f766e" />
        </View>
      </View>

      {savedPosts.length > 0 ? (
        <FlatList
          data={savedPosts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          scrollEnabled={false}
          className="mt-4"
          renderItem={({ item, index }) => (
            <StyleBoardCard
              index={index}
              onPress={() => onPostPress(item)}
              post={item}
            />
          )}
        />
      ) : (
        <View className="mt-4 rounded-[28px] border border-dashed border-amber-200 bg-amber-50 p-6">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white">
            <Ionicons name="bookmark-outline" size={28} color="#d97706" />
          </View>
          <Text className="mt-4 text-2xl font-black text-ink">
            {t('profile.emptyStyleBoardTitle')}
          </Text>
          <Text className="mt-2 text-base font-semibold leading-7 text-slate-600">
            {t('profile.emptyStyleBoardBody')}
          </Text>
        </View>
      )}
    </View>
  );
}

function StyleBoardCard({
  index,
  onPress,
  post,
}: {
  index: number;
  onPress: () => void;
  post: SocialFeedPost;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-4 flex-1 overflow-hidden rounded-[24px] bg-white shadow-sm ${
        index % 2 === 0 ? 'mr-2' : 'ml-2'
      }`}
      accessibilityRole="button"
      accessibilityLabel={`Open saved design ${post.title}`}
    >
      <View className="h-48 overflow-hidden rounded-[24px] bg-slate-200">
        <StyleBoardImage uri={post.imageUri} />
        <View className="absolute right-2 top-2 rounded-full bg-ink/85 px-2.5 py-1">
          <Text className="text-[11px] font-black text-white">#{post.darziId}</Text>
        </View>
        <View className="absolute bottom-2 left-2 h-9 w-9 items-center justify-center rounded-full bg-white/90">
          <Ionicons name="bookmark" size={18} color="#0f766e" />
        </View>
      </View>
      <View className="px-3 py-3">
        <Text className="text-sm font-black leading-5 text-ink" numberOfLines={2}>
          {post.title}
        </Text>
        <Text className="mt-1 text-xs font-bold text-thread" numberOfLines={1}>
          {post.tailorName}
        </Text>
      </View>
    </Pressable>
  );
}

function StyleBoardDetailModal({
  onClose,
  onToggleBookmark,
  post,
  visible,
}: {
  onClose: () => void;
  onToggleBookmark: (postId: string) => void;
  post: SocialFeedPost | null;
  visible: boolean;
}) {
  if (!post) return null;

  const handleRemove = () => {
    onToggleBookmark(post.id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 justify-end bg-slate-950/75 px-4 pb-5 pt-10">
        <View className="max-h-full overflow-hidden rounded-[32px] bg-white shadow-lg">
          <View className="h-[420px] bg-slate-200">
            <StyleBoardImage uri={post.imageUri} />
            <Pressable
              onPress={onClose}
              className="absolute right-4 top-4 h-11 w-11 items-center justify-center rounded-full bg-ink/80"
              accessibilityRole="button"
              accessibilityLabel="Close saved design"
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            <View className="absolute bottom-4 left-4 right-4 rounded-[24px] bg-white/92 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-white">
                  Tailor ID #{post.darziId}
                </Text>
                <View className="flex-row items-center rounded-full bg-rose-50 px-3 py-1.5">
                  <Ionicons name="heart" size={15} color="#e11d48" />
                  <Text className="ml-1 text-xs font-black text-rose-600">
                    {post.likesCount.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="p-5">
            <Text className="text-xs font-black uppercase tracking-[2px] text-thread">
              Saved Style Reference
            </Text>
            <Text className="mt-2 text-3xl font-black text-ink">{post.title}</Text>
            <Text className="mt-1 text-base font-black text-thread">{post.tailorName}</Text>
            <Text className="mt-3 text-base font-semibold leading-7 text-slate-600">
              {post.description}
            </Text>

            <View className="mt-5 flex-row items-center rounded-2xl bg-teal-50 px-4 py-4">
              <Ionicons name="storefront-outline" size={21} color="#0f766e" />
              <Text className="ml-2 flex-1 text-sm font-black text-ink">
                Show this design to any master during consultation.
              </Text>
            </View>

            <View className="mt-5 flex-row">
              <Pressable
                onPress={handleRemove}
                className="mr-3 flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-4"
                accessibilityRole="button"
                accessibilityLabel={`Remove ${post.title} from style board`}
              >
                <Ionicons name="bookmark" size={20} color="#0f766e" />
                <Text className="ml-2 text-sm font-black text-slate-700">Remove</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                className="flex-1 flex-row items-center justify-center rounded-2xl bg-thread px-4 py-4"
                accessibilityRole="button"
                accessibilityLabel="Done viewing saved design"
              >
                <Ionicons name="checkmark-circle-outline" size={21} color="#ffffff" />
                <Text className="ml-2 text-sm font-black text-white">Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StyleBoardImage({ uri }: { uri: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (uri.startsWith('mock-local://') || imageFailed) {
    return (
      <View className="h-full w-full bg-slate-950">
        <View className="absolute inset-0 bg-amber-700" />
        <View className="absolute left-0 top-0 h-full w-1/2 bg-red-900" />
        <View className="absolute right-0 top-0 h-full w-1/2 bg-emerald-950" />
        <View className="absolute bottom-6 left-4 right-4 rounded-3xl bg-black/35 px-4 py-3">
          <Text className="text-sm font-black text-white">Fresh Tailor Upload</Text>
          <Text className="mt-1 text-xs font-semibold text-white/70">Stitched by Master #433</Text>
        </View>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className="h-full w-full"
      resizeMode="cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function MeasurementVaultCard() {
  const { t } = useLanguage();
  const [measurements, setMeasurements] = useState(defaultVaultMeasurements);
  const [editorVisible, setEditorVisible] = useState(false);
  const translatedMeasurements = measurements.map((measurement) => ({
    ...measurement,
    label: measurement.labelKey ? t(measurement.labelKey) : measurement.label,
  }));

  return (
    <View className="rounded-[28px] border border-teal-100 bg-white p-5 shadow-sm">
      <View className="flex-row items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
          <Ionicons name="resize-outline" size={24} color="#0f766e" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs font-black uppercase tracking-wide text-thread">
            {t('profile.measurementVault')}
          </Text>
          <Text className="mt-1 text-xl font-black text-ink">{t('profile.primarySuit')}</Text>
        </View>
      </View>

      <View className="mt-5 flex-row flex-wrap">
        {translatedMeasurements.map((measurement) => (
          <View
            key={measurement.label}
            className="mb-3 mr-3 min-w-[132px] flex-1 rounded-2xl bg-orange-50 px-4 py-3"
          >
            <Text className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {measurement.label}
            </Text>
            <Text className="mt-1 text-2xl font-black text-ink">{measurement.value}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => setEditorVisible(true)}
        className="mt-2 flex-row items-center justify-center rounded-2xl bg-ink px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Edit measurements"
      >
        <Ionicons name="create-outline" size={19} color="#ffffff" />
        <Text className="ml-2 text-base font-black text-white">{t('profile.editMeasurements')}</Text>
      </Pressable>

      <MeasurementEditorModal
        measurements={measurements}
        onClose={() => setEditorVisible(false)}
        onSave={(nextMeasurements) => {
          setMeasurements(nextMeasurements);
          setEditorVisible(false);
        }}
        visible={editorVisible}
      />
    </View>
  );
}

function MeasurementEditorModal({
  measurements,
  onClose,
  onSave,
  visible,
}: {
  measurements: VaultMeasurement[];
  onClose: () => void;
  onSave: (measurements: VaultMeasurement[]) => void;
  visible: boolean;
}) {
  const { t } = useLanguage();
  const [draftMeasurements, setDraftMeasurements] = useState(measurements);
  const [customLabel, setCustomLabel] = useState('');
  const [customValue, setCustomValue] = useState('');
  const canAddCustom = customLabel.trim().length > 0 && customValue.trim().length > 0;

  useEffect(() => {
    if (visible) {
      setDraftMeasurements(measurements);
      setCustomLabel('');
      setCustomValue('');
    }
  }, [measurements, visible]);

  const updateMeasurement = (id: string, nextValue: string) => {
    setDraftMeasurements((currentMeasurements) =>
      currentMeasurements.map((measurement) =>
        measurement.id === id
          ? { ...measurement, value: normalizeMeasurementValue(nextValue) }
          : measurement,
      ),
    );
  };

  const addCustomMeasurement = () => {
    if (!canAddCustom) return;

    const nextMeasurement: VaultMeasurement = {
      id: `custom-${Date.now()}`,
      label: customLabel.trim().slice(0, 36),
      value: normalizeMeasurementValue(customValue),
      custom: true,
    };

    setDraftMeasurements((currentMeasurements) => [...currentMeasurements, nextMeasurement]);
    setCustomLabel('');
    setCustomValue('');
  };

  const removeMeasurement = (id: string) => {
    setDraftMeasurements((currentMeasurements) =>
      currentMeasurements.filter((measurement) => measurement.id !== id),
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-muslin">
        <View className="flex-row items-center border-b border-orange-100 bg-white px-5 pb-4 pt-12">
          <Pressable
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-full bg-slate-100"
            accessibilityRole="button"
            accessibilityLabel="Close measurement editor"
          >
            <Ionicons name="close" size={24} color="#0f172a" />
          </Pressable>
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-black text-ink">{t('profile.editMeasurements')}</Text>
            <Text className="mt-1 text-xs font-bold text-slate-500">
              Update saved sizes or add a custom shop-floor measurement.
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 pb-8">
          <View className="rounded-[28px] border border-teal-100 bg-white p-5 shadow-sm">
            <Text className="text-xs font-black uppercase tracking-wide text-thread">
              Current Measurements
            </Text>
            <View className="mt-4 gap-3">
              {draftMeasurements.map((measurement) => {
                const label = measurement.labelKey ? t(measurement.labelKey) : measurement.label;

                return (
                  <View
                    key={measurement.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <View className="flex-row items-center">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-black text-ink">{label}</Text>
                        {measurement.custom ? (
                          <Text className="mt-1 text-xs font-bold text-teal-700">Custom measurement</Text>
                        ) : null}
                      </View>
                      {measurement.custom ? (
                        <Pressable
                          onPress={() => removeMeasurement(measurement.id)}
                          className="h-9 w-9 items-center justify-center rounded-full bg-red-50"
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${label}`}
                        >
                          <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                        </Pressable>
                      ) : null}
                    </View>
                    <View className="mt-3 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <TextInput
                        value={measurement.value.replace('"', '')}
                        onChangeText={(value) => updateMeasurement(measurement.id, value)}
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={6}
                        className="flex-1 text-xl font-black text-ink"
                      />
                      <Text className="text-lg font-black text-slate-500">in</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mt-5 rounded-[28px] border border-amber-100 bg-white p-5 shadow-sm">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                <Ionicons name="add-circle-outline" size={23} color="#b45309" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-lg font-black text-ink">Add Custom Measurement</Text>
                <Text className="mt-1 text-xs font-bold text-slate-500">
                  Example: cuff width, hip, trouser bottom, arm hole.
                </Text>
              </View>
            </View>

            <View className="mt-4 gap-3">
              <View>
                <Text className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Measurement Name
                </Text>
                <TextInput
                  value={customLabel}
                  onChangeText={(value) => setCustomLabel(value.slice(0, 36))}
                  placeholder="e.g. Trouser Bottom"
                  placeholderTextColor="#94a3b8"
                  maxLength={36}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-ink"
                />
              </View>
              <View>
                <Text className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Size in Inches
                </Text>
                <TextInput
                  value={customValue}
                  onChangeText={(value) => setCustomValue(value.replace(/[^\d.]/g, '').slice(0, 6))}
                  placeholder="e.g. 14.5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={6}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-ink"
                />
              </View>
            </View>

            <Pressable
              onPress={addCustomMeasurement}
              disabled={!canAddCustom}
              className={`mt-4 flex-row items-center justify-center rounded-2xl px-5 py-4 ${
                canAddCustom ? 'bg-thread' : 'bg-slate-300'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Add custom measurement"
            >
              <Ionicons name="add" size={20} color="#ffffff" />
              <Text className="ml-2 text-base font-black text-white">Add Measurement</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => onSave(draftMeasurements)}
            className="mt-5 flex-row items-center justify-center rounded-2xl bg-ink px-5 py-5"
            accessibilityRole="button"
            accessibilityLabel="Save measurements"
          >
            <Ionicons name="checkmark-circle-outline" size={21} color="#ffffff" />
            <Text className="ml-2 text-lg font-black text-white">Save Measurements</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ParchiCard({
  averageRating,
  onPress,
  onReviewPress,
  parchi,
  reviewed,
}: {
  averageRating?: number;
  onPress: () => void;
  onReviewPress: (event: GestureResponderEvent) => void;
  parchi: DigitalParchiReceipt;
  reviewed: boolean;
}) {
  const { t } = useLanguage();
  const statusTone = {
    'Order Placed': {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      icon: 'receipt-outline',
      color: '#475569',
    },
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
    'Ready for Pickup': {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      icon: 'checkmark-circle-outline',
      color: '#166534',
    },
    Delivered: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      icon: 'shield-checkmark-outline',
      color: '#3730a3',
    },
  }[parchi.status];
  const statusLabel = {
    'Order Placed': t('status.orderPlaced'),
    'In Cutting': t('status.inCutting'),
    Stitching: t('status.stitching'),
    'Ready for Pickup': t('status.readyForPickup'),
    Delivered: t('status.delivered'),
  }[parchi.status];
  const reviewEligible = parchi.status === 'Ready for Pickup' || parchi.status === 'Delivered';

  return (
    <Pressable
      onPress={onPress}
      className="rounded-[24px] border border-orange-100 bg-white p-5 shadow-sm"
      accessibilityRole="button"
      accessibilityLabel={`Open digital receipt for ${parchi.orderId}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-black text-ink">{parchi.tailorName}</Text>
          <Text className="mt-1 text-sm font-bold text-slate-500">Order {parchi.orderId}</Text>
          <Text className="mt-1 text-xs font-semibold text-slate-400">{parchi.itemType}</Text>
        </View>
        <View className={`flex-row items-center rounded-full px-3 py-1.5 ${statusTone.bg}`}>
          <Ionicons
            name={statusTone.icon as keyof typeof Ionicons.glyphMap}
            size={15}
            color={statusTone.color}
          />
          <Text className={`ml-1 text-xs font-black ${statusTone.text}`}>{statusLabel}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center rounded-2xl bg-slate-50 px-4 py-3">
        <Ionicons name="calendar-outline" size={18} color="#475569" />
        <Text className="ml-2 text-sm font-bold text-slate-600">Estimated delivery</Text>
        <Text className="ml-auto text-sm font-black text-ink">{parchi.estimatedDelivery}</Text>
      </View>

      {reviewEligible ? (
        <View className="mt-4 rounded-[20px] border border-amber-100 bg-amber-50 p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-black uppercase tracking-wide text-amber-700">
                Customer feedback
              </Text>
              <View className="mt-1 flex-row items-center">
                <FontAwesome name="star" size={14} color="#f59e0b" />
                <Text className="ml-1 text-sm font-black text-ink">
                  {averageRating?.toFixed(1) ?? '5.0'} tailor average
                </Text>
              </View>
            </View>
            {reviewed ? (
              <View className="flex-row items-center rounded-full bg-emerald-100 px-4 py-2">
                <Ionicons name="checkmark-circle" size={17} color="#047857" />
                <Text className="ml-1 text-xs font-black text-emerald-800">Reviewed</Text>
              </View>
            ) : (
              <Pressable
                onPress={onReviewPress}
                className="flex-row items-center rounded-full bg-ink px-4 py-2.5"
                accessibilityRole="button"
                accessibilityLabel={`Leave a review for ${parchi.orderId}`}
              >
                <FontAwesome name="star" size={15} color="#fbbf24" />
                <Text className="ml-2 text-xs font-black text-white">Leave a Review</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function TailorDashboardView() {
  const { t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  const handlePrint = () => {
    Alert.alert('Print Banner', 'Mocking Bluetooth print / Share PDF export for Darzi ID #433.');
  };

  return (
    <View className="mt-6">
      <LanguageActionRow />
      <ShopQrBanner />

      <Pressable
        onPress={() => navigation.navigate('NewOrder')}
        className="mt-4 flex-row items-center justify-center rounded-2xl bg-ink px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Create new digital parchi"
      >
        <Ionicons name="add-circle-outline" size={22} color="#ffffff" />
        <Text className="ml-2 text-base font-black text-white">
          {t('profile.createParchi')}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('ShowcaseUpload')}
        className="mt-4 flex-row items-center justify-center rounded-2xl bg-amber-500 px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Post to Feed"
      >
        <Ionicons name="camera-outline" size={22} color="#0f172a" />
        <Text className="ml-2 text-base font-black text-ink">
          {t('profile.postLookbook')}
        </Text>
      </Pressable>

      <Pressable
        onPress={handlePrint}
        className="mt-4 flex-row items-center justify-center rounded-2xl bg-thread px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Print shop QR banner"
      >
        <Ionicons name="print-outline" size={21} color="#ffffff" />
        <Text className="ml-2 text-base font-black text-white">
          {t('profile.printBanner')}
        </Text>
      </Pressable>

      <View className="mt-6">
        <Text className="text-xl font-black text-ink">{t('profile.shopMetrics')}</Text>
        <View className="mt-4 gap-4">
          {shopMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </View>
      </View>

      <TailorOrdersDashboard />
    </View>
  );
}

function ShopQrBanner() {
  const qrPayload = buildTailorDeepLink(activeTailorDarziId);

  return (
    <View className="rounded-[30px] border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
      <View className="rounded-[24px] bg-ink px-5 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
              Khan Tailors
            </Text>
            <Text className="mt-2 text-4xl font-black text-white">Darzi ID: #433</Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Ionicons name="cut-outline" size={27} color="#fbbf24" />
          </View>
        </View>
      </View>

      <View className="mt-5 items-center rounded-[26px] border border-slate-200 bg-slate-50 p-6">
        <View className="items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-3">
          <ScannableQrCode value={qrPayload} size={192} />
        </View>

        <Text className="mt-5 text-center text-2xl font-black text-ink">Scan My Darzi QR</Text>
        <Text className="mt-2 text-center text-base font-semibold leading-6 text-slate-600">
          Scan to download the app & instantly view my design Feed!
        </Text>
      </View>
    </View>
  );
}

function MetricCard({
  metric,
}: {
  metric: (typeof shopMetrics)[number];
}) {
  const tone = {
    teal: {
      bg: 'bg-teal-50',
      icon: '#0f766e',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: '#d97706',
    },
    slate: {
      bg: 'bg-slate-100',
      icon: '#475569',
    },
  }[metric.tone];

  return (
    <View className="flex-row items-center rounded-[24px] border border-orange-100 bg-white p-5 shadow-sm">
      <View className={`h-14 w-14 items-center justify-center rounded-2xl ${tone.bg}`}>
        {metric.id === 'rating' ? (
          <FontAwesome name="star-o" size={24} color={tone.icon} />
        ) : (
          <Ionicons name={metric.icon} size={25} color={tone.icon} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-sm font-bold text-slate-500">{metric.label}</Text>
        <Text className="mt-1 text-3xl font-black text-ink">{metric.value}</Text>
        <Text className="mt-1 text-xs font-semibold text-slate-400">{metric.helper}</Text>
      </View>
    </View>
  );
}
