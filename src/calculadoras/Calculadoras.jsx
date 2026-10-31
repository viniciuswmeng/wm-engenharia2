import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Icone from "../ui/Icone.jsx";
import { Abas } from "../ui/ds.jsx";
import { ListaMateriais, LeitorMaterial, ModalAdicionarMaterial } from "./MateriaisApoio.jsx";
import { MATERIAIS_PADRAO } from "./materiais.js";
import { materiaisDb } from "./dadosMateriais.js";

const numParseBR = (v, def=0) => parseFloat(String(v||'').replace(',','.')) || def;

// ─── ABA CALCULADORAS TÉCNICAS ────────────────────────────────────────────────
// Estrutura organizada por categoria. Cada calculadora é um card independente.
// Para adicionar uma nova: basta inserir um novo objeto em CALCULADORAS.

// ── Bitolas padrão NBR — valores da planilha de bitolas ──
const BITOLAS = [
  { nome:"Ø 4,2mm",  pol:"",        area:0.14,  peso:0.109 },
  { nome:"Ø 5,0mm",  pol:'3/16"',   area:0.196, peso:0.154 },
  { nome:"Ø 6,3mm",  pol:'1/4"',    area:0.31,  peso:0.245 },
  { nome:"Ø 8,0mm",  pol:'5/16"',   area:0.50,  peso:0.395 },
  { nome:"Ø 10,0mm", pol:'3/8"',    area:0.785, peso:0.617 },
  { nome:"Ø 12,5mm", pol:'1/2"',    area:1.22,  peso:0.963 },
  { nome:"Ø 16,0mm", pol:'5/8"',    area:2.01,  peso:1.578 },
  { nome:"Ø 20,0mm", pol:'3/4"',    area:3.14,  peso:2.466 },
  { nome:"Ø 25,0mm", pol:'1"',      area:4.91,  peso:3.853 },
  { nome:"Ø 32,0mm", pol:'1 1/4"',  area:8.04,  peso:6.313 },
];

// ── helpers ──
const num = (v, def=0) => numParseBR(v, def);
const fmt2 = v => Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt3 = v => Number(v).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});

// ── componente de campo ──
// ── Campo, Select, Resultado — design minimalista ──
const CS = { // campo style (padrão WM)
  border:'1px solid #d9e2ee', borderRadius:10, padding:'10px 12px',
  fontSize:14, fontFamily:'inherit', color:'#0f1f3d',
  background:'white', width:'100%', boxSizing:'border-box',
  transition:'border-color 0.15s',
};

function Campo({ label, value, onChange, unit, type="number", hint, min, step }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
        <label style={{fontSize:12.5,fontWeight:600,color:'#334866'}}>
          {label}
        </label>
        {unit && <span style={{fontSize:11,fontWeight:600,color:'#1565d8',background:'#eef4fd',
          padding:'2px 7px',borderRadius:6}}>{unit}</span>}
      </div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        min={min} step={step} style={CS}/>
      {hint && <div style={{fontSize:11.5,color:'#6b7a90',marginTop:4}}>{hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12.5,fontWeight:600,color:'#334866',display:'block',marginBottom:5}}>
        {label}
      </label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{...CS, cursor:'pointer'}}>
        {options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
      </select>
    </div>
  );
}

