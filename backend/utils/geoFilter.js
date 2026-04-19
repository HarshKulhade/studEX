'use strict';

/**
 * Haversine distance calculator.
 *
 * Computes the great-circle distance between two geographic points
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lng1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lng2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in metres
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in metres

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metres
};

/**
 * Build a MongoDB GeoJSON Point.
 * @param {number} lng
 * @param {number} lat
 * @returns {{ type: 'Point', coordinates: [number, number] }}
 */
const toGeoJSONPoint = (lng, lat) => ({
  type: 'Point',
  coordinates: [parseFloat(lng), parseFloat(lat)],
});

/**
 * Filter an array of objects by proximity to a reference point.
 * Useful for in-memory filtering of small datasets (e.g. kiosks).
 *
 * @param {Array<{ location: { coordinates: [number, number] } }>} items
 * @param {number} refLat
 * @param {number} refLng
 * @param {number} radiusMetres
 * @returns {Array<{ item: *, distanceMetres: number }>}
 */
const filterByRadius = (items, refLat, refLng, radiusMetres) => {
  return items
    .map((item) => {
      const [lng, lat] = item.location.coordinates;
      const distanceMetres = haversineDistance(refLat, refLng, lat, lng);
      return { item, distanceMetres };
    })
    .filter(({ distanceMetres }) => distanceMetres <= radiusMetres)
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
};

module.exports = { haversineDistance, toGeoJSONPoint, filterByRadius };
