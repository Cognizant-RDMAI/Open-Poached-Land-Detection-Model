var image = ee.Image("projects/rdmai-dev-ml/assets/S2L2Ax10_T30UVC-cfc2b9fbd-20211001_MS"),
    trainingData = ee.FeatureCollection("projects/rdmai-dev-ml/assets/6_Training_Classes");
// Center the map on the image
Map.centerObject(image, 14);

var extent = ee.Feature(image.geometry());
// Load Sentinel-2 image 
var image2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2021-09-30', '2021-10-02')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  
// Select relevant bands: Blue, Green, Red, Near-Infrared (NIR), and Shortwave Infrared (SWIR)
  .select(['B2', 'B3', 'B4', 'B8', 'B11']);

// Create a True Colour Composite (TCC) of Sentinel-2 image using B4 (Red), B3 (Green), B2 (Blue)
var trueColor = image2.select(['B4', 'B3', 'B2']).clip(extent);

// Add True Colour Composite (TCC) to the map as a reference layer
//Map.addLayer(trueColor, {min: 0, max: 3000}, 'Sentinel-2 TCC image (10m)');

// Add Sentinel-2 upscaled image as a base layer
Map.addLayer(image, {}, 'Sentinel-2 upscaled image (1m)');
var roadVector = ee.FeatureCollection("projects/ee-rdmai/assets/road1_4buffer");
//Map.addLayer(roadVector, {color: 'white'}, 'Road vectors');

// Load Dynamic World land cover dataset
var dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .filterBounds(image.geometry())
  .filterDate('2021-01-01', '2021-12-31')  // Adjust year as needed
  .median();  // Composite to reduce cloud/noise

// Built-up class in Dynamic World is 6
var builtUpMask = dw.select('label').neq(6);  // Keep everything except built-up

//Map.addLayer(builtUpMask, {color: 'grey'}, 'Built-up mask');

// Apply the mask to the Sentinel-2 upscaled image
image = image.updateMask(builtUpMask);

// Assign landcover labels to each feature collection
// var poached_land = poached_land.map(function(feature) {
//   return feature.set('landcover', 0);
// });
// var barecropland = barecropland.map(function(feature) {
//   return feature.set('landcover', 1);
// });
// var cropland = cropland.map(function(feature) {
//   return feature.set('landcover', 2);
// });
// var trees = trees.map(function(feature) {
//   return feature.set('landcover', 3);
// });
// var waterbodies = waterbodies.map(function(feature) {
//   return feature.set('landcover', 4);
// });

// Merge all feature collections into one FeatureCollection
// var trainingData = poached_land
//   .merge(barecropland)
//   .merge(cropland)
//   .merge(trees)
//   .merge(waterbodies);

// Sample the upscaled imagery to get a FeatureCollection of training data
// var sampleData = image.sampleRegions({
//   collection: trainingData,
//   properties: ['landcover'],
//   scale: 5
// });

// Split the sample data into training (70%) and testing (30%) sets
// sampleData = sampleData.randomColumn();
var trainingSet = trainingData.filter(ee.Filter.lte('random', 0.7));
var testingSet  = trainingData.filter(ee.Filter.gt('random', 0.7));

// Train a Random Forest classifier
var classifier = ee.Classifier.smileRandomForest(10).train({
  features: trainingSet,
  classProperty: 'landcover',
  inputProperties: image.bandNames()
});

// Classify the image
var classifiedImage = image.classify(classifier);

// Display the classification result
//Map.centerObject(image, 14);
//Map.addLayer(classifiedImage, {
//min: 0,
//max: 4,
//palette: ['red', 'yellow', 'orange', 'green', 'blue']
//}, 'Classification');

// Create a legend
//var legend = ui.Panel({
//  style: {
//    position: 'bottom-left',
//    padding: '8px 15px'
//  }
//});

// Legend title
//var legendTitle = ui.Label({
//  value: 'Landcover Legend',
//  style: {
//    fontWeight: 'bold',
//    fontSize: '16px',
//    margin: '0 0 6px 0',
//    padding: '0'
//  }
//});
//legend.add(legendTitle);

// Define legend entries
//var makeLegendRow = function(color, name) {
//  var colorBox = ui.Label({
//    style: {
//      backgroundColor: color,
//      padding: '8px',
//      margin: '0 0 4px 0'
//    }
//  });

//  var description = ui.Label({
//    value: name,
//    style: {margin: '0 0 4px 6px'}
//  });

//  return ui.Panel({
//    widgets: [colorBox, description],
//    layout: ui.Panel.Layout.Flow('horizontal')
//  });
//};

