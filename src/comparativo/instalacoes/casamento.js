// Associa cada item da lista do QiBuilder a um preço de referência (SINAPI MG) por tipo de peça e bitola.
// Quando não há composição exata, estima por equivalência (marcado como "estimado"); sem referência → preço manual.
import { R } from "./baseSinapi.js";

export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’'´`]/g, "'").replace(/\s+/g, " ").trim();
export const chaveItem = it => norm(`${it.grupo}|${it.descricao}|${it.item}|${it.un}`);

// números em mm ("50 mm - 25 mm", "28 x 22", "100mm- 100 mm")
function mms(txt) {
  const t = norm(txt);
  let v = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*mm(?!²|2)/g)].map(m => parseFloat(m[1].replace(",", ".")));
  if (!v.length) v = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/g)].flatMap(m => [parseFloat(m[1]), parseFloat(m[2])]);
  if (!v.length) { const m = t.match(/^(\d+(?:[.,]\d+)?)/); if (m) v = [parseFloat(m[1].replace(",", "."))]; }
  return v;
}
// polegadas: 3/4", 1", 1.1/2", 1 1/2", 2. 1/2'', 1/2 - 30cm
function pol(txt) {
  const t = norm(txt).replace(/''/g, '"');
  let m = t.match(/(\d+)\s*[. ]\s*(\d+)\/(\d+)/);
  if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(/(\d+)\/(\d+)/);
  if (m) return +m[1] / +m[2];
  m = t.match(/(\d+(?:[.,]\d+)?)\s*"/);
  if (m) return parseFloat(m[1].replace(",", "."));
  return null;
}
const perto = (v, lista) => lista.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), lista[0]);

const ok = (refKey, extra = {}) => ({ refKey, fator: 1, estimado: false, ...extra });
const est = (refKey, fator, nota) => ({ refKey, fator, estimado: true, nota });
const incluido = nota => ({ refKey: null, incluido: true, nota });
const manual = nota => ({ refKey: null, manual: true, nota: nota || "Sem referência SINAPI: informe o preço" });

// ── tabelas por bitola ──
const AF_J = { 20: "af_joelho_20", 25: "af_joelho_25", 32: "af_joelho_32", 40: "af_joelho_40", 50: "af_joelho_50" };
const AF_T = { 20: "af_tubo_20", 25: "af_tubo_25", 32: "af_tubo_32", 40: "af_tubo_40", 50: "af_tubo_50" };
function afJoelho(d, f = 1, nota) {
  if (AF_J[d]) return f === 1 && !nota ? ok(AF_J[d]) : est(AF_J[d], f, nota);
  if (d > 50) return est("af_joelho_50", f * (d / 50) ** 1.3, nota || "Estimado a partir do DN 50");
  const p = perto(d, [20, 25, 32, 40, 50]);
  return est(AF_J[p], f, nota || `Estimado a partir do DN ${p}`);
}
const AQ_J = { 22: "aq_joelho_22", 28: "aq_joelho_28", 54: "aq_joelho_54" };
function aqJoelho(d, f = 1, nota) {
  if (AQ_J[d]) return f === 1 && !nota ? ok(AQ_J[d]) : est(AQ_J[d], f, nota);
  if (d < 22) return est("aq_joelho_22", f * 0.8, nota || "Estimado a partir do DN 22");
  if (d < 54) return est("aq_joelho_28", f * (1 + (d - 28) / 26 * 2.7), nota || "Estimado entre DN 28 e DN 54");
  return est("aq_joelho_54", f * d / 54, nota || "Estimado a partir do DN 54");
}
const ES_J = { 40: "es_joelho_40", 50: "es_joelho_50", 75: "es_joelho_75", 100: "es_joelho_100" };
const esJoelho = (d, f, nota) => est(ES_J[perto(d, [40, 50, 75, 100])], f * (d > 100 ? d / 100 : 1), nota);
const ES_L = { 40: "es_luva_40", 50: "es_luva_50", 75: "es_luva_75", 100: "es_luva_100" };
const esLuva = (d, f = 1, nota) => (ES_L[d] && f === 1 ? ok(ES_L[d]) : est(ES_L[perto(d, [40, 50, 75, 100])], f * (d > 100 ? d / 100 : 1), nota || "Estimado por equivalência"));
const REG = { 0.75: "reg_gaveta_34", 1: "reg_gaveta_1", 1.25: "reg_gaveta_114", 1.5: "reg_gaveta_112", 2: "reg_gaveta_2" };

