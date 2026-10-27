// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StatusBadge,
  ConnectivityBadge,
  DemoProvenanceBadge,
  SensorSourceBadge,
} from '../components/StatusBadge';
import {
  formatParameterValue,
  getWqiClassification,
  PARAMETER_METADATA,
} from '../utils/formatters';

describe('AquaGuard Frontend UI Components & Formatters', () => {
  it('renders StatusBadge with explicit text labels alongside icons for Normal, Warning, Critical, and Offline states', () => {
    const { rerender } = render(<StatusBadge status="normal" />);
    expect(screen.getByText('Normal')).toBeTruthy();

    rerender(<StatusBadge status="warning" />);
    expect(screen.getByText('Warning')).toBeTruthy();

    rerender(<StatusBadge status="critical" />);
    expect(screen.getByText('Critical')).toBeTruthy();

    rerender(<StatusBadge status="offline" />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('clearly distinguishes DEMO DATA from GENUINE SENSOR TELEMETRY in DemoProvenanceBadge', () => {
    const { rerender } = render(<DemoProvenanceBadge isSimulated={true} />);
    expect(screen.getByText(/DEMO DATA — SIMULATED/i)).toBeTruthy();

    rerender(<DemoProvenanceBadge isSimulated={false} />);
    expect(screen.getByText(/GENUINE SENSOR TELEMETRY/i)).toBeTruthy();
  });

  it('renders SensorSourceBadge labels for IoT probes, Field Analyzers, and Lab Grab Samples', () => {
    const { rerender } = render(<SensorSourceBadge sourceType="continuous_iot_probe" />);
    expect(screen.getByText('IoT Probe')).toBeTruthy();

    rerender(<SensorSourceBadge sourceType="specialized_analyzer" />);
    expect(screen.getByText('Field Analyzer')).toBeTruthy();

    rerender(<SensorSourceBadge sourceType="lab_manual_sample" />);
    expect(screen.getByText('Lab / Grab Sample')).toBeTruthy();
  });

  it('formats parameter values according to configured precision and classifies WQI scores accurately', () => {
    expect(formatParameterValue('ph', 7.456)).toBe('7.46');
    expect(formatParameterValue('phosphate', 0.0642)).toBe('0.064');
    expect(formatParameterValue('conductivity', 412.8)).toBe('413');
    expect(Object.keys(PARAMETER_METADATA)).toHaveLength(10);

    expect(getWqiClassification(91).status).toBe('normal');
    expect(getWqiClassification(72).status).toBe('warning');
    expect(getWqiClassification(48).status).toBe('critical');
  });

  it('renders ConnectivityBadge for online and offline states', () => {
    const { rerender } = render(<ConnectivityBadge status="online" />);
    expect(screen.getByText('Online')).toBeTruthy();

    rerender(<ConnectivityBadge status="offline" />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });
});
