import { FontAwesome, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { ScannableQrCode } from '@/components/ScannableQrCode';
import { useSocialFeed } from '@/contexts/SocialFeedContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProfileStackParamList } from '@/navigation/types';
import { resolveActiveTailorProfileId } from '@/utils/cloudOrders';
import { buildTailorDeepLink } from '@/utils/deepLinks';

type DressCategory = 'Gents Wear' | 'Bridal Boutique' | 'Luxury Lawn';
type UploadState = 'idle' | 'picking' | 'uploading' | 'publishing';

const dressCategories: DressCategory[] = ['Gents Wear', 'Bridal Boutique', 'Luxury Lawn'];
const DEFAULT_DESIGN_NAME = 'Raw Silk Wedding Sherwani';
const DEFAULT_CAPTION =
  'Premium Raw Silk Sherwani with detailed hand embroidery around the collar. Perfect for wedding season!';
const DARZI_ID = 433;
const TAILOR_NAME = 'Khan Tailors';
const TAILOR_AREA = 'Liberty Market, Lahore';
const STORAGE_BUCKET = 'outfit-showcases';
const MAX_DESIGN_NAME_LENGTH = 80;
const MAX_CAPTION_LENGTH = 500;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function createPostId() {
  return `lookbook-${Date.now()}`;
}

function buildViralShareMessage(darziId: number) {
  return `Just finished stitching this masterpiece! Scan the QR code or look up Darzi ID #${darziId} on the Darzi App to book your slot.`;
}

async function shareShowcasePost(darziId: number, designName: string, caption: string, category: DressCategory) {
  await Share.share({
    title: `Darzi #${darziId} ${designName}`,
    message: `${buildViralShareMessage(darziId)}\n\n${designName} - ${category}\n${caption}\n\ndarzi://tailor/${darziId}`,
    url: `darzi://tailor/${darziId}`,
  });
}

async function uriToBlob(uri: string) {
  const response = await fetch(uri);
  return response.blob();
}

function getStorageFilePath(ownerId: string) {
  return `${ownerId}/${Date.now()}.jpg`;
}

async function uploadOutfitImage(uri: string, ownerId: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Check your Expo public Supabase environment variables.');
  }

  const fileBody = await uriToBlob(uri);
  const filePath = getStorageFilePath(ownerId);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileBody, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function getUploadProgress(uploadState: UploadState) {
  if (uploadState === 'picking') return 12;
  if (uploadState === 'uploading') return 68;
  if (uploadState === 'publishing') return 92;
  return 0;
}

export function ShowcaseUploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { addPost } = useSocialFeed();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [designName, setDesignName] = useState(DEFAULT_DESIGN_NAME);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);
  const [category, setCategory] = useState<DressCategory>('Gents Wear');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const toastTranslateY = useRef(new Animated.Value(-24)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const busy = uploadState !== 'idle';
  const canPublish =
    selectedImageUri !== null && designName.trim().length > 0 && caption.trim().length > 0 && !busy;
  const uploadProgress = getUploadProgress(uploadState);

  const previewSubtitle = useMemo(() => {
    if (uploadedImageUrl) return 'Cloud image ready for Feed publishing';
    return selectedImageUri ? category : 'Select a photo to activate export preview';
  }, [category, selectedImageUri, uploadedImageUrl]);

  useEffect(() => {
    if (!toastVisible) return;

    toastTranslateY.setValue(-24);
    toastOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(toastTranslateY, {
        toValue: 0,
        damping: 16,
        stiffness: 140,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timeoutId = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -24,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastVisible(false);
        navigation.goBack();
      });
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [navigation, toastOpacity, toastTranslateY, toastVisible]);

  const handleSelectMedia = async () => {
    if (busy) return;

    setUploadState('picking');

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });

      if (result.canceled) {
        setUploadState('idle');
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error('No image URI returned from image picker.');
      }

      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_BYTES) {
        Alert.alert('Image too large', 'Please choose an outfit photo smaller than 10 MB.');
        setUploadState('idle');
        return;
      }

      if (asset.mimeType && !ALLOWED_IMAGE_MIME_TYPES.includes(asset.mimeType)) {
        Alert.alert('Unsupported image type', 'Please choose a JPG, PNG, or WebP outfit photo.');
        setUploadState('idle');
        return;
      }

      setSelectedImageUri(asset.uri);
      setUploadedImageUrl(null);
      setUploadState('idle');
    } catch (error) {
      if (__DEV__) {
        console.info('[ShowcaseUploadScreen] Image selection failed', error);
      }
      setUploadState('idle');
      Alert.alert('Image selection failed', 'Could not select this photo. Please try another stitched suit image.');
    }
  };

  const handlePublish = async () => {
    if (!canPublish || !selectedImageUri) {
      Alert.alert('Showcase incomplete', 'Select a stitched suit photo and add a design name and caption first.');
      return;
    }

    setUploadState('uploading');

    try {
      const storageOwnerId = await resolveActiveTailorProfileId();
      const publicImageUrl = await uploadOutfitImage(selectedImageUri, storageOwnerId);
      setUploadedImageUrl(publicImageUrl);
      setUploadState('publishing');

      await addPost({
        id: createPostId(),
        title: designName.trim(),
        tailorName: TAILOR_NAME,
        darziId: DARZI_ID,
        expertise: category,
        imageUri: publicImageUrl,
        thumbnailUri: publicImageUrl,
        likesCount: 0,
        liked: false,
        description: caption.trim(),
        area: TAILOR_AREA,
        createdAt: new Date().toISOString(),
      });

      setToastVisible(true);
    } catch (error) {
      if (__DEV__) {
        console.info('[ShowcaseUploadScreen] Cloud upload failed', error);
      }
      Alert.alert(
        'Upload failed',
        'Could not upload this showcase image to Supabase Storage. Confirm the outfit-showcases bucket exists and allows uploads.',
      );
    } finally {
      setUploadState('idle');
    }
  };

  const handleShare = async () => {
    try {
      await shareShowcasePost(DARZI_ID, designName.trim(), caption.trim(), category);
    } catch {
      Alert.alert('Share unavailable', 'Please try sharing this showcase post again.');
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
          disabled={busy}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-3xl font-black text-ink">Post to Feed</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-500">
            Upload a real stitched suit photo to Supabase Storage and publish it live.
          </Text>
        </View>
      </View>

      {toastVisible ? (
        <Animated.View
          style={{ opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }}
          className="mt-5 flex-row items-center rounded-2xl bg-emerald-600 px-4 py-3"
        >
          <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
          <View className="ml-3 flex-1">
            <Text className="text-base font-black text-white">Published to Darzi Feed</Text>
            <Text className="text-xs font-semibold text-white/80">
              Your uploaded image is now served from Supabase Storage.
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Pressable
        onPress={handleSelectMedia}
        className={`mt-6 overflow-hidden rounded-[32px] border-2 ${
          selectedImageUri ? 'border-amber-300 bg-slate-950' : 'border-dashed border-slate-300 bg-white'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Select stitched suit photo"
        disabled={busy}
      >
        {selectedImageUri ? (
          <UploadedImagePreview uri={selectedImageUri} heightClass="h-[420px]" />
        ) : (
          <View className="h-[340px] items-center justify-center px-8">
            <View className="h-20 w-20 items-center justify-center rounded-[28px] bg-teal-50">
              <Ionicons name="camera-outline" size={42} color="#0f766e" />
            </View>
            <Text className="mt-5 text-center text-2xl font-black text-ink">
              Tap to select stitched suit photo
            </Text>
            <Text className="mt-2 text-center text-sm font-semibold leading-6 text-slate-500">
              Pick a real outfit image from your gallery, crop it to a social-friendly 4:5 frame, then publish.
            </Text>
          </View>
        )}

        {selectedImageUri ? (
          <View className="absolute right-4 top-4 rounded-full bg-white/90 px-4 py-2">
            <Text className="text-sm font-black text-ink">
              {busy ? 'Uploading...' : 'Change Photo'}
            </Text>
          </View>
        ) : null}

        {busy ? (
          <UploadOverlay progress={uploadProgress} uploadState={uploadState} />
        ) : null}
      </Pressable>

      <View className="mt-6 rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
        <Text className="text-xs font-black uppercase tracking-wide text-thread">
          Customer / Design Name
        </Text>
        <TextInput
          value={designName}
          onChangeText={(value) => setDesignName(value.slice(0, MAX_DESIGN_NAME_LENGTH))}
          editable={!busy}
          maxLength={MAX_DESIGN_NAME_LENGTH}
          placeholder="e.g. Raw Silk Wedding Sherwani"
          placeholderTextColor="#94a3b8"
          className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-black text-ink"
        />

        <Text className="mt-5 text-xs font-black uppercase tracking-wide text-thread">
          Description Caption
        </Text>
        <TextInput
          value={caption}
          onChangeText={(value) => setCaption(value.slice(0, MAX_CAPTION_LENGTH))}
          editable={!busy}
          maxLength={MAX_CAPTION_LENGTH}
          multiline
          textAlignVertical="top"
          placeholder="Describe the fabric, cut, embroidery, occasion, and why customers should book you."
          placeholderTextColor="#94a3b8"
          className="mt-3 min-h-[132px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold leading-6 text-ink"
        />

        <View className="mt-5">
          <Text className="text-xs font-black uppercase tracking-wide text-thread">
            Dress Category
          </Text>
          <Pressable
            onPress={() => setCategoryOpen((current) => !current)}
            className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            accessibilityRole="button"
            accessibilityLabel="Select dress category"
            disabled={busy}
          >
            <View className="flex-row items-center">
              <Ionicons name="shirt-outline" size={20} color="#0f766e" />
              <Text className="ml-2 text-base font-black text-ink">{category}</Text>
            </View>
            <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={21} color="#0f172a" />
          </Pressable>

          {categoryOpen ? (
            <View className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {dressCategories.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setCategory(item);
                    setCategoryOpen(false);
                  }}
                  className={`flex-row items-center justify-between px-4 py-4 ${
                    item === category ? 'bg-teal-50' : 'bg-white'
                  }`}
                >
                  <Text className={`text-sm font-black ${item === category ? 'text-thread' : 'text-slate-700'}`}>
                    {item}
                  </Text>
                  {item === category ? (
                    <Ionicons name="checkmark-circle" size={20} color="#0f766e" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-6 rounded-[32px] bg-slate-950 p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
              Social Media Export Preview
            </Text>
            <Text className="mt-1 text-sm font-bold text-white/60">{previewSubtitle}</Text>
          </View>
          <View className="flex-row">
            <FontAwesome name="instagram" size={22} color="#fbbf24" />
            <FontAwesome name="facebook-square" size={22} color="#fbbf24" style={{ marginLeft: 12 }} />
          </View>
        </View>

        <View className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-slate-900">
          {selectedImageUri ? (
            <UploadedImagePreview uri={selectedImageUri} heightClass="h-[480px]" />
          ) : (
            <View className="h-[480px] items-center justify-center bg-slate-900 px-8">
              <Ionicons name="image-outline" size={64} color="#64748b" />
              <Text className="mt-4 text-center text-base font-bold text-slate-400">
                Select a photo to preview branded share asset.
              </Text>
            </View>
          )}

          <View className="absolute bottom-0 left-0 right-0 flex-row items-center bg-slate-950/80 px-4 py-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-amber-400">
              <Text className="text-xl font-black text-ink">D</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black uppercase tracking-wide text-amber-200">
                Darzi App
              </Text>
              <Text className="mt-1 text-lg font-black text-white">
                Stitched by Master #{DARZI_ID}
              </Text>
            </View>
            <MiniQrCode />
          </View>

          {busy ? (
            <UploadOverlay progress={uploadProgress} uploadState={uploadState} compact />
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={handlePublish}
        className={`mt-6 flex-row items-center justify-center rounded-2xl px-5 py-5 ${
          canPublish ? 'bg-thread' : 'bg-slate-300'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Publish to Darzi Feed"
        disabled={!canPublish}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Ionicons name="cloud-upload-outline" size={22} color="#ffffff" />
        )}
        <Text className="ml-2 text-lg font-black text-white">
          {busy ? 'Uploading Showcase...' : 'Publish to Darzi Feed'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleShare}
        className="mt-3 flex-row items-center justify-center rounded-2xl border-2 border-thread bg-transparent px-5 py-4"
        accessibilityRole="button"
        accessibilityLabel="Share to TikTok and Facebook Stories"
        disabled={busy}
      >
        <Ionicons name="share-social-outline" size={21} color="#0f766e" />
        <Text className="ml-2 text-base font-black text-thread">
          Share to TikTok / Facebook Stories
        </Text>
      </Pressable>
    </Screen>
  );
}

function UploadedImagePreview({ heightClass, uri }: { heightClass: string; uri: string }) {
  return (
    <Image
      source={{ uri }}
      className={`${heightClass} w-full bg-slate-900`}
      resizeMode="cover"
    />
  );
}

function UploadOverlay({
  compact = false,
  progress,
  uploadState,
}: {
  compact?: boolean;
  progress: number;
  uploadState: UploadState;
}) {
  const label = uploadState === 'picking'
    ? 'Opening gallery'
    : uploadState === 'uploading'
      ? 'Uploading to Supabase Storage'
      : uploadState === 'publishing'
        ? 'Publishing Feed post'
        : 'Preparing upload';

  return (
    <View className="absolute inset-0 items-center justify-center bg-slate-950/65 px-8">
      <View className={`items-center rounded-[28px] bg-white px-6 py-5 ${compact ? 'scale-90' : ''}`}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="mt-4 text-center text-base font-black text-ink">{label}</Text>
        <Text className="mt-1 text-center text-sm font-bold text-thread">{progress}%</Text>
        <View className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-slate-200">
          <View className="h-2 rounded-full bg-thread" style={{ width: `${progress}%` }} />
        </View>
      </View>
    </View>
  );
}

function MiniQrCode() {
  return (
    <View className="items-center justify-center rounded-2xl border-2 border-white bg-white p-1">
      <ScannableQrCode value={buildTailorDeepLink(DARZI_ID)} size={70} quietZoneModules={2} />
    </View>
  );
}

export { buildViralShareMessage, uploadOutfitImage };
