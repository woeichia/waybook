import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const itineraryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    trip: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Short evocative trip title, e.g. Tokyo Architecture Weekend' },
        startDate: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
        endDate: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
        travelers: { type: Type.INTEGER, description: 'Number of travelers' },
        coverImage: { type: Type.STRING, description: 'Leave empty string unless user provided a verified URL' },
        currency: { type: Type.STRING, description: '3-letter currency code such as JPY, USD, EUR' },
      },
      required: ['title', 'startDate', 'endDate', 'travelers', 'coverImage', 'currency'],
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER },
          date: { type: Type.STRING, description: 'ISO date YYYY-MM-DD' },
          title: { type: Type.STRING, description: 'Concise thematic day title' },
          stops: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: 'Unique stop id like day1-stop1' },
                time: { type: Type.STRING, description: '12-hour time like 09:00 AM' },
                title: { type: Type.STRING, description: 'Place or activity name' },
                category: {
                  type: Type.STRING,
                  description: 'Must be one of: Sightseeing, Food, Hotel, Transport',
                },
                description: { type: Type.STRING, description: 'Concise 1-2 sentence traveler note' },
                image: { type: Type.STRING, description: 'Leave empty string unless user provided a verified URL' },
                locationName: { type: Type.STRING, description: 'Short neighborhood and city name' },
                mapQuery: { type: Type.STRING, description: 'Clean Google Maps search query for this exact place' },
                transitToNext: {
                  type: Type.STRING,
                  description: 'Transit time and mode to next stop e.g. "12 min walk • 900 m", or empty string for the last stop of the day',
                },
              },
              required: [
                'id',
                'time',
                'title',
                'category',
                'description',
                'image',
                'locationName',
                'mapQuery',
                'transitToNext',
              ],
            },
          },
        },
        required: ['dayNumber', 'date', 'title', 'stops'],
      },
    },
  },
  required: ['trip', 'days'],
};

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/weather', async (req: Request, res: Response) => {
    const mapsApiKey =
      process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!mapsApiKey) {
      res.status(503).json({
        error: 'Google Maps API key is not configured.',
      });
      return;
    }

    const body = req.body as {
      locationQueries?: unknown;
      tripDates?: unknown;
    };

    const rawQueries = Array.isArray(body?.locationQueries)
      ? body.locationQueries.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      : [];
    const tripDates = Array.isArray(body?.tripDates)
      ? body.tripDates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim()))
      : [];

    if (rawQueries.length === 0) {
      res.status(400).json({ error: 'Location data is required to fetch weather.' });
      return;
    }

    try {
      let geoResult: {
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
      } | null = null;

      for (const query of rawQueries.slice(0, 4)) {
        const geocodeUrl = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(query.trim())}?languageCode=en`;
        const geoRes = await fetch(geocodeUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mapsApiKey,
            'X-Goog-FieldMask': 'results.location,results.formattedAddress,results.addressComponents',
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          },
        });

        const geoJson = (await geoRes.json()) as {
          results?: Array<{
            location?: { latitude?: number; longitude?: number };
            formattedAddress?: string;
            addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
          }>;
          error?: { status?: string; message?: string };
        };

        if (geoRes.status === 429 || geoJson?.error?.status === 'RESOURCE_EXHAUSTED') {
          res.status(429).json({
            error: 'Google Maps Platform quota exceeded.',
            status: 'RESOURCE_EXHAUSTED',
          });
          return;
        }

        if (geoRes.ok && Array.isArray(geoJson.results) && geoJson.results[0]?.location) {
          geoResult = geoJson.results[0];
          break;
        }
      }

      const lat = geoResult?.location?.latitude;
      const lng = geoResult?.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        res.status(404).json({ error: 'Unable to resolve coordinates for trip location.' });
        return;
      }

      const localityComp = geoResult?.addressComponents?.find((c) =>
        c.types?.includes('locality') || c.types?.includes('administrative_area_level_1')
      );
      const locationLabel =
        localityComp?.longText ||
        geoResult?.formattedAddress?.split(',')[0]?.trim() ||
        rawQueries[0];

      const weatherUrl = new URL('https://weather.googleapis.com/v1/forecast/days:lookup');
      weatherUrl.searchParams.set('key', mapsApiKey);
      weatherUrl.searchParams.set('location.latitude', String(lat));
      weatherUrl.searchParams.set('location.longitude', String(lng));
      weatherUrl.searchParams.set('days', '10');
      weatherUrl.searchParams.set('pageSize', '10');

      const weatherRes = await fetch(weatherUrl.toString(), {
        method: 'GET',
        headers: {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      const weatherJson = (await weatherRes.json()) as {
        forecastDays?: Array<{
          displayDate?: { year?: number; month?: number; day?: number };
          daytimeForecast?: {
            weatherCondition?: {
              description?: { text?: string };
              type?: string;
            };
            precipitation?: {
              probability?: { percent?: number };
            };
          };
          maxTemperature?: { degrees?: number };
          minTemperature?: { degrees?: number };
        }>;
        error?: { status?: string; message?: string };
      };

      if (weatherRes.status === 429 || weatherJson?.error?.status === 'RESOURCE_EXHAUSTED') {
        res.status(429).json({
          error: 'Google Maps Platform quota exceeded.',
          status: 'RESOURCE_EXHAUSTED',
        });
        return;
      }

      if (!weatherRes.ok || !Array.isArray(weatherJson.forecastDays)) {
        res.status(weatherRes.status || 502).json({
          error: weatherJson?.error?.message || 'Unable to retrieve weather forecast.',
        });
        return;
      }

      const tripDateSet = new Set(tripDates);
      const normalizedDays = weatherJson.forecastDays
        .map((fd) => {
          const y = fd.displayDate?.year;
          const m = fd.displayDate?.month;
          const d = fd.displayDate?.day;
          if (!y || !m || !d) return null;
          const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          return {
            date: iso,
            conditionText: fd.daytimeForecast?.weatherCondition?.description?.text ?? 'Clear',
            conditionType: fd.daytimeForecast?.weatherCondition?.type ?? 'CLEAR',
            maxTempC: Math.round(fd.maxTemperature?.degrees ?? 0),
            minTempC: Math.round(fd.minTemperature?.degrees ?? 0),
            precipitationPercent: Math.round(fd.daytimeForecast?.precipitation?.probability?.percent ?? 0),
            matchesTripDate: tripDateSet.has(iso),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const exactMatches = normalizedDays.filter((item) => item.matchesTripDate);
      const isExactTripDates = exactMatches.length > 0;
      const selectedDays = isExactTripDates
        ? exactMatches
        : normalizedDays.slice(0, Math.max(1, Math.min(tripDates.length || 3, 5)));

      res.json({
        locationLabel,
        formattedAddress: geoResult?.formattedAddress ?? locationLabel,
        isExactTripDates,
        days: selectedDays,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Weather lookup failed.';
      console.error('Weather API proxy error:', message);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/itinerary/generate', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const body = req.body as { prompt?: unknown };
    const rawPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!rawPrompt) {
      res.status(400).json({ error: 'Please describe your trip or paste itinerary notes to import.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Convert the following travel request or raw itinerary notes into a structured, realistic, geographically logical day-by-day itinerary:\n\n${rawPrompt}`,
        config: {
          systemInstruction:
            'You are a thoughtful travel planner creating clean, geographically coherent day-by-day itineraries. ' +
            'Use only categories: "Sightseeing", "Food", "Hotel", or "Transport". ' +
            'Keep descriptions crisp (1-2 sentences). ' +
            'Order stops chronologically with realistic times (e.g., "09:00 AM") and accurate Google Maps search queries in mapQuery. ' +
            'Provide realistic transitToNext values like "14 min walk • 1.1 km" or "18 min metro • Ginza Line", and set transitToNext to "" for the final stop of each day. ' +
            'Leave coverImage and stop image fields as empty strings "" unless the user explicitly supplied valid URLs.',
          responseMimeType: 'application/json',
          responseSchema: itineraryResponseSchema,
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        res.status(502).json({ error: 'The model returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate itinerary.';
      console.error('Gemini itinerary generation error:', message);
      res.status(500).json({ error: message });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (!isProduction) {
    app.get('/registerSW.js', (_req: Request, res: Response) => {
      res.type('application/javascript').send('/* Waybook dev SW registration handled inline */\n');
    });
    app.get('/sw.js', (_req: Request, res: Response) => {
      res.type('application/javascript').send(
        "self.addEventListener('install', () => self.skipWaiting());\n" +
          "self.addEventListener('activate', () => self.registration.unregister());\n"
      );
    });
    app.use('/assets', (_req: Request, res: Response) => {
      res.status(404).type('text/plain').send('Not found');
    });

    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((req: Request, res: Response) => {
      if (
        req.path.startsWith('/assets/') ||
        /\.(?:js|mjs|css|map|json|webmanifest|png|jpe?g|svg|webp|ico|woff2?)$/i.test(req.path)
      ) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Waybook server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
