// Termo de finalização de etapa a partir de um TXT: modelo, instruções para o Claude (por disciplina e etapa)
// e leitura do arquivo. O texto do arquivo é só dado: vira campos do formulário, que a equipe confere antes de enviar.
import { ETAPAS } from "./assinaturaDados.js";

export const TXT_MAX = 200 * 1024;

// O que o termo de cada disciplina costuma registrar (orienta o Claude a não esquecer nada importante)
const FOCO = {
  PE: ["sistema estrutural adotado (concreto armado, metálica, alvenaria estrutural…) e tipo de laje", "lançamento de pilares e vigas e interferências resolvidas com a arquitetura (vãos, garagem, aberturas, pé-direito)", "tipo de fundação considerado e se depende de sondagem SPT", "cargas e premissas (sobrecargas, caixa d'água, piscina, telhado)", "pranchas aprovadas (formas, locação, armação) com código e revisão", "normas: ABNT NBR 6118 e NBR 6122"],
  PF: ["tipo de fundação (sapata, estaca, radier, bloco) e cota de assentamento", "dados da sondagem usados e capacidade de carga adotada", "cargas dos pilares consideradas", "pranchas de locação e detalhes aprovados", "norma: ABNT NBR 6122"],
  EL: ["pontos de tomada, iluminação e interruptores aprovados por ambiente", "quadro de distribuição: localização e número de circuitos", "padrão de entrada, tipo de fornecimento e potência instalada/demandada", "circuitos especiais (chuveiro, ar-condicionado, forno, carregador de carro, bomba)", "previsões: SPDA, cabeamento estruturado, CFTV, automação, energia solar", "pranchas aprovadas com código e revisão", "norma: ABNT NBR 5410"],
  PH: ["água fria: abastecimento, reservatórios (volume e local) e pressurização", "água quente: tipo de aquecimento (gás, elétrico, solar, bomba de calor) e pontos atendidos", "esgoto e ventilação: caixas, prumadas e destino", "águas pluviais: calhas, condutores e reaproveitamento", "pontos hidráulicos por ambiente (louças, metais, máquina, filtro)", "pranchas aprovadas com código e revisão", "normas: ABNT NBR 5626, NBR 8160 e NBR 10844"],
  PI: ["ambientes aprovados nesta etapa (nome de cada um)", "layout e disposição do mobiliário", "materiais e acabamentos aprovados (pisos, revestimentos, pedras, pintura)", "marcenaria: módulos, cores e ferragens", "iluminação decorativa e forro", "ajustes pedidos que já foram incorporados e itens que ficaram para a próxima etapa", "imagens/renders e versão da apresentação (R00, R01…)"],
  PA: ["programa de necessidades atendido (ambientes e áreas)", "implantação, recuos e atendimento à legislação municipal", "plantas, cortes, fachadas e cobertura aprovados", "área construída total e por pavimento", "materiais principais de fachada e cobertura", "pranchas aprovadas com código e revisão"],
  PP: ["dimensões, profundidade e volume da piscina", "estrutura e revestimento", "casa de máquinas, filtragem, aquecimento e iluminação", "itens especiais (hidromassagem, cascata, borda infinita)", "pranchas aprovadas"],
  PR: ["elementos a reforçar e motivo", "solução de reforço aprovada (encamisamento, fibra de carbono, perfis…)", "sequência executiva e escoramentos", "pranchas aprovadas"],
  CB: ["disciplinas compatibilizadas e versão de cada modelo", "interferências encontradas e como foram resolvidas", "pendências que ficaram com cada projetista", "relatório/pranchas de compatibilização entregues"],
};
const ETAPA_DICA = {
  Preliminar: "Etapa PRELIMINAR (estudo/concepção): registre as definições e premissas aprovadas e deixe claro que o detalhamento vem na etapa seguinte.",
  Anteprojeto: "Etapa de ANTEPROJETO: registre as soluções técnicas aprovadas e o que ainda será detalhado no executivo.",
  Executivo: "Etapa EXECUTIVA: registre as pranchas e documentos finais aprovados para obra, com código e revisão de cada um.",
  "Legal / aprovação": "Etapa LEGAL/APROVAÇÃO: registre os documentos para órgãos (prefeitura, concessionária, bombeiros) e o que o cliente aprovou para protocolo.",
  Final: "Etapa FINAL: registre a entrega completa e que não há pendências (ou liste as que existem).",
};

export function modeloTermoTxt({ disciplina, etapa, cliente = "", email = "" }) {
  return `DISCIPLINA: ${disciplina}
ETAPA: ${etapa}

[O QUE FOI APROVADO]
Texto objetivo (1 a 3 parágrafos) com tudo o que o cliente aprovou nesta etapa.

[ITENS]
- PE-01 Planta de locação R01
- Memorial / relatório entregue

[OBSERVACOES]
Ajustes combinados, pendências do cliente ou condições (deixe vazio se não houver).

[SIGNATARIOS]
${cliente || "Nome completo do cliente"} | ${email || "email@cliente.com"} | Cliente
`;
}

