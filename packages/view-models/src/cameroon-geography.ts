/** Point géographique en degrés décimaux. */
export interface GeoPoint {
  /** Longitude (est). */
  lon: number;
  /** Latitude (nord). */
  lat: number;
}

/** Ville où se trouve un district sanitaire de démonstration. */
export interface GeoCity extends GeoPoint {
  /** Nom du district tel que l'envoie l'API d'analyse. */
  district: string;
  /** Clé de la région administrative (voir `CAMEROON_REGIONS`). */
  region: string;
}

/** Les dix régions du Cameroun (clés des libellés `epidemiology.region.*`). */
export const CAMEROON_REGIONS = [
  'extreme-nord',
  'nord',
  'adamaoua',
  'est',
  'centre',
  'littoral',
  'ouest',
  'nord-ouest',
  'sud-ouest',
  'sud',
] as const;

/** Villes connues (positions approximatives). */
export const CAMEROON_CITIES: readonly GeoCity[] = [
  { district: 'Mora', region: 'extreme-nord', lon: 14.14, lat: 11.05 },
  { district: 'Maroua', region: 'extreme-nord', lon: 14.32, lat: 10.59 },
  { district: 'Garoua', region: 'nord', lon: 13.4, lat: 9.3 },
  { district: 'Ngaoundéré', region: 'adamaoua', lon: 13.58, lat: 7.32 },
  { district: 'Bertoua', region: 'est', lon: 13.68, lat: 4.58 },
  { district: 'Yaoundé', region: 'centre', lon: 11.52, lat: 3.87 },
  { district: 'Douala', region: 'littoral', lon: 9.7, lat: 4.05 },
  { district: 'Bafoussam', region: 'ouest', lon: 10.42, lat: 5.48 },
  { district: 'Bamenda', region: 'nord-ouest', lon: 10.16, lat: 5.96 },
  { district: 'Buea', region: 'sud-ouest', lon: 9.24, lat: 4.15 },
  { district: 'Ebolowa', region: 'sud', lon: 11.15, lat: 2.92 },
  { district: 'Kribi', region: 'sud', lon: 9.91, lat: 2.94 },
];

/** Contour simplifié du Cameroun (suffisant pour une carte de veille). */
export const CAMEROON_OUTLINE: readonly GeoPoint[] = [
  { lon: 8.5, lat: 4.6 },
  { lon: 9.3, lat: 3.9 },
  { lon: 9.8, lat: 2.35 },
  { lon: 11.35, lat: 2.3 },
  { lon: 11.3, lat: 1.7 },
  { lon: 13.1, lat: 2.25 },
  { lon: 14.5, lat: 2.15 },
  { lon: 16.2, lat: 2.3 },
  { lon: 16.0, lat: 3.5 },
  { lon: 15.1, lat: 4.4 },
  { lon: 14.5, lat: 5.9 },
  { lon: 15.2, lat: 7.3 },
  { lon: 14.5, lat: 8.7 },
  { lon: 14.2, lat: 9.9 },
  { lon: 15.5, lat: 10.0 },
  { lon: 14.9, lat: 11.4 },
  { lon: 14.2, lat: 12.3 },
  { lon: 13.6, lat: 13.1 },
  { lon: 13.0, lat: 12.0 },
  { lon: 12.4, lat: 10.2 },
  { lon: 11.6, lat: 7.8 },
  { lon: 10.4, lat: 6.9 },
  { lon: 9.4, lat: 6.1 },
];

/** Cadre de la carte en degrés, avec une marge. */
export const CAMEROON_BOUNDS = { minLon: 8, maxLon: 16.7, minLat: 1.4, maxLat: 13.5 } as const;

/** Ville d'un district, ou `undefined` si le district est inconnu de la carte. */
export function cityOfDistrict(district: string): GeoCity | undefined {
  return CAMEROON_CITIES.find((city) => city.district === district);
}

/** Projette une position dans un cadre de `width` × `height` (équirectangulaire, nord en haut). */
export function projectPoint(point: GeoPoint, width: number, height: number): { x: number; y: number } {
  const { minLon, maxLon, minLat, maxLat } = CAMEROON_BOUNDS;
  return {
    x: ((point.lon - minLon) / (maxLon - minLon)) * width,
    y: ((maxLat - point.lat) / (maxLat - minLat)) * height,
  };
}
