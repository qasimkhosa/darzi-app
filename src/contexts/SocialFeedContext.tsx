import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { loadSavedBookmarks, saveSavedBookmarks } from '@/utils/persistence';

export type SocialFeedPost = {
  id: string;
  title: string;
  tailorName: string;
  darziId: number;
  expertise: string;
  imageUri: string;
  thumbnailUri: string;
  likesCount: number;
  liked: boolean;
  description: string;
  area: string;
  createdAt: string;
};

export type NewSocialFeedPost = Omit<SocialFeedPost, 'liked'> & {
  liked?: boolean;
};

type PostsTableRow = {
  id: string;
  title: string;
  tailor_name: string;
  darzi_id: number;
  expertise: string;
  image_uri: string;
  thumbnail_uri: string;
  likes_count: number;
  liked?: boolean | null;
  description: string;
  area: string;
  created_at: string;
};

type PostsTableInsert = {
  id: string;
  title: string;
  tailor_name: string;
  darzi_id: number;
  expertise: string;
  image_uri: string;
  thumbnail_uri: string;
  likes_count: number;
  description: string;
  area: string;
  created_at: string;
};

type SocialFeedContextValue = {
  posts: SocialFeedPost[];
  savedPostIds: string[];
  loading: boolean;
  addPost: (newPost: NewSocialFeedPost) => Promise<void>;
  toggleBookmarkPost: (postId: string) => void;
  toggleLikePost: (postId: string) => void;
};

const initialSocialFeedPosts: SocialFeedPost[] = [
  {
    id: 'velvet-sherwani-433',
    title: 'Velvet Gents Sherwani',
    tailorName: 'Royal Stitch House',
    darziId: 433,
    expertise: 'Gents Master',
    area: 'Liberty Market, Lahore',
    likesCount: 1840,
    liked: false,
    imageUri:
      'https://images.unsplash.com/photo-1610189029775-777d70fe2f78?auto=format&fit=crop&w=1200&q=85',
    thumbnailUri:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    description:
      'Deep maroon velvet sherwani with antique dull-gold buttons, structured shoulders, and hand-finished piping for baraat wear.',
    createdAt: '2026-05-24T11:00:00+05:00',
  },
  {
    id: 'bridal-shalwar-kameez-118',
    title: 'Designer Bridal Shalwar Kameez',
    tailorName: 'Nigar Bridal Studio',
    darziId: 118,
    expertise: 'Bridal Specialist',
    area: 'Tariq Road, Karachi',
    likesCount: 3215,
    liked: false,
    imageUri:
      'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=85',
    thumbnailUri:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    description:
      'Ivory bridal shalwar kameez finished with resham, dabka, and pearl detailing for nikkah day styling.',
    createdAt: '2026-05-23T16:20:00+05:00',
  },
  {
    id: 'luxury-eid-kurta-567',
    title: 'Luxury Eid Kurta',
    tailorName: 'Master Iqbal Tailors',
    darziId: 567,
    expertise: 'Kurta Pajama Expert',
    area: 'F-10 Markaz, Islamabad',
    likesCount: 956,
    liked: false,
    imageUri:
      'https://images.unsplash.com/photo-1593032465175-481ac7f401f0?auto=format&fit=crop&w=1200&q=85',
    thumbnailUri:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
    description:
      'Breathable cotton-silk kurta with tonal embroidery on the ban collar, built for Eid namaz and family dinners.',
    createdAt: '2026-05-22T13:45:00+05:00',
  },
  {
    id: 'modern-kurti-284',
    title: 'Modern Block Print Kurti',
    tailorName: 'Aangan Pret Alterations',
    darziId: 284,
    expertise: 'Ladies Pret Fit',
    area: 'Johar Town, Lahore',
    likesCount: 1278,
    liked: false,
    imageUri:
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=85',
    thumbnailUri:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    description:
      'A-line kurti with clean side slits, concealed stitching, and sleeve finishing tuned for daily office wear.',
    createdAt: '2026-05-21T19:10:00+05:00',
  },
  {
    id: 'waistcoat-set-901',
    title: 'Formal Waistcoat Set',
    tailorName: 'Karim Waistcoat Works',
    darziId: 901,
    expertise: 'Waistcoat Specialist',
    area: 'Saddar, Rawalpindi',
    likesCount: 742,
    liked: false,
    imageUri:
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=85',
    thumbnailUri:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    description:
      'Charcoal textured waistcoat with slim lapel shaping, matched for shalwar kameez and winter dinner events.',
    createdAt: '2026-05-20T12:25:00+05:00',
  },
];

