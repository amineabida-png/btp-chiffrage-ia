// Lecteur DXF autonome (sans dépendance). Extrait la géométrie réelle d'un plan :
// longueurs (LINE / POLYLINE / LWPOLYLINE), surfaces (polylignes fermées, cercles),
// textes/légendes (TEXT / MTEXT) et cotes (DIMENSION), groupés par calque.
// Sert à produire un métré PRÉCIS (la géométrie est exacte, contrairement à une lecture visuelle).

export interface GeomDXF {
  unite: string;                 // 'm' (après conversion)
  longueursParCalque: Record<string, number>;  // ML par calque
  surfacesParCalque: Record<string, number>;   // M2 par calque (polylignes fermées + cercles)
  textes: string[];              // légendes / annotations
  cotes: number[];               // valeurs de cotes (DIMENSION)
  resume: string;                // résumé lisible pour l'IA / l'utilisateur
}

type Pair = { code: number; value: string };

function* pairs(content: string): Generator<Pair> {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1];
    if (!Number.isNaN(code)) yield { code, value: value ?? '' };
  }
}

function facteurVersMetre(insunits: number): { f: number; nom: string } {
  // $INSUNITS: 1=pouces 2=pieds 4=mm 5=cm 6=m
  switch (insunits) {
    case 1: return { f: 0.0254, nom: 'pouces' };
    case 2: return { f: 0.3048, nom: 'pieds' };
    case 4: return { f: 0.001, nom: 'mm' };
    case 5: return { f: 0.01, nom: 'cm' };
    case 6: return { f: 1, nom: 'm' };
    default: return { f: 0.001, nom: 'mm (supposé)' }; // par défaut : mm (usuel en BTP)
  }
}

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function aireShoelace(pts: [number, number][]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function parseDXF(content: string): GeomDXF {
  // 1) Unités
  let insunits = 0;
  {
    const all = [...pairs(content)];
    for (let i = 0; i < all.length - 1; i++) {
      if (all[i].code === 9 && all[i].value.trim() === '$INSUNITS') {
        const v = all[i + 1];
        if (v && v.code === 70) insunits = parseInt(v.value.trim(), 10) || 0;
        break;
      }
    }
  }
  const { f, nom: uniteNom } = facteurVersMetre(insunits);

  const longueursParCalque: Record<string, number> = {};
  const surfacesParCalque: Record<string, number> = {};
  const textes: string[] = [];
  const cotes: number[] = [];

  const addLen = (layer: string, v: number) => { longueursParCalque[layer] = (longueursParCalque[layer] || 0) + v; };
  const addArea = (layer: string, v: number) => { surfacesParCalque[layer] = (surfacesParCalque[layer] || 0) + v; };

  // 2) Parcours des entités
  let cur: { type: string } | null = null;
  let layer = '0';
  let text = '';
  // buffers géométrie
  let x: number | null = null, y: number | null = null, x2: number | null = null, y2: number | null = null;
  let radius: number | null = null, dimMeas: number | null = null;
  let polyClosed = false;
  let verts: [number, number][] = [];
  let pendingX: number | null = null;

  const flush = () => {
    if (!cur) return;
    const t = cur.type;
    if (t === 'LINE' && x != null && y != null && x2 != null && y2 != null) {
      addLen(layer, dist([x, y], [x2, y2]) * f);
    } else if ((t === 'LWPOLYLINE' || t === 'POLYLINE') && verts.length >= 2) {
      let per = 0;
      for (let i = 0; i < verts.length - 1; i++) per += dist(verts[i], verts[i + 1]);
      if (polyClosed && verts.length >= 3) {
        per += dist(verts[verts.length - 1], verts[0]);
        addArea(layer, aireShoelace(verts) * f * f);
      }
      addLen(layer, per * f);
    } else if (t === 'CIRCLE' && x != null && y != null && radius != null) {
      addArea(layer, Math.PI * radius * radius * f * f);
      addLen(layer, 2 * Math.PI * radius * f);
    } else if ((t === 'TEXT' || t === 'MTEXT') && text.trim()) {
      const clean = text.replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').trim();
      if (clean) textes.push(clean);
    } else if (t === 'DIMENSION' && dimMeas != null) {
      cotes.push(Math.round(dimMeas * f * 1000) / 1000);
    }
    // reset
    cur = null; layer = '0'; text = ''; x = y = x2 = y2 = radius = dimMeas = null;
    polyClosed = false; verts = []; pendingX = null;
  };

  let inEntities = false;
  let sectionName = '';
  const it = pairs(content);
  for (const p of it) {
    if (p.code === 0) {
      const v = p.value.trim();
      if (v === 'SECTION') { sectionName = ''; continue; }
      if (v === 'ENDSEC') { inEntities = false; flush(); continue; }
      // nouvelle entité -> on clôt la précédente
      flush();
      if (inEntities && v !== 'SEQEND' && v !== 'VERTEX') cur = { type: v };
      if (v === 'VERTEX') cur = cur; // géré via codes 10/20 ci-dessous (POLYLINE)
      continue;
    }
    if (p.code === 2 && sectionName === '') { sectionName = p.value.trim(); if (sectionName === 'ENTITIES') inEntities = true; continue; }
    if (!cur && !inEntities) continue;

    const val = p.value.trim();
    switch (p.code) {
      case 8: layer = val || '0'; break;                 // calque
      case 1: text += val; break;                         // texte
      case 3: text += val; break;                         // MTEXT continuation
      case 10:
        if (cur && (cur.type === 'LWPOLYLINE' || cur.type === 'POLYLINE')) { pendingX = parseFloat(val); }
        else { x = parseFloat(val); }
        break;
      case 20:
        if (cur && (cur.type === 'LWPOLYLINE' || cur.type === 'POLYLINE') && pendingX != null) { verts.push([pendingX, parseFloat(val)]); pendingX = null; }
        else { y = parseFloat(val); }
        break;
      case 11: x2 = parseFloat(val); break;
      case 21: y2 = parseFloat(val); break;
      case 40: if (cur && cur.type === 'CIRCLE') radius = parseFloat(val); break;
      case 42: if (cur && cur.type === 'DIMENSION') dimMeas = parseFloat(val); break;
      case 70: if (cur && (cur.type === 'LWPOLYLINE' || cur.type === 'POLYLINE')) polyClosed = (parseInt(val, 10) & 1) === 1; break;
    }
  }
  flush();

  const round = (n: number) => Math.round(n * 100) / 100;
  for (const k of Object.keys(longueursParCalque)) longueursParCalque[k] = round(longueursParCalque[k]);
  for (const k of Object.keys(surfacesParCalque)) surfacesParCalque[k] = round(surfacesParCalque[k]);

  const lignesL = Object.entries(longueursParCalque).filter(([, v]) => v > 0).map(([k, v]) => `  - Calque "${k}" : ${v} ML`);
  const lignesS = Object.entries(surfacesParCalque).filter(([, v]) => v > 0).map(([k, v]) => `  - Calque "${k}" : ${v} M2`);
  const resume = [
    `Unités du dessin : ${uniteNom} (converti en mètres).`,
    lignesL.length ? `LONGUEURS par calque :\n${lignesL.join('\n')}` : '',
    lignesS.length ? `SURFACES (polylignes fermées) par calque :\n${lignesS.join('\n')}` : '',
    cotes.length ? `COTES relevées : ${cotes.slice(0, 60).join(', ')}` : '',
    textes.length ? `ANNOTATIONS (${textes.length}) : ${textes.slice(0, 80).join(' | ')}` : '',
  ].filter(Boolean).join('\n');

  return { unite: 'm', longueursParCalque, surfacesParCalque, textes, cotes, resume };
}
