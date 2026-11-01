import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { Pack } from '../src/modules/catalog/schema.js';
import { CheckinScoring, MeasureScoring, ScenarioScoring, ScoringEngine } from '../src/modules/scoring/index.js';
import type { Responses } from '../src/modules/scoring/index.js';
import { createTestHarness } from './helpers/platform.js';
import type { TestHarness } from './helpers/platform.js';

let h: TestHarness;
const engine = new ScoringEngine().register(new CheckinScoring()).register(new MeasureScoring()).register(new ScenarioScoring());
const pack = (id: string): Pack => h.platform.catalog.getPack(id);
const fill = (p: Pack, value: number | ((id: string) => number)): Responses => {
  const out: Responses = {};
  if (p.format === 'scenario') throw new Error('not a measure');
  for (const item of p.items) out[item.id] = typeof value === 'number' ? value : value(item.id);
  return out;
};
const domain = (res: ReturnType<typeof engine.score>, id: string) => {
  const d = res.domains.find((x) => x.id === id);
  assert.ok(d, id);
  return d;
};

before(async () => {
  h = await createTestHarness();
});

describe('DASS-21 scoring', () => {
  it('doubles sums and applies the published levels', () => {
    const p = pack('adults-dass-21');
    const top = engine.score(p, fill(p, 3));
    for (const id of ['depression', 'anxiety', 'stress']) {
      const d = domain(top, id);
      assert.equal(d.raw, 42);
      assert.equal(d.level, 'Extremely severe');
      assert.equal(d.score, 100);
    }
    const zero = engine.score(p, fill(p, 0));
    assert.equal(domain(zero, 'depression').level, 'Normal');
    assert.equal(zero.provisional, false);
  });

  it('places scores on the published boundaries', () => {
    const p = pack('adults-dass-21');
    const items = p.format === 'measure' ? p.items : [];
    const only = (sub: string, sum: number): Responses => {
      const r: Responses = fill(p, 0);
      let left = sum;
      for (const item of items.filter((i) => i.subscale === sub)) {
        const v = Math.min(3, left);
        r[item.id] = v;
        left -= v;
      }
      return r;
    };
    // Depression: 14 is Moderate, 13 is Mild. Anxiety: 7 is Normal, 8 is Mild. Stress: 7 (14) Normal, 8 (16) Mild.
    assert.equal(domain(engine.score(p, only('depression', 7)), 'depression').level, 'Moderate');
    assert.equal(domain(engine.score(p, only('depression', 5)), 'depression').level, 'Mild');
    assert.equal(domain(engine.score(p, only('anxiety', 3)), 'anxiety').level, 'Normal');
    assert.equal(domain(engine.score(p, only('anxiety', 4)), 'anxiety').level, 'Mild');
    assert.equal(domain(engine.score(p, only('stress', 7)), 'stress').level, 'Normal');
    assert.equal(domain(engine.score(p, only('stress', 8)), 'stress').level, 'Mild');
    assert.equal(domain(engine.score(p, only('depression', 14)), 'depression').level, 'Extremely severe');
  });

  it('lists item 21 for the clinician only when answered 3, and never as an alert', () => {
    const p = pack('adults-dass-21');
    const r2 = engine.score(p, { ...fill(p, 0), 'dass-21': 2 });
    assert.equal(r2.highlights?.length, 0);
    const r3 = engine.score(p, { ...fill(p, 0), 'dass-21': 3 });
    assert.equal(r3.highlights?.length, 1);
    assert.equal(r3.flags.length, 0);
  });

  it('has seven items per subscale in the published layout', () => {
    const p = pack('adults-dass-21');
    assert.equal(p.format === 'measure' && p.items.length, 21);
    for (const sub of ['depression', 'anxiety', 'stress']) {
      assert.equal(p.format === 'measure' && p.items.filter((i) => i.subscale === sub).length, 7);
    }
  });
});

describe('PWB-18 scoring', () => {
  it('reverse scores items 1, 2, 3, 8, 9, 11, 12, 13, 17 and 18', () => {
    const p = pack('adults-wellbeing-ryff-18');
    const res = engine.score(p, fill(p, 1));
    // "Strongly agree" everywhere: positive items become 7, negative items stay 1.
    assert.equal(domain(res, 'autonomy').raw, 15);
    assert.equal(domain(res, 'mastery').raw, 15);
    assert.equal(domain(res, 'growth').raw, 15);
    assert.equal(domain(res, 'relations').raw, 9);
    assert.equal(domain(res, 'purpose').raw, 9);
    assert.equal(domain(res, 'self').raw, 15);
    assert.equal(domain(res, 'self').rawMin, 3);
    assert.equal(domain(res, 'self').rawMax, 21);
    assert.equal(domain(res, 'self').banded, false);
  });

  it('is available for both Adults and Older adults', () => {
    assert.equal(pack('adults-wellbeing-ryff-18').track, 'adults');
    assert.equal(pack('seniors-wellbeing-ryff-18').track, 'seniors');
  });
});

describe('SAS-SV scoring', () => {
  it('totals 10 to 60 and shows which reference values were reached', () => {
    const p = pack('teens-smartphone-use-sas-sv');
    assert.equal(domain(engine.score(p, fill(p, 1)), 'total').raw, 10);
    const top = domain(engine.score(p, fill(p, 6)), 'total');
    assert.equal(top.raw, 60);
    assert.ok(top.referenceLines?.every((l) => l.reached));
    const items = p.format === 'measure' ? p.items : [];
    const r: Responses = fill(p, 3);
    r[items[0]!.id] = 4; // nine 3s and one 4 = 31
    const mid = domain(engine.score(p, r), 'total');
    assert.equal(mid.raw, 31);
    assert.deepEqual(mid.referenceLines?.map((l) => l.reached), [true, false]);
    assert.equal(mid.banded, false);
  });
});

describe('measure validation', () => {
  it('rejects answers outside the pack scale and unknown items', () => {
    const p = pack('adults-dass-21');
    assert.throws(() => engine.validate(p, { 'dass-01': 4 }, false));
    assert.throws(() => engine.validate(p, { nope: 1 }, false));
    assert.throws(() => engine.validate(p, { 'dass-01': 1 }, true));
    assert.doesNotThrow(() => engine.validate(p, fill(p, 2), true));
  });
});
