// api/verificar-prancha.js
// Analisa UMA prancha (imagem + texto extraído do PDF) com IA e devolve apontamentos estruturados.
// Variáveis de ambiente: ANTHROPIC_API_KEY (obrigatória) e ANTHROPIC_MODEL (opcional).
// Só aceita chamadas de usuários logados no sistema (token de sessão do Supabase).

export const config = { maxDuration: 120 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const env = k => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");
const MODELO = env("ANTHROPIC_MODEL") || "claude-sonnet-5-5";

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
          },
          required: ["gravidade", "titulo", "descricao"],
        },
      },
    },
    required: ["apontamentos"],
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const chave = env("ANTHROPIC_API_KEY");
  if (!chave) return res.status(503).json({ erro: "A análise por IA não está configurada: falta a variável ANTHROPIC_API_KEY na Vercel.", codigo: "sem_chave" });
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
Checklist de referência:${CHECKLIST[disciplina] || CHECKLIST["Hidrossanitário"]}`;

  const ctx = [
    contexto.projeto && `Projeto: ${contexto.projeto}`,
    contexto.lista && `Diâmetros presentes na lista de materiais, por sistema: ${contexto.lista}`,
    contexto.modelo && `Resumo do modelo IFC: ${contexto.modelo}`,
  ].filter(Boolean).join("\n");

  const conteudo = [];
  if (imagem) conteudo.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: String(imagem).replace(/^data:image\/\w+;base64,/, "") } });
  conteudo.push({ type: "text", text: `Arquivo: ${arquivo} — página ${pagina} de ${totalPaginas}.\n${ctx}\n\nTexto extraído do PDF desta página (pode estar fora de ordem):\n"""\n${String(texto).slice(0, 18000)}\n"""\n\nRevise a prancha e registre o resultado com a ferramenta.` });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODELO, max_tokens: 4000, system: sistema,
        tools: [FERRAMENTA], tool_choice: { type: "tool", name: FERRAMENTA.name },
        messages: [{ role: "user", content: conteudo }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ erro: `A IA recusou a análise (${r.status}): ${j?.error?.message || "erro desconhecido"}` });
    const uso = j.content?.find(c => c.type === "tool_use")?.input || {};
    return res.status(200).json({
      resumo: uso.resumo || "", carimbo: uso.carimbo || {},
      apontamentos: Array.isArray(uso.apontamentos) ? uso.apontamentos.slice(0, 40) : [],
      modelo: MODELO, tokens: j.usage || null,
    });
  } catch (e) {
    return res.status(500).json({ erro: `Falha ao chamar a IA: ${e.message}` });
  }
}