export function instrucoesTermoTxt({ disc, disciplina, etapa, projeto, cliente, email }) {
  const foco = FOCO[disc] || ["o que foi aprovado nesta etapa", "documentos e pranchas entregues", "pendências e próximos passos"];
  return `Vou colar abaixo anotações/transcrição sobre a aprovação de uma etapa de projeto. Gere um arquivo .txt (texto simples, UTF-8) com o TERMO DE FINALIZAÇÃO DE ETAPA, seguindo EXATAMENTE o modelo no final, para eu importar no sistema da WM Engenharia.

Projeto: ${projeto.codigo || ""} — ${projeto.cliente || ""}
Disciplina: ${disciplina}
Etapa: ${etapa}

${ETAPA_DICA[etapa] || `Etapa "${etapa}": registre exatamente o que foi aprovado e o que fica para depois.`}

Em [O QUE FOI APROVADO], cubra (só o que aparecer nas anotações, sem inventar):
${foco.map(x => "- " + x).join("\n")}

Regras:
- Mantenha os rótulos (DISCIPLINA:, ETAPA:) e os títulos entre colchetes exatamente como estão.
- Português formal, objetivo, em terceira pessoa ("O CONTRATANTE aprovou…"). Não use markdown (sem **, #, tabelas).
- [ITENS]: um item por linha começando com "- " (pranchas com código e revisão, memoriais, relatórios, arquivos).
- [OBSERVACOES]: ajustes combinados, pendências e prazos. Se não houver, deixe a seção vazia.
- [SIGNATARIOS]: uma pessoa por linha: nome completo | e-mail | papel. Mantenha o cliente abaixo e só acrescente outras pessoas se as anotações disserem que também assinam.
- Não invente dados, valores, códigos de prancha ou datas. Se algo importante estiver faltando, escreva [CONFIRMAR] no lugar.

MODELO:
${modeloTermoTxt({ disciplina, etapa, cliente, email })}
ANOTAÇÕES / TRANSCRIÇÃO:
(cole aqui)`;
}

const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
// eslint-disable-next-line no-control-regex -- remove caracteres de controle e de direção de texto
const limpa = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\*\*|__/g, "").trim().slice(0, max);
const SECOES = { "O QUE FOI APROVADO": "descricao", "APROVADO": "descricao", "DESCRICAO": "descricao", "ITENS": "itens", "ITENS ENTREGUES": "itens", "DOCUMENTOS": "itens", "OBSERVACOES": "obs", "OBSERVACAO": "obs", "SIGNATARIOS": "sigs", "QUEM ASSINA": "sigs" };
const EMAIL_OK = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,24}$/;

export async function lerArquivoTxt(arquivo) {
  if (arquivo.size > TXT_MAX) throw new Error("Arquivo grande demais (máx. 200 KB).");
  if (!/\.txt$/i.test(arquivo.name) && arquivo.type && arquivo.type !== "text/plain") throw new Error("Escolha um arquivo .txt.");
  const buf = await arquivo.arrayBuffer();
  let txt = new TextDecoder("utf-8").decode(buf);
  if (txt.includes("�")) try { txt = new TextDecoder("windows-1252").decode(buf); } catch { /* fica UTF-8 */ }
  return txt;
}

// → { disc, etapa, outraEtapa, descricao, itens, obs, sigs } (só os campos encontrados)
export function lerTermoTxt(txt, discsValidos) {
  const campos = {}, secs = {};
  let sec = null;
  String(txt).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").slice(0, 2000).forEach(l => {
    const k = semAcento(l).replace(/^#+\s*/, "").replace(/\*/g, "");
    const h = k.match(/^\[?\s*([A-Z ]+?)\s*\]?\s*:?\s*$/);
    if (h && SECOES[h[1]] && (/^\s*(\[|#)/.test(l) || /:\s*$/.test(l) || k === h[1])) { sec = SECOES[h[1]]; secs[sec] = secs[sec] || []; return; }
    const c = !sec && l.match(/^\s*\**(DISCIPLINA|ETAPA)\**\s*:\s*(.*)$/i);
    if (c) { campos[c[1].toLowerCase()] = c[2]; return; }
    if (sec) secs[sec].push(l);
  });
  const out = {};
  if (campos.disciplina) {
    const alvo = semAcento(campos.disciplina).replace(/^PROJETO( DE)? /, "");
    const achado = discsValidos.find(([id, nome]) => semAcento(id) === alvo || semAcento(nome).replace(/^PROJETO( DE)? /, "") === alvo || semAcento(nome).includes(alvo) || alvo.includes(semAcento(nome).replace(/^PROJETO( DE)? /, "")));
    if (achado) out.disc = achado[0];
  }
  if (campos.etapa) {
    const e = limpa(campos.etapa, 60), igual = ETAPAS.find(x => semAcento(x) === semAcento(e) || semAcento(e).startsWith(semAcento(x)));
    if (igual) out.etapa = igual; else if (e) { out.etapa = "outra"; out.outraEtapa = e; }
  }
  const texto = ls => limpa((ls || []).join("\n").replace(/\n{3,}/g, "\n\n"), 3500);
  const linhas = ls => (ls || []).map(x => x.replace(/^\s*(?:[-*•–]|\d+[.)])\s+/, "").trim()).filter(x => x && !/^[-|\s]+$/.test(x));
  if (secs.descricao) out.descricao = texto(secs.descricao);
  if (secs.itens) out.itens = linhas(secs.itens).slice(0, 60).map(x => limpa(x, 200)).join("\n");
  if (secs.obs) out.obs = limpa(texto(secs.obs), 1500);
  if (secs.sigs) {
    const sigs = linhas(secs.sigs).slice(0, 6).map((x, i) => {
      const [nome, email, papel] = x.split(/\s*[|;]\s*/).map(v => limpa(v, 120));
      if (!nome || /^NOME/.test(semAcento(nome))) return null;
      return { id: "c" + (i + 1), nome, email: EMAIL_OK.test(email || "") ? email.toLowerCase() : "", papel: papel || "Cliente" };
    }).filter(Boolean);
    if (sigs.length) out.sigs = sigs;
  }
  return out;
}
