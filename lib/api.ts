import { supabase } from "./supabase";
import type { Profile, Restaurant, Table, Reservation, Waitlist } from "./types";

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from("Profile").select("*").eq("id", id).single();
  return data;
}

export async function getRestaurants(filters?: { cuisine?: string; partySize?: number }): Promise<Restaurant[]> {
  let query = supabase.from("Restaurant").select("*");
  if (filters?.cuisine) query = query.ilike("cuisine", `%${filters.cuisine}%`);
  const { data } = await query.order("createdAt", { ascending: false });
  return data ?? [];
}

export async function getRestaurant(id: string) {
  const { data } = await supabase
    .from("Restaurant")
    .select("*, tables:Table(*), reservations:Reservation(*)")
    .eq("id", id)
    .single();
  return data;
}

export async function getAvailableTables(restaurantId: string, dateTime: string): Promise<{ tables: Table[]; bookedIds: string[] }> {
  const date = new Date(dateTime);
  const slotStart = new Date(date.getTime() - 30 * 60000).toISOString();
  const slotEnd = new Date(date.getTime() + 90 * 60000).toISOString();

  const [{ data: tables }, { data: booked }] = await Promise.all([
    supabase.from("Table").select("*").eq("restaurantId", restaurantId),
    supabase
      .from("Reservation")
      .select("tableId")
      .eq("restaurantId", restaurantId)
      .gte("date", slotStart)
      .lte("date", slotEnd)
      .neq("status", "cancelled"),
  ]);

  return {
    tables: tables ?? [],
    bookedIds: (booked ?? []).map((r: any) => r.tableId),
  };
}

export async function getDinerReservations(dinerId: string): Promise<Reservation[]> {
  const { data } = await supabase
    .from("Reservation")
    .select("*, restaurant:Restaurant(*), table:Table(*)")
    .eq("dinerId", dinerId)
    .order("date", { ascending: false });
  return data ?? [];
}

export async function getOwnerRestaurant(ownerId: string) {
  const { data } = await supabase
    .from("Restaurant")
    .select("*, tables:Table(*)")
    .eq("ownerId", ownerId)
    .single();
  return data;
}

export async function getOwnerReservations(restaurantId: string): Promise<Reservation[]> {
  const { data } = await supabase
    .from("Reservation")
    .select("*, table:Table(*)")
    .eq("restaurantId", restaurantId)
    .order("date", { ascending: true });
  return data ?? [];
}

export async function getTodayReservations(restaurantId: string): Promise<Reservation[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data } = await supabase
    .from("Reservation")
    .select("*, table:Table(*)")
    .eq("restaurantId", restaurantId)
    .gte("date", today.toISOString())
    .lt("date", tomorrow.toISOString())
    .neq("status", "cancelled");
  return data ?? [];
}

export async function createReservation(data: {
  restaurantId: string;
  tableId: string;
  dinerId: string;
  dinerName: string;
  partySize: number;
  date: string;
  depositAmount: number;
  dinerNotes?: string;
}): Promise<Reservation | null> {
  const { data: res, error } = await supabase
    .from("Reservation")
    .insert({
      ...data,
      status: data.depositAmount > 0 ? "confirmed" : "confirmed",
      depositPaid: data.depositAmount > 0,
    })
    .select()
    .single();
  if (error) throw error;
  return res;
}

export async function updateReservationStatus(id: string, status: string, dinerId?: string) {
  await supabase.from("Reservation").update({ status }).eq("id", id);
  if (status === "no_show" && dinerId) {
    await supabase.rpc("increment_no_show", { user_id: dinerId }).catch(() => {
      supabase
        .from("Profile")
        .select("noShowCount")
        .eq("id", dinerId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase.from("Profile").update({ noShowCount: (data.noShowCount ?? 0) + 1 }).eq("id", dinerId);
          }
        });
    });
  }
}

export async function cancelReservation(id: string) {
  await supabase.from("Reservation").update({ status: "cancelled" }).eq("id", id);
}

export async function joinWaitlist(data: {
  restaurantId: string;
  dinerId: string;
  dinerName: string;
  partySize: number;
  date: string;
}) {
  const { data: entry, error } = await supabase.from("Waitlist").insert(data).select().single();
  if (error) throw error;
  return entry;
}

export async function getDinerWaitlists(dinerId: string): Promise<Waitlist[]> {
  const { data } = await supabase
    .from("Waitlist")
    .select("*, restaurant:Restaurant(*)")
    .eq("dinerId", dinerId)
    .order("createdAt", { ascending: false });
  return data ?? [];
}

export async function calculateDeposit(restaurantId: string, dateTime: string, totalTables: number): Promise<number> {
  const date = new Date(dateTime);
  const slotStart = new Date(date.getTime() - 30 * 60000).toISOString();
  const slotEnd = new Date(date.getTime() + 90 * 60000).toISOString();

  const { count } = await supabase
    .from("Reservation")
    .select("*", { count: "exact", head: true })
    .eq("restaurantId", restaurantId)
    .gte("date", slotStart)
    .lte("date", slotEnd)
    .neq("status", "cancelled");

  const occupancy = (count ?? 0) / (totalTables || 1);
  if (occupancy > 0.85) return 400;
  if (occupancy > 0.70) return 200;
  return 0;
}
