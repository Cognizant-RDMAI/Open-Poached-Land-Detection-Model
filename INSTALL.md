
# Installation Guide

This section provides details of step by step instructions to run the [Open-Poached-Land-Detection-Model](https://github.com/Cognizant-RDMAI/Open-Poached-Land-Detection-Model). Since the RDMAI team is not responsible for deploying this solution on customer premises, the setup focuses only on local or research-based use.

---

### 1. Prerequisites

- This [Open-Poached-Land-Detection-Model](https://github.com/Cognizant-RDMAI/Open-Poached-Land-Detection-Model) is built entirely in JavaScript on the cloud-based Google Earth Engine (GEE) platform. No local installation is needed, but users must have a valid GEE account and license to run the code.
- It’s optimized for catchment-level analysis, improving pixel-level processing speed. GEE enforces pixel limits—standard users can process ~1 billion pixels per task with up to 2 concurrent tasks, while commercial users may have higher quotas based on their subscription.
- GEE’s print() function only displays the first 5000 records of a FeatureCollection in the Console. To work with full datasets, users should use Export.table.toDrive() to export data (e.g., shapefiles) for external GIS analysis.

### 2. Required GEE assets
- Sentinel-2 Upscaled Image (1m resolution) Asset ID: projects/rdmai-dev-ml/assets/S2L2Ax10_T30UVC-cfc2b9fbd-20211001_MS serves as the main input image for land classification and analysis.
- Training Data for Landcover Classification Asset ID: projects/rdmai-dev-ml/assets/6_Training_Classes contains labeled samples (e.g., poached land, cropland, trees) used for supervised classification.
- Road Vector Data Asset ID: projects/ee-rdmai/assets/road1_4buffer helps eliminate false positives near roads during poached land detection.
- Dynamic World Landcover Dataset Dataset ID: GOOGLE/DYNAMICWORLD/V1 used to mask built-up areas (class 6) to improve classification accuracy.
- Sentinel-2 Surface Reflectance Collection Dataset ID: COPERNICUS/S2_SR utilized for computing vegetation and soil indices (NDVI, BSI) and generating true color composites.

  Here's a detailed guide on how to create each of the required Google Earth Engine (GEE) assets for your land classification and analysis workflow. These steps assume you have access to GEE and some familiarity with its Code Editor and asset management.

---

### 3. Sentinel-2 Upscaled Image (1m resolution)  
**Asset ID**: `projects/rdmai-dev-ml/assets/S2L2Ax10_T30UVC-cfc2b9fbd-20211001_MS`

#### **Steps to Create:**
1. **Select Sentinel-2 Image**:
   - Use the `COPERNICUS/S2_SR` dataset.
   - Filter by date and tile ID (e.g., `T30UVC`) and cloud cover.

2. **Upscale to 1m Resolution**:
   - Sentinel-2 satellite imagery comes with a native resolution of **10 meters**. To enhance the spatial detail, we apply the **S2DR3 technique**, which leverages deep learning-based super-resolution models to upscale imagery to **1 meter resolution**. You can explore the full implementation in this Google Colab notebook:  
🔗 [Gamma Earth S2DR3 - Sentinel-2 Deep Resolution 3.0](https://colab.research.google.com/drive/18phbwA1iYG5VDGN2WjK7WrWYi-FdCHJ5)

   - Example:
     ```javascript
     var image = ee.ImageCollection('COPERNICUS/S2_SR')
       .filterDate('2021-10-01', '2021-10-02')
       .filterBounds(geometry)
       .sort('CLOUD_COVER')
       .first();

     var upscaled = image.resample('bicubic').reproject({
       crs: 'EPSG:32630',
       scale: 1
     });
     ```

3. **Export to Asset**:
   - Use `Export.image.toAsset()` with appropriate scale and region.

---

### 4. Training Data for Landcover Classification 
**Asset ID**: `projects/rdmai-dev-ml/assets/6_Training_Classes`

#### **Steps to Create:**
1. **Create Labeled Points or Polygons**:
   - Use the GEE drawing tools or import shapefiles/GeoJSON with labeled land cover classes (e.g., cropland, poached land, trees).

2. **Assign Class Labels**:
   - Add a property like `landcover` to each feature.

3. **Merge and Export**:
   - Combine all labeled features into a single `FeatureCollection`.
   - Export using `Export.table.toAsset()`.

---

### 5. Road Vector Data  
**Asset ID**: `projects/ee-rdmai/assets/road1_4buffer`

#### **Steps to Create:**
1. **Import Road Data**:
   - Use OpenStreetMap via GEE (`users/gena/roads-global`) or upload your own shapefile.

2. **Buffer Roads**:
   - Apply a buffer (e.g., 4 meters) to eliminate false positives near roads.
     ```javascript
     var bufferedRoads = roads.map(function(f) {
       return f.buffer(4);
     });
     ```

3. **Export to Asset**:
   - Use `Export.table.toAsset()` to save the buffered road layer.

---

### 6. Dynamic World Landcover Dataset 
**Dataset ID**: `GOOGLE/DYNAMICWORLD/V1`

#### **Usage**:
- No need to create this asset; it's a public dataset.
- Use it to mask built-up areas (class 6):
  ```javascript
  var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterDate('2021-10-01', '2021-10-02')
    .filterBounds(geometry)
    .first();

  var builtUpMask = dw.select('label').eq(6);
  ```

---

### 7. Sentinel-2 Surface Reflectance Collection  
**Dataset ID**: `COPERNICUS/S2_SR`

#### **Usage**:
- Use this dataset to compute vegetation indices like NDVI and BSI:
  ```javascript
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var bsi = image.expression(
    '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
    {
      'SWIR1': image.select('B11'),
      'RED': image.select('B4'),
      'NIR': image.select('B8'),
      'BLUE': image.select('B2')
    }).rename('BSI');
  ```

- For true color composites:
  ```javascript
  var trueColor = image.select(['B4', 'B3', 'B2']);
  ```

### 8. Steps To Follow
Below are the core steps to run the model interactively:

### Step-1: Detecting Potential Poached Lands Using Remote Sensing Techniques
- Sign in to GEE code editor and create new script save into GEE repo
- Copy Poached-Land-Detection-Model.js code from main branch and paste into newly created repo in GEE code description

### Step-2: Load Upscaled Sentinel-2 Image and Training Data
```
// Loads a high-resolution Sentinel-2 image and a labeled training dataset for classification.
var image = ee.Image("projects/rdmai-dev-ml/assets/S2L2Ax10_T30UVC-cfc2b9fbd-20211001_MS**");
var trainingData = ee.FeatureCollection("projects/rdmai-dev-ml/assets/6_Training_Classes**");
```
________________________________________
### Step-3: Center Map and Define Extent
```
// Centers the map and defines the spatial extent for clipping and analysis.
Map.centerObject(image, 14);
var extent = ee.Feature(image.geometry());
```
________________________________________
### Step-4: Load and Preprocess Sentinel-2 Image
```
//Filters Sentinel-2 imagery by date and cloud cover, selects relevant bands, and computes a median composite.
var image2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2021-09-30', '2021-10-02')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median()
  .select(['B2', 'B3', 'B4', 'B8', 'B11']);
```
______________________________________
### Step-5: Create True Color Composite
```
//Creates a visual RGB image using Red, Green, and Blue bands.
var trueColor = image2.select(['B4', 'B3', 'B2']).clip(extent);
```
________________________________________
### Step-6: Add Layers to Map
```
//Adds the high-resolution image to the map.
Map.addLayer(image, {}, 'Sentinel-2 upscaled image (1m)');
```
________________________________________
### Step-7: Load Road Vector Data
```
//Loads road geometries to later exclude them from analysis.
var roadVector = ee.FeatureCollection("projects/ee-rdmai/assets/road1_4buffer");
```
________________________________________
### Step-8: Mask Built-Up Areas Using Dynamic World
```
//Removes built-up areas from the analysis using land cover classification.
var dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .filterBounds(image.geometry())
  .filterDate('2021-01-01', '2021-12-31')
  .median();
var builtUpMask = dw.select('label').neq(6);
image = image.updateMask(builtUpMask);
```
________________________________________
### Step-9: Split Training Data
```
//Splits the labeled data into training and testing sets.
var trainingSet = trainingData.filter(ee.Filter.lte('random', 0.7));
var testingSet = trainingData.filter(ee.Filter.gt('random', 0.7));
```
________________________________________
### Step-10: Train Random Forest Classifier
```
//Trains a Random Forest model using the training data.
var classifier = ee.Classifier.smileRandomForest(10).train({
  features: trainingSet,
  classProperty: 'landcover',
  inputProperties: image.bandNames()
});
```
________________________________________
### Step-11: Classify the Image
```
//Applies the trained model to classify the image.
var classifiedImage = image.classify(classifier);
```
________________________________________
### Step-12: Extract Specific Classes
```
//	Isolates poached land and bare cropland classes.
var poachedLandMask = classifiedImage.eq(0);
var poachedLandLayer = classifiedImage.updateMask(poachedLandMask);

var bareCroplandMask = classifiedImage.eq(1);
var bareCroplandLayer = classifiedImage.updateMask(bareCroplandMask);
```
________________________________________
### Step-13: Calculate Bare Soil Index (BSI)
```
//Computes BSI to identify bare soil regions.
var bsi = image2.expression(
  '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))', {
    'SWIR': image2.select('B11'),
    'RED': image2.select('B4'),
    'NIR': image2.select('B8'),
    'BLUE': image2.select('B2')
}).rename('BSI').clip(extent);
```
________________________________________
### Step-14: Vectorize BSI and Filter by Area
```
//Converts BSI raster to vector polygons and filters large areas.
var bsiVectors = bsiInt.reduceToVectors({ ... });
var bsiWithArea = bsiVectors.map(function(feature) {
  var areaSqm = feature.geometry().area(1);
  return feature.set({'area_sqm': areaSqm});
});
var largebsiPolygons = bsiWithArea.filter(ee.Filter.gt('area_sqm', 1500));
```
________________________________________
### Step-15: Calculate NDVI and Vectorize
```
//Computes NDVI and extracts regions with moderate vegetation.
var ndvi = image2.normalizedDifference(['B8', 'B4']).rename('NDVI').clip(extent);
var ndviMasked = ndvi.updateMask(ndvi.gt(0.4).and(ndvi.lt(0.6)));
var ndviVectors = ndviMaskInt.reduceToVectors({ ... });
// Filter polygons with area > 1500 sqm
var largeNdviPolygons = ndviWithArea.filter(ee.Filter.gt('area_sqm', 1500));
```
________________________________________
### Step-16: Vectorize Poached and Bare Cropland
var poachedVectors = poachedLandLayer.reduceToVectors({ ... });
var barecropVectors = bareCroplandLayer.reduceToVectors({ ... });
•	Converts classified raster masks to vector format.
________________________________________
### Step-17 Filter Small Polygons and Merge
```
//Focuses on small patches of poached and bare cropland.
var smallPoached = poachedWithArea.filter(ee.Filter.lt('area_m2', 2000));
var smallBarecrop = barecropWithArea.filter(ee.Filter.lt('area_m2', 2000));
var smallPoached2 = smallPoached.merge(smallBarecrop);
```
________________________________________
### Step-5 Rasterize and Isolate Pixels
```
//Identifies isolated pixel clusters for further analysis.
var smallPoachedRaster = ee.Image().byte().paint({ ... }).selfMask();
var connected = smallPoachedRaster.connectedPixelCount(100, true);
var isolatedPixels = connected.gt(2).and(connected.lt(200)).selfMask();
```
________________________________________
### Step-5 Remove Roads and False Positives
```
//Removes road overlaps and filters using BSI and NDVI.
var cleanVectors = isolatedPoachedVectors.map(function(feature) {
  var cleanedGeom = feature.geometry().difference(mergedRoads, 1);
  return ee.Feature(cleanedGeom).copyProperties(feature);
});
```
________________________________________
### Step-5 Final Filtering and Export
```
//Exports the final filtered polygons as a shapefile.
var cleanVectors3_nonEmpty = cleanVectors3_withArea.filter(ee.Filter.gt('area', 0));
Export.table.toDrive({
  collection: cleanVectors3_nonEmpty,
  description: 'Filtered3_Poached_Fields_Export',
  fileFormat: 'SHP',
  folder: 'GEE_Exports',
  fileNamePrefix: 'potential_poached_areas'
});
```
## Notes

* This guide assumes usage in a Google Earth Engine (GEE) environment.
* Please refer `README.md` for detailed description of the model.
