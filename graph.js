// WiseWays Enhanced Frontend with Clickable Connections
let svg, gMain, gLinks, gNodes;
let graphData = { nodes: [], links: [], thinkingRooms: [] };
let selectedNode = null;
let selectedLink = null;
let currentUser = { id: 'user-' + Math.random().toString(36).substr(2, 9), name: 'Anonymous' };
let zoomBehaviour;
let currentZoom = 1;
let linkThreshold = 0.35;
let filters = { status: 'all', need: 'all', dimension: 'all' };
let currentTab = 'question';

const DIM_LABELS = ["BEING", "HAVING", "DOING", "INTERACTING", "UNKNOWN"];
const NEED_LABELS = [
  "SUBSISTENCE", "PROTECTION", "AFFECTION", "UNDERSTANDING",
  "PARTICIPATION", "CREATION", "IDENTITY", "FREEDOM", "IDLENESS", "UNKNOWN"
];

// ===== INITIALIZATION =====

function initSvg() {
  svg = d3.select("#graphSvg");
  svg.selectAll("*").remove();

  const rect = svg.node().getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  gMain = svg.append("g").attr("class", "g-main");
  gLinks = gMain.append("g").attr("class", "g-links");
  gNodes = gMain.append("g").attr("class", "g-nodes");

  zoomBehaviour = d3.zoom()
    .scaleExtent([0.4, 4])
    .on("zoom", (event) => {
      currentZoom = event.transform.k;
      gMain.attr("transform", event.transform);
      updateLabelVisibility();
      updateMinimap();
    });

  svg.call(zoomBehaviour);
  drawGrid(width, height);

  svg.on("click", () => {
    selectedNode = null;
    selectedLink = null;
    renderPanel();
    highlightSelection();
  });
}

function drawGrid(width, height) {
  const marginLeft = 80, marginRight = 40, marginTop = 40, marginBottom = 60;
  const usableW = width - marginLeft - marginRight;
  const usableH = height - marginTop - marginBottom;
  const colW = usableW / (DIM_LABELS.length - 1 || 1);
  const rowH = usableH / (NEED_LABELS.length - 1 || 1);

  gMain.selectAll(".grid-line, .axis-label").remove();

  // Vertical lines
  DIM_LABELS.forEach((dim, i) => {
    const x = marginLeft + colW * i;
    gMain.append("line")
      .attr("class", "grid-line")
      .attr("x1", x).attr("y1", marginTop)
      .attr("x2", x).attr("y2", marginTop + usableH)
      .attr("stroke", "#1f2937").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    gMain.append("text")
      .attr("class", "axis-label")
      .attr("x", x).attr("y", marginTop - 10)
      .attr("fill", "#9ca3af").attr("text-anchor", "middle")
      .style("font-size", "11px").text(dim);
  });

  // Horizontal lines
  NEED_LABELS.forEach((need, j) => {
    const y = marginTop + rowH * j;
    gMain.append("line")
      .attr("class", "grid-line")
      .attr("x1", marginLeft).attr("y1", y)
      .attr("x2", marginLeft + usableW).attr("y2", y)
      .attr("stroke", "#1f2937").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    gMain.append("text")
      .attr("class", "axis-label")
      .attr("x", marginLeft - 8).attr("y", y + 4)
      .attr("fill", "#9ca3af").attr("text-anchor", "end")
      .style("font-size", "11px").text(need);
  });
}

// ===== COLORS & STYLING =====

