
mapboxgl.accessToken = 'pk.eyJ1Ijoic2dhd3JpIiwiYSI6ImNtOXdibnZiZTBlcHEybHB5cGM0NXI0am4ifQ.7BcSl-l-lMNxwuuSpKT6Jw';

const bounds = [
  [-130, 22], // Southwest coordinates (lon, lat)
  [-65, 50]   // Northeast coordinates
];

const map = new mapboxgl.Map({
  container: 'deck-map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: [-98, 39], // USA center
  zoom: 3,
  pitch: 45,
  bearing: -20,
  maxBounds: bounds // Set the map's boundaries
});
map.dragRotate.enable();
map.touchZoomRotate.enableRotation();

let deckgl;
let tooltip;




Promise.all([
  d3.csv("data/aggregated_cancelled_flights.csv"),
  d3.csv("data/usa-airports.csv"),
    d3.csv("data/unique_carriers.csv")
]).then(([flights, airports,carriers]) => {
  const pieContainer = d3.select("#pie-chart-container");
const toggleBtn = d3.select("#toggle-pie");

toggleBtn.on("click", function() {
  pieContainer.classed("collapsed", !pieContainer.classed("collapsed"));
  toggleBtn.text(pieContainer.classed("collapsed") ? "+" : "−");

  // Trigger a resize event if needed for map elements
  if (map) map.resize();
});

  const airlineNameMap = new Map();
  carriers.forEach(d => {
    airlineNameMap.set(d.carrier, d.carrier_name);
  });

  const airportMap = new Map();
  airports.forEach(d => {
    airportMap.set(d.iata, {
      lat: +d.latitude,
      lon: +d.longitude,
      state: d.state,
      name: d.name
    });

  });


  const states = [...new Set(flights.map(d => d.OriginState))].sort();
  const months = [...new Set(flights.map(d => d.Month))].sort((a, b) => +a - +b);

  const originSel = d3.select("#originState");
  const destSel = d3.select("#destState");
  const monthSel = d3.select("#month");

  states.forEach(s => originSel.append("option").text(s));
  states.forEach(s => destSel.append("option").text(s));
  months.forEach(m => monthSel.append("option").text(m));

  originSel.on("change", updateRoutes);
  destSel.on("change", updateRoutes);
  monthSel.on("change", updateRoutes);

  function updateRoutes() {
    const originState = originSel.property("value");
    const destState = destSel.property("value");
    const month = +monthSel.property("value");

    // Filter for the selected month across all years
    const monthFiltered = flights.filter(d => +d.Month === month);

    // Group by origin-dest pairs to calculate aggregated cancellation rates
    const routeMap = new Map();

    monthFiltered.forEach(d => {
      const key = `${d.Origin}-${d.Dest}`;
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          origin: d.Origin,
          dest: d.Dest,
          cancelled: 0,
          total: 0,
          originState: d.OriginState,
          destState: d.DestState,
          airlines: new Map()
        });
      }
      const route = routeMap.get(key);
      route.cancelled += +d.CancelledFlights;
      route.total += +d.TotalFlights;
      if (!route.airlines.has(d.Reporting_Airline)) {
    route.airlines.set(d.Reporting_Airline, {
      cancelled: 0,
      total: 0
    });
  }
  const airline = route.airlines.get(d.Reporting_Airline);
  airline.cancelled += +d.CancelledFlights;
  airline.total += +d.TotalFlights;
    });


    // Now filter for the selected states
    const filtered = Array.from(routeMap.values()).filter(d =>
      d.originState === originState && d.destState === destState
    );

    let minRate = Infinity, maxRate = -Infinity;

