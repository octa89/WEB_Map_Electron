require([
  "esri/config",
  "esri/WebMap",
  "esri/views/MapView",
  "esri/widgets/ScaleBar",
  "esri/widgets/Legend",
  "esri/widgets/Search",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/widgets/Locate",
  "esri/widgets/LayerList",
], function (
  esriConfig,
  WebMap,
  MapView,
  ScaleBar,
  Legend,
  Search,
  BasemapGallery,
  Expand,
  Locate,
  LayerList
) {
  // Debug each module to see if they are correctly loaded
  console.log("Modules loaded:");
  console.log("esriConfig:", esriConfig);
  console.log("WebMap:", WebMap);
  console.log("MapView:", MapView);
  console.log("ScaleBar:", ScaleBar);
  console.log("Legend:", Legend);
  console.log("Search:", Search);
  console.log("BasemapGallery:", BasemapGallery);
  console.log("Expand:", Expand);
  console.log("Locate:", Locate);
  console.log("LayerList:", LayerList);

  // If any module is undefined, it means there is an issue with loading
  if (
    !esriConfig ||
    !WebMap ||
    !MapView ||
    !ScaleBar ||
    !Legend ||
    !Search ||
    !BasemapGallery ||
    !Expand ||
    !Locate ||
    !LayerList
  ) {
    console.error(
      "One or more modules failed to load properly. Please check your require paths and internet connection."
    );
    throw new Error(
      "One or more modules failed to load properly. Please check your require paths and internet connection."
    );
  }

  let progressBar;
  let config = {};
  let webmap;
  let view;

  function initProgressBar() {
    const progressBarContainer = document.getElementById(
      "progress-bar-container"
    );
    const progressText = document.getElementById("progress-text");
    progressBarContainer.style.display = "block"; // Show the progress bar

    progressBar = new ProgressBar.Circle(progressBarContainer, {
      strokeWidth: 6,
      easing: "easeInOut",
      duration: 1400,
      color: "rgba(0, 121, 193, 1)", // Custom color
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "100%", height: "100%" },
      from: { color: "rgba(44, 62, 80)", width: 2 },
      to: { color: "rgba(0, 0, 0)", width: 6 },
      step: (state, circle) => {
        circle.path.setAttribute("stroke", state.color);
        circle.path.setAttribute("stroke-width", state.width);

        // Display the percentage
        const value = Math.round(circle.value() * 100);
        progressText.textContent = `${value}%`;
      },
    });
  }

  let mapInitializedPromise = initializeMap();

  async function initializeMap() {
    initProgressBar(); // Initialize the progress bar
    /* let config = {}; */

    // Show the progress bar at the start
    progressBar.set(0); // Start at 0%

    // Allow all CORS-enabled servers (use with caution in development)
    esriConfig.request.corsEnabledServers = [];

    // Add any specific trusted servers if required, or leave this empty for unrestricted access
    esriConfig.request.trustedServers = [];

    try {
      // Fetch configuration file
      console.log("Loading configuration file...");
      const response = await fetch("../config.json");
      if (!response.ok) {
        console.error(
          "Configuration file not found. Please check the path and try again."
        );
        throw new Error("Config file not loaded");
      }
      config = await response.json();
      console.log("Config file loaded:", config);

      // Set API Key
      if (!config.apiKey) {
        console.error(
          "API Key is missing or incorrect. Please check the config file."
        );
        throw new Error("API Key is not valid");
      }
      esriConfig.apiKey = config.apiKey;
      console.log("API Key Loaded");

      // Update the progress bar as the config loads
      progressBar.animate(0.3); // 30%

      // Load the Web Map
      console.log("Loading the web map...");
      webmap = new WebMap({
        portalItem: {
          id: config.mapId,
        },
      });

      try {
        await webmap.load();
        webmap.allLayers.forEach((layer) => {
          if (layer.type === "feature") {
            layer.outFields = ["*"];
          }
        });
        console.log("Web Map Loaded");
      } catch (webMapError) {
        console.error(
          "Error: Web Map failed to load. Please check the Map ID in the config file."
        );
        throw webMapError;
      }

      // Collect layers
      const availableLayers = webmap.allLayers.items.filter(
        (layer) => layer.type === "feature"
      );
      console.log("Available Layers:", availableLayers);

      // Pass layers to Electron main process

      window.electronAPI.send(
        "update-menu-layers",
        availableLayers.map((layer) => ({ title: layer.title }))
      );

      // Update the progress bar when layers are loaded
      progressBar.animate(0.6); // 60%

      // Initialize the MapView
      console.log("Initializing the map view...");
      view = new MapView({
        container: "viewDiv",
        map: webmap,
      });

      // Add the click event listener to the view
      document.addEventListener("click", function (event) {
        var point = {
          x: event.clientX,
          y: event.clientY,
        };
        var screenPoint = {
          x: point.x,
          y: point.y,
        };

        // Perform the hitTest using the ArcGIS API
        view
          .hitTest(screenPoint)
          .then(function (response) {
            if (response.results.length && response.results[0].graphic) {
              console.log(
                "Available attributes in the clicked graphic:",
                response.results[0].graphic.attributes
              );
            } else {
              console.log("No graphic found at the click location.");
            }
          })
          .catch(function (error) {
            console.error("Error performing hitTest:", error);
          });
      });

      view.on("click", function (event) {
        view
          .hitTest(event)
          .then(function (response) {
            if (response.results.length > 0) {
              const result = response.results.find(
                (result) =>
                  result.graphic &&
                  result.graphic.layer &&
                  result.graphic.layer.type === "feature"
              );
              if (result && result.graphic) {
                const graphic = result.graphic;
                const idField = config.idField; // Ensure this is the correct field name in your feature attributes
                if (graphic.attributes && idField in graphic.attributes) {
                  const featureId = graphic.attributes[idField];
                  localStorage.setItem(
                    "selectedFeatureId",
                    featureId.toString()
                  );
                  console.log("Feature ID stored:", featureId);
                } else {
                  console.log(
                    "No valid ID field found in the graphic attributes. Check the ID field:",
                    idField
                  );
                }
              } else {
                console.log(
                  "No feature or graphic found in the click results."
                );
              }
            } else {
              console.log("No results from hitTest.");
            }
          })
          .catch((error) => {
            console.error("Hit Test Error:", error);
          });
      });

      // View Widgets
      const scalebar = new ScaleBar({
        view: view,
        unit: "imperial",
      });
      view.ui.add(scalebar, "bottom-left");

      const legend = new Legend({
        view: view,
      });
      const legendExpand = new Expand({
        view: view,
        content: legend,
        expandIconClass: "esri-icon-layers",
        group: "bottom-left",
      });
      view.ui.add(legendExpand, "bottom-left");

      const searchwidget = new Search({
        view: view,
      });
      const searchwidgetExpand = new Expand({
        view: view,
        content: searchwidget,
        expandIconClass: "esri-icon-search",
        group: "top-right",
      });
      view.ui.add(searchwidgetExpand, "top-right");

      const basemapGallery = new BasemapGallery({
        view: view,
      });
      const basemapGalleryExpand = new Expand({
        view: view,
        content: basemapGallery,
        expandIconClass: "esri-icon-basemap",
        group: "top-left",
      });

      // Listen for selection-change event to close the Expand widget
      basemapGallery.watch("activeBasemap", function () {
        basemapGalleryExpand.collapse();
      });
      view.ui.add(basemapGalleryExpand, "top-right");

      const locate = new Locate({
        view: view,
      });
      view.ui.add(locate, "top-left");

      const layerList = new LayerList({
        view: view,
      });
      const layerListExpand = new Expand({
        view: view,
        content: layerList,
        expandIconClass: "esri-icon-hollow-eye",
        group: "top-right",
      });
      view.ui.add(layerListExpand, "top-right");

      // Complete the progress bar and reset
      progressBar.animate(1.0, () => {
        progressBar.set(0);
        document.getElementById("progress-bar-container").style.display =
          "none"; // Hide the progress bar after complete
      });

      console.log("Map initialization complete.");
    } catch (error) {
      console.error("Initialization Error:", error);
      // Reset the progress bar on error
      progressBar.set(0);
      document.getElementById("progress-bar-container").style.display = "none"; // Hide on error
    }
  }

  // IPC listener for 'show-inspections' message
  window.electronAPI.on("show-inspections", async () => {
    console.log("Received 'show-inspections' IPC message.");
    try {
      // Wait for the map to be initialized
      await mapInitializedPromise;

      // Fetch AssetIDs from API
      const response = await fetch("http://localhost:3000/map");
      const data = await response.json();

      if (!data || data.length === 0) {
        console.error("No AssetIDs found in the response.");
        return;
      }

      // Get field name from config
      const fieldName = config.fieldName || "AssetID"; // Or use config.fieldName if available
      console.log("Field Name from Config:", fieldName);

      // Construct the WHERE clause
      const assetIds = data.map((item) => `'${item.AssetID}'`).join(", ");
      const queryWhere = `${fieldName} IN (${assetIds})`;
      console.log("Constructed WHERE clause:", queryWhere);

      // Ensure webmap is loaded
      await webmap.load();

      // Access the selected layer
      const targetLayerTitle = config.selectedLayer;
      const targetLayer = webmap.allLayers.find(
        (layer) => layer.title === targetLayerTitle
      );

      if (targetLayer) {
        await targetLayer.load();

        // Set the highlight options on the view
        view.highlightOptions = {
          color: [0, 255, 255], // magenta color in RGBA
          haloOpacity: 0.9, // Opacity of the halo
          fillOpacity: 0.9, // Opacity of the fill
        };

        // Apply bloom effect and highlight
        view
          .whenLayerView(targetLayer)
          .then((layerView) => {
            // Create a query for the features you want to highlight
            const query = targetLayer.createQuery();
            query.where = queryWhere;

            // Query the features
            layerView
              .queryFeatures(query)
              .then((results) => {
                // Highlight the features with the specified color
                const highlightHandle = layerView.highlight(results.features);

                // Apply bloom effect using featureEffect
                layerView.featureEffect = {
                  filter: {
                    where: queryWhere,
                  },
                  includedEffect: "bloom(1.5, 0.6px, 0)",
                };

                console.log("Features highlighted with bloom effect.");
              })
              .catch((error) => {
                console.error("Error querying features:", error);
              });
          })
          .catch((error) => {
            console.error("Error accessing layer view:", error);
          });
      } else {
        console.error("Selected layer not found in the WebMap.");
      }
    } catch (error) {
      console.error("Error applying bloom effect and highlight:", error);
    }
  });
});
