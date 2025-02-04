const { app, BrowserWindow, Menu, ipcMain, session } = require("electron");
const express = require("express");
const odbc = require("odbc");
const cors = require("cors");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Disable SSL certificate verification globally
app.commandLine.appendSwitch("ignore-certificate-errors", "true");
app.commandLine.appendSwitch("allow-insecure-localhost", "true");

// Create Express server
const server = express();
server.use(cors());
server.use(bodyParser.json({ limit: "150mb" })); // Increase payload limit to 70MB
server.use(bodyParser.urlencoded({ extended: true, limit: "150mb" })); // Increase payload limit to 70MB

const port = 3000;

// Update config.json
function getConfigPath() {
  // Path when running unpackaged
  const devPath = path.join(__dirname, "../config.json"); // Adjust according to actual dev path
  // Path when running packaged
  const packagedPath = path.join(
    process.resourcesPath,
    "app",
    "src",
    "config.json"
  ); // Adjust depending on where you place it
  return app.isPackaged ? packagedPath : devPath;
}

let config = loadConfig();

function loadConfig() {
  const configPath = getConfigPath();
  console.log(`Attempting to load config from: ${configPath}`);
  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const parsedConfig = JSON.parse(configFile);
    return parsedConfig;
  } catch (error) {
    console.error("Failed to load config.json:", error);
    return null;
  }
}

// Set up connection strings based on config.json connection type
let connectionString;
let GISConn;
let layers = []; // Initialize layers as an empty array
let mainWindow; // Define mainWindow at the top level

// Access GIS Connection - This will always be Access-based
const posmExecutablePath = config.posmExecutablePath;
const dbPath = posmExecutablePath.replace(".exe", ".mdb");
const GISpath = dbPath.replace("POSM.mdb", "POSMGISData.mdb");
GISConn = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${GISpath};`;

// Function to log errors
function logError(message, error = "") {
  console.error(`Error: ${message}`, error);
}

// Function to attempt connection using the provided connection string
async function establishConnection(connectionString) {
  try {
    const connection = await odbc.connect(connectionString);
    console.log("Connection established successfully.");
    return connection;
  } catch (error) {
    console.error("Error establishing connection:", error);
    throw error;
  }
}

async function attemptConnection(connectionString) {
  try {
    const connection = await establishConnection(connectionString);
    if (connection) {
      await connection.close(); // Close the connection when done
      return true;
    }
    return false;
  } catch (error) {
    logError("Connection attempt failed.", error);
    return false;
  }
}

// Main function to set up the SQL or Access connection
async function setupSQLConnection() {
  try {
    // Check if config is valid
    if (!config) {
      logError("Failed to load config.json");
      app.quit();
      return;
    }

    // Determine connection type and set appropriate connection string
    if (config.connectionType === "SQL Connection") {
      console.log("Setting up SQL Server connection...");

      const server = config.SQLInstance || "localhost";
      const database = config.databaseName || "POSM";
      const user = config.SQLUser || "";
      const password = config.SQLPass || "";

      if (!user && !password) {
        console.log(
          "No SQL credentials provided, attempting with Integrated Security..."
        );
        // Use Trusted Connection
        connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;`;
      } else {
        // Use SQL Authentication
        connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Uid=${user};Pwd=${password};`;
      }

      // Attempt to connect
      const connectionSuccessful = await attemptConnection(connectionString);
      if (!connectionSuccessful) {
        logError("SQL Server connection attempt failed.");
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
          win.webContents.send(
            "sql-connection-failed",
            "Connection to the SQL Server failed."
          );
        }
      }
    } else if (config.connectionType === "Access Connection") {
      console.log("Connection type is Access, setting up Access connection...");

      // Set up Access connection string
      const posmExecutablePath = config.posmExecutablePath;
      const dbPath = posmExecutablePath.replace(".exe", ".mdb");
      connectionString = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${dbPath};`;

      // Attempt to connect
      const connectionSuccessful = await attemptConnection(connectionString);
      if (!connectionSuccessful) {
        logError("Access database connection attempt failed.");
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
          win.webContents.send(
            "access-connection-failed",
            "Connection to the Access database failed."
          );
        }
      }
    } else {
      logError("Invalid connectionType specified in config.json");
      app.quit();
      return;
    }

    // Check if the connection string was set properly
    if (!connectionString) {
      logError("No valid connection string found in config.json");
      app.quit();
      return;
    }

    // Debugging output
    console.log(`Final Connection String: ${connectionString}`);
  } catch (error) {
    logError("An error occurred during setupSQLConnection", error);
    app.quit();
  }
}

