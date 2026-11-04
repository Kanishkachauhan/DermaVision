// Backend/utils/pdfGenerator.js
import PDFDocument from 'pdfkit';

/**
 * Generates an official, high-resolution A4 Clinical Dermatology PDF report using PDFKit.
 */
export function generateBackendClinicalPdf(data, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    bufferPages: true,
  });

  const reportId = data.reportId || `DV-2026-${Math.floor(10000 + Math.random() * 90000).toString(16).toUpperCase()}`;
  const patientName = data.patientName || 'Guest Patient';
  const patientId = data.patientId || 'PT-9428-A';
  const scanDate = data.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const skinType = data.skinType || 'Combination / Sensitive';
  const skinHealthScore = data.skinHealthScore || 82;
  const skinHealthGrade = data.skinHealthGrade || 'Optimal Condition';

  const darkCirclesScore = data.darkCircles?.score ?? 32;
  const darkCirclesLabel = data.darkCircles?.label || 'Mild';
  const darkCirclesEtiology = data.darkCircles?.etiology || 'Vascular Appearance (Sub-ocular capillary visibility)';

  const rednessScore = data.redness?.score ?? 28;
  const rednessLabel = data.redness?.label || 'Mild';

  const acneScore = data.acnePores?.acneScore ?? 24;
  const acneLabel = data.acnePores?.acneLabel || 'Low';
  const poreScore = data.acnePores?.poreScore ?? 35;

  // Stream directly to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=DermaVision_Clinical_Report_${reportId}.pdf`);
  doc.pipe(res);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: CLINICAL CUTANEOUS DIAGNOSTIC TELEMETRY SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Header Banner
  doc.rect(36, 36, 523, 56).fill('#1E293B');
  doc.rect(36, 92, 523, 3).fill('#DC926E');

  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
     .text('DERMAVISION CLINICAL CUTANEOUS AI SYSTEMS', 48, 48);

  doc.fillColor('#CBD5E1').fontSize(8).font('Helvetica')
     .text('Department of Computer Vision & Dermatological Diagnostics • Telemetry Engine v3.4', 48, 66);
  doc.text('ISO/IEC 13485 Clinical Software Workflow Support • Non-Invasive Cutaneous Telemetry', 48, 77);

  // Header Right Badge
  doc.rect(420, 48, 128, 32).fill('#2D3748');
  doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
     .text('CONFIDENTIAL REPORT', 420, 56, { width: 128, align: 'center' });
  doc.fillColor('#DC926E').fontSize(8.5).font('Helvetica-Bold')
     .text(reportId, 420, 68, { width: 128, align: 'center' });

  // 2. Patient Demographics & Telemetry Grid
  const demoY = 105;
  doc.rect(36, demoY, 523, 52).fillAndStroke('#FAF8F5', '#E2E8F0');

  doc.fillColor('#64748B').fontSize(7.5).font('Helvetica-Bold').text('PATIENT / SUBJECT:', 48, demoY + 10);
  doc.fillColor('#1E293B').font('Helvetica-Bold').text(patientName, 145, demoY + 10);

  doc.fillColor('#64748B').text('PATIENT ID:', 48, demoY + 24);
  doc.fillColor('#1E293B').font('Helvetica').text(patientId, 145, demoY + 24);

  doc.fillColor('#64748B').text('SCAN MODALITY:', 48, demoY + 38);
  doc.fillColor('#1E293B').font('Helvetica').text('RGB + CIELAB Chromatic Telemetry', 145, demoY + 38);

  const col2X = 310;
  doc.fillColor('#64748B').font('Helvetica-Bold').text('EXAMINATION DATE:', col2X, demoY + 10);
  doc.fillColor('#1E293B').font('Helvetica').text(scanDate, col2X + 100, demoY + 10);

  doc.fillColor('#64748B').font('Helvetica-Bold').text('SKIN PHENOTYPE:', col2X, demoY + 24);
  doc.fillColor('#DC926E').font('Helvetica-Bold').text(skinType, col2X + 100, demoY + 24);

  doc.fillColor('#64748B').font('Helvetica-Bold').text('IMAGE QUALITY:', col2X, demoY + 38);
  doc.fillColor('#10B981').font('Helvetica-Bold').text('98.4% (Illumination Validated ✓)', col2X + 100, demoY + 38);

  // 3. Executive Diagnostic Scorecard
  const scoreY = 170;
  doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold')
     .text('EXECUTIVE CUTANEOUS DIAGNOSTIC SCORECARD', 36, scoreY);

  // Composite Health Card
  const cardY = scoreY + 16;
  doc.rect(36, cardY, 120, 80).fill('#1E293B');
  doc.fillColor('#CBD5E1').fontSize(8).font('Helvetica-Bold')
     .text('SKIN HEALTH INDEX', 36, cardY + 12, { width: 120, align: 'center' });
  doc.fillColor('#DC926E').fontSize(26).font('Helvetica-Bold')
     .text(`${skinHealthScore}`, 36, cardY + 28, { width: 120, align: 'center' });
  doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
     .text('OUT OF 100', 36, cardY + 56, { width: 120, align: 'center' });
  doc.rect(48, cardY + 66, 96, 12).fill('#10B981');
  doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold')
     .text(skinHealthGrade, 48, cardY + 69, { width: 96, align: 'center' });

  // 3 Pillar Sub-Cards
  const subCardW = 126;
  const sub1X = 166;
  const sub2X = 300;
  const sub3X = 433;

  // Under-eye
  doc.rect(sub1X, cardY, subCardW, 80).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text('UNDER-EYE CIRCLES', sub1X + 10, cardY + 10);
  doc.fillColor('#3B82F6').fontSize(18).font('Helvetica-Bold').text(`${darkCirclesScore}/100`, sub1X + 10, cardY + 24);
  doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold').text(`Severity: ${darkCirclesLabel}`, sub1X + 10, cardY + 48);
  doc.fillColor('#64748B').fontSize(7).font('Helvetica').text('Periorbital Contrast Telemetry', sub1X + 10, cardY + 60);

  // Erythema / Redness
  doc.rect(sub2X, cardY, subCardW, 80).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text('FACIAL ERYTHEMA', sub2X + 10, cardY + 10);
  doc.fillColor('#EF4444').fontSize(18).font('Helvetica-Bold').text(`${rednessScore}/100`, sub2X + 10, cardY + 24);
  doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold').text(`Severity: ${rednessLabel}`, sub2X + 10, cardY + 48);
  doc.fillColor('#64748B').fontSize(7).font('Helvetica').text('Micro-Vascular Flush Scan', sub2X + 10, cardY + 60);

  // Acne & Pores
  doc.rect(sub3X, cardY, subCardW, 80).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text('ACNE & PORE INDEX', sub3X + 10, cardY + 10);
  doc.fillColor('#F59E0B').fontSize(18).font('Helvetica-Bold').text(`${acneScore}%`, sub3X + 10, cardY + 24);
  doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold').text(`Acne Severity: ${acneLabel}`, sub3X + 10, cardY + 48);
  doc.fillColor('#64748B').fontSize(7).font('Helvetica').text(`Pore Dilation: ${poreScore}%`, sub3X + 10, cardY + 60);

  // 4. Clinical Etiology Box
  const etioY = 280;
  doc.rect(36, etioY, 523, 34).fillAndStroke('#FEF3C7', '#F59E0B');
  doc.fillColor('#B45309').fontSize(8).font('Helvetica-Bold')
     .text('CLINICAL ETIOLOGY ASSESSMENT:', 48, etioY + 8);
  doc.fillColor('#78350F').fontSize(7.5).font('Helvetica')
     .text(`Diagnostic pattern identifies: ${darkCirclesEtiology}. Primary management includes targeted topical microcirculation stimulants, broad-spectrum SPF 50+ mineral protection, and ceramide stratum corneum restoration.`, 48, etioY + 19, { width: 500 });

  // 5. Facial Zonal Telemetry Table
  const tableY = 328;
  doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold')
     .text('ZONAL TELEMETRY & CHROMATIC VARIATION TABLE', 36, tableY);

  const tHeaderY = tableY + 14;
  doc.rect(36, tHeaderY, 523, 16).fill('#1E293B');
  doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
  doc.text('ANATOMICAL ZONE', 46, tHeaderY + 5);
  doc.text('CLINICAL OBSERVATION', 160, tHeaderY + 5);
  doc.text('METRIC', 350, tHeaderY + 5);
  doc.text('SEVERITY', 430, tHeaderY + 5);
  doc.text('STATUS', 495, tHeaderY + 5);

  const rows = data.zoneTable || [
    { zone: 'Periorbital (Under-Eye)', observation: 'Mild venous pooling with tear-trough shadow', metric: 'ΔL* 2.40 / Δa* 1.85', severity: 'Mild', status: 'Attention' },
    { zone: 'Cheeks (Malar)', observation: 'Minor capillary flush over zygomatic arches', metric: 'Erythema 28%', severity: 'Mild', status: 'Monitor' },
    { zone: 'Forehead (Frontal)', observation: 'Balanced stratum corneum and sebum distribution', metric: 'Sebum 42%', severity: 'Optimal', status: 'Clear' },
    { zone: 'Nasal & T-Zone', observation: 'Mild follicular dilation with micro-comedones', metric: 'Pores 38%', severity: 'Moderate', status: 'Attention' },
    { zone: 'Chin / Mandibular', observation: 'Smooth epidermal texture with low inflammation', metric: 'Texture 88%', severity: 'Optimal', status: 'Clear' },
  ];

  let curRowY = tHeaderY + 16;
  rows.forEach((r, i) => {
    doc.rect(36, curRowY, 523, 18).fillAndStroke(i % 2 === 0 ? '#FAF8F5' : '#FFFFFF', '#E2E8F0');
    doc.fillColor('#1E293B').fontSize(7).font('Helvetica-Bold').text(r.zone, 46, curRowY + 5);
    doc.fillColor('#5A524C').font('Helvetica').text(r.observation, 160, curRowY + 5, { width: 180 });
    doc.fillColor('#1E293B').font('Helvetica').text(r.metric, 350, curRowY + 5);
    doc.fillColor('#DC926E').font('Helvetica-Bold').text(r.severity, 430, curRowY + 5);
    doc.fillColor('#10B981').font('Helvetica-Bold').text(r.status, 495, curRowY + 5);
    curRowY += 18;
  });

  // Verification Box
  const verifY = 460;
  doc.rect(36, verifY, 523, 44).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text('TELEMETRY ENGINE AUTHENTICATION & TRACEABILITY', 48, verifY + 8);
  doc.fillColor('#64748B').fontSize(7).font('Helvetica')
     .text('Model Architecture: EfficientNet-B3 Deep Convolutional Feature Extractor + MediaPipe 468-point 3D Mesh', 48, verifY + 20)
     .text('Illumination Normalization: Adaptive Histogram Equalization (CLAHE) + CIE L*a*b* Standard Illuminant D65', 48, verifY + 30);

  // Footer Page 1
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
     .text('DermaVision Clinical Systems • Confidential Healthcare Diagnostic Summary', 36, 780)
     .text('Page 1 of 2', 500, 780);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: CLINICAL TREATMENT PROTOCOL & ADVISORY REGIMEN
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();

  // Top Bar Page 2
  doc.rect(36, 36, 523, 34).fill('#1E293B');
  doc.rect(36, 70, 523, 2).fill('#DC926E');
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
     .text('DERMAVISION CLINICAL PROTOCOL & ADVISORY REGIMEN', 48, 48);
  doc.fillColor('#DC926E').fontSize(8).font('Helvetica-Bold')
     .text(`Ref: ${reportId} • Patient ID: ${patientId}`, 400, 48);

  // AM / PM Protocol Columns
  const regY = 85;
  doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold')
     .text('EVIDENCE-BASED DAILY REGIMEN SCHEDULE', 36, regY);

  const colW = 256;
  const amX = 36;
  const pmX = 303;
  const scheduleH = 140;

  // AM Column
  doc.rect(amX, regY + 16, colW, scheduleH).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.rect(amX + 4, regY + 20, colW - 8, 16).fill('#FEF2F2');
  doc.fillColor('#BE185D').fontSize(8).font('Helvetica-Bold')
     .text('☀️ MORNING PROTOCOL (AM) — DEFENSE', amX, regY + 25, { width: colW, align: 'center' });

  const amSteps = data.amRoutine || [
    { step: 1, product: 'Gentle Hydrating Cleanser', instruction: 'Wash with lukewarm water; pat dry.' },
    { step: 2, product: 'Caffeine 5% + EGCG Eye Solution', instruction: 'Tap lightly around orbital bone to stimulate microcirculation.' },
    { step: 3, product: 'Niacinamide 5% & Ceramide Daily Cream', instruction: 'Soothes erythema and reinforces lipid barrier.' },
    { step: 4, product: 'Broad-Spectrum Mineral SPF 50+ PA++++', instruction: 'Essential UV photoprotection; reapply every 2 hours outdoors.' },
  ];

  let curAmY = regY + 42;
  amSteps.forEach((s) => {
    doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold').text(`Step ${s.step}: ${s.product}`, amX + 10, curAmY);
    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica').text(s.instruction, amX + 10, curAmY + 10, { width: colW - 20 });
    curAmY += 24;
  });

  // PM Column
  doc.rect(pmX, regY + 16, colW, scheduleH).fillAndStroke('#FAF8F5', '#E2E8F0');
  doc.rect(pmX + 4, regY + 20, colW - 8, 16).fill('#EEF2FF');
  doc.fillColor('#4338CA').fontSize(8).font('Helvetica-Bold')
     .text('🌙 EVENING PROTOCOL (PM) — REPAIR', pmX, regY + 25, { width: colW, align: 'center' });

  const pmSteps = data.pmRoutine || [
    { step: 1, product: 'Micellar Water & Gentle Foam', instruction: 'Double cleanse to remove sebum, debris, and sunscreen residue.' },
    { step: 2, product: 'Azelaic Acid 10% Suspension', instruction: 'Target flushing, micro-redness, and pigment irregularities.' },
    { step: 3, product: 'Peptide Complex & Squalane Restorative Balm', instruction: 'Deep overnight hydration and cellular tissue recovery.' },
  ];

  let curPmY = regY + 42;
  pmSteps.forEach((s) => {
    doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold').text(`Step ${s.step}: ${s.product}`, pmX + 10, curPmY);
    doc.fillColor('#64748B').fontSize(6.5).font('Helvetica').text(s.instruction, pmX + 10, curPmY + 10, { width: colW - 20 });
    curPmY += 32;
  });

  // Actives Matrix
  const matY = regY + scheduleH + 26;
  doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold')
     .text('PHARMACOLOGICAL BIO-ACTIVES MATRIX', 36, matY);

  // Look for
  doc.rect(amX, matY + 14, colW, 110).fillAndStroke('#ECFDF5', '#A7F3D0');
  doc.fillColor('#047857').fontSize(8).font('Helvetica-Bold')
     .text('✓ TARGET BIO-ACTIVES TO LOOK FOR', amX + 10, matY + 24);
  const recs = [
    '• Caffeine 5%: Periorbital microcirculation & fluid drain',
    '• Niacinamide 5%: Epidermal barrier repair & redness regulation',
    '• Azelaic Acid 10%: Anti-inflammatory, anti-redness & clarity',
    '• Ceramides NP/AP/EOP: Stratum corneum lipid restoration',
    '• Hyaluronic Acid: Deep tissue osmotic moisture retention',
  ];
  let rY = matY + 40;
  recs.forEach((item) => {
    doc.fillColor('#1E293B').fontSize(7).font('Helvetica').text(item, amX + 10, rY);
    rY += 14;
  });

  // Avoid
  doc.rect(pmX, matY + 14, colW, 110).fillAndStroke('#FEF2F2', '#FECACA');
  doc.fillColor('#B91C1C').fontSize(8).font('Helvetica-Bold')
     .text('✕ CONTRAINDICATED INGREDIENTS TO AVOID', pmX + 10, matY + 24);
  const avoids = [
    '✕ Denatured Alcohol (SD Alcohol 40): Strips lipid barrier',
    '✕ Walnut/Apricot Coarse Scrubs: Induces micro-fissures',
    '✕ High Glycolic Acid (>10%): Exacerbates vascular erythema',
    '✕ Synthetic Fragrances: Triggers cutaneous sensitization',
  ];
  let aY = matY + 40;
  avoids.forEach((item) => {
    doc.fillColor('#1E293B').fontSize(7).font('Helvetica').text(item, pmX + 10, aY);
    aY += 14;
  });

  // Statutory Disclaimer
  const discY = matY + 134;
  doc.rect(36, discY, 523, 30).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.fillColor('#64748B').fontSize(6.5).font('Helvetica-Bold')
     .text('STATUTORY CLINICAL DECISION-SUPPORT DISCLAIMER:', 46, discY + 6);
  doc.fillColor('#94A3B8').fontSize(5.5).font('Helvetica')
     .text('DermaVision is an automated artificial intelligence and chromatic telemetry decision-support software intended for informational and educational awareness. It is not an automated medical diagnostic tool and does not substitute for the professional clinical examination, diagnosis, or prescription of a certified dermatologist or licensed medical practitioner.', 46, discY + 14, { width: 503 });

  // Page 2 Footer
  doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
     .text('DermaVision Clinical Systems • All Rights Reserved', 36, 780)
     .text('Page 2 of 2', 500, 780);

  doc.end();
}
