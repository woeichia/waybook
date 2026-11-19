export interface DailyWeatherSummary {
  date: string; // YYYY-MM-DD
  conditionText: string;
  conditionType: string;
  maxTempC: number;
  minTempC: number;
  precipitationPercent: number;
  matchesTripDate: boolean;
}

export interface TripWeatherSummary {
  locationLabel: string;
  formattedAddress: string;
  isExactTripDates: boolean;
  days: DailyWeatherSummary[];
}
