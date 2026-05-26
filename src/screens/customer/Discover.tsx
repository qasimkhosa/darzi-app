import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
} from 'react-native';
import { Screen } from '@/components/Screen';
import { type SocialFeedPost, useSocialFeed } from '@/contexts/SocialFeedContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { CustomerTabParamList } from '@/navigation/types';
import {
  calculateDistanceKm,
  isValidCoordinate,
  requestCurrentCoordinates,
  type Coordinates,
} from '@/utils/location';
import type { Database, Json } from '@/types/database';

type SearchMode = 'nameArea' | 'darziId';
type SpecialtyFilter = 'Gents Darzi' | 'Ladies Darzan' | 'Kids Master' | null;
type SortMode = 'bestMatch' | 'nearest' | 'priceLow' | 'ratingHigh' | 'fastest';
type SpecialtyHub =
  | 'Gents Traditional'
  | 'Bridal & Party Wear'
  | 'Lawn & Casuals'
  | 'Urgent Orders';
type DistanceRadiusKm = 2 | 5 | 10 | null;
type MaxStartingPrice = 1500 | 2500 | 4000 | null;
type MinimumRating = 4.5 | 4.7 | 4.8 | null;

type TailorShop = {
  id: string;
  shopName: string;
  darziId: number;
  area: string;
  distanceKm: number;
  latitude: number | null;
  longitude: number | null;
  startingPrice: number;
  rating: number;
  reviewCount: number;
  expertise: string;
  specialtyType: Exclude<SpecialtyFilter, null>;
  specialtyHubs: SpecialtyHub[];
  specialties: string[];
  deliveryWindow: string;
  averageDeliveryDays: number;
  rushAvailable: boolean;
  matchNote: string;
  source: 'mock' | 'cloud';
};

type TailorProfileRow = Database['public']['Tables']['tailor_profiles']['Row'];

const TRENDING_DESIGN_LIMIT = 7;
const TRENDING_LOOP_CYCLES = 12;
const TRENDING_CARD_SNAP_WIDTH = 192;

const tailorShops: TailorShop[] = [
  {
    id: 'khan-tailors-433',
    shopName: 'Khan Tailors',
    darziId: 433,
    area: 'Liberty Market, Lahore',
    distanceKm: 1.2,
    latitude: 31.5102,
    longitude: 74.3441,
    startingPrice: 1500,
    rating: 4.8,
    reviewCount: 218,
    expertise: 'Gents Master',
    specialtyType: 'Gents Darzi',
    specialtyHubs: ['Gents Traditional', 'Urgent Orders'],
    specialties: ['Kurta Pajama', 'Waistcoat', 'Sherwani Alteration'],
    deliveryWindow: '3-5 days',
    averageDeliveryDays: 4,
    rushAvailable: true,
    matchNote: 'Best for gents Eid suits and same-week fittings',
    source: 'mock',
  },
  {
    id: 'anarkali-boutique-567',
    shopName: 'Anarkali Boutique',
    darziId: 567,
    area: 'Old Anarkali, Lahore',
    distanceKm: 3.7,
    latitude: 31.5681,
    longitude: 74.3077,
    startingPrice: 4200,
    rating: 4.9,
    reviewCount: 342,
    expertise: 'Bridal Expert',
    specialtyType: 'Ladies Darzan',
    specialtyHubs: ['Bridal & Party Wear'],
    specialties: ['Bridal Shalwar Kameez', 'Lehnga Fitting', 'Dabka Work'],
    deliveryWindow: '8-14 days',
    averageDeliveryDays: 11,
    rushAvailable: false,
    matchNote: 'Premium bridal work with heavy embroidery',
    source: 'mock',
  },
  {
    id: 'little-ustad-284',
    shopName: 'Little Ustad Kids Wear',
    darziId: 284,
    area: 'Johar Town, Lahore',
    distanceKm: 4.4,
    latitude: 31.4697,
    longitude: 74.2728,
    startingPrice: 950,
    rating: 4.6,
    reviewCount: 91,
    expertise: 'Kids Master',
    specialtyType: 'Kids Master',
    specialtyHubs: ['Urgent Orders'],
    specialties: ['Boys Kurta', 'Girls Frocks', 'School Uniforms'],
    deliveryWindow: '2-4 days',
    averageDeliveryDays: 3,
    rushAvailable: true,
    matchNote: 'Fast kidswear and school uniform stitching',
    source: 'mock',
  },
  {
    id: 'naz-tailoring-house-118',
    shopName: 'Naz Tailoring House',
    darziId: 118,
    area: 'Tariq Road, Karachi',
    distanceKm: 6.1,
    latitude: 24.8739,
    longitude: 67.0606,
    startingPrice: 2200,
    rating: 4.7,
    reviewCount: 176,
    expertise: 'Ladies Pret Fit',
    specialtyType: 'Ladies Darzan',
    specialtyHubs: ['Lawn & Casuals', 'Urgent Orders'],
    specialties: ['Office Kurtis', 'Formal Suits', 'Sleeve Alteration'],
    deliveryWindow: '4-6 days',
    averageDeliveryDays: 5,
    rushAvailable: true,
    matchNote: 'Reliable lawn suits and daily-wear alterations',
    source: 'mock',
  },
  {
    id: 'saddar-sherwani-901',
    shopName: 'Saddar Sherwani Works',
    darziId: 901,
    area: 'Saddar, Rawalpindi',
    distanceKm: 2.8,
    latitude: 33.5969,
    longitude: 73.0537,
    startingPrice: 3500,
    rating: 4.8,
    reviewCount: 139,
    expertise: 'Sherwani Specialist',
    specialtyType: 'Gents Darzi',
    specialtyHubs: ['Gents Traditional', 'Bridal & Party Wear'],
    specialties: ['Velvet Sherwani', 'Prince Coat', 'Trouser Fitting'],
    deliveryWindow: '5-7 days',
    averageDeliveryDays: 6,
    rushAvailable: false,
    matchNote: 'Strong option for formal sherwani and prince coat work',
    source: 'mock',
  },
  {
    id: 'gulberg-lawn-studio-642',
    shopName: 'Gulberg Lawn Studio',
    darziId: 642,
    area: 'Gulberg III, Lahore',
    distanceKm: 0.9,
    latitude: 31.5204,
    longitude: 74.3587,
    startingPrice: 1250,
    rating: 4.5,
    reviewCount: 104,
    expertise: 'Lawn & Casual Fit',
    specialtyType: 'Ladies Darzan',
    specialtyHubs: ['Lawn & Casuals', 'Urgent Orders'],
    specialties: ['Lawn Suits', 'Trouser Cutting', 'Neck Designs'],
    deliveryWindow: '2-3 days',
    averageDeliveryDays: 3,
    rushAvailable: true,
    matchNote: 'Closest casual suit option for quick summer stitching',
    source: 'mock',
  },
  {
    id: 'model-town-master-775',
    shopName: 'Model Town Master Tailors',
    darziId: 775,
    area: 'Model Town, Lahore',
    distanceKm: 5.4,
    latitude: 31.4817,
    longitude: 74.3228,
    startingPrice: 2800,
    rating: 4.9,
    reviewCount: 267,
    expertise: 'Premium Gents Fitting',
    specialtyType: 'Gents Darzi',
    specialtyHubs: ['Gents Traditional'],
    specialties: ['Office Shalwar Kameez', 'Waistcoat', 'Collar Finishing'],
    deliveryWindow: '4-6 days',
    averageDeliveryDays: 5,
    rushAvailable: false,
    matchNote: 'Highest-rated gents fitting with premium finishing',
    source: 'mock',
  },
  {
    id: 'defence-partywear-326',
    shopName: 'Defence Partywear Boutique',
    darziId: 326,
    area: 'DHA Phase 5, Lahore',
    distanceKm: 8.3,
    latitude: 31.4694,
    longitude: 74.409,
    startingPrice: 3900,
    rating: 4.7,
    reviewCount: 188,
    expertise: 'Party Wear Specialist',
    specialtyType: 'Ladies Darzan',
    specialtyHubs: ['Bridal & Party Wear', 'Lawn & Casuals'],
    specialties: ['Formal Shirts', 'Party Suits', 'Dupatta Finishing'],
    deliveryWindow: '6-9 days',
    averageDeliveryDays: 7,
    rushAvailable: false,
    matchNote: 'Party wear cuts and formal finishing for events',
    source: 'mock',
  },
];