// Extract poached land (class 0) from the classified image
var poachedLandMask = classifiedImage.eq(0);
var poachedLandLayer = classifiedImage.updateMask(poachedLandMask);

// Extract bare cropland (class 1) from the classified image
var bareCroplandMask = classifiedImage.eq(1);
var bareCroplandLayer = classifiedImage.updateMask(bareCroplandMask);

// Calculate Bare Soil Index (BSI)
// Formula: ((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))
// bands: B2 = Blue, B3 = Green, B4 = Red, B8 = NIR, B11 = SWIR
var bsi = image2.expression(
  '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))', {
    'SWIR': image2.select('B11'),
    'RED': image2.select('B4'),
    'NIR': image2.select('B8'),
    'BLUE': image2.select('B2')
}).rename('BSI').clip(extent);

// Add BSI layer to the map
//Map.addLayer(bsi, {min: -1, max: 1, palette: ['blue', 'white', 'brown']}, 'BSI Layer');


// Mask BSI values <= 0
var bsiPositive = bsi.updateMask(bsi.gt(0));

// Convert BSI > 0 raster to integer (required for vectorization)
var bsiInt = bsiPositive.multiply(1000).toInt();

// Vectorize the BSI mask
var bsiVectors = bsiInt.reduceToVectors({
  geometry: extent.geometry(),  // Use your polygon geometry
  scale: 4,         // Sentinel-2 resolution
  geometryType: 'polygon',
  labelProperty: 'bsi_mask',
  reducer: ee.Reducer.countEvery()
});

// Add vector layer to the map
//Map.addLayer(bsiVectors, {color: 'brown'}, 'BSI Mask Vector');

// Calculate area for each BSI polygon and add it as a property
var bsiWithArea = bsiVectors.map(function(feature) {
  var areaSqm = feature.geometry().area(1); // 1 meter error margin
  return feature.set({'area_sqm': areaSqm});
});

var bsiClipped = bsiPositive.clip(extent);

// Add BSI layer to the map
//Map.addLayer(bsiClipped, {color: 'brown'}, 'BSI Mask');

// Filter polygons with BSI area > 1000 sqm
var largebsiPolygons = bsiWithArea.filter(ee.Filter.gt('area_sqm', 1500));

// Display the filtered polygons
//Map.addLayer(largebsiPolygons, {color: 'blue'}, 'BSI > 1000 sqm');

// Calculate NDVI using NIR (B8) and Red (B4)
var ndvi = image2.normalizedDifference(['B8', 'B4']).rename('NDVI').clip(extent);

// Add NDVI layer to the map
//Map.addLayer(ndvi, {min: -1, max: 1, palette: ['brown', 'yellow', 'green']}, 'NDVI');


// Vectorize the poached land mask
var poachedVectors = poachedLandLayer.reduceToVectors({
  geometry: image.geometry(),
  scale: 4,
  geometryType: 'polygon',
  labelProperty: 'poached',
  reducer: ee.Reducer.countEvery()
});

// Vectorize the bare cropland mask
var barecropVectors = bareCroplandLayer.reduceToVectors({
  geometry: image.geometry(),
  scale: 4,
  geometryType: 'polygon',
  labelProperty: 'barecropland',
  reducer: ee.Reducer.countEvery()
});

// Calculate poachedland area in square meters with error margin
var poachedWithArea = poachedVectors.map(function(feature) {
  var area = feature.geometry().area(1); // 1 meter error margin
  return feature.set('area_m2', area);
});

// Calculate barecropland area in square meters with error margin
var barecropWithArea = barecropVectors.map(function(feature) {
  var area = feature.geometry().area(1); // 1 meter error margin
  return feature.set('area_m2', area);
});

// Filter small poachedland polygons with area < 2000 m²
var smallPoached = poachedWithArea.filter(ee.Filter.lt('area_m2', 2000));

// Filter small barecropland polygons with area < 2000 m²
var smallBarecrop = barecropWithArea.filter(ee.Filter.lt('area_m2', 2000));

// Merge small poached and small barecropland as poachedland
var smallPoached2 = smallPoached.merge(smallBarecrop);

//Map.addLayer(smallPoached2, {color: 'orange'}, 'Poached land < 2000 m²');
//Map.addLayer(smallBarecrop, {color: 'orange'}, 'Bare land < 2000 m²');

// Filter polygons with area > 2000 m²
//var largePoached = poachedWithArea.filter(ee.Filter.gt('area_m2', 2000));
//var largeBarecrop = barecropWithArea.filter(ee.Filter.gt('area_m2', 1000));

