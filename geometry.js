// Pure wing geometry: lengths in mm, sweep in degrees. No DOM dependencies.
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WingMACGeometry = api;
})(globalThis, () => {
  'use strict';

  function numeric(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    return text === '' ? NaN : Number(text);
  }

  function rad(deg) {
    return deg * Math.PI / 180;
  }

  function sectionCalc(yStart, span, c0, c1, xLE0, sweepDeg) {
    const sweepRad = rad(sweepDeg);
    const xLE1 = xLE0 + span * Math.tan(sweepRad);
    const area = span * (c0 + c1) / 2;

    if (span <= 0 || area <= 0) {
      return {
        active: false,
        yStart, yEnd: yStart, span,
        c0, c1, xLE0, xLE1, sweepDeg,
        area: 0, intC2: 0, momentY: 0, momentXLE: 0,
        mac: c0, yMac: yStart, xMacLE: xLE0, x25: xLE0 + c0 * 0.25
      };
    }

    const intC2 = span * (c0 * c0 + c0 * c1 + c1 * c1) / 3;
    const mac = intC2 / area;

    const yLocalMac = span * (c0 + 2 * c1) / (3 * (c0 + c1));
    const yMac = yStart + yLocalMac;
    const xMacLE = xLE0 + yLocalMac * Math.tan(sweepRad);
    const x25 = xMacLE + mac * 0.25;

    const k = (c1 - c0) / span;
    const t = Math.tan(sweepRad);

    const localMomentY =
      c0 * c0 * span * span / 2 +
      2 * c0 * k * span * span * span / 3 +
      k * k * span * span * span * span / 4;

    const momentY = yStart * intC2 + localMomentY;
    const momentXLE = xLE0 * intC2 + t * localMomentY;

    return {
      active: true,
      yStart, yEnd: yStart + span, span,
      c0, c1, xLE0, xLE1, sweepDeg,
      area, intC2, momentY, momentXLE,
      mac, yLocalMac, yMac, xMacLE, x25
    };
  }


  function calc(values) {
    const b1 = (values.useInner !== false) ? numeric(values.innerSpan) : 0;
    const cRoot = numeric(values.rootChord);
    const b2 = numeric(values.outerSpan);
    const cgPercent = numeric(values.cgPercent);

    if (![b1, b2, cRoot, cgPercent].every(Number.isFinite)) {
      return { ok: false, message: 'Заполните размахи, корневую хорду и центровку числами.' };
    }
    if (b1 < 0 || b2 < 0 || cRoot <= 0 || b1 + b2 <= 0) {
      return { ok: false, message: 'Размахи не могут быть отрицательными или одновременно нулевыми. Корневая хорда должна быть больше нуля.' };
    }
    if (cgPercent < -100 || cgPercent > 200) {
      return { ok: false, message: 'Задайте центровку в диапазоне от −100% до 200% САХ.' };
    }

    const hasInner = b1 > 0;
    const hasOuter = b2 > 0;
    // Unused fields must not affect validation, geometry or drawing bounds.
    const cJointRaw = hasInner ? numeric(values.jointChord) : cRoot;
    const effectiveJointChord = hasInner ? cJointRaw : cRoot;
    const cTip = hasOuter ? numeric(values.tipChord) : effectiveJointChord;
    const sw1 = hasInner ? numeric(values.innerSweep) : 0;
    const sw2 = hasOuter ? numeric(values.outerSweep) : 0;
    if (![cJointRaw, cTip, sw1, sw2].every(Number.isFinite) ||
        cJointRaw < 0 || cTip < 0 || (hasOuter && effectiveJointChord <= 0)) {
      return { ok: false, message: 'Заполните хорды и стреловидность используемых секций. Концевая хорда может быть нулевой, корневая хорда секции должна быть положительной.' };
    }
    if (Math.abs(sw1) >= 90 || Math.abs(sw2) >= 90) {
      return { ok: false, message: 'Стреловидность используемой секции должна быть строго между −90° и 90°.' };
    }

    const inner = sectionCalc(0, b1, cRoot, effectiveJointChord, 0, sw1);
    const outer = sectionCalc(b1, b2, effectiveJointChord, cTip, inner.xLE1, sw2);

    const halfSpan = b1 + b2;
    const fullSpan = 2 * halfSpan;
    const halfArea = inner.area + outer.area;
    const area = 2 * halfArea;

    if (halfArea <= 0 || fullSpan <= 0) {
      return { ok: false, message: 'Размах и площадь должны быть больше нуля.' };
    }

    // MAC chord length: area-weighted section MACs.
    const totalIntC2 = inner.intC2 + outer.intC2;
    const totalMac = totalIntC2 / halfArea;

    // MAC reference line coordinates: area-weighted positions of the
    // corresponding section MAC reference lines (not c²-weighted).
    // On one trapezoid these coincide with its geometrically constructed MAC.
    const totalY = (inner.area * inner.yMac + outer.area * outer.yMac) / halfArea;
    const totalXLE = (inner.area * inner.xMacLE + outer.area * outer.xMacLE) / halfArea;
    const totalX25 = totalXLE + totalMac * 0.25;
    const cgOffset = totalMac * cgPercent / 100;
    const cgX = totalXLE + cgOffset;
    const aspectRatio = fullSpan * fullSpan / area;
    if (![area, fullSpan, totalMac, totalY, totalXLE, cgX, aspectRatio,
          inner.xLE1, outer.xLE1].every(Number.isFinite) || totalMac <= 0 || aspectRatio <= 0) {
      return { ok: false, message: 'Слишком большие или малые значения для расчёта. Проверьте размеры крыла.' };
    }

    return {
      ok: true,
      hasInner, hasOuter,
      b1, cRoot, cJointRaw, effectiveJointChord, sw1, b2, cTip, sw2,
      inner, outer,
      halfSpan, fullSpan, halfArea, area,
      totalIntC2, totalMac, totalY, totalXLE, totalX25,
      cgPercent, cgOffset, cgX, aspectRatio
    };
  }

  return Object.freeze({ sectionCalc, calc });
});
