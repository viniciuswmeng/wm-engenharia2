// Componentes visuais compartilhados: o mesmo desenho de abas, cabeçalhos de modal,
// títulos de seção e tabelas em todas as telas do sistema.
import Icone from "./Icone.jsx";

export const T = {
  marinho:"#0a2557", azul:"#1565d8", texto:"#0f1f3d", sub:"#6b7a90", borda:"#e6ecf4",
  fundo:"#f3f6fb", cabTabela:"#f6f8fc",
};

// Abas. variante "pilula" (seções da página) ou "linha" (dentro de cartões e modais)
export function Abas({ itens, valor, onChange, variante = "pilula", direita, style }) {
  if (variante === "linha") {
    return (
      <div role="tablist" style={{ display:"flex", alignItems:"center", gap:4, borderBottom:`1px solid ${T.borda}`, overflowX:"auto", ...style }}>
        {itens.map(t => {
          const at = valor === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={at} onClick={() => onChange(t.id)}
              style={{ display:"inline-flex", alignItems:"center", gap:7, background:"none", border:"none", padding:"12px 14px", marginBottom:-1, cursor:"pointer",
                fontSize:13.5, fontWeight:at ? 700 : 500, color:at ? T.azul : T.sub, borderBottom:`2px solid ${at ? T.azul : "transparent"}`, whiteSpace:"nowrap", fontFamily:"inherit" }}>
              {t.icone && <Icone nome={t.icone} tam={16} />}{t.label}
              {t.badge != null && <span style={{ fontSize:11, fontWeight:700, background:at ? "#e9f1fd" : "#eef1f6", color:at ? T.azul : T.sub, borderRadius:10, padding:"1px 7px" }}>{t.badge}</span>}
            </button>
          );
        })}
        {direita && <div style={{ marginLeft:"auto", paddingLeft:10 }}>{direita}</div>}
      </div>
    );
  }
  return (
    <div role="tablist" style={{ display:"inline-flex", flexWrap:"wrap", gap:4, background:"#e9eef6", padding:4, borderRadius:12, ...style }}>
      {itens.map(t => {
        const at = valor === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={at} onClick={() => onChange(t.id)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, border:"none", borderRadius:9, padding:"7px 16px", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
              background:at ? "#fff" : "transparent", color:at ? T.marinho : T.sub, boxShadow:at ? "0 1px 3px rgba(15,31,61,.12)" : "none", whiteSpace:"nowrap" }}>
            {t.icone && <Icone nome={t.icone} tam={16} />}{t.label}
            {t.badge != null && <span style={{ fontSize:11, fontWeight:700, background:at ? "#e9f1fd" : "#dde4ee", color:at ? T.azul : T.sub, borderRadius:10, padding:"1px 7px" }}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Cabeçalho dos modais (fundo branco, título, subtítulo e fechar)
export function CabecalhoModal({ titulo, subtitulo, rotulo, icone, onFechar, desabilitarFechar, children }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"18px 22px", borderBottom:`1px solid ${T.borda}`, background:"#fff" }}>
      {icone && <span style={{ width:40, height:40, borderRadius:11, background:"#e9f1fd", color:T.azul, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}><Icone nome={icone} tam={20} /></span>}
      <div style={{ flex:1, minWidth:0 }}>
        {rotulo && <div style={{ fontSize:11, fontWeight:700, color:T.azul, letterSpacing:.6, textTransform:"uppercase", marginBottom:3 }}>{rotulo}</div>}
        <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:T.marinho, lineHeight:1.3 }}>{titulo}</h2>
        {subtitulo && <p style={{ margin:"3px 0 0", fontSize:13, color:T.sub }}>{subtitulo}</p>}
        {children}
      </div>
      {onFechar && (
        <button onClick={() => onFechar()} disabled={desabilitarFechar} aria-label="Fechar"
          style={{ border:"none", background:"#f1f4f9", color:T.sub, borderRadius:10, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flex:"none" }}>
          <Icone nome="fechar" tam={18} />
        </button>
      )}
    </div>
  );
}

// Título de seção dentro de cartões
export function TituloSecao({ children, icone, direita, style }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, ...style }}>
      {icone && <span style={{ color:T.azul }}><Icone nome={icone} tam={18} /></span>}
      <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:T.marinho }}>{children}</h3>
      {direita && <div style={{ marginLeft:"auto" }}>{direita}</div>}
    </div>
  );
}

// Fundo escurecido dos modais
export const fundoModal = { position:"fixed", inset:0, background:"rgba(10,25,55,.5)", backdropFilter:"blur(2px)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"40px 16px" };
export const caixaModal = { background:"#fff", borderRadius:18, width:"100%", boxShadow:"0 24px 70px rgba(10,25,55,.28)", overflow:"hidden" };

// Cartão de número (indicador) — mesmo desenho do painel
export function CartaoNumero({ icone, titulo, valor, legenda, cor = T.azul, children }) {
  const longo = typeof valor === "string" && valor.length > 9;
  return (
    <div style={{ background:`linear-gradient(160deg,${cor}0d 0%,#ffffff 70%)`, border:`1px solid ${cor}2e`, borderRadius:16, padding:"14px 16px", boxShadow:"0 1px 2px rgba(15,31,61,.04),0 6px 20px rgba(15,31,61,.05)", display:"flex", flexDirection:"column", gap:8, minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {icone && <span style={{ width:36, height:36, borderRadius:10, background:`${cor}1f`, color:cor, display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}><Icone nome={icone} tam={19} /></span>}
        <span style={{ fontSize:13, fontWeight:600, color:T.texto, lineHeight:1.25 }}>{titulo}</span>
      </div>
      <div style={{ fontSize:longo ? 19 : 26, fontWeight:800, color:cor, lineHeight:1.1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{valor}</div>
      {legenda && <div style={{ fontSize:12.5, color:T.sub }}>{legenda}</div>}
      {children}
    </div>
  );
}