//Map.addLayer(largePoached, {color: 'red'}, 'Poached > 2000 m²');
//Map.addLayer(largeBarecrop, {color: 'yellow'}, 'Barecrop > 2000 m²');

// Rasterize smallPoached2 (poache land <2000 sqm) polygons
var smallPoachedRaster = ee.Image().byte().paint({
  featureCollection: smallPoached2,
  color: 1
}).selfMask();

// Count connected pixels (8-connected neighborhood)
var connected = smallPoachedRaster.connectedPixelCount(100, true);

// Keep only isolated pixels (e.g., connected count =>2 and <=200 )
var isolatedPixels = connected.gt(2).and(connected.lt(200)).selfMask();

// Vectorize the isolated pixels
var isolatedPoachedVectors = isolatedPixels.reduceToVectors({
  geometry: image.geometry(),
  scale: 5,
  geometryType: 'polygon',
  labelProperty: 'isolated',
  reducer: ee.Reducer.countEvery()
});

// Union all road geometries into a single geometry
var mergedRoads = roadVector.union().geometry();

// Subtract the merged road geometry from poached lands
var cleanVectors = isolatedPoachedVectors.map(function(feature) {
  var cleanedGeom = feature.geometry().difference(mergedRoads, 1); // 1 meter max error
  return ee.Feature(cleanedGeom).copyProperties(feature);
});

// Reduce false positives using BSI output
var cleanVectors2 = cleanVectors.map(function(feature) {
  var intersects = largebsiPolygons.geometry().intersects(feature.geometry(), ee.ErrorMargin(1));
  return feature.set('containBSI', intersects);
}).filter(ee.Filter.eq('containBSI', false));

// Mask NDVI values outside the range 0.4 to 0.6
var ndviMasked = ndvi.updateMask(ndvi.gt(0.4).and(ndvi.lt(0.6)));

// Display the result
//Map.addLayer(ndviMasked, {min: 0.4, max: 1, palette: ['white', 'green']}, 'NDVI between 0.4-0.6');

// Convert NDVI mask (0.4 < NDVI < 0.6) to integer for vectorization
var ndviMaskInt = ndvi.gt(0.4).and(ndvi.lt(0.6)).selfMask().toInt();

// Vectorize the masked NDVI image
var ndviVectors = ndviMaskInt.reduceToVectors({
  geometry: extent.geometry(),
  scale: 5,
  geometryType: 'polygon',
  eightConnected: false,
  labelProperty: 'zone',
  reducer: ee.Reducer.countEvery()
});

// Display the vector polygons
//Map.addLayer(ndviVectors, {color: 'blue'}, 'NDVI 0.4–0.6 Polygons');

// Calculate area for each polygon and add it as a property
var ndviWithArea = ndviVectors.map(function(feature) {
  var areaSqm = feature.geometry().area(1); // 1 meter error margin
  return feature.set({'area_sqm': areaSqm});
});

// Filter polygons with area > 1500 sqm
var largeNdviPolygons = ndviWithArea.filter(ee.Filter.gt('area_sqm', 1500));

// Display the filtered polygons
//Map.addLayer(largeNdviPolygons, {color: 'blue'}, 'NDVI 0.4–0.6 Area > 1500 sqm');

// Reduce false positives using NDVI output
var cleanVectors3 = cleanVectors2.map(function(feature) {
  var intersects = largeNdviPolygons.geometry().intersects(feature.geometry(), ee.ErrorMargin(1));
  return feature.set('containNDVI', intersects);
}).filter(ee.Filter.eq('containNDVI', false));

// Add best outputs to map
//Map.addLayer(cleanVectors, {color: 'red'}, 'Filtered-1 Poached Fields');
//Map.addLayer(cleanVectors2, {color:'red'}, 'Filtered-2 Poached Fields ');
Map.addLayer(cleanVectors3, {color:'red'}, 'Potential poached lands ');

// Filter out features with empty geometries using area check
var cleanVectors3_nonEmpty = cleanVectors3.filter(ee.Filter.gt('area', 0));
 
var cleanVectors3_withArea = cleanVectors3.map(function(feature) {
  var area = feature.geometry().area(1); // 1 meter error margin
  return feature.set('area', area);
});
 
var cleanVectors3_nonEmpty = cleanVectors3_withArea.filter(ee.Filter.gt('area', 0));
 
// Export the filtered collection as a shapefile
Export.table.toDrive({
  collection: cleanVectors3_nonEmpty,
  description: 'Filtered3_Poached_Fields_Export',
  fileFormat: 'SHP',
  folder: 'GEE_Exports',
  fileNamePrefix: 'potential_poached_areas'

});

