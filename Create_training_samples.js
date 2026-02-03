// Center the map on the image
Map.centerObject(image, 10);
Map.addLayer(image, {}, 'Input Image');

// Define bands and label
// var label = 'Class';
// var bands = ['b1', 'b2', 'b3', 'b4'];  // Update with your image's band names
// var input = image.select(bands);

// Assign landcover labels to each feature collection
var poached_land = poachedland.map(function(feature) {
  return feature.set('landcover', 0);
});
var barecropland = barecropland.map(function(feature) {
  return feature.set('landcover', 1);
});
var cropland = cropland.map(function(feature) {
  return feature.set('landcover', 2);
});
var trees = trees.map(function(feature) {
  return feature.set('landcover', 3);
});
var waterbodies = waterbodies.map(function(feature) {
  return feature.set('landcover', 4);
});
var builtup = builtup.map(function(feature) {
  return feature.set('landcover', 5);
});

// Merge all labeled feature collections into one FeatureCollection
var trainingData = poached_land
    .merge(barecropland)
    .merge(cropland)
    .merge(trees)
    .merge(waterbodies)
    .merge(builtup);

// Sample the input imagery to get a FeatureCollection of training data
var sampleData = image.sampleRegions({
    collection: trainingData,
    properties: ['landcover'],
    scale: 5 // Adjust based on your image resolution
});

// Export the sampled training data to a CSV file in Google Drive
Export.table.toDrive({
    collection: sampleData,
    description: 'LandCover_Training_Data',
    fileFormat: 'CSV'
});

// Optional: Print a few samples to verify
print(sampleData.limit(10));
