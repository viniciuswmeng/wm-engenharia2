// Materiais de apoio (PDFs em public/materiais). Para incluir um novo, copie o PDF e a capa (.png) para
// public/materiais e acrescente um item nesta lista.
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

export function filtrarMateriais(q) {
  const t = q.trim().toLowerCase();
  return MATERIAIS.filter(m => !t || [m.titulo, m.disciplina, m.resumo, ...m.normas, ...m.topicos].join(" ").toLowerCase().includes(t));
}
