const { db } = require('./config/firebase');
const Deal = require('./models/Deal');
const { haversineDistance } = require('./utils/geoFilter');

(async () => {
  const activeDeals = await Deal.find({ isActive: true, validUntil: { $gt: new Date() } });
  
  const parsedLat = 22.7196;
  const parsedLng = 75.8577;
  const searchRadius = 999999;
  
  const dealsWithDistance = activeDeals.map((d) => {
    const plain = d._doc ? { _id: d._id, ...d._doc } : { ...d };
    const coords = plain.vendorLocation?.coordinates;
    const hasLocation = Array.isArray(coords) && coords.length === 2 && 
                        typeof coords[0] === 'number' && typeof coords[1] === 'number' && 
                        !isNaN(coords[0]) && !isNaN(coords[1]) &&
                        !(coords[0] === 0 && coords[1] === 0);
    
    let distanceMetres = null;
    if (hasLocation) {
      const [dLng, dLat] = coords;
      distanceMetres = Math.round(haversineDistance(parsedLat, parsedLng, dLat, dLng));
    }
    return { title: plain.title, coords, hasLocation, distanceMetres };
  });

  console.log("Mapped Deals:", dealsWithDistance);

  let filteredDeals = dealsWithDistance.filter((d) => {
    if (d.distanceMetres !== null) {
      return d.distanceMetres <= searchRadius;
    }
    return searchRadius >= 50000;
  });

  console.log("Filtered Deals:", filteredDeals);

  process.exit(0);
})();
