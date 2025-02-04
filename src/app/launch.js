document.getElementById('launchButton').addEventListener('click', function () {
    // Log when the button is clicked
    console.log("Launch button clicked");

    const featureId = localStorage.getItem('selectedFeatureId');
    console.log("Feature ID from storage:", featureId);
    console.log("Sending POST request to:", 'http://localhost:3000/launch');

    // Log the retrieved feature ID from localStorage
    console.log("Feature ID from storage:", featureId);

    // Check if ID is retrieved correctly and log the URL to ensure it's correct
    console.log("Sending POST request to:", 'http://localhost:3000/launch');

    fetch('http://localhost:3000/launch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: featureId })
    })
        .then(response => {
            console.log("Received HTTP status:", response.status);
            response.text().then(text => console.log("Raw response:", text)); // Log raw response as text

            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            return response.json(); // This might throw an error if response is not valid JSON
        })
        .then(data => {
            console.log('Success:', data);
        })
        .catch(error => {
            console.error('Error launching POSM:', error);
        })
});
