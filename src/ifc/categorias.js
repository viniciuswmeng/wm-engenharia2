// Classificação dos elementos IFC em categorias e disciplinas (para filtros e cores)

export const DISCIPLINAS = [
  { id: "estrutura",  nome: "Estrutura",       cor: "#1565d8" },
  { id: "arquitetura",nome: "Arquitetura",     cor: "#64748b" },
  { id: "hidro",      nome: "Hidrossanitário", cor: "#0891b2" },
  { id: "eletrica",   nome: "Elétrica",        cor: "#d97706" },
  { id: "climatizacao", nome: "Climatização",  cor: "#7c3aed" },
  { id: "outros",     nome: "Outros",          cor: "#94a3b8" },
];

// tipo IFC (maiúsculo) → [categoria, disciplina, cor padrão]
const MAPA = {
  IFCBEAM:            ["Vigas", "estrutura", 0x3f7fd8],
  IFCCOLUMN:          ["Pilares", "estrutura", 0xd9534f],
  IFCSLAB:            ["Lajes", "estrutura", 0xb7c7dc],
  IFCFOOTING:         ["Fundações", "estrutura", 0x2e9d63],
  IFCPILE:            ["Estacas", "estrutura", 0x8b5a2b],
  IFCMEMBER:          ["Barras", "estrutura", 0x8e5cc4],
  IFCPLATE:           ["Chapas", "estrutura", 0x7f8c8d],
  IFCREINFORCINGBAR:  ["Armaduras", "estrutura", 0xc0392b],
  IFCREINFORCINGMESH: ["Armaduras", "estrutura", 0xc0392b],
  IFCTENDON:          ["Armaduras", "estrutura", 0xc0392b],
  IFCSTAIR:           ["Escadas", "estrutura", 0xe67e22],
  IFCSTAIRFLIGHT:     ["Escadas", "estrutura", 0xe67e22],
  IFCRAMP:            ["Rampas", "estrutura", 0xf39c12],
  IFCRAMPFLIGHT:      ["Rampas", "estrutura", 0xf39c12],
  IFCFASTENER:        ["Conectores", "estrutura", 0x2c3e50],
  IFCMECHANICALFASTENER: ["Conectores", "estrutura", 0x2c3e50],

  IFCWALL:             ["Paredes", "arquitetura", 0xe8ecf1],
  IFCWALLSTANDARDCASE: ["Paredes", "arquitetura", 0xe8ecf1],
  IFCCURTAINWALL:      ["Fachadas", "arquitetura", 0x9ec5e8],
  IFCDOOR:             ["Portas", "arquitetura", 0xa47148],
  IFCWINDOW:           ["Janelas", "arquitetura", 0x7fb3e0],
  IFCROOF:             ["Cobertura", "arquitetura", 0xa94442],
  IFCCOVERING:         ["Revestimentos", "arquitetura", 0xd6dde6],
  IFCRAILING:          ["Guarda-corpos", "arquitetura", 0x566573],
  IFCFURNISHINGELEMENT:["Mobiliário", "arquitetura", 0xc8a27a],
  IFCFURNITURE:        ["Mobiliário", "arquitetura", 0xc8a27a],
  IFCSPACE:            ["Ambientes", "arquitetura", 0x9fd3f5],

  IFCPIPESEGMENT:      ["Tubulações", "hidro", 0x1aa0c8],
  IFCPIPEFITTING:      ["Conexões", "hidro", 0x0e7490],
  IFCFLOWSEGMENT:      ["Tubulações", "hidro", 0x1aa0c8],
  IFCFLOWFITTING:      ["Conexões", "hidro", 0x0e7490],
  IFCSANITARYTERMINAL: ["Louças e metais", "hidro", 0xf1f5f9],
  IFCWASTETERMINAL:    ["Ralos", "hidro", 0x475569],
  IFCFLOWTERMINAL:     ["Terminais", "hidro", 0x67e8f9],
  IFCVALVE:            ["Registros", "hidro", 0x16a34a],
  IFCFLOWCONTROLLER:   ["Registros", "hidro", 0x16a34a],
  IFCTANK:             ["Reservatórios", "hidro", 0x38bdf8],
  IFCFLOWSTORAGEDEVICE:["Reservatórios", "hidro", 0x38bdf8],
  IFCPUMP:             ["Bombas", "hidro", 0x0369a1],
  IFCFLOWMOVINGDEVICE: ["Bombas", "hidro", 0x0369a1],

  IFCCABLECARRIERSEGMENT: ["Eletrodutos", "eletrica", 0xf59e0b],
  IFCCABLECARRIERFITTING: ["Eletrodutos", "eletrica", 0xf59e0b],
  IFCCABLESEGMENT:        ["Cabos", "eletrica", 0xb45309],
  IFCCABLEFITTING:        ["Cabos", "eletrica", 0xb45309],
  IFCLIGHTFIXTURE:        ["Iluminação", "eletrica", 0xfde047],
  IFCLAMP:                ["Iluminação", "eletrica", 0xfde047],
  IFCOUTLET:              ["Tomadas", "eletrica", 0xea580c],
  IFCSWITCHINGDEVICE:     ["Interruptores", "eletrica", 0xfb923c],
  IFCELECTRICDISTRIBUTIONBOARD: ["Quadros", "eletrica", 0x78350f],
  IFCJUNCTIONBOX:         ["Caixas de passagem", "eletrica", 0x92400e],
  IFCENERGYCONVERSIONDEVICE: ["Equipamentos", "eletrica", 0xa16207],

  IFCDUCTSEGMENT:      ["Dutos", "climatizacao", 0xa78bfa],
  IFCDUCTFITTING:      ["Dutos", "climatizacao", 0xa78bfa],
  IFCAIRTERMINAL:      ["Difusores", "climatizacao", 0x8b5cf6],
  IFCUNITARYEQUIPMENT: ["Equipamentos", "climatizacao", 0x6d28d9],

  IFCBUILDINGELEMENTPROXY: ["Outros elementos", "outros", 0xa3aab5],
};

const NOMES_TIPO = { IFCOPENINGELEMENT: null, IFCANNOTATION: null, IFCGRID: null, IFCVIRTUALELEMENT: null };

export function classificar(tipo) {
  const t = String(tipo || "").toUpperCase();
  if (t in NOMES_TIPO) return null;
  const m = MAPA[t];
  if (m) return { categoria: m[0], disciplina: m[1], cor: m[2] };
  // genéricos: IfcFlow*, IfcDistribution*
  if (t.startsWith("IFCFLOW") || t.startsWith("IFCDISTRIBUTION")) return { categoria: "Instalações", disciplina: "outros", cor: 0x94a3b8 };
  const nome = t.replace(/^IFC/, "");
  return { categoria: nome.charAt(0) + nome.slice(1).toLowerCase(), disciplina: "outros", cor: 0xa3aab5 };
}

export const nomeDisciplina = id => DISCIPLINAS.find(d => d.id === id)?.nome || "Outros";
export const hex = n => "#" + Number(n).toString(16).padStart(6, "0");

// Nome amigável do tipo IFC para o painel de propriedades
export const TIPO_LEGIVEL = t => {
  const c = classificar(t);
  return c ? c.categoria : String(t || "").replace(/^Ifc/i, "");
};

// Disciplinas usadas ao vincular o modelo a um projeto
export const DISCIPLINAS_MODELO = ["Estrutural", "Arquitetônico", "Hidrossanitário", "Elétrico", "Climatização", "Compatibilização", "Outro"];
