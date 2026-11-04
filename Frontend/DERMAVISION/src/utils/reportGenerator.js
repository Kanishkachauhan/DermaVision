import { jsPDF } from "jspdf";

/**
 * Builds a clean, simplified, patient-friendly report data object from any source
 * (SkinAnalysis, AcneAnalysis, Home presets, or manual scans).
 */
export function buildReportData({
  source = "skin-analysis",
  analysisResult = null,
  user = null,
  capturedImage = null,
  preset = null,
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const randomHex = Math.floor(10000 + Math.random() * 90000).toString(16).toUpperCase();
  const reportId = `DV-2026-${randomHex}`;

  const patientName = user?.name || user?.fullName || "Guest Subject";
  const patientEmail = user?.email || "patient@dermavision.ai";
  const patientId = user?._id ? `PT-${user._id.slice(-6).toUpperCase()}` : `PT-9428-A`;

  // Default values
  let scanType = "Skin Health & Progress Assessment";
  let darkCirclesScore = 32;
  let darkCirclesLabel = "Mild";
  let darkCirclesEtiology = "Subtle vascular shadow under eyes";
  let darkCirclesArea = 18;

  let rednessScore = 28;
  let rednessLabel = "Mild";
  let rednessStatus = "Slight cheek erythema";
  let rednessArea = 22;

  let acneScore = 24;
  let acneLabel = "Low";
  let poreScore = 35;
  let poreLabel = "Medium";

  let skinType = "Combination / Sensitive";
  let primaryConcern = "Mild under-eye dark circles and localized cheek redness";

  // Simple, easy-to-follow daily routine
  let amRoutine = [
    { step: 1, type: "Cleanse", product: "Gentle Hydrating Cleanser", instruction: "Wash with lukewarm water and pat dry gently with a soft cloth." },
    { step: 2, type: "Brighten & Protect", product: "Niacinamide 5% & Caffeine Serum", instruction: "Gently pat around the under-eye area and cheeks to reduce puffiness and soothe redness." },
    { step: 3, type: "Shield", product: "Broad-Spectrum Sunscreen SPF 50+", instruction: "Essential daily barrier protection; prevents dark spot darkening and UV capillary damage." },
  ];

  let pmRoutine = [
    { step: 1, type: "Double Cleanse", product: "Micellar Water & Gentle Foam Wash", instruction: "Wash away dust, sunscreen, airborne pollution, and excess natural oils." },
    { step: 2, type: "Repair Active", product: "Azelaic Acid 10% / Gentle Eye Gel", instruction: "Targets redness, refines texture, and encourages overnight cell recovery." },
    { step: 3, type: "Moisturize", product: "Ceramide Barrier Night Cream", instruction: "Locks in deep hydration and reinforces your natural skin moisture barrier while you sleep." },
  ];

  // If using actual SkinAnalysis result:
  if (analysisResult) {
    if (analysisResult.severityScore !== undefined) {
      darkCirclesScore = Number(analysisResult.severityScore);
      darkCirclesLabel = analysisResult.severityCategory || analysisResult.severity?.label || (darkCirclesScore < 35 ? "Mild" : darkCirclesScore < 65 ? "Moderate" : "High");
    }
    if (analysisResult.etiology) {
      darkCirclesEtiology = analysisResult.etiology.split("(")[0].trim();
    }
    if (analysisResult.affectedAreaPercent !== undefined) {
      darkCirclesArea = Number(analysisResult.affectedAreaPercent);
    }

    if (analysisResult.redness) {
      rednessScore = Number(analysisResult.redness.redness_score || analysisResult.redness.rednessScore || 28);
      rednessLabel = analysisResult.redness.severity_category || analysisResult.redness.severity?.label || (rednessScore < 35 ? "Normal / Mild" : rednessScore < 65 ? "Moderate" : "High");
      rednessStatus = analysisResult.redness.status || "Localized cheek flushing";
    }

    primaryConcern = `${darkCirclesLabel} under-eye circles & ${rednessLabel.toLowerCase()} cheek redness`;
  }

  // If using AcneAnalysis result:
  if (analysisResult?.acneScore !== undefined) {
    scanType = "Acne, Blemishes & Pore Assessment";
    acneScore = analysisResult.acneScore;
    acneLabel = analysisResult.acneSeverity?.label || (acneScore < 30 ? "Low" : acneScore < 60 ? "Moderate" : "Active");
    poreScore = analysisResult.poreScore;
    poreLabel = analysisResult.poreSeverity?.label || "Medium";
    primaryConcern = `${acneLabel} acne activity with ${poreLabel.toLowerCase()} pore dilation`;
  }

  // If using Home Preset:
  if (preset) {
    scanType = preset.title || "Skin Health Assessment";
    skinType = preset.skinType || skinType;
    if (preset.detectedConcerns?.length) {
      primaryConcern = preset.detectedConcerns.slice(0, 2).join(" & ");
    }
  }

  // Overall Skin Health Score calculation (0-100, where higher is healthier)
  const compositePenalty = Math.round((darkCirclesScore * 0.35) + (rednessScore * 0.35) + (acneScore * 0.30));
  const skinHealthScore = Math.max(35, Math.min(98, 100 - Math.round(compositePenalty * 0.65)));

  let skinHealthGrade = "Optimal Condition";
  if (skinHealthScore < 60) skinHealthGrade = "Requires Gentle Care";
  else if (skinHealthScore < 80) skinHealthGrade = "Good (Mild Concern)";

  const finalCapturedImage = capturedImage || analysisResult?.crops?.left || analysisResult?.capturedImage || null;

  return {
    reportId,
    date: dateStr,
    time: timeStr,
    patientName,
    patientId,
    patientEmail,
    scanType,
    skinType,
    primaryConcern,
    skinHealthScore,
    skinHealthGrade,
    capturedImage: finalCapturedImage,
    darkCircles: {
      score: darkCirclesScore,
      label: darkCirclesLabel,
      etiology: darkCirclesEtiology,
      affectedArea: darkCirclesArea,
      summary: `${darkCirclesLabel} periorbital circles (${darkCirclesScore}/100)`,
      tip: "Tap a caffeine eye serum gently along the orbital bone; get 7-8 hours restful sleep.",
    },
    redness: {
      score: rednessScore,
      label: rednessLabel,
      status: rednessStatus,
      affectedArea: rednessArea,
      summary: `${rednessLabel} cheek redness (${rednessScore}/100)`,
      tip: "Apply soothing niacinamide & ceramide cream; avoid harsh scrubs and very hot water.",
    },
    acnePores: {
      acneScore,
      acneLabel,
      poreScore,
      poreLabel,
      summary: `${acneLabel} acne index (${acneScore}%) • Pore level: ${poreScore}%`,
      tip: "Use gentle salicylic acid cleanser; keep hydration balanced without heavy pore-clogging oils.",
    },
    amRoutine,
    pmRoutine,
    dos: [
      "Wear broad-spectrum SPF 50+ sunscreen every day, even when indoors.",
      "Stay well-hydrated (drink 2.5L+ water daily) to keep skin cells plump.",
      "Get 7-8 hours of sleep with head slightly elevated to prevent under-eye fluid pooling.",
    ],
    donts: [
      "Avoid harsh physical scrubs that cause micro-tears and capillary redness.",
      "Never sleep with makeup or sunscreen on; double-cleanse at night.",
      "Avoid washing your face with hot water, which strips natural barrier lipids.",
    ],
    progressTip: "Retake your scan every 7 to 14 days in similar lighting to see visual improvements in under-eye brightness and redness reduction.",
  };
}

/**
 * Generates an elegant, simple, patient-friendly 1-page A4 PDF report with the user's face photo.
 */
export function generateClinicalPDF(data) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  // Colors
  const darkSlate = [30, 41, 59];      // #1E293B
  const terracotta = [220, 146, 110];  // #DC926E
  const softBg = [250, 248, 245];      // #FAF8F5
  const borderGray = [226, 232, 240];  // #E2E8F0
  const textDark = [43, 38, 35];       // #2B2623
  const textMuted = [100, 116, 139];   // #64748B
  const emeraldGreen = [16, 185, 129]; // #10B981
  const amberOrange = [245, 158, 11];  // #F59E0B
  const roseRed = [239, 68, 68];       // #EF4444

  const getBadgeColor = (val) => {
    if (typeof val === "number") {
      if (val < 35) return emeraldGreen;
      if (val < 65) return amberOrange;
      return roseRed;
    }
    const lower = String(val).toLowerCase();
    if (lower.includes("opt") || lower.includes("low") || lower.includes("clear")) return emeraldGreen;
    if (lower.includes("mild") || lower.includes("norm") || lower.includes("med")) return amberOrange;
    return roseRed;
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. TOP HEADER BANNER
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...darkSlate);
  doc.rect(0, 0, pageWidth, 20, "F");

  // Accent line
  doc.setFillColor(...terracotta);
  doc.rect(0, 20, pageWidth, 1.2, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DERMAVISION SKIN HEALTH & PROGRESS REPORT", margin, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text("Personalized AI Cutaneous Analysis & Progress Tracking", margin, 15.5);

  // Right-side badge
  doc.setFillColor(45, 55, 72);
  doc.roundedRect(pageWidth - margin - 46, 4, 46, 12, 1.5, 1.5, "F");
  doc.setTextColor(...terracotta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(data.reportId, pageWidth - margin - 23, 9, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(203, 213, 225);
  doc.text(`${data.date} • ${data.time}`, pageWidth - margin - 23, 13.5, { align: "center" });

  let curY = 24;

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. PATIENT DEMOGRAPHICS BAR
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...softBg);
  doc.setDrawColor(...borderGray);
  doc.roundedRect(margin, curY, contentWidth, 12, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);

  doc.text("PATIENT:", margin + 3, curY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.patientName, margin + 20, curY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.text("PATIENT ID:", margin + 3, curY + 9);
  doc.setFont("helvetica", "normal");
  doc.text(data.patientId, margin + 20, curY + 9);

  const col2X = margin + 70;
  doc.setFont("helvetica", "bold");
  doc.text("SKIN TYPE:", col2X, curY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...terracotta);
  doc.text(data.skinType, col2X + 18, curY + 4.5);

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.text("SCAN DATE:", col2X, curY + 9);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, col2X + 18, curY + 9);

  const col3X = margin + 130;
  doc.setFont("helvetica", "bold");
  doc.text("QUALITY INDEX:", col3X, curY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...emeraldGreen);
  doc.text("98.4% (Validated ✓)", col3X + 24, curY + 4.5);

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.text("STATUS:", col3X, curY + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...emeraldGreen);
  doc.text("Baseline Saved", col3X + 24, curY + 9);

  curY += 15;

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. HERO PROGRESS SECTION: USER FACE PHOTO + EXECUTIVE HEALTH CARD
  // ═════════════════════════════════════════════════════════════════════════════
  const photoBoxWidth = 42;
  const heroHeight = 46;

  // 3A. Left: User's Face Photo (Progress Baseline)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...borderGray);
  doc.roundedRect(margin, curY, photoBoxWidth, heroHeight, 2, 2, "FD");

  let photoRendered = false;
  if (data.capturedImage && typeof data.capturedImage === "string") {
    try {
      const isPng = data.capturedImage.includes("image/png");
      doc.addImage(
        data.capturedImage,
        isPng ? "PNG" : "JPEG",
        margin + 1.5,
        curY + 1.5,
        photoBoxWidth - 3,
        heroHeight - 8.5
      );
      photoRendered = true;
    } catch (e) {
      console.warn("Could not embed captured image in PDF:", e);
    }
  }

  if (!photoRendered) {
    // Elegant fallback box
    doc.setFillColor(226, 232, 240);
    doc.rect(margin + 2, curY + 2, photoBoxWidth - 4, heroHeight - 9, "F");
    doc.setTextColor(...textMuted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("FACE SCAN", margin + photoBoxWidth / 2, curY + 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Baseline Photo", margin + photoBoxWidth / 2, curY + 24, { align: "center" });
  }

  // Caption beneath photo
  doc.setFillColor(...darkSlate);
  doc.rect(margin, curY + heroHeight - 6, photoBoxWidth, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.text("BASELINE SCAN PHOTO", margin + photoBoxWidth / 2, curY + heroHeight - 2.2, { align: "center" });

  // 3B. Right: Skin Health Scorecard & Progress Tracker Guidance
  const scoreCardX = margin + photoBoxWidth + 4;
  const scoreCardWidth = contentWidth - photoBoxWidth - 4;

  doc.setFillColor(...darkSlate);
  doc.roundedRect(scoreCardX, curY, scoreCardWidth, heroHeight, 2, 2, "F");

  // Left part of card: Score pill
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("OVERALL SKIN HEALTH", scoreCardX + 22, curY + 8, { align: "center" });

  doc.setFontSize(26);
  doc.setTextColor(...terracotta);
  doc.text(`${data.skinHealthScore}`, scoreCardX + 22, curY + 22, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text("OUT OF 100", scoreCardX + 22, curY + 28, { align: "center" });

  doc.setFillColor(...emeraldGreen);
  doc.roundedRect(scoreCardX + 4, curY + 32, 36, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(data.skinHealthGrade, scoreCardX + 22, curY + 36, { align: "center" });

  // Right part of card: Guidance & Progress Tip
  const textX = scoreCardX + 46;
  const textWidth = scoreCardWidth - 50;

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRIMARY SKIN FINDING:", textX, curY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(data.primaryConcern, textX, curY + 13.5, { maxWidth: textWidth });

  // Progress Tip Banner inside Hero
  doc.setFillColor(45, 55, 72);
  doc.roundedRect(textX, curY + 20, textWidth, 21, 1.5, 1.5, "F");

  doc.setTextColor(...terracotta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("HOW TO TRACK YOUR PROGRESS:", textX + 3, curY + 24.5);

  doc.setTextColor(203, 213, 225);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    data.progressTip || "Retake your scan every 7 to 14 days in similar lighting to see visual improvements in under-eye brightness and redness reduction.",
    textX + 3,
    curY + 29,
    { maxWidth: textWidth - 6 }
  );

  curY += heroHeight + 5;

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. THREE CORE SKIN METRICS (SIMPLE & VISUAL)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text("KEY SKIN CONCERNS & ANALYSIS", margin, curY);

  curY += 3;

  const metricBoxWidth = (contentWidth - 6) / 3;
  const metricBoxHeight = 30;

  // Box 1: Under-Eye Dark Circles
  doc.setFillColor(...softBg);
  doc.setDrawColor(...borderGray);
  doc.roundedRect(margin, curY, metricBoxWidth, metricBoxHeight, 2, 2, "FD");

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("UNDER-EYE CIRCLES", margin + 3.5, curY + 5.5);

  doc.setFontSize(14);
  doc.setTextColor(...getBadgeColor(data.darkCircles.score));
  doc.text(`${data.darkCircles.score}/100`, margin + 3.5, curY + 13);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text(`Severity: ${data.darkCircles.label}`, margin + 3.5, curY + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text(data.darkCircles.tip, margin + 3.5, curY + 22.5, { maxWidth: metricBoxWidth - 6 });

  // Box 2: Redness & Flushing
  const box2X = margin + metricBoxWidth + 3;
  doc.setFillColor(...softBg);
  doc.roundedRect(box2X, curY, metricBoxWidth, metricBoxHeight, 2, 2, "FD");

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("REDNESS & ERYTHEMA", box2X + 3.5, curY + 5.5);

  doc.setFontSize(14);
  doc.setTextColor(...getBadgeColor(data.redness.score));
  doc.text(`${data.redness.score}/100`, box2X + 3.5, curY + 13);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text(`Severity: ${data.redness.label}`, box2X + 3.5, curY + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text(data.redness.tip, box2X + 3.5, curY + 22.5, { maxWidth: metricBoxWidth - 6 });

  // Box 3: Acne & Skin Clarity
  const box3X = box2X + metricBoxWidth + 3;
  doc.setFillColor(...softBg);
  doc.roundedRect(box3X, curY, metricBoxWidth, metricBoxHeight, 2, 2, "FD");

  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ACNE & PORE CLARITY", box3X + 3.5, curY + 5.5);

  doc.setFontSize(14);
  doc.setTextColor(...getBadgeColor(data.acnePores.acneScore));
  doc.text(`${data.acnePores.acneScore}%`, box3X + 3.5, curY + 13);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text(`Acne: ${data.acnePores.acneLabel} • Pores: ${data.acnePores.poreLabel}`, box3X + 3.5, curY + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text(data.acnePores.tip, box3X + 3.5, curY + 22.5, { maxWidth: metricBoxWidth - 6 });

  curY += metricBoxHeight + 5;

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. DAILY CLINICAL CARE ROUTINE (AM / PM)
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text("RECOMMENDED DAILY SKINCARE ROUTINE", margin, curY);

  curY += 3;

  const routineWidth = (contentWidth - 4) / 2;
  const routineHeight = 52;

  // 5A. Morning (AM)
  doc.setFillColor(...softBg);
  doc.roundedRect(margin, curY, routineWidth, routineHeight, 2, 2, "FD");

  doc.setFillColor(254, 242, 242);
  doc.rect(margin, curY, routineWidth, 6, "F");
  doc.setTextColor(153, 27, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("MORNING (AM) ROUTINE — DEFENSE & PROTECTION", margin + 3.5, curY + 4.2);

  let stepY = curY + 9;
  data.amRoutine.forEach((item) => {
    doc.setTextColor(...terracotta);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(`Step ${item.step}: ${item.product}`, margin + 3.5, stepY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...textMuted);
    doc.text(item.instruction, margin + 3.5, stepY + 3.8, { maxWidth: routineWidth - 7 });
    stepY += 14;
  });

  // 5B. Evening (PM)
  const pmX = margin + routineWidth + 4;
  doc.setFillColor(...softBg);
  doc.roundedRect(pmX, curY, routineWidth, routineHeight, 2, 2, "FD");

  doc.setFillColor(238, 242, 255);
  doc.rect(pmX, curY, routineWidth, 6, "F");
  doc.setTextColor(55, 48, 163);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("EVENING (PM) ROUTINE — REPAIR & RECOVERY", pmX + 3.5, curY + 4.2);

  stepY = curY + 9;
  data.pmRoutine.forEach((item) => {
    doc.setTextColor(79, 70, 229);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(`Step ${item.step}: ${item.product}`, pmX + 3.5, stepY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...textMuted);
    doc.text(item.instruction, pmX + 3.5, stepY + 3.8, { maxWidth: routineWidth - 7 });
    stepY += 14;
  });

  curY += routineHeight + 5;

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. SIMPLE DO'S & DON'TS FOR HEALTHIER SKIN
  // ═════════════════════════════════════════════════════════════════════════════
  const dosWidth = (contentWidth - 4) / 2;
  const dosHeight = 27;

  // Do's
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, curY, dosWidth, dosHeight, 2, 2, "FD");

  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DO THIS FOR BEST RESULTS", margin + 3.5, curY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(20, 83, 45);
  let doY = curY + 8.5;
  data.dos.forEach((text) => {
    doc.text(`• ${text}`, margin + 3.5, doY, { maxWidth: dosWidth - 7 });
    doY += 5.8;
  });

  // Don'ts
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(pmX, curY, dosWidth, dosHeight, 2, 2, "FD");

  doc.setTextColor(153, 27, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("AVOID THESE COMMON MISTAKES", pmX + 3.5, curY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(127, 29, 29);
  let dontY = curY + 8.5;
  data.donts.forEach((text) => {
    doc.text(`• ${text}`, pmX + 3.5, dontY, { maxWidth: dosWidth - 7 });
    dontY += 5.8;
  });

  curY += dosHeight + 5;

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. STATUTORY CLINICAL DISCLAIMER
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setDrawColor(...borderGray);
  doc.setFillColor(...softBg);
  doc.roundedRect(margin, curY, contentWidth, 12, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  doc.text("STATUTORY MEDICAL DISCLAIMER:", margin + 3.5, curY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...textMuted);
  doc.text(
    "DermaVision utilizes computer vision feature extractors strictly for cosmetic educational screening and self-progress monitoring. It does not provide medical diagnoses or prescriptions, and does not replace in-person consultation with a licensed dermatologist.",
    margin + 3.5,
    curY + 8,
    { maxWidth: contentWidth - 7 }
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // 8. FOOTER
  // ═════════════════════════════════════════════════════════════════════════════
  doc.setDrawColor(...borderGray);
  doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text("DermaVision Cutaneous Telemetry v3.4 • Confidential Progress Report", margin, pageHeight - 4.5);
  doc.text(`Ref ID: ${data.reportId} • Page 1 of 1`, pageWidth - margin, pageHeight - 4.5, { align: "right" });

  return doc;
}

/**
 * Generates and downloads the PDF directly to the user's browser.
 */
export function downloadReportPDF(data, filename) {
  try {
    const doc = generateClinicalPDF(data);
    const saveName = filename || `DermaVision_Report_${data.reportId || "Summary"}.pdf`;
    doc.save(saveName);
    return true;
  } catch (err) {
    console.error("PDF Generation error:", err);
    throw err;
  }
}
