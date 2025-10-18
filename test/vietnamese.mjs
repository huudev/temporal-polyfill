#! /usr/bin/env -S node --experimental-modules

import Demitasse from '@pipobscure/demitasse';
const { describe, it, report } = Demitasse;

import Pretty from '@pipobscure/demitasse-pretty';
const { reporter } = Pretty;

import { strict as assert } from 'assert';
const { equal } = assert;

import * as Temporal from '@js-temporal/polyfill';
import aa98 from './amlich-aa98.cjs';

function parseTemporalLunar(temporalLunar) {
  const day = temporalLunar.day;
  const year = temporalLunar.year;
  const monthCode = temporalLunar.monthCode; // e.g. "M06", "M06L"
  const month = parseInt(monthCode.substring(1, 3), 10);
  const isLeap = monthCode.endsWith('L');
  return { day, month, year, isLeap, monthCode };
}

function datesEqual(d1, d2) {
  return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
}

// ─────── Test runner ───────
describe('Vietnamese calendar validation (2000–2100)', () => {
  const startDate = Temporal.PlainDate.from('2000-01-01');
  const endDate = Temporal.PlainDate.from('2100-12-31');
  let currentDate = startDate;

  while (Temporal.PlainDate.compare(currentDate, endDate) <= 0) {
    const solarOrig = currentDate;
    const { year, month, day } = solarOrig;

    describe(`Date ${solarOrig}`, () => {
      let tLunar, t, aDay, aMonth, aYear, aLeapFlag;

      try {
        // Convert once and reuse
        [aDay, aMonth, aYear, aLeapFlag] = aa98.convertSolar2Lunar(day, month, year, 7);
        tLunar = solarOrig.withCalendar('vietnamese');
        t = parseTemporalLunar(tLunar);
      } catch (e) {
        it('should not throw during conversion', () => {
          throw new Error(`💥 Conversion error on ${solarOrig}: ${e.message}`);
        });
        currentDate = currentDate.add({ days: 1 });
        return;
      }

      // 1. Dương → Âm: so sánh aa98 vs Temporal
      it('aa98 and Temporal agree on solar→lunar conversion', () => {
        equal(aDay, t.day, `day mismatch on ${solarOrig}`);
        equal(aMonth, t.month, `month mismatch on ${solarOrig}`);
        equal(aYear, t.year, `year mismatch on ${solarOrig}`);
        equal(Boolean(aLeapFlag), t.isLeap, `leap flag mismatch on ${solarOrig}`);
      });

      // 2. Roundtrip: aa98
      it('aa98 roundtrip (lunar→solar→lunar) is consistent', () => {
        const [aa98BackDay, aa98BackMonth, aa98BackYear] = aa98.convertLunar2Solar(aDay, aMonth, aYear, aLeapFlag, 7);
        equal(aa98BackDay, day, `aa98 roundtrip day mismatch on ${solarOrig}`);
        equal(aa98BackMonth, month, `aa98 roundtrip month mismatch on ${solarOrig}`);
        equal(aa98BackYear, year, `aa98 roundtrip year mismatch on ${solarOrig}`);
      });

      // 3. Roundtrip: Temporal
      it('Temporal roundtrip (solar→lunar→solar) is consistent', () => {
        const temporalBack = tLunar.withCalendar('iso8601');
        assert(datesEqual(temporalBack, solarOrig), `Temporal roundtrip failed on ${solarOrig}`);
      });

      // 4. Kiểm tra .add({ days: 1 })
      it('Temporal .add({ days: 1 }) matches next day conversion', () => {
        const nextSolar = solarOrig.add({ days: 1 });
        const nextLunarFromSolar = nextSolar.withCalendar('vietnamese');
        const nextLunarFromAdd = tLunar.add({ days: 1 });

        assert(
          datesEqual(nextLunarFromAdd, nextLunarFromSolar),
          `Temporal .add(days:1) mismatch on ${solarOrig}\n` +
            `  From add:      ${nextLunarFromAdd.year}-${nextLunarFromAdd.monthCode}-${nextLunarFromAdd.day}\n` +
            `  From next day: ${nextLunarFromSolar.year}-${nextLunarFromSolar.monthCode}-${nextLunarFromSolar.day}`
        );
      });
    });

    currentDate = currentDate.add({ days: 1 });
  }
});

import { normalize } from 'path';
if (normalize(import.meta.url.slice(8)) === normalize(process.argv[1])) {
  report(reporter).then((failed) => process.exit(failed ? 1 : 0));
}
