import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY || '';
const privateKey = rawKey.includes('-----BEGIN')
  ? rawKey.replace(/\\n/g, '\n')
  : rawKey;

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.GOOGLE_SA_PROJECT_ID,
  private_key_id: process.env.GOOGLE_SA_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.GOOGLE_SA_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_SA_CLIENT_ID,
  token_uri: 'https://oauth2.googleapis.com/token',
};

const SHEET_IDS = [
  '1Ece40wMrW4uy2Yz1dvEjXalhU56oB3zK5IZtKdxj2uw',
  '1oyfEWbZYU_u3W2gRor0E1f8QcTHEQrGTf0X6Q2pgMaA',
  '1YeX47WVqbnt92jZ6XHNe7owthwq3US9pjnxcJJnYG40'
];

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// In-memory geocode cache (lives for duration of server process)
const geocodeCache = {};

function getAuth() {
  return new google.auth.GoogleAuth({ credentials: serviceAccount, scopes: SCOPES });
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  return rows.slice(1)
    .filter(row => row.some(cell => cell))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(row[i] || '').trim(); });
      return obj;
    });
}

// Haversine distance in km — completely free, pure math
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate travel time assuming 30 km/h average urban speed
function estimateDuration(distanceKm) {
  const mins = Math.round((distanceKm / 30) * 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Nominatim (OpenStreetMap) geocoding — free, no API key needed
async function geocodeWithNominatim(locationName) {
  const key = locationName.trim().toLowerCase();
  if (geocodeCache[key] !== undefined) return geocodeCache[key];

  try {
    const encoded = encodeURIComponent(locationName + ', India');
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'ArogyaGram-App/1.0' }, // Nominatim requires a User-Agent
    });
    const data = await resp.json();
    if (data?.length > 0) {
      const { lat, lon } = data[0];
      const coords = { lat: parseFloat(lat), lng: parseFloat(lon) };
      geocodeCache[key] = coords;
      return coords;
    }
  } catch (err) {
    console.warn('Nominatim geocode error:', err.message);
  }
  geocodeCache[key] = null;
  return null;
}

export async function getMedicineRecords(req, res) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const results = await Promise.all(
      SHEET_IDS.map(id =>
        sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'Sheet1' })
      )
    );

    let records = results.flatMap(r => rowsToObjects(r.data.values || []));

    const { lat, lng } = req.query;
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      // Get unique location names
      const uniqueLocations = [
        ...new Set(records.map(r => (r['location'] || '').trim()).filter(Boolean)),
      ];

      // Geocode all unique locations in parallel using Nominatim (free!)
      const geoResults = await Promise.all(
        uniqueLocations.map(async loc => {
          const coords = await geocodeWithNominatim(loc);
          return { loc, coords };
        })
      );

      // Build a lookup map: location name → { distanceKm, distanceLabel, duration }
      const infoMap = {};
      for (const { loc, coords } of geoResults) {
        if (coords) {
          const km = haversineKm(userLat, userLng, coords.lat, coords.lng);
          infoMap[loc.toLowerCase()] = {
            distanceValue: km,
            distance: formatDistance(km),
            duration: estimateDuration(km),
          };
        } else {
          infoMap[loc.toLowerCase()] = null;
        }
      }

      // Attach distance info to each record
      records = records.map(r => {
        const loc = (r['location'] || '').trim();
        const info = infoMap[loc.toLowerCase()];
        return {
          ...r,
          _distance: info?.distance || null,
          _duration: info?.duration || null,
          _distanceValue: info?.distanceValue ?? null,
        };
      });

      // Sort nearest first
      records.sort((a, b) => {
        if (a._distanceValue == null && b._distanceValue == null) return 0;
        if (a._distanceValue == null) return 1;
        if (b._distanceValue == null) return -1;
        return a._distanceValue - b._distanceValue;
      });
    }

    return res.json({ success: true, count: records.length, records });
  } catch (err) {
    console.error('Sheets fetch error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