// Call the async function to set up the SQL connection
setupSQLConnection();

// Debugging output for GISConn
console.log(`Final GIS Connection String (Access): ${GISConn}`);

/* Express API */

// API for Feet surveyed
server.get("/data", async (req, res) => {
  try {
    const connection = await odbc.connect(connectionString);
    const query = `
            SELECT 
            FORMAT([Date], 'yyyy-MM') AS MonthYear, 
            SUM(LengthSurveryed) AS LengthSurveyedSum, 
            TemplateName
            FROM 
            SpecialFields
            GROUP BY 
            FORMAT([Date], 'yyyy-MM'), 
            TemplateName
            ORDER BY 
            FORMAT([Date], 'yyyy-MM');
        `;
    const result = await connection.query(query);
    await connection.close();
    res.json(result);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).send(error.message);
  }
});

// API for Operator surveyed
server.get("/operator", async (req, res) => {
  try {
    const connection = await odbc.connect(connectionString);
    const query = `
            SELECT OperatorName, 
        SUM(LengthSurveryed) AS [Length Surveyed]
        FROM SpecialFields
        GROUP BY [OperatorName] 
        ORDER BY SUM(LengthSurveryed) ASC;
        `;
    const result = await connection.query(query);
    await connection.close();
    res.json(result);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).send(error.message);
  }
});

// API for Operator surveyed
server.get("/map", async (req, res) => {
  try {
    const connection = await odbc.connect(connectionString);
    const query = `
            SELECT AssetID, 
            Date, 
            TemplateName, 
            OperatorName,
            StartID, 
            EndID, 
            AssetLocation, 
            City, 
            LEFT(PacpQuickStructRatingNum, 1) AS structRating, 
            LEFT(PacpQuickMaintRatingNum, 1) AS maintRating
        FROM SpecialFields
        `;
    const result = await connection.query(query);
    await connection.close();
    res.json(result);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).send(error.message);
  }
});

// API for quick search
server.get("/fault", async (req, res) => {
  try {
    const connection = await odbc.connect(connectionString);
    const query = `
            SELECT 
                SpecialFields.SessionID,
                SpecialFields.StartID,
                SpecialFields.EndID,
                SpecialFields.AssetID, 
                SpecialFields.Date,
                SpecialFields.AssetLocation,
                SpecialFields.City,
                FaultCodes.FaultName, 
                Data.FaultCodeID, 
                Data.StructWeight, 
                Data.MaintWeight, 
                SpecialFields.TemplateName, 
                Data.Distance,
                Session.MediaFolder,
                Data.PictureLocation,
                Data.MpegLocation
            FROM ([Session] 
                INNER JOIN (FaultCodes 
                INNER JOIN Data ON FaultCodes.FaultCodeID = Data.FaultCodeID) 
                ON Session.SessionID = Data.SessionID) 
                INNER JOIN SpecialFields ON Session.SessionID = SpecialFields.SessionID
            ORDER BY Data.Distance ASC;
        `;
    const result = await connection.query(query);
    await connection.close();
    const dataWithId = result.map((row) => ({
      id: uuidv4(),
      ...row,
    }));
    res.json(dataWithId);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).send(error.message);
  }
});

// API for update POSMGISData
server.get("/fields", async (req, res) => {
  try {
    const connection = await odbc.connect(GISConn);
    const result = await connection.columns(null, null, "PosmGIS", null);
    await connection.close();
    res.json(result);
  } catch (error) {
    console.error("Error fetching fields:", error);
    res.status(500).send(error.message);
  }
});

