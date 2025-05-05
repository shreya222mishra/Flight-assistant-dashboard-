const width = 960;
const height = 600;
let currentAirport = null;
let airportDelays; // Declare airportDelays in a higher scope


// Create SVG container
const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background-color", "#f0f0f0");  // light grey


// Create projection
const projection = d3.geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(1300);

// Define delay causes and colors
const delayCategories = [
    {id: "carrier_ct", name: "Carrier Delay", color: "#d62728"},
    {id: "weather_ct", name: "Weather Delay", color: "#9467bd"},
    {id: "nas_ct", name: "NAS Delay", color: "#8c564b"},
    {id: "security_ct", name: "Security Delay", color: "#e377c2"},
    {id: "late_aircraft_ct", name: "Late Aircraft", color: "#7f7f7f"}
];

// Load base map first
d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(usData => {
    // Draw states
    svg.append("path")
        .datum(topojson.feature(usData, usData.objects.states))
        .attr("class", "state")
        .attr("d", d3.geoPath().projection(projection))
        .attr("fill", "#e0e0e0")         // 👈 light grey map color
        .attr("stroke", "#aaa")          // optional: lighter border
        .attr("stroke-width", 0.5);      // optional: thin border


    // Now load other data
    Promise.all([
        d3.csv("data/Airline_Delay_Cause2003-2024.csv"),
        d3.csv("https://raw.githubusercontent.com/plotly/datasets/master/2011_february_us_airport_traffic.csv")
    ]).then(([delayData, airportData]) => {
        // Convert coordinates to numbers
        const airports = airportData.map(d => ({
            iata: d.iata,
            name: d.airport,
            lat: +d.lat,
            lon: +d.long,
            city: d.city,
            state: d.state
        }));

        const allowedAirlines = new Set([
            "Delta Air Lines Inc.",
            "United Air Lines Network",
            "American Airlines Network"
        ]);

        // Get airport codes that have at least one of the allowed airlines
        const filteredAirportCodes = new Set(
            delayData
                .filter(d => allowedAirlines.has(d.carrier_name))
                .map(d => d.airport)
        );

        // Filter and validate airports
        const validAirports = airports.filter(d => {
            const hasValidAirline = filteredAirportCodes.has(d.iata);
            const coords = projection([d.lon, d.lat]);
            return hasValidAirline && coords;
        });

        // Preprocess delay data: sum delays per airport per cause
        airportDelays = d3.rollup(
            delayData.filter(d => allowedAirlines.has(d.carrier_name)),
            v => ({
                carrier_ct: d3.sum(v, d => +d.carrier_ct),
                weather_ct: d3.sum(v, d => +d.weather_ct),
                nas_ct: d3.sum(v, d => +d.nas_ct),
                security_ct: d3.sum(v, d => +d.security_ct),
                late_aircraft_ct: d3.sum(v, d => +d.late_aircraft_ct)
            }),
            d => d.airport
        );

        const circles = svg.selectAll("circle.airport")
            .data(validAirports)
            .enter()
            .append("circle")
            .attr("class", "airport")
            .attr("cx", d => projection([d.lon, d.lat])[0])
            .attr("cy", d => projection([d.lon, d.lat])[1])
            .attr("r", 3)
            .style("fill", "red")
            .style("opacity", 0.7)
            .on("click", function (event, d) {
                currentAirport = d.iata;
                showCharts(d.iata, delayData, d);
                d3.select("#map").style("width", "50%");
                d3.select("#charts").style("display", "block");
                d3.select(".back-button").style("display", "inline-block");
            })
            // Add hover events
            .on("mouseover", function (event, d) {
                const selectedCause = d3.select("#cause-select").property("value");
                const delays = airportDelays.get(d.iata);

                let tooltipText = `<strong>${d.name} (${d.iata})</strong>`;
                if (selectedCause && delays) {
                    const causeName = delayCategories.find(c => c.id === selectedCause).name;
                    const delayValue = delays[selectedCause];
                    tooltipText += `<br>${causeName}: ${delayValue.toLocaleString()} minutes`;
                }

                d3.select("#tooltip")
  .html(tooltipText)
  .style("display", "block")
  .style("left", `${event.pageX + 15}px`)
  .style("top", `${event.pageY + 15}px`);
            })
            .on("mouseout", function () {
                d3.select("#tooltip").style("opacity", 1);
;
            });
        // .append("title")
        // .text(d => `${d.name} (${d.iata})`);

    }).catch(error => console.error("Error loading CSV data:", error));

    // Handle delay cause selection
    d3.select("#cause-select").on("change", function () {
        const selectedCause = this.value;

        if (!selectedCause) {
            // Reset to default size and clear legend
            svg.selectAll("circle.airport")
                .transition()
                .duration(300)
                .attr("r", 3);
            d3.select("#legend").html("");
            return;
        }

        // Get max delay for the selected cause
        const maxVal = d3.max(Array.from(airportDelays.values()), d => d[selectedCause]);
        const radiusScale = d3.scaleLinear()
            .domain([0, maxVal])
            .range([3, 30]);

        // Update circle radii based on selected cause
        svg.selectAll("circle.airport")
            .transition()
            .duration(500)
            .attr("r", d => {
                const delays = airportDelays.get(d.iata);
                return delays ? radiusScale(delays[selectedCause]) : 3;
            });

        // Update legend with size indicators
        const causeName = delayCategories.find(c => c.id === selectedCause).name;
        const minSize = radiusScale.range()[0] * 2;
        const maxSize = radiusScale.range()[1] * 2;
        const legendHTML = `
      <div style="margin-top:10px;">
        <strong>${causeName} Delays</strong>
        <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
          <div style="width: ${minSize}px; height: ${minSize}px; background: red; border-radius: 50%;"></div>
          <span>0</span>
          <div style="width: ${maxSize}px; height: ${maxSize}px; background: red; border-radius: 50%;"></div>
          <span>${Math.round(maxVal)}</span>
        </div>
      </div>
    `;
        d3.select("#legend").html(legendHTML);
    });

}).catch(error => console.error("Error loading map data:", error));

