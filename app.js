(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);

  const inputs = {
    useInner: $('useInner'),
    innerSpan: $('innerSpan'),
    rootChord: $('rootChord'),
    jointChord: $('jointChord'),
    innerSweep: $('innerSweep'),
    outerSpan: $('outerSpan'),
    outerRootChord: $('outerRootChord'),
    tipChord: $('tipChord'),
    outerSweep: $('outerSweep'),
    cgPercent: $('cgPercent'),
    showConstruction: $('showConstruction')
  };

  const out = {
    macText: $('macText'),
    macDetails: $('macDetails'),
    areaText: $('areaText'),
    spanText: $('spanText'),
    arText: $('arText'),
    innerMacText: $('innerMacText'),
    outerMacText: $('outerMacText'),
    totalMacText: $('totalMacText'),
    xMacText: $('xMacText'),
    yMacText: $('yMacText'),
    cgPercentText: $('cgPercentText'),
    cgOffsetText: $('cgOffsetText'),
    cgXText: $('cgXText'),
    heroY: $('heroY'), heroX: $('heroX'), heroC: $('heroC'), heroCG: $('heroCG'),
    status: $('status'),
    legendInnerMac: $('legendInnerMac'),
    legendInnerExtra: $('legendInnerExtra'),
    legendOuterMac: $('legendOuterMac'),
    legendOuterExtra: $('legendOuterExtra'),
    legendTotalMac: $('legendTotalMac'),
    legendTotalExtra: $('legendTotalExtra')
  };

  const svg = $('scheme');
  const assembly = $('assembly');
  const assemblyPanel = $('assemblyPanel');
  const diagramZoom = $('diagramZoom');
  const diagramWrap = $('diagramWrap');
  const mobileScreen = globalThis.matchMedia?.('(max-width: 850px)');
  let zoomed = false;
  let compact = false;
  let W = 980;
  let H = 740;

  const colors = {
    blue: '#2563eb',
    red: '#dc2626',
    orange: '#ea580c',
    green: '#15803d',
    purple: '#7c3aed',
    cyan: '#0891b2',
    slate: '#334155',
    muted: '#64748b',
    line: '#cbd5e1',
    text: '#172033'
  };

  function val(input) {
    const value = String(input.value).trim().replace(',', '.');
    return value === '' ? NaN : Number(value);
  }

  function fmt(n, digits = 2) {
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('ru-RU', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function calc() {
    return globalThis.WingMACGeometry.calc({
      useInner: inputs.useInner.checked,
      innerSpan: inputs.innerSpan.value,
      rootChord: inputs.rootChord.value,
      jointChord: inputs.jointChord.value,
      innerSweep: inputs.innerSweep.value,
      outerSpan: inputs.outerSpan.value,
      tipChord: inputs.tipChord.value,
      outerSweep: inputs.outerSweep.value,
      cgPercent: inputs.cgPercent.value
    });
  }

  function updateNumbers(data) {
    if (!data.ok) {
      for (const node of Object.values(out)) node.textContent = '—';
      out.macText.textContent = 'Недостаточно данных';
      out.macDetails.textContent = data.message;
      out.status.className = 'status bad';
      out.status.textContent = data.message;
      return;
    }

    out.macText.textContent = `САХ = ${fmt(data.totalMac, 2)} мм`;
    out.heroY.textContent = `${fmt(data.totalY, 2)} мм`;
    out.heroX.textContent = `${data.totalXLE >= 0 ? '+' : '−'}${fmt(Math.abs(data.totalXLE), 2)} мм`;
    out.heroC.textContent = `${fmt(data.totalMac, 2)} мм`;
    out.heroCG.textContent = `${data.cgX >= 0 ? '+' : '−'}${fmt(Math.abs(data.cgX), 2)} мм`;
    out.macDetails.innerHTML =
      `Общая САХ крыла: <b>${fmt(data.totalY, 2)} мм от оси</b>; ` +
      `передняя кромка: <b>${fmt(data.totalXLE, 2)} мм от носка корня</b>.`;

    out.areaText.textContent = `${fmt(data.area / 1_000_000, 2)} м²`;
    out.spanText.textContent = `${fmt(data.fullSpan, 2)} мм`;
    out.arText.textContent = fmt(data.aspectRatio, 2);
    out.innerMacText.textContent = data.inner.active ? `${fmt(data.inner.mac, 2)} мм` : 'нет секции';
    out.outerMacText.textContent = data.outer.active ? `${fmt(data.outer.mac, 2)} мм` : 'нет секции';
    out.totalMacText.textContent = `${fmt(data.totalMac, 2)} мм`;
    out.xMacText.textContent = `${fmt(data.totalXLE, 2)} мм`;
    out.yMacText.textContent = `${fmt(data.totalY, 2)} мм`;
    out.cgPercentText.textContent = `${fmt(data.cgPercent, 2)}% САХ`;
    out.cgOffsetText.textContent = `${fmt(data.cgOffset, 2)} мм`;
    out.cgXText.textContent = `${fmt(data.cgX, 2)} мм`;

    out.legendInnerMac.textContent = data.inner.active ? `${fmt(data.inner.mac, 2)} мм` : 'нет секции';
    out.legendInnerExtra.textContent = data.inner.active
      ? `y = ${fmt(data.inner.yMac, 2)} мм; вклад c² = ${fmt(data.inner.intC2 / 1_000_000, 2)}×10⁶`
      : 'размах внутренней секции равен 0';

    out.legendOuterMac.textContent = data.outer.active ? `${fmt(data.outer.mac, 2)} мм` : 'нет секции';
    out.legendOuterExtra.textContent = data.outer.active
      ? `y = ${fmt(data.outer.yMac, 2)} мм; вклад c² = ${fmt(data.outer.intC2 / 1_000_000, 2)}×10⁶`
      : 'размах внешней секции равен 0';

    out.legendTotalMac.textContent = `${fmt(data.totalMac, 2)} мм`;
    out.legendTotalExtra.textContent = `y = ${fmt(data.totalY, 2)} мм; xLE = ${fmt(data.totalXLE, 2)} мм`;

    let warn = [];
    if (Math.abs(data.sw1) > 35) warn.push('большой угол стреловидности внутренней секции');
    if (Math.abs(data.sw2) > 35) warn.push('большой угол стреловидности внешней секции');
    if (data.aspectRatio < 3) warn.push('малое удлинение');
    if (data.aspectRatio > 18) warn.push('очень большое удлинение');

    if (warn.length) {
      out.status.className = 'status warn';
      out.status.textContent = 'Расчет выполнен, но обрати внимание: ' + warn.join(', ') + '.';
    } else {
      out.status.className = 'status ok';
      out.status.textContent = 'Расчет выполнен. Геометрия выглядит нормально для учебной оценки.';
    }
  }

  function el(name, attrs = {}, parent = svg) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    parent.appendChild(node);
    return node;
  }

  function group(id, parent = svg) {
    return el('g', id ? { id } : {}, parent);
  }

  function line(p1, p2, cls = '', attrs = {}, parent = svg) {
    return el('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      class: cls,
      ...attrs
    }, parent);
  }

  function circle(p, r, fill, parent = svg, attrs = {}) {
    return el('circle', { cx: p.x, cy: p.y, r, fill, ...attrs }, parent);
  }

  function textNode(txt, x, y, attrs = {}, parent = svg) {
    const t = el('text', { x, y, ...attrs }, parent);
    t.textContent = txt;
    return t;
  }

  function polygon(points, attrs = {}, parent = svg) {
    return el('polygon', {
      points: points.map(p => `${p.x},${p.y}`).join(' '),
      ...attrs
    }, parent);
  }

  function path(d, attrs = {}, parent = svg) {
    return el('path', { d, ...attrs }, parent);
  }

  function arrowDef() {
    const defs = el('defs');
    const marker = el('marker', {
      id: 'arrow',
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 3,
      orient: 'auto',
      markerUnits: 'strokeWidth'
    }, defs);
    path('M0,0 L8,3 L0,6 Z', { fill: '#64748b' }, marker);
  }

  let labels = [];

  function labelBox(text, anchor, pos, color, options = {}) {
    labels.push({ text, anchor, y: pos.y, color, left: options.align === 'right' });
  }

  function drawLabels() {
    if (compact) {
      const names = {
        'ось симметрии': 'Ось крыла', 'стык секций': 'Стык секций',
        'общая САХ крыла': 'Общая САХ',
        'САХ внутренней секции': 'САХ внутр.', 'САХ внешней секции': 'САХ внешн.'
      };
      labels.forEach((label, index) => {
        const x = 12 + (index % 2) * (W - 24) / 2;
        const y = H - 104 + Math.floor(index / 2) * 30;
        line({ x, y }, { x: x + 14, y }, '', { stroke: label.color, 'stroke-width': 3 });
        textNode(names[label.text] || label.text.replace(' САХ', ''), x + 20, y + 4, {
          fill: label.color, 'font-size': 12, 'font-weight': 750, 'font-family': 'system-ui'
        });
      });
      return;
    }
    // Separate annotation lanes keep boxes away from the wing and dimensions.
    for (const left of [true, false]) {
      const lane = labels.filter(label => label.left === left).sort((a, b) => a.y - b.y);
      let previousY = 76;
      lane.forEach((label, index) => {
        const y = Math.max(previousY + 34, Math.min(H - 32 - (lane.length - 1 - index) * 34, label.y));
        previousY = y;
        const edgeX = left ? 153 : W - 225;
        const g = group();
        const t = textNode(label.text, edgeX + (left ? -9 : 9), y + 5, {
          fill: label.color, 'font-size': 14, 'font-weight': 750,
          'text-anchor': left ? 'end' : 'start', 'font-family': 'system-ui'
        }, g);
        const width = typeof t.getComputedTextLength === 'function'
          ? t.getComputedTextLength() + 18 : label.text.length * 7.5 + 18;
        const boxX = left ? edgeX - width : edgeX;
        line(label.anchor, { x: edgeX, y }, 'label-leader', { stroke: label.color }, g);
        el('rect', { x: boxX, y: y - 15, width, height: 28, rx: 8, class: 'label-box' }, g);
        // Draw the background over leaders, and the text over the background.
        g.appendChild(t);
        circle(label.anchor, 3.5, label.color, g);
      });
    }
  }

  function arrowLine(p1, p2, parent = svg) {
    line(p1, p2, 'dim', {
      stroke: '#64748b',
      'marker-end': 'url(#arrow)'
    }, parent);
  }

  function drawMiniBox(data) {
    const g = group('mini-assembly', assembly);
    const x = 16, y = 12, w = 320, h = 236;

    el('rect', { x, y, width: w, height: h, rx: 16, fill: 'rgba(255,255,255,0.94)', stroke: '#dbe3ee' }, g);
    textNode('Как получается общая САХ', x + 16, y + 27, {
      fill: colors.text, 'font-size': 14, 'font-weight': 850, 'font-family': 'system-ui'
    }, g);
    textNode('Общая САХ — вклад площадей секций:', x + 16, y + 50, {
      fill: colors.muted, 'font-size': 12, 'font-weight': 650, 'font-family': 'system-ui'
    }, g);

    const total = Math.max(1e-9, data.halfArea);
    const innerShare = data.inner.area / total;
    const outerShare = data.outer.area / total;

    const barX = x + 18, barY = y + 72, barW = w - 36, barH = 22;
    el('rect', { x: barX, y: barY, width: barW * innerShare, height: barH, fill: '#ede9fe' }, g);
    el('rect', { x: barX + barW * innerShare, y: barY, width: barW * outerShare, height: barH, fill: '#cffafe' }, g);
    el('rect', { x: barX, y: barY, width: barW, height: barH, fill: 'none', stroke: '#94a3b8' }, g);

    textNode(`внутр.: ${(innerShare * 100).toFixed(0)}%`, barX, barY + 42, {
      fill: colors.purple, 'font-size': 12, 'font-weight': 800, 'font-family': 'system-ui'
    }, g);
    textNode(`внешн.: ${(outerShare * 100).toFixed(0)}%`, barX + barW, barY + 42, {
      fill: colors.cyan, 'font-size': 12, 'font-weight': 800, 'text-anchor': 'end', 'font-family': 'system-ui'
    }, g);

    const axisX = x + 28;
    const axisY = y + 146;
    const axisW = w - 56;
    line({ x: axisX, y: axisY }, { x: axisX + axisW, y: axisY }, '', {
      stroke: '#cbd5e1', 'stroke-width': 2
    }, g);

    const maxY = data.halfSpan || 1;
    const mx = yVal => axisX + axisW * (yVal / maxY);

    if (data.inner.active) {
      const ix = mx(data.inner.yMac);
      circle({ x: ix, y: axisY }, 6, colors.purple, g);
      textNode('внутр.', ix, axisY - 14, {
        fill: colors.purple, 'font-size': 11, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': 'system-ui'
      }, g);
    }

    if (data.outer.active) {
      const ox = mx(data.outer.yMac);
      circle({ x: ox, y: axisY }, 6, colors.cyan, g);
      textNode('внешн.', ox, axisY - 30, {
        fill: colors.cyan, 'font-size': 11, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': 'system-ui'
      }, g);
    }

    const tx = mx(data.totalY);
    circle({ x: tx, y: axisY }, 7, colors.green, g);
    textNode('итог', tx, axisY + 24, {
      fill: colors.green, 'font-size': 12, 'font-weight': 850, 'text-anchor': 'middle', 'font-family': 'system-ui'
    }, g);

    textNode('y на полукрыле', axisX, axisY + 46, {
      fill: colors.muted, 'font-size': 12, 'font-weight': 650, 'font-family': 'system-ui'
    }, g);

    textNode(`yобщ = ${fmt(data.totalY, 2)} мм`, x + 16, y + h - 18, {
      fill: colors.green, 'font-size': 12, 'font-weight': 850, 'font-family': 'system-ui'
    }, g);
  }

  function drawSectionConstruction(section, map, color, name, showMac) {
    if (!section.active || section.span <= 0) return;

    const g = group();
    const c0 = section.c0;
    const c1 = section.c1;

    const p0LE = map(section.yStart, section.xLE0);
    const p0TE = map(section.yStart, section.xLE0 + c0);
    const p1LE = map(section.yEnd, section.xLE1);
    const p1TE = map(section.yEnd, section.xLE1 + c1);

    const isNearlyRect = Math.abs(c0 - c1) < 1e-6;

    if (!isNearlyRect) {
      const rootExt = map(section.yStart, section.xLE0 + c0 + c1);
      const tipExt = map(section.yEnd, section.xLE1 - c0);
      const rootMid = map(section.yStart, section.xLE0 + c0 / 2);
      const tipMid = map(section.yEnd, section.xLE1 + c1 / 2);

      line(p0TE, rootExt, 'construction', {}, g);
      line(p1LE, tipExt, 'construction', {}, g);
      line(tipExt, rootExt, 'construction', {}, g);
      line(rootMid, tipMid, 'construction-mid', {}, g);

      circle(rootExt, 3.8, colors.orange, g);
      circle(tipExt, 3.8, colors.orange, g);
    }

    if (!showMac) return;
    const macP1 = map(section.yMac, section.xMacLE);
    const macP2 = map(section.yMac, section.xMacLE + section.mac);
    line(macP1, macP2, '', {
      stroke: color,
      'stroke-width': 3.2,
      'stroke-linecap': 'round',
      'vector-effect': 'non-scaling-stroke'
    }, g);
    circle(map(section.yMac, section.xMacLE + section.mac * 0.5), 5.2, color, g);

    const isInnerSection = section.yStart < 1e-9;
    const labelPos = isInnerSection
      ? { x: macP2.x + 42, y: macP2.y + 16 }
      : { x: macP2.x + 36, y: macP2.y - 26 };

    labelBox(name, macP2, labelPos, color, { align: 'left' });
  }

  function drawSVG(data) {
    compact = Boolean(mobileScreen?.matches) && !zoomed;
    $('results').setAttribute('data-compact', String(compact));
    W = compact ? Math.max(250, svg.clientWidth || 320) : 980;
    H = compact ? 620 : 740;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    assembly.innerHTML = '';
    assemblyPanel.hidden = !data.ok || !inputs.showConstruction.checked;
    labels = [];
    arrowDef();

    textNode(compact ? 'Правое полукрыло' : 'Правое полукрыло, вид сверху', compact ? 16 : 28, 30, { class: 'svg-title' });

    if (!data.ok) {
      textNode('Введите корректные размеры', W / 2, 250, {
        fill: '#991b1b', 'font-size': compact ? 14 : 18, 'font-weight': 800, 'font-family': 'system-ui', 'text-anchor': 'middle'
      });
      return;
    }

    const { cRoot, effectiveJointChord: cJoin, cTip, b1, halfSpan } = data;
    const xJoin = data.inner.xLE1;
    const xTip = data.outer.xLE1;

    const sections = [data.inner, data.outer].filter(section => section.active);
    const xs = [
      0, cRoot, data.totalXLE, data.totalXLE + data.totalMac, data.cgX
    ];
    for (const section of sections) {
      xs.push(section.xLE0, section.xLE0 + section.c0, section.xLE1, section.xLE1 + section.c1);
      if (inputs.showConstruction.checked && Math.abs(section.c0 - section.c1) >= 1e-6) {
        xs.push(section.xLE0 + section.c0 + section.c1, section.xLE1 - section.c0);
      }
    }

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = 0;
    const yMax = halfSpan;

    const marginL = compact ? 52 : 225, marginR = compact ? 26 : 260;
    const marginT = compact ? 100 : 120, marginB = compact ? 210 : 100;
    const availableW = W - marginL - marginR;
    const availableH = H - marginT - marginB;
    const scale = Math.min(
      availableW / Math.max(1, xMax - xMin),
      availableH / Math.max(1, yMax - yMin)
    );

    const offsetX = marginL - xMin * scale;
    const offsetY = marginT - yMin * scale;

    const map = (y, x) => ({ x: offsetX + x * scale, y: offsetY + y * scale });

    const pRootLE = map(0, 0);
    const pRootTE = map(0, cRoot);
    const pJoinLE = map(b1, xJoin);
    const pJoinTE = map(b1, xJoin + cJoin);
    const pTipLE = map(halfSpan, xTip);
    const pTipTE = map(halfSpan, xTip + cTip);

    const wingPts = [pRootLE];
    if (data.hasInner && data.hasOuter) wingPts.push(pJoinLE);
    wingPts.push(pTipLE, pTipTE);
    if (data.hasInner && data.hasOuter) wingPts.push(pJoinTE);
    wingPts.push(pRootTE);

    const wingG = group('wing');
    polygon(wingPts, { class: 'wing-fill' }, wingG);
    polygon(wingPts, { class: 'wing-outline' }, wingG);

    // Coordinate axes: origin at the root leading edge.
    const axesG = group('coord-axes');
    const axesOrigin = pRootLE;
    const xAxisEnd = { x: compact ? Math.min(W - 16, axesOrigin.x + 48) : axesOrigin.x + 84, y: axesOrigin.y };
    const yAxisEnd = { x: axesOrigin.x, y: axesOrigin.y + (compact ? 48 : 84) };

    line(axesOrigin, xAxisEnd, '', {
      stroke: '#475569',
      'stroke-width': 1.7,
      'marker-end': 'url(#arrow)',
      'vector-effect': 'non-scaling-stroke'
    }, axesG);
    line(axesOrigin, yAxisEnd, '', {
      stroke: '#475569',
      'stroke-width': 1.7,
      'marker-end': 'url(#arrow)',
      'vector-effect': 'non-scaling-stroke'
    }, axesG);
    circle(axesOrigin, 3.5, '#475569', axesG);
    textNode('X', xAxisEnd.x + (compact ? -8 : 10), xAxisEnd.y - (compact ? 24 : 8), {
      fill: '#475569', 'font-size': 12, 'font-weight': 800, 'font-family': 'system-ui'
    }, axesG);
    textNode('Y', yAxisEnd.x - 16, yAxisEnd.y + 8, {
      fill: '#475569', 'font-size': 12, 'font-weight': 800, 'font-family': 'system-ui'
    }, axesG);
    textNode('(0, 0)', axesOrigin.x - 2, axesOrigin.y - 8, {
      fill: '#475569', 'font-size': 11, 'font-weight': 700, 'font-family': 'system-ui',
      'text-anchor': compact ? 'end' : 'start'
    }, axesG);

    line(map(0, xMin + 10), map(0, xMax - 10), 'axis-line');

    if (b1 > 0 && data.outer.active) {
      line(pJoinLE, pJoinTE, 'join-line');
    }

    labelBox('ось симметрии', map(0, cRoot * 0.08), { x: pRootLE.x - 24, y: pRootLE.y + 34 }, colors.slate, { align: 'right' });

    if (b1 > 0 && data.outer.active) {
      labelBox('стык секций', pJoinLE, { x: pJoinLE.x - 34, y: pJoinLE.y + 18 }, colors.muted, { align: 'right' });
    }

    if (inputs.showConstruction.checked) {
      drawSectionConstruction(data.inner, map, colors.purple, 'САХ внутренней секции', sections.length > 1);
      drawSectionConstruction(data.outer, map, colors.cyan, 'САХ внешней секции', sections.length > 1);
    }

    const pMac1 = map(data.totalY, data.totalXLE);
    const pMac2 = map(data.totalY, data.totalXLE + data.totalMac);
    const pMac1Axis = map(0, data.totalXLE);
    const pMac2Axis = map(0, data.totalXLE + data.totalMac);

    line(pMac1, pMac2, 'mac-total');
    line(pMac1, pMac1Axis, 'projection');
    line(pMac2, pMac2Axis, 'projection');

    const pCG = map(data.totalY, data.cgX);
    circle(pCG, 7, '#dc2626', svg, {stroke:'#ffffff','stroke-width':2});
    labelBox(`ЦТ ${fmt(data.cgPercent, 2)}% САХ`, pCG,
      { x: pCG.x + 39, y: pCG.y - 28 }, colors.red, { align: 'left' });
    labelBox('общая САХ крыла', pMac1, { x: pMac1.x - 36, y: pMac1.y + 16 }, colors.green, { align: 'right' });

    // Dimensions.
    const dimX = compact ? 32 : 195;
    arrowLine({ x: dimX, y: map(0, 0).y }, { x: dimX, y: map(halfSpan, 0).y });
    arrowLine({ x: dimX, y: map(halfSpan, 0).y }, { x: dimX, y: map(0, 0).y });
    const dimMidY = (pRootLE.y + pTipLE.y) / 2;
    textNode(`полуразмах ${fmt(halfSpan, 2)} мм`, dimX - 12, dimMidY, {
      fill: colors.muted, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'system-ui',
      transform: `rotate(-90 ${dimX - 12} ${dimMidY})`
    });

    const chordY = pRootTE.y - 38;
    arrowLine({ x: pRootLE.x, y: chordY }, { x: pRootTE.x, y: chordY });
    arrowLine({ x: pRootTE.x, y: chordY }, { x: pRootLE.x, y: chordY });
    const dimensionX = value => compact ? Math.max(68, Math.min(W - 68, value)) : value;
    textNode(`c0 ${fmt(cRoot, 2)} мм`, dimensionX((pRootLE.x+pRootTE.x)/2), chordY - 10, {
      fill: colors.muted, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'system-ui'
    });

    const tipY = pTipLE.y + 34;
    arrowLine({ x: pTipLE.x, y: tipY }, { x: pTipTE.x, y: tipY });
    arrowLine({ x: pTipTE.x, y: tipY }, { x: pTipLE.x, y: tipY });
    textNode(`ct ${fmt(cTip, 2)} мм`, dimensionX((pTipLE.x+pTipTE.x)/2), tipY + 24, {
      fill: colors.muted, 'font-size': 14, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'system-ui'
    });

    if (inputs.showConstruction.checked) {
      drawMiniBox(data);
    }
    drawLabels();
  }

  let savedInnerSpan = val(inputs.innerSpan);
  let previousInnerEnabled;
  const signedFields = ['innerSweep', 'outerSweep', 'cgPercent'];

  function syncSectionControls() {
    const span = val(inputs.innerSpan);
    if (inputs.useInner.checked && span > 0) savedInnerSpan = span;
    if (span === 0) inputs.useInner.checked = false;
    const hasInner = inputs.useInner.checked && span > 0;
    const enabled = inputs.useInner.checked;
    if (enabled !== previousInnerEnabled) {
      $('innerSection').open = enabled;
      if (!enabled) $('outerSection').open = true;
      previousInnerEnabled = enabled;
    }
    inputs.innerSpan.disabled = !inputs.useInner.checked;
    inputs.rootChord.disabled = !enabled;
    inputs.jointChord.disabled = !hasInner;
    inputs.innerSweep.disabled = !hasInner;
    inputs.outerRootChord.readOnly = enabled;
    inputs.outerRootChord.value = enabled ? inputs.jointChord.value : inputs.rootChord.value;
    $('outerRootHint').textContent = enabled
      ? 'Равна конечной хорде внутренней секции; изменяется там.'
      : 'Корневая хорда всего крыла у оси симметрии.';
    const noOuter = val(inputs.outerSpan) === 0;
    inputs.tipChord.disabled = noOuter;
    inputs.outerSweep.disabled = noOuter;
    for (const name of signedFields) {
      $(name + 'Sign').disabled = inputs[name].disabled || inputs[name].readOnly || !Number.isFinite(val(inputs[name]));
    }
  }

  function update() {
    syncSectionControls();
    const data = calc();
    updateNumbers(data);
    drawSVG(data);
  }

  Object.values(inputs).forEach(input => input.addEventListener('input', () => {
    if (input === inputs.useInner) {
      inputs.innerSpan.value = inputs.useInner.checked ? savedInnerSpan : 0;
    }
    if (input === inputs.outerRootChord && !inputs.useInner.checked) {
      inputs.rootChord.value = inputs.outerRootChord.value;
    }
    update();
  }));
  for (const [name, input] of Object.entries(inputs)) {
    if (name === 'useInner' || name === 'showConstruction') continue;
    // Select after the click's default caret placement, and on keyboard focus.
    input.addEventListener('focus', () => input.select());
    input.addEventListener('click', () => input.select());
  }
  for (const name of signedFields) {
    $(name + 'Sign').addEventListener('click', () => {
      const input = inputs[name];
      const value = val(input);
      if (input.disabled || input.readOnly || !Number.isFinite(value)) return;
      input.value = String(-value);
      update();
    });
  }
  diagramZoom.addEventListener('click', () => {
    zoomed = !zoomed;
    diagramWrap.setAttribute('data-zoomed', String(zoomed));
    diagramZoom.setAttribute('aria-pressed', String(zoomed));
    diagramZoom.textContent = zoomed ? 'Вписать в экран' : 'Увеличить';
    update();
    centerDiagram();
  });
  update();
  function centerDiagram() {
    const wrap = svg.parentElement;
    if (wrap) wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
  }
  globalThis.addEventListener?.('resize', () => {
    update();
    centerDiagram();
  });
  centerDiagram();
})();