const distanceFilters: Array<{ label: string; value: DistanceRadiusKm; helper: string }> = [
  { label: 'All', value: null, helper: 'Any distance' },
  { label: '2 km', value: 2, helper: 'Walking nearby' },
  { label: '5 km', value: 5, helper: 'Near me' },
  { label: '10 km', value: 10, helper: 'Across town' },
];

const priceFilters: Array<{ label: string; value: MaxStartingPrice; helper: string }> = [
  { label: 'Any', value: null, helper: 'All charges' },
  { label: '≤ Rs. 1,500', value: 1500, helper: 'Budget' },
  { label: '≤ Rs. 2,500', value: 2500, helper: 'Standard' },
  { label: '≤ Rs. 4,000', value: 4000, helper: 'Premium cap' },
];

const ratingFilters: Array<{ label: string; value: MinimumRating; helper: string }> = [
  { label: 'Any', value: null, helper: 'All ratings' },
  { label: '4.5+', value: 4.5, helper: 'Trusted' },
  { label: '4.7+', value: 4.7, helper: 'Excellent' },
  { label: '4.8+', value: 4.8, helper: 'Top masters' },
];

const sortModes: Array<{ label: string; value: SortMode; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: 'Best Match', value: 'bestMatch', icon: 'sparkles-outline' },
  { label: 'Nearest', value: 'nearest', icon: 'navigate-outline' },
  { label: 'Lowest Charges', value: 'priceLow', icon: 'pricetag-outline' },
  { label: 'Top Rated', value: 'ratingHigh', icon: 'star-outline' },
  { label: 'Fastest', value: 'fastest', icon: 'flash-outline' },
];

function hasShopCoordinates(tailor: TailorShop) {
  return isValidCoordinate(tailor.latitude, tailor.longitude);
}

function getDistanceForTailor(tailor: TailorShop, customerLocation: Coordinates | null) {
  if (!customerLocation || !hasShopCoordinates(tailor)) {
    return tailor.distanceKm;
  }

  return calculateDistanceKm(customerLocation, {
    latitude: tailor.latitude as number,
    longitude: tailor.longitude as number,
  });
}

function withCalculatedDistance(tailor: TailorShop, customerLocation: Coordinates | null): TailorShop {
  return {
    ...tailor,
    distanceKm: getDistanceForTailor(tailor, customerLocation),
  };
}

function getStartingPriceFromPricing(pricingJson: Json) {
  if (!pricingJson || typeof pricingJson !== 'object' || Array.isArray(pricingJson)) {
    return 1500;
  }

  const prices = Object.values(pricingJson)
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isFinite(value) && value > 0);

  return prices.length > 0 ? Math.min(...prices) : 1500;
}

function inferSpecialtyType(tags: string[]): Exclude<SpecialtyFilter, null> {
  const normalizedTags = tags.join(' ').toLowerCase();

  if (normalizedTags.includes('kid') || normalizedTags.includes('uniform')) {
    return 'Kids Master';
  }

  if (
    normalizedTags.includes('bridal') ||
    normalizedTags.includes('lehnga') ||
    normalizedTags.includes('lawn') ||
    normalizedTags.includes('ladies') ||
    normalizedTags.includes('boutique')
  ) {
    return 'Ladies Darzan';
  }

  return 'Gents Darzi';
}

function inferSpecialtyHubs(tags: string[]): SpecialtyHub[] {
  const normalizedTags = tags.join(' ').toLowerCase();
  const hubs: SpecialtyHub[] = [];

  if (
    normalizedTags.includes('gents') ||
    normalizedTags.includes('kurta') ||
    normalizedTags.includes('sherwani') ||
    normalizedTags.includes('waistcoat')
  ) {
    hubs.push('Gents Traditional');
  }

  if (
    normalizedTags.includes('bridal') ||
    normalizedTags.includes('lehnga') ||
    normalizedTags.includes('party') ||
    normalizedTags.includes('sherwani')
  ) {
    hubs.push('Bridal & Party Wear');
  }

  if (
    normalizedTags.includes('lawn') ||
    normalizedTags.includes('casual') ||
    normalizedTags.includes('alteration') ||
    normalizedTags.includes('daily')
  ) {
    hubs.push('Lawn & Casuals');
  }

  if (
    normalizedTags.includes('urgent') ||
    normalizedTags.includes('rush') ||
    normalizedTags.includes('fast')
  ) {
    hubs.push('Urgent Orders');
  }

  return hubs.length > 0 ? hubs : ['Gents Traditional'];
}

function cloudTailorToShop(row: TailorProfileRow): TailorShop {
  const tags = row.expertise_tags.length > 0 ? row.expertise_tags : ['Tailor Master'];
  const specialtyType = inferSpecialtyType(tags);
  const specialtyHubs = inferSpecialtyHubs(tags);
  const rushAvailable = specialtyHubs.includes('Urgent Orders');

  return {
    id: row.id,
    shopName: row.shop_name,
    darziId: row.darzi_id,
    area: row.address ?? 'Shop address not added',
    distanceKm: 99,
    latitude: row.location_lat,
    longitude: row.location_lng,
    startingPrice: getStartingPriceFromPricing(row.pricing_json),
    rating: Number(row.rating) || 5,
    reviewCount: 0,
    expertise: tags[0] ?? 'Tailor Master',
    specialtyType,
    specialtyHubs,
    specialties: tags.slice(0, 4),
    deliveryWindow: rushAvailable ? '2-4 days' : '4-7 days',
    averageDeliveryDays: rushAvailable ? 3 : 5,
    rushAvailable,
    matchNote: isValidCoordinate(row.location_lat, row.location_lng)
      ? 'Live shop profile with GPS location enabled'
      : 'Live shop profile. Location still needs to be added by the tailor.',
    source: 'cloud',
  };
}

