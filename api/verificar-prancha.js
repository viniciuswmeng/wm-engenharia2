// api/verificar-prancha.js
// Analisa UMA prancha (imagem + texto extraído do PDF) com IA e devolve apontamentos estruturados.
// Provedores de IA (variáveis de ambiente na Vercel):
//   Gemini (cota gratuita):  GEMINI_API_KEY    · GEMINI_MODEL (opcional, padrão gemini-3.8-flash)
//   Claude (pago):           ANTHROPIC_API_KEY · ANTHROPIC_MODEL (opcional)
//   PROVEDOR_IA = "gemini" | "anthropic" escolhe quando as duas chaves existem (padrão: gemini).
// Só aceita chamadas de usuários logados no sistema (token de sessão do Supabase).

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const env = k => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");
const MODELO_CLAUDE = env("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
// Modelos gratuitos tentados em ordem quando o anterior está sobrecarregado (erro 503/500)
// (o Flash-Lite responde em ~2 s; o 3.8 Flash, com raciocínio baixo, fica de reserva)
const MODELOS_GEMINI = [...new Set([env("GEMINI_MODEL") || "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash"])];

function provedor() {
  const g = env("GEMINI_API_KEY"), a = env("ANTHROPIC_API_KEY"), pref = env("PROVEDOR_IA").toLowerCase();
  if (pref === "anthropic" && a) return { nome: "anthropic", chave: a };
  if (g) return { nome: "gemini", chave: g };
  if (a) return { nome: "anthropic", chave: a };
  return null;
}

async function usuarioLogado(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || !SUPABASE_URL) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.email ? u : null;
}

const CHECKLIST = {
  "Hidrossanitário": `
- Carimbo/selo: título da prancha, obra/cliente, endereço, responsável técnico com registro CREA/CAU, nº da ART/RRT, escala, data, revisão, número da prancha (x/y).
- Legenda dos símbolos e identificação dos sistemas (água fria, água quente, esgoto primário/secundário, ventilação, pluvial).
- Notas gerais: normas de referência (ABNT NBR 5626:2020, NBR 8160:1999, NBR 10844:1989), materiais, pressões, testes de estanqueidade.
- Todos os trechos com diâmetro indicado. Esgoto e pluvial horizontais com declividade indicada.
- Declividades: esgoto DN ≤ 75 mínimo 2 %; DN ≥ 100 mínimo 1 %; máximo 5 %. Pluvial horizontal mínimo 0,5 %.
- Ramal de descarga de bacia sanitária DN 100; pia de cozinha DN 50; lavatório, chuveiro e tanque DN 40 (NBR 8160, Tabela 3). Tubo de queda que recebe bacia DN 100.
- Pia de cozinha ligada a caixa de gordura; caixas de inspeção nas mudanças de direção do coletor; desconectores (caixa sifonada) ventilados.
- Ventilação: coluna/ramais de ventilação presentes, terminal acima da cobertura. Condutor vertical pluvial com diâmetro ≥ 75 mm.
- Água fria/quente: isométricos com diâmetros, registros de gaveta/pressão, alturas dos pontos; reservatório com volume; material de água quente compatível (não usar PVC soldável).
- Coerência: o mesmo trecho com diâmetros diferentes entre planta e isométrico/detalhe; diâmetros que não existem na lista de materiais; cotas e textos incoerentes; erros de grafia.`,
};

CHECKLIST["Elétrico"] = `
- Carimbo/selo: título da prancha, obra/cliente, endereço, responsável técnico com registro CREA/CAU, nº da ART/RRT, escala, data, revisão, número da prancha (x/y).
- Legenda dos símbolos (NBR 5444 ou legenda própria) e notas gerais citando a ABNT NBR 5410:2004.
- Planta: cada cômodo com ao menos 1 ponto de luz no teto comandado por interruptor; tomadas de uso geral (TUG) no mínimo: banheiro 1 junto ao lavatório; cozinha/copa/área de serviço 1 a cada 3,5 m de perímetro (2 acima da bancada da pia); salas e dormitórios 1 a cada 5 m de perímetro; varanda 1; demais cômodos > 6 m² 1 a cada 5 m de perímetro (9.5.2).
- Pontos com potência e número do circuito indicados; tomadas de uso específico (chuveiro, ar-condicionado, forno etc.) em circuitos exclusivos.
- Circuitos: iluminação separada de tomadas; tomadas de cozinha, copa, área de serviço e lavanderia em circuitos próprios (9.5.3).
- Condutores: seção mínima 1,5 mm² (iluminação) e 2,5 mm² (força); disjuntor com corrente nominal ≤ capacidade do condutor (In ≤ Iz); neutro e proteção (terra) presentes em todos os circuitos.
- DR 30 mA para banheiros, cozinhas, áreas de serviço, lavanderias, garagens e áreas externas (5.1.3.2.2); DPS no quadro de entrada.
- Quadro de cargas e diagrama unifilar: potência por circuito, seção, disjuntor, fase, queda de tensão ≤ 4 % nos terminais, equilíbrio entre fases, espaço de reserva (Tabela 59).
- Eletrodutos com diâmetro indicado; coerência entre planta, quadro de cargas, unifilar e lista de materiais; erros de grafia.`;

