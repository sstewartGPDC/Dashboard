// ─── Export Functions (What You See Is What You Export) ──────────────

// Dynamic fiscal year: Georgia FY runs July 1 – June 30
function getCurrentFY() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0=Jan, 6=Jul)
  return month >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}
function getFYLabel() { return `FY${String(getCurrentFY()).slice(2)}`; }
function getFYRange() { const fy = getCurrentFY(); return `FY${String(fy).slice(2)} (July 1, ${fy - 1} – June 30, ${fy})`; }

// Export branding header/footer for wrapped exports
function _exportHeader(title) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<div style="padding:0.875rem 1.5rem;border-bottom:1px solid #e5e2dd;display:flex;align-items:center;justify-content:space-between;background:#fff;">
    <div style="display:flex;align-items:center;gap:0.75rem;">
      <img src="https://cdn.prod.website-files.com/66c9595206b0d169d1677e69/66e9df4a3e925a89e1be2971_BlackGold%20-%20SYMBOL%20MARK.png" alt="GPDC" style="height:32px;width:auto;">
      <div>
        <div style="font-size:0.625rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#B85C38;margin-bottom:2px;">Georgia Public Defender Council</div>
        <div style="font-family:'Ubuntu',sans-serif;font-size:1rem;font-weight:500;color:#1a1a1a;">${title || 'Dashboard Export'}</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:0.625rem;color:#6b6b6b;">${today}</div>
      <div style="font-size:0.5625rem;color:#B85C38;font-weight:600;">${getFYLabel()}</div>
    </div>
  </div>`;
}

function _exportFooter() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<div style="padding:0.625rem 1.5rem;border-top:1px solid #e5e2dd;display:flex;justify-content:space-between;align-items:center;background:#fff;">
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <img src="https://cdn.prod.website-files.com/66c9595206b0d169d1677e69/66e9df4a3e925a89e1be2971_BlackGold%20-%20SYMBOL%20MARK.png" alt="GPDC" style="height:16px;width:auto;">
      <span style="font-size:0.6875rem;font-weight:600;color:#1a1a1a;">Georgia Public Defender Council</span>
    </div>
    <div style="font-size:0.5625rem;color:#999;">Generated ${today} &bull; ${getFYRange()}</div>
  </div>`;
}

// Auto-detect which view is active and export it
function exportCurrentView(format, customTitle) {
  const dashboardView = $("viewDashboard");
  const circuitsView = $("viewCircuits");
  const mapView = $("viewMap");

  if (dashboardView && !dashboardView.classList.contains("hidden")) {
    exportDashboardView(format, customTitle);
  } else if (circuitsView && circuitsView.classList.contains("active")) {
    exportCircuitView(format, customTitle);
  } else if (mapView && mapView.classList.contains("active")) {
    exportMapView(format, customTitle);
  } else {
    // Fallback: export dashboard
    exportDashboardView(format, customTitle);
  }
}

// Export the Dashboard view (KPIs + charts)
function exportDashboardView(format, customTitle) {
  const source = $("viewDashboard");
  if (!source || typeof html2canvas === 'undefined') return;

  const title = customTitle || 'Dashboard Export';

  // Create an offscreen wrapper with branding
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px;background:#fff;font-family:"Manrope",-apple-system,sans-serif;';

  // Header
  wrapper.innerHTML = _exportHeader(title);

  // Clone dashboard content (only visible elements)
  const content = document.createElement('div');
  content.style.cssText = 'padding:1.5rem;';

  // Clone KPI grids
  ['overviewKpis', 'secondaryKpis'].forEach(id => {
    const grid = $(id);
    if (!grid) return;
    const clone = grid.cloneNode(true);
    // Remove hidden cards
    clone.querySelectorAll('.kpi-card').forEach(card => {
      if (card.style.display === 'none') card.remove();
    });
    if (clone.children.length > 0) {
      content.appendChild(clone);
      clone.style.marginBottom = '1rem';
    }
  });

  // Clone chart panels
  const chartsSection = $('dashboardChartsSection');
  if (chartsSection) {
    const chartsClone = chartsSection.cloneNode(true);
    // Remove hidden chart panels and empty rows
    chartsClone.querySelectorAll('.chart-panel').forEach(panel => {
      if (panel.style.display === 'none') panel.remove();
    });
    chartsClone.querySelectorAll('.charts-row').forEach(row => {
      if (row.style.display === 'none' || row.children.length === 0) row.remove();
    });
    content.appendChild(chartsClone);
  }

  wrapper.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.innerHTML = _exportFooter();
  wrapper.appendChild(footer.firstElementChild);

  document.body.appendChild(wrapper);

  const scale = 1.5;
  html2canvas(wrapper, { scale, backgroundColor: '#fff', useCORS: true, logging: false }).then(canvas => {
    wrapper.remove();
    _downloadCanvas(canvas, format, `GPDC_${getFYLabel()}_Dashboard`);
  }).catch(() => wrapper.remove());
}