function getTailorMatchScore(tailor: TailorShop) {
  const ratingScore = tailor.rating * 28;
  const reviewScore = Math.min(tailor.reviewCount / 8, 38);
  const distanceScore = Math.max(0, 40 - tailor.distanceKm * 5);
  const priceScore = Math.max(0, 35 - tailor.startingPrice / 160);
  const speedScore = Math.max(0, 22 - tailor.averageDeliveryDays * 2);
  const rushScore = tailor.rushAvailable ? 12 : 0;

  return ratingScore + reviewScore + distanceScore + priceScore + speedScore + rushScore;
}

const specialtyHubs: Array<{
  id: SpecialtyHub;
  label: SpecialtyHub;
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: 'Gents Traditional',
    label: 'Gents Traditional',
    helper: 'Kurta, sherwani, waistcoat',
    icon: 'cut-outline',
  },
  {
    id: 'Bridal & Party Wear',
    label: 'Bridal & Party Wear',
    helper: 'Lehnga, dabka, formals',
    icon: 'sparkles-outline',
  },
  {
    id: 'Lawn & Casuals',
    label: 'Lawn & Casuals',
    helper: 'Daily wear and alterations',
    icon: 'leaf-outline',
  },
  {
    id: 'Urgent Orders',
    label: 'Urgent Orders',
    helper: 'Fast delivery masters',
    icon: 'flash-outline',
  },
];

export function DiscoverScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<CustomerTabParamList, 'Discover'>>();
  const { posts } = useSocialFeed();
  const [tailorDirectory, setTailorDirectory] = useState<TailorShop[]>(tailorShops);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('nameArea');
  const [searchText, setSearchText] = useState('');
  const [darziIdInput, setDarziIdInput] = useState('');
  const [distanceRadiusKm, setDistanceRadiusKm] = useState<DistanceRadiusKm>(null);
  const [maxStartingPrice, setMaxStartingPrice] = useState<MaxStartingPrice>(null);
  const [minimumRating, setMinimumRating] = useState<MinimumRating>(null);
  const [rushOnly, setRushOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('bestMatch');
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyFilter>(null);
  const [activeHub, setActiveHub] = useState<SpecialtyHub | null>(null);
  const [selectedTrendingPost, setSelectedTrendingPost] = useState<SocialFeedPost | null>(null);

  useEffect(() => {
    let active = true;

    async function hydrateTailorDirectory() {
      if (!isSupabaseConfigured || !supabase) return;

      setDirectoryLoading(true);

      try {
        const { data, error } = await supabase
          .from('tailor_profiles')
          .select('id,shop_name,darzi_id,location_lat,location_lng,address,pricing_json,expertise_tags,rating')
          .order('rating', { ascending: false });

        if (error) {
          throw error;
        }

        if (!active || !data || data.length === 0) return;

        const cloudShops = data.map(cloudTailorToShop);
        const cloudDarziIds = new Set(cloudShops.map((shop) => shop.darziId));
        const localFallbacks = tailorShops.filter((shop) => !cloudDarziIds.has(shop.darziId));

        setTailorDirectory([...cloudShops, ...localFallbacks]);
      } catch (error) {
        if (__DEV__) {
          console.info('[Discover] Tailor cloud directory unavailable; using local fallback.', error);
        }
      } finally {
        if (active) {
          setDirectoryLoading(false);
        }
      }
    }

    void hydrateTailorDirectory();

    return () => {
      active = false;
    };
  }, []);

  const tailorsWithDistance = useMemo(() => {
    return tailorDirectory.map((tailor) => withCalculatedDistance(tailor, customerLocation));
  }, [customerLocation, tailorDirectory]);

  const requestCustomerLocation = async () => {
    setLocationError('');
    setLocationLoading(true);

    try {
      const result = await requestCurrentCoordinates();

      if (!result.granted) {
        setLocationError('Location permission was not allowed. Showing saved demo distances.');
        return null;
      }

      setCustomerLocation(result.coordinates);
      return result.coordinates;
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDistanceRadiusChange = (value: DistanceRadiusKm) => {
    setDistanceRadiusKm(value);

    if (value !== null && !customerLocation) {
      void requestCustomerLocation();
    }
  };

  const handleSortModeChange = (value: SortMode) => {
    setSortMode(value);

    if ((value === 'nearest' || value === 'bestMatch') && !customerLocation) {
      void requestCustomerLocation();
    }
  };

  const parsedDarziId = Number.parseInt(darziIdInput.trim(), 10);
  const matchedTailorById = Number.isFinite(parsedDarziId)
    ? tailorsWithDistance.find((tailor) => tailor.darziId === parsedDarziId)
    : undefined;
  const hasDarziIdMatch = searchMode === 'darziId' && matchedTailorById !== undefined;

  const trendingPosts = useMemo(() => {
    return [...posts].sort((a, b) => b.likesCount - a.likesCount).slice(0, TRENDING_DESIGN_LIMIT);
  }, [posts]);

  const filteredTailors = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const filtered = tailorsWithDistance.filter((tailor) => {
      const matchesNameArea =
        normalizedSearch.length === 0 ||
        tailor.shopName.toLowerCase().includes(normalizedSearch) ||
        tailor.area.toLowerCase().includes(normalizedSearch) ||
        tailor.expertise.toLowerCase().includes(normalizedSearch) ||
        tailor.specialties.some((specialty) => specialty.toLowerCase().includes(normalizedSearch));

      const matchesRadius = distanceRadiusKm === null || tailor.distanceKm <= distanceRadiusKm;
      const matchesCharges =
        maxStartingPrice === null || tailor.startingPrice <= maxStartingPrice;
      const matchesRating = minimumRating === null || tailor.rating >= minimumRating;
      const matchesRush = !rushOnly || tailor.rushAvailable;
      const matchesSpecialty = !specialtyFilter || tailor.specialtyType === specialtyFilter;
      const matchesHub = !activeHub || tailor.specialtyHubs.includes(activeHub);

      return (
        matchesNameArea &&
        matchesRadius &&
        matchesCharges &&
        matchesRating &&
        matchesRush &&
        matchesSpecialty &&
        matchesHub
      );
    });

    if (sortMode === 'nearest') {
      return [...filtered].sort((a, b) => a.distanceKm - b.distanceKm);
    }

    if (sortMode === 'priceLow') {
      return [...filtered].sort((a, b) => a.startingPrice - b.startingPrice);
    }

    if (sortMode === 'ratingHigh') {
      return [...filtered].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    }

    if (sortMode === 'fastest') {
      return [...filtered].sort((a, b) => a.averageDeliveryDays - b.averageDeliveryDays);
    }

    return [...filtered].sort((a, b) => getTailorMatchScore(b) - getTailorMatchScore(a));
  }, [
    activeHub,
    tailorsWithDistance,
    distanceRadiusKm,
    maxStartingPrice,
    minimumRating,
    rushOnly,
    searchText,
    sortMode,
    specialtyFilter,
  ]);

  const activeFilterCount =
    (distanceRadiusKm !== null ? 1 : 0) +
    (maxStartingPrice !== null ? 1 : 0) +
    (minimumRating !== null ? 1 : 0) +
    (rushOnly ? 1 : 0) +
    (specialtyFilter ? 1 : 0) +
    (activeHub ? 1 : 0);

  const resetDiscoveryFilters = () => {
    setSearchText('');
    setDistanceRadiusKm(null);
    setMaxStartingPrice(null);
    setMinimumRating(null);
    setRushOnly(false);
    setSpecialtyFilter(null);
    setActiveHub(null);
    setSortMode('bestMatch');
  };

  const openTailorById = () => {
    if (!matchedTailorById) {
      Alert.alert('No Darzi found', `No local shop matched Darzi ID #${parsedDarziId}.`);
      return;
    }

    navigation.navigate('Feed', { darziId: matchedTailorById.darziId });
  };

  const handleSpecialtyHubPress = (hub: SpecialtyHub) => {
    setActiveHub((current) => (current === hub ? null : hub));
  };

  return (
    <Screen scroll={false}>
      <FlatList
        data={filteredTailors}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        ListHeaderComponent={
          <DiscoverHeader
            activeFilterCount={activeFilterCount}
            activeHub={activeHub}
            customerLocation={customerLocation}
            darziIdInput={darziIdInput}
            distanceRadiusKm={distanceRadiusKm}
            directoryLoading={directoryLoading}
            filteredCount={filteredTailors.length}
            hasDarziIdMatch={hasDarziIdMatch}
            locationError={locationError}
            locationLoading={locationLoading}
            maxStartingPrice={maxStartingPrice}
            minimumRating={minimumRating}
            onDarziIdInputChange={setDarziIdInput}
            onDistanceRadiusChange={handleDistanceRadiusChange}
            onMaxStartingPriceChange={setMaxStartingPrice}
            onMinimumRatingChange={setMinimumRating}
            onRefreshCustomerLocation={() => {
              void requestCustomerLocation();
            }}
            onOpenTailorById={openTailorById}
            onResetFilters={resetDiscoveryFilters}
            onRushOnlyToggle={() => setRushOnly((current) => !current)}
            onSearchModeChange={setSearchMode}
            onSearchTextChange={setSearchText}
            onSortModeChange={handleSortModeChange}
            onSpecialtyChange={setSpecialtyFilter}
            onSpecialtyHubPress={handleSpecialtyHubPress}
            onTrendingPress={setSelectedTrendingPost}
            parsedDarziId={parsedDarziId}
            matchedTailorName={matchedTailorById?.shopName}
            rushOnly={rushOnly}
            searchMode={searchMode}
            searchText={searchText}
            sortMode={sortMode}
            specialtyFilter={specialtyFilter}
            trendingPosts={trendingPosts}
          />
        }
        renderItem={({ item }) => <TailorShopCard tailor={item} />}
        ItemSeparatorComponent={() => <View className="h-4" />}
        ListEmptyComponent={
          <View className="mt-6 rounded-3xl border border-orange-100 bg-white p-6">
            <Text className="text-lg font-black text-ink">No tailor shops found</Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Try clearing one filter or searching a nearby market like Liberty, Anarkali,
              Saddar, Johar Town, or Tariq Road.
            </Text>
          </View>
        }
      />

      <TrendingQuickViewModal
        onClose={() => setSelectedTrendingPost(null)}
        post={selectedTrendingPost}
        visible={selectedTrendingPost !== null}
      />
    </Screen>
  );
}