const SocialFeedContext = createContext<SocialFeedContextValue | undefined>(undefined);

function logFeedFallback(message: string, error?: unknown) {
  if (__DEV__) {
    console.info(message, error);
  }
}

function fromPostsTableRow(row: PostsTableRow): SocialFeedPost {
  return {
    id: row.id,
    title: row.title,
    tailorName: row.tailor_name,
    darziId: row.darzi_id,
    expertise: row.expertise,
    imageUri: row.image_uri,
    thumbnailUri: row.thumbnail_uri,
    likesCount: row.likes_count,
    liked: row.liked ?? false,
    description: row.description,
    area: row.area,
    createdAt: row.created_at,
  };
}

function toPostsTableInsert(post: NewSocialFeedPost): PostsTableInsert {
  return {
    id: post.id,
    title: post.title,
    tailor_name: post.tailorName,
    darzi_id: post.darziId,
    expertise: post.expertise,
    image_uri: post.imageUri,
    thumbnail_uri: post.thumbnailUri,
    likes_count: post.likesCount,
    description: post.description,
    area: post.area,
    created_at: post.createdAt,
  };
}

function isPostsTableRow(value: unknown): value is PostsTableRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.tailor_name === 'string' &&
    typeof row.darzi_id === 'number' &&
    typeof row.expertise === 'string' &&
    typeof row.image_uri === 'string' &&
    typeof row.thumbnail_uri === 'string' &&
    typeof row.likes_count === 'number' &&
    typeof row.description === 'string' &&
    typeof row.area === 'string' &&
    typeof row.created_at === 'string'
  );
}

