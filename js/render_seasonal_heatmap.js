'use strict';

(async () => {
  const svg = d3.select("#map");

  const projection = d3.geoAlbersUsa().translate([window.innerWidth / 2, window.innerHeight / 2]).scale(1800);
  const path = d3.geoPath().projection(projection);
  const tooltip = d3.select("#tooltip");

  let selectedMonth = "1";
  let selectedAirline = "AA";
console.log("render_seasonal_heatmap loaded")
  const airportCoords = {
    ATL: [-84.4277, 33.6407], LAX: [-118.4085, 33.9416], DFW: [-97.0403, 32.8998], DEN: [-104.6737, 39.8561],
    ORD: [-87.9073, 41.9742], JFK: [-73.7781, 40.6413], MCO: [-81.3081, 28.4312], LAS: [-115.1523, 36.0801],
    CLT: [-80.9431, 35.214], MIA: [-80.2906, 25.7959], SEA: [-122.3088, 47.4502], EWR: [-74.1745, 40.6895],
    PHX: [-112.0116, 33.4342], SFO: [-122.3790, 37.6213], IAH: [-95.3414, 29.9902], BOS: [-71.0052, 42.3656],
    DTW: [-83.3534, 42.2121], PHL: [-75.2411, 39.8719], SLC: [-111.9791, 40.7899], BWI: [-76.6684, 39.1754],
    DCA: [-77.0377, 38.8512], SAN: [-117.1973, 32.7338], AUS: [-97.6699, 30.1945], TPA: [-82.5333, 27.9755],
    BNA: [-86.6782, 36.1263]
  };
  const airportNames = {
    ATL: "Atlanta",
    LAX: "Los Angeles",
    DFW: "Dallas",
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
  const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");

  svg.append("g")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter()
    .append("path")
    .attr("fill", "#f0f0f0")
    .attr("stroke", "#aaa")
    .attr("d", path);

  const pinGroup = svg.append("g").attr("class", "pins");

  // ✨ Single global color scale
  const colorScale = d3.scaleDiverging(d3.interpolateRdYlBu)
    .domain([0.3, 0.15, 0]); // high, mid, low delay

  function updatePins() {
    pinGroup.selectAll("*").remove();
    Object.entries(airportCoords).forEach(([code, coords]) => {
      const [x, y] = projection(coords);
      const delayProb = seasonalDelays[code]?.[selectedMonth]?.[selectedAirline] || 0;

      pinGroup.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 16)
        .attr("fill", colorScale(delayProb))
        .attr("stroke", "#444")
        .attr("stroke-width", 1.5)
        .on("mouseover", function(event) {
          tooltip.style("opacity", 1)
            .html(`<strong>${airportNames[code]}</strong><br/>${(delayProb * 100).toFixed(1)}% delayed`)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY - 24) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", function(event) {
          const [x, y] = projection(coords);
          showLineChart(code, x, y);
        });
    });
  }

  function updateColorLegend() {
    const colorLegendSvg = d3.select("#color-legend");
  
    // Recalculate dynamic domain based on selected data
    const allDelayProbs = Object.values(seasonalDelays)
      .map(airport => airport[selectedMonth]?.[selectedAirline] || 0);
  
    const maxDelayProb = d3.max(allDelayProbs);
    const minDelayProb = d3.min(allDelayProbs);
  
    // Define new domain dynamically
    const newDomain = [maxDelayProb, (maxDelayProb + minDelayProb) / 2, minDelayProb];
  
    // Create new scale
    const legendScale = d3.scaleLinear()
      .domain(newDomain)
      .range([500, 15]);
  
    const legendAxis = d3.axisRight(legendScale)
      .ticks(8)
      .tickFormat(d => `${Math.round(d * 100)}%`);
  
    // Clear old axis
    colorLegendSvg.selectAll(".axis").remove();
  
    // Draw new axis
    colorLegendSvg.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(40,-3)")
      .call(legendAxis);
  }
  

  // 🎯 Hook up controls
  d3.select("#month-slider").on("input", function() {
    selectedMonth = this.value;
    updatePins();
    updateColorLegend();
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    d3.select("#month-value").text(months[selectedMonth - 1]);
  });

  d3.selectAll("input[name='airline']").on("change", function() {
    selectedAirline = this.value;
    updatePins();
    updateColorLegend();
  });

  updatePins();
  updateColorLegend();
})();
const closeBtn = document.getElementById("close-instruction");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    const card = document.getElementById("instruction-card");
    if (card) card.style.display = "none";
  });
  console.log("render_seasonal_heatmap loaded end")
}