// Export the Circuit Breakdown view (reuses existing table report pages)
function exportCircuitView(format, customTitle) {
  if (format === 'png') {
    exportTablePNG();
  } else {
    exportTablePDF();
  }
}

// Export the Map view
function exportMapView(format, customTitle) {
  const mapContainer = $("viewMap");
  if (!mapContainer || typeof html2canvas === 'undefined') return;

  const title = customTitle || 'Circuit Map';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px;background:#fff;font-family:"Manrope",-apple-system,sans-serif;';
  wrapper.innerHTML = _exportHeader(title);

  const mapClone = mapContainer.cloneNode(true);
  mapClone.style.cssText = 'padding:1rem;';
  // Force the map div to have a height
  const mapDiv = mapClone.querySelector('#map');
  if (mapDiv) {
    mapDiv.style.height = '600px';
    mapDiv.style.borderRadius = '12px';
  }
  wrapper.appendChild(mapClone);

  const footer = document.createElement('div');
  footer.innerHTML = _exportFooter();
  wrapper.appendChild(footer.firstElementChild);

  document.body.appendChild(wrapper);

  // For map, we capture the actual visible map element instead
  const actualMap = document.querySelector('#map');
  if (!actualMap) { wrapper.remove(); return; }

  const mapWrapper = document.createElement('div');
  mapWrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px;background:#fff;font-family:"Manrope",-apple-system,sans-serif;';
  mapWrapper.innerHTML = _exportHeader(title);

  const mapFrame = document.createElement('div');
  mapFrame.style.cssText = 'padding:1rem;';
  mapWrapper.appendChild(mapFrame);

  const footerEl = document.createElement('div');
  footerEl.innerHTML = _exportFooter();
  mapWrapper.appendChild(footerEl.firstElementChild);

  // We'll capture the real map + brand wrapper
  wrapper.remove();

  html2canvas(actualMap, { scale: 1.5, backgroundColor: '#fff', useCORS: true, logging: false }).then(mapCanvas => {
    // Build a final canvas with header + map + footer
    const headerWrapper = document.createElement('div');
    headerWrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:1100px;background:#fff;font-family:"Manrope",-apple-system,sans-serif;';
    headerWrapper.innerHTML = _exportHeader(title) + '<div style="padding:1rem;"><img id="_mapImg" style="width:100%;border-radius:12px;"></div>' + _exportFooter();
    document.body.appendChild(headerWrapper);
    const img = headerWrapper.querySelector('#_mapImg');
    img.src = mapCanvas.toDataURL('image/png');
    img.onload = () => {
      html2canvas(headerWrapper, { scale: 1.5, backgroundColor: '#fff', useCORS: true, logging: false }).then(finalCanvas => {
        headerWrapper.remove();
        _downloadCanvas(finalCanvas, format, `GPDC_${getFYLabel()}_Map`);
      }).catch(() => headerWrapper.remove());
    };
  }).catch(() => {});
}

// Shared download helper
function _downloadCanvas(canvas, format, filenameBase) {
  const dateStr = new Date().toISOString().split('T')[0];
  if (format === 'pdf' && typeof window.jspdf !== 'undefined') {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const imgW = canvas.width;
    const imgH = canvas.height;
    const pdfW = 215.9; // Letter width mm
    const pdfH = (imgH * pdfW) / imgW;
    const pdf = new jsPDF({
      orientation: pdfH > pdfW ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfW, Math.min(pdfH, 279.4)]
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    pdf.save(`${filenameBase}_${dateStr}.pdf`);
  } else {
    const link = document.createElement('a');
    link.download = `${filenameBase}_${dateStr}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.85);
    link.click();
  }
}

// --- Column Toggle ---
$("colToggleBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  $("colToggleWrap").classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (!$("colToggleWrap").contains(e.target)) $("colToggleWrap").classList.remove("open");
});
$("colToggleMenu").querySelectorAll('input[data-col]').forEach(cb => {
  cb.addEventListener("change", function() {
    tableColVisible[parseInt(this.dataset.col)] = this.checked;
    applyColumnVisibility();
  });
});

// --- Table Export (PNG / PDF) ---
// --- Report page builder for 8.5x11 Letter ---
// Letter at 96dpi = 816x1056px. We use that as our page canvas.