export function casar(it) {
  const g = norm(it.grupo), d = norm(it.descricao), i = norm(it.item), tudo = `${g} ${d} ${i}`;
  const mm = mms(it.item);
  const dn = mm.length ? Math.max(...mm) : null;

  // ── ELÉTRICA ──
  if (/cabo unipolar|isol\.?pvc|450\/750|0,6\/1/.test(tudo) && /mm²|mm2/.test(i)) {
    const s = parseFloat((i.match(/(\d+(?:[.,]\d+)?)\s*mm[²2]/) || [])[1]?.replace(",", "."));
    const T = { 1.5: "cabo_1_5", 2.5: "cabo_2_5", 4: "cabo_4", 6: "cabo_6", 10: "cabo_10", 16: "cabo_16", 25: "cabo_25", 50: "cabo_50" };
    if (T[s]) return ok(T[s]);
    if (s === 35) return est("cabo_25", (35.6 + 71.61) / 2 / 35.6, "Estimado entre 25 mm² e 50 mm²");
    if (s > 50) return est("cabo_50", s / 50, "Estimado a partir de 50 mm²");
    if (s) return est(T[perto(s, [1.5, 2.5, 4, 6, 10, 16, 25, 50])], 1, "Estimado pela seção mais próxima");
  }
  if (/cabo (de )?cobre nu/.test(tudo)) return manual();
  if (/eletroduto/.test(tudo)) {
    const p = pol(it.item) || 0.75;
    if (/rosca|rigido/.test(tudo)) return p === 2.5 ? ok("eletro_rosca_212") : est("eletro_rosca_212", p / 2.5, "Estimado a partir do 2.1/2\" (material)");
    if (/pesado|reforcado/.test(tudo)) {
      if (p <= 0.75) return est("eletro_32r", 0.85, "Estimado: reforçado DN 25");
      if (p <= 1) return ok("eletro_32r");
      if (p <= 1.25) return est("eletro_40", 1, "Referência: corrugado PEAD DN 40");
      return est("eletro_40", 1 + (p - 1.25) * 0.55, "Estimado a partir do DN 40");
    }
    if (p <= 0.5) return est("eletro_25", 0.9, "Estimado a partir do 3/4\"");
    if (p <= 0.75) return ok("eletro_25");
    if (p <= 1) return ok("eletro_32");
    return est("eletro_40", 1 + (p - 1.25) * 0.55, "Estimado a partir do DN 40");
  }
  if (/arruela|bucha zamak|bucha de zamak/.test(tudo)) return manual();
  if (/curva .*pvc rosca|curva .*rosca/.test(tudo) && /eletrodut/.test(g)) return est("eletro_rosca_212", (pol(it.item) || 2.5) / 2.5, "Estimado: equivalente a 1 m de eletroduto (material)");
  if (/caixa (de )?luz|caixa pvc/.test(d) && /eletrodut/.test(g)) {
    if (/octogonal/.test(d)) return ok("cx_octogonal");
    if (/4\s*"?\s*x\s*4/.test(i)) return ok("cx_4x4");
    return ok("cx_4x2");
  }
  if (/caixa de passagem/.test(g) && /aco|chapa|lukbox|moratori/.test(d)) {
    const dim = Math.max(...((it.item.match(/\d+/g) || [150]).map(Number)));
    return est(dim <= 200 ? "cx_passagem_20" : "cx_passagem_40", 1, "Referência: caixa metálica de embutir (padrão Telebras)");
  }
  if (/dispositivo (eletrico|logica)/.test(g) || /placa|tomada|interruptor|pulsador|cigarra|rj45|coaxial/.test(`${d} ${i}`) && /dispositivo/.test(g)) {
    const t = `${d} ${i}`;
    if (/rj ?45/.test(t)) return ok("rj45");
    if (/coaxial|antena/.test(t)) return est("coaxial", 1, "Insumo SINAPI (conjunto montado), sem mão de obra");
    if (/cigarra/.test(t)) return ok("cigarra");
    if (/pulsador/.test(t)) return ok("pulsador");
    if (/^placa|placa (p\/|c\/|cega)|placa p\//.test(i)) return ok(/4x4/.test(d) ? "placa_4x4" : "placa_4x2");
    if (/tomada/.test(t)) {
      if (/20 ?a/.test(t)) return ok("tom_20");
      if (/\(3\)/.test(t)) return est("tom_10", 2.7, "Estimado: 3 módulos");
      if (/\(2\)/.test(t)) return ok("tom_10x2");
      return ok("tom_10");
    }
    if (/interruptor/.test(t)) {
      const n = +((t.match(/(\d)\s*tecla/) || [])[1] || 1);
      if (/intermediario/.test(t)) return est("int_p1", 1.6 * n, "Estimado a partir do interruptor paralelo");
      if (/paralelos? & simples|paralelos e simples/.test(t)) return est("int_p2", (54.26 + 21.59) / 54.26, "Estimado: 2 paralelos + 1 simples");
      const pre = /paralelo/.test(t) ? "int_p" : "int_s";
      return n <= 3 ? ok(pre + n) : est(pre + "3", n / 3, "Estimado por número de teclas");
    }
  }
  if (/disjuntor/.test(d)) {
    const a = parseFloat((i.match(/(\d+)\s*a\b/) || [])[1]) || 10;
    if (/tripolar/.test(d)) {
      if (a <= 50) return ok("dj_t50");
      if (a <= 100) return ok("dj_t100");
      if (a <= 125) return ok("dj_t125");
      return est("dj_t125", a / 125, "Estimado a partir de 125 A");
    }
    if (/bipolar/.test(d)) {
      if (a <= 10) return ok("dj_b10");
      if (a === 32) return ok("dj_b32");
      if (a < 32) return est("dj_b10", 1 + (a - 10) / 22 * (75.01 / 67.18 - 1), "Interpolado entre 10 A e 32 A");
      return est("dj_b32", 1 + (a - 32) / 100, "Estimado a partir de 32 A");
    }
    if (a <= 10) return ok("dj_m10");
    if (a === 20) return ok("dj_m20");
    if (a === 32) return ok("dj_m32");
    if (a < 20) return est("dj_m10", 1 + (a - 10) / 10 * (15.10 / 14 - 1), "Interpolado entre 10 A e 20 A");
    if (a < 32) return est("dj_m20", 1 + (a - 20) / 12 * (17.98 / 15.10 - 1), "Interpolado entre 20 A e 32 A");
    return est("dj_m32", 1 + (a - 32) / 64, "Estimado a partir de 32 A");
  }
  if (/\bdr\b|diferencial/.test(d)) {
    const a = parseFloat((i.match(/(\d+)\s*a\b/) || [])[1]) || 40;
    const nota = "Insumo SINAPI (sem mão de obra)";
    if (a <= 40) return est("dr_40", 1, nota);
    if (a <= 63) return est("dr_63", 1, nota);
    if (a <= 80) return est("dr_80", 1, nota);
    return est("dr_80", a / 80, "Estimado a partir do DR 80 A (insumo)");
  }
  if (/surto|dps/.test(d)) return ok("dps");
  if (/quadro distrib/.test(g)) {
    const n = parseFloat((i.match(/cap\.?\s*(\d+)/) || [])[1]) || 24;
    if (n <= 18) return ok("quadro_18");
    if (n <= 40) return n === 40 ? ok("quadro_40") : est("quadro_40", 1, "Referência: quadro para 40 disjuntores");
    return est("quadro_40", 1 + (n - 40) / 40 * 0.6, `Estimado para ${n} disjuntores`);
  }
  if (/haste (de )?aterramento/.test(d)) return ok("haste");
  if (/caixa (de )?inspecao/.test(d)) return est("cx_inspecao", 1, "Referência: caixa de inspeção Ø 0,30 m");
  if (/quadro de medicao|entrada servico|entrada de servico/.test(g)) return manual("Padrão de entrada (concessionária): informe o preço");

  // ── HIDROSSANITÁRIO ──
  if (/anel de borracha/.test(d)) return incluido("Incluído nas conexões de junta elástica (SINAPI)");
  if (/vedacao p\/ saida de vaso|anel de vedacao/.test(d)) return incluido("Incluída na instalação da bacia sanitária (SINAPI)");
  if (/grelha/.test(d)) return incluido("Incluída na caixa sifonada com grelha (SINAPI)");

  if (/cpvc|aquatherm/.test(g)) {
    const d0 = mm[0] || dn || 22;
    if (/tubo/.test(d)) {
      const T = { 22: "aq_tubo_22", 28: "aq_tubo_28", 54: "aq_tubo_54" };
      if (T[d0]) return ok(T[d0]);
      if (d0 < 22) return est("aq_tubo_22", 0.7, "Estimado a partir do DN 22");
      return est("aq_tubo_28", 1 + (d0 - 28) / 26 * (92.31 / 45.51 - 1), "Estimado entre DN 28 e DN 54");
    }
    if (/transicao/.test(d) && /joelho/.test(d)) return ok(pol(it.item) >= 0.75 ? "aq_jtrans_34" : "aq_jtrans_12");
    if (/transposicao/.test(d)) return d0 === 22 ? ok("aq_transp_22") : est("aq_transp_22", d0 / 22, "Estimado a partir do DN 22");
    if (/joelho 45/.test(d)) return aqJoelho(d0, 1.05, "Estimado a partir do joelho 90°");
    if (/joelho/.test(d)) return aqJoelho(d0);
    if (/curva/.test(d)) return d0 === 22 ? ok("aq_curva_22") : aqJoelho(d0, 1.2, "Estimado a partir do joelho 90°");
    if (/te de reducao|te red/.test(d)) return dn === 28 ? ok("aq_tered_28") : aqJoelho(dn, 1.5, "Estimado a partir do joelho 90°");
    if (/\bte\b|tê/.test(d)) return d0 === 22 ? ok("aq_te_22") : aqJoelho(d0, 1.31, "Estimado a partir do joelho 90°");
    if (/conector/.test(d)) {
      if (d0 === 22) return ok("aq_conector_22");
      if (d0 === 28) return ok("aq_conector_28");
      if (d0 === 54) return ok("aq_conector_54");
      return est(d0 < 54 ? "aq_conector_28" : "aq_conector_54", d0 < 54 ? 1 + (d0 - 28) / 26 * 4.2 : d0 / 54, "Estimado por bitola");
    }
    if (/uniao/.test(d)) return d0 === 22 ? ok("aq_uniao_22") : est("aq_uniao_22", d0 / 22 * 1.2, "Estimado a partir do DN 22");
    if (/bucha/.test(d)) return aqJoelho(dn, 0.8, "Estimado a partir do joelho 90°");
    if (/luva/.test(d)) return aqJoelho(d0, 0.75, "Estimado a partir do joelho 90°");
  }
  if (/cobre/.test(g)) return aqJoelho(dn || 22, 0.75, "Estimado: luva equivalente em CPVC");

  if (/pvc (rigido |misto )?soldavel|pvc soldavel azul|soldavel/.test(g) && !/esgoto/.test(g)) {
    const d0 = mm[0] || dn || 25;
    if (/^tubo/.test(d)) {
      if (AF_T[d0]) return ok(AF_T[d0]);
      if (d0 > 50) return est("af_tubo_50", (d0 / 50) ** 1.5, "Estimado a partir do DN 50");
      return est(AF_T[perto(d0, [20, 25, 32, 40, 50])], 1, "Estimado pela bitola mais próxima");
    }
    if (/joelho de reducao.*bucha|joelho .*reducao.*latao/.test(d)) return est("af_jbucha_25", 0.95, "Estimado a partir do joelho com bucha 25 × 3/4\"");
    if (/joelho.*bucha|bucha de latao/.test(d)) return d0 === 25 ? ok("af_jbucha_25") : afJoelho(d0, 1.95, "Estimado a partir do joelho 90°");
    if (/joelho.*rosca/.test(d)) return d0 === 25 ? ok("af_jrosca_25") : afJoelho(d0, 1.07, "Estimado a partir do joelho 90°");
    if (/joelho 45/.test(d)) return afJoelho(d0, 1, "Referência: joelho 90° da mesma bitola");
    if (/joelho/.test(d)) return afJoelho(d0);
    if (/transposicao/.test(d)) return afJoelho(d0, 1.65, "Estimado a partir do joelho 90°");
    if (/curva 45/.test(d)) return afJoelho(d0, 1.15, "Estimado a partir do joelho 90°");
    if (/curva/.test(d)) {
      const C = { 20: "af_curva_20", 25: "af_curva_25", 50: "af_curva_50" };
      return C[d0] ? ok(C[d0]) : afJoelho(d0, 1.27, "Estimado a partir do joelho 90°");
    }
    if (/te de reducao/.test(d)) return dn === 25 && mm.includes(20) ? ok("af_tered_25") : afJoelho(dn, 1.58, "Estimado a partir do joelho 90°");
    if (/\bte\b|tê/.test(d)) {
      const T = { 20: "af_te_20", 25: "af_te_25", 32: "af_te_32" };
      return T[d0] ? ok(T[d0]) : afJoelho(d0, 1.385, "Estimado a partir do joelho 90°");
    }
    if (/luva de reducao/.test(d)) return afJoelho(dn, 0.8, "Estimado a partir do joelho 90°");
    if (/luva/.test(d)) return d0 === 25 ? ok("af_luva_25") : afJoelho(d0, 0.75, "Estimado a partir do joelho 90°");
    if (/bucha/.test(d)) return afJoelho(dn, 0.7, "Estimado a partir do joelho 90°");
    if (/uniao/.test(d)) return d0 === 25 ? ok("af_uniao_25") : afJoelho(d0, 1.62, "Estimado a partir do joelho 90°");
    if (/adapt/.test(d)) return d0 === 25 ? ok("af_adapt_25") : afJoelho(d0, 0.66, "Estimado a partir do joelho 90°");
    if (/cap/.test(d)) return afJoelho(d0, 0.6, "Estimado a partir do joelho 90°");
    if (/colar/.test(d)) return est("af_te_25", 1.2, "Estimado a partir do tê DN 25");
  }

  if (/esgoto|serie r/.test(g)) {
    const [a, b] = [mm[0] || 100, mm[1] || mm[0] || 100];
    const D = Math.max(a, b);
    if (/^tubo/.test(d)) {
      const T = { 40: "es_tubo_40", 50: "es_tubo_50", 75: "es_tubo_75", 100: "es_tubo_100" };
      return T[a] ? ok(T[a]) : est("es_tubo_100", a / 100 * 1.3, "Estimado a partir do DN 100");
    }
    if (/joelho 90.*anel|esgoto secundario/.test(d)) return est("es_joelho_40", 1.1, "Estimado a partir do joelho 90° DN 40");
    if (/joelho 45/.test(d)) return a === 50 ? ok("es_j45_50") : a === 100 ? ok("es_j45_100") : esJoelho(a, 1.05, "Estimado a partir do joelho 90°");
    if (/joelho/.test(d)) return ES_J[a] ? ok(ES_J[a]) : esJoelho(a, 1, "Estimado pela bitola mais próxima");
    if (/curva/.test(d)) return a === 40 ? ok("es_curva_40") : a === 100 ? ok("es_curva_100") : esJoelho(a, 1.35, "Estimado a partir do joelho 90°");
    if (/juncao/.test(d)) {
      const k = `${a}x${b}`;
      if (a === 40) return ok("es_juncao_40");
      if (k === "50x50") return ok("es_juncao_50");
      if (k === "75x50") return ok("es_juncao_75x50");
      if (k === "100x50") return ok("es_juncao_100x50");
      if (k === "100x75") return ok("es_juncao_100x75");
      if (k === "100x100") return ok("es_juncao_100");
      if (k === "75x75") return est("es_juncao_75x50", 1.15, "Estimado a partir da junção 75 × 50");
      return est("es_juncao_100", D / 100, "Estimado a partir da junção DN 100");
    }
    if (/\bte\b|tê|te sanitario|te 90/.test(d)) {
      const k = `${a}x${b}`;
      if (k === "50x50") return ok("es_te_50");
      if (k === "100x50") return ok("es_te_100x50");
      if (k === "75x50") return est("es_te_100x50", 0.8, "Estimado entre tê 50 e tê 100 × 50");
      if (a === 40) return est("es_juncao_40", 0.95, "Estimado a partir da junção DN 40");
      return est("es_juncao_100", D / 100 * 0.95, "Estimado a partir da junção DN 100");
    }
    if (/luva/.test(d)) return esLuva(a);
    if (/bucha/.test(d)) return `${a}x${b}` === "50x40" ? ok("es_bucha_50x40") : esLuva(D, 1.1, "Estimado a partir da luva");
    if (/reducao/.test(d)) return esLuva(D, 1.3, "Estimado a partir da luva");
    if (/cap/.test(d)) return esLuva(a, 0.9, "Estimado a partir da luva");
    if (/adaptador/.test(d)) return esLuva(40, 1, "Estimado a partir da luva DN 40");
    if (/terminal/.test(d)) return a === 50 ? ok("es_terminal_50") : est("es_terminal_50", a / 50, "Estimado a partir do DN 50");
  }

  if (/caixa sifonada/.test(d)) return ok("cx_sifonada_150");
  if (/ralo sifonado/.test(d)) return ok("ralo_sifonado");
  if (/ralo (corpo )?(caixa )?seca|ralo seco/.test(d)) return ok("ralo_seco");
  if (/ralo/.test(d)) return est("ralo_seco", 1, "Referência: ralo seco DN 100");
  if (/sifao flex/.test(d)) return ok("sifao_flex");
  if (/sifao/.test(d)) return ok("sifao_copo");
  if (/valvula/.test(d) && /lavatorio|pia|tanque/.test(d)) return ok("valvula_plast");
  if (/engate/.test(d)) return /plastico/.test(d) ? ok("engate_plast") : ok("engate_inox");
  if (/caixa de gordura/.test(d)) return ok("cx_gordura");
  if (/caixa de (passagem|areia|inspecao)/.test(d)) return est("cx_inspecao", 1, "Referência: caixa de inspeção Ø 0,30 m");

  if (/registro/.test(d)) {
    const p = pol(it.item) || 0.75;
    if (/monocomando/.test(d)) return ok("monocomando");
    if (/esfera/.test(d)) return p === 0.75 ? ok("reg_esfera_34") : est("reg_esfera_34", p / 0.75, "Estimado a partir do 3/4\"");
    const k = perto(p, [0.75, 1, 1.25, 1.5, 2]);
    if (/canopla/.test(d)) return p === 0.75 ? ok("reg_canopla_34") : est(REG[k], 158.82 / 66.37, "Estimado: registro bruto + acabamento");
    if (/pressao/.test(d)) return est("reg_gaveta_34", 1, "Referência: registro de gaveta 3/4\"");
    if (REG[p]) return ok(REG[p]);
    if (p < 0.75) return est("reg_gaveta_34", 0.85, "Estimado a partir do 3/4\"");
    return est("reg_gaveta_2", p / 2 * 1.2, "Estimado a partir do 2\"");
  }
  if (/vaso sanitario|bacia/.test(d)) return ok("bacia_acoplada");
  if (/torneira/.test(d)) {
    if (/lavatorio/.test(d)) return ok("torneira_lav");
    if (/pia|cozinha/.test(d)) return ok("torneira_pia");
    if (/tanque/.test(d)) return ok("torneira_tanque");
    return est("torneira_lav", 1, "Referência: torneira de lavatório");
  }
  if (/banheira|maquina de lavar|lava.?loucas/.test(d) && /aparelho/.test(g)) return incluido("Ponto de consumo; o equipamento não está incluído");
  if (/ducha|chuveiro/.test(d)) return manual("Sem cotação SINAPI em MG: informe o preço");
  if (/bica/.test(d)) return manual();
  if (/reservatorio termico|reservatorio solar|boiler/.test(`${g} ${d}`)) {
    const v = parseFloat((i.match(/(\d+)\s*l/) || [])[1]) || 800;
    return est("solar_kit_800", v / 800, "Kit SINAPI: reservatório + 4 placas de 2 m², sem instalação");
  }
  if (/placa solar|coletor/.test(`${g} ${d}`)) return incluido("Considerada no kit do aquecedor solar (SINAPI 34482)");
  if (/reservatorio|caixa d.?agua|polietileno/.test(`${g} ${d}`)) {
    const v = parseFloat((i.match(/(\d+)\s*l/) || [])[1]) || 1000;
    const T = { 500: "cx_agua_500", 1000: "cx_agua_1000", 2000: "cx_agua_2000", 3000: "cx_agua_3000" };
    if (T[v]) return ok(T[v]);
    if (v === 1500) return est("cx_agua_1000", (598.01 + 1558.14) / 2 / 598.01, "Interpolado entre 1000 L e 2000 L");
    return est(T[perto(v, [500, 1000, 2000, 3000])], v / perto(v, [500, 1000, 2000, 3000]), "Estimado pelo volume");
  }
  if (/pressurizador|bomba/.test(`${g} ${d}`)) return est("bomba_033", 1, "Referência: bomba centrífuga 0,33 HP (insumo)");
  if (/piscina/.test(g)) return manual("Acessório de piscina sem referência SINAPI: informe o preço");
  return manual();
}

export function precoReferencia(c) {
  if (!c || c.incluido) return 0;
  if (!c.refKey) return null;
  const ref = R[c.refKey];
  return ref ? Math.round(ref.t * (c.fator || 1) * 100) / 100 : null;
}
