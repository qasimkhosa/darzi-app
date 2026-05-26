import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadLocalLanguage,
  saveLocalLanguage,
  type PersistedLanguage,
} from '@/utils/persistence';

export type Language = PersistedLanguage;

export type TranslationKey =
  | 'app.name'
  | 'common.next'
  | 'common.skip'
  | 'common.done'
  | 'language.title'
  | 'language.subtitle'
  | 'language.english'
  | 'language.urdu'
  | 'language.change'
  | 'language.currentEnglish'
  | 'language.currentUrdu'
  | 'onboarding.brandSubtitle'
  | 'onboarding.localFirst'
  | 'onboarding.localFirstBody'
  | 'onboarding.slide1.title'
  | 'onboarding.slide1.subtitle'
  | 'onboarding.slide2.title'
  | 'onboarding.slide2.subtitle'
  | 'onboarding.slide3.title'
  | 'onboarding.slide3.subtitle'
  | 'onboarding.cta'
  | 'nav.discover'
  | 'nav.lookbook'
  | 'nav.orders'
  | 'nav.profile'
  | 'measurement.length'
  | 'measurement.shoulders'
  | 'measurement.chest'
  | 'measurement.sleeves'
  | 'measurement.kameezLength'
  | 'measurement.shalwarLength'
  | 'measurement.collar'
  | 'status.pending'
  | 'status.orderPlaced'
  | 'status.inCutting'
  | 'status.stitching'
  | 'status.ready'
  | 'status.readyForPickup'
  | 'status.delivered'
  | 'profile.title'
  | 'profile.subtitle'
  | 'profile.viewCustomer'
  | 'profile.viewTailor'
  | 'profile.logOut'
  | 'profile.measurementVault'
  | 'profile.primarySuit'
  | 'profile.editMeasurements'
  | 'profile.trackingParchis'
  | 'profile.styleBoard'
  | 'profile.activeParchis'
  | 'profile.savedDesigns'
  | 'profile.styleBoardHelper'
  | 'profile.emptyStyleBoardTitle'
  | 'profile.emptyStyleBoardBody'
  | 'profile.createParchi'
  | 'profile.postLookbook'
  | 'profile.printBanner'
  | 'profile.shopMetrics';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    'app.name': 'Darzi',
    'common.next': 'Next',
    'common.skip': 'Skip',
    'common.done': 'Done',
    'language.title': 'Select Language / زبان منتخب کریں',
    'language.subtitle': 'Choose the language you want to use across Darzi.',
    'language.english': 'English',
    'language.urdu': 'اردو',
    'language.change': 'Change Language / زبان تبدیل کریں',
    'language.currentEnglish': 'English active',
    'language.currentUrdu': 'Urdu active',
    'onboarding.brandSubtitle': 'Boutique tailoring network',
    'onboarding.localFirst': 'Local-first Darzi tools',
    'onboarding.localFirstBody':
      'Built for customers, master tailors, QR parchis, and real shop workflows.',
    'onboarding.slide1.title': 'Goodbye Paper Parchis!',
    'onboarding.slide1.subtitle':
      'Track your stitching order status in real-time. No more lost receipts or broken promises.',
    'onboarding.slide2.title': 'Find Master Tailors Near You',
    'onboarding.slide2.subtitle':
      'Filter by distance, stitching rates, and specific specialties like Gents Kurta Master or Bridal Boutique Expert.',
    'onboarding.slide3.title': 'Your Personal Fashion Lookbook',
    'onboarding.slide3.subtitle':
      'Save trending designs from local tailors to your Style Board and share your finished outfits directly onto TikTok & Facebook.',
    'onboarding.cta': 'Get Started / Shuru Karein',
    'nav.discover': 'Discover',
    'nav.lookbook': 'Feed',
    'nav.orders': 'My Orders',
    'nav.profile': 'Profile',
    'measurement.length': 'Length / Lambaai',
    'measurement.shoulders': 'Shoulders / Teera',
    'measurement.chest': 'Chest / Chaati',
    'measurement.sleeves': 'Sleeves / Aasteen',
    'measurement.kameezLength': 'Kameez Length',
    'measurement.shalwarLength': 'Shalwar Length',
    'measurement.collar': 'Collar',
    'status.pending': 'Pending',
    'status.orderPlaced': 'Order Placed',
    'status.inCutting': 'In Cutting',
    'status.stitching': 'Stitching',
    'status.ready': 'Ready',
    'status.readyForPickup': 'Ready for Pickup',
    'status.delivered': 'Delivered',
    'profile.title': 'Profile',
    'profile.subtitle': 'Test customer measurements, digital parchis, and tailor shop QR tools.',
    'profile.viewCustomer': 'View as Customer',
    'profile.viewTailor': 'View as Tailor',
    'profile.logOut': 'Log Out',
    'profile.measurementVault': 'Measurement Vault',
    'profile.primarySuit': 'Primary Kameez Shalwar',
    'profile.editMeasurements': 'Edit Measurements',
    'profile.trackingParchis': 'My Tracking Parchis',
    'profile.styleBoard': 'My Style Board',
    'profile.activeParchis': 'Active Digital Parchis',
    'profile.savedDesigns': 'Saved Designs',
    'profile.styleBoardHelper': 'Your private style board for in-shop consultation.',
    'profile.emptyStyleBoardTitle': 'Your style board is empty!',
    'profile.emptyStyleBoardBody':
      'Swipe through the Feed and save designs you want your master to stitch.',
    'profile.createParchi': 'Create New Digital Parchi',
    'profile.postLookbook': 'Post to Feed',
    'profile.printBanner': 'Print Banner via Bluetooth/Share PDF',
    'profile.shopMetrics': 'Shop Metrics',
  },
  ur: {
    'app.name': 'درزی',
    'common.next': 'اگلا',
    'common.skip': 'چھوڑ دیں',
    'common.done': 'مکمل',
    'language.title': 'Select Language / زبان منتخب کریں',
    'language.subtitle': 'Darzi میں استعمال کے لیے اپنی پسندیدہ زبان منتخب کریں۔',
    'language.english': 'English',
    'language.urdu': 'اردو',
    'language.change': 'Change Language / زبان تبدیل کریں',
    'language.currentEnglish': 'انگریزی فعال ہے',
    'language.currentUrdu': 'اردو فعال ہے',
    'onboarding.brandSubtitle': 'بوتیک ٹیلرنگ نیٹ ورک',
    'onboarding.localFirst': 'مقامی درزی ٹولز',
    'onboarding.localFirstBody':
      'کسٹمرز، ماسٹر درزی، QR پرچیوں اور دکان کے اصل کام کے لیے بنایا گیا۔',
    'onboarding.slide1.title': 'کاغذی پرچیوں کو الوداع کہیں',
    'onboarding.slide1.subtitle':
      'اپنے سلائی آرڈر کا اسٹیٹس ریئل ٹائم میں ٹریک کریں۔ رسید گم ہونے اور وعدہ ٹوٹنے کی پریشانی ختم۔',
    'onboarding.slide2.title': 'اپنے قریب ماسٹر درزی تلاش کریں',
    'onboarding.slide2.subtitle':
      'فاصلہ، سلائی ریٹ، اور خاص مہارت جیسے جینٹس کرتا ماسٹر یا برائیڈل بوتیک ایکسپرٹ کے حساب سے فلٹر کریں۔',
    'onboarding.slide3.title': 'آپ کا ذاتی فیشن لک بک',
    'onboarding.slide3.subtitle':
      'مقامی درزیوں کے ٹرینڈنگ ڈیزائن محفوظ کریں اور اپنی تیار شدہ ڈریسز TikTok اور Facebook پر شیئر کریں۔',
    'onboarding.cta': 'Get Started / شروع کریں',
    'nav.discover': 'دریافت',
    'nav.lookbook': 'فیڈ',
    'nav.orders': 'میرے آرڈرز',
    'nav.profile': 'پروفائل',
    'measurement.length': 'لمبائی / Lambaai',
    'measurement.shoulders': 'تیرا / Teera',
    'measurement.chest': 'چھاتی / Chaati',
    'measurement.sleeves': 'آستین / Aasteen',
    'measurement.kameezLength': 'قمیض لمبائی',
    'measurement.shalwarLength': 'شلوار لمبائی',
    'measurement.collar': 'کالر',
    'status.pending': 'زیر التواء',
    'status.orderPlaced': 'آرڈر موصول',
    'status.inCutting': 'کٹنگ جاری',
    'status.stitching': 'سلائی جاری',
    'status.ready': 'تیار',
    'status.readyForPickup': 'وصولی کے لیے تیار',
    'status.delivered': 'ڈیلیور ہو گیا',
    'profile.title': 'پروفائل',
    'profile.subtitle': 'کسٹمر ناپ، ڈیجیٹل پرچیاں، اور درزی شاپ QR ٹولز ٹیسٹ کریں۔',
    'profile.viewCustomer': 'کسٹمر کے طور پر دیکھیں',
    'profile.viewTailor': 'درزی کے طور پر دیکھیں',
    'profile.logOut': 'لاگ آؤٹ',
    'profile.measurementVault': 'ناپ والٹ',
    'profile.primarySuit': 'پرائمری قمیض شلوار',
    'profile.editMeasurements': 'ناپ تبدیل کریں',
    'profile.trackingParchis': 'میری ٹریکنگ پرچیاں',
    'profile.styleBoard': 'میرا اسٹائل بورڈ',
    'profile.activeParchis': 'فعال ڈیجیٹل پرچیاں',
    'profile.savedDesigns': 'محفوظ ڈیزائن',
    'profile.styleBoardHelper': 'دکان میں مشاورت کے لیے آپ کا ذاتی اسٹائل بورڈ۔',
    'profile.emptyStyleBoardTitle': 'آپ کا اسٹائل بورڈ خالی ہے!',
    'profile.emptyStyleBoardBody':
      'Feed دیکھیں اور وہ ڈیزائن محفوظ کریں جو آپ ماسٹر سے سلوانا چاہتے ہیں۔',
    'profile.createParchi': 'نئی ڈیجیٹل پرچی بنائیں',
    'profile.postLookbook': 'Feed پر پوسٹ کریں',
    'profile.printBanner': 'Bluetooth/Share PDF سے بینر پرنٹ کریں',
    'profile.shopMetrics': 'دکان میٹرکس',
  },
};

type LanguageContextValue = {
  language: Language | null;
  isHydrated: boolean;
  isRtl: boolean;
  setLanguage: (nextLanguage: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrateLanguage() {
      const storedLanguage = await loadLocalLanguage();

      if (!active) return;

      setLanguageState(storedLanguage);
      setIsHydrated(true);
    }

    void hydrateLanguage();

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    await saveLocalLanguage(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(async () => {
    const nextLanguage = language === 'ur' ? 'en' : 'ur';
    await setLanguage(nextLanguage);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey) => {
      const activeLanguage = language ?? 'en';
      return translations[activeLanguage][key] ?? translations.en[key] ?? key;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isHydrated,
      isRtl: language === 'ur',
      setLanguage,
      toggleLanguage,
      t,
    }),
    [isHydrated, language, setLanguage, t, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}

export { translations };
