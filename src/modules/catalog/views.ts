import type { Pack } from './schema.js';

/**
 * Patient-safe projection of a pack. It is built by listing what may be shown, not by
 * deleting what may not, so a field added to the schema later cannot leak by accident.
 * Scoring rules, bands, guidance, safety flags and clinician notes never appear here.
 */
export type PatientPackView =
  | {
      format: 'checkin';
      id: string;
      title: string;
      prompt: string;
      scale: Array<{ value: number; label: string }>;
      items: Array<{ id: string; text: string }>;
    }
  | {
      format: 'scenario';
      id: string;
      title: string;
      scenarios: Array<{
        id: string;
        title: string;
        setting: string;
        story: string;
        options: Array<{ id: string; text: string; outcome: string }>;
      }>;
    };

export interface PackSummary {
  id: string;
  version: string;
  track: string;
  audience: string[];
  title: string;
  summary: string;
  format: Pack['format'];
  status: Pack['status'];
  estimatedMinutes: number;
  itemCount: number;
  references: string[];
  clinicianNotes?: string;
}

export function itemCount(pack: Pack): number {
  return pack.format === 'checkin' ? pack.items.length : pack.scenarios.length;
}

export function toSummary(pack: Pack): PackSummary {
  const summary: PackSummary = {
    id: pack.id,
    version: pack.version,
    track: pack.track,
    audience: [...pack.audience],
    title: pack.title,
    summary: pack.summary,
    format: pack.format,
    status: pack.status,
    estimatedMinutes: pack.estimatedMinutes,
    itemCount: itemCount(pack),
    references: [...pack.references],
  };
  if (pack.clinicianNotes) summary.clinicianNotes = pack.clinicianNotes;
  return summary;
}

export function toPatientView(pack: Pack): PatientPackView {
  if (pack.format === 'checkin') {
    return {
      format: 'checkin',
      id: pack.id,
      title: pack.title,
      prompt: pack.prompt,
      scale: pack.scale.map((s) => ({ value: s.value, label: s.label })),
      items: pack.items.map((i) => ({ id: i.id, text: i.text })),
    };
  }
  return {
    format: 'scenario',
    id: pack.id,
    title: pack.title,
    scenarios: pack.scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      setting: s.setting,
      story: s.story,
      options: s.options.map((o) => ({ id: o.id, text: o.text, outcome: o.outcome })),
    })),
  };
}