function Resultado({ itens, aviso }) {
  if ((!itens || itens.length === 0) && !aviso) return null;
  const destaques = (itens||[]).filter(it=>it.destaque);
  const normais   = (itens||[]).filter(it=>!it.destaque);
  return (
    <div style={{marginTop:20}}>
      {/* Valores destaque em cards */}
      {destaques.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(destaques.length,2)},1fr)`,
          gap:10,marginBottom:normais.length>0?12:0}}>
          {destaques.map((it,i)=>(
            <div key={i} style={{background:'linear-gradient(135deg,#0c2b62 0%,#1565d8 100%)',borderRadius:14,padding:'16px 18px',textAlign:'center',boxShadow:'0 6px 18px rgba(21,101,216,.22)'}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',fontWeight:600,
                textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{it.label}</div>
              <div style={{fontSize:24,fontWeight:800,color:'white',lineHeight:1}}>
                {it.valor}
                {it.unit && <span style={{fontSize:12,fontWeight:400,color:'rgba(255,255,255,0.6)',marginLeft:4}}>{it.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Valores secundários em lista limpa */}
      {normais.length > 0 && (
        <div style={{background:'#f8fafc',borderRadius:12,overflow:'hidden',
          border:'1px solid #e6ecf4'}}>
          {normais.map((it,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',
              alignItems:'center',padding:'9px 14px',
              borderBottom:i<normais.length-1?'1px solid #e6ecf4':'none',
              background:i%2===0?'#f8fafc':'white'}}>
              <span style={{fontSize:12,color:'#6b7a90'}}>{it.label}</span>
              <span style={{fontSize:13,fontWeight:600,color:'#334866'}}>
                {it.valor}
                {it.unit && <span style={{fontSize:11,color:'#8a97ab',marginLeft:3}}>{it.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {aviso && (
        <div style={{marginTop:10,fontSize:11,color:'#92400e',background:'#fffbeb',
          borderRadius:6,padding:'8px 12px',border:'1px solid #fde68a',display:'flex',gap:6}}>
          <span aria-hidden="true" style={{fontWeight:800}}>!</span><span>{aviso}</span>
        </div>
      )}
    </div>
  );
}

function CardCalc({ titulo, icone, children }) {
  // No novo design os cards não são usados diretamente —
  // mantido por compatibilidade com as calculadoras de fundação/superestrutura
  return <div style={{paddingTop:4}}>{children}</div>;
}

// ════════════════════════════════════════════════════════════
// CALCULADORAS
// ════════════════════════════════════════════════════════════

// ── VERIFICAÇÕES PONTUAIS ──────────────────────────────────

function CalcBitolas() {
  const [bitola, setBitola] = useState("0");
  const [qtd,    setQtd]    = useState('1');
  const [comp,   setComp]   = useState('');
  const b = BITOLAS[parseInt(bitola)];
  const n = num(qtd,1), c = num(comp);
  const pesoUnit   = b.peso;                        // kg/m
  const pesoTotal  = c ? n * c * pesoUnit : null;
  const areaTotal  = n * b.area;
  return (
    <>
      <Select label="Bitola" value={bitola} onChange={setBitola}
        options={BITOLAS.map((b,i)=>({v:String(i),l:`${b.nome} — ${b.peso} kg/m — As=${b.area} cm²`}))}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Campo label="Quantidade de barras" value={qtd} onChange={setQtd} min="1" step="1"/>
        <Campo label="Comprimento por barra" value={comp} onChange={setComp} unit="m" hint="Opcional"/>
      </div>
      <Resultado itens={[
        {label:'Área de aço (As) por barra',  valor:fmt3(b.area),  unit:'cm²'},
        {label:'Área de aço total (As)',       valor:fmt3(areaTotal), unit:'cm²', destaque:true},
        {label:'Peso unitário',                valor:fmt3(pesoUnit),  unit:'kg/m'},
        ...(pesoTotal!=null?[{label:`Peso total (${n} × ${c}m)`, valor:fmt2(pesoTotal), unit:'kg', destaque:true}]:[]),
      ]}/>
    </>
  );
}

function CalcEspacamento() {
  // Fiel à planilha: Ø escolhida, qtd barras, bw viga, Ø estribo, classe agressividade
  // Lógica: tenta encaixar N barras na 1ª camada; se não cabe, reduz N até caber
  // Espaço disponível = bw - 2×cobrimento - 2×Ø_estribo
  // Espaçamento = (espaço_disp - N×Ø_barra) / (N-1)
  // Critério mínimo: maior entre (Ø_barra, 2cm, 1.2×brita_max)
  const [iBitola, setIBitola] = useState("5"); // 12.5mm default
  const [qtd,     setQtd]     = useState("4");
  const [bw,      setBw]      = useState("20");
  const [iEstribo,setIEstribo]= useState("0"); // 5mm default
  const [classe,  setClasse]  = useState("2");

  const b      = BITOLAS[parseInt(iBitola)];
  const bEst   = BITOLAS[parseInt(iEstribo)];
  const phi_cm = parseFloat(b.nome.replace("Ø ","").replace("mm","").trim()) / 10;
  const est_cm = parseFloat(bEst.nome.replace("Ø ","").replace("mm","").trim()) / 10;
  const qtdV   = parseInt(qtd) || 0;
  const bwV    = num(bw);

  // Cobrimento por classe de agressividade (NBR 6118 Tab. 7.2 — vigas/pilares)
  const cobMap = {"1":2.5,"2":3.0,"3":4.0,"4":5.0};
  const cob    = cobMap[classe] || 3.0; // cm

  // Espaço disponível (cm)
  const espDisp = bwV - 2*cob - 2*est_cm;

  // Critério mínimo de espaçamento (NBR 6118 §18.3.2)
  // e_min = maior(phi_barra, 2.0cm, 1.2×dmax_brita)
  // adotando dmax_brita = 1.9cm (brita 1 — padrão residencial)
  const espMin = Math.max(phi_cm, 2.0, 1.2 * 1.9); // cm

  // Encontra quantas barras cabem na 1ª camada (lógica idêntica à planilha)
  let n1cam = 0, espFinal = 0, cabe = false;
  if(bwV > 0 && qtdV > 0){
    // Tenta colocar qtdV barras, depois reduz 1 a 1
    for(let n = qtdV; n >= 1; n--){
      const esp = n === 1
        ? espDisp - phi_cm
        : Math.floor((espDisp - n*phi_cm) / (n-1) * 100) / 100;
      if(esp >= espMin){
        n1cam   = n;
        espFinal = esp;
        cabe    = true;
        break;
      }
    }
  }

  const nCamadas = n1cam > 0 && qtdV > 0 ? Math.ceil(qtdV / n1cam) : 0;
  const nSobra   = n1cam > 0 ? qtdV - n1cam : 0;

  const opBitolas = BITOLAS.map((b,i) => ({v:String(i), l:b.nome}));

  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Select label="Bitola escolhida" value={iBitola} onChange={setIBitola} options={opBitolas}/>
        <Campo label="Quantidade de barras" value={qtd} onChange={setQtd} min="1" step="1"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Campo label="Largura da viga bw" value={bw} onChange={setBw} unit="cm"/>
        <Select label="Bitola do estribo" value={iEstribo} onChange={setIEstribo} options={opBitolas}/>
        <Select label="Classe de agressividade" value={classe} onChange={setClasse} options={[
          {v:"1",l:"I — Fraca (rural/submerso)"},
          {v:"2",l:"II — Moderada (urbana)"},
          {v:"3",l:"III — Forte (marinha/industrial)"},
          {v:"4",l:"IV — Muito forte (respingos mar)"},
        ]}/>
      </div>
      {bwV > 0 && qtdV > 0 && (
        <Resultado
          aviso={!cabe ? `Nenhuma configuração cabe em bw=${bwV}cm com Ø${b.nome.replace("Ø ","")}. Aumente a seção ou reduza a bitola.` : undefined}
          itens={cabe ? [
            {label:"Cobrimento (classe "+classe+")",    valor:cob,          unit:"cm"},
            {label:"Espaço disponível",                 valor:fmt2(espDisp), unit:"cm"},
            {label:"Espaço mínimo NBR 6118",            valor:fmt2(espMin),  unit:"cm"},
            {label:"Barras na 1ª camada",               valor:n1cam,         unit:"barras", destaque:true},
            {label:"Espaçamento livre",                 valor:fmt2(espFinal),unit:"cm",     destaque:true},
            ...(nSobra > 0 ? [
              {label:"Barras restantes (2ª camada+)",   valor:nSobra,        unit:"barras"},
              {label:"Nº de camadas estimadas",         valor:nCamadas,      unit:"camadas"},
            ] : []),
          ]:[]}
        />
      )}
    </>
  );
}

function CalcArmaduraCostura() {
  // Fiel à planilha — dois modos:
  // Modo 1: dado As (cm²/m) + Ø → calcula espaçamento necessário
  // Modo 2: dado Ø + espaçamento adotado → calcula As efetivo
  // Fórmula planilha modo 2: As_ef = (π×d²/100/4) × (100/Es)  [cm²/m]
  const [modo,  setModo]  = useState("1");
  const [iBitola,setIBit] = useState("0"); // 5mm default
  const [as,    setAs]    = useState("");   // modo 1
  const [esp,   setEsp]   = useState("");   // modo 2

  const b     = BITOLAS[parseInt(iBitola)];
  const phi_mm= parseFloat(b.nome.replace("Ø ","").replace("mm","").trim());
  const asV   = num(as);
  const espV  = num(esp);

  // Área da seção da barra em cm²
  const area_barra = Math.PI * (phi_mm/10)**2 / 4; // cm²

  // Modo 1: espaçamento = area_barra × 100 / As  (cm)
  const espCalculado = asV > 0 ? area_barra * 100 / asV : 0;

  // Modo 2: As efetivo = area_barra × (100 / Es)  [cm²/m]  — fórmula F8 da planilha
  const asEfetivo = espV > 0 ? area_barra * (100 / espV) : 0;

  const opBitolas = BITOLAS.map((b,i) => ({v:String(i), l:b.nome+(b.pol?" ("+b.pol+")":"")}));

  return (
    <>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["1","2"].map(m=>(
          <button key={m} onClick={()=>setModo(m)}
            style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid",cursor:"pointer",
              fontFamily:"inherit",fontSize:12,fontWeight:600,
              background:modo===m?"#0b2350":"white",
              color:modo===m?"white":"#334866",
              borderColor:modo===m?"#0b2350":"#e6ecf4"}}>
            {m==="1" ? "As + Ø → Espaçamento" : "Ø + Espaçamento → As"}
          </button>
        ))}
      </div>

      <Select label="Diâmetro da barra" value={iBitola} onChange={setIBit} options={opBitolas}/>

      {modo==="1" && (
        <>
          <Campo label="Armadura de costura necessária" value={as} onChange={setAs}
            unit="cm²/m" hint="Área de aço por metro linear"/>
          <Resultado itens={asV>0?[
            {label:"Área da seção da barra", valor:fmt3(area_barra), unit:"cm²"},
            {label:"Espaçamento necessário", valor:fmt2(espCalculado), unit:"cm", destaque:true},
          ]:[]}/>
        </>
      )}

      {modo==="2" && (
        <>
          <Campo label="Espaçamento adotado" value={esp} onChange={setEsp}
            unit="cm" hint="Distância entre barras de costura"/>
          <Resultado itens={espV>0?[
            {label:"Área da seção da barra", valor:fmt3(area_barra), unit:"cm²"},
            {label:"As efetivo",             valor:fmt3(asEfetivo),  unit:"cm²/m", destaque:true},
          ]:[]}/>
        </>
      )}
    </>
  );
}

function CalcConversaoBitola() {
  // Fiel à planilha: qtd_atual × Ø_atual → quantas barras de Ø_desejada
  const [iAtual,   setIAtual]   = useState("4");  // índice na tabela (10mm default)
  const [qtdAtual, setQtdAtual] = useState("2");
  const [iDesej,   setIDesej]   = useState("3");  // índice (8mm default)

  const bAtual = BITOLAS[parseInt(iAtual)];
  const bDesej = BITOLAS[parseInt(iDesej)];
  const qtdV   = parseInt(qtdAtual) || 0;

  const asTotal    = qtdV * bAtual.area;
  const qtdConvert = asTotal > 0 && bDesej.area > 0
    ? Math.ceil(asTotal / bDesej.area) : 0;
  const asFornecida = qtdConvert * bDesej.area;

  const opBitolas = BITOLAS.map((b,i) => ({
    v: String(i),
    l: `${b.nome}${b.pol ? " ("+b.pol+")" : ""} — As=${b.area} cm²`,
  }));

  return (
    <>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
        <Select label="Bitola ATUAL" value={iAtual} onChange={setIAtual} options={opBitolas}/>
        <Campo label="Quantidade ATUAL de barras" value={qtdAtual} onChange={setQtdAtual} min="1" step="1"/>
      </div>
      <Select label="Bitola DESEJADA (converter para)" value={iDesej} onChange={setIDesej} options={opBitolas}/>
      <Resultado itens={qtdV > 0 ? [
        {label:"Área de aço atual",              valor:fmt3(asTotal),     unit:"cm²"},
        {label:"Quantidade necessária ("+bDesej.nome+")", valor:qtdConvert, unit:"barras", destaque:true},
        {label:"Área de aço fornecida",          valor:fmt3(asFornecida), unit:"cm²"},
        {label:"Diferença (As fornecida − As atual)", valor:fmt3(asFornecida - asTotal), unit:"cm²"},
      ]:[]}/>
    </>
  );
}

// ── FUNDAÇÕES ─────────────────────────────────────────────




// ── SUPERESTRUTURA ────────────────────────────────────────




// ── MURO DE ARRIMO ────────────────────────────────────────


// ════════════════════════════════════════════════════════════
// ABA PRINCIPAL
// ════════════════════════════════════════════════════════════

const CATS_CALC = [
  { id:'verif',   label:'🔍 Verificações Pontuais',  icone:'🔍' },
  { id:'fund',    label:'🏗 Fundações',               icone:'🏗' },
  { id:'super',   label:'🏢 Superestrutura',          icone:'🏢' },
  { id:'arrimo',  label:'🪨 Muro de Arrimo',          icone:'🪨' },
];


// ─── CALCULADORAS DE CAIXA D'ÁGUA ─────────────────────────────────────────────

// Tabela NBR 5626 — consumo diário por tipo de edificação
const CONSUMO_EDIFICACAO = [
  { tipo:'Residências',                          consumo:300, unidade:'per capita',     nota:'200 a 400 L/dia — adotado 300 (médio)' },
  { tipo:'Casas populares ou rurais',             consumo:120, unidade:'per capita',     nota:'' },
  { tipo:'Alojamento provisório',                consumo:80,  unidade:'per capita',     nota:'' },
  { tipo:'Apartamentos — dormitório família',    consumo:400, unidade:'por dormitório', nota:'400 L/dorm família + 200 L/dorm serviço' },
  { tipo:'Hotéis (sem cozinha e lavanderia)',     consumo:120, unidade:'por hóspede',    nota:'' },
  { tipo:'Hotéis (com cozinha e lavanderia)',     consumo:300, unidade:'por hóspede',    nota:'' },
  { tipo:'Hospitais',                            consumo:250, unidade:'por leito',      nota:'' },
  { tipo:'Escolas — internato',                  consumo:150, unidade:'per capita',     nota:'' },
  { tipo:'Escolas — semi-internato',             consumo:100, unidade:'per capita',     nota:'' },
  { tipo:'Escolas — externato',                  consumo:50,  unidade:'per capita',     nota:'' },
  { tipo:'Quartéis',                             consumo:150, unidade:'per capita',     nota:'' },
  { tipo:'Edifícios públicos e comerciais',      consumo:50,  unidade:'per capita',     nota:'' },
  { tipo:'Cinemas, teatros e similares',         consumo:2,   unidade:'por lugar',      nota:'' },
  { tipo:'Restaurantes e similares',             consumo:25,  unidade:'por refeição',   nota:'' },
  { tipo:'Lavanderias',                          consumo:30,  unidade:'por kg roupa seca', nota:'' },
  { tipo:'Mercados públicos',                    consumo:5,   unidade:'por m² de área', nota:'' },
  { tipo:'Fábricas (uso pessoal)',               consumo:70,  unidade:'por operário',   nota:'' },
  { tipo:'Postos de serviço p/ automóveis',      consumo:150, unidade:'por veículo',    nota:'' },
  { tipo:'Jardins e parques',                    consumo:2,   unidade:'por m² de área', nota:'' },
  { tipo:'Orfanatos, asilos e berçários',        consumo:150, unidade:'per capita',     nota:'' },
  { tipo:'Ambulatórios',                         consumo:25,  unidade:'per capita',     nota:'' },
  { tipo:'Creches',                              consumo:50,  unidade:'per capita',     nota:'' },
  { tipo:'Escritórios',                          consumo:200, unidade:'por vaso sanitário', nota:'' },
];

// Tabela de caixas d'água (dimensões e pesos — Fortlev/referência)
const CAIXAS_DAGUA = [
  { cap:100,   A:0.51, B:0.41, C:0.75, D:0.73, E:0.54, pesoVazia:3.80,   pesoCheio:103.80   },
  { cap:150,   A:0.55, B:0.43, C:0.88, D:0.87, E:0.61, pesoVazia:4.50,   pesoCheio:154.50   },
  { cap:250,   A:0.68, B:0.53, C:1.00, D:0.98, E:0.74, pesoVazia:6.40,   pesoCheio:256.40   },
  { cap:310,   A:0.69, B:0.54, C:1.05, D:1.04, E:0.75, pesoVazia:7.50,   pesoCheio:317.50   },
  { cap:500,   A:0.72, B:0.58, C:1.24, D:1.22, E:0.95, pesoVazia:10.06,  pesoCheio:510.06   },
  { cap:750,   A:0.86, B:0.73, C:1.37, D:1.35, E:1.00, pesoVazia:14.50,  pesoCheio:764.50   },
  { cap:1000,  A:0.97, B:0.76, C:1.52, D:1.51, E:1.16, pesoVazia:17.02,  pesoCheio:1017.02  },
  { cap:1500,  A:1.05, B:0.83, C:1.77, D:1.75, E:1.43, pesoVazia:24.21,  pesoCheio:1524.21  },
  { cap:2000,  A:1.10, B:0.90, C:1.89, D:1.88, E:1.55, pesoVazia:34.17,  pesoCheio:2034.17  },
  { cap:3000,  A:1.49, B:1.21, C:2.28, D:2.22, E:1.72, pesoVazia:46.74,  pesoCheio:3046.74  },
  { cap:5000,  A:2.00, B:1.63, C:2.45, D:2.37, E:1.85, pesoVazia:95.00,  pesoCheio:5095.00  },
];


// ─── CALCULADORA DE CONVERSÃO DE UNIDADES ─────────────────────────────────────
const CATEGORIAS_UNID = [
  {
    id: 'forca', label: 'Força', icone: '⚡',
    unidades: [
      { id:'kgf',  label:'kgf',   fator:1           },
      { id:'tf',   label:'tf',    fator:1000         },
      { id:'kN',   label:'kN',    fator:101.9716     },
      { id:'MN',   label:'MN',    fator:101971.6     },
      { id:'N',    label:'N',     fator:0.1019716    },
      { id:'lbf',  label:'lbf',   fator:0.453592     },
      { id:'kip',  label:'kip',   fator:453.592      },
    ],
  },
  {
    id: 'pressao', label: 'Pressão / Tensão', icone: '🔲',
    unidades: [
      { id:'kgfcm2', label:'kgf/cm²', fator:1          },
      { id:'tfm2',   label:'tf/m²',   fator:0.1         },
      { id:'kNm2',   label:'kN/m²',   fator:0.010197    },
      { id:'kPa',    label:'kPa',     fator:0.010197    },
      { id:'MPa',    label:'MPa',     fator:10.1972     },
      { id:'GPa',    label:'GPa',     fator:10197.2     },
      { id:'kgfm2',  label:'kgf/m²',  fator:0.0001      },
      { id:'tfcm2',  label:'tf/cm²',  fator:1000        },
      { id:'bar',    label:'bar',     fator:1.01972     },
      { id:'atm',    label:'atm',     fator:1.03323     },
      { id:'psi',    label:'psi',     fator:0.070307    },
      { id:'ksi',    label:'ksi',     fator:70.307      },
    ],
  },
  {
    id: 'pesoesp', label: 'Peso Específico', icone: '🧱',
    unidades: [
      { id:'kgfm3',  label:'kgf/m³',  fator:1        },
      { id:'tfm3',   label:'tf/m³',   fator:1000     },
      { id:'kNm3',   label:'kN/m³',   fator:101.972  },
      { id:'gcm3',   label:'g/cm³',   fator:1000     },
      { id:'kgfcm3', label:'kgf/cm³', fator:1e6      },
      { id:'lbft3',  label:'lb/ft³',  fator:16.0185  },
    ],
  },
  {
    id: 'momento', label: 'Momento / Torque', icone: '🔄',
    unidades: [
      { id:'kgfm',  label:'kgf·m',   fator:1         },
      { id:'tfm',   label:'tf·m',    fator:1000       },
      { id:'kNm',   label:'kN·m',    fator:101.972    },
      { id:'Nm',    label:'N·m',     fator:0.101972   },
      { id:'kgfcm', label:'kgf·cm',  fator:0.01       },
      { id:'tfcm',  label:'tf·cm',   fator:10         },
      { id:'kNcm',  label:'kN·cm',   fator:1.01972    },
      { id:'lbft',  label:'lbf·ft',  fator:0.138255   },
    ],
  },
  {
    id: 'comp', label: 'Comprimento', icone: '📏',
    unidades: [
      { id:'m',   label:'m',    fator:1       },
      { id:'cm',  label:'cm',   fator:0.01    },
      { id:'mm',  label:'mm',   fator:0.001   },
      { id:'km',  label:'km',   fator:1000    },
      { id:'in',  label:'in',   fator:0.0254  },
      { id:'ft',  label:'ft',   fator:0.3048  },
      { id:'yd',  label:'yd',   fator:0.9144  },
    ],
  },
  {
    id: 'area', label: 'Área', icone: '⬜',
    unidades: [
      { id:'m2',   label:'m²',    fator:1        },
      { id:'cm2',  label:'cm²',   fator:0.0001   },
      { id:'mm2',  label:'mm²',   fator:1e-6     },
      { id:'km2',  label:'km²',   fator:1e6      },
      { id:'ft2',  label:'ft²',   fator:0.0929   },
      { id:'in2',  label:'in²',   fator:0.000645 },
      { id:'ha',   label:'ha',    fator:10000    },
    ],
  },
  {
    id: 'volume', label: 'Volume', icone: '📦',
    unidades: [
      { id:'m3',   label:'m³',    fator:1        },
      { id:'cm3',  label:'cm³',   fator:1e-6     },
      { id:'mm3',  label:'mm³',   fator:1e-9     },
      { id:'L',    label:'L',     fator:0.001    },
      { id:'mL',   label:'mL',    fator:1e-6     },
      { id:'ft3',  label:'ft³',   fator:0.028317 },
      { id:'in3',  label:'in³',   fator:1.638e-5 },
      { id:'gal',  label:'gal',   fator:0.003785 },
    ],
  },
  {
    id: 'massa', label: 'Massa', icone: '⚖️',
    unidades: [
      { id:'kg',  label:'kg',   fator:1        },
      { id:'t',   label:'t',    fator:1000     },
      { id:'g',   label:'g',    fator:0.001    },
      { id:'mg',  label:'mg',   fator:1e-6     },
      { id:'lb',  label:'lb',   fator:0.453592 },
      { id:'oz',  label:'oz',   fator:0.028350 },
      { id:'ton_us', label:'ton (EUA)', fator:907.185 },
    ],
  },
];

function CalcUnidades() {
  const [catId,   setCatId]   = useState('forca');
  const [valor,   setValor]   = useState('1');
  const [origem,  setOrigem]  = useState('');   // id da unidade origem
  const [destino, setDestino] = useState('');   // id da unidade destino
  const [history, setHistory] = useState([]);   // conversões recentes

  const cat    = CATEGORIAS_UNID.find(c => c.id === catId);
  const unids  = cat?.unidades || [];

  // Resetar seleção ao mudar categoria
  useEffect(() => {
    setOrigem(unids[0]?.id  || '');
    setDestino(unids[1]?.id || '');
  }, [catId]);

  const uOrig = unids.find(u => u.id === origem);
  const uDest = unids.find(u => u.id === destino);
  const vNum  = parseFloat(String(valor).replace(',','.'));

  // Conversão: valor → base (kgf/m/etc) → destino
  const resultado = (uOrig && uDest && !isNaN(vNum))
    ? vNum * uOrig.fator / uDest.fator
    : null;

  const fmt = v => {
    if(v === null) return '—';
    if(Math.abs(v) >= 1e6 || (Math.abs(v) < 0.0001 && v !== 0))
      return v.toExponential(6);
    return v.toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:8});
  };

  const addHistory = () => {
    if(resultado === null || !uOrig || !uDest) return;
    const entry = {
      texto: `${fmt(vNum)} ${uOrig.label} = ${fmt(resultado)} ${uDest.label}`,
      cat: cat.label,
    };
    setHistory(h => [entry, ...h.slice(0,9)]);
  };

  const IS = { width:'100%', border:'1px solid #e6ecf4', borderRadius:7,
    padding:'9px 12px', fontSize:14, fontFamily:'inherit', color:'#0f1f3d',
    outline:'none', background:'white', boxSizing:'border-box' };

  return (
    <div style={{maxWidth:680}}>

      {/* Categorias */}
      <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:20}}>
        {CATEGORIAS_UNID.map(cat => (
          <button key={cat.id} onClick={() => setCatId(cat.id)}
            style={{padding:'6px 14px', borderRadius:20, border:'1.5px solid',
              fontFamily:'inherit', fontSize:12, cursor:'pointer',
              fontWeight: catId===cat.id ? 700 : 400,
              borderColor: catId===cat.id ? '#0b2350' : '#e6ecf4',
              background:  catId===cat.id ? '#0b2350' : 'white',
              color:       catId===cat.id ? 'white'   : '#334866',
              transition:  'all 0.15s',
            }}>
            {cat.icone} {cat.label}
          </button>
        ))}
      </div>

      {/* Conversor */}
      <div style={{background:'white', borderRadius:12, border:'1px solid #e6ecf4',
        padding:24, marginBottom:16}}>

        <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:12,
          alignItems:'end', marginBottom:16}}>

          {/* Origem */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#6b7a90',
              textTransform:'uppercase',letterSpacing:0.5,display:'block',marginBottom:4}}>
              De
            </label>
            <select style={{...IS, marginBottom:8}} value={origem}
              onChange={e => setOrigem(e.target.value)}>
              {unids.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <input style={{...IS, fontSize:20, fontWeight:600, color:'#0b2350',
              textAlign:'right'}}
              type="number" value={valor}
              onChange={e => setValor(e.target.value)}
              onFocus={e => e.target.select()}/>
          </div>

          {/* Seta + botão inverter */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,
            paddingBottom:4}}>
            <button onClick={() => { setOrigem(destino); setDestino(origem); }}
              style={{background:'#f1f4f9', border:'1px solid #e6ecf4', borderRadius:8,
                padding:'8px 12px', cursor:'pointer', fontSize:18, color:'#334866',
                transition:'all 0.15s'}}
              title="Inverter">
              ⇄
            </button>
            <span style={{color:'#8a97ab', fontSize:22}}>→</span>
          </div>

          {/* Destino */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#6b7a90',
              textTransform:'uppercase',letterSpacing:0.5,display:'block',marginBottom:4}}>
              Para
            </label>
            <select style={{...IS, marginBottom:8}} value={destino}
              onChange={e => setDestino(e.target.value)}>
              {unids.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            {/* Resultado */}
            <div style={{border:'2px solid #0b2350', borderRadius:7,
              padding:'9px 12px', background:'#eef4fd', minHeight:42,
              display:'flex', alignItems:'center', justifyContent:'flex-end'}}>
              <span style={{fontSize:20, fontWeight:700, color:'#0b2350'}}>
                {fmt(resultado)}
              </span>
            </div>
          </div>
        </div>

        {/* Fórmula */}
        {resultado !== null && uOrig && uDest && (
          <div style={{background:'#f8fafc', borderRadius:8, padding:'10px 14px',
            fontSize:12, color:'#334866', border:'1px solid #e6ecf4',
            display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span>
              <strong>{fmt(vNum)} {uOrig.label}</strong>
              {' = '}
              <strong style={{color:'#0b2350'}}>{fmt(resultado)} {uDest.label}</strong>
            </span>
            <button onClick={addHistory}
              style={{background:'none', border:'1px solid #e6ecf4', borderRadius:6,
                padding:'3px 10px', cursor:'pointer', fontSize:11,
                color:'#6b7a90', fontFamily:'inherit'}}>
              + Salvar
            </button>
          </div>
        )}
      </div>

      {/* Tabela completa de conversão */}
      {uOrig && !isNaN(vNum) && (
        <div style={{background:'white', borderRadius:12, border:'1px solid #e6ecf4',
          padding:16, marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#6b7a90',
            textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
            {fmt(vNum)} {uOrig.label} equivale a:
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6}}>
            {unids.filter(u => u.id !== origem).map(u => {
              const r = vNum * uOrig.fator / u.fator;
              return (
                <div key={u.id}
                  onClick={() => setDestino(u.id)}
                  style={{display:'flex', justifyContent:'space-between',
                    alignItems:'center', padding:'7px 12px', borderRadius:7,
                    background: destino===u.id ? '#eef4fd' : '#f8fafc',
                    border: `1px solid ${destino===u.id ? '#c9daf5' : '#e6ecf4'}`,
                    cursor:'pointer', transition:'all 0.15s'}}>
                  <span style={{fontSize:12, color:'#6b7a90'}}>{u.label}</span>
                  <span style={{fontSize:13, fontWeight:600,
                    color: destino===u.id ? '#0b2350' : '#334866'}}>
                    {fmt(r)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div style={{background:'white', borderRadius:12, border:'1px solid #e6ecf4',
          padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7a90',
              textTransform:'uppercase',letterSpacing:1}}>
              Conversões salvas
            </div>
            <button onClick={() => setHistory([])}
              style={{background:'none',border:'none',cursor:'pointer',
                fontSize:11,color:'#8a97ab',fontFamily:'inherit'}}>
              limpar
            </button>
          </div>
          {history.map((h,i) => (
            <div key={i} style={{fontSize:12, padding:'5px 0',
              borderBottom: i < history.length-1 ? '1px solid #f1f4f9' : 'none',
              color:'#334866', display:'flex', justifyContent:'space-between'}}>
              <span>{h.texto}</span>
              <span style={{fontSize:10,color:'#8a97ab'}}>{h.cat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalcCaixaAgua() {
  const [iTipo,    setITipo]    = useState('0');
  const [pessoas,  setPessoas]  = useState('');
  const [quartos,  setQuartos]  = useState('');
  const isResid = CONSUMO_EDIFICACAO[+iTipo]?.tipo.includes('Residências');
  const isApart = CONSUMO_EDIFICACAO[+iTipo]?.tipo.includes('Apartamento');

  const tip = CONSUMO_EDIFICACAO[+iTipo];
  const qtd = isResid
    ? (parseInt(quartos)||0) * 2  // 2 pessoas por quarto
    : (parseInt(pessoas)||0);
  const volNec = tip && qtd > 0 ? tip.consumo * qtd * 2 : 0; // × 2 reserva

  // Sugere a menor caixa que atende
  const sugerida = CAIXAS_DAGUA.find(cx => cx.cap >= volNec);
  // Todas que atendem
  const opcoes   = CAIXAS_DAGUA.filter(cx => cx.cap >= volNec);

  return (
    <>
      <Select label="Tipo de Edificação" value={iTipo} onChange={setITipo}
        options={CONSUMO_EDIFICACAO.map((e,i)=>({v:String(i), l:`${e.tipo} — ${e.consumo} L/${e.unidade}`}))}/>

      {tip && (
        <div style={{fontSize:11,color:'#6b7a90',background:'#f8fafc',
          borderRadius:6,padding:'6px 10px',marginBottom:10,border:'1px solid #e6ecf4'}}>
          Consumo adotado: <strong>{tip.consumo} L/dia/{tip.unidade}</strong>
          {tip.nota && <span style={{marginLeft:8,color:'#8a97ab'}}>({tip.nota})</span>}
        </div>
      )}

      {isResid || isApart ? (
        <Campo label="Número de quartos" value={quartos} onChange={setQuartos}
          hint="Serão consideradas 2 pessoas por quarto" min="1" step="1"/>
      ) : (
        <Campo label={`Número de ${tip?.unidade || 'pessoas/unidades'}`}
          value={pessoas} onChange={setPessoas} min="1" step="1"/>
      )}

      {volNec > 0 && (
        <>
          <Resultado itens={[
            {label:'Nº de pessoas/unidades consideradas', valor:qtd, unit:tip?.unidade},
            {label:'Volume necessário (consumo × qtd × 2)', valor:volNec.toLocaleString('pt-BR'), unit:'L', destaque:true},
            ...(sugerida ? [{
              label:'Caixa sugerida (menor que atende)',
              valor:`${sugerida.cap.toLocaleString('pt-BR')} L`,
              destaque:true,
            }] : [{label:'Volume necessário excede tabela', valor:'consultar fabricante', destaque:true}]),
          ]}/>

          {opcoes.length > 0 && (
            <div style={{marginTop:12}}>
              <div style={{fontSize:10,fontWeight:700,color:'#1257be',
                textTransform:'uppercase',letterSpacing:1.5,marginBottom:8}}>
                Opções disponíveis
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#eef4fd'}}>
                    {['Capacidade','Ø base (E)','Ø c/ tampa (C)','Altura (B)','Peso cheio'].map(h=>(
                      <th key={h} style={{padding:'5px 8px',textAlign:h==='Capacidade'?'left':'right',
                        fontWeight:700,color:'#0b2350',borderBottom:'2px solid #c9daf5',fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {opcoes.slice(0,5).map((cx,i)=>(
                    <tr key={i} style={{
                      background:cx===sugerida?'#eef4fd':i%2===0?'white':'#f8fafc',
                      fontWeight:cx===sugerida?700:400,
                    }}>
                      <td style={{padding:'5px 8px',color:cx===sugerida?'#0b2350':'#334866'}}>
                        {cx===sugerida?'✓ ':''}{cx.cap.toLocaleString('pt-BR')} L
                      </td>
                      <td style={{padding:'5px 8px',textAlign:'right'}}>{cx.E.toFixed(2)} m</td>
                      <td style={{padding:'5px 8px',textAlign:'right'}}>{cx.C.toFixed(2)} m</td>
                      <td style={{padding:'5px 8px',textAlign:'right'}}>{cx.B.toFixed(2)} m</td>
                      <td style={{padding:'5px 8px',textAlign:'right',
                        color:cx===sugerida?'#059669':'#334866',fontWeight:cx===sugerida?700:400}}>
                        {cx.pesoCheio.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function CalcCargaCaixa() {
  const [iCaixa, setICaixa] = useState('6'); // 1000L default

  const cx = CAIXAS_DAGUA[+iCaixa];
  const E  = cx.E; // diâmetro da base (projeção na laje)

  // Área quadrada (lado = E)
  const areaQuad = E * E;
  // Área circular (diâmetro = E)
  const areaCirc = Math.PI * (E/2) * (E/2);
  // Média
  const areaMedia = (areaQuad + areaCirc) / 2;

  const cargaQuad  = cx.pesoCheio / areaQuad;
  const cargaCirc  = cx.pesoCheio / areaCirc;
  const cargaMedia = cx.pesoCheio / areaMedia;

  const fmt2C = v => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  return (
    <>
      <Select label="Capacidade da caixa d'água" value={iCaixa} onChange={setICaixa}
        options={CAIXAS_DAGUA.map((cx,i)=>({
          v:String(i),
          l:`${cx.cap.toLocaleString('pt-BR')} L — Ø base ${cx.E.toFixed(2)}m — ${cx.pesoCheio.toLocaleString('pt-BR')} kg (cheia)`,
        }))}/>

      {/* Dimensões da caixa selecionada */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>
        {[
          {l:'Altura c/ tampa (A)', v:`${cx.A.toFixed(2)} m`},
          {l:'Altura s/ tampa (B)', v:`${cx.B.toFixed(2)} m`},
          {l:'Ø c/ tampa (C)',      v:`${cx.C.toFixed(2)} m`},
          {l:'Ø s/ tampa (D)',      v:`${cx.D.toFixed(2)} m`},
          {l:'Ø da base (E)',       v:`${cx.E.toFixed(2)} m`, destaque:true},
        ].map(item=>(
          <div key={item.l} style={{background:item.destaque?'#0b2350':'#f8fafc',
            borderRadius:7,padding:'7px 10px',border:'1px solid #e6ecf4',textAlign:'center'}}>
            <div style={{fontSize:9,color:item.destaque?'rgba(255,255,255,0.7)':'#8a97ab',
              fontWeight:600,textTransform:'uppercase',marginBottom:2}}>{item.l}</div>
            <div style={{fontSize:13,fontWeight:700,
              color:item.destaque?'white':'#334866'}}>{item.v}</div>
          </div>
        ))}
      </div>

      <Resultado itens={[
        {label:`Peso caixa cheia`,                               valor:fmt2C(cx.pesoCheio),  unit:'kg'},
        {label:`Área quadrada (${fmt2C(E)} × ${fmt2C(E)} m)`,   valor:fmt2C(areaQuad),       unit:'m²'},
        {label:`Área circular (π × (${fmt2C(E/2)})²)`,          valor:fmt2C(areaCirc),       unit:'m²'},
        {label:'Carga — área quadrada',  valor:fmt2C(cargaQuad),  unit:'kg/m²', destaque:true},
        {label:'Carga — área circular',  valor:fmt2C(cargaCirc),  unit:'kg/m²', destaque:true},
        {label:'Carga — média (adotada)',valor:fmt2C(cargaMedia),  unit:'kg/m²', destaque:true},
      ]}/>

      <div style={{marginTop:10,fontSize:11,color:'#6b7a90',background:'#fffbeb',
        borderRadius:6,padding:'8px 12px',border:'1px solid #fde68a'}}>
        💡 <strong>Recomendação:</strong> usar a <strong>média</strong> como valor de projeto.
        A carga quadrada é mais conservadora e a circular mais otimista.
      </div>
    </>
  );
}

// ─── CALCULADORA: SAPATA ASSOCIADA ────────────────────────────────────────────
// Fórmulas 100% fiéis à planilha Sapatas_associadas_R01.xlsx

// ── helpers matemáticos ──
const ceilMath = (v, step) => Math.ceil(v / step) * step;          // CEILING.MATH
const roundUp  = (v, dec)  => Math.ceil(v * Math.pow(10,dec)) / Math.pow(10,dec); // ROUNDUP
const roundDn  = (v, dec)  => Math.floor(v * Math.pow(10,dec)) / Math.pow(10,dec);

// ── Tabela Asw efetivo (TABELAS AUXILIARES) ──
const ASW_TAB = { 5:0.784, 6.3:1.248, 8:2.012, 10:3.14, 12.5:4.908, 16:8.044 };

function calcSapata(inp) {
  const { sadm, gSolo, fck, gConc, fcy, gAco, LB,
          B, L, Hf,                          // B, L adotados (m); Hf = H fuste (m)
          phiL, phiB, phiEst, nRamos, espEst, // mm, mm, mm, un, cm
          pilares } = inp;                    // [{nome,lp,bp,Nk,Mx,My,Qx,Qy,xp,yp}]

  const pil = pilares.filter(p => p.Nk > 0);
  if (pil.length < 2) return { erro: 'Mínimo 2 pilares com Nk > 0.' };

  // ── PRÉ-DIMENSIONAMENTO ──────────────────────────────────────────────────────
  const sumNk = pil.reduce((s,p) => s + p.Nk, 0);
  const Aest  = (1.1 * sumNk) / sadm;           // m²  — L5: =1.1*SUM(Nk)/sadm
  const Best  = Math.sqrt(Aest / LB);            // m   — L7: =(Aest/LB)^0.5
  const Lest  = Aest / Best;                     // m   — L8: =Aest/Best

  // ── CENTRO DE CARGA (CG) ──────────────────────────────────────────────────
  // L40col J: =ROUND(SUM(Nk*xp)/SUM(Nk), 1)
  const Xcg = Math.round(pil.reduce((s,p) => s + p.Nk*p.xp, 0) / sumNk * 10) / 10; // cm
  const Ycg = Math.round(pil.reduce((s,p) => s + p.Nk*p.yp, 0) / sumNk * 10) / 10; // cm

  // ── GEOMETRIA ─────────────────────────────────────────────────────────────
  const Aef  = B * L;                            // m²  — L13: =B*L

  // Bb = max(B pilar) + 0.10  — L48
  const maxBp = Math.max(...pil.map(p => p.bp)); // cm
  const Bb    = maxBp/100 + 0.10;                // m

  // Ba = (B - Bb) / 2  — L49
  const Ba = (B - Bb) / 2;                       // m

  // H = CEILING.MATH(TAN(45°)*Ba, 0.05)  — L53
  const H = ceilMath(Math.tan(Math.PI/4) * Ba, 0.05); // m

  // H0 = ROUNDUP(H*0.35, 1)  — L52
  const H0 = roundUp(H * 0.35, 1);              // m

  // H1 = H - H0  — L54
  const H1 = H - H0;                             // m (nota: planilha usa H - H52, onde H52=H0)

  // Lb = L*100/2 - Xcg   — L57: =I56*100/2 - J40
  const Lb = L*100/2 - Xcg;                      // cm

  // S = MAX(xp dos pilares)  — L58: =MAX(Tabela2[X,cpi])
  const S  = Math.max(...pil.map(p => p.xp));    // cm

  // La = L*100 - S - Lb  — L59
  const La = L*100 - S - Lb;                     // cm

  // ── VOLUMES E PESOS PRÓPRIOS ───────────────────────────────────────────────
  // Seção transversal trapezoidal (3 áreas)
  // Área01 = B * H0   — L69: =I55*I52
  // Área02 = Bb * H   — L70: =I48*I53
  // Área03 = H1 * Ba  — L71: =I54*I49  (H1=I54, Ba=I49)
  const Af01 = B  * H0;
  const Af02 = Bb * H;
  const Af03 = H1 * Ba;
  const Af   = Af01 + Af02 + Af03;               // m²

  // Volumes
  const VolSap = Af * L;                          // m³ — L75: =Af*L
  const sumAp  = pil.reduce((s,p) => s + (p.lp/100)*(p.bp/100), 0); // m²
  const VolPil = sumAp * Hf;                      // m³ — L76: =SUM(Ap)*H_fuste
  const VolTer = (Hf + H)*B*L - VolSap - VolPil; // m³ — L77

  // Pesos
  const PPil  = VolSap * 2.5;                     // Tf — L80: VolSap*2.5
  const PSap  = VolPil * 2.5;                     // Tf — L81: VolPil*2.5
  const PTer  = VolTer * gSolo;                   // Tf — L82: VolTer*gSolo

  // ── ANÁLISE DE TENSÕES ────────────────────────────────────────────────────
  // ΣN'sk = SUM(Nk) + P_pilar + P_sapata + P_terra  — L86
  const sumNsk = sumNk + PPil + PSap + PTer;

  // ΣQx, ΣQy  — L89, L90
  const sumQx = pil.reduce((s,p) => s + p.Qx, 0);
  const sumQy = pil.reduce((s,p) => s + p.Qy, 0);

  // ΣM'x = (Hf+H)*ΣQy + ΣMx  — L87 (Qy gera Mx)
  const sumMx = (Hf + H)*sumQy + pil.reduce((s,p) => s + p.Mx, 0);

  // ΣM'y = (Hf+H)*ΣQx + ΣMy  — L88 (Qx gera My)
  const sumMy = (Hf + H)*sumQx + pil.reduce((s,p) => s + p.My, 0);

  // Excentricidades
  const Ex = sumMy / sumNsk;  // m  — L92: =ΣM'y/ΣN'sk
  const Ey = sumMx / sumNsk;  // m  — L93: =ΣM'x/ΣN'sk

  // Tensões normalizadas
  const sN  = (sumNsk * 10) / Aef;  // kN/m²  — L94: =(ΣN'sk*10)/Aef
  const sMX = Ey / B;               // kN/m²  — L95: =Ey/B
  const sMY = Ex / L;               // kN/m²  — L96: =Ex/L

  // Tensões nos cantos
  const sa = sN*(1 - sMX - sMY);   // L98
  const sb = sN*(1 - sMX + sMY);   // L99
  const sc = sN*(1 + sMX - sMY);   // L100
  const sd = sN*(1 + sMX + sMY);   // L101

  const sMedia  = (sa+sb+sc+sd)/4;
  const s23max  = Math.max(sa,sb,sc,sd) * (2/3);
  const sRef    = Math.max(sMedia, s23max);  // L106
  const sadmLim = sadm * 10 * 1.15;         // kN/m²

  // ── ARMADURA X ────────────────────────────────────────────────────────────
  const cobX    = 4.5;                        // cm  — cobrimento fixo
  const phiLcm  = phiL/10;                   // mm → cm
  const phiBcm  = phiB/10;                   // mm → cm
  const phiEstcm= phiEst/10;                 // mm → cm
  const fyd     = fcy / gAco;                // MPa

  // Dx geométrico (balanço) — L119: =(B/2) - 0.35 × lp_pilar(m)
  // L120 usa 0.35 fixo (largura pilar referência em metros)
  const lpMax   = Math.max(...pil.map(p => p.lp)) / 100;  // cm → m
  const DxMom   = B/2 - 0.35*lpMax;          // m

  // Masx = sRef × 1m × DxMom² / 2  — L125: =(I118×I119²)/2
  const Masx    = (sRef * 1 * DxMom*DxMom) / 2;  // kN.m

  // Dx útil real — L123: =I53 - I121/200 - I122/100
  // I121 = bitola em cm, I122 = cobrimento em cm
  const Dxutil  = H - phiLcm/200 - cobX/100; // m  (phiLcm/200 = cm/200 = m)

  // Asx — L127: =(1.4×sRef×1m)/(0.8×Dxutil×50/1.15)  — usa I118=sRef, NÃO Masx
  const Asx     = (1.4*sRef) / (0.8*Dxutil*50/1.15);  // cm²

  // Asmin — L128: =Ba×100×0.15
  const Asxmin  = Ba*100*0.15;  // cm²

  // 2×Asx — L129
  const Asx2    = Asx*2;

  // Lógica L122-L123: As_adot = MIN(MAX(Asx, Asmin), 2×Asx)
  // Se Asmin > Asx → candidato = Asmin; se 2×Asx < Asmin → usa 2×Asx
  const AsxAd   = Math.min(Math.max(Asx, Asxmin), Asx2);

  // L124: nXref = ROUNDUP(As_adot / area_barra, 0) — qtd por metro
  const areaBarX = Math.PI*Math.pow(phiLcm,2)/4;   // cm²
  const nXref    = Math.ceil(AsxAd / areaBarX);     // qtd por metro (D124)
  // L125: espX = ROUNDDOWN(100/(nXref-1), 0) cm
  const espX     = Math.floor(100/(nXref-1));        // cm
  // nX total = D124 × ((L×100) - 2×cob) / 100  — fórmula L215C7
  const nX       = Math.round(nXref * (L*100 - 2*cobX) / 100);

  // ── ARMADURA Y ────────────────────────────────────────────────────────────
  const La_m = La/100;  const S_m = S/100;  const Lb_m = Lb/100;

  // Dy útil — L144: =I53 - I142/200 - I121/200 - I143/100
  // I142 = phiB em cm, I121 = phiL em cm, I143 = cobrimento em cm
  const Dyutil   = H - phiBcm/200 - phiLcm/200 - cobX/100;  // m

  // sRef × B — L141
  const sRefB    = sRef * B;  // kN/m

  // Reação B — L149: =sRefB×(S/2 + La + La²/(2S) - Lb²/(2S))
  const Rb = sRefB*(S_m/2 + La_m + (La_m*La_m)/(2*S_m) - (Lb_m*Lb_m)/(2*S_m));

  // Reação A — L148: =sRefB×(Lb+S+La) - Rb
  const Ra = sRefB*(Lb_m+S_m+La_m) - Rb;

  // Momentos — L150,L151,L152
  const MmaxA = sRefB*Lb_m*Lb_m/2;
  const MmaxB = sRefB*La_m*La_m/2;
  const MmaxC = Math.abs(Ra*Ra/(2*sRefB) - Ra*Lb_m);
  const Masy  = Math.max(MmaxA, MmaxB);  // L147: =MAX(L150,L151)

  // Cortantes — L156-L159
  const VAm  =  sRefB*Lb_m;
  const VAp  =  sRefB*Lb_m - Ra;
  const VBm  =  sRefB*(Lb_m+S_m) - Ra;
  const VBp  =  sRefB*(Lb_m+S_m) - Ra - Rb;
  const Vmax = Math.max(Math.abs(VAm), Math.abs(VAp), Math.abs(VBm), Math.abs(VBp));

  // Asy — L168: =(1.4×Masy)/(0.8×Dyutil×50/1.15)
  const areaBarY = Math.PI*Math.pow(phiBcm,2)/4;
  const Asy      = (1.4*Masy) / (0.8*Dyutil*50/1.15);  // cm²

  // Asmin — L169: =Af×10000×0.15/100
  const Asymin   = Af*10000*0.15/100;  // cm²

  // 2×Asy — L170
  const Asy2     = Asy*2;

  // Lógica: As_adot = MIN(MAX(Asy, Asymin), 2×Asy)
  const AsyAd    = Math.min(Math.max(Asy, Asymin), Asy2);

  // L147: nYref = ROUNDUP(As_adot / area_barra, 0) — qtd por metro
  const nYref    = Math.ceil(AsyAd / areaBarY);     // qtd por metro (E147)
  // L148: espY = ROUNDDOWN(((B×100)-2×cob)/(nYref-1), 0) cm
  const espY     = Math.floor((B*100 - 2*cobX) / (nYref-1));  // cm
  // nY total = E147 × ((B×100) - 2×cob) / 100  — fórmula L215C2
  const nY       = Math.round(nYref * (B*100 - 2*cobX) / 100);

  // ── VERIFICAÇÃO CORTANTE ─────────────────────────────────────────────────
  const Fcd  = fck / gConc;                    // MPa  — L178
  // Vsd = 1.4 * Vmax  — L187
  const Vsd  = 1.4 * Vmax;
  // αv2 = 1 - fck/250  — L188
  const av2  = 1 - fck/250;
  // VRd2,1 = 0.27*αv2*(Fcd*1000)*Bb*Dxutil  — L189
  const VRd21 = 0.27*av2*(Fcd*1000)*Bb*Dxutil;
  // Fctd = 0.15*fck^(2/3)*1000  — L193 (kN/m²)
  const Fctd  = 0.15*Math.pow(fck,2/3)*1000;
  // Vc = 0.6*Fctd*Bb*Dxutil  — L194
  const Vc    = 0.6*Fctd*Bb*Dxutil;
  // Vsw = Vsd - Vc  — L195
  const Vsw   = Vsd - Vc;
  // Asw necessário  — L199: =Vsw/(0.9*Dxutil*100*fyd/10)*100
  const AswNec= Vsw/(0.9*Dxutil*100*fyd/10)*100;  // cm²/m
  // Asw efetivo — L200: =VLOOKUP(phiEst, tabela, Asw_total) / (espEst/100)
  // Asw_total = area_barra × nRamos  (tabela auxiliar coluna D)
  const areaEstcm2 = ASW_TAB[phiEst] || 0;         // cm² (área 1 barra)
  const AswTotal   = areaEstcm2 * nRamos;           // cm² (total do estribo)
  const AswEf      = AswTotal / (espEst/100) / 10;  // cm²/m (÷10 correção de unidade)

  // ── DETALHAMENTO ─────────────────────────────────────────────────────────
  // Comprimentos de barra — fiéis às células L214, L216, L218
  // gancho (L214) = H0×100 - 2×cob
  const gancho   = H0*100 - 2*cobX;          // cm  — ex: 0.5×100 - 2×4.5 = 41cm
  // Barra dir Y (comprimento L): A214 + B216 + E214
  //   A214=E214=gancho, B216=L×100-2×cob
  const compBrY  = gancho + (L*100 - 2*cobX) + gancho;  // cm — ex: 41+446+41=528cm
  // Barra dir X (comprimento B): F214 + G216 + J214
  //   F214=J214=gancho, G216=B×100-2×cob
  const compBrX  = gancho + (B*100 - 2*cobX) + gancho;  // cm — ex: 41+271+41=353cm
  // Estribo: perímetro da seção interna + 10cm gancho
  // compEst = 2×(Bb×100 - 2×cob) + 2×(H×100 - 2×cob) + 10
  const compEst  = 2*(Bb*100 - 2*cobX) + 2*(H*100 - 2*cobX) + 10;  // cm
  // Nº estribos
  const nEst     = Math.floor((L*100 - 2*cobX) / espEst) + 1;

  // Pesos +10%
  const PESO_LIN = { 5:0.154, 6.3:0.245, 8:0.395, 10:0.617,
                     12.5:0.963, 16:1.578, 20:2.466, 25:3.853, 32:6.313 };
  const wL   = PESO_LIN[phiL]   || 0;
  const wB   = PESO_LIN[phiB]   || 0;
  const wEst = PESO_LIN[phiEst] || 0;
  const pesoL   = nX   * compBrY/100 * wL   * 1.10;  // kg  (dir Y = barras no comprimento L)
  const pesoB   = nY   * compBrX/100 * wB   * 1.10;  // kg  (dir X = barras na largura B)
  const pesoEst = nEst * compEst/100  * wEst * 1.10;
  const pesoTot = pesoL + pesoB + pesoEst;
  const volConc = VolSap;   // m³

  // ── VERIFICAÇÕES ─────────────────────────────────────────────────────────
  const okAef   = Aef >= Aest;
  const okTens  = Math.max(sa,sb,sc,sd)*(2/3) <= sadmLim;
  const okEspX  = espX <= 30;
  const okEspY  = espY <= 30;
  const okVsd1  = Vsd <= VRd21;
  const okVsd2  = Vsd <= Vc + AswEf*(0.9*Dxutil*100*fyd/10)/100;
  const okAsw   = AswEf >= AswNec;

  return {
    // pré-dim
    sumNk, Aest, Best, Lest, Xcg, Ycg,
    // geometria
    Aef, Bb, Ba, H, H0, H1, Lb, S, La,
    Af01, Af02, Af03, Af, VolSap, VolPil, VolTer,
    PPil, PSap, PTer,
    // tensões
    sumNsk, sumQx, sumQy, sumMx, sumMy, Ex, Ey,
    sN, sMX, sMY, sa, sb, sc, sd, sMedia, s23max, sRef, sadmLim,
    // arm X
    DxMom, Masx, Dxutil, Asx, Asxmin, AsxAd, nX, espX, areaBarX, phiLcm,
    // arm Y
    Dyutil, sRefB, Ra, Rb, MmaxA, MmaxB, MmaxC, Masy, Vmax,
    Asy, Asymin, AsyAd, nY, espY, areaBarY, phiBcm,
    VAm, VAp, VBm, VBp,
    // cortante
    Vsd, av2, VRd21, Fctd, Vc, Vsw, AswNec, AswEf, Fcd, fyd,
    // detalhamento
    gancho, compBrY, compBrX, compEst, nEst,
    pesoL, pesoB, pesoEst, pesoTot, volConc,
    // checks
    okAef, okTens, okEspX, okEspY, okVsd1, okVsd2, okAsw,
  };
}

// ── DXF ──────────────────────────────────────────────────────────────────────
function gerarDXFSapata(r, inp) {
  const pil = inp.pilares.filter(p => p.Nk > 0);
  const Lcm = r.La + r.S + r.Lb;   // = L*100 (em cm)
  const Bcm = r.Bb*100 + 2*r.Ba*100;
  const Hcm = r.H*100;
  const H0cm= r.H0*100;
  const BaCm= r.Ba*100;
  const BbCm= r.Bb*100;

  const ls = [];
  const add = (x1,y1,x2,y2,lay='SAPATA') =>
    ls.push(`LINE\n 8\n${lay}\n10\n${x1.toFixed(1)}\n20\n${y1.toFixed(1)}\n30\n0\n11\n${x2.toFixed(1)}\n21\n${y2.toFixed(1)}\n31\n0\n  0`);
  const txt = (x,y,h,t,lay='TEXT') =>
    ls.push(`TEXT\n 8\n${lay}\n10\n${x.toFixed(1)}\n20\n${y.toFixed(1)}\n30\n0\n40\n${h}\n 1\n${t}\n  0`);
  const dim = (x1,y1,x2,y2,off,t) => {
    const vertical = Math.abs(x1-x2)<0.1;
    if(vertical){ add(x1,y1,x1+off,y1,'DIM'); add(x2,y2,x2+off,y2,'DIM'); add(x1+off,y1,x2+off,y2,'DIM'); txt(x1+off+(off>0?3:-12),( y1+y2)/2,4,t,'DIM'); }
    else { add(x1,y1,x1,y1+off,'DIM'); add(x2,y2,x2,y2+off,'DIM'); add(x1,y1+off,x2,y2+off,'DIM'); txt((x1+x2)/2-8,y1+off+(off>0?3:-8),4,t,'DIM'); }
  };

  // ─ PLANTA (Y=0) ─
  add(0,0,Lcm,0); add(Lcm,0,Lcm,Bcm); add(Lcm,Bcm,0,Bcm); add(0,Bcm,0,0);
  pil.forEach(p=>{
    const px = p.xp - p.lp/2, py = Bcm/2 - p.bp/2;
    add(px,py,px+p.lp,py,'PILARES'); add(px+p.lp,py,px+p.lp,py+p.bp,'PILARES');
    add(px+p.lp,py+p.bp,px,py+p.bp,'PILARES'); add(px,py+p.bp,px,py,'PILARES');
    add(px,py,px+p.lp,py+p.bp,'PILARES'); add(px+p.lp,py,px,py+p.bp,'PILARES');
    txt(px+p.lp/2-4,py+p.bp/2-2,4,p.nome,'TEXT');
  });
  dim(0,0,Lcm,0,-20,`L=${(Lcm/100).toFixed(2)}m`);
  dim(Lcm,0,Lcm,Bcm,20,`B=${(Bcm/100).toFixed(2)}m`);
  txt(Lcm/2-15,Bcm+30,6,'PLANTA','TITLE');

  // ─ CORTE LONGITUDINAL (Y = -Hcm-80) ─
  const CY = -Hcm-80;
  // Seção trapezoidal simplificada como retângulo (fuste completo)
  add(0,CY,Lcm,CY); add(0,CY,0,CY+Hcm); add(Lcm,CY,Lcm,CY+Hcm);
  // Linha do topo (com recuos Ba)
  add(0,CY+Hcm,BaCm,CY+H0cm+CY);  // aproximação
  add(0,CY+H0cm,BaCm,CY+Hcm);
  add(Lcm-BaCm,CY+Hcm,Lcm,CY+H0cm);
  add(BaCm,CY+Hcm,Lcm-BaCm,CY+Hcm);
  // Pilares
  pil.forEach(p=>{
    const px = p.xp - p.lp/2;
    add(px,CY+Hcm,px,CY+Hcm+inp.Hf*100,'PILARES');
    add(px+p.lp,CY+Hcm,px+p.lp,CY+Hcm+inp.Hf*100,'PILARES');
    add(px,CY+Hcm+inp.Hf*100,px+p.lp,CY+Hcm+inp.Hf*100,'PILARES');
  });
  dim(0,CY,Lcm,CY,-20,`L=${(Lcm/100).toFixed(2)}m`);
  dim(-20,CY,-20,CY+Hcm,0,`H=${r.H.toFixed(2)}m`);
  txt(Lcm/2-20,CY-30,6,'CORTE LONGITUDINAL','TITLE');

  // ─ CORTE TRANSVERSAL (X = Lcm+80) ─
  const TX = Lcm+80;
  add(TX,0,TX+Bcm,0); add(TX,0,TX+BaCm,Hcm); add(TX+BaCm,Hcm,TX+BaCm+BbCm,Hcm);
  add(TX+BaCm+BbCm,Hcm,TX+Bcm,0);
  dim(TX,0,TX+Bcm,0,-20,`B=${(Bcm/100).toFixed(2)}m`);
  dim(TX+Bcm+15,0,TX+Bcm+15,Hcm,0,`H=${r.H.toFixed(2)}m`);
  txt(TX+Bcm/2-20,-30,6,'CORTE TRANSVERSAL','TITLE');

  // ─ TABELA DE AÇO (X = Lcm+80, Y = Hcm+50) ─
  const TX2 = Lcm+80, TY2 = Hcm+60;
  const rows = [
    ['MARCA','Ø(mm)','N','C.UNIT(cm)','C.TOT(m)','PESO+10%(kg)'],
    ['1 - dir L',String(inp.phiL),String(r.nX),r.compBrY.toFixed(0),(r.nX*r.compBrY/100).toFixed(2),r.pesoL.toFixed(2)],
    ['2 - dir B',String(inp.phiB),String(r.nY),r.compBrX.toFixed(0),(r.nY*r.compBrX/100).toFixed(2),r.pesoB.toFixed(2)],
    ['3 - estribo',String(inp.phiEst),String(r.nEst),r.compEst.toFixed(0),(r.nEst*r.compEst/100).toFixed(2),r.pesoEst.toFixed(2)],
    ['','','','TOTAL','',r.pesoTot.toFixed(2)],
  ];
  const cols=[0,22,36,46,66,84,104];
  const rh=8;
  rows.forEach((row,ri)=>{
    add(TX2,TY2+ri*rh,TX2+104,TY2+ri*rh,'TABELA');
    row.forEach((cell,ci)=>txt(TX2+cols[ci]+1,TY2+ri*rh+2,3.5,cell,'TABELA'));
  });
  add(TX2,TY2+(rows.length)*rh,TX2+104,TY2+(rows.length)*rh,'TABELA');
  cols.forEach(x=>add(TX2+x,TY2,TX2+x,TY2+rows.length*rh,'TABELA'));
  txt(TX2,TY2-12,5,'RESUMO DO AÇO — SAPATA ASSOCIADA','TITLE');
  txt(TX2,TY2-22,4,`Vol.Concreto C-30 = ${r.volConc.toFixed(2)} m³  |  Área de forma = ${r.Af.toFixed(2)} m²`,'TEXT');
  txt(TX2,TY2-30,4,`B=${r.Bb.toFixed(2)+r.Ba.toFixed(2)} L=${(Lcm/100).toFixed(2)} H=${r.H.toFixed(2)} m  |  Esc. 1:50`,'TEXT');

  return ['  0\nSECTION\n  2\nHEADER\n  0\nENDSEC',
    '  0\nSECTION\n  2\nENTITIES','  0',
    ...ls,'ENDSEC\n  0\nEOF'].join('\n');
}

// ── COMPONENTE WIZARD ─────────────────────────────────────────────────────────
const STEPS = [
  { id:'mat',  label:'Materiais',      icone:'🧱' },
  { id:'pil',  label:'Pilares',        icone:'🏛' },
  { id:'geo',  label:'Geometria',      icone:'📐' },
  { id:'arm',  label:'Armação',        icone:'🔩' },
  { id:'res',  label:'Resultados',     icone:'📊' },
];

const BITOLAS_DISP = [5, 6.3, 8, 10, 12.5, 16, 20, 25, 32];
const PILAR0 = { nome:'', lp:'35', bp:'35', Nk:'', Mx:'0', My:'0', Qx:'0', Qy:'0', xp:'0', yp:'0' };

function CalcSapataAssociada() {
  const [step,    setStep]   = useState(0);
  // Materiais
  const [sadm,   setSadm]   = useState('19');
  const [gSolo,  setGSolo]  = useState('1.6');
  const [fck,    setFck]    = useState('30');
  const [gConc,  setGConc]  = useState('1.4');
  const [fcy,    setFcy]    = useState('500');
  const [gAco,   setGAco]   = useState('1.15');
  // Pilares
  const [pilares,setPilares]= useState([
    {...PILAR0,nome:'P1',xp:'0'},
    {...PILAR0,nome:'P2',xp:'165'},
    {...PILAR0}, {...PILAR0},
  ]);
  // Geometria
  const [LB,    setLB]    = useState('1.85');
  const [Badot, setBadot] = useState('');
  const [Ladot, setLadot] = useState('');
  const [Hf,    setHf]    = useState('1.0');
  // Armação
  const [phiL,  setPhiL]  = useState('12.5');
  const [phiB,  setPhiB]  = useState('12.5');
  const [phiEst,setPhiEst]= useState('8');
  const [nRamos,setNRamos]= useState('4');
  const [espEst,setEspEst]= useState('5');

  const n   = v => parseFloat(String(v||'0').replace(',','.')) || 0;
  const f2  = v => typeof v==='number' ? v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const f3  = v => typeof v==='number' ? v.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}) : '—';

  const setPilar = (i,k,v) => setPilares(ps=>ps.map((p,j)=>j===i?{...p,[k]:v}:p));

  // Pré-dim inline (para step geo)
  const pilsV = pilares.map(p=>({...p,lp:n(p.lp),bp:n(p.bp),Nk:n(p.Nk),Mx:n(p.Mx),My:n(p.My),Qx:n(p.Qx),Qy:n(p.Qy),xp:n(p.xp),yp:n(p.yp)})).filter(p=>p.Nk>0);
  const sumNkV  = pilsV.reduce((s,p)=>s+p.Nk,0);
  const AestV   = sumNkV>0 ? (1.1*sumNkV)/n(sadm) : 0;
  const BestV   = AestV>0 ? Math.sqrt(AestV/n(LB)) : 0;
  const LestV   = BestV>0 ? AestV/BestV : 0;

  // Resultado final
  const res = useMemo(()=>{
    if(!n(Badot)||!n(Ladot)) return null;
    try {
      return calcSapata({
        sadm:n(sadm),gSolo:n(gSolo),fck:n(fck),gConc:n(gConc),fcy:n(fcy),gAco:n(gAco),
        LB:n(LB),B:n(Badot),L:n(Ladot),Hf:n(Hf),
        phiL:n(phiL),phiB:n(phiB),phiEst:n(phiEst),nRamos:n(nRamos),espEst:n(espEst),
        pilares:pilsV,
      });
    } catch(e){ return {erro:e.message}; }
  },[sadm,gSolo,fck,gConc,fcy,gAco,LB,Badot,Ladot,Hf,phiL,phiB,phiEst,nRamos,espEst,
     JSON.stringify(pilares)]);

  function baixarDXF(){
    if(!res||res.erro) return;
    const dxf = gerarDXFSapata(res,{pilares:pilsV,phiL:n(phiL),phiB:n(phiB),phiEst:n(phiEst),Hf:n(Hf)});
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([dxf],{type:'application/dxf'}));
    a.download='Sapata_Associada.dxf'; a.click();
  }

  // ── Estilos ──
  const IS = {width:'100%',border:'1px solid #e6ecf4',borderRadius:7,padding:'8px 12px',
    fontSize:13,fontFamily:'inherit',color:'#0f1f3d',outline:'none',background:'white',
    boxSizing:'border-box'};
  const LS = {fontSize:11,fontWeight:600,color:'#6b7a90',textTransform:'uppercase',
    letterSpacing:'0.5px',display:'block',marginBottom:4};
  const RS = {display:'flex',justifyContent:'space-between',alignItems:'baseline',
    padding:'6px 0',borderBottom:'1px solid #f1f4f9',fontSize:13};
  const OK = v => <span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,
    background:v?'#f0fdf4':'#fef2f2',color:v?'#16a34a':'#dc2626',
    border:`1px solid ${v?'#86efac':'#fecaca'}`}}>{v?'✓ OK':'✗ NÃO OK'}</span>;

  const canAdvance = [
    true,
    pilsV.length >= 2,
    n(Badot)>0 && n(Ladot)>0,
    true,
    true,
  ];

  return (
    <div style={{maxWidth:820}}>
      {/* ── Progress bar ── */}
      <div style={{display:'flex',gap:0,marginBottom:24,background:'white',
        borderRadius:12,border:'1px solid #e6ecf4',overflow:'hidden'}}>
        {STEPS.map((s,i)=>{
          const done = i < step, active = i === step;
          return (
            <button key={s.id} onClick={()=>i<=step||(canAdvance[step]&&i===step+1)?setStep(i):null}
              style={{flex:1,padding:'12px 8px',border:'none',background:'none',
                cursor:'pointer',fontFamily:'inherit',
                borderBottom:`3px solid ${active?'#0b2350':done?'#86efac':'transparent'}`,
                transition:'all 0.2s'}}>
              <div style={{fontSize:18,marginBottom:2}}>{done?'✅':s.icone}</div>
              <div style={{fontSize:10,fontWeight:active?700:400,
                color:active?'#0b2350':done?'#16a34a':'#8a97ab',
                textTransform:'uppercase',letterSpacing:0.5}}>
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* ══ STEP 0 — MATERIAIS ══ */}
      {step===0 && (
        <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:24}}>
          <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#0f1f3d'}}>Materiais</h3>
          <p style={{margin:'0 0 20px',fontSize:12,color:'#8a97ab'}}>
            Defina as propriedades dos materiais e do solo.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
            {[
              {l:'σadm solo (Tf/m²)', v:sadm, s:setSadm, hint:'Tensão admissível do solo'},
              {l:'γ solo (Tf/m³)',    v:gSolo,s:setGSolo,hint:'Peso específico do solo'},
              {l:'fck (MPa)',         v:fck,  s:setFck,  hint:'Resistência característica do concreto'},
              {l:'γ concreto',        v:gConc,s:setGConc,hint:'Coeficiente de ponderação do concreto'},
              {l:'fcy — fyk (MPa)',   v:fcy,  s:setFcy,  hint:'Resistência característica do aço'},
              {l:'γ aço',             v:gAco, s:setGAco, hint:'Coeficiente de ponderação do aço'},
            ].map(f=>(
              <div key={f.l}>
                <label style={LS}>{f.l}</label>
                <input style={IS} type="number" value={f.v} onChange={e=>f.s(e.target.value)}/>
                <div style={{fontSize:10,color:'#8a97ab',marginTop:3}}>{f.hint}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:20,padding:'12px 16px',background:'#eef4fd',borderRadius:8,fontSize:12,color:'#0b2350',border:'1px solid #c9daf5'}}>
            <strong>fyd = fcy/γaço = {(n(fcy)/n(gAco)).toFixed(1)} MPa</strong>
            {'  ·  '}<strong>fcd = fck/γconc = {(n(fck)/n(gConc)).toFixed(1)} MPa</strong>
          </div>
        </div>
      )}

      {/* ══ STEP 1 — PILARES ══ */}
      {step===1 && (
        <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:24}}>
          <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#0f1f3d'}}>Dados dos Pilares</h3>
          <p style={{margin:'0 0 20px',fontSize:12,color:'#8a97ab'}}>
            Insira os dados de 2 a 4 pilares. Mínimo de 2 pilares com Nk preenchido.
            As posições X e Y são relativas ao pilar de referência (geralmente P1 = x:0, y:0).
          </p>
          {pilares.map((p,i)=>(
            <div key={i} style={{background:i%2===0?'#f8fafc':'white',borderRadius:10,
              border:'1px solid #e6ecf4',padding:16,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <div style={{background:'#0b2350',color:'white',borderRadius:6,
                  padding:'3px 10px',fontSize:12,fontWeight:700}}>
                  Pilar {i+1}
                </div>
                {n(p.Nk)>0 && <span style={{fontSize:11,color:'#059669',fontWeight:600}}>Ativo</span>}
                {i>=2 && !n(p.Nk) && <span style={{fontSize:11,color:'#8a97ab'}}>(opcional)</span>}
              </div>
              {/* Identificação e dimensões */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:'#6b7a90',textTransform:'uppercase',
                  letterSpacing:1,marginBottom:8,paddingBottom:4,borderBottom:'1px solid #e6ecf4'}}>
                  Identificação e Dimensões
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  <div><label style={LS}>Nome do pilar</label>
                    <input style={IS} type="text" value={p.nome} onChange={e=>setPilar(i,'nome',e.target.value)}/></div>
                  <div><label style={LS}>L — dimensão (cm)</label>
                    <input style={IS} type="number" value={p.lp} onChange={e=>setPilar(i,'lp',e.target.value)} onFocus={e=>e.target.select()}/></div>
                  <div><label style={LS}>B — dimensão (cm)</label>
                    <input style={IS} type="number" value={p.bp} onChange={e=>setPilar(i,'bp',e.target.value)} onFocus={e=>e.target.select()}/></div>
                </div>
              </div>
              {/* Cargas */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:'#6b7a90',textTransform:'uppercase',
                  letterSpacing:1,marginBottom:8,paddingBottom:4,borderBottom:'1px solid #e6ecf4'}}>
                  Cargas
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
                  <div><label style={LS}>Nk (Tf) *</label>
                    <input style={{...IS,borderColor:!n(p.Nk)&&i<2?'#fca5a5':'#e6ecf4'}}
                      type="number" value={p.Nk} onChange={e=>setPilar(i,'Nk',e.target.value)} onFocus={e=>e.target.select()}/></div>
                  <div><label style={LS}>Mx (Tf.m)</label>
                    <input style={IS} type="number" value={p.Mx} onChange={e=>setPilar(i,'Mx',e.target.value)} onFocus={e=>e.target.select()}/></div>
                  <div><label style={LS}>My (Tf.m)</label>
                    <input style={IS} type="number" value={p.My} onChange={e=>setPilar(i,'My',e.target.value)} onFocus={e=>e.target.select()}/></div>
                  <div><label style={LS}>Qx (Tf)</label>
                    <input style={IS} type="number" value={p.Qx} onChange={e=>setPilar(i,'Qx',e.target.value)} onFocus={e=>e.target.select()}/></div>
                  <div><label style={LS}>Qy (Tf)</label>
                    <input style={IS} type="number" value={p.Qy} onChange={e=>setPilar(i,'Qy',e.target.value)} onFocus={e=>e.target.select()}/></div>
                </div>
              </div>
              {/* Posição */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#6b7a90',textTransform:'uppercase',
                  letterSpacing:1,marginBottom:8,paddingBottom:4,borderBottom:'1px solid #e6ecf4'}}>
                  Posição (relativa ao Pilar 1)
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                  <div>
                    <label style={LS}>X cpi (cm)</label>
                    <input style={IS} type="number" value={p.xp} onChange={e=>setPilar(i,'xp',e.target.value)} onFocus={e=>e.target.select()}/>
                    <div style={{fontSize:10,color:'#8a97ab',marginTop:2}}>Distância horizontal até P1</div>
                  </div>
                  <div>
                    <label style={LS}>Y cpi (cm)</label>
                    <input style={IS} type="number" value={p.yp} onChange={e=>setPilar(i,'yp',e.target.value)} onFocus={e=>e.target.select()}/>
                    <div style={{fontSize:10,color:'#8a97ab',marginTop:2}}>Distância vertical até P1</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {pilsV.length>=2 && (
            <div style={{padding:'12px 16px',background:'#f0fdf4',borderRadius:8,fontSize:12,
              color:'#065f46',border:'1px solid #86efac',marginTop:8}}>
              {pilsV.length} pilares ativos  ·  ΣNk = {f2(sumNkV)} Tf
              {'  ·  '}CG: X={f2(pilsV.reduce((s,p)=>s+p.Nk*p.xp,0)/sumNkV)} cm, Y={f2(pilsV.reduce((s,p)=>s+p.Nk*p.yp,0)/sumNkV)} cm
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 2 — GEOMETRIA ══ */}
      {step===2 && (
        <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:24}}>
          <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#0f1f3d'}}>Geometria da Sapata</h3>
          <p style={{margin:'0 0 16px',fontSize:12,color:'#8a97ab'}}>
            Com base nas cargas, o pré-dimensionamento sugere as dimensões abaixo.
            Você pode adotar valores diferentes — arredonde para valores comerciais.
          </p>
          {/* Sugestão pré-dim */}
          <div style={{background:'#eef4fd',borderRadius:10,padding:16,marginBottom:20,
            border:'1px solid #c9daf5'}}>
            <div style={{fontSize:11,fontWeight:800,color:'#0b2350',textTransform:'uppercase',
              letterSpacing:1,marginBottom:10}}>Pré-dimensionamento</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[
                {l:'Área mínima necessária', v:`${f2(AestV)} m²`},
                {l:'B estimado',             v:`${f2(BestV)} m`},
                {l:'L estimado',             v:`${f2(LestV)} m`},
              ].map(it=>(
                <div key={it.l} style={{background:'white',borderRadius:8,padding:'10px 14px',border:'1px solid #c9daf5'}}>
                  <div style={{fontSize:10,color:'#6b7a90',marginBottom:2}}>{it.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#0b2350'}}>{it.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
            {[
              {l:'Relação L/B',   v:LB,    s:setLB,    hint:'Proporção entre comprimento e largura'},
              {l:'B adotado (m)', v:Badot, s:setBadot, hint:`Sugerido: ${f2(BestV)}m`},
              {l:'L adotado (m)', v:Ladot, s:setLadot, hint:`Sugerido: ${f2(LestV)}m`},
              {l:'H fuste (m)',   v:Hf,    s:setHf,    hint:'Profundidade de assentamento'},
            ].map(f=>(
              <div key={f.l}>
                <label style={LS}>{f.l}</label>
                <input style={{...IS,borderColor:!n(f.v)?'#fca5a5':'#e6ecf4'}}
                  type="number" value={f.v} onChange={e=>f.s(e.target.value)}/>
                <div style={{fontSize:10,color:'#8a97ab',marginTop:3}}>{f.hint}</div>
              </div>
            ))}
          </div>
          {n(Badot)>0 && n(Ladot)>0 && (
            <div style={{marginTop:16,padding:'12px 16px',background:'#f0fdf4',borderRadius:8,
              fontSize:12,border:'1px solid #86efac'}}>
              <strong>Área efetiva: {f2(n(Badot)*n(Ladot))} m²</strong>
              {n(Badot)*n(Ladot) >= AestV
                ? <span style={{color:'#16a34a',marginLeft:12}}>Atende (mín: {f2(AestV)} m²)</span>
                : <span style={{color:'#dc2626',marginLeft:12}}>Insuficiente (mín: {f2(AestV)} m²)</span>}
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 3 — ARMAÇÃO ══ */}
      {step===3 && (
        <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:24}}>
          <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#0f1f3d'}}>Armação</h3>
          <p style={{margin:'0 0 20px',fontSize:12,color:'#8a97ab'}}>
            Defina as bitolas e parâmetros da armação. Os cálculos serão verificados na etapa seguinte.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {[
              {titulo:'Armação principal — direção L (barras na largura B)',
               items:[{l:'Bitola Ø (mm)',v:phiL,s:setPhiL}]},
              {titulo:'Armação principal — direção B (barras no comprimento L)',
               items:[{l:'Bitola Ø (mm)',v:phiB,s:setPhiB}]},
            ].map(g=>(
              <div key={g.titulo} style={{background:'#f8fafc',borderRadius:10,padding:16,border:'1px solid #e6ecf4'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#0b2350',marginBottom:12}}>{g.titulo}</div>
                {g.items.map(f=>(
                  <div key={f.l}>
                    <label style={LS}>{f.l}</label>
                    <select style={IS} value={f.v} onChange={e=>f.s(e.target.value)}>
                      {BITOLAS_DISP.map(b=><option key={b} value={b}>Ø {b} mm</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{background:'#f8fafc',borderRadius:10,padding:16,border:'1px solid #e6ecf4',marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#0b2350',marginBottom:12}}>
              Estribos — Viga de Rigidez
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
              <div>
                <label style={LS}>Bitola Ø (mm)</label>
                <select style={IS} value={phiEst} onChange={e=>setPhiEst(e.target.value)}>
                  {[5,6.3,8,10,12.5,16].map(b=><option key={b} value={b}>Ø {b} mm</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Nº de ramos</label>
                <input style={IS} type="number" value={nRamos} onChange={e=>setNRamos(e.target.value)} min="2"/>
              </div>
              <div>
                <label style={LS}>Espaçamento (cm)</label>
                <input style={IS} type="number" value={espEst} onChange={e=>setEspEst(e.target.value)}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 4 — RESULTADOS ══ */}
      {step===4 && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {!res && (
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',
              padding:40,textAlign:'center',color:'#8a97ab'}}>
              Preencha as etapas anteriores para ver os resultados.
            </div>
          )}
          {res?.erro && (
            <div style={{background:'#fef2f2',borderRadius:12,border:'1px solid #fecaca',
              padding:16,color:'#dc2626'}}>{res.erro}</div>
          )}
          {res && !res.erro && (<>
            {/* Verificações */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0f1f3d',marginBottom:12}}>
                Verificações Gerais
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[
                  {l:'Área efetiva',  v:res.okAef},
                  {l:'Tensões solo',  v:res.okTens},
                  {l:'Espaç. dir L',  v:res.okEspX},
                  {l:'Espaç. dir B',  v:res.okEspY},
                  {l:'Cort. bielas',  v:res.okVsd1},
                  {l:'Cort. armad.',  v:res.okVsd2},
                  {l:'Asw efetivo',   v:res.okAsw},
                ].map(v=>(
                  <div key={v.l} style={{padding:'8px 12px',borderRadius:8,textAlign:'center',
                    background:v.v?'#f0fdf4':'#fef2f2',
                    border:`1px solid ${v.v?'#86efac':'#fecaca'}`}}>
                    <div style={{fontSize:16}}>{v.v?'✅':'❌'}</div>
                    <div style={{fontSize:10,fontWeight:600,color:v.v?'#16a34a':'#dc2626',
                      marginTop:2}}>{v.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 1. Pré-dimensionamento */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                1. Geometria da Sapata
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
                {[
                  ['B × L adotados', `${f2(res.Bb+2*res.Ba)} × ${f2(res.La/100+res.S/100+res.Lb/100)} m`],
                  ['Área efetiva', `${f2(res.Aef)} m²  ${res.okAef?'✓':'✗ (mín '+f2(res.Aest)+' m²)'}`],
                  ['Bb (viga)', `${f2(res.Bb)} m`],
                  ['Ba = Bc (balanços)', `${f2(res.Ba)} m`],
                  ['H total', `${f2(res.H)} m`],
                  ['H₀ (base)', `${f2(res.H0)} m`],
                  ['H₁', `${f2(res.H1)} m`],
                  ['Lb / S / La', `${f2(res.Lb)} / ${f2(res.S)} / ${f2(res.La)} cm`],
                  ['CG da sapata (X, Y)', `(${f2(res.Xcg)}, ${f2(res.Ycg)}) cm`],
                ].map(([l,v])=>(
                  <div key={l} style={RS}>
                    <span style={{color:'#6b7a90',fontSize:12}}>{l}</span>
                    <span style={{fontWeight:600,color:'#0f1f3d',fontSize:12}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Tensões */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                2. Análise de Tensões
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>
                {[
                  ["ΣN'sk (carga total)", `${f2(res.sumNsk)} Tf`],
                  ["ΣM'y / ΣM'x", `${f2(res.sumMy)} / ${f2(res.sumMx)} Tf.m`],
                  ['Ex / Ey', `${f3(res.Ex)} / ${f3(res.Ey)} m`],
                  ['σN / σMX / σMY', `${f2(res.sN)} / ${f2(res.sMX)} / ${f2(res.sMY)} kN/m²`],
                  ['σa / σb', `${f2(res.sa)} / ${f2(res.sb)} kN/m²`],
                  ['σc / σd', `${f2(res.sc)} / ${f2(res.sd)} kN/m²`],
                  ['σmédia', `${f2(res.sMedia)} kN/m²`],
                  ['σmáx (valor)', `${f2(Math.max(res.sa,res.sb,res.sc,res.sd))} kN/m²`],
                  ['(2/3)×σmáx (verificação ≤ sadm×10×1.15)', `${f2(Math.max(res.sa,res.sb,res.sc,res.sd)*(2/3))} kN/m²  (lim: ${f2(res.sadmLim)})`],
                  ['σRef = max(σméd, 2/3×σmáx)', `${f2(res.sRef)} kN/m²`],
                ].map(([l,v])=>(
                  <div key={l} style={RS}>
                    <span style={{color:'#6b7a90',fontSize:12}}>{l}</span>
                    <span style={{fontWeight:600,color:'#0f1f3d',fontSize:12}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Armadura X e Y */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
                <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                  paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                  3a. Armadura — Direção X (L)
                </div>
                {[
                  ['Dx geom. (balanço)', `${f2(res.DxMom)} m`],
                  ['Dx útil real', `${f2(res.Dxutil)} m`],
                  ['Masx', `${f2(res.Masx)} kN.m`],
                  ['Asx calculado', `${f2(res.Asx)} cm²`],
                  ['Asx mínimo', `${f2(res.Asxmin)} cm²`],
                  ['As adotado', `${f2(res.AsxAd)} cm²`],
                  ['Qtd. barras', `${res.nX} Ø${res.phiLcm*10}mm`],
                  ['Espaçamento', `${res.espX} cm  ${res.okEspX?'✓':'✗'}`],
                ].map(([l,v])=>(
                  <div key={l} style={RS}>
                    <span style={{color:'#6b7a90',fontSize:11}}>{l}</span>
                    <span style={{fontWeight:600,fontSize:11}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
                <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                  paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                  3b. Armadura — Direção Y (B)
                </div>
                {[
                  ['La / S / Lb', `${f2(res.La/100)} / ${f2(res.S/100)} / ${f2(res.Lb/100)} m`],
                  ['sRef×B', `${f2(res.sRefB)} kN/m`],
                  ['Reação A / B', `${f2(res.Ra)} / ${f2(res.Rb)} kN`],
                  ['M,max A', `${f2(res.MmaxA)} kN.m`],
                  ['M,max B', `${f2(res.MmaxB)} kN.m`],
                  ['Masy = max(A,B)', `${f2(res.Masy)} kN.m`],
                  ['Asy calculado', `${f2(res.Asy)} cm²`],
                  ['Asy mínimo', `${f2(res.Asymin)} cm²`],
                  ['As adotado', `${f2(res.AsyAd)} cm²`],
                  ['Qtd. barras', `${res.nY} Ø${res.phiBcm*10}mm`],
                  ['Espaçamento', `${res.espY} cm  ${res.okEspY?'✓':'✗'}`],
                ].map(([l,v])=>(
                  <div key={l} style={RS}>
                    <span style={{color:'#6b7a90',fontSize:11}}>{l}</span>
                    <span style={{fontWeight:600,fontSize:11}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Cortante */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                4. Verificação da Força Cortante — Direção Y
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>
                {[
                  ['Bb (largura viga)', `${f2(res.Bb)} m`],
                  ['H total / Dx útil', `${f2(res.H)} m / ${f2(res.Dxutil)} m`],
                  ['fcd / fyd', `${f2(res.Fcd)} / ${f2(res.fyd)} MPa`],
                  ['Vmax ABS', `${f2(res.Vmax)} kN`],
                  ['Vsd = 1.4 × Vmax', `${f2(res.Vsd)} kN`],
                  ['αv2 = 1 − fck/250', `${f3(res.av2)}`],
                  ['VRd2,1 (bielas)', `${f2(res.VRd21)} kN  ${res.okVsd1?'✓':'✗'}`],
                  ['Fctd', `${f2(res.Fctd)} kN/m²`],
                  ['Vc', `${f2(res.Vc)} kN`],
                  ['Vsw = Vsd − Vc', `${f2(res.Vsw)} kN`],
                  ['Asw/m necessário', `${f2(res.AswNec)} cm²/m`],
                  ['Asw/m efetivo', `${f2(res.AswEf)} cm²/m  ${res.okAsw?'✓':'✗'}`],
                ].map(([l,v])=>(
                  <div key={l} style={RS}>
                    <span style={{color:'#6b7a90',fontSize:12}}>{l}</span>
                    <span style={{fontWeight:600,color:'#0f1f3d',fontSize:12}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Detalhamento */}
            <div style={{background:'white',borderRadius:12,border:'1px solid #e6ecf4',padding:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0b2350',marginBottom:12,
                paddingBottom:8,borderBottom:'2px solid #e6ecf4'}}>
                5. Detalhamento e Quantitativo
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#0b2350',color:'white'}}>
                    {['Marca','Ø (mm)','N','C.Unit (cm)','C.Total (m)','Peso +10% (kg)'].map(h=>(
                      <th key={h} style={{padding:'7px 10px',fontWeight:700,fontSize:11}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['1 — dir L',  n(phiL),   res.nX,   res.compBrY.toFixed(0), (res.nX*res.compBrY/100).toFixed(2), res.pesoL.toFixed(2)],
                    ['2 — dir B',  n(phiB),   res.nY,   res.compBrX.toFixed(0), (res.nY*res.compBrX/100).toFixed(2), res.pesoB.toFixed(2)],
                    ['3 — estribo',n(phiEst), res.nEst, res.compEst.toFixed(0), (res.nEst*res.compEst/100).toFixed(2),res.pesoEst.toFixed(2)],
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
                      {row.map((cell,j)=>(
                        <td key={j} style={{padding:'6px 10px',textAlign:j>1?'right':'left'}}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{background:'#0b2350',color:'white'}}>
                    <td colSpan={5} style={{padding:'7px 10px',fontWeight:700}}>
                      TOTAL  ·  Vol. Concreto C-30: {f2(res.volConc)} m³  ·  Área de forma: {f2(res.Af)} m²
                    </td>
                    <td style={{padding:'7px 10px',fontWeight:800,textAlign:'right'}}>
                      {f2(res.pesoTot)} kg
                    </td>
                  </tr>
                </tbody>
              </table>
              <button onClick={baixarDXF}
                style={{width:'100%',marginTop:14,padding:12,borderRadius:9,border:'none',
                  background:'linear-gradient(135deg,#0b2350,#1565d8)',color:'white',
                  fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
                  boxShadow:'0 4px 14px rgba(30,58,138,0.3)'}}>
                Baixar Detalhamento DXF (AutoCAD)
              </button>
            </div>
          </>)}
        </div>
      )}

      {/* ── Navegação ── */}
      <div style={{display:'flex',justifyContent:'space-between',marginTop:20}}>
        <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}
          style={{padding:'10px 24px',borderRadius:8,border:'1px solid #e6ecf4',
            background:'white',fontSize:13,fontWeight:600,cursor:step===0?'not-allowed':'pointer',
            color:step===0?'#8a97ab':'#334866',fontFamily:'inherit'}}>
          ← Anterior
        </button>
        {step < 4 && (
          <button onClick={()=>{ if(canAdvance[step]) setStep(s=>s+1); }}
            disabled={!canAdvance[step]}
            style={{padding:'10px 24px',borderRadius:8,border:'none',
              background:canAdvance[step]?'linear-gradient(135deg,#0b2350,#1565d8)':'#e6ecf4',
              color:canAdvance[step]?'white':'#8a97ab',
              fontSize:13,fontWeight:700,cursor:canAdvance[step]?'pointer':'not-allowed',
              fontFamily:'inherit'}}>
            Próximo →
          </button>
        )}
      </div>
    </div>
  );
}



const ICONE_CALC = { unidades:"tendencia", bitolas:"grafico", conv:"tendencia", esp:"menu", costura:"link", caixa:"nuvem", cargacx:"baixo", sapata:"capacete" };
const COR_GRUPO = { verif:"#1565d8", fund:"#16a34a", super:"#7c3aed", arrimo:"#d97706" };

export function AbaCalculadoras({ usuarioAtual } = {}) {
  const [calc, setCalc] = useState(null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("calc");
  const [material, setMaterial] = useState(null);
  const [enviados, setEnviados] = useState([]);
  const [erroMat, setErroMat] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [avisoMat, setAvisoMat] = useState("");

  useEffect(() => {
    let vivo = true;
    materiaisDb.listar().then(l => { if (vivo) setEnviados(l); }).catch(e => { if (vivo) setErroMat(e.message); });
    return () => { vivo = false; };
  }, []);
  const materiais = [...MATERIAIS_PADRAO, ...enviados];
  const disciplinasMat = [...new Set(materiais.map(m => m.disciplina))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  async function excluirMaterial(m) {
    if (!window.confirm(`Excluir "${m.titulo}"? O PDF sai do sistema para toda a equipe.`)) return;
    try { await materiaisDb.excluir(m); setEnviados(l => l.filter(x => x.id !== m.id)); setAvisoMat("Material excluído."); setTimeout(() => setAvisoMat(""), 3000); }
    catch (e) { window.alert(e.message); }
  }

  const GRUPOS = [
    { id:'verif', label:'Verificações', desc:'Conversões, armaduras e reservatórios', items: [
        { id:'unidades', label:'Conversão de unidades', desc:'kg, kN, tf, MPa, kgf/cm² e mais' },
        { id:'bitolas',  label:'Bitolas', desc:'Área de aço e peso por barra' },
        { id:'conv',     label:'Conversão de bitolas', desc:'Equivalência de área entre bitolas' },
        { id:'esp',      label:'Espaçamento', desc:'Verificar armadura distribuída' },
        { id:'costura',  label:'Armadura de costura', desc:'Interface de concretagem' },
        { id:'caixa',    label:"Caixa d'água", desc:'Dimensionamento por edificação' },
        { id:'cargacx',  label:'Carga na laje', desc:"Peso da caixa d'água na laje" },
    ]},
    { id:'fund', label:'Fundações', desc:'NBR 6122', items: [
        { id:'sapata', label:'Sapata associada', desc:'2 a 4 pilares · gera DXF · NBR 6122' },
        { id:'_estacas', label:'Estacas', desc:'Em breve', emBreve:true },
        { id:'_bloco', label:'Bloco de fundação', desc:'Em breve', emBreve:true },
    ]},
    { id:'super', label:'Superestrutura', desc:'NBR 6118', items: [
        { id:'_viga', label:'Dimensionamento de viga', desc:'Em breve', emBreve:true },
        { id:'_pilar', label:'Dimensionamento de pilar', desc:'Em breve', emBreve:true },
        { id:'_laje', label:'Dimensionamento de laje', desc:'Em breve', emBreve:true },
    ]},
    { id:'arrimo', label:'Contenções', desc:'Muros e arrimos', items: [
        { id:'_arrimo', label:'Muro de arrimo', desc:'Em breve', emBreve:true },
    ]},
  ];

  const renderCalc = (id) => {
    if(id==='unidades') return <CalcUnidades/>;
    if(id==='bitolas')  return <CalcBitolas/>;
    if(id==='conv')     return <CalcConversaoBitola/>;
    if(id==='esp')      return <CalcEspacamento/>;
    if(id==='costura')  return <CalcArmaduraCostura/>;
    if(id==='caixa')    return <CalcCaixaAgua/>;
    if(id==='cargacx')  return <CalcCargaCaixa/>;
    if(id==='sapata')   return <CalcSapataAssociada/>;
    return null;
  };
  const grupoDe = id => GRUPOS.find(g => g.items.some(i => i.id === id));
  const calcAtual = calc ? GRUPOS.flatMap(g=>g.items).find(i=>i.id===calc) : null;
  const titulo = { margin:0, fontSize:30, fontWeight:800, color:'#0a2557', letterSpacing:-.5, lineHeight:1.15 };

  // ── Calculadora aberta ──
  if (calc && calcAtual && !calcAtual.emBreve) {
    const g = grupoDe(calc), cor = COR_GRUPO[g?.id] || '#1565d8';
    return (
      <div style={{display:'flex',flexDirection:'column',gap:18}}>
        <nav aria-label="Caminho" style={{display:'flex',alignItems:'center',gap:8,fontSize:13.5}}>
          <button onClick={()=>setCalc(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#1565d8',fontWeight:600,padding:0,display:'inline-flex',alignItems:'center',gap:6,fontFamily:'inherit',fontSize:13.5}}>
            <span style={{display:'inline-block',transform:'rotate(180deg)'}}><Icone nome="setaDir" tam={15}/></span>Calculadoras
          </button>
          <span style={{color:'#8a97ab'}}>/</span><span style={{color:'#6b7a90'}}>{g?.label}</span>
        </nav>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{width:48,height:48,borderRadius:13,background:`${cor}14`,color:cor,display:'flex',alignItems:'center',justifyContent:'center',flex:'none'}}><Icone nome={ICONE_CALC[calc]||'calculadora'} tam={24}/></span>
          <div><h1 style={{...titulo,fontSize:26}}>{calcAtual.label}</h1><p style={{margin:'4px 0 0',fontSize:14,color:'#6b7a90'}}>{calcAtual.desc}</p></div>
        </div>
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #e6ecf4',padding:'22px 24px',boxShadow:'0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)'}}>
          {renderCalc(calc)}
        </div>
      </div>
    );
  }

  // ── Material aberto ──
  if (material) return <LeitorMaterial material={material} onVoltar={()=>setMaterial(null)}/>;

  // ── Grade de calculadoras ──
  const q = busca.trim().toLowerCase();
  return (
    <div style={{display:'flex',flexDirection:'column',gap:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>
        <div>
          <h1 style={titulo}>Calculadoras e materiais de apoio</h1>
          <p style={{margin:'6px 0 0',fontSize:14.5,color:'#6b7a90'}}>Ferramentas de cálculo técnico e guias de conferência de projeto</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {aba==='materiais' && (
            <select value={disciplina} onChange={e=>setDisciplina(e.target.value)} aria-label="Filtrar por disciplina"
              style={{border:'1px solid #d9e2ee',borderRadius:10,padding:'10px 12px',fontSize:14,background:'#fff',color:'#0f1f3d',cursor:'pointer',minWidth:190}}>
              <option value="">Todas as disciplinas</option>
              {disciplinasMat.map(d => <option key={d} value={d}>{d} ({materiais.filter(m=>m.disciplina===d).length})</option>)}
            </select>
          )}
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder={aba==='calc'?'Buscar calculadora…':'Buscar por nome, norma ou assunto…'} aria-label="Buscar"
            style={{border:'1px solid #d9e2ee',borderRadius:10,padding:'10px 14px',fontSize:14,minWidth:260,background:'#fff'}}/>
        </div>
      </div>

      <Abas valor={aba} onChange={setAba} style={{alignSelf:'flex-start'}} itens={[
        {id:'calc', label:'Calculadoras', icone:'calculadora'},
        {id:'materiais', label:'Materiais de apoio', icone:'documento', badge:materiais.length},
      ]}/>

      {aba==='materiais' && avisoMat && <div role="status" style={{fontSize:13.5,fontWeight:600,color:'#166534',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'10px 14px'}}>{avisoMat}</div>}
      {aba==='materiais' && erroMat && <div role="alert" style={{fontSize:13,color:'#92400e',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:'10px 14px'}}>Os guias padrão estão disponíveis, mas os materiais enviados não puderam ser carregados: {erroMat}</div>}
      {aba==='materiais' && <ListaMateriais lista={materiais} busca={busca} disciplina={disciplina} onAbrir={setMaterial}
        onAdicionar={()=>setAdicionando(true)} onExcluir={excluirMaterial}/>}
      {adicionando && <ModalAdicionarMaterial usuarioAtual={usuarioAtual} onFechar={()=>setAdicionando(false)}
        onSalvo={m=>{ setEnviados(l=>[m,...l]); setAdicionando(false); setDisciplina(""); setAvisoMat(`“${m.titulo}” adicionado aos materiais de apoio.`); setTimeout(()=>setAvisoMat(""),4000); }}/>}

      {aba==='calc' && GRUPOS.map(grupo => {
        const itens = grupo.items.filter(i => !q || `${i.label} ${i.desc}`.toLowerCase().includes(q));
        if (!itens.length) return null;
        const cor = COR_GRUPO[grupo.id];
        return (
          <section key={grupo.id}>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
              <h2 style={{margin:0,fontSize:16.5,fontWeight:700,color:'#0a2557'}}>{grupo.label}</h2>
              <span style={{fontSize:12.5,color:'#6b7a90'}}>{grupo.desc}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12}}>
              {itens.map(item => (
                <button key={item.id} disabled={item.emBreve} onClick={() => !item.emBreve && setCalc(item.id)}
                  className={item.emBreve ? undefined : 'wm-card-projeto'}
                  style={{background:'#fff',border:'1px solid #e6ecf4',borderRadius:14,padding:'16px 18px',cursor:item.emBreve?'default':'pointer',
                    textAlign:'left',fontFamily:'inherit',opacity:item.emBreve?0.6:1,display:'flex',gap:12,alignItems:'flex-start',
                    boxShadow:item.emBreve?'none':'0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)'}}>
                  <span style={{width:42,height:42,borderRadius:12,background:item.emBreve?'#f1f4f9':`${cor}14`,color:item.emBreve?'#8a97ab':cor,display:'flex',alignItems:'center',justifyContent:'center',flex:'none'}}>
                    <Icone nome={ICONE_CALC[item.id]||'calculadora'} tam={21}/></span>
                  <span style={{minWidth:0}}>
                    <span style={{display:'block',fontSize:14.5,fontWeight:700,color:item.emBreve?'#8a97ab':'#0f1f3d'}}>{item.label}</span>
                    <span style={{display:'block',fontSize:12.5,color:'#6b7a90',marginTop:2,lineHeight:1.4}}>{item.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
