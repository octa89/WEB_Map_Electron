document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('#inspectionsTable tbody');

    // Fetch data for inspections table
    try {
        const tableResponse = await fetch('http://localhost:3000/insp');
        const tableData = await tableResponse.json();

        console.log(tableData);

        let total = 0;

        // Populate the table with data
        tableData.forEach(item => {
            const row = document.createElement('tr');
            const templateNameCell = document.createElement('td');
            templateNameCell.textContent = item.TemplateName;

            // Dynamically check for the correct key to use
            const countValue = item[""] !== undefined ? item[""] : item.Expr1001;

            const countCell = document.createElement('td');
            countCell.textContent = countValue;
            row.appendChild(templateNameCell);
            row.appendChild(countCell);
            tableBody.appendChild(row);

            // Add to total
            total += countValue;
        });

        // Add a total row
        const totalRow = document.createElement('tr');
        const totalLabelCell = document.createElement('td');
        totalLabelCell.textContent = 'Total';
        const totalCountCell = document.createElement('td');
        totalCountCell.textContent = total;

        totalRow.appendChild(totalLabelCell);
        totalRow.appendChild(totalCountCell);
        tableBody.appendChild(totalRow);

    } catch (error) {
        console.error('Error fetching inspections data:', error);
        alert('Error fetching inspections data. Please ensure the server is running and accessible.');
    }
});
