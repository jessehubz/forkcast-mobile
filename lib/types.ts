export type Profile = {
  id: string;
  role: "owner" | "diner";
  name: string;
  email: string;
  noShowCount: number;
  createdAt: string;
};

export type Restaurant = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: string;
  cuisine: string;
  coverImage: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt: string;
};

export type Table = {
  id: string;
  restaurantId: string;
  label: string;
  seats: number;
  x: number;
  y: number;
  floor?: number;
  active?: boolean;
};

export type Reservation = {
  id: string;
  restaurantId: string;
  tableId: string;
  dinerId: string;
  dinerName: string;
  partySize: number;
  date: string;
  status: string;
  depositAmount: number;
  depositPaid: boolean;
  notes?: string | null;
  dinerNotes?: string | null;
  ownerNotes?: string | null;
  createdAt: string;
  restaurant?: Restaurant;
  table?: Table;
};

export type Waitlist = {
  id: string;
  restaurantId: string;
  dinerId: string;
  dinerName: string;
  partySize: number;
  date: string;
  notified: boolean;
  restaurant?: Restaurant;
};

export type Review = {
  id: string;
  restaurantId: string;
  dinerId: string;
  dinerName: string;
  rating: number;
  foodRating: number;
  serviceRating: number;
  ambianceRating: number;
  title: string;
  body: string;
  createdAt: string;
};
