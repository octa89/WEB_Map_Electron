let myChart; // Declare myChart in a global scope
let minDateFromData; // Declare minDateFromData in a global scope

document.addEventListener("DOMContentLoaded", async () => {
  const lineChartElement = document.getElementById("myChart");
  const lineChartElement2 = document.getElementById("myChart2");
  const lineData = [];
  const labels = [];
  const templateData = {};

  try {
    const lineResponse = await fetch("http://localhost:3000/data");
    const data = await lineResponse.json();

    // Build labels and templateData for line chart (Length Surveyed Over Time)
    data.forEach((item) => {
      lineData.push(item);
      let label = item.MonthYear || "N/A";

      // Ensure label is 'YYYY-MM'
      if (label !== "N/A" && label.length > 7) {
        label = label.substring(0, 7);
      }

      if (label !== "N/A" && !labels.includes(label)) {
        labels.push(label);
      }

      if (!templateData[item.TemplateName]) {
        templateData[item.TemplateName] = {};
      }

      if (!templateData[item.TemplateName][label]) {
        templateData[item.TemplateName][label] = 0;
      }

      templateData[item.TemplateName][label] +=
        parseFloat(item.LengthSurveyedSum) || 0;
    });

    // Sort labels
    labels.sort();

    // Prepare datasets for the line chart
    const dataset = Object.keys(templateData).map((templateName) => {
      const dataPoints = labels.map((label) => {
        const value = templateData[templateName][label];
        return value !== undefined ? value : null;
      });
      return {
        label: templateName,
        data: dataPoints,
        borderWidth: 2,
        fill: false,
        pointRadius: 5,
        tension: 0.6,
      };
    });

    // Calculate Y-axis max for line chart
    const operatorMaxValues = data.reduce((acc, item) => {
      const lengthSurveyed = parseFloat(item["Length Surveyed"]) || 0;
      if (!acc[item.OperatorName] || acc[item.OperatorName] < lengthSurveyed) {
        acc[item.OperatorName] = lengthSurveyed;
      }
      return acc;
    }, {});
    const validValues = Object.values(operatorMaxValues).filter(
      (v) => !isNaN(v)
    );
    const highestOperatorMax = Math.max(...validValues);
    const roundedMax = Math.ceil(highestOperatorMax / 10) * 10;

    console.log(
      "Highest Operator Max:",
      highestOperatorMax,
      "Rounded Max:",
      roundedMax
    );

    // Determine min date
    const dateLabels = labels
      .filter((label) => label !== "N/A")
      .map((label) => new Date(label + "-01"));
    minDateFromData = new Date(Math.min.apply(null, dateLabels));

    // Create line chart
    const ctx = lineChartElement.getContext("2d");
    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: dataset,
      },
      options: {
        spanGaps: true,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "month",
              parser: "yyyy-MM",
              displayFormats: {
                month: "yyyy-MM",
              },
            },
            ticks: {
              color: "#FFFFFF",
              source: "auto",
            },
            min: minDateFromData,
            distribution: "linear",
          },
          y: {
            title: {
              text: "Length Surveyed",
              display: true,
              color: "#FFFFFF",
            },
            ticks: {
              color: "#FFFFFF",
            },
            beginAtZero: true,
            suggestedMax: roundedMax,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: function (tooltipItems) {
                const ts = tooltipItems[0].parsed.x;
                const date = new Date(ts);
                return date.toLocaleDateString("default", {
                  year: "numeric",
                  month: "long",
                });
              },
              label: function (tooltipItem) {
                const datasetLabel = tooltipItem.dataset.label;
                const value = tooltipItem.parsed.y;
                const formattedValue = new Intl.NumberFormat("en-US", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(value);
                return `${datasetLabel}: ${formattedValue} feet`;
              },
            },
          },
        },
      },
    });
    console.log(myChart.ctx);

    // Operator Chart
    try {
      const operatorResponse = await fetch("http://localhost:3000/operator");
      const operatorData = await operatorResponse.json();

      console.log(operatorData);

      const operatorLabels = operatorData.map(
        (item) => item.OperatorName || "No Name"
      );
      const operatorDataValues = operatorData.map(
        (item) => item["Length Surveyed"]
      );

      const operatorChartConfig = {
        type: "bar",
        data: {
          labels: operatorLabels,
          datasets: [
            {
              label: "Length Surveyed",
              data: operatorDataValues,
              backgroundColor: "rgb(54, 162, 235)",
              borderColor: "rgb(75, 192, 192)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              ticks: {
                color: "#FFFFFF",
              },
              beginAtZero: true,
              display: true,
              title: {
                display: true,
                text: "Length Surveyed",
                color: "#FFFFFF",
                font: {
                  family:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
                },
              },
            },
            x: {
              ticks: {
                color: "#FFFFFF",
              },
              display: true,
              title: {
                display: true,
                text: "Operator Name",
                color: "#FFFFFF",
                font: {
                  family:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
                },
              },
            },
          },
        },
      };

      const operatorChart = new Chart(lineChartElement2, operatorChartConfig);
    } catch (error) {
      console.error("Error fetching operator chart data:", error);
      alert(
        "Error fetching operator chart data. Please ensure the server is running and accessible."
      );
    }

    // New myChart3 approach: Count inspections per month-year and template
    // We will not use templateData sums here. Instead, we count how many records per month-year & template.

    // Extract unique month-year and template names for counting inspections
    const myChart3LabelsSet = new Set();
    const myChart3TemplatesSet = new Set();

    data.forEach((item) => {
      myChart3LabelsSet.add(item.MonthYear);
      myChart3TemplatesSet.add(item.TemplateName);
    });

    const myChart3Labels = Array.from(myChart3LabelsSet).sort();
    const myChart3TemplateNames = Array.from(myChart3TemplatesSet);

    // Initialize counts
    const inspectionsByMonthAndTemplate = {};
    myChart3Labels.forEach((month) => {
      inspectionsByMonthAndTemplate[month] = {};
      myChart3TemplateNames.forEach((tName) => {
        inspectionsByMonthAndTemplate[month][tName] = 0;
      });
    });

    // Count inspections
    data.forEach((item) => {
      const month = item.MonthYear;
      const template = item.TemplateName;
      if (
        inspectionsByMonthAndTemplate[month] &&
        inspectionsByMonthAndTemplate[month][template] !== undefined
      ) {
        inspectionsByMonthAndTemplate[month][template] += 1;
      }
    });

    // Create datasets for the stacked chart (myChart3)
    const myChart3Datasets = myChart3TemplateNames.map((tName, index) => {
      return {
        label: tName,
        data: myChart3Labels.map(
          (month) => inspectionsByMonthAndTemplate[month][tName]
        ),
        borderWidth: 1,
        backgroundColor: `hsl(${index * 40}, 70%, 50%)`,
      };
    });

    console.log("myChart3 Labels:", myChart3Labels);
    console.log("myChart3 Template Names:", myChart3TemplateNames);
    console.log("myChart3 Stacked Datasets:", myChart3Datasets);

    /* const ctx4 = document.getElementById("myChart3").getContext("2d"); */
   /*  const stackedBarChart = new Chart(ctx4, {
      type: "bar",
      data: {
        labels: myChart3Labels,
        datasets: myChart3Datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#FFFFFF" },
            title: {
              display: true,
              text: "Month-Year",
              color: "#FFFFFF",
            },
          },
          y: {
            stacked: true,
            ticks: { color: "#FFFFFF" },
            beginAtZero: true,
            title: {
              display: true,
              text: "Number of Inspections",
              color: "#FFFFFF",
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: function (tooltipItems) {
                const label = tooltipItems[0].label; // 'YYYY-MM'
                const [year, month] = label.split("-");
                const date = new Date(Date.UTC(year, month - 1));
                return date.toLocaleDateString("default", {
                  year: "numeric",
                  month: "long",
                });
              },
              label: function (tooltipItem) {
                const datasetLabel = tooltipItem.dataset.label;
                const value = tooltipItem.parsed.y;
                return `${datasetLabel}: ${value} inspection${
                  value === 1 ? "" : "s"
                }`;
              },
            },
          },
        },
      },
    }); */

    // Globally accessible dateFilter function
    function dateFilter() {
      const minDateInput = document.getElementById("minDate").value;
      const maxDateInput = document.getElementById("maxDate").value;

      const minDate = minDateInput
        ? new Date(minDateInput + "-01")
        : minDateFromData;
      const maxDate = maxDateInput ? new Date(maxDateInput + "-01") : undefined;

      if (myChart) {
        myChart.options.scales.x.min = minDate || minDateFromData;
        myChart.options.scales.x.max = maxDate || undefined;
        myChart.update();
      }
    }
  } catch (error) {
    console.error("Error:", error);
    alert(
      "Error fetching data. Please ensure the server is running and accessible."
    );
  }
});
