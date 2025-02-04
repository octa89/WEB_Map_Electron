# POSM Web Map Reader

## **Overview**
POSM Web Map Reader is an **Electron.js-based GIS application** that integrates **Esri ArcGIS API, Express.js, and a SQL/Access database** to manage, visualize, and analyze pipeline inspections. The application provides tools for searching, filtering, and displaying pipeline asset data in compliance with **U.S. standards**.

The system includes:
- **GIS Map Visualization** (Using Esri’s JavaScript API)
- **Asset Search and Filtering** (With autocomplete suggestions)
- **Dashboard for Data Analysis** (Chart.js integration)
- **Pipeline Condition Reports** (Based on structural and maintenance ratings)
- **Database Connection** (Supports both **SQL Server** and **Access databases**)
- **Electron Desktop Interface** (For running POSM inspection tools)

---

## **Features**
### ✅ **GIS Map with Esri ArcGIS API**
- Loads a web map from **ArcGIS Online** using a **Portal Item ID**.
- Supports **layer selection and feature visualization**.
- Allows **inspection data overlay** to highlight assets.

### 🔎 **Advanced Search & Filtering**
- Autocomplete search based on **Asset ID, Template Name, Date, and City**.
- Displays asset attributes in an interactive **data table**.
- Fetches inspection records and faults from an **ODBC database**.

### 📊 **Dashboard & Analytics**
- Visualizes **length surveyed over time**.
- Generates **operator comparison charts**.
- Displays **inspection statistics per template**.

### 🔗 **Database & Integration**
- Connects to both **SQL Server and Microsoft Access databases**.
- Uses **ODBC connections** for fetching and inserting asset data.
- Updates **POSMGISData** dynamically from the ArcGIS map.

### ⚡ **Electron.js Desktop Interface**
- Runs POSM inspection tools directly from the **Electron app**.
- Provides **configuration settings** for database connections.
- Supports **custom template selection** for inspections.

---

## **Installation**
### **1. Clone the Repository**
```sh
git clone https://github.com/octa89/Map_CMMS.git
cd Map_CMMS
