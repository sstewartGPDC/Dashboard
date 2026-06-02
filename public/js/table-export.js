const RPT_W = 816;
const RPT_H = 1056;
const RPT_PAD = 40; // page margins

function _rptColVisible() {
  return { 1: tableColVisible[1], 2: tableColVisible[2], 3: tableColVisible[3], 4: tableColVisible[4], 5: tableColVisible[5], 6: false };
}

function _rptThRow(rcv) {
  const headers = [fieldLabel('total_cases'), fieldLabel('conflict_new_cases'), fieldLabel('state_attorneys_filled').replace(/\s*\(Filled\)/, ''), fieldLabel('county_attorneys'), 'Total Atty', ''];
  const ths = headers.map((h, i) => rcv[i + 1] ? `<th style="text-align:right;padding:6px 10px;font-size:0.55rem;font-weight:700;color:#B85C38;text-transform:uppercase;letter-spacing:0.08em;background:#f5f3f0;border-bottom:2px solid #e5e2dd;white-space:nowrap;">${h}</th>` : '').join('');
  return `<tr><th style="text-align:left;padding:6px 10px;font-size:0.55rem;font-weight:700;color:#B85C38;text-transform:uppercase;letter-spacing:0.08em;background:#f5f3f0;border-bottom:2px solid #e5e2dd;">Circuit</th>${ths}</tr>`;
}

function _rptDataRow(c, idx, rcv) {
  const m = CIRCUIT_METRICS.get(c.circuit) || { totalCases:0,newCases:0,closed:0,stateFilled:0,countyAttorneys:0,conflict:{newCases:0,totalContractors:0} };
  const ta = m.stateFilled + m.countyAttorneys;
  const cv = m.countyAttorneys === 0 ? '*' : fmt(m.countyAttorneys);
  const cells = [fmt(m.totalCases), fmt(m.conflict.newCases), fmt(m.stateFilled), cv, fmt(ta), ''];
  const bg = idx % 2 === 0 ? '#fff' : '#f8f6f4';
  return `<tr style="background:${bg};"><td style="font-weight:600;padding:5px 10px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:0.7rem;">${c.circuit}</td>${cells.map((v,i) => rcv[i+1] ? `<td style="text-align:right;font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;padding:5px 10px;border-bottom:1px solid #eee;color:#1a1a1a;font-size:0.7rem;${v==='*'?'color:#B85C38;font-weight:700;font-size:0.8rem;':''}">${v}</td>`:'' ).join('')}</tr>`;
}

function _rptHeader(today) {
  return `<div style="padding:0.75rem 1.25rem;border-bottom:1px solid #e5e2dd;display:flex;align-items:center;justify-content:space-between;background:#fff;">
    <div style="display:flex;align-items:center;gap:0.625rem;">
      <img src="https://cdn.prod.website-files.com/66c9595206b0d169d1677e69/66e9df4a3e925a89e1be2971_BlackGold%20-%20SYMBOL%20MARK.png" alt="GPDC" style="height:28px;width:auto;">
      <div>
        <div style="font-size:0.6rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#B85C38;margin-bottom:1px;">Georgia Public Defender Council</div>
        <div style="font-family:'Ubuntu',sans-serif;font-size:0.95rem;font-weight:500;color:#1a1a1a;">Circuit Breakdown</div>
      </div>
    </div>
    <div style="text-align:right;font-size:0.6rem;color:#6b6b6b;">${today}</div>
  </div>`;
}

function _rptFooter(today, pageNum, totalPages) {
  return `<div style="padding:0.5rem 1.25rem;border-top:1px solid #e5e2dd;display:flex;justify-content:space-between;align-items:center;background:#fff;position:absolute;bottom:0;left:0;right:0;">
    <div style="display:flex;align-items:center;gap:0.4rem;">
      <img src="https://cdn.prod.website-files.com/66c9595206b0d169d1677e69/66e9df4a3e925a89e1be2971_BlackGold%20-%20SYMBOL%20MARK.png" alt="GPDC" style="height:14px;width:auto;">
      <span style="font-size:0.6rem;font-weight:600;color:#1a1a1a;">Georgia Public Defender Council</span>
    </div>
    <div style="font-size:0.5rem;color:#999;">Page ${pageNum} of ${totalPages} &bull; Generated ${today}</div>
  </div>`;
}

