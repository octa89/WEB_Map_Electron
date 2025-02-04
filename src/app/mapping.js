let retrievedAttributes = [];
let accessFields = [];

const loadConfig = async () => {
  try {
    const response = await fetch('../config.json');
    if (!response.ok) {
      throw new Error(`Error fetching config: ${response.statusText}`);
    }
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
};

const fetchPortalItemDetails = async (mapId, apiKey) => {
  const url = `https://www.arcgis.com/sharing/rest/content/items/${mapId}/data?f=json&token=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching portal item details: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Portal Item Details:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchPortalItemDetails:', error);
    return null;
  }
};

const fetchAllLayerAttributes = async (layerUrl, apiKey) => {
  let allFeatures = [];
  let resultOffset = 0;
  const resultRecordCount = 2000;

  while (true) {
    const queryUrl = `${layerUrl}/query?where=1=1&outFields=*&f=json&resultOffset=${resultOffset}&resultRecordCount=${resultRecordCount}&token=${apiKey}`;
    try {
      const response = await fetch(queryUrl);
      if (!response.ok) {
        throw new Error(`Error fetching layer attributes: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.features && Array.isArray(data.features)) {
        allFeatures = allFeatures.concat(data.features);
      } else {
        throw new Error('Unexpected response structure');
      }

      if (!data.exceededTransferLimit) {
        break;
      }
      resultOffset += resultRecordCount;
    } catch (error) {
      console.error('Error in fetchAllLayerAttributes:', error);
      return null;
    }
  }

  return allFeatures.map(feature => feature.attributes);
};

const fetchAccessFields = async () => {
  try {
    const response = await fetch('http://localhost:3000/fields');
    if (!response.ok) {
      throw new Error(`Error fetching fields: ${response.statusText}`);
    }
    const fields = await response.json();
    return fields;
  } catch (error) {
    console.error('Error fetching fields:', error);
    return [];
  }
};

const displayPortalItemDetails = (details) => {
  const portalDetailsDiv = document.getElementById('portalDetails');
  const operationalLayers = details.operationalLayers || [];
  
  let htmlContent = '<h2>Operational Layers</h2><ul>';
  const layerSelect = document.getElementById('layerTitle');

  operationalLayers.forEach(layer => {
    htmlContent += `<li>${layer.title}</li>`;

    // Populate the dropdown with layer titles
    const option = document.createElement('option');
    option.value = layer.title;
    option.textContent = layer.title;
    layerSelect.appendChild(option);
  });
  htmlContent += '</ul>';

  portalDetailsDiv.innerHTML = htmlContent;
};

const displayAttributes = (attributes) => {
  const attributesOutputDiv = document.getElementById('attributesOutput');
  retrievedAttributes = attributes;
  const firstAttribute = attributes.length > 0 ? JSON.stringify(attributes[0], null, 2) : 'No attributes found';
  attributesOutputDiv.innerHTML = `<p>Attribute table retrieved</p><pre>${firstAttribute}</pre>`;
  displayFieldPairing();
};

const displayFieldPairing = async () => {
  const fieldsDiv = document.getElementById('fieldPairing');
  fieldsDiv.innerHTML = '';

  accessFields = await fetchAccessFields();
  if (!accessFields.length) {
    fieldsDiv.innerHTML = 'No fields found in the Access database.';
    return;
  }

  accessFields.forEach(field => {
    const fieldContainer = document.createElement('div');
    fieldContainer.classList.add('field-pair');

    const label = document.createElement('label');
    label.textContent = field.COLUMN_NAME;

    const select = document.createElement('select');
    select.setAttribute('data-field', field.COLUMN_NAME);

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select attribute';
    select.appendChild(defaultOption);

    // Populate dropdown with attributes from the layer
    if (retrievedAttributes.length > 0) {
      Object.keys(retrievedAttributes[0]).forEach(attribute => {
        const option = document.createElement('option');
        option.value = attribute;
        option.textContent = attribute;
        select.appendChild(option);
      });
    }

    fieldContainer.appendChild(label);
    fieldContainer.appendChild(select);
    fieldsDiv.appendChild(fieldContainer);
  });
};

const appendDataToAccess = async (data) => {
  try {
    const response = await fetch('http://localhost:3000/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data })
    });
    if (!response.ok) {
      throw new Error(`Error appending data: ${response.statusText}`);
    }
    const result = await response.text();
    console.log(result);
    alert('Data appended successfully!');
  } catch (error) {
    console.error('Error appending data:', error);
    alert('Error appending data. Please ensure the server is running and accessible.', error);
  }
};

const main = async () => {
  const config = await loadConfig();
  if (!config) {
    console.log('Failed to load configuration.');
    return;
  }

  const { apiKey, mapId } = config;

  const itemDetails = await fetchPortalItemDetails(mapId, apiKey);
  if (!itemDetails) {
    console.log('Failed to fetch portal item details.');
    return;
  }

  displayPortalItemDetails(itemDetails);

  document.getElementById('loadLayer').addEventListener('click', async () => {
    const selectedLayerTitle = document.getElementById('layerTitle').value;
    if (!selectedLayerTitle) {
      alert('Please select a layer.');
      return;
    }

    const operationalLayers = itemDetails.operationalLayers || [];
    const selectedLayer = operationalLayers.find(layer => layer.title === selectedLayerTitle);

    if (!selectedLayer) {
      console.log('Invalid layer title.');
      return;
    }

    const layerUrl = selectedLayer.url;
    const layerAttributes = await fetchAllLayerAttributes(layerUrl, apiKey);
    if (!layerAttributes) {
      console.log('Failed to fetch layer attributes.');
      alert('Error fetching layer attributes. Please ensure the map is displaying.');
      return;
    }

    displayAttributes(layerAttributes);
  });

  document.getElementById('savePairs').addEventListener('click', () => {
    const pairs = [];
    document.querySelectorAll('#fieldPairing .field-pair').forEach(pair => {
      const field = pair.querySelector('select').getAttribute('data-field');
      const attribute = pair.querySelector('select').value;
      if (attribute) {
        pairs.push({ field, attribute });
      }
    });

    const dataToAppend = retrievedAttributes.map(attr => {
      const newObj = {};
      pairs.forEach(pair => {
        newObj[pair.field] = attr[pair.attribute];
      });
      return newObj;
    });

    appendDataToAccess(dataToAppend);
  });
};

main();
