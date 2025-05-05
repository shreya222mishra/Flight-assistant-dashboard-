'use strict';

(async () => {
  const svg = d3.select("#map");
  const tooltip = d3.select("#tooltip");
  const chartContainer = d3.select("body").append("div")
    .attr("id", "chart-popup")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("border-radius", "6px")
    .style("box-shadow", "0 2px 12px rgba(0,0,0,0.15)")
    .style("display", "none");

  const lineColors = { AA: "#8a41ff", DL: "#358cff", UA: "#e44cbe" };
  const delayData = await d3.json("data/monthly_airport_delay_probabilities.json");
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  window.showLineChart = function(airportCode, clickX, clickY) {
    const airportData = delayData[airportCode];
    if (!airportData) return;

    chartContainer.html("");
    const width = 500, height = 500;
    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const allMonths = d3.range(1, 13);
    const allDelays = [].concat(
      airportData["AA"].probabilities,
      airportData["DL"].probabilities,
      airportData["UA"].probabilities
    );

    // Ensure popup stays within bounds
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const popupX = Math.min(screenW - width - 40, Math.max(20, clickX));
    const popupY = Math.min(screenH - height - 40, Math.max(20, clickY));

    chartContainer
      .style("display", "block")
      .style("left", `${popupX}px`)
      .style("top", `${popupY}px`);

    chartContainer.append("h4")
      .text(`Probability of Delays for ${airportCode}`)
      .style("margin-bottom", "10px")
      .style("font-size", "16px");

    const chartSvg = chartContainer.append("svg")
      .attr("width", width)
      .attr("height", height);

    const xScale = d3.scaleLinear().domain([1, 12]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allDelays)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const xAxis = g => g.attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(12).tickFormat(d => monthLabels[d - 1]));

    const yAxis = g => g.attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${Math.round(d * 100)}%`));

    // Grid lines
    chartSvg.append("g")
      .attr("class", "grid")

      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(12).tickSize(-height + margin.top + margin.bottom).tickFormat(""));

    chartSvg.append("g")
      .attr("class", "grid")
      
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-width + margin.left + margin.right).tickFormat(""));

    chartSvg.append("g").call(xAxis);
    chartSvg.append("g").call(yAxis);

    const line = d3.line()
      .x((d, i) => xScale(allMonths[i]))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);

    for (const airline of ["AA", "DL", "UA"]) {
      const data = airportData[airline].probabilities;

      const path = chartSvg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", lineColors[airline])
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("stroke-dasharray", function() {
          const totalLength = this.getTotalLength();
          return `${totalLength} ${totalLength}`;
        })
        .attr("stroke-dashoffset", function() {
          return this.getTotalLength();
        });

      path.transition()
        .duration(2500)
        .ease(d3.easeSinInOut)
        .attr("stroke-dashoffset", 0);

      const totalLength = path.node().getTotalLength();
      const emoji = chartSvg.append("text")
        .text("✈️")
        .attr("font-size", "16px")
        .attr("class", "plane");

      emoji.transition()
        .duration(2500)
        .attrTween("transform", () => t => {
          const p = path.node().getPointAtLength(t * totalLength);
          const a = path.node().getPointAtLength(Math.min((t + 0.01) * totalLength, totalLength));
          const angle = Math.atan2(a.y - p.y, a.x - p.x) * 180 / Math.PI;
          return `translate(${p.x},${p.y}) rotate(${angle})`;
        })
        .on("end", () => emoji.remove());

      chartSvg.selectAll(`.dot-${airline}`)
        .data(data)
        .enter()
        .append("circle")
        .attr("class", `dot-${airline}`)
        .attr("cx", (d, i) => xScale(allMonths[i]))
        .attr("cy", d => yScale(d))
        .attr("r", 4)
        .attr("fill", lineColors[airline]);
    }

    // Legend
    const legendData = [
      { label: "American", color: "#8a41ff" },
      { label: "Delta", color: "#358cff" },
      { label: "United", color: "#e44cbe" }
    ];
    const legend = chartSvg.append("g")
      .attr("class", "chart-legend")
      .attr("transform", `translate(${width - 100}, 20)`);

    legend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 30)
      .attr("y", (d, i) => i * 22)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color);

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 50)
      .attr("y", (d, i) => i * 22 + 9)
      .text(d => d.label)
      .style("font-size", "12px")
      .attr("fill", "#333");

    setTimeout(() => {
      document.addEventListener("click", function handleOutsideClick(e) {
        const popup = document.getElementById("chart-popup");
        if (popup && popup.style.display === "block" && !popup.contains(e.target)) {
          popup.style.display = "none";
          document.removeEventListener("click", handleOutsideClick);
        }
      });
    }, 0);
  };

  svg.on("click", () => {
    chartContainer.style("display", "block");
  });
})();