filtered.forEach(d => {
  const rate = d.total > 0 ? (d.cancelled / d.total) * 100 : 0;
  if (rate < minRate) minRate = rate;
  if (rate > maxRate) maxRate = rate;
});

    // Create airport set for labels
    const airportsInRoutes = new Set();
    filtered.forEach(d => {
      airportsInRoutes.add(d.origin);
      airportsInRoutes.add(d.dest);
    });

    // Create data for text layer
    const airportData = Array.from(airportsInRoutes).map(iata => {
      const airport = airportMap.get(iata);
      return airport ? {
        name: airport.name,
        position: [airport.lon, airport.lat]
      } : null;
    }).filter(Boolean);



    // Create text layer
    const textLayer = new deck.TextLayer({
      id: 'airport-names',
      data: airportData,
      getPosition: d => d.position,
      getText: d => d.name,
      getColor: [0, 0, 0, 255],
      getSize: 12,
      getAngle: 0,
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center'
    });

  //   const colorScale = d3.scaleLinear()
  // .domain([minRate, maxRate])
  // .range(["green", "red"])  // or ["#00ff00", "#ff0000"]
  // .interpolate(d3.interpolateRgb.gamma(2.2));
    let colorScale;
if (minRate === maxRate) {
  colorScale = () => "#ffe6e6"; // all same color if only one rate
} else {
  colorScale = d3.scaleLinear()
    .domain([minRate, maxRate])
    .range(["#ffe6e6", "#ff6666", "#cc0000"])
    .interpolate(d3.interpolateHcl);
}

    const arcs = filtered.map(d => {
  const origin = airportMap.get(d.origin);
  const dest = airportMap.get(d.dest);
  if (!origin || !dest || d.total === 0) return null;

  const cancellationRate = (d.cancelled / d.total) * 100;

  const color = d3.color(colorScale(cancellationRate)).rgb();
  const rgb = [color.r, color.g, color.b];

  return {
    sourcePosition: [origin.lon, origin.lat],
    targetPosition: [dest.lon, dest.lat],
    color: rgb,
    width: 2 + (cancellationRate / 5),
    originName: origin.name,
    destName: dest.name,
    cancelled: d.cancelled,
    total: d.total,
    rate: cancellationRate.toFixed(2),
    originIata: d.origin,
    destIata: d.dest,
    airlines: d.airlines
  };
}).filter(Boolean);


    // Create arc layer with hover interaction
    const arcLayer = new deck.ArcLayer({
      id: 'arc-layer',
      data: arcs,
      getSourcePosition: d => d.sourcePosition,
      getTargetPosition: d => d.targetPosition,
      getSourceColor: d => d.color,
      getTargetColor: d => d.color,
      getWidth: d => d.width,
      getTilt: 15,
  animationSpeed: 0.5,
  numSegments: 50,
      greatCircle: true,
      parameters: {
    depthTest: false
  },
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 0, 200],

      // Update the arcLayer onClick handler
onClick: info => {
  if (info.object) {
    const originIata = info.object.originIata;
    const destIata = info.object.destIata;
    const month = +monthSel.property("value");

    // Filter relevant flights
    const routeFlights = flights.filter(d =>
      d.Origin === originIata &&
      d.Dest === destIata &&
      +d.Month === month
    );


    const airlineData = Array.from(info.object.airlines, ([airline, stats]) => ({
      airline,
      cancelled: stats.cancelled,
      total: stats.total,
      rate: (stats.cancelled / stats.total) * 100 || 0
    }));


    function createPieChart(data, airlineNameMap) {
      pieContainer.classed("collapsed", false);
  toggleBtn.text("−");
  const container = d3.select("#pie-chart-container");
  const chart = d3.select("#pie-chart");
  const legend = d3.select("#pie-legend");

  chart.selectAll("*").remove();
  legend.selectAll("*").remove();
  legend.append("h4")
  .text("Cancellation by Airline")
  .style("margin", "0 0 12px 0")
  .style("font-size", "16px")
  .style("font-weight", "600");


  if (!data || data.length === 0) {
    chart.append("p").text("No data");
    return;
  }

  // Smaller dimensions
  const width = 220;
  const height = 220;
  const radius = Math.min(width, height) / 2;

  const svg = chart.append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width/2},${height/2})`);

  // Pie generator
  const pie = d3.pie()
    .value(d => d.cancelled)
    .sort(null);

  // Smaller arc
  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius * 0.7); // Smaller radius

  // Color scale
  const color = d3.scaleOrdinal(d3.schemeCategory10);


  // Create arcs
  const arcs = svg.selectAll(".arc")
    .data(pie(data))
    .enter().append("g")
    .attr("class", "arc");

  // Draw slices
  arcs.append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => color(i))
    .attr("stroke", "white")
    .attr("stroke-width", 1); // Thinner stroke

  // Smaller labels (or remove them if too crowded)
  // arcs.append("text")
  // .attr("transform", d => `translate(${arc.centroid(d)})`)
  // .attr("text-anchor", "middle")
  // .text(d => {
  //   const name = airlineNameMap.get(d.data.airline) || d.data.airline;
  //   return name.length > 10 ? name.slice(0, 10) + "…" : name;
  // })
  // .style("font-size", "9px")
  // .style("fill", "white");


  // Compact legend
  airlineData.forEach((d, i) => {
    const airlineName = airlineNameMap.get(d.airline) || d.airline;
  
    const item = legend.append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .style("margin-bottom", "8px");
  
    // Color box
    item.append("div")
      .style("width", "20px")
      .style("height", "12px")
      .style("background", color(i))
      .style("border-radius", "4px")
      .style("flex-shrink", "0");
  
    // Airline name
    item.append("div")
      .style("font-size", "13px")
      .style("white-space", "nowrap")
      .style("overflow", "hidden")
      .style("text-overflow", "ellipsis")
      .style("flex", "1")
      .text(airlineName);
  
    // Percentage
    item.append("div")
      .style("font-size", "13px")
      .style("flex-shrink", "0")
      .text(`${d.rate.toFixed(1)}%`);
  });
  
}
    createPieChart(airlineData,airlineNameMap);
  }
},


      onHover: info => {
  const tooltip = document.querySelector('.tooltip');

  if (info.object) {
    // Show tooltip (existing code)
    const sourcePosition = info.object.sourcePosition;
    const targetPosition = info.object.targetPosition;
    const midPoint = [
      (sourcePosition[0] + targetPosition[0]) / 2,
      (sourcePosition[1] + targetPosition[1]) / 2
    ];
    const mapCoordinates = map.project(midPoint);

    tooltip.innerHTML = `
      <strong>${info.object.originName} → ${info.object.destName}</strong><br>
      Cancelled: ${info.object.cancelled} flights<br>
      Total: ${info.object.total} flights<br>
      Rate: ${info.object.rate}%
    `;
    tooltip.style.left = `${mapCoordinates.x}px`;
    tooltip.style.top = `${mapCoordinates.y - 50}px`;
    tooltip.style.display = 'block';

    // Update text layer to show only relevant airport names
    deckgl.setProps({
      layers: [
        arcLayer,
        new deck.TextLayer({
          ...textLayer,
          data: airportData.filter(d =>
            d.position[0] === info.object.sourcePosition[0] && d.position[1] === info.object.sourcePosition[1] ||
            d.position[0] === info.object.targetPosition[0] && d.position[1] === info.object.targetPosition[1]
          ),
          getColor: [0, 0, 0, 255], // Make visible
          visible: true
        })
      ]
    });
  } else {
    // Hide tooltip and all airport names
    tooltip.style.display = 'none';
    deckgl.setProps({
      layers: [
        arcLayer,
        new deck.TextLayer({
          ...textLayer,
          getColor: [0, 0, 0, 0], // Make transparent
          visible: false
        })
      ]
    });
  }
}

    });

    // Update or create Deck.gl overlay
    if (!deckgl) {
      deckgl = new deck.MapboxOverlay({
        layers: [arcLayer, new deck.TextLayer({
        ...textLayer,
        visible: false // Keep hidden initially
      })],
        visible:false
      });
      map.addControl(deckgl);
    } else {
      deckgl.setProps({ layers: [arcLayer, new deck.TextLayer({
        ...textLayer,
        visible: false // Keep hidden initially
      })] });
    }
  }


  // Initial render
  updateRoutes();

});
document.addEventListener("DOMContentLoaded", () => {
  const cardVis3 = document.getElementById("instruction-card-vis3");
  const closeBtnVis3 = document.getElementById("close-instruction-vis3");

  if (closeBtnVis3 && cardVis3) {
    closeBtnVis3.addEventListener("click", () => {
      cardVis3.style.display = "none";
    });
  }
});

document.getElementById("dark-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