type DiscoverHeaderProps = {
  activeFilterCount: number;
  activeHub: SpecialtyHub | null;
  customerLocation: Coordinates | null;
  darziIdInput: string;
  distanceRadiusKm: DistanceRadiusKm;
  directoryLoading: boolean;
  filteredCount: number;
  hasDarziIdMatch: boolean;
  locationError: string;
  locationLoading: boolean;
  maxStartingPrice: MaxStartingPrice;
  minimumRating: MinimumRating;
  onDarziIdInputChange: (value: string) => void;
  onDistanceRadiusChange: (value: DistanceRadiusKm) => void;
  onMaxStartingPriceChange: (value: MaxStartingPrice) => void;
  onMinimumRatingChange: (value: MinimumRating) => void;
  onOpenTailorById: () => void;
  onRefreshCustomerLocation: () => void;
  onResetFilters: () => void;
  onRushOnlyToggle: () => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchTextChange: (value: string) => void;
  onSortModeChange: (value: SortMode) => void;
  onSpecialtyChange: (value: SpecialtyFilter) => void;
  onSpecialtyHubPress: (hub: SpecialtyHub) => void;
  onTrendingPress: (post: SocialFeedPost) => void;
  matchedTailorName?: string;
  parsedDarziId: number;
  rushOnly: boolean;
  searchMode: SearchMode;
  searchText: string;
  sortMode: SortMode;
  specialtyFilter: SpecialtyFilter;
  trendingPosts: SocialFeedPost[];
};