// API to append data to POSMGISData
server.post("/append", async (req, res) => {
  const { data } = req.body;
  try {
    const connection = await odbc.connect(GISConn);
    await connection.query(`DELETE FROM [PosmGIS]`);
    for (const row of data) {
      const columns = Object.keys(row)
        .map((col) => `[${col}]`)
        .join(",");
      const values = Object.values(row)
        .map((val) => `'${val}'`)
        .join(",");
      const query = `INSERT INTO [PosmGIS] (${columns}) VALUES (${values})`;
      await connection.query(query);
    }
    await connection.close();
    res.send("Data appended successfully");
  } catch (error) {
    console.error("Error appending data:", error);
    res.status(500).send(error.message);
  }
});

// API for inspections by template
server.get("/insp", async (req, res) => {
  try {
    const connection = await odbc.connect(connectionString);
    const query = `
            SELECT TemplateName, COUNT(TemplateName)
            FROM SpecialFields
            GROUP BY TemplateName
        `;
    const result = await connection.query(query);
    await connection.close();
    res.json(result);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).send(error.message);
  }
});

if (require("electron-squirrel-startup")) app.quit();

/* -----------------------------------Main Window------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "POSM Online Map Reader",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  Menu.setApplicationMenu(Menu.buildFromTemplate(getMenuTemplate()));
}

/* -----------------------------------Menu Window------------------------- */
function getMenuTemplate() {
  return [
    {
      label: "POSM Options",
      submenu: [
        { label: "Edit Configuration", click: () => createConfigWindow() },
        { label: "Open Dashboards", click: () => createDashWindow() },
        { label: "Open POSM Quick Search", click: () => createInspWindow() },
        { label: "Open POSM GIS Update", click: () => createGISUpdate() },
        { type: "separator" },
        {
          label: "Template for Inspections",
          submenu: [
            {
              label: "NASSCO PACP",
              click: () => updateInspectionType("NASSCO PACP"),
            },
            {
              label: "NASSCO LACP",
              click: () => updateInspectionType("NASSCO LACP"),
            },
            {
              label: "NASSCO MACP Level 1",
              click: () => updateInspectionType("NASSCO MACP Level 1"),
            },
            {
              label: "NASSCO MACP Level 2",
              click: () => updateInspectionType("NASSCO MACP Level 2"),
            },
            { label: "POSM", click: () => updateInspectionType("POSM") },
            { label: "Custom", click: () => promptCustomTemplate() },
          ],
        },
        { role: "quit" },
      ],
    },
    {
      label: "Map Options",
      submenu: [
        { label: "Select the layer inspected", enabled: false },
        ...layers.map((layer) => ({
          label: layer.title,
          type: "radio",
          checked: config.selectedLayer === layer.title,
          click: () => {
            console.log(`Layer selected: ${layer.title}`);
            config.selectedLayer = layer.title;
            saveConfig(config);
            // Send the 'layer-selected' IPC message to the renderer
            mainWindow.webContents.send("layer-selected", layer.title);
          },
        })),
        {
          label: "Show Inspections on the map",
          click: () => {
            console.log("Show Inspections menu item clicked.");
            // Send the 'show-inspections' IPC message to the renderer
            mainWindow.webContents.send("show-inspections");
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools", accelerator: "Ctrl+Shift+I" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
  ];
}

// Handle layers sent from renderer process to update the menu
ipcMain.on("update-menu-layers", (event, layersData) => {
  console.log("Received layers from renderer:", layersData);
  layers = layersData; // Update the top-level layers variable

  // Rebuild the menu with the updated layers
  const menu = Menu.buildFromTemplate(getMenuTemplate());
  Menu.setApplicationMenu(menu);
});

/* ----------Update Inspection Type---------- */
function updateInspectionType(type) {
  config.inspectionType = type;
  saveConfig(config);
}

// Custom template mini window
function promptCustomTemplate() {
  let customWindow = new BrowserWindow({
    parent: BrowserWindow.getFocusedWindow(),
    modal: true,
    show: false,
    width: 750,
    height: 150,
    resizable: false,
    title: "Custom Inspection Template",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  customWindow.setMenuBarVisibility(false);
  customWindow.loadFile(path.join(__dirname, "customTemplate.html"));
  customWindow.once("ready-to-show", () => {
    customWindow.show();
  });
}

function createDashWindow() {
  const dashWin = new BrowserWindow({
    width: 1500,
    height: 800,
    title: "Dashboards",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  dashWin.setMenuBarVisibility(false);
  dashWin.loadFile(path.join(__dirname, "dash.html"));
}

// Search Page
function createInspWindow() {
  const inspWin = new BrowserWindow({
    width: 1400,
    height: 1200,
    title: "POSM Quick Search",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  inspWin.setMenuBarVisibility(false);
  inspWin.loadFile(path.join(__dirname, "searchInsp.html"));
}

// POSM GIS Update Page
function createGISUpdate() {
  const gisWin = new BrowserWindow({
    width: 700,
    height: 1200,
    title: "POSM GIS Update",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  gisWin.setMenuBarVisibility(false);
  gisWin.loadFile(path.join(__dirname, "mapping.html"));
}

function saveConfig(newConfig) {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    config = newConfig;
    console.log("Configuration updated:", newConfig);
  } catch (error) {
    console.error("Failed to write config.json:", error);
  }
}

ipcMain.on("update-custom-template", (event, customTemplate) => {
  console.log("Received custom template:", customTemplate);
  config.inspectionType = customTemplate;
  saveConfig(config);
});

function createConfigWindow() {
  let child = new BrowserWindow({
    parent: BrowserWindow.getFocusedWindow(),
    modal: true,
    show: false,
    width: 650,
    height: 850,
    resizable: false,
    title: "Edit Configuration",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  child.setMenuBarVisibility(false);
  child.loadFile(path.join(__dirname, "config.html"));
  child.once("ready-to-show", () => {
    child.show();
    // Send config data to renderer process
    child.webContents.send("config-data", config);
  });
}

console.log("Sending config to renderer:", config);

ipcMain.on("update-config", (event, newConfig) => {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(newConfig, null, 2));
    config = newConfig;
    console.log("Configuration updated:", newConfig);
  } catch (error) {
    console.error("Failed to write config.json:", error);
  }
});

// Handle test-sql-connection from renderer process
ipcMain.handle("test-sql-connection", async (event, sqlCredentials) => {
  let connectionString;

  if (!sqlCredentials.SQLUser && !sqlCredentials.SQLPass) {
    // Trusted Security (Windows Authentication)
    connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${sqlCredentials.SQLInstance};Database=${sqlCredentials.databaseName};Trusted_Connection=Yes;`;
  } else {
    // SQL Authentication
    connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${sqlCredentials.SQLInstance};Database=${sqlCredentials.databaseName};Uid=${sqlCredentials.SQLUser};Pwd=${sqlCredentials.SQLPass};`;
  }

  try {
    const connection = await odbc.connect(connectionString);
    await connection.close();
    return { success: true };
  } catch (error) {
    console.error("SQL Connection Error:", error);
    return { success: false, error: error.message };
  }
});

app.on("ready", () => {
  loadConfig();
  createWindow();
  // Disable SSL verification for all network requests
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0); // 0 means trust the certificate regardless of validity
  });

  // Try to listen on the specified port, if it's in use, increment port number
  const tryListen = (port) => {
    server
      .listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, trying port ${port + 1}`);
          tryListen(port + 1);
        } else {
          console.error("Server error:", err);
        }
      });
  };

  server.post("/launch", (req, res) => {
    if (!req.body.id) return res.status(400).json({ error: "No ID provided" });
    console.log("Config before command execution:", config); // Log the current state of config
    const command = `"${config.posmExecutablePath}" /S /T ${config.inspectionType} /AID ${req.body.id}`;
    console.log("Constructed command:", command); // Log the constructed command
    exec(command, (error, stdout, stderr) => {
      if (error)
        return res
          .status(500)
          .json({ error: "Failed to launch POSM", details: error.message });
      res.json({ message: "POSM launched successfully!", id: req.body.id });
    });
  });

  tryListen(port);
});

app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
