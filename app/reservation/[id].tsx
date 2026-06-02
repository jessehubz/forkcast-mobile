import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, statusColor, statusLabel } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Reservation } from '@/lib/types';

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 min-w-[45%] bg-d-surface rounded-[12px] border border-d-border p-3.5 gap-1">
      <Text className="text-[11px] text-d-text-dim font-semibold uppercase tracking-[0.5px]">{label}</Text>
      <Text className="text-[14px] text-d-text font-semibold leading-[20px]">{value}</Text>
    </View>
  );
}

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [hasReview, setHasReview] = useState(false);

  const fetchReservation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('Reservation')
        .select('*, restaurant:Restaurant(*), table:Table(*)')
        .eq('id', id)
        .single();

      setReservation(data ?? null);

      if (data?.restaurantId && data?.dinerId) {
        const { data: review } = await supabase
          .from('Review')
          .select('id')
          .eq('restaurantId', data.restaurantId)
          .eq('dinerId', data.dinerId)
          .maybeSingle();
        setHasReview(!!review);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation? This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Reservation',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await supabase
                .from('Reservation')
                .update({ status: 'cancelled' })
                .eq('id', id);
              setReservation((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
            } catch {
              Alert.alert('Error', 'Could not cancel the reservation. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-d-bg items-center justify-center">
        <ActivityIndicator color={Colors.maroon} size="large" />
      </View>
    );
  }

  if (!reservation) {
    return (
      <View className="flex-1 bg-d-bg items-center justify-center">
        <Text className="text-d-text-sub text-[16px]">Reservation not found.</Text>
      </View>
    );
  }

  const resDate = new Date(reservation.date);
  const now = new Date();
  const hoursUntil = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const canCancel =
    (reservation.status === 'confirmed' || reservation.status === 'approved') &&
    hoursUntil > 24;

  const dateStr = resDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = resDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const restaurantName = reservation.restaurant?.name ?? 'Restaurant';
  const tableLabel = reservation.table?.label ?? '—';
  const sColor = statusColor(reservation.status);

  return (
    <SafeAreaView className="flex-1 bg-d-bg">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-3 pb-2 gap-2">
          <TouchableOpacity className="flex-row items-center gap-0.5" onPress={() => router.back()} activeOpacity={0.7}>
            <Text className="text-[28px] text-d-text leading-[32px] -mt-0.5">‹</Text>
            <Text className="text-[15px] text-d-text font-medium">Back</Text>
          </TouchableOpacity>
          <Text className="text-[17px] font-bold text-d-text ml-2">Reservation Details</Text>
        </View>

        {/* Status badge */}
        <View className="items-center mt-5 mb-2">
          <View
            className="border rounded-[20px] px-[18px] py-[7px]"
            style={{ backgroundColor: sColor + '22', borderColor: sColor }}
          >
            <Text className="text-[14px] font-bold tracking-[0.5px]" style={{ color: sColor }}>
              {statusLabel(reservation.status)}
            </Text>
          </View>
        </View>

        {/* Restaurant name */}
        <Text className="text-[22px] font-bold text-d-text text-center px-6 mb-6 mt-2">{restaurantName}</Text>

        {/* Info grid 2x2 */}
        <View className="flex-row flex-wrap px-5 gap-3 mb-5">
          <InfoCard label="Date" value={dateStr} />
          <InfoCard label="Time" value={timeStr} />
          <InfoCard label="Party Size" value={`${reservation.partySize} guests`} />
          <InfoCard label="Table" value={tableLabel} />
        </View>

        {/* Deposit info */}
        {reservation.depositAmount > 0 && (
          <View className="flex-row items-center gap-2.5 px-5 mb-5">
            <Text className="text-[14px] text-d-text-dim font-medium">Deposit</Text>
            <Text className="text-[16px] font-bold text-d-text flex-1">₱{reservation.depositAmount}</Text>
            <View
              className="border rounded-[12px] px-2.5 py-1"
              style={{
                backgroundColor: reservation.depositPaid
                  ? Colors.success + '22'
                  : Colors.warning + '22',
                borderColor: reservation.depositPaid ? Colors.success : Colors.warning,
              }}
            >
              <Text
                className="text-[12px] font-bold"
                style={{ color: reservation.depositPaid ? Colors.success : Colors.warning }}
              >
                {reservation.depositPaid ? 'Paid' : 'Unpaid'}
              </Text>
            </View>
          </View>
        )}

        {/* Owner notes card */}
        {reservation.ownerNotes ? (
          <View
            className="mx-5 bg-d-surface rounded-[10px] p-3.5 mb-5 gap-1.5"
            style={{ borderLeftWidth: 3, borderLeftColor: Colors.maroon }}
          >
            <Text className="text-[12px] font-bold uppercase tracking-[0.5px]" style={{ color: Colors.maroonLight }}>Message from restaurant</Text>
            <Text className="text-[14px] text-d-text leading-[21px]">{reservation.ownerNotes}</Text>
          </View>
        ) : null}

        {/* Rejected: rebook */}
        {reservation.status === 'rejected' && reservation.ownerNotes && (
          <TouchableOpacity
            className="mx-5 bg-d-accent rounded-[14px] py-[15px] items-center mb-5"
            onPress={() =>
              router.push(`/restaurant/${reservation.restaurantId}/book`)
            }
            activeOpacity={0.85}
          >
            <Text className="text-[15px] font-bold text-white">Rebook with these details</Text>
          </TouchableOpacity>
        )}

        {/* Completed: leave review */}
        {reservation.status === 'completed' && !hasReview && (
          <View className="mx-5 bg-d-surface rounded-[14px] border border-d-border p-5 items-center gap-3.5 mb-5">
            <Text className="text-[16px] font-semibold text-d-text">How was your experience?</Text>
            <TouchableOpacity
              className="bg-d-accent rounded-[12px] py-3 px-7 items-center"
              onPress={() => router.push(`/review/${id}`)}
              activeOpacity={0.85}
            >
              <Text className="text-[15px] font-bold text-white">Leave a Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cancel section */}
        {canCancel && (
          <View className="mx-5 mt-2 gap-2.5">
            <TouchableOpacity
              className={`border-[1.5px] border-d-danger rounded-[14px] py-[15px] items-center justify-center min-h-[52px]${cancelling ? " opacity-50" : ""}`}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator color={Colors.danger} size="small" />
              ) : (
                <Text className="text-[15px] font-bold text-d-danger">Cancel Reservation</Text>
              )}
            </TouchableOpacity>
            <Text className="text-[12px] text-d-text-dim text-center leading-[17px]">
              Free cancellation available while more than 24 hours away.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
