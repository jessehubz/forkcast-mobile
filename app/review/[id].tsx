import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const STAR = '★';
const STAR_EMPTY = '★';

type SubCategory = 'food' | 'service' | 'ambiance';

function StarRow({
  rating,
  onRate,
  size = 36,
}: {
  rating: number;
  onRate: (r: number) => void;
  size?: number;
}) {
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onRate(n)} activeOpacity={0.7}>
          <Text
            style={{ fontSize: size, color: n <= rating ? Colors.maroonLight : Colors.border }}
          >
            {STAR}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ReviewScreen() {
  const { id: reservationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState('');
  const [restaurantName, setRestaurantName] = useState('');

  const [rating, setRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [ambianceRating, setAmbianceRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reservationId) return;
    supabase
      .from('Reservation')
      .select('restaurantId, restaurant:Restaurant(name)')
      .eq('id', reservationId)
      .single()
      .then(({ data }) => {
        if (data) {
          setRestaurantId(data.restaurantId ?? '');
          const nameRaw = (data as any).restaurant;
          if (Array.isArray(nameRaw)) {
            setRestaurantName(nameRaw[0]?.name ?? '');
          } else {
            setRestaurantName(nameRaw?.name ?? '');
          }
        }
      })
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select an overall star rating.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a review.');
      return;
    }

    const { data: profile } = await supabase
      .from('Profile')
      .select('name')
      .eq('id', user.id)
      .single();

    setSubmitting(true);
    try {
      const { error } = await supabase.from('Review').insert({
        restaurantId,
        dinerId: user.id,
        dinerName: profile?.name ?? user.email ?? 'Guest',
        rating,
        foodRating: foodRating || rating,
        serviceRating: serviceRating || rating,
        ambianceRating: ambianceRating || rating,
        title: title.trim(),
        body: body.trim(),
      });

      if (error) throw error;

      Alert.alert('Thank you!', 'Your review has been submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, foodRating, serviceRating, ambianceRating, title, body, restaurantId]);

  if (loading) {
    return (
      <View className="flex-1 bg-d-bg items-center justify-center">
        <ActivityIndicator color={Colors.maroon} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-d-bg">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-3 pb-2">
          <TouchableOpacity className="flex-row items-center gap-0.5" onPress={() => router.back()} activeOpacity={0.7}>
            <Text className="text-[28px] text-d-text leading-[32px] -mt-0.5">‹</Text>
            <Text className="text-[15px] text-d-text font-medium">Back</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-[24px] font-bold text-d-text px-5 mt-2">Rate your experience</Text>
        {restaurantName ? (
          <Text className="text-[15px] text-d-text-sub px-5 mt-1 mb-1">{restaurantName}</Text>
        ) : null}

        {/* Overall star rating */}
        <View className="px-5 mt-6 items-start gap-2.5">
          <Text className="text-[13px] font-bold text-d-text-sub uppercase tracking-[0.5px]">Overall</Text>
          <StarRow rating={rating} onRate={setRating} size={40} />
        </View>

        {/* Sub-ratings */}
        <View className="px-5 mt-7 gap-4">
          <Text className="text-[14px] font-bold text-d-text mb-1">Detailed Ratings</Text>

          {(
            [
              { key: 'food' as SubCategory, label: 'Food', value: foodRating, set: setFoodRating },
              { key: 'service' as SubCategory, label: 'Service', value: serviceRating, set: setServiceRating },
              { key: 'ambiance' as SubCategory, label: 'Ambiance', value: ambianceRating, set: setAmbianceRating },
            ] as const
          ).map(({ key, label, value, set }) => (
            <View key={key} className="flex-row items-center justify-between">
              <Text className="text-[14px] text-d-text-sub font-medium w-20">{label}</Text>
              <StarRow rating={value} onRate={set} size={26} />
            </View>
          ))}
        </View>

        {/* Review title */}
        <View className="px-5 mt-6 gap-2">
          <Text className="text-[13px] font-semibold text-d-text-sub uppercase tracking-[0.5px]">Review Title</Text>
          <TextInput
            className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[14px] text-d-text"
            value={title}
            onChangeText={setTitle}
            placeholder="Summarize your visit"
            placeholderTextColor={Colors.creamDim}
            returnKeyType="next"
          />
        </View>

        {/* Review body */}
        <View className="px-5 mt-6 gap-2">
          <Text className="text-[13px] font-semibold text-d-text-sub uppercase tracking-[0.5px]">Your Review</Text>
          <TextInput
            className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[14px] text-d-text min-h-[110px]"
            style={{ textAlignVertical: 'top' }}
            value={body}
            onChangeText={setBody}
            placeholder="Tell others about your experience — the food, atmosphere, service..."
            placeholderTextColor={Colors.creamDim}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          className={`mx-5 mt-8 bg-d-accent rounded-[14px] py-[17px] items-center justify-center min-h-[54px]${submitting || rating === 0 ? " opacity-45" : ""}`}
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text className="text-[16px] font-bold text-white tracking-[0.2px]">Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
