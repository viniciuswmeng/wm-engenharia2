// Configuração de cada disciplina da verificação: como ler o IFC e a lista, quais regras aplicar e como cruzar.
// A página só percorre este roteiro; as regras ficam nos motores de cada disciplina.
import { SISTEMAS } from "./regras.js";
import { extrairIfc } from "./extrairIfc.js";
import { verificarHidroIfc, quantitativosIfc } from "./motorHidro.js";
import { lerLista, verificarLista, cruzarIfcLista, lerPlanilha } from "./lista.js";
import { extrairIfcEletrica } from "./extrairIfcEletrica.js";
import { verificarEletricaIfc, quantitativosEletrica } from "./motorEletrica.js";
import { lerListaEletrica, verificarListaEletrica, cruzarEletrica, verificarGlobalEletrica } from "./listaEletrica.js";
import { SISTEMAS_E, NORMAS_ELETRICA } from "./regrasEletrica.js";
import { extrairIfcGeral } from "./extrairIfcGeral.js";
import { verificarEstruturalIfc, quantitativosEstrutural } from "./motorEstrutural.js";
import { verificarArquiteturaIfc, analisarPranchasPrefeitura, verificarPrefeitura } from "./motorArquitetura.js";
import { verificarInterioresIfc, quantitativosInteriores } from "./motorInteriores.js";
import {
  interpretarListaEstrutural, verificarListaEstrutural, cruzarEstrutural, interpretarListaArquitetura, verificarListaArquitetura, quantitativosArquitetura, cruzarArquitetura,
  interpretarListaInteriores, verificarListaInteriores, cruzarInteriores,
} from "./listaOutras.js";
import { NORMAS_ESTRUTURA, NORMAS_ARQUITETURA, NORMAS_BOMBEIROS, NORMAS_INTERIORES } from "./regrasOutras.js";
import { NORMAS } from "./regras.js";

const conta = (m, c) => m.elementos.filter(e => e.classe === c).length;
const CORES_GERAIS = { porta: { nome: "Portas", cor: "#a47148" }, janela: { nome: "Janelas", cor: "#0891b2" }, concreto: { nome: "Concreto", cor: "#64748b" }, aco: { nome: "Aço", cor: "#be123c" }, movel: { nome: "Móveis", cor: "#c8a27a" } };