function fillColor(node) {
  const t = typeof node.pipelineScore === "number" ? node.pipelineScore : 0.5;
  const start = { r: 79, g: 163, b: 255 };
  const end = { r: 255, g: 221, b: 85 };
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgb(${r},${g},${b})`;
}

function strokeColor(need) {
  const colors = {
    SUBSISTENCE: "#4ad66d", PROTECTION: "#5cc1ff", AFFECTION: "#ff7aa2",
    UNDERSTANDING: "#ffc64d", PARTICIPATION: "#9a7dff", CREATION: "#ff8f42",
    IDENTITY: "#5ae0c0", FREEDOM: "#ff5757", IDLENESS: "#7bd8ff",
    UNKNOWN: "#94a3b8"
  };
  return colors[need] || colors.UNKNOWN;
}

function nodeSize(node) {
  const connections = graphData.links.filter(l => 
    l.source === node.id || l.target === node.id
  ).length;
  return 18 + Math.min(connections * 2, 16);
}

function linkColor(link) {
  if (!link.weight) return "#4b5563";
  
  // Color based on connection strength
  if (link.weight > 0.6) return "#10b981"; // Strong - green
  if (link.weight > 0.4) return "#0ea5e9"; // Medium - blue
  return "#6b7280"; // Weak - gray
}

function linkWidth(link) {
  if (!link.weight) return 1;
  return 1 + (link.weight * 3); // 1-4px based on strength
}

function dimShort(dim) {
  return dim ? dim[0] : "U";
}

// ===== GRAPH RENDERING =====

function updateGraph() {
  if (!svg) initSvg();
  
  const rect = svg.node().getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;
  const marginLeft = 80, marginRight = 40, marginTop = 40, marginBottom = 60;
  const usableW = width - marginLeft - marginRight;
  const usableH = height - marginTop - marginBottom;

  // Filter nodes
  let visibleNodes = graphData.nodes.filter(n => {
    if (filters.status !== 'all' && n.status !== filters.status) return false;
    if (filters.need !== 'all' && n.need !== filters.need) return false;
    return true;
  });

  // Calculate positions
  visibleNodes.forEach(n => {
    const pos = n.position || { x: 0.5, y: 0.5 };
    n.x = marginLeft + pos.x * usableW;
    n.y = marginTop + pos.y * usableH;
  });

  // Filter links
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = graphData.links.filter(l => 
    visibleNodeIds.has(l.source) && 
    visibleNodeIds.has(l.target) &&
    (typeof l.weight !== 'number' || l.weight >= linkThreshold)
  );

  // Render links - MAKE THEM CLICKABLE
  const linkSel = gLinks.selectAll("line").data(visibleLinks, d => d.id);
  linkSel.exit().remove();
  
  const linkEnter = linkSel.enter()
    .append("line")
    .attr("class", "connection-link")
    .style("cursor", "pointer")
    .attr("stroke", d => linkColor(d))
    .attr("stroke-width", d => linkWidth(d))
    .attr("opacity", 0.6)
    .on("click", (event, d) => {
      event.stopPropagation();
      selectedLink = d;
      selectedNode = null;
      console.log("🔗 Link clicked:", d);
      renderPanel();
      highlightSelection();
    })
    .on("mouseenter", function(event, d) {
      if (!selectedLink || selectedLink.id !== d.id) {
        d3.select(this)
          .attr("stroke-width", linkWidth(d) + 2)
          .attr("opacity", 0.9);
      }
    })
    .on("mouseleave", function(event, d) {
      if (!selectedLink || selectedLink.id !== d.id) {
        d3.select(this)
          .attr("stroke-width", linkWidth(d))
          .attr("opacity", 0.6);
      }
    });

  linkEnter.merge(linkSel)
    .attr("x1", d => nodeById(d.source).x)
    .attr("y1", d => nodeById(d.source).y)
    .attr("x2", d => nodeById(d.target).x)
    .attr("y2", d => nodeById(d.target).y)
    .attr("stroke", d => linkColor(d))
    .attr("stroke-width", d => linkWidth(d));

  // Render nodes
  const nodeSel = gNodes.selectAll("g.node").data(visibleNodes, d => d.id);
  nodeSel.exit().remove();

  const nodeEnter = nodeSel.enter()
    .append("g")
    .attr("class", "node")
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      event.stopPropagation();
      selectedNode = d;
      selectedLink = null;
      renderPanel();
      highlightSelection();
    })
    .call(d3.drag()
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded)
    );

  nodeEnter.append("circle")
    .attr("r", d => nodeSize(d))
    .attr("fill", d => fillColor(d))
    .attr("stroke", d => strokeColor(d.need))
    .attr("stroke-width", 3)
    .attr("class", d => `node-status-${d.status}`);

  nodeEnter.append("title").text(d => d.text);

  nodeEnter.append("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("y", 4)
    .attr("fill", "#0b1120")
    .style("font-weight", "500")
    .style("font-size", "10px")
    .style("pointer-events", "none")
    .text(d => {
      const t = d.text || "";
      return t.length > 20 ? t.slice(0, 20) + "…" : t;
    });

  nodeEnter.merge(nodeSel)
    .attr("transform", d => `translate(${d.x},${d.y})`);

  updateLabelVisibility();
  highlightSelection();
  updateStats();
  updateMinimap();
}

function dragStarted(event, d) {
  d3.select(this).raise().attr("cursor", "grabbing");
}

function dragged(event, d) {
  d.x = event.x;
  d.y = event.y;
  d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
  
  // Update connected links
  gLinks.selectAll("line")
    .filter(l => l.source === d.id || l.target === d.id)
    .attr("x1", l => nodeById(l.source).x)
    .attr("y1", l => nodeById(l.source).y)
    .attr("x2", l => nodeById(l.target).x)
    .attr("y2", l => nodeById(l.target).y);
}

function dragEnded(event, d) {
  d3.select(this).attr("cursor", "pointer");
}

function updateLabelVisibility() {
  if (!gNodes) return;
  const scale = currentZoom || 1;
  gNodes.selectAll("text.node-label")
    .attr("opacity", scale >= 0.9 ? 1 : 0)
    .style("font-size", `${Math.min(11, 8 * scale)}px`);
}

function highlightSelection() {
  if (!gNodes || !gLinks) return;

  gNodes.selectAll("g.node")
    .select("circle")
    .attr("stroke-width", d => selectedNode && d.id === selectedNode.id ? 5 : 3)
    .attr("opacity", d => {
      if (!selectedNode && !selectedLink) return 1;
      if (selectedNode && d.id === selectedNode.id) return 1;
      if (selectedLink && (d.id === selectedLink.source || d.id === selectedLink.target)) return 1;
      return 0.3;
    });

  gNodes.selectAll("g.node")
    .select("text.node-label")
    .attr("opacity", d => {
      if (currentZoom < 0.9) return 0;
      if (!selectedNode && !selectedLink) return 1;
      if (selectedNode && d.id === selectedNode.id) return 1;
      if (selectedLink && (d.id === selectedLink.source || d.id === selectedLink.target)) return 1;
      return 0.3;
    })
    .style("font-weight", d => selectedNode && d.id === selectedNode.id ? "700" : "500");

  gLinks.selectAll("line")
    .attr("stroke-width", d => {
      if (selectedLink && d.id === selectedLink.id) return linkWidth(d) + 3;
      return linkWidth(d);
    })
    .attr("opacity", d => {
      if (selectedLink && d.id === selectedLink.id) return 1;
      if (selectedNode && (d.source === selectedNode.id || d.target === selectedNode.id)) return 0.9;
      if (!selectedNode && !selectedLink) return 0.6;
      return 0.15;
    })
    .attr("stroke", d => {
      if (selectedLink && d.id === selectedLink.id) return "#f59e0b";
      return linkColor(d);
    });
}

function nodeById(id) {
  return graphData.nodes.find(n => n.id === id) || { x: 0, y: 0, text: "" };
}

// ===== PANEL RENDERING =====

function renderPanel() {
  if (currentTab === 'question') renderQuestionTab();
  else if (currentTab === 'rooms') renderRoomsTab();
  else if (currentTab === 'analytics') renderAnalyticsTab();
}

function getRelationshipIcon(type) {
  const icons = {
    'problem-solution': '🔧',
    'cause-effect': '⚡',
    'dependency': '🔗',
    null: '↔️'
  };
  return icons[type] || icons[null];
}

function getStrengthLabel(weight) {
  if (weight > 0.6) return { text: 'STRONG', color: '#10b981' };
  if (weight > 0.4) return { text: 'MEDIUM', color: '#0ea5e9' };
  return { text: 'WEAK', color: '#6b7280' };
}

function renderQuestionTab() {
  const titleEl = document.getElementById("panelTitle");
  const bodyEl = document.getElementById("panelBody");
  const relatedEl = document.getElementById("panelRelated");
  const responseSection = document.getElementById("responseSection");
  const linkExplainEl = document.getElementById("panelLinkExplain");

  if (selectedNode) {
    const n = selectedNode;
    titleEl.textContent = n.text || "(question)";

    const lines = [];
    lines.push(`Need: ${n.need} • Dimension: ${n.dimension}`);
    lines.push(`Value-chain: ${Math.round((n.pipelineScore ?? 0.5) * 100)}% towards execution`);
    lines.push(`Status: ${n.status}`);
    lines.push("");
    
    // Show connections count
    const connectionsCount = graphData.links.filter(l => 
      l.source === n.id || l.target === n.id
    ).length;
    lines.push(`Connected to ${connectionsCount} other question${connectionsCount !== 1 ? 's' : ''}`);
    
    if (n.explanation) {
      lines.push("");
      lines.push("Classification reasoning:");
      lines.push(n.explanation);
    }

    bodyEl.textContent = lines.join("\n");

    // Show response section
    responseSection.style.display = 'block';
    const badge = document.getElementById("questionStatusBadge");
    badge.textContent = n.status;
    badge.className = `badge ${n.status}`;

    // Load existing response if any
    loadResponse(n.id);

    // Find related questions via links
    if (relatedEl) {
      relatedEl.innerHTML = "";
      
      const connectedLinks = graphData.links.filter(l => 
        l.source === n.id || l.target === n.id
      ).sort((a, b) => (b.weight || 0) - (a.weight || 0));

      if (!connectedLinks.length) {
        const li = document.createElement("li");
        li.textContent = "No connections yet. Add more questions to discover relationships.";
        li.style.cursor = "default";
        relatedEl.appendChild(li);
      } else {
        connectedLinks.forEach(link => {
          const otherId = link.source === n.id ? link.target : link.source;
          const q = nodeById(otherId);
          const strength = getStrengthLabel(link.weight || 0);
          const icon = getRelationshipIcon(link.relationType);
          
          const li = document.createElement("li");
          li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 18px;">${icon}</span>
              <span style="font-weight: 600; color: ${strength.color};">${strength.text}</span>
              <span style="color: #9ca3af; font-size: 11px;">${Math.round((link.weight || 0) * 100)}%</span>
            </div>
            <div style="margin-bottom: 4px;">${q.text}</div>
            <div style="color: #9ca3af; font-size: 11px;">
              ${link.reason || 'Semantic connection'}
              ${link.relationType ? ` • ${link.relationType}` : ''}
            </div>
          `;
          li.style.cursor = "pointer";
          li.onclick = () => {
            selectedNode = q;
            renderPanel();
            highlightSelection();
            
            // Zoom to node
            const transform = d3.zoomIdentity
              .translate(svg.node().getBoundingClientRect().width / 2, svg.node().getBoundingClientRect().height / 2)
              .scale(1.5)
              .translate(-q.x, -q.y);
            svg.transition().duration(750).call(zoomBehaviour.transform, transform);
          };
          relatedEl.appendChild(li);
        });
      }
    }

    linkExplainEl.innerHTML = `<span style="color: #9ca3af;">💡 Click connections on the map to see why questions are related.</span>`;

  } else if (selectedLink) {
    const l = selectedLink;
    const a = nodeById(l.source);
    const b = nodeById(l.target);
    const strength = getStrengthLabel(l.weight || 0);
    const icon = getRelationshipIcon(l.relationType);
    
    titleEl.innerHTML = `${icon} Connection Analysis`;
    
    const lines = [];
    lines.push(`CONNECTION STRENGTH: ${strength.text} (${Math.round((l.weight || 0) * 100)}%)`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("📍 QUESTION A:");
    lines.push(a.text);
    lines.push(`   ${a.need} • ${a.dimension}`);
    lines.push("");
    lines.push("📍 QUESTION B:");
    lines.push(b.text);
    lines.push(`   ${b.need} • ${b.dimension}`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    
    // WHY ARE THEY CONNECTED?
    lines.push("🔍 WHY ARE THEY CONNECTED?");
    lines.push("");
    
    if (l.reason) {
      lines.push(`• ${l.reason}`);
    }
    
    if (l.relationType) {
      lines.push(`• Relationship type: ${l.relationType}`);
    }
    
    if (l.semanticScore) {
      lines.push(`• Semantic similarity: ${Math.round(l.semanticScore * 100)}%`);
    }
    
    lines.push("");
    
    // Shared characteristics
    const shared = [];
    if (a.need === b.need) shared.push(`Same need: ${a.need}`);
    if (a.dimension === b.dimension) shared.push(`Same dimension: ${a.dimension}`);
    
    if (shared.length > 0) {
      lines.push("🎯 SHARED CHARACTERISTICS:");
      shared.forEach(s => lines.push(`• ${s}`));
      lines.push("");
    }
    
    // Complementarity
    const pipelineDiff = Math.abs((a.pipelineScore || 0.5) - (b.pipelineScore || 0.5));
    if (pipelineDiff < 0.3) {
      lines.push("⚖️ COMPLEMENTARITY:");
      lines.push("• Both questions are at similar stages in the value chain");
      lines.push("• They likely need to be addressed together");
    } else {
      lines.push("🔄 SEQUENTIAL RELATIONSHIP:");
      lines.push("• These questions are at different stages");
      if ((a.pipelineScore || 0.5) < (b.pipelineScore || 0.5)) {
        lines.push(`• "${a.text.slice(0, 40)}..." comes first (strategic)`);
        lines.push(`• "${b.text.slice(0, 40)}..." follows (execution)`);
      } else {
        lines.push(`• "${b.text.slice(0, 40)}..." comes first (strategic)`);
        lines.push(`• "${a.text.slice(0, 40)}..." follows (execution)`);
      }
    }
    
    bodyEl.textContent = lines.join("\n");
    responseSection.style.display = 'none';
    if (relatedEl) relatedEl.innerHTML = "";
    linkExplainEl.innerHTML = `
      <div style="background: #0f172a; border: 1px solid #1f2937; border-radius: 6px; padding: 12px; margin-top: 16px;">
        <strong style="color: #0ea5e9;">💡 Insight:</strong>
        <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 12px;">
          This connection was discovered through semantic analysis. 
          ${l.weight > 0.5 ? 'The strong connection suggests these questions should be explored together.' : 
            'Consider if these questions influence each other in your context.'}
        </p>
      </div>
    `;

  } else {
    titleEl.textContent = "Select a question or connection";
    bodyEl.textContent = `Click elements on the map to explore:

🔵 QUESTIONS (bubbles)
   • View details
   • Answer questions
   • See related questions

🔗 CONNECTIONS (lines)
   • Understand relationships
   • See why questions are linked
   • Discover insights

💡 TIP: Connections are colored by strength:
   Green = Strong relationship
   Blue = Medium relationship
   Gray = Weak relationship`;
    responseSection.style.display = 'none';
    if (relatedEl) relatedEl.innerHTML = "";
    linkExplainEl.innerHTML = `<span style="color: #9ca3af;">Click connections to understand relationships between questions.</span>`;
  }
}

async function loadResponse(questionId) {
  try {
    const responses = await j(`/api/responses/question/${questionId}`);
    const textarea = document.getElementById("responseText");
    if (responses.length > 0) {
      textarea.value = responses[0].answer;
    } else {
      textarea.value = "";
    }
  } catch (e) {
    console.error("Failed to load response:", e);
  }
}

async function saveResponse() {
  if (!selectedNode) return;
  
  const textarea = document.getElementById("responseText");
  const answer = textarea.value.trim();
  
  if (!answer) {
    alert("Please enter an answer");
    return;
  }
  
  try {
    await j("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: selectedNode.id,
        userId: currentUser.id,
        answer,
        metadata: { timestamp: Date.now() }
      })
    });
    
    // Update node status
    selectedNode.status = 'answered';
    await j(`/api/questions/${selectedNode.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: 'answered' })
    });
    
    await loadGraph();
    alert("Answer saved successfully!");
  } catch (e) {
    console.error("Failed to save response:", e);
    alert("Failed to save answer");
  }
}

function renderRoomsTab() {
  const roomsList = document.getElementById("roomsList");
  const searchBox = document.getElementById("roomSearch");
  
  if (!graphData.thinkingRooms || graphData.thinkingRooms.length === 0) {
    roomsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💡</div>
        <p>No thinking rooms yet.</p>
        <p style="font-size: 11px;">Rooms are created automatically when questions are strongly connected.</p>
      </div>
    `;
    return;
  }
  
  const searchTerm = searchBox.value.toLowerCase();
  const filteredRooms = graphData.thinkingRooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm) ||
    room.theme.toLowerCase().includes(searchTerm)
  );
  
  roomsList.innerHTML = "";
  filteredRooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "room-card";
    
    const participantCount = room.participants?.length || 0;
    const questionCount = room.questionIds?.length || 0;
    
    card.innerHTML = `
      <div class="room-header">
        <div class="room-name">${room.name}</div>
        <div class="room-participants">
          👥 ${participantCount}
        </div>
      </div>
      <div class="room-theme">${room.theme}</div>
      <div class="room-questions">${questionCount} questions in this room</div>
    `;
    
    card.onclick = () => {
      // Highlight room questions
      selectedNode = null;
      selectedLink = null;
      
      // Filter to show only room questions
      const roomQuestionIds = new Set(room.questionIds);
      graphData.nodes.forEach(n => {
        n.inCurrentRoom = roomQuestionIds.has(n.id);
      });
      
      updateGraph();
      
      // Join room
      joinRoom(room.id);
    };
    
    roomsList.appendChild(card);
  });
}

