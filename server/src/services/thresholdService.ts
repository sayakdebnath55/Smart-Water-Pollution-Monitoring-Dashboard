import { queryAll, queryOne, execute } from '../database/db.js';
import {
  ParameterCode,
  QualityStatus,
  ThresholdRuleRecord,
  WATER_PARAMETERS,
  ALL_PARAMETER_CODES,
} from '../types/index.js';

export interface ThresholdValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ThresholdEvaluationResult {
  qualityStatus: QualityStatus;
  severity: 'warning' | 'critical' | null;
  triggeredThreshold: string | null;
  thresholdDirection:
    | 'normal'
    | 'below_min_critical'
    | 'above_max_critical'
    | 'below_min_warning'
    | 'above_max_warning';
  rule: ThresholdRuleRecord | null;
}

export function validateThresholdConfig(input: {
  parameter: string;
  min_warning?: number | null;
  max_warning?: number | null;
  min_critical?: number | null;
  max_critical?: number | null;
  enabled?: boolean | number;
}): ThresholdValidationResult {
  const errors: string[] = [];

  if (!ALL_PARAMETER_CODES.includes(input.parameter as ParameterCode)) {
    errors.push(`Unsupported parameter code: ${input.parameter}`);
    return { valid: false, errors };
  }

  const meta = WATER_PARAMETERS[input.parameter as ParameterCode];
  const minW = input.min_warning ?? null;
  const maxW = input.max_warning ?? null;
  const minC = input.min_critical ?? null;
  const maxC = input.max_critical ?? null;
  const isEnabled = input.enabled === undefined ? true : Boolean(input.enabled);

  if (isEnabled && minW === null && maxW === null && minC === null && maxC === null) {
    errors.push('At least one warning or critical threshold boundary must be specified when rule is enabled.');
  }

  const checkPhysicalBounds = (val: number | null, label: string) => {
    if (val === null) return;
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      errors.push(`${label} must be a finite number.`);
      return;
    }
    if (val < meta.minAllowedValue || val > meta.maxAllowedValue) {
      errors.push(
        `${label} (${val} ${meta.unit}) is outside physical measurement bounds [${meta.minAllowedValue}, ${meta.maxAllowedValue}] for ${meta.name}.`
      );
    }
  };

  checkPhysicalBounds(minC, 'Lower critical boundary');
  checkPhysicalBounds(minW, 'Lower warning boundary');
  checkPhysicalBounds(maxW, 'Upper warning boundary');
  checkPhysicalBounds(maxC, 'Upper critical boundary');

  if (minC !== null && minW !== null && minC > minW) {
    errors.push(
      `Lower critical boundary (${minC}) cannot be greater than lower warning boundary (${minW}). Critical low must be more extreme than warning low.`
    );
  }

  if (maxW !== null && maxC !== null && maxW > maxC) {
    errors.push(
      `Upper warning boundary (${maxW}) cannot be greater than upper critical boundary (${maxC}). Critical high must be more extreme than warning high.`
    );
  }

  if (minW !== null && maxW !== null && minW >= maxW) {
    errors.push(
      `Lower warning boundary (${minW}) must be strictly less than upper warning boundary (${maxW}) so a valid normal operating range exists.`
    );
  }

  if (minC !== null && maxC !== null && minC >= maxC) {
    errors.push(
      `Lower critical boundary (${minC}) must be strictly less than upper critical boundary (${maxC}).`
    );
  }

  if (minW !== null && maxC !== null && minW >= maxC) {
    errors.push(
      `Lower warning boundary (${minW}) must be strictly less than upper critical boundary (${maxC}).`
    );
  }

  if (minC !== null && maxW !== null && minC >= maxW) {
    errors.push(
      `Lower critical boundary (${minC}) must be strictly less than upper warning boundary (${maxW}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getEffectiveThresholdRule(
  stationId: string,
  parameter: ParameterCode
): ThresholdRuleRecord | null {
  const stationRule = queryOne<ThresholdRuleRecord>(
    'SELECT * FROM threshold_rules WHERE station_id = ? AND parameter = ? LIMIT 1',
    [stationId, parameter]
  );
  if (stationRule) {
    return stationRule.enabled ? stationRule : null;
  }

  const globalRule = queryOne<ThresholdRuleRecord>(
    'SELECT * FROM threshold_rules WHERE station_id IS NULL AND parameter = ? LIMIT 1',
    [parameter]
  );
  if (globalRule && globalRule.enabled) {
    return globalRule;
  }
  return null;
}

export function evaluateReadingWithRule(
  value: number,
  rule: ThresholdRuleRecord | null
): ThresholdEvaluationResult {
  if (!rule || !rule.enabled) {
    return {
      qualityStatus: 'normal',
      severity: null,
      triggeredThreshold: null,
      thresholdDirection: 'normal',
      rule,
    };
  }

  if (rule.min_critical !== null && value < rule.min_critical) {
    return {
      qualityStatus: 'critical',
      severity: 'critical',
      triggeredThreshold: `< ${rule.min_critical} ${rule.unit} (Lower Critical Limit)`,
      thresholdDirection: 'below_min_critical',
      rule,
    };
  }

  if (rule.max_critical !== null && value > rule.max_critical) {
    return {
      qualityStatus: 'critical',
      severity: 'critical',
      triggeredThreshold: `> ${rule.max_critical} ${rule.unit} (Upper Critical Limit)`,
      thresholdDirection: 'above_max_critical',
      rule,
    };
  }

  if (rule.min_warning !== null && value < rule.min_warning) {
    return {
      qualityStatus: 'warning',
      severity: 'warning',
      triggeredThreshold: `< ${rule.min_warning} ${rule.unit} (Lower Warning Limit)`,
      thresholdDirection: 'below_min_warning',
      rule,
    };
  }

  if (rule.max_warning !== null && value > rule.max_warning) {
    return {
      qualityStatus: 'warning',
      severity: 'warning',
      triggeredThreshold: `> ${rule.max_warning} ${rule.unit} (Upper Warning Limit)`,
      thresholdDirection: 'above_max_warning',
      rule,
    };
  }

  return {
    qualityStatus: 'normal',
    severity: null,
    triggeredThreshold: null,
    thresholdDirection: 'normal',
    rule,
  };
}

export function evaluateStationReading(
  stationId: string,
  parameter: ParameterCode,
  value: number
): ThresholdEvaluationResult {
  const rule = getEffectiveThresholdRule(stationId, parameter);
  return evaluateReadingWithRule(value, rule);
}

export function computeSubIndexWqi(
  parameter: ParameterCode,
  value: number,
  evalResult: ThresholdEvaluationResult
): number {
  const meta = WATER_PARAMETERS[parameter];
  const baseline = meta.defaultBaseline;

  if (evalResult.qualityStatus === 'critical') {
    const rule = evalResult.rule;
    if (rule) {
      if (rule.max_critical !== null && value > rule.max_critical) {
        const excessRatio = (value - rule.max_critical) / Math.max(1, rule.max_critical);
        return Math.max(12, Math.round(45 - Math.min(33, excessRatio * 35)));
      }
      if (rule.min_critical !== null && value < rule.min_critical) {
        const deficitRatio = (rule.min_critical - value) / Math.max(1, rule.min_critical);
        return Math.max(12, Math.round(45 - Math.min(33, deficitRatio * 35)));
      }
    }
    return 35;
  }

  if (evalResult.qualityStatus === 'warning') {
    return 64;
  }

  // Normal range: score between 82 and 98 based on closeness to ideal baseline
  const deviation = Math.abs(value - baseline) / Math.max(0.1, meta.defaultVariation * 2);
  const penalty = Math.min(16, Math.round(deviation * 8));
  return Math.max(80, Math.min(98, 96 - penalty));
}

export function listThresholdRules(stationId?: string): ThresholdRuleRecord[] {
  if (stationId) {
    return queryAll<ThresholdRuleRecord>(
      'SELECT * FROM threshold_rules WHERE station_id IS NULL OR station_id = ? ORDER BY station_id ASC, parameter ASC',
      [stationId]
    );
  }
  return queryAll<ThresholdRuleRecord>(
    'SELECT * FROM threshold_rules ORDER BY CASE WHEN station_id IS NULL THEN 0 ELSE 1 END ASC, station_id ASC, parameter ASC'
  );
}

export function updateThresholdRuleById(
  id: number,
  updates: {
    min_warning?: number | null;
    max_warning?: number | null;
    min_critical?: number | null;
    max_critical?: number | null;
    enabled?: boolean | number;
    benchmark_authority?: string;
    water_use_category?: string;
    jurisdiction?: string;
    reference_source?: string;
    notes?: string;
  }
): { rule?: ThresholdRuleRecord; errors?: string[] } {
  const existing = queryOne<ThresholdRuleRecord>('SELECT * FROM threshold_rules WHERE id = ?', [id]);
  if (!existing) {
    return { errors: [`Threshold rule with ID ${id} not found.`] };
  }

  const merged = {
    parameter: existing.parameter,
    min_warning: updates.min_warning !== undefined ? updates.min_warning : existing.min_warning,
    max_warning: updates.max_warning !== undefined ? updates.max_warning : existing.max_warning,
    min_critical: updates.min_critical !== undefined ? updates.min_critical : existing.min_critical,
    max_critical: updates.max_critical !== undefined ? updates.max_critical : existing.max_critical,
    enabled: updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : existing.enabled,
    benchmark_authority: updates.benchmark_authority ?? existing.benchmark_authority,
    water_use_category: updates.water_use_category ?? existing.water_use_category,
    jurisdiction: updates.jurisdiction ?? existing.jurisdiction,
    reference_source: updates.reference_source ?? existing.reference_source,
    notes: updates.notes ?? existing.notes,
  };

  const validation = validateThresholdConfig(merged);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  const now = new Date().toISOString();
  execute(
    `UPDATE threshold_rules
     SET min_warning = ?,
         max_warning = ?,
         min_critical = ?,
         max_critical = ?,
         enabled = ?,
         benchmark_authority = ?,
         water_use_category = ?,
         jurisdiction = ?,
         reference_source = ?,
         notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      merged.min_warning,
      merged.max_warning,
      merged.min_critical,
      merged.max_critical,
      merged.enabled,
      merged.benchmark_authority,
      merged.water_use_category,
      merged.jurisdiction,
      merged.reference_source,
      merged.notes,
      now,
      id,
    ]
  );

  const updated = queryOne<ThresholdRuleRecord>('SELECT * FROM threshold_rules WHERE id = ?', [id]);
  return { rule: updated };
}