// Rest of the code (showCharts, showMapView) remains unchanged
function showCharts(airportCode, data, airport) {
    const container = d3.select("#charts");
    container.html(""); // Clear any previous chart

    const airlineTotals = d3.rollup(
        data.filter(d =>
            d.airport === airportCode &&
            ["Delta Air Lines Inc.", "United Air Lines Network", "American Airlines Network"].includes(d.carrier_name)
        ),
        v => {
            const total = d3.sum(v, d => +d.carrier_ct + +d.weather_ct + +d.nas_ct + +d.security_ct + +d.late_aircraft_ct);
            return {
                carrier: v[0].carrier_name.replace(/ Air Lines Network| Inc./g, ""),
                carrier_ct: d3.sum(v, d => +d.carrier_ct) / total,
                weather_ct: d3.sum(v, d => +d.weather_ct) / total,
                nas_ct: d3.sum(v, d => +d.nas_ct) / total,
                security_ct: d3.sum(v, d => +d.security_ct) / total,
                late_aircraft_ct: d3.sum(v, d => +d.late_aircraft_ct) / total
            };
        },
        d => d.carrier_name
    );

    const chartData = Array.from(airlineTotals.values());

    const margin = {top: 20, right: 30, bottom: 40, left: 40};
    const chartWidth = 600 - margin.left - margin.right;
    const chartHeight = 300 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const stack = d3.stack()
        .keys(["carrier_ct", "weather_ct", "nas_ct", "security_ct", "late_aircraft_ct"]);

    const stackedData = stack(chartData);

    const x = d3.scaleBand()
        .domain(chartData.map(d => d.carrier))
        .range([0, chartWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .range([chartHeight, 0]);

    // Draw stacked bars
    const bars = svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
        .attr("fill", d => delayCategories.find(c => c.id === d.key).color);

    bars.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.carrier))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth());

    // Add text labels inside each segment
    bars.selectAll("text")
        .data(d => d.map(p => ({...p, key: d.key})))
        .enter().append("text")
        .attr("x", d => x(d.data.carrier) + x.bandwidth() / 2)
        .attr("y", d => (y(d[0]) + y(d[1])) / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "10px")
        .text(d => {
            const percentage = (d[1] - d[0]) * 100;
            return percentage > 5 ? delayCategories.find(c => c.id === d.key).name : "";
        });

    // Add x-axis
    svg.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));

    // Add y-axis (optional)
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

    // Position the chart near the clicked airport using transform
    const [xPos, yPos] = projection([airport.lon, airport.lat]);

    container.style("position", "absolute")
        .style("top", `${yPos}px`)
        .style("left", `${xPos}px`)
        .style("opacity", 0) // Initially hide the chart
        .style("transform", "scale(0)") // Start small
        .style("display", "block");

    // Apply transition for smooth effect
    container.transition()
        .duration(1000) // Duration of the transition
        .style("top", `${yPos - chartHeight / 2}px`)
        .style("left", `${xPos + 10}px`)
        .style("opacity", 1) // Fade in the chart smoothly
        .style("transform", "scale(1)") // Scale it up to full size
        .ease(d3.easeCubicInOut); // Smooth easing function
}


function showMapView() {
    currentAirport = null;
    d3.select("#charts").style("display", "none");
    d3.select("#map").style("width", "100%");
    d3.select(".back-button").style("display", "none");
}

document.addEventListener("DOMContentLoaded", () => {
    const cardVis3 = document.getElementById("instruction-card-vis4");
    const closeBtnVis3 = document.getElementById("close-instruction-vis3");

    if (closeBtnVis3 && cardVis3) {
        closeBtnVis3.addEventListener("click", () => {
            cardVis3.style.display = "none";
        });
    }
});
document.getElementById("close-instruction-vis4")?.addEventListener("click", function () {
    const card = document.getElementById("instruction-card-vis4");
    if (card) card.style.display = "none";
});
