import { useState, useMemo, useCallback } from "react";
import * as syncHoras from "../sessoesSync.js";
import { CATS_ADMIN } from "./ModalHoras.jsx";
import { Avatar, Btn, C, Card, calcHorasDia, fmtData, fmtDuracao } from "../nucleo.jsx";

export function carregarJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf.jsPDF);
    document.head.appendChild(s);
  });
}

export function carregarAutoTable() {
  return new Promise((resolve) => {
    if (window.jspdf?.jsPDF?.API?.autoTable) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export async function gerarRelatorioPDF({ usuario, registrosFiltrados, projetos, mes, salario }) {
  const JsPDF = await carregarJsPDF();
  await carregarAutoTable();

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; const M = 15;
  const fmtD = d => { if(!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const fmtDur = mins => { if(!mins) return '0h 0min'; return `${Math.floor(mins/60)}h ${mins%60}min`; };
  const fmtR = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const nomeMes = (ym) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const nomes = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${nomes[parseInt(m)]} ${y}`;
  };

  // ── Cabeçalho ──
  doc.setFillColor(26, 58, 107);
  doc.rect(0, 0, W, 40, 'F');
  doc.setFillColor(43, 99, 168);
  doc.rect(0, 30, W, 10, 'F');

  // Logo texto
  doc.setTextColor(86, 191, 233);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('WM', M, 20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('WM ENGENHARIA', M, 26);

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATORIO DE PRODUTIVIDADE', W/2, 36, { align: 'center' });

  // Info colaborador
  doc.setFillColor(240, 244, 248);
  doc.rect(M, 45, W - M*2, 28, 'F');
  doc.setDrawColor(200, 210, 225);
  doc.rect(M, 45, W - M*2, 28, 'S');

  doc.setTextColor(30, 37, 53);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(usuario.nome, M+6, 55);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(132, 146, 166);
  doc.text(usuario.email || '', M+6, 61);
  doc.text(`Perfil: ${usuario.perfil === 'admin' ? 'Admin' : usuario.perfil === 'gestor' ? 'Gestor' : 'Colaborador'}`, M+6, 67);

  // Período
  doc.setTextColor(37, 99, 168);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Periodo: ${nomeMes(mes) || 'Todos os meses'}`, W - M, 55, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, W - M, 62, { align: 'right' });

  // ── Totais ──
  const totalMin = registrosFiltrados.reduce((a,r) => a + (r.duracaoMin||0), 0);
  const totalH = Math.floor(totalMin/60);
  const totalM = totalMin%60;
  const totalSessoes = registrosFiltrados.length;
  const projsUnicos = new Set(registrosFiltrados.map(r=>r.projetoId).filter(Boolean)).size;
  const custoHora = salario > 0 ? salario / (totalH || 1) : 0;
  const diasUteis = 22;
  const horesPrevistas = diasUteis * 8 * 60;
  const eficiencia = horesPrevistas > 0 ? Math.min(100, Math.round((totalMin / horesPrevistas) * 100)) : 0;

  const cards = [
    { label: 'Horas Trabalhadas', valor: `${totalH}h ${totalM}min`, cor: [37,99,168] },
    { label: 'Sessoes Registradas', valor: String(totalSessoes), cor: [34,197,94] },
    { label: 'Projetos Atendidos', valor: String(projsUnicos), cor: [86,191,233] },
    { label: 'Eficiencia do Mes', valor: `${eficiencia}%`, cor: salario>0?[245,158,11]:[132,146,166] },
  ];

  const cardW = (W - M*2 - 9) / 4;
  let cx = M;
  doc.setFontSize(9);
  cards.forEach(card => {
    doc.setFillColor(...card.cor);
    doc.rect(cx, 78, cardW, 22, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);
    doc.text(card.valor, cx + cardW/2, 90, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text(card.label, cx + cardW/2, 96, { align: 'center' });
    cx += cardW + 3;
  });

  // Custo (se tiver salário)
  let yPos = 108;
  if (salario > 0) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.rect(M, yPos, W - M*2, 14, 'FD');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(`Salario Mensal: ${fmtR(salario)}`, M+6, yPos+6);
    doc.text(`Custo por Hora Trabalhada: ${fmtR(custoHora)}`, M+6, yPos+11);
    doc.setTextColor(30,37,53);
    yPos += 18;
  }

  // ── Tabela por projeto ──
  const porProjeto = {};
  registrosFiltrados.forEach(r => {
    if (!r.projetoId) return;
    if (!porProjeto[r.projetoId]) porProjeto[r.projetoId] = { totalMin:0, sessoes:0 };
    porProjeto[r.projetoId].totalMin += r.duracaoMin||0;
    porProjeto[r.projetoId].sessoes++;
  });

  const linhasProjeto = Object.entries(porProjeto)
    .sort((a,b) => b[1].totalMin - a[1].totalMin)
    .map(([pid, d]) => {
      const proj = projetos.find(p => p.id === pid);
      const custoProj = salario > 0 && totalMin > 0 ? (d.totalMin / totalMin) * salario : 0;
      const pct = totalMin > 0 ? ((d.totalMin/totalMin)*100).toFixed(1) : '0.0';
      return [
        proj?.codigo || pid,
        (proj?.cliente || '—').substring(0, 38),
        fmtDur(d.totalMin),
        `${pct}%`,
        d.sessoes,
        salario > 0 ? fmtR(custoProj) : '—',
      ];
    });

  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(26,58,107);
  doc.text('Horas por Projeto', M, yPos);
  yPos += 4;

  doc.autoTable({
    startY: yPos,
    head: [['Codigo','Projeto','Horas','% do Total','Sessoes', salario>0?'Custo Proporcional':'']],
    body: linhasProjeto,
    theme: 'grid',
    headStyles: { fillColor:[26,58,107], textColor:255, fontStyle:'bold', fontSize:8 },
    bodyStyles: { fontSize:8, textColor:[30,37,53] },
    alternateRowStyles: { fillColor:[240,244,248] },
    columnStyles: {
      0: { cellWidth:22, fontStyle:'bold', textColor:[37,99,168] },
      1: { cellWidth:60 },
      2: { cellWidth:22, halign:'center' },
      3: { cellWidth:20, halign:'center' },
      4: { cellWidth:16, halign:'center' },
      5: { cellWidth:30, halign:'right' },
    },
    margin: { left: M, right: M },
  });

  // ── Histórico de sessões ──
  const yAposTabela = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(26,58,107);
  doc.text('Historico de Sessoes', M, yAposTabela);

  const linhasSessoes = [...registrosFiltrados]
    .sort((a,b) => (b.inicioTs||0)-(a.inicioTs||0))
    .map(r => {
      const proj = projetos.find(p => p.id === r.projetoId);
      return [
        r.data ? fmtD(r.data) : '—',
        proj?.codigo || '—',
        (proj?.cliente||'—').substring(0,30),
        r.horaInicio || '—',
        r.horaFim || 'Aberta',
        fmtDur(r.duracaoMin),
        (r.obs||'').substring(0,25),
      ];
    });

  doc.autoTable({
    startY: yAposTabela + 4,
    head: [['Data','Codigo','Projeto','Entrada','Saida','Duracao','Obs']],
    body: linhasSessoes.length > 0 ? linhasSessoes : [['Nenhum registro','','','','','','']],
    theme: 'striped',
    headStyles: { fillColor:[43,99,168], textColor:255, fontStyle:'bold', fontSize:7.5 },
    bodyStyles: { fontSize:7.5, textColor:[30,37,53] },
    alternateRowStyles: { fillColor:[248,250,252] },
    columnStyles: {
      0: { cellWidth:20 },
      1: { cellWidth:20, fontStyle:'bold', textColor:[37,99,168] },
      2: { cellWidth:48 },
      3: { cellWidth:16, halign:'center' },
      4: { cellWidth:16, halign:'center' },
      5: { cellWidth:22, halign:'center', fontStyle:'bold' },
      6: { cellWidth:35 },
    },
    margin: { left: M, right: M },
  });

  // ── Rodapé ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(26,58,107);
    doc.rect(0, 287, W, 10, 'F');
    doc.setTextColor(86,191,233);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text('WM Engenharia — Sistema de Controle de Projetos', M, 293);
    doc.text(`Pagina ${i} de ${pageCount}`, W - M, 293, { align:'right' });
  }

  const nomeArq = `relatorio_${usuario.nome.toLowerCase().replace(/\s+/g,'_')}_${mes||'geral'}.pdf`;
  doc.save(nomeArq);
}

// ─── PRODUTIVIDADE ────────────────────────────────────────────────────────────

// ─── ABA HORAS & PRODUTIVIDADE ────────────────────────────────────────────────
export function AbaHoras({ registros, setRegistros, usuarios, projetos, usuarioAtual, calendario, onAbrirEncerramento }) {
  const [subAba, setSubAba] = useState("horas");
  return (
    <div>
      <div style={{display:"flex",gap:0,marginBottom:24,borderBottom:`2px solid ${C.cinzaCard}`}}>
        {[{id:"horas",label:"⏱ Banco de Horas"},{id:"produtividade",label:"📈 Produtividade"}].map(t=>(
          <button key={t.id} onClick={()=>setSubAba(t.id)}
            style={{background:"none",border:"none",padding:"12px 20px",cursor:"pointer",fontSize:14,
              fontFamily:"inherit",fontWeight:subAba===t.id?700:500,
              color:subAba===t.id?C.azulMedio:C.cinzaClaro,
              borderBottom:subAba===t.id?`2px solid ${C.azulMedio}`:"2px solid transparent",
              marginBottom:-2,transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {subAba==="horas"        &&<BancoHoras registros={registros} setRegistros={setRegistros} usuarios={usuarios} projetos={projetos} usuarioAtual={usuarioAtual} onAbrirEncerramento={onAbrirEncerramento}/>}
      {subAba==="produtividade"&&<Produtividade registros={registros} usuarios={usuarios} projetos={projetos} usuarioAtual={usuarioAtual} calendario={calendario}/>}
    </div>
  );
}

// ─── ABA AGENDA & ESCALAS ─────────────────────────────────────────────────────
export function Produtividade({ registros, usuarios, projetos, usuarioAtual, calendario }) {
  const [filtroUser, setFU] = useState(
    usuarioAtual.perfil === 'colaborador' ? usuarioAtual.id : 'todos'
  );
  const [filtroMes, setFM] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [gerando, setGerando] = useState(false);
  const isGestor = ['admin','gestor'].includes(usuarioAtual.perfil);

  const fmt$ = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

  const meses = useMemo(() => {
    const s = new Set();
    registros.forEach(r => { if(r.data) s.add(r.data.slice(0,7)); });
    return [...s].sort((a,b) => b.localeCompare(a));
  }, [registros]);

  const nomesMeses = {
    '01':'Janeiro','02':'Fevereiro','03':'Marco','04':'Abril','05':'Maio','06':'Junho',
    '07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'
  };
  const labelMes = (ym) => {
    if (!ym || ym === 'todos') return 'Todos';
    const [y,m] = ym.split('-');
    return `${nomesMeses[m]||m} ${y}`;
  };

  // Horas previstas usando calendario real ou fallback seguro
  const getHoresPrev = useCallback((ym, usuario) => {
    try {
      const hdDia = usuario?.expediente ? calcHorasDia(usuario.expediente) : 7;
      if (!ym || ym === 'todos') return Math.round(22 * hdDia);
      const [ano, mes] = ym.split('-').map(Number);
      if (calendario && typeof calendario.horasPrevistasMes === 'function') {
        const h = calendario.horasPrevistasMes(ano, mes, hdDia);
        return h > 0 ? h : Math.round(22 * hdDia);
      }
    } catch(e) {}
    return 154;
  }, [calendario]);

  const usuariosParaExibir = useMemo(() => {
    if (!isGestor) return usuarios.filter(u => u.id === usuarioAtual.id);
    if (filtroUser !== 'todos') return usuarios.filter(u => u.id === filtroUser);
    return usuarios.filter(u => u.ativo);
  }, [usuarios, filtroUser, usuarioAtual, isGestor]);

  const dadosUsuario = useMemo(() => {
    return usuariosParaExibir.map(u => {
      const regs = registros.filter(r => {
        if (r.usuarioId !== u.id) return false;
        if (filtroMes !== 'todos' && !r.data?.startsWith(filtroMes)) return false;
        return true;
      });
      const totalMin    = regs.reduce((a,r) => a + (r.duracaoMin||0), 0);
      const totalH      = Math.floor(totalMin/60);
      const totalM      = totalMin%60;
      const projsUnicos = new Set(regs.map(r=>r.projetoId).filter(Boolean));
      // hPrevH calculado individualmente por colaborador com base no expediente dele
      const hPrevH      = getHoresPrev(filtroMes, u);
      const hPrevMin    = hPrevH * 60;
      const eficiencia  = hPrevMin > 0 ? Math.min(100, Math.round((totalMin/hPrevMin)*100)) : 0;
      const salario     = u.salario || 0;
      const custoHora   = totalMin > 0 && salario > 0 ? salario / (totalMin/60) : 0;
      const porProjeto  = {};
      regs.forEach(r => {
        if (!r.projetoId) return;
        if (!porProjeto[r.projetoId]) porProjeto[r.projetoId] = { totalMin:0, sessoes:0 };
        porProjeto[r.projetoId].totalMin += r.duracaoMin||0;
        porProjeto[r.projetoId].sessoes++;
      });
      return { usuario:u, regs, totalMin, totalH, totalM, projsUnicos,
               eficiencia, salario, custoHora, porProjeto, hPrevH };
    });
  }, [usuariosParaExibir, registros, filtroMes, getHoresPrev]);

  const gerarPDF = async (dado) => {
    setGerando(true);
    try {
      await gerarRelatorioPDF({
        usuario: dado.usuario,
        registrosFiltrados: dado.regs,
        projetos,
        mes: filtroMes !== 'todos' ? filtroMes : null,
        salario: dado.salario,
      });
    } finally { setGerando(false); }
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Filtros */}
      <Card style={{padding:16}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{flex:1}}>
            <h2 style={{color:C.azulEscuro,margin:0,fontSize:16,fontWeight:700}}>📈 Produtividade & Custos</h2>
            <p style={{color:C.cinzaClaro,fontSize:12,margin:'4px 0 0'}}>Controle de horas, eficiencia e custo de mao de obra</p>
          </div>
          {isGestor && (
            <select value={filtroUser} onChange={e=>setFU(e.target.value)}
              style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:'8px 12px',fontSize:13,fontFamily:'inherit',cursor:'pointer'}}>
              <option value="todos">👥 Todos os colaboradores</option>
              {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          <select value={filtroMes} onChange={e=>setFM(e.target.value)}
            style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:'8px 12px',fontSize:13,fontFamily:'inherit',cursor:'pointer'}}>
            <option value="todos">📅 Todos os meses</option>
            {meses.map(m=><option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
        </div>
      </Card>

      {dadosUsuario.length === 0 && (
        <Card><p style={{textAlign:'center',color:C.cinzaClaro,padding:20}}>Nenhum dado encontrado.</p></Card>
      )}

      {(dadosUsuario||[]).map(d => {
        const hPrevH = d.hPrevH;
        return (
          <div key={d.usuario.id} style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Header colaborador */}
            <Card style={{background:`linear-gradient(135deg,${C.azulEscuro},${C.azulMedio})`,border:'none',padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <Avatar u={d.usuario} size={52}/>
                  <div>
                    <h3 style={{color:C.branco,margin:0,fontSize:18,fontWeight:800}}>{d.usuario.nome}</h3>
                    <p style={{color:C.ciano,margin:'3px 0 0',fontSize:12}}>{d.usuario.email}</p>
                    <p style={{color:'rgba(255,255,255,0.6)',margin:'2px 0 0',fontSize:11}}>
                      {d.usuario.perfil==='admin'?'👑 Admin':d.usuario.perfil==='gestor'?'🔑 Gestor':'👤 Colaborador'} • {labelMes(filtroMes)}
                    </p>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  {d.salario > 0 && (
                    <div style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,padding:'8px 14px',textAlign:'center'}}>
                      <div style={{color:C.ciano,fontSize:10,fontWeight:700}}>CUSTO/HORA</div>
                      <div style={{color:C.branco,fontSize:16,fontWeight:800}}>{fmt$(d.custoHora)}</div>
                    </div>
                  )}
                  <Btn onClick={()=>gerarPDF(d)} disabled={gerando}
                    style={{background:'rgba(86,191,233,0.2)',color:C.ciano,border:'1px solid rgba(86,191,233,0.4)'}}>
                    {gerando?'⏳ Gerando...':'📄 Exportar PDF'}
                  </Btn>
                </div>
              </div>
            </Card>

            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
              {[
                {label:'Horas Trabalhadas', valor:`${d.totalH}h ${d.totalM}min`, cor:C.azulMedio, icone:'⏱'},
                {label:'Sessoes', valor:String(d.regs.length), cor:C.azulClaro, icone:'🖥'},
                {label:'Projetos', valor:String(d.projsUnicos.size), cor:C.ciano, icone:'📂'},
                {label:'Eficiencia', valor:`${d.eficiencia}%`,
                  cor:d.eficiencia>=80?C.verde:d.eficiencia>=50?C.amarelo:C.vermelho, icone:'📊'},
                ...(d.salario>0 ? [{label:'Salario Mensal', valor:fmt$(d.salario), cor:C.verde, icone:'💵'}] : []),
              ].map(k=>(
                <Card key={k.label} style={{textAlign:'center',borderTop:`3px solid ${k.cor}`,padding:14}}>
                  <div style={{fontSize:22}}>{k.icone}</div>
                  <div style={{fontSize:k.label==='Salario Mensal'?13:20,fontWeight:800,color:k.cor,lineHeight:1.2,marginTop:4}}>{k.valor}</div>
                  <div style={{fontSize:11,color:C.cinzaClaro,marginTop:4,fontWeight:600}}>{k.label}</div>
                </Card>
              ))}
            </div>

            {/* Barra eficiência */}
            <Card style={{padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:C.cinzaEscuro}}>
                  Eficiencia do mes (meta: {hPrevH}h / {Math.round(hPrevH/7)} dias uteis)
                </span>
                <span style={{fontSize:14,fontWeight:800,
                  color:d.eficiencia>=80?C.verde:d.eficiencia>=50?C.amarelo:C.vermelho}}>
                  {d.eficiencia}%
                </span>
              </div>
              <div style={{background:C.cinzaFundo,borderRadius:8,height:12}}>
                <div style={{background:d.eficiencia>=80?C.verde:d.eficiencia>=50?C.amarelo:C.vermelho,
                  height:12,borderRadius:8,width:`${d.eficiencia}%`,transition:'width 0.5s'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.cinzaClaro,marginTop:6}}>
                <span>0h</span>
                <span style={{color:C.amarelo}}>{Math.round(hPrevH*0.5)}h (50%)</span>
                <span style={{color:C.verde}}>{Math.round(hPrevH*0.8)}h (80%)</span>
                <span>{hPrevH}h (100%)</span>
              </div>
            </Card>

            {/* Horas por projeto */}
            {Object.keys(d.porProjeto).length > 0 && (
              <Card>
                <h3 style={{color:C.azulEscuro,margin:'0 0 16px',fontSize:14,fontWeight:700}}>⏱ Distribuicao de Horas por Projeto</h3>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {Object.entries(d.porProjeto).sort((a,b)=>b[1].totalMin-a[1].totalMin).map(([pid,pd])=>{
                    const proj = projetos.find(p=>p.id===pid);
                    const pct  = d.totalMin>0 ? (pd.totalMin/d.totalMin)*100 : 0;
                    const custoProj = d.salario>0 && d.totalMin>0 ? (pd.totalMin/d.totalMin)*d.salario : 0;
                    return (
                      <div key={pid} style={{padding:'10px 14px',background:C.cinzaFundo,borderRadius:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:8}}>
                          <div>
                            <span style={{fontSize:12,fontWeight:800,color:C.azulMedio}}>{proj?.codigo||pid}</span>
                            <span style={{fontSize:11,color:C.cinzaClaro,marginLeft:8}}>{proj?.cliente?.substring(0,45)||'—'}</span>
                          </div>
                          <div style={{display:'flex',gap:12,alignItems:'center'}}>
                            {d.salario>0 && <span style={{fontSize:11,fontWeight:700,color:C.amarelo}}>{fmt$(custoProj)}</span>}
                            <span style={{fontSize:12,fontWeight:700,color:C.azulEscuro}}>{Math.floor(pd.totalMin/60)}h {pd.totalMin%60}min</span>
                            <span style={{fontSize:11,color:C.cinzaClaro}}>{pd.sessoes} sessao(oes)</span>
                            <span style={{fontSize:11,fontWeight:700,
                              color:pct>30?C.vermelho:pct>15?C.amarelo:C.verde}}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{background:C.cinzaCard,borderRadius:6,height:8}}>
                          <div style={{background:C.azulClaro,height:8,borderRadius:6,width:`${pct}%`,transition:'width 0.4s'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {d.regs.length === 0 && (
              <Card><p style={{textAlign:'center',color:C.cinzaClaro,padding:16}}>Nenhuma sessao registrada neste periodo.</p></Card>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── FERIADOS GOV. VALADARES (municipais fixos) ───────────────────────────────
export function BancoHoras({registros,setRegistros,usuarios,projetos,usuarioAtual,onAbrirEncerramento}){
  const [filtroUser,setFU]=useState(usuarioAtual.perfil==="colaborador"?usuarioAtual.id:"todos");
  const [filtroMes,setFM]=useState("todos");
  const [abaH,     setAbaH]=useState("historico"); // historico | extras
  const [editandoObs,setEditandoObs]=useState(null);
  const [novaObs,setNovaObs]=useState("");
  const isGestor=["admin","gestor"].includes(usuarioAtual.perfil);

  const podeEditar = (r) => isGestor || r.usuarioId===usuarioAtual.id;

  const excluirSessao = async (id) => {
    if(!window.confirm("Excluir este registro?")) return;
    setRegistros(x=>x.filter(x2=>x2.id!==id));
    syncHoras.excluir(id);
  };

  const salvarObs = async (id) => {
    // obs e obsInicio juntos: a leitura do banco usa obs_inicio, então editar só "obs" se perdia ao recarregar
    const reg = registros.find(r=>r.id===id);
    setRegistros(x=>x.map(r=>r.id===id?{...r,obs:novaObs,obsInicio:novaObs}:r));
    setEditandoObs(null);
    if(reg) syncHoras.salvar({...reg, obs:novaObs, obsInicio:novaObs});
  };

  const meses=useMemo(()=>{const s=new Set();registros.forEach(r=>{if(r.data)s.add(r.data.slice(0,7));});return [...s].sort((a,b)=>b.localeCompare(a));},[registros]);

  const filtrados=useMemo(()=>registros.filter(r=>{
    if(!isGestor&&r.usuarioId!==usuarioAtual.id) return false;
    if(filtroUser!=="todos"&&r.usuarioId!==filtroUser) return false;
    if(filtroMes!=="todos"&&!r.data?.startsWith(filtroMes)) return false;
    return true;
  }),[registros,filtroUser,filtroMes,usuarioAtual,isGestor]);

  const resumoUser=useMemo(()=>{const m={};filtrados.forEach(r=>{if(!m[r.usuarioId])m[r.usuarioId]={totalMin:0,sessoes:0,projs:new Set(),totalExtras:0};m[r.usuarioId].totalMin+=r.duracaoMin||0;m[r.usuarioId].sessoes++;m[r.usuarioId].totalExtras+=r.minutosExtras||0;if(r.projetoId)m[r.usuarioId].projs.add(r.projetoId);});return m;},[filtrados]);

  const resumoProj=useMemo(()=>{const m={};filtrados.forEach(r=>{if(!r.projetoId)return;if(!m[r.projetoId])m[r.projetoId]={totalMin:0,sessoes:0};m[r.projetoId].totalMin+=r.duracaoMin||0;m[r.projetoId].sessoes++;});return m;},[filtrados]);

  const sessaoAberta=registros.find(r=>r.usuarioId===usuarioAtual.id&&!r.horaFim);
  const totalExtras = filtrados.filter(r=>r.usuarioId===usuarioAtual.id||(["admin","gestor"].includes(usuarioAtual.perfil)&&filtroUser==="todos")).reduce((a,r)=>a+(r.minutosExtras||0),0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Resumo de horas extras na aba extras */}
      {abaH==="extras"&&(()=>{
        const regExtras = filtrados.filter(r=>(r.minutosExtras||0)>0 && (isGestor||r.usuarioId===usuarioAtual.id));
        const totalExtraMin = regExtras.reduce((a,r)=>a+(r.minutosExtras||0),0);
        const porUser = {};
        regExtras.forEach(r=>{
          if(!porUser[r.usuarioId]) porUser[r.usuarioId]={min:0,n:0};
          porUser[r.usuarioId].min+=r.minutosExtras||0;
          porUser[r.usuarioId].n++;
        });
        return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
            <Card style={{textAlign:"center",borderTop:`3px solid ${C.laranja}`,padding:14}}>
              <div style={{fontSize:22}}>⏰</div>
              <div style={{fontSize:22,fontWeight:800,color:C.laranja}}>{fmtDuracao(totalExtraMin)}</div>
              <div style={{fontSize:11,color:C.cinzaClaro,marginTop:4}}>Total de horas extras</div>
            </Card>
            {isGestor&&Object.entries(porUser).map(([uid,d])=>{
              const u=usuarios.find(x=>x.id===uid);
              return <Card key={uid} style={{borderTop:`3px solid ${C.amarelo}`,padding:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Avatar u={u} size={28}/><span style={{fontSize:13,fontWeight:700}}>{u?.nome||uid}</span></div>
                <div style={{fontSize:18,fontWeight:800,color:C.amarelo}}>{fmtDuracao(d.min)}</div>
                <div style={{fontSize:11,color:C.cinzaClaro}}>{d.n} sessão(ões)</div>
              </Card>;
            })}
          </div>
        );
      })()}
      {sessaoAberta&&(
        <Card style={{borderLeft:`4px solid ${C.verde}`,background:"#f0fdf4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#166534"}}>▶ Sessão em andamento</div>
              <div style={{fontSize:12,color:"#166534",marginTop:2}}>Projeto: <strong>{projetos.find(p=>p.id===sessaoAberta.projetoId)?.codigo||"?"}</strong> — Início: {sessaoAberta.horaInicio}</div>
            </div>
            <Btn onClick={onAbrirEncerramento} variant="verde" small>🏁 Encerrar expediente</Btn>
          </div>
        </Card>
      )}

      <Card style={{padding:16}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          {isGestor&&<select value={filtroUser} onChange={e=>setFU(e.target.value)} style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
            <option value="todos">👤 Todos</option>
            {usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>}
          <select value={filtroMes} onChange={e=>setFM(e.target.value)} style={{border:`1.5px solid ${C.cinzaCard}`,borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
            <option value="todos">📅 Todos os meses</option>
            {meses.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{fontSize:12,color:C.cinzaClaro,marginLeft:"auto"}}>{filtrados.length} registro(s)</span>
        </div>
      </Card>

      {isGestor&&filtroUser==="todos"&&Object.keys(resumoUser).length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
          {Object.entries(resumoUser).map(([uid,d])=>{
            const u=usuarios.find(x=>x.id===uid); if(!u) return null;
            return(<Card key={uid} style={{borderTop:`3px solid ${u.cor||C.azulMedio}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><Avatar u={u} size={36}/><div style={{fontWeight:700,color:C.cinzaEscuro,fontSize:13}}>{u.nome}</div></div>
              <div style={{fontSize:24,fontWeight:800,color:u.cor||C.azulMedio}}>{fmtDuracao(d.totalMin)}</div>
              <div style={{fontSize:11,color:C.cinzaClaro,marginTop:4}}>{d.sessoes} sessão(ões) • {d.projs.size} projeto(s)</div>
              {d.totalExtras>0&&<div style={{fontSize:11,color:C.laranja,fontWeight:700,marginTop:2}}>⏰ +{fmtDuracao(d.totalExtras)} extras</div>}
            </Card>);
          })}
        </div>
      )}

      {Object.keys(resumoProj).length>0&&(
        <Card>
          <h3 style={{color:C.azulEscuro,margin:"0 0 16px",fontSize:14,fontWeight:700}}>⏱ Horas por Projeto</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.entries(resumoProj).sort((a,b)=>b[1].totalMin-a[1].totalMin).map(([pid,d])=>{
              const proj=projetos.find(p=>p.id===pid);
              const maxMin=Math.max(...Object.values(resumoProj).map(x=>x.totalMin));
              return(<div key={pid} style={{padding:"10px 14px",background:C.cinzaFundo,borderRadius:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div><span style={{fontSize:12,fontWeight:700,color:C.azulMedio}}>{proj?.codigo||pid}</span><span style={{fontSize:11,color:C.cinzaClaro,marginLeft:8}}>{proj?.cliente?.substring(0,40)||"—"}</span></div>
                  <span style={{fontSize:13,fontWeight:700,color:C.azulEscuro}}>{fmtDuracao(d.totalMin)}</span>
                </div>
                <div style={{background:C.cinzaCard,borderRadius:4,height:6}}><div style={{background:C.azulClaro,height:6,borderRadius:4,width:`${maxMin>0?(d.totalMin/maxMin)*100:0}%`,transition:"width 0.3s"}}/></div>
              </div>);
            })}
          </div>
        </Card>
      )}

      <Card style={{padding:0,overflow:"hidden"}}>
        {/* Sub-abas Histórico / Horas Extras */}
        <div style={{padding:"0 20px",borderBottom:`1px solid ${C.cinzaCard}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:0}}>
            {[{id:"historico",label:"📋 Histórico"},{id:"extras",label:"⏰ Horas Extras"}].map(t=>(
              <button key={t.id} onClick={()=>setAbaH(t.id)}
                style={{background:"none",border:"none",padding:"14px 18px",cursor:"pointer",fontSize:13,
                  fontFamily:"inherit",fontWeight:abaH===t.id?700:500,
                  color:abaH===t.id?C.azulMedio:C.cinzaClaro,
                  borderBottom:abaH===t.id?`2px solid ${C.azulMedio}`:"2px solid transparent",
                  marginBottom:-1,transition:"all 0.15s"}}>
                {t.label}
              </button>
            ))}
          </div>
          <span style={{fontSize:11,color:C.cinzaClaro}}>{filtrados.filter(r=>abaH==="extras"?(r.minutosExtras||0)>0:true).length} registro(s)</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:C.azulEscuro}}>
                {(abaH==="extras"
                  ? ["Data","Colaborador","Projeto/Atividade","Entrada","Saída","Total","H.Extra","O que fez",""]
                  : ["Data","Tipo","Colaborador","Projeto/Atividade","Entrada","Saída","Duração","H.Extra","O que fez","Feedback",""]
                ).map(h=><th key={h} style={{padding:"10px 14px",color:C.ciano,textAlign:"left",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(()=>{
                const lista = abaH==="extras"
                  ? [...filtrados].filter(r=>(r.minutosExtras||0)>0).sort((a,b)=>(b.inicioTs||0)-(a.inicioTs||0))
                  : [...filtrados].sort((a,b)=>(b.inicioTs||0)-(a.inicioTs||0));
                if(lista.length===0) return <tr><td colSpan={11} style={{padding:"24px",textAlign:"center",color:C.cinzaClaro}}>
                  {abaH==="extras"?"Nenhuma hora extra registrada no período 🎉":"Nenhum registro encontrado"}
                </td></tr>;
                return lista.map((r,i)=>{
                  const u=usuarios.find(x=>x.id===r.usuarioId);
                  const proj=projetos.find(p=>p.id===r.projetoId);
                  const aberta=!r.horaFim;
                  return(
                    <tr key={r.id} style={{borderBottom:`1px solid ${C.cinzaFundo}`,background:i%2===0?C.branco:"#f8fafc"}}>
                      <td style={{padding:"9px 14px",color:C.cinzaClaro,whiteSpace:"nowrap"}}>{r.data?fmtData(r.data):"—"}</td>
                      {abaH==="historico"&&(
                        <td style={{padding:"9px 14px"}}>
                          {r.categoriaAdmin
                            ? <span style={{fontSize:10,background:"#f0fdf4",color:"#166534",padding:"2px 7px",borderRadius:4,fontWeight:700}}>⚙ Adm</span>
                            : <span style={{fontSize:10,background:"#eff6ff",color:C.azulMedio,padding:"2px 7px",borderRadius:4,fontWeight:700}}>📁 Proj</span>}
                        </td>
                      )}
                      <td style={{padding:"9px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <Avatar u={u} size={24}/>
                          <span style={{fontWeight:600,fontSize:12}}>{u?.nome||"—"}</span>
                        </div>
                      </td>
                      <td style={{padding:"9px 14px"}}>
                        {r.categoriaAdmin
                          ? <div style={{fontSize:11,fontWeight:700,color:"#166534"}}>{CATS_ADMIN.find(c=>c.id===r.categoriaAdmin)?.label||"Adm"}</div>
                          : <><div style={{fontSize:11,fontWeight:700,color:C.azulMedio}}>{proj?.codigo||"—"}</div>
                             <div style={{fontSize:11,color:C.cinzaClaro}}>{proj?.cliente?.substring(0,28)||""}</div></>}
                      </td>
                      <td style={{padding:"9px 14px",color:C.cinzaClaro}}>{r.horaInicio||"—"}</td>
                      <td style={{padding:"9px 14px",color:C.cinzaClaro}}>
                        {aberta?<span style={{color:C.verde,fontWeight:700}}>Em aberto</span>:r.horaFim}
                      </td>
                      <td style={{padding:"9px 14px",fontWeight:700,color:aberta?C.verde:C.azulEscuro}}>
                        {aberta?"...":fmtDuracao(r.duracaoMin)}
                      </td>
                      {/* H. Extra */}
                      <td style={{padding:"9px 14px"}}>
                        {(r.minutosExtras||0)>0
                          ? <span style={{fontSize:11,fontWeight:700,color:C.laranja,background:"#fff7ed",padding:"2px 8px",borderRadius:4,border:"1px solid #fed7aa",whiteSpace:"nowrap"}}>+{fmtDuracao(r.minutosExtras)}</span>
                          : <span style={{color:C.cinzaClaro,fontSize:11}}>—</span>}
                      </td>
                      {/* O que fez */}
                      <td style={{padding:"9px 14px",maxWidth:160}}>
                        <div style={{fontSize:11,color:C.cinzaEscuro,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}
                          title={r.obsInicio||r.obs||"—"}>
                          {r.obsInicio||r.obs||<span style={{color:C.cinzaClaro}}>—</span>}
                        </div>
                      </td>
                      {/* Feedback — só na aba histórico */}
                      {abaH==="historico"&&(
                        <td style={{padding:"9px 14px",maxWidth:160}}>
                          {editandoObs===r.id ? (
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <input value={novaObs} onChange={e=>setNovaObs(e.target.value)}
                                onKeyDown={e=>{if(e.key==="Enter")salvarObs(r.id);if(e.key==="Escape")setEditandoObs(null);}}
                                autoFocus placeholder="Feedback..."
                                style={{flex:1,border:`1.5px solid ${C.azulClaro}`,borderRadius:6,padding:"3px 7px",fontSize:12,fontFamily:"inherit"}}/>
                              <button onClick={()=>salvarObs(r.id)} style={{background:C.verde,color:"#fff",border:"none",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>✓</button>
                              <button onClick={()=>setEditandoObs(null)} style={{background:"none",border:"none",color:C.cinzaClaro,cursor:"pointer",fontSize:14}}>✕</button>
                            </div>
                          ):(
                            <div style={{display:"flex",alignItems:"center",gap:4,cursor:podeEditar(r)?"pointer":"default"}}
                              onClick={()=>{ if(podeEditar(r)){setEditandoObs(r.id);setNovaObs(r.obsFim||"");} }}>
                              <span style={{color:r.obsFim?C.cinzaEscuro:C.cinzaClaro,fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}
                                title={r.obsFim||""}>
                                {r.obsFim||<span style={{fontStyle:"italic",color:C.cinzaClaro,fontSize:10}}>+ feedback</span>}
                              </span>
                              {podeEditar(r)&&<span style={{color:C.azulClaro,fontSize:10,opacity:0.5}}>✏</span>}
                            </div>
                          )}
                        </td>
                      )}
                      {/* Excluir */}
                      {podeEditar(r)&&<td style={{padding:"9px 14px",width:36}}>
                        <Btn onClick={e=>{e.stopPropagation();excluirSessao(r.id);}} variant="danger" small>🗑</Btn>
                      </td>}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────

// ─── ESCALAS ───────────────────────────────────────────────────────────────────
