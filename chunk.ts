  // Main D3 Rendering & Simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || !isVisible) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const safeW = Math.max(dimensions.width, 600);
    const safeH = Math.max(dimensions.height, 500);

    // Zoom setup
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        updateMinimap(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g').attr('class', 'main-canvas');

    const clusterRegionsGroup = g.append('g').attr('class', 'cluster-regions');
    const clusterBridgesGroup = g.append('g').attr('class', 'cluster-bridges');
    const linksGroup = g.append('g').attr('class', 'links');
    const nodesGroup = g.append('g').attr('class', 'nodes');
    const clusterLabelsGroup = g.append('g').attr('class', 'cluster-labels');

    // 1. Cluster Region Hulls
    const clusterHulls = clusterRegionsGroup.selectAll('path')
      .data(clusters)
      .join('path')
      .attr('fill', d => d.bgFill)
      .attr('stroke', d => d.borderColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3')
      .attr('opacity', 0.85)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        zoomToCluster(d.id);
      });

    // 2. Cluster Macro Bridges (Overview cross-connections)
    const clusterById = new Map<string, ClusterInfo>();
    clusters.forEach(c => clusterById.set(c.id, c));

    clusterBridgesGroup.selectAll('path')
      .data(clusterBridges)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#2563EB')
      .attr('stroke-width', d => Math.min(4.5, 1.5 + Math.log2(d.count + 1)))
      .attr('stroke-dasharray', '5,4')
      .attr('stroke-opacity', 0.4)
      .attr('d', d => {
        const c1 = clusterById.get(d.sourceClusterId);
        const c2 = clusterById.get(d.targetClusterId);
        if (!c1 || !c2) return '';
        const mx = (c1.x + c2.x) / 2;
        const my = (c1.y + c2.y) / 2 - 25;
        return `M${c1.x},${c1.y} Q${mx},${my} ${c2.x},${c2.y}`;
      });

    // Filter displayed links & clone with clean string IDs for D3
    const activeLinks = showOnlyCrossConnections ? links.filter(l => l.isCrossCluster) : links;
    const simLinks = activeLinks.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
      target: typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
    }));

    // 3. Item Links
    const link = linksGroup.selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', d => d.isCrossCluster ? '#2563EB' : '#CBD5E1')
      .attr('stroke-width', d => d.isCrossCluster ? 1.6 : 0.8)
      .attr('stroke-opacity', d => d.isCrossCluster ? 0.65 : 0.25)
      .attr('stroke-dasharray', d => d.isCrossCluster ? '3,2' : 'none');

    // 4. Force Simulation (High-Performance Config: limited distance & iterations, fast alpha decay)
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('cluster', (alpha: number) => {
        for (const d of nodes) {
          const c = clusterById.get(d.clusterId);
          if (!c) continue;
          d.vx = (d.vx || 0) + (c.x - (d.x || c.x)) * alpha * 0.22;
          d.vy = (d.vy || 0) + (c.y - (d.y || c.y)) * alpha * 0.22;
        }
      })
      .force('link', d3.forceLink<GraphNode, typeof simLinks[0]>(simLinks)
        .id(d => d.id)
        .distance(d => d.isCrossCluster ? 110 : 40)
        .strength(d => d.isCrossCluster ? 0.08 : 0.25)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => -25 - d.crossConnectionsCount * 5)
        .distanceMax(220)
        .theta(0.9)
      )
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.val + 8).iterations(1))
      .alphaDecay(0.065)
      .alphaMin(0.006);

    simulationRef.current = simulation;
    setIsSimulationPaused(false);

    // Initial position for cluster hulls & badges
    clusterHulls.attr('d', d => {
      const r = Math.max(55, Math.sqrt(d.count) * 26);
      return `M ${d.x - r},${d.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    });

    // 5. Cluster Header Badges (Pre-calculated dimensions - NO getBBox!)
    const clusterLabels = clusterLabelsGroup.selectAll('g')
      .data(clusters)
      .join('g')
      .attr('class', 'cluster-header')
      .attr('transform', d => {
        const r = Math.max(55, Math.sqrt(d.count) * 26);
        return `translate(${d.x},${d.y - r - 12})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        zoomToCluster(d.id);
      });

    clusterLabels.each(function (d) {
      const gEl = d3.select(this);
      const labelText = `${d.name} (${d.count})`;
      const w = Math.max(70, labelText.length * 6.8 + 20);
      const h = 22;

      gEl.append('rect')
        .attr('x', -w / 2)
        .attr('y', -h / 2)
        .attr('width', w)
        .attr('height', h)
        .attr('rx', 11)
        .attr('ry', 11)
        .attr('fill', '#FFFFFF')
        .attr('stroke', d.borderColor)
        .attr('stroke-width', 1.5)
        .attr('filter', 'drop-shadow(0px 1px 2px rgba(0,0,0,0.06))');

      gEl.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', '10.5px')
        .attr('font-weight', '700')
        .attr('fill', d.color)
        .text(labelText);
    });

    // 6. Node Elements
    const node = nodesGroup.selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.15).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      });

    // Cross-connected node outer ring
    node.append('circle')
      .attr('r', d => d.val + (d.crossConnectionsCount > 0 ? 3.5 : 0))
      .attr('fill', 'none')
      .attr('stroke', '#2563EB')
      .attr('stroke-width', d => d.crossConnectionsCount > 0 ? 1.5 : 0)
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.85);

    // Node body circle
    node.append('circle')
      .attr('r', d => d.val)
      .attr('fill', d => {
        const c = clusterById.get(d.clusterId);
        if (d.type === 'wiki') return '#8B5CF6';
        if (d.type === 'note') return '#F97316';
        return c ? c.color : '#2563EB';
      })
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.8);

    // Node text
    node.append('text')
      .text(d => d.name.length > 24 ? d.name.substring(0, 22) + '…' : d.name)
      .attr('x', d => d.val + 5)
      .attr('y', 3.5)
      .attr('font-size', '9.5px')
      .attr('font-weight', d => (d.type === 'wiki' || d.crossConnectionsCount > 1) ? '700' : '500')
      .attr('fill', '#1F2937')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .attr('paint-order', 'stroke');

    // 7. Simulation Tick Handler (Silky smooth: ONLY updates lines and transforms!)
    simulation.on('tick', () => {
      link
        .attr('x1', d => (typeof d.source === 'object' ? (d.source as GraphNode).x : 0) || 0)
        .attr('y1', d => (typeof d.source === 'object' ? (d.source as GraphNode).y : 0) || 0)
        .attr('x2', d => (typeof d.target === 'object' ? (d.target as GraphNode).x : 0) || 0)
        .attr('y2', d => (typeof d.target === 'object' ? (d.target as GraphNode).y : 0) || 0);

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Update hulls and labels once when layout settles smoothly
    simulation.on('end', () => {
      clusterHulls.attr('d', d => {
        const clusterNodes = nodes.filter(n => n.clusterId === d.id);
        if (clusterNodes.length <= 2) {
          const r = Math.max(55, Math.sqrt(d.count) * 26);
          return `M ${d.x - r},${d.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
        }

        const points: [number, number][] = clusterNodes.map(n => [
          typeof n.x === 'number' && !isNaN(n.x) ? n.x : d.x,
          typeof n.y === 'number' && !isNaN(n.y) ? n.y : d.y
        ]);

        const hull = d3.polygonHull(points);
        if (!hull || hull.length < 3) {
          const r = Math.max(55, Math.sqrt(d.count) * 26);
          return `M ${d.x - r},${d.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
        }

        const line = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed.alpha(0.5));
        return line(hull) || '';
      });

      clusterLabels.attr('transform', d => {
        const clusterNodes = nodes.filter(n => n.clusterId === d.id);
        let cy = d.y - 45;
        let cx = d.x;
        if (clusterNodes.length > 0) {
          cx = d3.mean(clusterNodes, n => n.x || 0) || d.x;
          const minY = d3.min(clusterNodes, n => n.y || 0) || d.y;
          cy = minY - 24;
        }
        return `translate(${cx},${cy})`;
      });
    });

    // Fit view initially
    zoomToCluster(null);

    return () => {
      simulation.stop();
    };
  }, [nodes, links, clusters, clusterBridges, showOnlyCrossConnections, dimensions, zoomToCluster, isVisible, updateMinimap]);

  // Minimap Base Setup
  useEffect(() => {
    if (!minimapSvgRef.current || clusters.length === 0) return;
    const miniSvg = d3.select(minimapSvgRef.current);
    miniSvg.selectAll('*').remove();

    const miniW = 160;
    const miniH = 110;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    clusters.forEach(c => {
      minX = Math.min(minX, c.x - 100);
      maxX = Math.max(maxX, c.x + 100);
      minY = Math.min(minY, c.y - 100);
      maxY = Math.max(maxY, c.y + 100);
    });

    const dx = Math.max(10, maxX - minX);
    const dy = Math.max(10, maxY - minY);
    const miniScale = Math.min(miniW / dx, miniH / dy) * 0.85;

    const toMiniX = (x: number) => (x - minX) * miniScale + (miniW - dx * miniScale) / 2;
    const toMiniY = (y: number) => (y - minY) * miniScale + (miniH - dy * miniScale) / 2;

    // Mini cluster circles
    clusters.forEach(c => {
      miniSvg.append('circle')
        .attr('cx', toMiniX(c.x))
        .attr('cy', toMiniY(c.y))
        .attr('r', Math.max(4, Math.min(12, Math.sqrt(c.count) * 2.5)))
        .attr('fill', c.color)
        .attr('opacity', 0.6);
    });

    // Viewport box
    miniSvg.append('rect')
      .attr('class', 'minimap-vp')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', miniW)
      .attr('height', miniH)
      .attr('fill', 'rgba(37, 99, 235, 0.12)')
      .attr('stroke', '#2563EB')
      .attr('stroke-width', 1.2)
      .attr('rx', 2);
  }, [clusters]);

  // Highlight search or selection
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const searchLower = searchTerm.trim().toLowerCase();

    svg.selectAll<SVGGElement, GraphNode>('.node')
      .transition()
      .duration(150)
      .attr('opacity', d => {
        if (selectedNode) {
          if (d.id === selectedNode.id) return 1;
          const isConnected = links.some(l => 
            (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode.id &&
            (typeof l.target === 'object' ? l.target.id : l.target) === d.id ||
            (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode.id &&
            (typeof l.source === 'object' ? l.source.id : l.source) === d.id
          );
          return isConnected ? 0.9 : 0.15;
        }

        if (hoveredNode) {
          if (d.id === hoveredNode.id) return 1;
          const isConnected = links.some(l => 
            (typeof l.source === 'object' ? l.source.id : l.source) === hoveredNode.id &&
            (typeof l.target === 'object' ? l.target.id : l.target) === d.id ||
            (typeof l.target === 'object' ? l.target.id : l.target) === hoveredNode.id &&
            (typeof l.source === 'object' ? l.source.id : l.source) === d.id
          );
          return isConnected ? 1 : 0.25;
        }

        if (!searchLower) return 1;
        const matches = d.name.toLowerCase().includes(searchLower) ||
          (d.bookmark.tags && d.bookmark.tags.some(t => t.toLowerCase().includes(searchLower))) ||
          (d.bookmark.folders && d.bookmark.folders.some(f => f.toLowerCase().includes(searchLower)));
        return matches ? 1 : 0.18;
      });
  }, [searchTerm, selectedNode, hoveredNode, links]);

  // Connected cross connections for selected node
  const selectedNodeCrossLinks = useMemo(() => {
    if (!selectedNode) return [];
    return links.filter(l => 
      l.isCrossCluster && (
        (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode.id ||
        (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode.id
      )
    );
  }, [selectedNode, links]);