export function upsertStationThresholdRule(input: {
  station_id: string | null;
  parameter: ParameterCode;
  min_warning: number | null;
  max_warning: number | null;
  min_critical: number | null;
  max_critical: number | null;
  enabled: boolean | number;
  benchmark_authority?: string;
  water_use_category?: string;
  jurisdiction?: string;
  reference_source?: string;
  notes?: string;
}): { rule?: ThresholdRuleRecord; errors?: string[] } {
  const validation = validateThresholdConfig(input);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  const meta = WATER_PARAMETERS[input.parameter];
  const now = new Date().toISOString();
  const enabledInt = input.enabled ? 1 : 0;

  const existing = input.station_id
    ? queryOne<ThresholdRuleRecord>(
        'SELECT * FROM threshold_rules WHERE station_id = ? AND parameter = ?',
        [input.station_id, input.parameter]
      )
    : queryOne<ThresholdRuleRecord>(
        'SELECT * FROM threshold_rules WHERE station_id IS NULL AND parameter = ?',
        [input.parameter]
      );

  if (existing) {
    return updateThresholdRuleById(existing.id, {
      min_warning: input.min_warning,
      max_warning: input.max_warning,
      min_critical: input.min_critical,
      max_critical: input.max_critical,
      enabled: enabledInt,
      benchmark_authority: input.benchmark_authority,
      water_use_category: input.water_use_category,
      jurisdiction: input.jurisdiction,
      reference_source: input.reference_source,
      notes: input.notes,
    });
  }

  const res = execute(
    `INSERT INTO threshold_rules (
      station_id, parameter, unit, min_warning, max_warning, min_critical, max_critical,
      enabled, benchmark_authority, water_use_category, jurisdiction, reference_source, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.station_id,
      input.parameter,
      meta.unit,
      input.min_warning,
      input.max_warning,
      input.min_critical,
      input.max_critical,
      enabledInt,
      input.benchmark_authority || 'Configured Station Override',
      input.water_use_category || meta.defaultThresholds.water_use_category,
      input.jurisdiction || meta.defaultThresholds.jurisdiction,
      input.reference_source || 'Station-Specific Operational Threshold',
      input.notes || '',
      now,
    ]
  );

  const created = queryOne<ThresholdRuleRecord>('SELECT * FROM threshold_rules WHERE id = ?', [
    res.lastInsertRowid,
  ]);
  return { rule: created };
}