function buildTableReportPages() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const fc = getFilteredCircuits();
  const agg = aggregateMetrics(fc);
  const totalAtty = agg.stateFilled + agg.countyAttorneys;
  const rcv = _rptColVisible();

  // Page 1 has header + KPIs + disclaimer + table start → fits ~25 rows
  // Page 2+ has header + table continuation → fits ~35 rows
  const ROWS_PAGE1 = 25;
  const ROWS_CONTINUATION = 35;

  const allRows = fc.map((c, i) => _rptDataRow(c, i, rcv));
  const page1Rows = allRows.slice(0, ROWS_PAGE1);
  const remainingRows = allRows.slice(ROWS_PAGE1);

  const contPages = [];
  for (let i = 0; i < remainingRows.length; i += ROWS_CONTINUATION) {
    contPages.push(remainingRows.slice(i, i + ROWS_CONTINUATION));
  }

  const totalPages = 1 + contPages.length;
  const pageStyle = `width:${RPT_W}px;height:${RPT_H}px;background:#fff;position:relative;overflow:hidden;font-family:'Manrope',-apple-system,sans-serif;`;

  // --- Page 1 ---
  const page1 = `<div class="rpt-page" style="${pageStyle}">
    ${_rptHeader(today)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #e5e2dd;background:#f5f3f0;">
      <div style="padding:0.75rem 1rem;text-align:center;border-right:1px solid #e5e2dd;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:#1a1a1a;line-height:1;">${fmt(fc.length)}</div>
        <div style="font-size:0.5rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-top:3px;">Circuits</div>
      </div>
      <div style="padding:0.75rem 1rem;text-align:center;border-right:1px solid #e5e2dd;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:#B85C38;line-height:1;">${fmt(agg.totalCases)}</div>
        <div style="font-size:0.5rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-top:3px;">${fieldLabel('total_cases')}</div>
      </div>
      <div style="padding:0.75rem 1rem;text-align:center;border-right:1px solid #e5e2dd;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:#1a1a1a;line-height:1;">${fmt(agg.stateFilled)}</div>
        <div style="font-size:0.5rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-top:3px;">${fieldLabel('state_attorneys_filled').replace(/\s*\(Filled\)/, '')}</div>
      </div>
      <div style="padding:0.75rem 1rem;text-align:center;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:1.125rem;font-weight:700;color:#1a1a1a;line-height:1;">${fmt(agg.countyAttorneys)}</div>
        <div style="font-size:0.5rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-top:3px;">${fieldLabel('county_attorneys')}</div>
      </div>
    </div>
    <div style="padding:0.5rem 1rem;background:#fffbeb;border-bottom:1px solid #fde68a;display:flex;gap:0.4rem;align-items:flex-start;font-size:0.8125rem;line-height:1.45;color:#78350f;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e6a23c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div>Georgia's <strong>hybrid defender system</strong> separates attorney staffing between the state and the circuit counties. Counties individually fund positions depending on resources and local factors. The Central Office is unable to access each county's employees and budget data — <strong>some county attorney numbers are incomplete</strong>. <strong>*</strong> indicates incomplete county data.</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>${_rptThRow(rcv)}</thead>
      <tbody>${page1Rows.join('')}</tbody>
    </table>
    ${_rptFooter(today, 1, totalPages)}
  </div>`;

  // --- Continuation pages ---
  const contPagesHTML = contPages.map((rows, pi) => `<div class="rpt-page" style="${pageStyle}">
    ${_rptHeader(today)}
    <table style="width:100%;border-collapse:collapse;">
      <thead>${_rptThRow(rcv)}</thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    ${_rptFooter(today, pi + 2, totalPages)}
  </div>`).join('');

  return page1 + contPagesHTML;
}

function exportTablePNG() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;';
  wrapper.innerHTML = buildTableReportPages();
  document.body.appendChild(wrapper);
  const pages = wrapper.querySelectorAll('.rpt-page');
  if (!pages.length || typeof html2canvas === 'undefined') { wrapper.remove(); return; }

  // Capture all pages and stitch vertically
  const scale = 1.5;
  Promise.all([...pages].map(p => html2canvas(p, { scale, backgroundColor:'#fff', useCORS:true, logging:false }))).then(canvases => {
    wrapper.remove();
    const totalH = canvases.reduce((s, c) => s + c.height, 0);
    const w = canvases[0].width;
    const stitched = document.createElement('canvas');
    stitched.width = w;
    stitched.height = totalH;
    const ctx = stitched.getContext('2d');
    let y = 0;
    canvases.forEach(c => { ctx.drawImage(c, 0, y); y += c.height; });
    // Export as JPEG for smaller file size (quality 0.85)
    const link = document.createElement('a');
    link.download = `GPDC_Circuit_Breakdown_${new Date().toISOString().split('T')[0]}.jpg`;
    link.href = stitched.toDataURL('image/jpeg', 0.85);
    link.click();
  }).catch(() => wrapper.remove());
}

function exportTablePDF() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;';
  wrapper.innerHTML = buildTableReportPages();
  document.body.appendChild(wrapper);
  const pages = wrapper.querySelectorAll('.rpt-page');
  if (!pages.length) { wrapper.remove(); return; }

  if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
    const { jsPDF } = window.jspdf;
    const scale = 1.5;
    // Letter size: 215.9mm x 279.4mm
    const LW = 215.9;
    const LH = 279.4;

    Promise.all([...pages].map(p => html2canvas(p, { scale, backgroundColor:'#fff', useCORS:true, logging:false }))).then(canvases => {
      wrapper.remove();
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'letter' });

      canvases.forEach((canvas, i) => {
        if (i > 0) pdf.addPage('letter', 'portrait');
        // Use JPEG compression in PDF for smaller file
        const imgData = canvas.toDataURL('image/jpeg', 0.82);
        pdf.addImage(imgData, 'JPEG', 0, 0, LW, LH, undefined, 'FAST');
      });

      pdf.save(`GPDC_Circuit_Breakdown_${new Date().toISOString().split('T')[0]}.pdf`);
    }).catch(() => wrapper.remove());
  } else {
    wrapper.remove();
    const reportHTML = buildTableReportPages();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>GPDC Circuit Breakdown</title>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
      <style>@page{size:letter;margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}.rpt-page{page-break-after:always;width:8.5in;height:11in;}body{margin:0;padding:0;background:white;font-family:'Manrope',sans-serif}</style>
      </head><body>${reportHTML}
      <script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`);
    printWindow.document.close();
  }
}

// Event listeners moved to app.js
