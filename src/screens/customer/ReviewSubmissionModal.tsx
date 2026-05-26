import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

export type ReviewTarget = {
  id: string;
  tailorName: string;
  darziId: number;
  orderId: string;
  itemType: string;
};

export type ReviewSubmission = {
  orderId: string;
  tailorId: number;
  rating: number;
  feedback: string;
};

const quickTags = [
  'Perfect Fitting',
  'On-Time Delivery',
  'Great Embroidery',
  'Fair Price',
];
const MAX_REVIEW_LENGTH = 500;

function appendFeedbackTag(currentFeedback: string, tag: string) {
  if (currentFeedback.includes(tag)) return currentFeedback;
  return currentFeedback.trim().length > 0 ? `${currentFeedback.trim()}\n${tag}` : tag;
}

export function ReviewSubmissionModal({
  onClose,
  onSubmit,
  targetOrder,
  visible,
}: {
  onClose: () => void;
  onSubmit: (submission: ReviewSubmission) => void;
  targetOrder: ReviewTarget | null;
  visible: boolean;
}) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      setRating(5);
      setFeedback('');
      setSuccessVisible(false);
      setSubmitting(false);
      scale.setValue(0.96);
      opacity.setValue(0);
      successScale.setValue(0.92);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 18,
          stiffness: 170,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [opacity, scale, successScale, visible]);

  useEffect(() => {
    if (successVisible) {
      successScale.setValue(0.92);
      Animated.spring(successScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [successScale, successVisible]);

  const ratingLabel = useMemo(() => {
    if (rating >= 5) return 'Excellent master work';
    if (rating === 4) return 'Very good stitching';
    if (rating === 3) return 'Good, with room to improve';
    if (rating === 2) return 'Needs attention';
    return 'Poor experience';
  }, [rating]);

  if (!targetOrder) return null;

  const handleSubmit = () => {
    if (submitting) return;

    setSubmitting(true);
    const trimmedFeedback = feedback.trim();

    onSubmit({
      orderId: targetOrder.id,
      tailorId: targetOrder.darziId,
      rating,
      feedback: trimmedFeedback,
    });
    setSuccessVisible(true);

    setTimeout(() => {
      setSuccessVisible(false);
      setSubmitting(false);
      onClose();
    }, 1100);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 justify-end bg-slate-950/70 px-4 pb-5 pt-10">
        <Animated.View
          style={{ opacity, transform: [{ scale }] }}
          className="overflow-hidden rounded-[32px] bg-white shadow-lg"
        >
          <View className="bg-ink px-5 pb-5 pt-6">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-xs font-black uppercase tracking-[2px] text-amber-300">
                  Customer Review
                </Text>
                <Text className="mt-2 text-2xl font-black text-white">
                  {targetOrder.tailorName}
                </Text>
                <Text className="mt-1 text-sm font-bold text-white/70">
                  Darzi ID #{targetOrder.darziId}  -  Order {targetOrder.orderId}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-11 w-11 items-center justify-center rounded-full bg-white/10"
                accessibilityRole="button"
                accessibilityLabel="Close review modal"
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <View className="p-5">
            <View className="rounded-[26px] border border-amber-100 bg-amber-50 px-4 py-5">
              <Text className="text-center text-sm font-black uppercase tracking-wide text-amber-700">
                Rate this order
              </Text>
              <Text className="mt-1 text-center text-lg font-black text-ink">
                {targetOrder.itemType}
              </Text>

              <View className="mt-5 flex-row justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= rating;

                  return (
                    <Pressable
                      key={star}
                      onPress={() => setRating(star)}
                      className={`h-12 w-12 items-center justify-center rounded-2xl ${
                        active ? 'bg-amber-400' : 'bg-white'
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={`Set rating to ${star} stars`}
                    >
                      <FontAwesome
                        name={active ? 'star' : 'star-o'}
                        size={28}
                        color={active ? '#78350f' : '#94a3b8'}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text className="mt-4 text-center text-base font-black text-amber-900">
                {rating}/5 - {ratingLabel}
              </Text>
            </View>

            <View className="mt-5">
              <Text className="text-sm font-black uppercase tracking-wide text-slate-500">
                Quick feedback
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {quickTags.map((tag) => (
                    <Pressable
                      key={tag}
                    onPress={() =>
                      setFeedback((current) =>
                        appendFeedbackTag(current, tag).slice(0, MAX_REVIEW_LENGTH),
                      )
                    }
                    disabled={submitting}
                    className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={`Add feedback tag ${tag}`}
                  >
                    <Text className="text-xs font-black text-thread">{tag}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <TextInput
                value={feedback}
                onChangeText={(value) => setFeedback(value.slice(0, MAX_REVIEW_LENGTH))}
                multiline
                editable={!submitting}
                maxLength={MAX_REVIEW_LENGTH}
                textAlignVertical="top"
                className="min-h-[118px] text-base font-semibold leading-6 text-ink"
                placeholder="Write your feedback here (e.g., fitting, delivery speed, stitching quality)..."
                placeholderTextColor="#94a3b8"
                accessibilityLabel="Review feedback"
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className={`mt-5 flex-row items-center justify-center rounded-2xl px-5 py-4 ${
                submitting ? 'bg-slate-300' : 'bg-thread'
              }`}
              accessibilityRole="button"
              accessibilityLabel="Submit review"
            >
              <Ionicons name="send-outline" size={20} color="#ffffff" />
              <Text className="ml-2 text-base font-black text-white">Submit Review</Text>
            </Pressable>
          </View>
        </Animated.View>

        {successVisible ? (
          <Animated.View
            style={{ transform: [{ scale: successScale }] }}
            className="absolute left-6 right-6 top-20 rounded-[26px] border border-emerald-200 bg-white px-5 py-4 shadow-lg"
          >
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Ionicons name="checkmark-circle" size={30} color="#047857" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-black text-ink">Shukriya!</Text>
                <Text className="mt-1 text-sm font-bold leading-5 text-slate-600">
                  Your review has been submitted to the master.
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