async function joinRoom(roomId) {
  try {
    await j(`/api/thinking-rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name
      })
    });
    
    await loadGraph();
  } catch (e) {
    console.error("Failed to join room:", e);
  }
}

async function renderAnalyticsTab() {
  const content = document.getElementById("analyticsContent");
  content.innerHTML = '<div class="loading">Loading analytics...</div>';
  
  try {
    const analytics = await j("/api/analytics");
    
    content.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #1f2937;">
          <div style="font-size: 24px; font-weight: 700; color: #0ea5e9;">${analytics.totalQuestions}</div>
          <div style="font-size: 12px; color: #9ca3af;">Thinking Rooms</div>
        </div>
        <div style="background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #1f2937;">
          <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${analytics.totalLinks}</div>
          <div style="font-size: 12px; color: #9ca3af;">Connections</div>
        </div>
      </div>
      
      ${analytics.linkStrength ? `
      <div class="section-title">Connection Strength Distribution</div>
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 120px; font-size: 11px; color: #9ca3af;">Strong (>60%)</div>
          <div style="flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; background: #10b981; width: ${(analytics.linkStrength.strong / analytics.totalLinks * 100)}%;"></div>
          </div>
          <div style="width: 40px; text-align: right; font-size: 12px; color: #f9fafb; margin-left: 8px;">${analytics.linkStrength.strong}</div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 120px; font-size: 11px; color: #9ca3af;">Medium (40-60%)</div>
          <div style="flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; background: #0ea5e9; width: ${(analytics.linkStrength.medium / analytics.totalLinks * 100)}%;"></div>
          </div>
          <div style="width: 40px; text-align: right; font-size: 12px; color: #f9fafb; margin-left: 8px;">${analytics.linkStrength.medium}</div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 120px; font-size: 11px; color: #9ca3af;">Weak (<40%)</div>
          <div style="flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; background: #6b7280; width: ${(analytics.linkStrength.weak / analytics.totalLinks * 100)}%;"></div>
          </div>
          <div style="width: 40px; text-align: right; font-size: 12px; color: #f9fafb; margin-left: 8px;">${analytics.linkStrength.weak}</div>
        </div>
      </div>
      ` : ''}
      
      <div class="section-title">Need Distribution</div>
      <div style="margin-bottom: 24px;">
        ${Object.entries(analytics.needDistribution)
          .sort((a, b) => b[1] - a[1])
          .map(([need, count]) => `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <div style="width: 120px; font-size: 11px; color: #9ca3af;">${need}</div>
              <div style="flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; background: ${strokeColor(need)}; width: ${(count / analytics.totalQuestions * 100)}%;"></div>
              </div>
              <div style="width: 40px; text-align: right; font-size: 12px; color: #f9fafb; margin-left: 8px;">${count}</div>
            </div>
          `).join('')}
      </div>
      
      <div class="section-title">Status Distribution</div>
      <div>
        ${Object.entries(analytics.statusDistribution).map(([status, count]) => `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <div style="width: 120px; font-size: 11px; color: #9ca3af;">${status}</div>
            <div style="flex: 1; height: 20px; background: #1f2937; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background: ${status === 'answered' ? '#10b981' : status === 'in-progress' ? '#f59e0b' : '#6b7280'}; width: ${(count / analytics.totalQuestions * 100)}%;"></div>
            </div>
            <div style="width: 40px; text-align: right; font-size: 12px; color: #f9fafb; margin-left: 8px;">${count}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    console.error("Failed to load analytics:", e);
    content.innerHTML = '<div class="empty-state"><p>Failed to load analytics</p></div>';
  }
}

// ===== MINIMAP =====

function updateMinimap() {
  const canvas = document.getElementById("minimapCanvas");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.offsetWidth * 2;
  const height = canvas.height = canvas.offsetHeight * 2;
  
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);
  
  // Draw nodes
  graphData.nodes.forEach(n => {
    const pos = n.position || { x: 0.5, y: 0.5 };
    const x = pos.x * width;
    const y = pos.y * height;
    
    ctx.fillStyle = fillColor(n);
    ctx.globalAlpha = n === selectedNode ? 1 : 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
  
  ctx.globalAlpha = 1;
}

// ===== STATS =====

function updateStats() {
  document.getElementById("statQuestions").textContent = graphData.nodes.length;
  document.getElementById("statAnswered").textContent = 
    graphData.nodes.filter(n => n.status === 'answered').length;
  document.getElementById("statRooms").textContent = 
    (graphData.thinkingRooms || []).length;
}

// ===== API HELPERS =====

async function j(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

async function loadGraph() {
  try {
    const g = await j("/api/graph");
    graphData = g;
    console.log("📊 Graph loaded:", {
      nodes: g.nodes.length,
      links: g.links.length,
      rooms: g.thinkingRooms.length
    });
    updateGraph();
    renderPanel();
  } catch (e) {
    console.error("Failed to load graph:", e);
  }
}

// ===== EVENT HANDLERS =====

async function handleAddQuestion() {
  const input = document.getElementById("qInput");
  if (!input) return;
  
  const text = (input.value || "").trim();
  if (!text) return;
  
  input.value = "";
  
  try {
    const question = await j("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    
    console.log("✅ Question added:", question);
    
    await loadGraph();
  } catch (e) {
    console.error(e);
    alert("Could not add question.");
  }
}

async function handleReset() {
  if (!confirm("Reset all data?")) return;
  
  try {
    await j("/api/reset", { method: "POST" });
    await loadGraph();
  } catch (e) {
    console.error(e);
  }
}

async function handleSeedDemo() {
  try {
    await j("/api/seed-demo", { method: "POST" });
    await loadGraph();
  } catch (e) {
    console.error(e);
    alert("Seed failed");
  }
}

function handleLinkThresholdChange(value) {
  linkThreshold = Number(value);
  document.getElementById("linkThresholdValue").textContent = value;
  updateGraph();
}

function handleFilterChange(filterType, value) {
  filters[filterType] = value;
  
  // Update button states
  document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
  
  updateGraph();
}

function switchTab(tabName) {
  currentTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabName + 'Tab');
  });
  
  renderPanel();
}

// ===== GUIDED MODE =====

let guidedModeQuestions = [];
let guidedModeIndex = 0;

function startGuidedMode() {
  // Get unanswered questions sorted by pipeline score (strategic first)
  guidedModeQuestions = graphData.nodes
    .filter(n => n.status !== 'answered')
    .sort((a, b) => (a.pipelineScore || 0.5) - (b.pipelineScore || 0.5));
  
  if (guidedModeQuestions.length === 0) {
    alert("All questions have been answered!");
    return;
  }
  
  guidedModeIndex = 0;
  showGuidedModal();
  displayGuidedQuestion();
}

function showGuidedModal() {
  const modal = document.getElementById("guidedModal");
  modal.classList.add("active");
}

function closeGuidedModal() {
  const modal = document.getElementById("guidedModal");
  modal.classList.remove("active");
}

function displayGuidedQuestion() {
  if (guidedModeIndex >= guidedModeQuestions.length) {
    const content = document.getElementById("guidedContent");
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <h3 style="color: #10b981; margin: 16px 0;">Congratulations!</h3>
        <p>You've completed all questions in this guided flow.</p>
        <button onclick="closeGuidedModal()" style="margin-top: 16px;">Close</button>
      </div>
    `;
    
    // Update progress bar
    const progressBar = document.getElementById("guidedProgress");
    progressBar.style.width = "100%";
    return;
  }
  
  const question = guidedModeQuestions[guidedModeIndex];
  const progress = ((guidedModeIndex + 1) / guidedModeQuestions.length) * 100;
  
  // Update progress bar
  const progressBar = document.getElementById("guidedProgress");
  progressBar.style.width = progress + "%";
  
  // Display question
  const content = document.getElementById("guidedContent");
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">
        Question ${guidedModeIndex + 1} of ${guidedModeQuestions.length}
      </div>
      <h3 style="color: #f9fafb; margin: 0 0 8px 0; font-size: 16px;">${question.text}</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <span class="badge" style="background: ${strokeColor(question.need)}; color: white;">${question.need}</span>
        <span class="badge" style="background: #374151; color: #9ca3af;">${question.dimension}</span>
      </div>
      <div style="font-size: 12px; color: #9ca3af; margin-bottom: 16px;">
        ${Math.round((question.pipelineScore || 0.5) * 100)}% towards execution
      </div>
    </div>
    
    <div style="background: #0f172a; border: 1px solid #1f2937; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
      <label style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 8px;">Your Answer</label>
      <textarea id="guidedAnswerText" 
                placeholder="Type your answer here..." 
                style="width: 100%; min-height: 150px; padding: 10px; border-radius: 6px; border: 1px solid #1f2937; background: #020720; color: #f9fafb; font-size: 13px; font-family: inherit; resize: vertical;"></textarea>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: space-between;">
      <button class="ghost" onclick="skipGuidedQuestion()" ${guidedModeIndex === 0 ? 'style="visibility: hidden;"' : ''}>
        Skip for now
      </button>
      <div style="display: flex; gap: 8px;">
        <button class="ghost" onclick="previousGuidedQuestion()" ${guidedModeIndex === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        <button onclick="saveGuidedAnswer()">
          ${guidedModeIndex === guidedModeQuestions.length - 1 ? 'Complete' : 'Next →'}
        </button>
      </div>
    </div>
  `;
  
  // Highlight current question on map
  selectedNode = question;
  highlightSelection();
  
  // Zoom to question
  if (svg && question.x && question.y) {
    const rect = svg.node().getBoundingClientRect();
    const transform = d3.zoomIdentity
      .translate(rect.width / 2, rect.height / 2)
      .scale(1.5)
      .translate(-question.x, -question.y);
    svg.transition().duration(500).call(zoomBehaviour.transform, transform);
  }
}

async function saveGuidedAnswer() {
  const textarea = document.getElementById("guidedAnswerText");
  const answer = textarea.value.trim();
  
  if (!answer) {
    alert("Please enter an answer or skip this question");
    return;
  }
  
  const question = guidedModeQuestions[guidedModeIndex];
  
  try {
    // Save response
    await j("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        userId: currentUser.id,
        answer,
        metadata: { 
          timestamp: Date.now(),
          guidedMode: true 
        }
      })
    });
    
    // Update question status
    await j(`/api/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: 'answered' })
    });
    
    // Reload graph
    await loadGraph();
    
    // Move to next question
    guidedModeIndex++;
    displayGuidedQuestion();
    
  } catch (e) {
    console.error("Failed to save answer:", e);
    alert("Failed to save answer. Please try again.");
  }
}

function skipGuidedQuestion() {
  guidedModeIndex++;
  displayGuidedQuestion();
}

function previousGuidedQuestion() {
  if (guidedModeIndex > 0) {
    guidedModeIndex--;
    displayGuidedQuestion();
  }
}

// ===== SEARCH FUNCTIONALITY =====

function setupSearch() {
  const searchBox = document.getElementById("roomSearch");
  if (searchBox) {
    searchBox.addEventListener("input", () => {
      if (currentTab === 'rooms') {
        renderRoomsTab();
      }
    });
  }
}

// ===== KEYBOARD SHORTCUTS =====

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // ESC - deselect
    if (e.key === "Escape") {
      selectedNode = null;
      selectedLink = null;
      renderPanel();
      highlightSelection();
    }
    
    // Enter in question input
    if (e.key === "Enter" && document.activeElement === document.getElementById("qInput")) {
      handleAddQuestion();
    }
    
    // Tab navigation (Ctrl/Cmd + 1/2/3)
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '3') {
      e.preventDefault();
      const tabs = ['question', 'rooms', 'analytics'];
      switchTab(tabs[parseInt(e.key) - 1]);
    }
    
    // Guided mode (Ctrl/Cmd + G)
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      startGuidedMode();
    }
  });
}

// ===== INITIALIZATION =====

function initUI() {
  const addBtn = document.getElementById("addBtn");
  const input = document.getElementById("qInput");
  const resetBtn = document.getElementById("resetBtn");
  const seedBtn = document.getElementById("seedBtn");
  const linkSlider = document.getElementById("linkThreshold");
  const guidedModeBtn = document.getElementById("guidedModeBtn");
  const closeGuidedBtn = document.getElementById("closeGuidedModal");
  const saveResponseBtn = document.getElementById("saveResponseBtn");
  const cancelResponseBtn = document.getElementById("cancelResponseBtn");

  if (addBtn) addBtn.addEventListener("click", handleAddQuestion);
  
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAddQuestion();
    });
  }
  
  if (resetBtn) resetBtn.addEventListener("click", handleReset);
  if (seedBtn) seedBtn.addEventListener("click", handleSeedDemo);
  
  if (linkSlider) {
    linkSlider.value = linkThreshold;
    linkSlider.addEventListener("input", (e) => handleLinkThresholdChange(e.target.value));
  }
  
  if (guidedModeBtn) {
    guidedModeBtn.addEventListener("click", startGuidedMode);
  }
  
  if (closeGuidedBtn) {
    closeGuidedBtn.addEventListener("click", closeGuidedModal);
  }
  
  if (saveResponseBtn) {
    saveResponseBtn.addEventListener("click", saveResponse);
  }
  
  if (cancelResponseBtn) {
    cancelResponseBtn.addEventListener("click", () => {
      document.getElementById("responseText").value = "";
    });
  }

  // Tab switching
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      const value = btn.dataset.value;
      handleFilterChange(filterType, value);
    });
  });

  // Window resize
  window.addEventListener("resize", () => {
    initSvg();
    updateGraph();
  });
  
  setupSearch();
  setupKeyboardShortcuts();
}

// ===== AUTO-REFRESH FOR THINKING ROOMS =====

let autoRefreshInterval = null;

function startAutoRefresh() {
  // Refresh every 10 seconds to check for new participants in rooms
  autoRefreshInterval = setInterval(async () => {
    if (currentTab === 'rooms') {
      try {
        const g = await j("/api/graph");
        graphData.thinkingRooms = g.thinkingRooms;
        renderRoomsTab();
      } catch (e) {
        console.error("Auto-refresh failed:", e);
      }
    }
  }, 10000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// ===== START APPLICATION =====

window.addEventListener("load", async () => {
  console.log("🚀 WiseWays Enhanced starting...");
  
  initSvg();
  initUI();
  
  await loadGraph();
  
  startAutoRefresh();
  
  console.log("✅ WiseWays Enhanced ready!");
  console.log("💡 Tip: Press Ctrl+G for guided mode, Ctrl+1/2/3 to switch tabs");
  console.log("🔗 Tip: Click connections (lines) to see relationship explanations");
});

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  stopAutoRefresh();
});