CHECKLIST["Estrutural"] = `
- Carimbo/selo completo (título, obra, responsável técnico com CREA, ART, escala, data, revisão, prancha x/y).
- Notas gerais: ABNT NBR 6118, classe de agressividade ambiental (CAA), fck do concreto, aço (CA-50/CA-60), cobrimentos por elemento, fator a/c, módulo de elasticidade se usado.
- fck mínimo por CAA (Tabela 7.1): I C20, II C25, III C30, IV C40. Cobrimentos mínimos (Tabela 7.2, Δc = 10 mm): laje 2,0/2,5/3,5/4,5 cm; viga e pilar 2,5/3,0/4,0/5,0 cm; contato com solo 3,0/3,0/4,0/5,0 cm (CAA I/II/III/IV).
- Dimensões: pilares com menor lado ≥ 19 cm (14 a 19 cm só com γn) e área ≥ 360 cm²; vigas com largura ≥ 12 cm; lajes maciças ≥ 7 cm (cobertura), 8 cm (piso), 10 cm (balanço).
- Detalhamento: armaduras com posição, bitola, quantidade, espaçamento, comprimento; ancoragens e emendas; estribos com espaçamento; tabela/resumo de aço por bitola com massa; quantitativo de concreto e formas.
- Coerência: mesma peça com dimensões diferentes entre formas e armação; numeração de pilares/vigas coerente entre plantas; níveis indicados; furos/passagens em vigas indicados.`;

CHECKLIST["Arquitetônico"] = `
- Carimbo/selo completo (título, obra, endereço, responsável técnico com CAU/CREA, RRT/ART, escala, data, revisão, prancha x/y).
- Plantas com cotas totais e parciais, níveis, nome e área dos ambientes, indicação de cortes e fachadas, norte.
- Portas com vão livre ≥ 0,80 m em acessos e rotas acessíveis (NBR 9050); pé-direito ≥ 2,50 m (2,30 m em banheiros, halls e corredores — NBR 15575); iluminação natural ≥ 1/6 da área do piso em ambientes de permanência prolongada (referência de códigos de obras).
- Escadas: espelho 16 a 18 cm, piso 28 a 32 cm, 63 ≤ p + 2e ≤ 65 cm; corrimão e guarda-corpo ≥ 1,10 m (NBR 14718); rampas ≤ 8,33 % (NBR 9050).
- Quadro de esquadrias coerente com a planta; especificação de materiais e acabamentos; coerência entre plantas, cortes e fachadas (alturas, níveis, aberturas).`;

CHECKLIST["Interiores"] = `
- Carimbo/selo completo; planta de layout cotada; vistas/elevações de cada parede com cotas.
- Especificação de materiais e acabamentos (fornecedor, código, cor, espessura do MDF), ferragens e iluminação.
- Alturas: bancada de cozinha 85 a 95 cm, bancada de banheiro 78 a 92 cm, mesas 70 a 78 cm; em uso acessível, conforme NBR 9050.
- Circulação livre ≥ 80 cm entre móveis e na frente de portas; portas de armários e gavetas sem bater em portas, janelas ou outros móveis.
- Pontos elétricos (tomadas sobre bancadas, pontos de TV, iluminação de marcenaria) e hidráulicos (cuba, filtro, máquina) compatíveis com o layout; tomadas não escondidas atrás de móveis.
- Paginação de pisos/revestimentos, forro/gesso com níveis; coerência entre planta, vistas e lista de materiais.`;

const ADICIONAL = {
  prefeitura: `
PROJETO LEGAL (aprovação na prefeitura) — confira também:
- Peças exigidas: planta de situação, planta de implantação/locação com recuos cotados, plantas baixas, ao menos dois cortes, fachadas, planta de cobertura, quadro de áreas.
- Quadro de áreas: área do terreno, área de projeção, área construída por pavimento e total, taxa de ocupação, coeficiente de aproveitamento, taxa de permeabilidade — com contas coerentes.
- Recuos frontal, laterais e de fundos cotados; altura/gabarito; vagas de estacionamento; campos de assinatura do proprietário e do responsável técnico; indicação de RRT/ART.`,
  bombeiros: `
CORPO DE BOMBEIROS (CBMMG / NBR 9077, 12693, 10898, 13434) — confira também:
- Extintores locados em todos os pavimentos, com tipo/capacidade e distância máxima de caminhamento (15/20/25 m conforme o risco).
- Iluminação de emergência e sinalização de rotas de fuga, saídas, extintores e hidrantes.
- Saídas de emergência: largura das escadas e portas (mínimo 1,10 m em escadas e 0,80 m em portas), corrimãos, guarda-corpos ≥ 1,10 m, sentido de abertura das portas.
- Hidrantes/mangotinhos, alarme e central de GLP quando exigidos pela área, altura e ocupação.`,
};

