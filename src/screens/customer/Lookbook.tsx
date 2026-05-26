import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { memo, useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { type SocialFeedPost, useSocialFeed } from '@/contexts/SocialFeedContext';
import type { CustomerTabParamList } from '@/navigation/types';

function buildLookbookSharePayload(item: SocialFeedPost) {
  const postLink = `darzi://tailor/${item.darziId}?lookbook=${encodeURIComponent(item.id)}`;
  const overlayText = `Check out this incredible suit stitched by Darzi #${item.darziId}! Download the Darzi App to book.`;

  return {
    title: `${item.title} by Darzi #${item.darziId}`,
    message: `${overlayText}\n\n${item.description}\n\n${postLink}`,
    url: postLink,
  };
}

async function shareLookbookPost(item: SocialFeedPost) {
  const sharePayload = buildLookbookSharePayload(item);
  await Share.share(sharePayload);
}

export function LookbookScreen() {
  const route = useRoute<RouteProp<CustomerTabParamList, 'Feed'>>();
  const { posts, savedPostIds, toggleBookmarkPost, toggleLikePost } = useSocialFeed();
  const [refreshing, setRefreshing] = useState(false);
  const darziIdFilter = route.params?.darziId;
  const visiblePosts = darziIdFilter
    ? posts.filter((post) => post.darziId === darziIdFilter)
    : posts;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const timeoutId = setTimeout(() => setRefreshing(false), 850);
    return () => clearTimeout(timeoutId);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SocialFeedPost }) => {
      return (
        <LookbookPostCard
          item={item}
          onToggleBookmark={toggleBookmarkPost}
          onToggleLike={toggleLikePost}
          saved={savedPostIds.includes(item.id)}
        />
      );
    },
    [savedPostIds, toggleBookmarkPost, toggleLikePost],
  );

  return (
    <Screen scroll={false}>
      <View className="mb-4">
        <Text className="text-3xl font-black text-ink">Feed</Text>
        <Text className="mt-2 text-base leading-6 text-slate-600">
          Real outfit inspiration from local darzis, ready to book from the feed.
        </Text>
        {darziIdFilter ? (
          <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-teal-50 px-4 py-3">
            <View className="flex-row items-center">
              <Ionicons name="qr-code-outline" size={18} color="#0f766e" />
              <Text className="ml-2 text-sm font-black text-thread">
                Showing Darzi #{darziIdFilter}
              </Text>
            </View>
            <Text className="text-xs font-bold text-slate-500">
              {visiblePosts.length} post{visiblePosts.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
        ListEmptyComponent={
          <View className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
            <Text className="text-lg font-black text-ink">No feed posts for this Darzi yet</Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              The shop was found, but this tailor has not posted showcase designs yet.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-5" />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0f766e"
            colors={['#0f766e']}
          />
        }
      />
    </Screen>
  );
}

export const FeedScreen = LookbookScreen;

const LookbookPostCard = memo(function LookbookPostCard({
  item,
  onToggleBookmark,
  onToggleLike,
  saved,
}: {
  item: SocialFeedPost;
  onToggleBookmark: (postId: string) => void;
  onToggleLike: (postId: string) => void;
  saved: boolean;
}) {
  const likeScale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    onToggleLike(item.id);
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1.22,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleConsultation = () => {
    Alert.alert('Darzi Consultation', `Opening consultation with Tailor #${item.darziId}`);
  };

  const handleShare = async () => {
    try {
      await shareLookbookPost(item);
    } catch {
      Alert.alert('Share unavailable', 'Please try sharing this feed post again.');
    }
  };

  return (
    <View className="overflow-hidden rounded-[28px] bg-white shadow-sm">
      <View className="flex-row items-center px-4 py-4">
        <PostThumbnail uri={item.thumbnailUri} />

        <View className="ml-3 flex-1">
          <View className="flex-row flex-wrap items-center">
            <Text className="mr-2 text-base font-extrabold text-ink">{item.tailorName}</Text>
            <Text className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
              #{item.darziId}
            </Text>
          </View>
          <Text className="mt-1 text-xs font-semibold text-slate-500">{item.area}</Text>
        </View>

        <Text className="max-w-[118px] rounded-full bg-amber-100 px-3 py-1 text-center text-xs font-extrabold text-amber-800">
          {item.expertise}
        </Text>
      </View>

      <View className="px-4">
        <PostMedia uri={item.imageUri} />
      </View>

      <View className="px-4 pb-5 pt-4">
        <Text className="text-xl font-black text-ink">{item.title}</Text>
        <Text className="mt-2 text-sm leading-6 text-slate-600">{item.description}</Text>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Pressable
                onPress={handleLike}
                className={`mr-3 flex-row items-center rounded-full px-3 py-2 ${
                  item.liked ? 'bg-rose-50' : 'bg-slate-50'
                }`}
                accessibilityRole="button"
                accessibilityLabel={item.liked ? 'Unlike feed post' : 'Like feed post'}
              >
                <Ionicons
                  name={item.liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={item.liked ? '#e11d48' : '#334155'}
                />
                <Text className={`ml-1 text-sm font-bold ${item.liked ? 'text-rose-600' : 'text-slate-700'}`}>
                  {item.likesCount.toLocaleString()}
                </Text>
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={() => onToggleBookmark(item.id)}
              className={`mr-3 rounded-full px-3 py-2 ${saved ? 'bg-teal-50' : 'bg-slate-50'}`}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from bookmarks' : 'Save to bookmarks'}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={saved ? '#0f766e' : '#334155'}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={handleShare}
            className="flex-row items-center rounded-full bg-ink px-4 py-2"
            accessibilityRole="button"
            accessibilityLabel={`Share ${item.title}`}
          >
            <Ionicons name="share-social-outline" size={18} color="#ffffff" />
            <Text className="ml-2 text-sm font-extrabold text-white">Share</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleConsultation}
          className="mt-5 flex-row items-center justify-center rounded-2xl bg-thread px-5 py-4"
          accessibilityRole="button"
          accessibilityLabel={`Get this stitched from tailor ${item.darziId}`}
        >
          <Ionicons name="cut-outline" size={20} color="#ffffff" />
          <Text className="ml-2 text-base font-black text-white">Get This Stitched</Text>
        </Pressable>
      </View>
    </View>
  );
});

function PostThumbnail({ uri }: { uri: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (uri.startsWith('mock-local://') || imageFailed) {
    return (
      <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <Text className="text-base font-black text-ink">D</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className="h-12 w-12 rounded-full bg-slate-200"
      onError={() => setImageFailed(true)}
    />
  );
}

function PostMedia({ uri }: { uri: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (uri.startsWith('mock-local://') || imageFailed) {
    return <DesignerSuitFeedMedia />;
  }

  return (
    <Image
      source={{ uri }}
      className="h-[430px] w-full rounded-[24px] bg-slate-200"
      resizeMode="cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function DesignerSuitFeedMedia() {
  return (
    <View className="h-[430px] w-full overflow-hidden rounded-[24px] bg-slate-950">
      <View className="absolute inset-0 bg-amber-700" />
      <View className="absolute left-0 top-0 h-full w-1/2 bg-red-900" />
      <View className="absolute right-0 top-0 h-full w-1/2 bg-emerald-950" />
      <View className="absolute left-8 right-8 top-10 rounded-[30px] border border-amber-200/40 bg-black/20 px-5 py-6">
        <Text className="text-center text-xs font-black uppercase tracking-[2px] text-amber-200">
          Darzi App
        </Text>
        <Text className="mt-2 text-center text-3xl font-black text-white">
          Fresh Tailor Upload
        </Text>
      </View>
      <View className="absolute bottom-24 left-10 right-10 h-40 rounded-t-[76px] border-4 border-amber-300/80 bg-amber-100/20" />
      <View className="absolute bottom-12 left-10 right-10 rounded-3xl bg-black/35 px-5 py-4">
        <Text className="text-base font-black text-white">Stitched by Master #433</Text>
        <Text className="mt-1 text-xs font-semibold leading-5 text-white/70">
          Local showcase post injected from tailor dashboard.
        </Text>
      </View>
    </View>
  );
}

export { buildLookbookSharePayload };