export const DISCIPLINAS = {
  hidro: {
    nome: "Hidrossanitário", prefixo: "Verificacao_Hidrossanitario_WM", normas: NORMAS, cores: SISTEMAS,
    legendaIfc: "Hidrossanitário exportado do Revit, QiBuilder etc.", legendaLista: "Excel ou CSV (a lista do QiBuilder é lida direto)",
    extrair: extrairIfc, verificarModelos: modelos => modelos.flatMap(verificarHidroIfc),
    lerLista, verificarLista: l => verificarLista(l), cruzar: (modelos, l) => cruzarIfcLista(quantitativosIfc(modelos), l),
    resumoModelo: m => `${m.nome}: ${conta(m, "tubo")} tubos, ${conta(m, "terminal")} aparelhos`, temPortas: m => m.temPortas, dnsLista: true,
  },
  eletrica: {
    nome: "Elétrico", prefixo: "Verificacao_Eletrico_WM", normas: NORMAS_ELETRICA, cores: SISTEMAS_E,
    legendaIfc: "Elétrico exportado do Revit, QiBuilder etc. Envie também o IFC da arquitetura para as regras por cômodo.", legendaLista: "Excel ou CSV (a lista do QiBuilder é lida direto)",
    extrair: extrairIfcEletrica, verificarModelos: modelos => verificarEletricaIfc(modelos),
    lerLista: lerListaEletrica, verificarLista: l => verificarListaEletrica(l), cruzar: (modelos, l) => cruzarEletrica(quantitativosEletrica(modelos), l),
    global: ({ modelos, lista, paginas }) => verificarGlobalEletrica({ modelos, lista, paginas }),
    resumoModelo: m => `${m.nome}: ${conta(m, "tomada")} tomadas, ${conta(m, "luminaria")} pontos de luz, ${(m.ambientes || []).length} ambientes`,
  },
  estrutura: {
    nome: "Estrutural", prefixo: "Verificacao_Estrutural_WM", normas: NORMAS_ESTRUTURA, cores: CORES_GERAIS,
    legendaIfc: "Estrutural exportado do Eberick, TQS, Revit etc. Envie também o IFC da arquitetura para conferir pilares e vigas × esquadrias.", legendaLista: "Resumo de aço e concreto em Excel ou CSV",
    extrair: extrairIfcGeral, verificarModelos: (modelos, op) => verificarEstruturalIfc(modelos, op),
    lerLista: async f => interpretarListaEstrutural(await lerPlanilha(f), f.name), verificarLista: (l, op) => verificarListaEstrutural(l, op), cruzar: (modelos, l) => cruzarEstrutural(quantitativosEstrutural(modelos), l),
    resumoModelo: m => `${m.nome}: ${conta(m, "pilar")} pilares, ${conta(m, "viga")} vigas, ${conta(m, "laje")} lajes`,
  },
  arquitetura: {
    nome: "Arquitetônico", prefixo: "Verificacao_Arquitetonico_WM", normas: NORMAS_ARQUITETURA, normasExtras: op => op.bombeiros ? NORMAS_BOMBEIROS : {}, cores: CORES_GERAIS,
    legendaIfc: "Arquitetura exportada do Archicad, Revit etc., com ambientes/zonas.", legendaLista: "Quadro de esquadrias em Excel ou CSV (opcional)",
    extrair: extrairIfcGeral,
    // no projeto legal, o quadro de áreas lido nas pranchas entra na conferência do modelo
    verificarModelos: (modelos, op) => verificarArquiteturaIfc(modelos, { ...op, declarado: op.declarado }),
    lerLista: async f => interpretarListaArquitetura(await lerPlanilha(f), f.name), verificarLista: l => verificarListaArquitetura(l), cruzar: (modelos, l) => cruzarArquitetura(quantitativosArquitetura(modelos), l),
    antesDosModelos: ({ paginas, op }) => { if (op.modo !== "prefeitura" || !paginas.length) return { apontamentos: [] }; const r = analisarPranchasPrefeitura(paginas); op.declarado = r.declarado; return r; },
    // projeto legal só com pranchas (sem IFC): confere o quadro de áreas com os parâmetros
    semModelos: ({ op }) => op.modo === "prefeitura" && op.declarado ? verificarPrefeitura([], op.params, op.declarado, (() => { let i = 0; return () => `pref-${++i}`; })()) : [],
    resumoModelo: m => `${m.nome}: ${conta(m, "ambiente")} ambientes, ${conta(m, "porta")} portas, ${conta(m, "janela")} janelas${m.areaConstruida ? `, área construída estimada ${m.areaConstruida.toFixed(0)} m²` : ""}`,
  },
  interiores: {
    nome: "Interiores", prefixo: "Verificacao_Interiores_WM", normas: NORMAS_INTERIORES, cores: CORES_GERAIS,
    legendaIfc: "Interiores com o mobiliário. Envie também os IFC da arquitetura e do elétrico para conferir paredes, portas e pontos.", legendaLista: "Lista de móveis/marcenaria em Excel ou CSV (opcional)",
    extrair: extrairIfcGeral, verificarModelos: modelos => verificarInterioresIfc(modelos),
    lerLista: async f => interpretarListaInteriores(await lerPlanilha(f), f.name), verificarLista: l => verificarListaInteriores(l), cruzar: (modelos, l) => cruzarInteriores(quantitativosInteriores(modelos), l),
    resumoModelo: m => `${m.nome}: ${conta(m, "movel")} móveis`,
  },
};
export const ORDEM_DISCIPLINAS = ["hidro", "eletrica", "estrutura", "arquitetura", "interiores"];
export const disciplinaPorNome = nome => Object.values(DISCIPLINAS).find(d => d.nome === nome) || DISCIPLINAS.hidro;