const FERRAMENTA = {
  name: "registrar_verificacao",
  description: "Registra o resultado da verificação da prancha.",
  input_schema: {
    type: "object",
    properties: {
      resumo: { type: "string", description: "Uma ou duas frases: o que a prancha mostra." },
      carimbo: {
        type: "object",
        properties: {
          titulo: { type: "string" }, responsavel: { type: "string" }, registro: { type: "string", description: "CREA/CAU" },
          art: { type: "string" }, escala: { type: "string" }, data: { type: "string" }, revisao: { type: "string" }, prancha: { type: "string", description: "ex.: 02/05" },
        },
      },
      apontamentos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gravidade: { type: "string", enum: ["erro", "atencao", "info"], description: "erro = descumpre norma ou incoerência clara; atencao = provável problema ou informação faltando; info = observação/sugestão" },
            titulo: { type: "string", description: "Frase curta e específica." },
            descricao: { type: "string", description: "O que foi visto e por que é um problema." },
            local: { type: "string", description: "Onde na prancha (ambiente, trecho, detalhe, carimbo)." },
            norma: { type: "string", description: "Norma e item, quando houver (ex.: NBR 8160)." },
            sugestao: { type: "string" },
            confianca: { type: "string", enum: ["alta", "media", "baixa"] },
            regiao: {
              type: "object",
              description: "Região aproximada do problema na imagem, em frações de 0 a 1 (x0,y0 = canto superior esquerdo; x1,y1 = canto inferior direito). Omita se o problema não tiver lugar definido.",
              properties: { x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } },
            },
          },
          required: ["gravidade", "titulo", "descricao"],
        },
      },
    },
    required: ["apontamentos"],
  },
};

// Esquema JSON → formato do Gemini (tipos em maiúsculas)
function esquemaGemini(sch) {
  if (!sch || typeof sch !== "object") return sch;
  const o = {};
  for (const [k, v] of Object.entries(sch)) {
    if (k === "type") o.type = String(v).toUpperCase();
    else if (k === "properties") o.properties = Object.fromEntries(Object.entries(v).map(([n, x]) => [n, esquemaGemini(x)]));
    else if (k === "items") o.items = esquemaGemini(v);
    else o[k] = v;
  }
  return o;
}

const falha = (msg, status) => Object.assign(new Error(msg), { status });

// Uma chamada por pedido, com limite de tempo: quem faz as novas tentativas (e troca de modelo) é o navegador,
// para nunca estourar o tempo máximo da função na Vercel.
async function chamarGemini(chave, sistema, imagem, texto, tentativa = 0) {
  const modelo = MODELOS_GEMINI[Math.min(tentativa, MODELOS_GEMINI.length - 1)];
  const partes = [];
  if (imagem) partes.push({ inline_data: { mime_type: "image/jpeg", data: imagem } });
  partes.push({ text: texto });
  const config = { temperature: 0.2, maxOutputTokens: 6000, responseMimeType: "application/json", responseSchema: esquemaGemini(FERRAMENTA.input_schema) };
  if (!/lite/.test(modelo)) config.thinkingConfig = { thinkingLevel: "low" }; // sem isso o Flash pensa por mais de 50 s
  const enviar = async cfg => {
    const ctl = new AbortController(); const tempo = setTimeout(() => ctl.abort(), 50000);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST", signal: ctl.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: "user", parts: partes }], generationConfig: cfg }),
      });
      return { r, j: await r.json().catch(() => ({})) };
    } catch (e) {
      if (e.name === "AbortError") throw Object.assign(falha(`O Gemini (${modelo}) demorou demais para responder.`, 504), { tentar: true });
      throw e;
    } finally { clearTimeout(tempo); }
  };
  let { r, j } = await enviar(config);
  // modelo que não aceita o ajuste de raciocínio: repete sem ele
  if (r.status === 400 && config.thinkingConfig && /think/i.test(j?.error?.message || "")) {
    delete config.thinkingConfig; ({ r, j } = await enviar(config));
  }
  if (r.status === 429) throw Object.assign(falha("Limite gratuito do Gemini atingido (pedidos por minuto ou por dia). Aguarde um pouco e tente de novo.", 429), { tentar: true });
  if ([500, 503, 404].includes(r.status)) throw Object.assign(falha(`O Gemini (${modelo}) está sobrecarregado ou indisponível agora (${r.status}: ${String(j?.error?.message || "").slice(0, 120)}).`, 503), { tentar: true });
  if (!r.ok) throw falha(`O Gemini recusou a análise (${r.status}): ${j?.error?.message || "erro desconhecido"}`, 502);
  const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  try { return { dados: JSON.parse(txt), modelo, tokens: j.usageMetadata || null }; }
  catch { throw Object.assign(falha("O Gemini devolveu uma resposta incompleta.", 503), { tentar: true }); }
}

