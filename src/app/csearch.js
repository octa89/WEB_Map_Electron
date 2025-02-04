document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchInput");
  const okButton = document.getElementById("okButton");
  const clearButton = document.getElementById("clearButton");
  const assetTable = document.getElementById("assetTable");
  const assetTableBody = document.querySelector("#assetTable tbody");
  const suggestionsElement = document.getElementById("suggestions");

  let currentData = []; // Store the current filtered data

  // Fetch data from the API
  async function fetchData() {
    try {
      const response = await fetch("http://localhost:3000/map");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
      return [];
    }
  }

  // Filter data based on the search query across all fields
  function filterData(data, query) {
    const lowerQuery = query.toLowerCase();
    return data.filter((item) => {
      const assetID = item.AssetID ? item.AssetID.toString().toLowerCase() : "";
      const templateName = item.TemplateName
        ? item.TemplateName.toLowerCase()
        : "";
      const date = item.Date ? item.Date.toLowerCase() : "";
      const city = item.City ? item.City.toLowerCase() : "";

      return (
        assetID.includes(lowerQuery) ||
        templateName.includes(lowerQuery) ||
        date.includes(lowerQuery) ||
        city.includes(lowerQuery)
      );
    });
  }

  // Update suggestions in the datalist
  function updateSuggestions(data, query) {
    suggestionsElement.innerHTML = ""; // Clear existing options

    if (!query) return; // Do not show suggestions if query is empty

    // Filter and sort data by relevance, limit to 7 matches
    const filteredData = data
      .map((item) => {
        const assetID = item.AssetID
          ? item.AssetID.toString().toLowerCase()
          : "";
        const templateName = item.TemplateName
          ? item.TemplateName.toLowerCase()
          : "";
        const date = item.Date ? item.Date.toLowerCase() : "";
        const city = item.City ? item.City.toLowerCase() : "";

        // Calculate relevance by matching all fields
        const relevance = [assetID, templateName, date, city].reduce(
          (acc, field) => {
            return field.includes(query.toLowerCase()) ? acc + 1 : acc;
          },
          0
        );

        return { item, relevance };
      })
      .filter(({ relevance }) => relevance > 0) // Only include relevant items
      .sort((a, b) => b.relevance - a.relevance) // Sort by relevance
      .slice(0, 7); // Limit to 7 matches

    // Add filtered data to suggestions
    filteredData.forEach(({ item }) => {
      const suggestion =
        item.AssetID || item.TemplateName || item.Date || item.City;
      if (suggestion) {
        const option = document.createElement("option");
        option.value = suggestion; // Set a meaningful suggestion value
        suggestionsElement.appendChild(option);
      }
    });
  }

  // Update the table with the filtered data
  function updateTable(data) {
    assetTableBody.innerHTML = "";
    data.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${item.AssetID || ""}</td>
                <td>${item.TemplateName || ""}</td>
                <td>${item.Date || ""}</td>
                <td>${item.structRating || ""}/${item.maintRating || ""}</td>
                <td>${item.City || ""}</td>
            `;
      assetTableBody.appendChild(row);
    });
  }

  // Event listener for search input
  searchInput.addEventListener("input", async (event) => {
    const query = event.target.value.trim();

    if (!query) {
      suggestionsElement.innerHTML = ""; // Clear suggestions if query is empty
      return;
    }

    try {
      const data = await fetchData(); // Fetch data from the API
      updateSuggestions(data, query); // Update suggestions with the query
    } catch (error) {
      console.error("Error updating suggestions:", error);
    }
  });

  // Event listener for the "OK" button
  okButton.addEventListener("click", async () => {
    const query = searchInput.value.trim();

    if (!query) {
      alert("Please enter a search term.");
      return;
    }

    try {
      const data = await fetchData(); // Fetch data from the API
      const filteredData = filterData(data, query); // Filter data by query
      updateTable(filteredData); // Update the table with the filtered results

      // Show or hide the table based on the results
      assetTable.style.display = filteredData.length > 0 ? "table" : "none";

      if (filteredData.length === 0) {
        alert("No matches found.");
      }
    } catch (error) {
      console.error("Error displaying search results:", error);
    }
  });

  // Event listener for the "Clear Table" button
  clearButton.addEventListener("click", () => {
    assetTableBody.innerHTML = ""; // Clear table rows
    assetTable.style.display = "none"; // Hide the table
    searchInput.value = ""; // Clear search input
    suggestionsElement.innerHTML = ""; // Clear suggestions
  });
});