function DiscoverHeader({
  activeFilterCount,
  activeHub,
  customerLocation,
  darziIdInput,
  distanceRadiusKm,
  directoryLoading,
  filteredCount,
  hasDarziIdMatch,
  locationError,
  locationLoading,
  maxStartingPrice,
  minimumRating,
  onDarziIdInputChange,
  onDistanceRadiusChange,
  onMaxStartingPriceChange,
  onMinimumRatingChange,
  onOpenTailorById,
  onRefreshCustomerLocation,
  onResetFilters,
  onRushOnlyToggle,
  onSearchModeChange,
  onSearchTextChange,
  onSortModeChange,
  onSpecialtyChange,
  onSpecialtyHubPress,
  onTrendingPress,
  matchedTailorName,
  parsedDarziId,
  rushOnly,
  searchMode,
  searchText,
  sortMode,
  specialtyFilter,
  trendingPosts,
}: DiscoverHeaderProps) {
  return (
    <View className="pb-5">
      <HeroSearchCard
        darziIdInput={darziIdInput}
        hasDarziIdMatch={hasDarziIdMatch}
        onDarziIdInputChange={onDarziIdInputChange}
        onOpenTailorById={onOpenTailorById}
        onSearchModeChange={onSearchModeChange}
        onSearchTextChange={onSearchTextChange}
        parsedDarziId={parsedDarziId}
        matchedTailorName={matchedTailorName}
        searchMode={searchMode}
        searchText={searchText}
      />

      <TrendingDesignsRow
        onTrendingPress={onTrendingPress}
        trendingPosts={trendingPosts}
      />

      <SpecialtyHubGrid
        activeHub={activeHub}
        onSpecialtyHubPress={onSpecialtyHubPress}
      />

      <DiscoveryFilterPanel
        activeFilterCount={activeFilterCount}
        customerLocation={customerLocation}
        distanceRadiusKm={distanceRadiusKm}
        directoryLoading={directoryLoading}
        filteredCount={filteredCount}
        locationError={locationError}
        locationLoading={locationLoading}
        maxStartingPrice={maxStartingPrice}
        minimumRating={minimumRating}
        onDistanceRadiusChange={onDistanceRadiusChange}
        onMaxStartingPriceChange={onMaxStartingPriceChange}
        onMinimumRatingChange={onMinimumRatingChange}
        onRefreshCustomerLocation={onRefreshCustomerLocation}
        onResetFilters={onResetFilters}
        onRushOnlyToggle={onRushOnlyToggle}
        onSortModeChange={onSortModeChange}
        onSpecialtyChange={onSpecialtyChange}
        rushOnly={rushOnly}
        sortMode={sortMode}
        specialtyFilter={specialtyFilter}
      />

      <View className="mt-6 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-black text-ink">Nearby shops</Text>
          <Text className="mt-1 text-xs font-bold text-slate-500">
            {filteredCount} shops match your location, craft, charges, and rating filters
          </Text>
        </View>
        <View className="rounded-full bg-white px-3 py-2 shadow-sm">
          <Text className="text-xs font-black text-thread">Local mock results</Text>
        </View>
      </View>
    </View>
  );
}

function HeroSearchCard({
  darziIdInput,
  hasDarziIdMatch,
  onDarziIdInputChange,
  onOpenTailorById,
  onSearchModeChange,
  onSearchTextChange,
  matchedTailorName,
  parsedDarziId,
  searchMode,
  searchText,
}: {
  darziIdInput: string;
  hasDarziIdMatch: boolean;
  onDarziIdInputChange: (value: string) => void;
  onOpenTailorById: () => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchTextChange: (value: string) => void;
  matchedTailorName?: string;
  parsedDarziId: number;
  searchMode: SearchMode;
  searchText: string;
}) {
  return (
    <View className="overflow-hidden rounded-[34px] bg-ink p-5 shadow-sm">
      <View className="absolute -right-16 -top-14 h-44 w-44 rounded-full bg-thread/60" />
      <View className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-amber-500/40" />
      <View className="absolute bottom-0 right-0 h-24 w-40 rounded-tl-[60px] bg-white/5" />

      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
            Darzi Customer Home
          </Text>
          <Text className="mt-3 text-4xl font-black leading-[44px] text-white">
            Find Your Master Tailor
          </Text>
          <Text className="mt-3 text-base font-semibold leading-6 text-white/75">
            Assalam-o-Alaikum, looking for a perfect fit today?
          </Text>
        </View>

        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <Ionicons name="cut-outline" size={28} color="#fbbf24" />
        </View>
      </View>

      <View className="mt-6 rounded-[26px] border border-white/15 bg-white/95 p-3">
        <View className="flex-row rounded-2xl bg-slate-100 p-1">
          <ModeButton
            active={searchMode === 'nameArea'}
            label="Name / Area"
            onPress={() => onSearchModeChange('nameArea')}
          />
          <ModeButton
            active={searchMode === 'darziId'}
            label="Enter Darzi ID"
            onPress={() => onSearchModeChange('darziId')}
          />
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl border border-orange-100 bg-white px-4 py-3">
          <Ionicons
            name={searchMode === 'darziId' ? 'qr-code-outline' : 'search-outline'}
            size={21}
            color="#0f766e"
          />
          <TextInput
            value={searchMode === 'darziId' ? darziIdInput : searchText}
            onChangeText={
              searchMode === 'darziId'
                ? (value) => onDarziIdInputChange(value.replace(/\D/g, '').slice(0, 8))
                : (value) => onSearchTextChange(value.slice(0, 80))
            }
            keyboardType={searchMode === 'darziId' ? 'number-pad' : 'default'}
            maxLength={searchMode === 'darziId' ? 8 : 80}
            placeholder={searchMode === 'darziId' ? 'Enter shop board ID, e.g. 433' : 'Search Liberty, bridal, sherwani...'}
            placeholderTextColor="#94a3b8"
            className="ml-3 flex-1 text-base font-semibold text-ink"
          />
        </View>

        {searchMode === 'darziId' ? (
          <Pressable
            onPress={hasDarziIdMatch ? onOpenTailorById : undefined}
            className={`mt-3 overflow-hidden rounded-[22px] border-2 border-dashed px-4 py-4 ${
              hasDarziIdMatch
                ? 'border-teal-300 bg-teal-50'
                : 'border-slate-200 bg-slate-50'
            }`}
            accessibilityRole="button"
            accessibilityLabel={hasDarziIdMatch ? `Open tailor shop ${parsedDarziId}` : 'Enter Darzi ID'}
          >
            <View className="absolute -left-4 top-1/2 h-8 w-8 rounded-full bg-white" />
            <View className="absolute -right-4 top-1/2 h-8 w-8 rounded-full bg-white" />
            <View className="flex-row items-center">
              <View className={`h-12 w-12 items-center justify-center rounded-2xl ${
                hasDarziIdMatch ? 'bg-thread' : 'bg-slate-200'
              }`}
              >
                <Ionicons
                  name="ticket-outline"
                  size={24}
                  color={hasDarziIdMatch ? '#ffffff' : '#64748b'}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-ink">
                  {hasDarziIdMatch
                    ? `${matchedTailorName ?? 'Found Tailor Shop'} #${parsedDarziId}`
                    : 'Voucher counter lookup'}
                </Text>
                <Text className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  {hasDarziIdMatch
                    ? 'Tap to open this tailor in the Feed.'
                    : 'Type the number from a shop QR, receipt, or wall banner.'}
                </Text>
              </View>
              <Ionicons
                name={hasDarziIdMatch ? 'chevron-forward' : 'barcode-outline'}
                size={23}
                color={hasDarziIdMatch ? '#0f766e' : '#64748b'}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function TrendingDesignsRow({
  onTrendingPress,
  trendingPosts,
}: {
  onTrendingPress: (post: SocialFeedPost) => void;
  trendingPosts: SocialFeedPost[];
}) {
  const listRef = useRef<FlatList<SocialFeedPost & { loopKey: string }> | null>(null);
  const currentIndexRef = useRef(0);

  const loopedTrendingPosts = useMemo(() => {
    if (trendingPosts.length === 0) return [];

    return Array.from({ length: TRENDING_LOOP_CYCLES }).flatMap((_, cycleIndex) =>
      trendingPosts.map((post) => ({
        ...post,
        loopKey: `${post.id}-${cycleIndex}`,
      })),
    );
  }, [trendingPosts]);
  const loopResetIndex =
    trendingPosts.length > 0 ? Math.floor(TRENDING_LOOP_CYCLES / 2) * trendingPosts.length : 0;

  useEffect(() => {
    if (loopedTrendingPosts.length <= trendingPosts.length) return undefined;

    currentIndexRef.current = loopResetIndex;

    const startTimer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        animated: false,
        index: loopResetIndex,
      });
    }, 50);

    const interval = setInterval(() => {
      currentIndexRef.current += 1;

      if (currentIndexRef.current >= loopedTrendingPosts.length - trendingPosts.length) {
        currentIndexRef.current = loopResetIndex;
        listRef.current?.scrollToIndex({
          animated: false,
          index: loopResetIndex,
        });
        return;
      }

      listRef.current?.scrollToIndex({
        animated: true,
        index: currentIndexRef.current,
      });
    }, 2800);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [loopResetIndex, loopedTrendingPosts.length, trendingPosts.length]);

  return (
    <View className="mt-7">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-black text-ink">Trending designs</Text>
          <Text className="mt-1 text-xs font-bold text-slate-500">
            Most loved suits from the live Feed
          </Text>
        </View>
        <View className="flex-row items-center rounded-full bg-rose-50 px-3 py-2">
          <Ionicons name="heart" size={15} color="#e11d48" />
          <Text className="ml-1 text-xs font-black text-rose-600">Top 7</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={loopedTrendingPosts}
        horizontal
        keyExtractor={(item) => item.loopKey}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="mt-4 pr-5"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        snapToInterval={TRENDING_CARD_SNAP_WIDTH}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: TRENDING_CARD_SNAP_WIDTH,
          offset: TRENDING_CARD_SNAP_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              animated: false,
              offset: TRENDING_CARD_SNAP_WIDTH * index,
            });
          }, 50);
        }}
        onMomentumScrollEnd={(event) => {
          if (trendingPosts.length === 0) return;

          const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / TRENDING_CARD_SNAP_WIDTH,
          );
          const normalizedIndex = nextIndex % trendingPosts.length;
          const resetIndex = loopResetIndex + normalizedIndex;

          currentIndexRef.current = nextIndex;

          if (
            nextIndex < trendingPosts.length ||
            nextIndex >= loopedTrendingPosts.length - trendingPosts.length
          ) {
            currentIndexRef.current = resetIndex;
            listRef.current?.scrollToIndex({
              animated: false,
              index: resetIndex,
            });
          }
        }}
        renderItem={({ item }) => (
          <TrendingDesignCard
            post={item}
            onPress={() => onTrendingPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View className="w-4" />}
      />
    </View>
  );
}

