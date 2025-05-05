'use strict';
(async () => {
  const waitForMap = () =>
    new Promise(resolve => {
      const check = () => {
        const svg = d3.select("#route-map");
        if (!svg.empty()) resolve(svg);
        else setTimeout(check, 100);
      };
      check();
    });

  const svg = await waitForMap();

  const projection = d3.geoAlbersUsa()
    .translate([window.innerWidth / 2-200, window.innerHeight / 2])
    .scale(1500);
  const path = d3.geoPath().projection(projection);

  const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");

const airlineColors = { AA: '#8a41ff', DL: '#358cff', UA: '#e44cbe' };
svg.append("g")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter()
    .append("path")
    .attr("fill", "#eee")
    .attr("stroke", "#aaa")
    .attr("d", path);
svg.append("defs").html(`
  <filter id="pin-shadow" x="-50%" y="-50%" width="250%" height="250%">
    <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.9)" />
  </filter>
`);

const tooltip = d3.select("#tooltip");

const g = svg.append("g");
const displayedRoutes = svg.append("g").attr("class", "routes");
const airportCoords = { ATL: [-84.4277, 33.6407], LAX: [-118.4085, 33.9416], DFW: [-97.0403, 32.8998], DEN: [-104.6737, 39.8561], ORD: [-87.9073, 41.9742], JFK: [-73.7781, 40.6413], MCO: [-81.3081, 28.4312], LAS: [-115.1523, 36.0801], CLT: [-80.9431, 35.214], MIA: [-80.2906, 25.7959], SEA: [-122.3088, 47.4502], EWR: [-74.1745, 40.6895], PHX: [-112.0116, 33.4342], SFO: [-122.3790, 37.6213], IAH: [-95.3414, 29.9902], BOS: [-71.0052, 42.3656], DTW: [-83.3534, 42.2121], PHL: [-75.2411, 39.8719], SLC: [-111.9791, 40.7899], BWI: [-76.6684, 39.1754], DCA: [-77.0377, 38.8512], SAN: [-117.1973, 32.7338], AUS: [-97.6699, 30.1945], TPA: [-82.5333, 27.9755], BNA: [-86.6782, 36.1263] };
const airportNames = {
  ATL: "Atlanta",
  LAX: "Los Angeles",
  DFW: "Dallas/Fort Worth",
  DEN: "Denver",
  ORD: "Chicago O'Hare",
  JFK: "New York",
  MCO: "Orlando",
  LAS: "Las Vegas",
  CLT: "Charlotte",
  MIA: "Miami",
  SEA: "Seattle",
  EWR: "Newark",
  PHX: "Phoenix",
  SFO: "San Francisco",
  IAH: "Houston",
  BOS: "Boston",
  DTW: "Detroit",
  PHL: "Philadelphia",
  SLC: "Salt Lake City",
  BWI: "Baltimore",
  DCA: "Washington D.C.",
  SAN: "San Diego",
  AUS: "Austin",
  TPA: "Tampa",
  BNA: "Nashville"
};

let fullData = [];
let sourceAirport = null;
let selectionPins = []; // pins dropped on airport click (before route)


let destinationAirport = null;
function drawAirports() {
  Object.entries(airportCoords).forEach(([code, coords]) => {
    const [x, y] = projection(coords);
    let xOffset = 8, yOffset = 6;
    if (code === "JFK") xOffset = 14;
    if (code === "EWR") yOffset = 25;
    if (code === "BWI") xOffset = 14;
    if (code === "DCA") yOffset = 18;

    const airportCircle = g.append("circle")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 7)
      .attr("class","hover-on")
      .attr("fill", "#62628D")
      .attr("stroke", "black")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event) {
            d3.select(this).classed("hover-airport", true);
            tooltip.style("opacity", 1)
                    .html(`<strong>${airportNames[code]}</strong>`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
       .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
       .on("mouseout", function() {
            d3.select(this).classed("hover-airport", false);
            tooltip.style("opacity", 0);
            })
        .on("click", (event) => {
        event.stopPropagation();
        selectAirport(code);
      });
    airportCircle.attr("id", `airport-${code}`);
    g.append("text")
      .attr("x", x + xOffset)
      .attr("y", y + yOffset)
      .text(code)
      .attr("font-size", "15px")
      .attr("fill", "#222");
  });
}
function selectAirport(code) {
  d3.selectAll(".highlighted-airport").classed("highlighted-airport", false);
  d3.select(`#airport-${code}`).classed("highlighted-airport", true);
  const coords = projection(airportCoords[code]);

  if (!sourceAirport) {
    sourceAirport = code;
  } else {
    destinationAirport = code;
    d3.select(`#airport-${destinationAirport}`).classed("highlighted-airport", true);
    drawFilteredRoutes(sourceAirport, destinationAirport);
    sourceAirport = null;
    destinationAirport = null;
  }
}
svg.on("click", () => {
  displayedRoutes.selectAll(".animated-plane, path").remove();

  // ✅ Correct pin cleanup
  selectionPins.forEach(pin => pin.remove());
  selectionPins = [];

  d3.selectAll(".highlighted-airport").classed("highlighted-airport", false);
  sourceAirport = null;
  destinationAirport = null;
});





function drawPath(d, i, thickness, isMaxDelay, callback) {
  const from = projection([+d.origin_lng, +d.origin_lat]);
  const to = projection([+d.destination_lng, +d.destination_lat]);
  if (!from || !to) return;
 // Vector from start to end
const dx = to[0] - from[0];
const dy = to[1] - from[1];

// Normalize and get perpendicular vector (90° rotation)
const length = Math.sqrt(dx * dx + dy * dy);
const normX = dx / length;
const normY = dy / length;

// Perpendicular direction (rotate by 90° CCW)
const perpX = -normY;
const perpY = normX;

// Spread distance — tweak as needed
const spread = 40 * (i - 1); // 3 routes: i = 0 → -40, i = 1 → 0, i = 2 → +40

const mid = [
  (from[0] + to[0]) / 2 + perpX * spread,
  (from[1] + to[1]) / 2 + perpY * spread
];




  const line = d3.line().curve(d3.curveBasis);
  const points = [from, mid, to];

  const pathLine = displayedRoutes.append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", isMaxDelay ? "red" : airlineColors[d.Reporting_Airline])
    .attr("stroke-opacity", 0.8)
    .attr("stroke-width", thickness)
    .attr("d", line)
    .attr("stroke-dasharray", function() {
      const length = this.getTotalLength();
      return length + " " + length;
    })
    .attr("stroke-dashoffset", function() {
      return this.getTotalLength();
    });

  pathLine.transition()
    .duration(2000)
    .ease(d3.easeSinInOut)
    .attr("stroke-dashoffset", 0);

  if (isMaxDelay) {
    pathLine.classed("flash-delay", true);
    setTimeout(() => {
      pathLine.classed("flash-delay", false);
      pathLine.attr("stroke", airlineColors[d.Reporting_Airline]);
    }, 2000);
  }
  const airplane = displayedRoutes.append("text")
  .text("✈️")
  .attr("font-size", "30px")
  .attr("class", "animated-plane")
  .attr("transform", `translate(${from[0]},${from[1]}) rotate(0)`);

const totalLength = pathLine.node().getTotalLength();

airplane.transition()
  .duration(2050)
  .attrTween("transform", function() {
    return function(t) {
      const point = pathLine.node().getPointAtLength(t * totalLength);
      const ahead = pathLine.node().getPointAtLength(Math.min((t + 0.01) * totalLength, totalLength));

      const dx = ahead.x - point.x;
      const dy = ahead.y - point.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)+15;

      return `translate(${point.x},${point.y}) rotate(${angle})`;
    };
  })
  .on("end", () => airplane.remove());
}

function drawFilteredRoutes(origin, destination) {
    displayedRoutes.selectAll("path, .animated-plane").remove(); // Only remove routes + planes
selectionPins.forEach(pin => pin.remove()); // Remove pins explicitly
selectionPins = [];


  const addDropPin = (coords) => {
    const pin = displayedRoutes.append("svg:image")
      .attr("xlink:href", "assets/pin.png")
      .attr("width", 50)
      .attr("height", 50)
      .attr("class", "drop-pin")
      .attr("opacity", 0)
      .attr("filter", "url(#pin-shadow)")
      .attr("transform", `translate(${coords[0] },${coords[1] - 40}) scale(0.1)`);
      selectionPins.push(pin); // Add this after each pin is created in drawFilteredRoutes

    pin.transition()
      .duration(500)
      .attr("transform", `translate(${coords[0]-20 },${coords[1] -80}) scale(1.2)`)
      .transition()
      .duration(200)
      .attr("transform", `translate(${coords[0]-24  },${coords[1] -44}) scale(1)`)
      .attr("opacity", 1);
  };

  const originCoords = projection([+airportCoords[origin][0], +airportCoords[origin][1]]);
  const destCoords = projection([+airportCoords[destination][0], +airportCoords[destination][1]]);
  addDropPin(originCoords);
  addDropPin(destCoords);
  
  const matches = fullData.filter(d =>
    (d.Origin === origin && d.Dest === destination) ||
    (d.Origin === destination && d.Dest === origin)
  );

  const grouped = {};
  matches.forEach(d => {
    const key = d.Reporting_Airline;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(+d.avg_delay);
  });

  const reduced = {};
  for (const airline in grouped) {
    const delays = grouped[airline];
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    reduced[airline] = {
      Origin: origin,
      Dest: destination,
      Reporting_Airline: airline,
      origin_lat: airportCoords[origin][1],
      origin_lng: airportCoords[origin][0],
      destination_lat: airportCoords[destination][1],
      destination_lng: airportCoords[destination][0],
      avg_delay: avg
    };
  }

  const airlines = Object.entries(reduced).sort((a, b) => b[1].avg_delay - a[1].avg_delay);
  airlines.forEach(([airline, d], i) => {
    const thickness = [15, 8, 3][i];
    const isMaxDelay = i === 0;
    drawPath(d, i, thickness, isMaxDelay, true);
  });
}

d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
  const states = topojson.feature(us, us.objects.states);
  g.selectAll("path")
    .data(states.features)
    .enter()
    .append("path")
    .attr("fill", "#d3e2f3")
    .attr("stroke", "#fff")
    .attr("d", path);
  drawAirports();
  d3.csv("data/delay_ranked_routes_d3_ready.csv").then(data => {
    fullData = data;
  });
});
})();
function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const interval = 50;
    const maxTries = timeout / interval;
    let tries = 0;

    const check = () => {
      const el = document.querySelector(selector);
      if (el) resolve(el);
      else if (++tries > maxTries) reject(new Error("Element not found: " + selector));
      else setTimeout(check, interval);
    };

    check();
  });
}

waitForElement("#instruction-card").then(() => {
  const card = document.getElementById("instruction-card");
  const closeBtn = document.getElementById("close-instruction");

  closeBtn.addEventListener("click", () => {
    card.style.display = "none";
  });
});
function applySvgTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  d3.select("#route-map")
    .style("background-color", isDark ? "#222" : "white");

  d3.selectAll("#route-map text")
    .style("fill", isDark ? "#black" : "#black");

  d3.selectAll("#route-map circle")
    .style("fill", isDark ? "#purple" : "#purple");
    // Optional: Change path (state fill) color
  d3.selectAll("#route-map path")
    .style("fill", isDark ? "#lightblue" : "#cce4ff") // Adjust this for base land color
    .style("stroke", isDark ? "#black" : "#black");
}

// Call this in vis1.js after rendering route-map elements
applySvgTheme();

// Also call it on dark mode toggle
document.querySelector("button[onclick='toggleDarkMode()']")
  .addEventListener("click", applySvgTheme);
