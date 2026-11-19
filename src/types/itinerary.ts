export type StopCategory = 'Sightseeing' | 'Food' | 'Hotel' | 'Transport' | string;

export interface ItineraryStop {
  id: string;
  time: string;
  title: string;
  category: StopCategory;
  description: string;
  image: string;
  /** Optional extra hosted image URLs for JSON import/export (not locally uploaded photos). */
  images?: string[];
  locationName: string;
  mapQuery: string;
  transitToNext: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  stops: ItineraryStop[];
}

export interface TripInfo {
  title: string;
  startDate: string;
  endDate: string;
  travelers: number;
  coverImage: string;
  currency: string;
}

export interface ItineraryData {
  trip: TripInfo;
  days: ItineraryDay[];
}