function mergePostByCreatedAt(currentPosts: SocialFeedPost[], incomingPost: SocialFeedPost) {
  const dedupedPosts = currentPosts.filter((post) => post.id !== incomingPost.id);
  return [incomingPost, ...dedupedPosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getPostsTable() {
  return supabase?.from('posts' as never);
}

export function SocialFeedProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<SocialFeedPost[]>(initialSocialFeedPosts);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrateFeedState() {
      setLoading(true);

      try {
        const localSavedPostIds = await loadSavedBookmarks();

        if (active) {
          setSavedPostIds(localSavedPostIds);
        }

        if (!isSupabaseConfigured || !supabase) {
          if (active) {
            setPosts(initialSocialFeedPosts);
          }
          return;
        }

        const { data, error } = await getPostsTable()!
          .select('*')
          .order('created_at' as never, { ascending: false });

        if (error) {
          throw error;
        }

        const remotePosts = Array.isArray(data)
          ? data.filter(isPostsTableRow).map(fromPostsTableRow)
          : [];

        if (!active) return;

        setPosts(remotePosts.length > 0 ? remotePosts : initialSocialFeedPosts);
      } catch (error) {
        logFeedFallback('[SocialFeedContext] Using local fallback posts', error);
        if (active) {
          setPosts(initialSocialFeedPosts);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrateFeedState();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    const supabaseClient = supabase;

    const channel = supabaseClient
      .channel('public:posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && isPostsTableRow(payload.new)) {
            const incomingPost = fromPostsTableRow(payload.new);
            setPosts((currentPosts) => mergePostByCreatedAt(currentPosts, incomingPost));
            return;
          }

          if (payload.eventType === 'UPDATE' && isPostsTableRow(payload.new)) {
            const updatedPost = fromPostsTableRow(payload.new);
            setPosts((currentPosts) =>
              currentPosts.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
            );
            return;
          }

          if (
            payload.eventType === 'DELETE' &&
            typeof payload.old === 'object' &&
            payload.old !== null &&
            'id' in payload.old
          ) {
            const deletedPostId = (payload.old as { id?: unknown }).id;
            if (typeof deletedPostId === 'string') {
              setPosts((currentPosts) => currentPosts.filter((post) => post.id !== deletedPostId));
            }
          }
        },
      )
      .subscribe((status, error) => {
        if (error || status === 'CHANNEL_ERROR') {
          logFeedFallback('[SocialFeedContext] Realtime feed unavailable, continuing locally', error);
        }
      });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, []);

  const addPost = useCallback(async (newPost: NewSocialFeedPost) => {
    const optimisticPost: SocialFeedPost = {
      ...newPost,
      liked: newPost.liked ?? false,
    };

    setPosts((currentPosts) => mergePostByCreatedAt(currentPosts, optimisticPost));

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      const { data, error } = await getPostsTable()!
        .insert([toPostsTableInsert(newPost)] as never)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (isPostsTableRow(data)) {
        const insertedPost = fromPostsTableRow(data);
        setPosts((currentPosts) => mergePostByCreatedAt(currentPosts, insertedPost));
      }
    } catch (error) {
      logFeedFallback('Failed to insert post into Supabase', error);
      throw error;
    }
  }, []);

  const toggleLikePost = useCallback((postId: string) => {
    const currentPost = posts.find((post) => post.id === postId);
    if (!currentPost) return;

    const previousLiked = currentPost.liked;
    const previousLikesCount = currentPost.likesCount;
    const nextLiked = !currentPost.liked;
    const likeDelta = nextLiked ? 1 : -1;
    const nextLikesCount = Math.max(0, currentPost.likesCount + (nextLiked ? 1 : -1));

    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;

        return {
          ...post,
          liked: nextLiked,
          likesCount: nextLikesCount,
        };
      }),
    );

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    async function updateRemoteLikeCount() {
      try {
        const client = supabase as any;
        const { data, error } = await client.rpc('increment_post_like_count', {
          target_post_id: postId,
          delta: likeDelta,
        });

        if (error) {
          throw error;
        }

        if (typeof data === 'number') {
          setPosts((currentPosts) =>
            currentPosts.map((post) =>
              post.id === postId ? { ...post, likesCount: data } : post,
            ),
          );
        }
      } catch (error) {
        logFeedFallback('Failed to update post likes in Supabase', error);
        setPosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  liked: previousLiked,
                  likesCount: previousLikesCount,
                }
              : post,
          ),
        );
      }
    }

    void updateRemoteLikeCount();
  }, [posts]);

  const toggleBookmarkPost = useCallback((postId: string) => {
    setSavedPostIds((currentPostIds) => {
      if (currentPostIds.includes(postId)) {
        const nextPostIds = currentPostIds.filter((savedPostId) => savedPostId !== postId);
        void saveSavedBookmarks(nextPostIds);
        return nextPostIds;
      }

      const nextPostIds = [postId, ...currentPostIds];
      void saveSavedBookmarks(nextPostIds);
      return nextPostIds;
    });
  }, []);

  const value = useMemo(
    () => ({
      posts,
      savedPostIds,
      loading,
      addPost,
      toggleBookmarkPost,
      toggleLikePost,
    }),
    [addPost, loading, posts, savedPostIds, toggleBookmarkPost, toggleLikePost],
  );

  return <SocialFeedContext.Provider value={value}>{children}</SocialFeedContext.Provider>;
}

export function useSocialFeed() {
  const context = useContext(SocialFeedContext);

  if (!context) {
    throw new Error('useSocialFeed must be used inside SocialFeedProvider');
  }

  return context;
}

export { initialSocialFeedPosts };