function TrendingDesignCard({
  onPress,
  post,
}: {
  onPress: () => void;
  post: SocialFeedPost;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="w-44 overflow-hidden rounded-[28px] bg-white shadow-sm"
      accessibilityRole="button"
      accessibilityLabel={`Open quick view for ${post.title}`}
    >
      <View className="h-52 overflow-hidden rounded-[28px] bg-slate-200">
        <PostThumbnailImage uri={post.imageUri} />
        <View className="absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1.5">
          <Text className="text-xs font-black text-white">#{post.darziId}</Text>
        </View>
        <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between rounded-2xl bg-white/90 px-3 py-2">
          <Text className="max-w-[88px] text-xs font-black text-ink" numberOfLines={1}>
            {post.expertise}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="heart" size={14} color="#e11d48" />
            <Text className="ml-1 text-xs font-black text-rose-600">
              {post.likesCount.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
      <View className="p-3">
        <Text className="text-sm font-black text-ink" numberOfLines={2}>
          {post.title}
        </Text>
        <Text className="mt-1 text-xs font-bold text-slate-500" numberOfLines={1}>
          {post.tailorName}
        </Text>
      </View>
    </Pressable>
  );
}

function SpecialtyHubGrid({
  activeHub,
  onSpecialtyHubPress,
}: {
  activeHub: SpecialtyHub | null;
  onSpecialtyHubPress: (hub: SpecialtyHub) => void;
}) {
  return (
    <View className="mt-7">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-black text-ink">Explore by specialty</Text>
          <Text className="mt-1 text-xs font-bold text-slate-500">
            Tap a craft hub to filter nearby shops
          </Text>
        </View>
        {activeHub ? (
          <Text className="rounded-full bg-teal-50 px-3 py-2 text-xs font-black text-thread">
            {activeHub}
          </Text>
        ) : null}
      </View>

      <View className="mt-4 flex-row flex-wrap justify-between">
        {specialtyHubs.map((hub) => {
          const active = activeHub === hub.id;

          return (
            <Pressable
              key={hub.id}
              onPress={() => onSpecialtyHubPress(hub.id)}
              className={`mb-3 w-[48%] rounded-[26px] border p-4 ${
                active ? 'border-thread bg-teal-50' : 'border-orange-100 bg-white'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter by ${hub.label}`}
            >
              <View className={`h-14 w-14 items-center justify-center rounded-full ${
                active ? 'bg-thread' : 'bg-orange-50'
              }`}
              >
                <Ionicons
                  name={hub.icon}
                  size={26}
                  color={active ? '#ffffff' : '#d97706'}
                />
              </View>
              <Text className="mt-3 text-base font-black text-ink">{hub.label}</Text>
              <Text className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {hub.helper}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DiscoveryFilterPanel({
  activeFilterCount,
  customerLocation,
  distanceRadiusKm,
  directoryLoading,
  filteredCount,
  locationError,
  locationLoading,
  maxStartingPrice,
  minimumRating,
  onDistanceRadiusChange,
  onMaxStartingPriceChange,
  onMinimumRatingChange,
  onRefreshCustomerLocation,
  onResetFilters,
  onRushOnlyToggle,
  onSortModeChange,
  onSpecialtyChange,
  rushOnly,
  sortMode,
  specialtyFilter,
}: {
  activeFilterCount: number;
  customerLocation: Coordinates | null;
  distanceRadiusKm: DistanceRadiusKm;
  directoryLoading: boolean;
  filteredCount: number;
  locationError: string;
  locationLoading: boolean;
  maxStartingPrice: MaxStartingPrice;
  minimumRating: MinimumRating;
  onDistanceRadiusChange: (value: DistanceRadiusKm) => void;
  onMaxStartingPriceChange: (value: MaxStartingPrice) => void;
  onMinimumRatingChange: (value: MinimumRating) => void;
  onRefreshCustomerLocation: () => void;
  onResetFilters: () => void;
  onRushOnlyToggle: () => void;
  onSortModeChange: (value: SortMode) => void;
  onSpecialtyChange: (value: SpecialtyFilter) => void;
  rushOnly: boolean;
  sortMode: SortMode;
  specialtyFilter: SpecialtyFilter;
}) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const advancedFilterCount =
    (maxStartingPrice !== null ? 1 : 0) +
    (minimumRating !== null ? 1 : 0) +
    (rushOnly ? 1 : 0) +
    (specialtyFilter ? 1 : 0) +
    (sortMode !== 'bestMatch' ? 1 : 0);

  return (
    <View className="mt-6 rounded-[30px] border border-orange-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-black text-ink">Find a darzi near you</Text>
          <Text className="mt-1 text-xs font-bold leading-5 text-slate-500">
            Uses your current location with live tailor GPS points when available.
          </Text>
        </View>
        <View className="items-end">
          <View className="rounded-full bg-teal-50 px-3 py-2">
            {directoryLoading ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <Text className="text-xs font-black text-thread">{filteredCount} found</Text>
            )}
          </View>
          {activeFilterCount > 0 ? (
            <Pressable
              onPress={onResetFilters}
              className="mt-2 rounded-full bg-slate-100 px-3 py-2"
              accessibilityRole="button"
              accessibilityLabel="Reset discovery filters"
            >
              <Text className="text-xs font-black text-slate-600">Clear {activeFilterCount}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="mt-4 rounded-[24px] bg-slate-50 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-black text-ink">
              {customerLocation ? 'Customer location active' : 'Enable customer location'}
            </Text>
            <Text className="mt-1 text-xs font-bold leading-5 text-slate-500">
              {customerLocation
                ? `Distances are calculated from ${customerLocation.latitude.toFixed(4)}, ${customerLocation.longitude.toFixed(4)}.`
                : 'Tap Near Me or Nearest to allow GPS distance sorting.'}
            </Text>
          </View>
          <Pressable
            onPress={onRefreshCustomerLocation}
            disabled={locationLoading}
            className={`h-12 w-12 items-center justify-center rounded-2xl ${
              locationLoading ? 'bg-slate-200' : 'bg-thread'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Refresh customer location"
            accessibilityState={{ disabled: locationLoading }}
          >
            {locationLoading ? (
              <ActivityIndicator color="#0f766e" />
            ) : (
              <Ionicons name="locate-outline" size={22} color="#ffffff" />
            )}
          </Pressable>
        </View>
        {locationError ? (
          <Text className="mt-3 text-xs font-bold leading-5 text-rose-600">{locationError}</Text>
        ) : null}
      </View>

      <FilterSection
        icon="navigate-outline"
        title="Location radius"
        subtitle="Near Me requests permission and filters by calculated GPS distance"
      >
        {distanceFilters.map((option) => (
          <DiscoveryOptionChip
            key={option.label}
            active={distanceRadiusKm === option.value}
            label={option.label}
            helper={option.helper}
            onPress={() => onDistanceRadiusChange(option.value)}
          />
        ))}
      </FilterSection>

      <Pressable
        onPress={() => setAdvancedFiltersOpen((current) => !current)}
        className="mt-5 flex-row items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedFiltersOpen }}
        accessibilityLabel={advancedFiltersOpen ? 'Collapse advanced tailor filters' : 'Expand advanced tailor filters'}
      >
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
            <Ionicons name="options-outline" size={20} color="#0f766e" />
          </View>
          <View className="ml-3">
            <Text className="text-sm font-black text-ink">
              {advancedFiltersOpen ? 'Hide more filters' : 'More filters'}
            </Text>
            <Text className="mt-0.5 text-xs font-bold text-slate-500">
              Charges, rating, specialty, urgency, and sorting
            </Text>
          </View>
        </View>
        <View className="flex-row items-center">
          {advancedFilterCount > 0 ? (
            <View className="mr-2 rounded-full bg-thread px-2.5 py-1">
              <Text className="text-xs font-black text-white">{advancedFilterCount}</Text>
            </View>
          ) : null}
          <Ionicons
            name={advancedFiltersOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#475569"
          />
        </View>
      </Pressable>

      {advancedFiltersOpen ? (
        <>
          <FilterSection
            icon="pricetag-outline"
            title="Stitching charges"
            subtitle="Filter by starting price, not just sort order"
          >
            {priceFilters.map((option) => (
              <DiscoveryOptionChip
                key={option.label}
                active={maxStartingPrice === option.value}
                label={option.label}
                helper={option.helper}
                onPress={() => onMaxStartingPriceChange(option.value)}
              />
            ))}
          </FilterSection>

          <FilterSection
            icon="star-outline"
            title="Rating"
            subtitle="Prioritize trusted masters with strong customer feedback"
          >
            {ratingFilters.map((option) => (
              <DiscoveryOptionChip
                key={option.label}
                active={minimumRating === option.value}
                label={option.label}
                helper={option.helper}
                onPress={() => onMinimumRatingChange(option.value)}
              />
            ))}
          </FilterSection>

          <FilterSection
            icon="shirt-outline"
            title="Specialty"
            subtitle="Choose who should stitch the outfit"
          >
            {(['Gents Darzi', 'Ladies Darzan', 'Kids Master'] as const).map((specialty) => (
              <DiscoveryOptionChip
                key={specialty}
                active={specialtyFilter === specialty}
                label={specialty}
                helper={
                  specialty === 'Gents Darzi'
                    ? 'Kurta, sherwani'
                    : specialty === 'Ladies Darzan'
                      ? 'Lawn, party, bridal'
                      : 'Kids and uniforms'
                }
                onPress={() => onSpecialtyChange(specialtyFilter === specialty ? null : specialty)}
              />
            ))}
            <DiscoveryOptionChip
              active={rushOnly}
              label="Urgent"
              helper="Fast delivery"
              onPress={onRushOnlyToggle}
            />
          </FilterSection>

          <FilterSection
            icon="swap-vertical-outline"
            title="Sort results"
            subtitle="Best Match balances distance, rating, charges, and speed"
          >
            {sortModes.map((mode) => (
              <SortOptionChip
                key={mode.value}
                active={sortMode === mode.value}
                icon={mode.icon}
                label={mode.label}
                onPress={() => onSortModeChange(mode.value)}
              />
            ))}
          </FilterSection>
        </>
      ) : null}
    </View>
  );
}

function FilterSection({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}) {
  return (
    <View className="mt-5">
      <View className="flex-row items-start">
        <View className="h-9 w-9 items-center justify-center rounded-2xl bg-orange-50">
          <Ionicons name={icon} size={18} color="#d97706" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-black text-ink">{title}</Text>
          <Text className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">
            {subtitle}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="pr-3"
      >
        {children}
      </ScrollView>
    </View>
  );
}

function DiscoveryOptionChip({
  active,
  helper,
  label,
  onPress,
}: {
  active: boolean;
  helper: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-3 min-w-[118px] rounded-2xl border px-4 py-3 ${
        active ? 'border-thread bg-thread' : 'border-slate-200 bg-slate-50'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text className={`text-sm font-black ${active ? 'text-white' : 'text-ink'}`}>
        {label}
      </Text>
      <Text className={`mt-1 text-[11px] font-bold ${active ? 'text-white/80' : 'text-slate-500'}`}>
        {helper}
      </Text>
    </Pressable>
  );
}

function SortOptionChip({
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
      className={`mr-3 flex-row items-center rounded-2xl border px-4 py-3 ${
        active ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Sort by ${label}`}
    >
      <Ionicons name={icon} size={17} color={active ? '#d97706' : '#64748b'} />
      <Text className={`ml-2 text-sm font-black ${active ? 'text-amber-700' : 'text-slate-600'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-xl px-3 py-3 ${active ? 'bg-thread' : 'bg-transparent'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text className={`text-center text-xs font-black ${active ? 'text-white' : 'text-slate-500'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

const TailorShopCard = memo(function TailorShopCard({ tailor }: { tailor: TailorShop }) {
  const openShop = () => {
    Alert.alert(
      tailor.shopName,
      `Opening Tailor #${tailor.darziId} profile.\n\n${tailor.area}`,
    );
  };

  return (
    <Pressable
      onPress={openShop}
      className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm"
      accessibilityRole="button"
      accessibilityLabel={`Open ${tailor.shopName}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row flex-wrap items-center">
            <Text className="mr-2 text-xl font-black text-ink">{tailor.shopName}</Text>
            <Text className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
              #{tailor.darziId}
            </Text>
          </View>
          <Text className="mt-1 text-sm font-bold text-thread">{tailor.expertise}</Text>
          <Text className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            {tailor.matchNote}
          </Text>
        </View>

        <View className="items-end">
          <View className="flex-row items-center rounded-full bg-amber-100 px-3 py-1">
            <FontAwesome name="star" size={13} color="#d97706" />
            <Text className="ml-1 text-sm font-black text-amber-700">{tailor.rating}</Text>
          </View>
          <Text className="mt-1 text-xs font-semibold text-slate-400">
            {tailor.reviewCount} reviews
          </Text>
        </View>
      </View>

      <View className="mt-5 flex-row flex-wrap">
        <InfoPill
          icon="location-outline"
          label={hasShopCoordinates(tailor) ? `${tailor.distanceKm.toFixed(1)} km away` : 'Location pending'}
          tone="teal"
        />
        <InfoPill
          icon="pricetag-outline"
          label={`From Rs. ${tailor.startingPrice.toLocaleString()}`}
          tone="amber"
        />
        <InfoPill icon="time-outline" label={tailor.deliveryWindow} tone="slate" />
        {tailor.rushAvailable ? (
          <InfoPill icon="flash-outline" label="Rush available" tone="rose" />
        ) : null}
        {tailor.source === 'cloud' ? (
          <InfoPill icon="cloud-done-outline" label="Live profile" tone="teal" />
        ) : null}
      </View>

      <View className="mt-4 flex-row flex-wrap">
        {tailor.specialties.map((specialty) => (
          <Text
            key={specialty}
            className="mb-2 mr-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {specialty}
          </Text>
        ))}
      </View>
    </Pressable>
  );
});

function InfoPill({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'teal' | 'amber' | 'slate' | 'rose';
}) {
  const containerClass = {
    teal: 'bg-teal-50',
    amber: 'bg-amber-50',
    slate: 'bg-slate-100',
    rose: 'bg-rose-50',
  }[tone];

  const textClass = {
    teal: 'text-teal-700',
    amber: 'text-amber-700',
    slate: 'text-slate-600',
    rose: 'text-rose-700',
  }[tone];

  const iconColor = {
    teal: '#0f766e',
    amber: '#d97706',
    slate: '#475569',
    rose: '#be123c',
  }[tone];

  return (
    <View className={`mb-2 mr-2 flex-row items-center rounded-full px-3 py-2 ${containerClass}`}>
      <Ionicons name={icon} size={15} color={iconColor} />
      <Text className={`ml-1 text-xs font-black ${textClass}`}>{label}</Text>
    </View>
  );
}

function TrendingQuickViewModal({
  onClose,
  post,
  visible,
}: {
  onClose: () => void;
  post: SocialFeedPost | null;
  visible: boolean;
}) {
  if (!post) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 justify-end bg-slate-950/70 px-4 pb-5">
        <View className="overflow-hidden rounded-[32px] bg-white">
          <View className="h-80 bg-slate-200">
            <PostThumbnailImage uri={post.imageUri} />
            <Pressable
              onPress={onClose}
              className="absolute right-4 top-4 h-11 w-11 items-center justify-center rounded-full bg-ink/80"
              accessibilityRole="button"
              accessibilityLabel="Close trending design"
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            <View className="absolute bottom-4 left-4 right-4 rounded-[24px] bg-white/90 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">
                  Darzi #{post.darziId}
                </Text>
                <View className="flex-row items-center rounded-full bg-rose-50 px-3 py-1">
                  <Ionicons name="heart" size={15} color="#e11d48" />
                  <Text className="ml-1 text-xs font-black text-rose-600">
                    {post.likesCount.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View className="p-5">
            <Text className="text-2xl font-black text-ink">{post.title}</Text>
            <Text className="mt-1 text-sm font-black text-thread">{post.tailorName}</Text>
            <Text className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {post.description}
            </Text>
            <Pressable
              onPress={onClose}
              className="mt-5 flex-row items-center justify-center rounded-2xl bg-thread px-5 py-4"
              accessibilityRole="button"
              accessibilityLabel="Close quick view"
            >
              <Ionicons name="albums-outline" size={20} color="#ffffff" />
              <Text className="ml-2 text-base font-black text-white">Back to Discover</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PostThumbnailImage({ uri }: { uri: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (uri.startsWith('mock-local://') || imageFailed) {
    return (
      <View className="h-full w-full bg-slate-950">
        <View className="absolute inset-0 bg-amber-700" />
        <View className="absolute left-0 top-0 h-full w-1/2 bg-red-900" />
        <View className="absolute right-0 top-0 h-full w-1/2 bg-emerald-950" />
        <View className="absolute bottom-8 left-6 right-6 rounded-3xl bg-black/35 px-4 py-3">
          <Text className="text-base font-black text-white">Fresh Tailor Upload</Text>
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

export { tailorShops };
