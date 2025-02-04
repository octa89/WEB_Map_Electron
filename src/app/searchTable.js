$(document).ready(function () {
    // Function to extract the path from posmExecutablePath, excluding the executable name
    function getExecutablePath(configPath) {
        return configPath.replace(/\\POSM.exe$/, '').replace(/\\/g, '/'); // Remove POSM.exe and replace backslashes with forward slashes
    }

    // Function to format the details for each row (subtable) with a clickable image link
    function format(details, basePath) {
        let tableHTML = '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">';
        tableHTML += '<tr><th>Fault Name</th><th>Struct Weight</th><th>Maint Weight</th><th>Distance</th><th>Preview</th></tr>';

        details.forEach(fault => {
            const mediaPath = fault.MediaFolder ? fault.MediaFolder : '';
            const picturePath = fault.PictureLocation ? fault.PictureLocation : '';
            const videoPath = fault.MpegLocation ? fault.MpegLocation : '';
            const fullPath = `file:///${basePath}/Video/${mediaPath}/${picturePath}`; // Construct the file URL
            const clickableLink = picturePath ? `<a href="${fullPath}" target="_blank">View Image</a>` : 'No Image Available';

            tableHTML += `<tr>
                <td>${fault.FaultName}</td>
                <td>${fault.StructWeight}</td>
                <td>${fault.MaintWeight}</td>
                <td>${fault.Distance}</td>
                <td>${clickableLink}</td>
            </tr>`;
        });

        tableHTML += '</table>';
        return tableHTML;
    }

    // Function to fetch configuration from config.json
    async function fetchConfig() {
        try {
            const response = await fetch('../config.json'); // Adjust the path as per your file structure
            if (!response.ok) {
                throw new Error('Failed to fetch config.json');
            }
            const configData = await response.json();
            return getExecutablePath(configData.posmExecutablePath);
        } catch (error) {
            console.error('Error fetching config:', error);
            return '';
        }
    }

    // Function to fetch and process fault data
    async function fetchAndProcessFaults() {
        try {
            // Show loading indicator
            document.getElementById('loading').style.display = 'block';

            const basePath = await fetchConfig(); // Fetch executable path from config.json
            const response = await fetch('http://localhost:3000/fault');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const faultData = await response.json();

            // Hide loading indicator after fetching data
            document.getElementById('loading').style.display = 'none';

            // Process the data into a grouped structure
            const groupedData = faultData.reduce((acc, item) => {
                const key = `${item.SessionID} -${item.AssetID} - ${new Date(item.Date).toLocaleDateString()} - ${item.TemplateName}`;
                if (!acc[key]) {
                    acc[key] = {
                        SessionID: item.SessionID,
                        AssetID: item.AssetID,
                        StartID: item.StartID,
                        EndID: item.EndID,
                        Date: item.Date,
                        TemplateName: item.TemplateName,
                        AssetLocation: item.AssetLocation,
                        City: item.City,
                        faults: [],
                        faultDetails: '',
                        videoLink: '',
                    };
                }

                // Construct video link inside the grouping process
                const mediaPath = item.MediaFolder ? item.MediaFolder : '';
                const videoPath = item.MpegLocation ? item.MpegLocation : '';
                const videoFullPath = `file:///${basePath}/Video/${mediaPath}/${videoPath}`; // Construct the file URL
                acc[key].videoLink = videoPath ? `<a href="${videoFullPath}" target="_blank">View Video</a>` : 'No Video Available'; // Add video link to the main column

                acc[key].faultDetails += `${item.FaultName} ${item.StructWeight} ${item.MaintWeight} ${item.Distance} `;
                acc[key].faults.push({
                    FaultName: item.FaultName,
                    StructWeight: item.StructWeight,
                    MaintWeight: item.MaintWeight,
                    Distance: item.Distance,
                    MediaFolder: item.MediaFolder,
                    PictureLocation: item.PictureLocation,
                    MpegLocation: item.MpegLocation,
                });
                return acc;
            }, {});

            const processedData = Object.values(groupedData);

            if ($.fn.DataTable.isDataTable('#example')) {
                $('#example').DataTable().destroy();
            }

            const table = $('#example').DataTable({
                data: processedData,
                columns: [
                    { className: 'dt-control', orderable: false, data: null, defaultContent: '' },
                    { data: 'SessionID', title: 'Session ID' },
                    { data: 'AssetID', title: 'Asset ID' },
                    { data: 'StartID', title: 'Start MH' },
                    { data: 'EndID', title: 'End MH' },
                    { data: 'Date', title: 'Date' },
                    { data: 'TemplateName', title: 'Template Name' },
                    { data: 'AssetLocation', title: 'Location' },
                    { data: 'City', title: 'City' },
                    { data: 'videoLink', title: 'Video Link' },
                    { data: 'faultDetails', title: 'Fault Details', visible: false }
                ],
                order: [[1, 'asc']],
                dom: 'Qlfrtip',
                searchBuilder: {}
            });

            $('#example tbody').on('click', 'td.dt-control', function () {
                const tr = $(this).closest('tr');
                const row = table.row(tr);

                if (row.child.isShown()) {
                    row.child.hide();
                    tr.removeClass('shown');
                } else {
                    row.child(format(row.data().faults, basePath)).show();
                    tr.addClass('shown');
                }
            });
        } catch (error) {
            console.error('Fetch error:', error);
            // Hide loading indicator in case of error
            document.getElementById('loading').style.display = 'none';
        }
    }

    fetchAndProcessFaults();
});
