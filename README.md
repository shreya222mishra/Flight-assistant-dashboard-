

✈️ Flight Delay & Cancellation Dashboard

This project is an interactive web dashboard designed to help users explore U.S. flight delay and cancellation patterns using historical data (2018–2023). It features four coordinated visualizations built with D3.js and Deck.gl, allowing users to inspect delays by airline, route, season, and cause.

🚀 Live Demo
```
Live Web App URL: https://flightdelay-cancellation-dashboard.netlify.app/
Demo Video URL: https://www.youtube.com/watch?v=dxitPI7sI2g
```
📁 Project Structure

```
root/
├── index.html             # Main HTML file linking all visualizations
├── css/
│   └── style.css          # Centralized styling
├── js/
│   ├── main.js            # Seasonal Delay Heatmap + Pie Chart
│   ├── map.js             # Airline Route Delay Map
│   ├── delay\_cause.js     # U.S. Delay Cause Visualization
│   └── shared.js          # Shared helpers, if applicable
├── data/
│   ├── \*.csv              # Cleaned and aggregated flight datasets
├── assets/                # Icons or background images
└── README.md
```


🧑‍💻 Run Locally

To run the dashboard on your local machine:

1. Clone the Repository
```
git clone https://github.com/your-username/flight-delay-dashboard.git
cd flight-delay-dashboard
```
2. Start a Local Server

Run this command from inside the project folder:
```
python3 -m http.server 8888
```

3. Open in Browser

Once the server is running, open your browser and navigate to:
```
http://localhost:8888
```

You should now see the dashboard and be able to interact with all visualizations.

🛠️ Built With

HTML/CSS/JavaScript
D3.js – Interactive charts and maps
Deck.gl + Mapbox – Geospatial visualizations
Python (for preprocessing)**
Netlify – Hosting platform

📊 Data Source

U.S. Bureau of Transportation Statistics
  (Data was cleaned and pre-aggregated before frontend use.)

👩‍💻 Team Members

 Dhanya Krishnan
 Mohammed Afaan Ansari
 Shreya Mishra
 Simran Gawri

---

Thanks for visiting our dashboard! ✈️📉

---

