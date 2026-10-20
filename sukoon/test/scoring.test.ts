import assert from 'node:assert/strict';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { ValidationError } from '../src/core/errors.js';
import { FileCatalogRepository } from '../src/modules/catalog/repository.js';
import type { CheckinPack, ScenarioPack } from '../src/modules/catalog/schema.js';
import { CatalogService } from '../src/modules/catalog/service.js';
import { CheckinScoring, ScenarioScoring, ScoringEngine } from '../src/modules/scoring/index.js';
import type { Responses } from '../src/modules/scoring/index.js';

let engine: ScoringEngine;
let checkin: CheckinPack;
let scenario: ScenarioPack;

before(async () => {
  const catalog = new CatalogService(await FileCatalogRepository.load(path.resolve(process.cwd(), 'content')));
  engine = new ScoringEngine().register(new CheckinScoring()).register(new ScenarioScoring());
  const a = catalog.getPack('adults-stress-wellbeing');
  const b = catalog.getPack('teens-pressure-and-peers');
  if (a.format !== 'checkin' || b.format !== 'scenario') throw new Error('Unexpected pack formats.');
  checkin = a;
  scenario = b;
});

const answerAll = (pack: CheckinPack, value: number): Responses =>
  Object.fromEntries(pack.items.map((item) => [item.id, value]));

describe('check-in scoring', () => {
  it('rates all-lowest answers as fine for risk domains and thin for support', () => {
    const result = engine.score(checkin, answerAll(checkin, 0));
    for (const domain of result.domains) {
      if (domain.polarity === 'risk') assert.equal(domain.band, 'ok', domain.id);
      else assert.equal(domain.band, 'explore', domain.id);
    }
    assert.equal(result.flags.length, 0);
    assert.equal(result.provisional, true);
  });

  it('rates all-highest answers as worth exploring for risk domains and strong for support', () => {
    const result = engine.score(checkin, answerAll(checkin, 3));
    for (const domain of result.domains) {
      assert.equal(domain.score, 100, domain.id);
      if (domain.polarity === 'risk') assert.equal(domain.band, 'explore', domain.id);
      else assert.equal(domain.band, 'ok', domain.id);
    }
  });

  it('puts mid answers in the watch band and uses band-specific guidance', () => {
    const result = engine.score(checkin, answerAll(checkin, 1));
    const worry = result.domains.find((d) => d.id === 'worry');
    assert.equal(worry?.score, 33);
    assert.equal(worry?.band, 'ok');
    const mixed = engine.score(checkin, answerAll(checkin, 2));
    const mood = mixed.domains.find((d) => d.id === 'mood');
    assert.equal(mood?.score, 67);
    assert.equal(mood?.band, 'explore');
    assert.match(mood?.guidance ?? '', /strongly affected/);
  });

  it('raises a safety flag for any answer above the lowest option, without changing the mood score', () => {
    const base = answerAll(checkin, 0);
    const flagged = engine.score(checkin, { ...base, m4: 1 });
    assert.equal(flagged.flags.length, 1);
    assert.equal(flagged.flags[0]?.kind, 'safety');
    const mood = flagged.domains.find((d) => d.id === 'mood');
    assert.equal(mood?.score, 0, 'unscored safety item must not move the domain score');
  });

  it('validates unknown items, bad values and incomplete submissions', () => {
    assert.throws(() => engine.validate(checkin, { nope: 1 }, false), ValidationError);
    assert.throws(() => engine.validate(checkin, { w1: 9 }, false), ValidationError);
    assert.throws(() => engine.validate(checkin, { w1: '2' }, false), ValidationError);
    assert.doesNotThrow(() => engine.validate(checkin, { w1: 2 }, false));
    assert.throws(() => engine.validate(checkin, { w1: 2 }, true), /unanswered/);
    assert.doesNotThrow(() => engine.validate(checkin, answerAll(checkin, 2), true));
  });
});

describe('scenario scoring', () => {
  const choose = (points: 0 | 1 | 2): Responses =>
    Object.fromEntries(
      scenario.scenarios.map((s) => [s.id, s.options.find((o) => o.points === points)?.id ?? 'a']),
    );

  it('maps option points to skill bands and scores', () => {
    const strong = engine.score(scenario, choose(2));
    assert.ok(strong.domains.every((d) => d.band === 'ok' && d.score === 100));
    const weak = engine.score(scenario, choose(0));
    assert.ok(weak.domains.every((d) => d.band === 'explore' && d.score === 20));
    const okay = engine.score(scenario, choose(1));
    assert.ok(okay.domains.every((d) => d.band === 'watch' && d.score === 55));
  });

  it('includes the clinician note, key message and discussion prompt as guidance', () => {
    const result = engine.score(scenario, choose(1));
    const first = result.domains[0]?.guidance ?? '';
    assert.match(first, /Key message:/);
    assert.match(first, /To discuss:/);
  });

  it('validates scenario ids, option ids and completeness', () => {
    assert.throws(() => engine.validate(scenario, { missing: 'a' }, false), ValidationError);
    assert.throws(() => engine.validate(scenario, { 'family-comparison': 'z' }, false), ValidationError);
    assert.throws(() => engine.validate(scenario, { 'family-comparison': 1 }, false), ValidationError);
    assert.throws(() => engine.validate(scenario, { 'family-comparison': 'a' }, true), /unanswered/);
    assert.doesNotThrow(() => engine.validate(scenario, choose(2), true));
  });

  it('refuses to register two strategies for the same format and to score with the wrong one', () => {
    assert.throws(() => engine.register(new CheckinScoring()), /already registered/);
    assert.throws(() => new CheckinScoring().score(scenario, {}), /received a scenario pack/);
  });
});