async function chamarClaude(chave, sistema, imagem, texto) {
  const conteudo = [];
  if (imagem) conteudo.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagem } });
  conteudo.push({ type: "text", text: texto + "\n\nRegistre o resultado com a ferramenta." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO_CLAUDE, max_tokens: 4000, system: sistema, tools: [FERRAMENTA], tool_choice: { type: "tool", name: FERRAMENTA.name }, messages: [{ role: "user", content: conteudo }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) throw falha("Limite de uso da API da Anthropic atingido. Aguarde um pouco.", 429);
  if (!r.ok) throw falha(`A IA recusou a análise (${r.status}): ${j?.error?.message || "erro desconhecido"}`, 502);
  return { dados: j.content?.find(c => c.type === "tool_use")?.input || {}, modelo: MODELO_CLAUDE, tokens: j.usage || null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const prov = provedor();
  if (!prov) return res.status(503).json({ erro: "A análise por IA não está configurada: cadastre a variável GEMINI_API_KEY (gratuita) ou ANTHROPIC_API_KEY na Vercel.", codigo: "sem_chave" });
  const u = await usuarioLogado(req).catch(() => null);
  if (!u) return res.status(401).json({ erro: "Sessão expirada. Entre novamente no sistema." });

  const { imagem, texto = "", pagina = 1, totalPaginas = 1, arquivo = "", disciplina = "Hidrossanitário", contexto = {}, tentativa = 0 } = req.body || {};
  if (!imagem && !texto) return res.status(400).json({ erro: "Prancha sem imagem e sem texto." });

  const sistema = `Você é um engenheiro civil revisor de projetos (compatibilização e conformidade com as normas ABNT) do escritório WM Engenharia Integrada.
Revise a prancha do projeto ${disciplina.toLowerCase()} e aponte inconsistências e descumprimentos normativos.
Regras:
- Aponte só o que você consegue ver na imagem ou no texto extraído. Não invente. Se algo estiver ilegível, diga isso em vez de supor.
- Seja específico: cite o trecho, ambiente, diâmetro, declividade ou campo do carimbo.
- Não repita o mesmo problema várias vezes; agrupe ocorrências iguais em um apontamento.
- Escreva em português do Brasil, linguagem técnica e direta.
- Sempre que o problema estiver num ponto da prancha (trecho, ambiente, detalhe, carimbo), informe a região aproximada na imagem.
Checklist de referência:${CHECKLIST[disciplina] || CHECKLIST["Hidrossanitário"]}${contexto.modo === "prefeitura" ? ADICIONAL.prefeitura : ""}${contexto.bombeiros ? ADICIONAL.bombeiros : ""}${contexto.caa ? `\nClasse de agressividade ambiental informada: CAA ${contexto.caa}.` : ""}`;

  const ctx = [
    contexto.projeto && `Projeto: ${contexto.projeto}`,
    contexto.lista && `Diâmetros presentes na lista de materiais, por sistema: ${contexto.lista}`,
    contexto.modelo && `Resumo do modelo IFC: ${contexto.modelo}`,
  ].filter(Boolean).join("\n");
  const img = imagem ? String(imagem).replace(/^data:image\/\w+;base64,/, "") : null;
  const textoUsuario = `Arquivo: ${arquivo} — página ${pagina} de ${totalPaginas}.\n${ctx}\n\nTexto extraído do PDF desta página (pode estar fora de ordem):\n"""\n${String(texto).slice(0, 12000)}\n"""\n\nRevise a prancha e devolva o resultado no formato pedido.`;

  try {
    const r = prov.nome === "gemini" ? await chamarGemini(prov.chave, sistema, img, textoUsuario, Number(tentativa) || 0) : await chamarClaude(prov.chave, sistema, img, textoUsuario);
    const d = r.dados || {};
    return res.status(200).json({
      resumo: d.resumo || "", carimbo: d.carimbo || {},
      apontamentos: Array.isArray(d.apontamentos) ? d.apontamentos.slice(0, 40) : [],
      provedor: prov.nome, modelo: r.modelo, tokens: r.tokens,
    });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: e.status ? e.message : `Falha ao chamar a IA: ${e.message}`, codigo: e.status === 429 ? "limite" : e.tentar ? "tentar" : undefined });
  }
}
