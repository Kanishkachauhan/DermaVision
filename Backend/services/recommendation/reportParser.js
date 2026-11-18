// Backend/services/recommendation/reportParser.js
/**
 * Clinical Report Parser for DermaVision Recommendation Engine
 *
 * Responsibilities:
 * 1. Safely inspects and maps the real MongoDB Report document and ML telemetry.
 * 2. Never assumes fields exist; provides robust fallbacks.
 * 3. Differentiates ML model detection confidence (Softmax / model certainty)
 *    from cosmetic severity levels (Low / Moderate / High).
 * 4. Identifies skin type and handles missing / unspecified types.
 * 5. Detects insufficient or missing report data and flags safe baseline mode.
 */

export const CANONICAL_CONCERNS = {
  ACNE: 'Acne',
  REDNESS: 'Redness',
  DARK_CIRCLES: 'Dark circles',
  VISIBLE_PORES: 'Visible pores',
  DRYNESS: 'Dryness',
  UNEVEN_TONE: 'Uneven skin tone',
};

const VALID_SKIN_TYPES = ['Oily', 'Dry', 'Combination', 'Normal'];

/**
 * Maps arbitrary condition string from ML model / database to canonical concern key.
 */
export function mapConditionToCanonical(conditionStr = '') {
  const normalized = String(conditionStr).toLowerCase().trim();

  if (
    normalized.includes('acne') ||
    normalized.includes('blemish') ||
    normalized.includes('pimple') ||
    normalized.includes('comedone') ||
    normalized.includes('papule') ||
    normalized.includes('pustule')
  ) {
    return CANONICAL_CONCERNS.ACNE;
  }

  if (
    normalized.includes('redness') ||
    normalized.includes('erythema') ||
    normalized.includes('rosacea') ||
    normalized.includes('vascular') ||
    normalized.includes('flush')
  ) {
    return CANONICAL_CONCERNS.REDNESS;
  }

  if (
    normalized.includes('dark circle') ||
    normalized.includes('darkcircle') ||
    normalized.includes('under-eye') ||
    normalized.includes('periorbital') ||
    normalized.includes('infraorbital')
  ) {
    return CANONICAL_CONCERNS.DARK_CIRCLES;
  }

  if (
    normalized.includes('pore') ||
    normalized.includes('pores') ||
    normalized.includes('enlarged pore') ||
    normalized.includes('dilated pore')
  ) {
    return CANONICAL_CONCERNS.VISIBLE_PORES;
  }

  if (
    normalized.includes('dry') ||
    normalized.includes('dryness') ||
    normalized.includes('dehydrat') ||
    normalized.includes('flaking') ||
    normalized.includes('barrier')
  ) {
    return CANONICAL_CONCERNS.DRYNESS;
  }

  if (
    normalized.includes('uneven') ||
    normalized.includes('pigment') ||
    normalized.includes('hyperpigmentation') ||
    normalized.includes('dark spot') ||
    normalized.includes('melasma')
  ) {
    return CANONICAL_CONCERNS.UNEVEN_TONE;
  }

  return conditionStr.trim();
}

/**
 * Normalizes severity string to 'Low' | 'Moderate' | 'High'.
 */
export function normalizeSeverity(severityInput, numericScore = 0) {
  if (typeof severityInput === 'string') {
    const s = severityInput.toLowerCase().trim();
    if (s.includes('high') || s.includes('severe') || s.includes('active')) return 'High';
    if (s.includes('mod') || s.includes('med') || s.includes('mild-to-mod')) return 'Moderate';
    if (s.includes('low') || s.includes('mild') || s.includes('minimal')) return 'Low';
  }

  // Derive from numeric score if string is absent
  if (numericScore >= 67) return 'High';
  if (numericScore >= 34) return 'Moderate';
  return 'Low';
}

/**
 * Main parser: Consumes an actual Report object or diagnostic payload.
 *
 * @param {Object} rawReport - MongoDB Report document or raw diagnostic payload
 * @returns {Object} Structured diagnostic report object
 */
