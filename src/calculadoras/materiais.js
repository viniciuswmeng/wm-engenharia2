// Materiais de apoio. Os guias abaixo vêm junto com o sistema (public/materiais);
// os enviados pelo botão "Adicionar PDF" ficam no Supabase (tabela materiais_apoio).

export const DISCIPLINAS_MATERIAL = [
  { nome: "Hidrossanitário", cor: "#0891b2" },
  { nome: "Elétrico", cor: "#d97706" },
  { nome: "Estrutural", cor: "#1565d8" },
  { nome: "Fundações", cor: "#16a34a" },
  { nome: "Arquitetônico", cor: "#64748b" },
  { nome: "Climatização", cor: "#7c3aed" },
  { nome: "Incêndio (PPCI)", cor: "#e11d48" },
  { nome: "Obras e gestão", cor: "#0a2557" },
  { nome: "Geral", cor: "#475569" },
];
export const corDisciplina = d => DISCIPLINAS_MATERIAL.find(x => x.nome === d)?.cor || "#475569";

export const MATERIAIS = [
  {
    id: "guia-hidro",
    titulo: "Guia de Conferência de Projeto — Instalações Hidrossanitárias",
    disciplina: "Hidrossanitário",
    cor: "#0891b2",
    revisao: "R01 · set/2026",
    paginas: 18,
    autor: "Eng. Jonathan Martins",
    arquivo: "/materiais/Guia_Conferencia_Instalacoes_Hidrossanitarias_R01.pdf",
    capa: "/materiais/Guia_Conferencia_Instalacoes_Hidrossanitarias_R01.png",
    resumo: "Checklists de verificação e tabelas de consulta rápida: água fria, água quente (gás, solar, recirculação), esgoto sanitário, tratamento individual, águas pluviais, retardo e aproveitamento de água de chuva.",
    normas: ["NBR 5626", "NBR 8160", "NBR 10844", "NBR 7229", "NBR 13969", "NBR 15569", "NBR 15527"],
    topicos: [
      "Briefing, pré-compatibilização e entrega", "Água fria: conferência e limites", "Água fria: pesos, tubos, perdas e consumo",
      "Água quente: temperaturas, segurança e gás", "Água quente: solar e recirculação", "Esgoto sanitário: conferência",
      "Esgoto: ventilação, recalque e VAA", "Esgoto sanitário: tabelas", "Tanque séptico, filtro anaeróbio e sumidouro",
      "Águas pluviais: conferência e métodos", "Águas pluviais: tabelas", "Água de chuva, retardo e roteiros de planilha",
    ],
  },
  {
    id: "guia-eletrica",
    titulo: "Guia de Conferência de Projeto — Instalações Elétricas",
    disciplina: "Elétrico",
    cor: "#d97706",
    revisao: "R00 · set/2026",
    paginas: 10,
    autor: "Eng. Jonathan Martins",
    arquivo: "/materiais/Guia_Conferencia_Instalacoes_Eletricas_R00.pdf",
    capa: "/materiais/Guia_Conferencia_Instalacoes_Eletricas_R00.png",
    resumo: "Checklists de verificação e tabelas de consulta rápida: previsão de cargas, divisão de circuitos, condutores, queda de tensão, proteção (DTM, DR, DPS), eletrodutos, demanda e padrão de entrada CEMIG.",
    normas: ["NBR 5410", "ND 5.1 CEMIG", "NR-10"],
    topicos: [
      "Checklist geral, documentação e NR-10", "Previsão de cargas", "Circuitos, quadro, traçado e banheiros",
      "Dimensionamento dos condutores", "Queda de tensão e momento elétrico", "Proteção: disjuntor, DR, DPS e aterramento",
      "Eletrodutos", "Alimentador, demanda e padrão de entrada", "Roteiro de planilhas e quadro de cargas",
    ],
  },
];

export const MATERIAIS_PADRAO = MATERIAIS.map(m => ({ ...m, padrao: true }));

export function filtrarMateriais(lista, q, disciplina) {
  const t = q.trim().toLowerCase();
  return lista.filter(m => (!disciplina || m.disciplina === disciplina) &&
    (!t || [m.titulo, m.disciplina, m.resumo, m.autor, ...(m.normas || []), ...(m.topicos || [])].join(" ").toLowerCase().includes(t)));
}
