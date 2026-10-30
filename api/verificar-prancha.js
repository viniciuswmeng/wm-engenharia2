// api/verificar-prancha.js
// Analisa UMA prancha (imagem + texto extraído do PDF) com IA e devolve apontamentos estruturados.
// Provedores de IA (variáveis de ambiente na Vercel):
//   Gemini (cota gratuita):  GEMINI_API_KEY    · GEMINI_MODEL (opcional, padrão gemini-3.8-flash)
//   Claude (pago):           ANTHROPIC_API_KEY · ANTHROPIC_MODEL (opcional)
//   PROVEDOR_IA = "gemini" | "anthropic" escolhe quando as duas chaves existem (padrão: gemini).
// Só aceita chamadas de usuários logados no sistema (token de sessão do Supabase).

export const config = { maxDuration: 120 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const env = k => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");
const MODELO_CLAUDE = env("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
// Modelos gratuitos tentados em ordem quando o anterior está sobrecarregado (erro 503/500)
const MODELOS_GEMINI = [...new Set([env("GEMINI_MODEL") || "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"])];

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

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function geminiUmModelo(modelo, chave, corpo) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": chave }, body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}

async function chamarGemini(chave, sistema, imagem, texto) {
  const partes = [];
  if (imagem) partes.push({ inline_data: { mime_type: "image/jpeg", data: imagem } });
  partes.push({ text: texto });
  const corpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: "user", parts: partes }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8000, responseMimeType: "application/json", responseSchema: esquemaGemini(FERRAMENTA.input_schema) },
  };
  let ultimo = null;
  // Sobrecarga (503/500): tenta o mesmo modelo de novo e depois os próximos modelos gratuitos
  for (const modelo of MODELOS_GEMINI) {
    for (let t = 0; t < 2; t++) {
      const { r, j } = await geminiUmModelo(modelo, chave, corpo);
      if (r.ok) {
        const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
        try { return { dados: JSON.parse(txt), modelo, tokens: j.usageMetadata || null }; }
        catch { ultimo = falha("O Gemini devolveu uma resposta fora do formato esperado.", 502); break; }
      }
      ultimo = { status: r.status, msg: j?.error?.message || "erro desconhecido" };
      if (r.status === 404 || r.status === 429) break;          // modelo indisponível ou cota deste modelo: vai para o próximo
      if (r.status !== 503 && r.status !== 500) throw falha(`O Gemini recusou a análise (${r.status}): ${ultimo.msg}`, 502);
      await esperar(2500 * (t + 1));
    }
  }
  if (ultimo instanceof Error) throw ultimo;
  if (ultimo?.status === 429) throw falha("Limite gratuito do Gemini atingido (pedidos por minuto ou por dia). Aguarde um pouco e tente de novo.", 429);
  throw falha("Os modelos gratuitos do Gemini estão sobrecarregados agora. O sistema vai tentar de novo em instantes.", 503);
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

  const { imagem, texto = "", pagina = 1, totalPaginas = 1, arquivo = "", disciplina = "Hidrossanitário", contexto = {} } = req.body || {};
  if (!imagem && !texto) return res.status(400).json({ erro: "Prancha sem imagem e sem texto." });

  const sistema = `Você é um engenheiro civil revisor de projetos (compatibilização e conformidade com as normas ABNT) do escritório WM Engenharia Integrada.
Revise a prancha do projeto ${disciplina.toLowerCase()} e aponte inconsistências e descumprimentos normativos.
Regras:
- Aponte só o que você consegue ver na imagem ou no texto extraído. Não invente. Se algo estiver ilegível, diga isso em vez de supor.
- Seja específico: cite o trecho, ambiente, diâmetro, declividade ou campo do carimbo.
- Não repita o mesmo problema várias vezes; agrupe ocorrências iguais em um apontamento.
- Escreva em português do Brasil, linguagem técnica e direta.
- Sempre que o problema estiver num ponto da prancha (trecho, ambiente, detalhe, carimbo), informe a região aproximada na imagem.
Checklist de referência:${CHECKLIST[disciplina] || CHECKLIST["Hidrossanitário"]}`;

  const ctx = [
    contexto.projeto && `Projeto: ${contexto.projeto}`,
    contexto.lista && `Diâmetros presentes na lista de materiais, por sistema: ${contexto.lista}`,
    contexto.modelo && `Resumo do modelo IFC: ${contexto.modelo}`,
  ].filter(Boolean).join("\n");
  const img = imagem ? String(imagem).replace(/^data:image\/\w+;base64,/, "") : null;
  const textoUsuario = `Arquivo: ${arquivo} — página ${pagina} de ${totalPaginas}.\n${ctx}\n\nTexto extraído do PDF desta página (pode estar fora de ordem):\n"""\n${String(texto).slice(0, 18000)}\n"""\n\nRevise a prancha e devolva o resultado no formato pedido.`;

  try {
    const r = prov.nome === "gemini" ? await chamarGemini(prov.chave, sistema, img, textoUsuario) : await chamarClaude(prov.chave, sistema, img, textoUsuario);
    const d = r.dados || {};
    return res.status(200).json({
      resumo: d.resumo || "", carimbo: d.carimbo || {},
      apontamentos: Array.isArray(d.apontamentos) ? d.apontamentos.slice(0, 40) : [],
      provedor: prov.nome, modelo: r.modelo, tokens: r.tokens,
    });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: e.status ? e.message : `Falha ao chamar a IA: ${e.message}`, codigo: e.status === 429 ? "limite" : undefined });
  }
}