export function parseSkinReport(rawReport = {}) {
  const report = rawReport && typeof rawReport.toObject === 'function'
    ? rawReport.toObject()
    : (rawReport || {});

  // 1. Skin Type Mapping
  let rawSkinType = report.skinType;
  let isSkinTypeEstimated = false;

  if (!rawSkinType || typeof rawSkinType !== 'string') {
    rawSkinType = 'Combination';
    isSkinTypeEstimated = true;
  } else {
    // Title case match
    const found = VALID_SKIN_TYPES.find(
      (t) => t.toLowerCase() === rawSkinType.toLowerCase().trim()
    );
    if (found) {
      rawSkinType = found;
    } else {
      rawSkinType = 'Combination';
      isSkinTypeEstimated = true;
    }
  }

  // 2. Skin Health Score Mapping
  const rawHealth = Number(report.healthScore);
  const healthScore = !isNaN(rawHealth)
    ? Math.max(0, Math.min(100, Math.round(rawHealth)))
    : 75;

  // 3. Predictions & Diagnostic Metrics Mapping
  // Handles MongoDB predictions array: [{ condition, confidence, severity }]
  const rawPredictions = Array.isArray(report.predictions) ? report.predictions : [];
  const detectedConcernsMap = new Map();

  // Helper to add or merge concern
  const recordConcern = (canonicalName, { confidence, severity, score, etiology, notes }) => {
    const existing = detectedConcernsMap.get(canonicalName);
    const normalizedSev = normalizeSeverity(severity, score);
    const parsedConf = Math.min(100, Math.max(0, Number(confidence) || 75));
    const parsedScore = Math.min(100, Math.max(0, Number(score) || 0));

    if (!existing || parsedScore > existing.score || (normalizedSev === 'High' && existing.severity !== 'High')) {
      detectedConcernsMap.set(canonicalName, {
        concern: canonicalName,
        confidence: parsedConf, // Detection probability
        severity: normalizedSev, // Visual / clinical severity level
        score: parsedScore, // Optional 0-100 metric
        etiology: etiology || existing?.etiology || '',
        notes: notes || existing?.notes || '',
      });
    }
  };

  // Parse predictions array
  for (const pred of rawPredictions) {
    if (!pred || !pred.condition) continue;
    const canonical = mapConditionToCanonical(pred.condition);
    recordConcern(canonical, {
      confidence: pred.confidence,
      severity: pred.severity,
      score: pred.score || (pred.severity === 'High' ? 75 : pred.severity === 'Moderate' ? 50 : 25),
      notes: pred.condition,
    });
  }

  // Also check if detailed diagnosticMetrics / direct objects were attached
  // (e.g. from frontend /analysis/dark-circles, /analysis/acne, /analysis/redness)
  const dm = report.diagnosticMetrics || report;

  // Check direct acne metrics - strictly verify active blemish burden
  if (dm.acneScore !== undefined || dm.acne?.acneScore !== undefined) {
    const score = Number(dm.acneScore ?? dm.acne?.acneScore ?? 0);
    const acneTypeStr = String(dm.acne?.acneType || dm.acneType || '').toLowerCase();
    const isAcneElevated = score >= 28 || (acneTypeStr && !acneTypeStr.includes('clear') && !acneTypeStr.includes('minimal'));
    if (isAcneElevated) {
      recordConcern(CANONICAL_CONCERNS.ACNE, {
        confidence: Number(dm.acne?.confidence || dm.confidence || 90),
        severity: normalizeSeverity(dm.acne?.acneSeverity?.label || dm.acneSeverity?.label, score),
        score,
        etiology: dm.acne?.acneType || dm.acneType || '',
      });
    }
  }

  // Check direct pore metrics - only record if sebaceous dilation is genuinely elevated
  if (dm.poreScore !== undefined || dm.acne?.poreScore !== undefined) {
    const score = Number(dm.poreScore ?? dm.acne?.poreScore ?? 0);
    if (score >= 45) {
      recordConcern(CANONICAL_CONCERNS.VISIBLE_PORES, {
        confidence: Number(dm.acne?.confidence || 85),
        severity: normalizeSeverity(dm.acne?.poreSeverity?.label || dm.poreSeverity?.label, score),
        score,
        etiology: dm.acne?.poreType || dm.poreType || '',
      });
    }
  }

  // Check direct redness metrics - only record if vascular erythema is genuinely elevated
  if (dm.rednessScore !== undefined || dm.redness?.redness_score !== undefined || dm.redness?.rednessScore !== undefined) {
    const score = Number(dm.rednessScore ?? dm.redness?.redness_score ?? dm.redness?.rednessScore ?? 0);
    const sevCategory = String(dm.redness?.severity_category || dm.redness?.severity?.label || '').toLowerCase();
    const isRednessElevated = score >= 32 || sevCategory.includes('mod') || sevCategory.includes('high');
    if (isRednessElevated) {
      recordConcern(CANONICAL_CONCERNS.REDNESS, {
        confidence: Number(dm.redness?.confidence || 88),
        severity: normalizeSeverity(dm.redness?.severity_category || dm.redness?.severity?.label, score),
        score,
        etiology: dm.redness?.status || '',
      });
    }
  }

  // Check direct dark circle metrics - only record if periorbital contrast is genuinely elevated
  if (dm.darkCirclesScore !== undefined || dm.darkCircles?.score !== undefined || dm.severityScore !== undefined) {
    const score = Number(dm.darkCirclesScore ?? dm.darkCircles?.score ?? dm.severityScore ?? 0);
    const sevCat = String(dm.severityCategory || dm.darkCircles?.label || '').toLowerCase();
    const isCirclesElevated = score >= 30 || sevCat.includes('mod') || sevCat.includes('high');
    if (isCirclesElevated) {
      recordConcern(CANONICAL_CONCERNS.DARK_CIRCLES, {
        confidence: Number(dm.detectionConfidence || dm.darkCircles?.detection_confidence || 85),
        severity: normalizeSeverity(dm.severityCategory || dm.darkCircles?.label, score),
        score,
        etiology: dm.darkCircles?.etiology || dm.etiology || '',
      });
    }
  }

  // 4. Determine Data Sufficiency
  const detectedConcerns = Array.from(detectedConcernsMap.values());
  const isInsufficient = detectedConcerns.length === 0;

  // Sort concerns by severity ('High' > 'Moderate' > 'Low') and then score
  const severityRank = { High: 3, Moderate: 2, Low: 1 };
  detectedConcerns.sort((a, b) => {
    const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (diff !== 0) return diff;
    return (b.score || 0) - (a.score || 0);
  });

  const primaryConcern = detectedConcerns.length > 0 ? detectedConcerns[0] : null;
  const secondaryConcerns = detectedConcerns.slice(1);

  return {
    reportId: report._id ? String(report._id) : null,
    userId: report.user ? String(report.user) : null,
    skinType: rawSkinType,
    isSkinTypeEstimated,
    healthScore,
    detectedConcerns,
    primaryConcern,
    secondaryConcerns,
    isInsufficient,
    insufficientReason: isInsufficient
      ? 'No active skin concerns were identified in the analysis report. Safe universal baseline recommendations will be generated.'
      : null,
    disclaimer:
      'AI detection confidence scores reflect visual model certainty, not clinical severity. Recommendations are cosmetic and preventative.',
  };
}
