// Rotina da semana, aberta no primeiro acesso de cada semana:
//  • pergunta a disponibilidade (dias × períodos) e mostra o plano de horas por projeto;
//  • para gestores, lembra do backup semanal no Google Drive.
import { useEffect, useMemo, useState } from "react";
import Icone from "../ui/Icone.jsx";
import { CabecalhoModal, caixaModal, fundoModal } from "../ui/ds.jsx";
import EditorDisponibilidade from "./EditorDisponibilidade.jsx";
import { disponibilidade } from "./dados.js";
import { diasDaSemana, horasSemana, inicioSemana, periodosDoExpediente } from "./semana.js";
import { montarPlano } from "./plano.js";
import { VisaoPlano } from "./MinhaSemana.jsx";
import { lerPreferencias, prefPadrao, sincronizarAgenda } from "./agendaGoogle.js";
import { backupPendente, fazerBackupNoDrive } from "./backupSemanal.js";

const K = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#6b7a90", borda: "#e6ecf4", verde: "#16a34a" };
const btn = (tipo = "pri", extra = {}) => ({ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  ...(tipo === "pri" ? { background: K.azul, color: "#fff", border: `1px solid ${K.azul}` } : { background: "#fff", color: K.mar, border: `1px solid ${K.borda}` }), ...extra });
const fmtD = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ss = { ler(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, gravar(k, v) { try { sessionStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };

function ModalSemana({ usuario, usuarios, projetos, registros, semana, inicial, onFechar }) {
  const [periodos, setPeriodos] = useState(inicial);
  const [pref, setPref] = useState(prefPadrao);
  const [agendaOn, setAgendaOn] = useState(false);
  const [estado, setEstado] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { lerPreferencias(usuario.id).then(p => { const pp = { ...prefPadrao, ...(p || {}) }; setPref(pp); setAgendaOn(!!(p && (pp.blocos || pp.entregas))); }); }, [usuario.id]);
  const plano = useMemo(() => montarPlano({ projetos, registros, usuario, periodos, semana }), [projetos, registros, usuario, periodos, semana]);
  const dias = diasDaSemana(semana);

  async function confirmar() {
    setErro(""); setEstado("Salvando…");
    try {
      await disponibilidade.salvar(usuario.id, semana, periodos);
      if (agendaOn && (pref.blocos || pref.entregas)) {
        setEstado("Enviando para a Google Agenda…");
        try { await sincronizarAgenda({ pref, plano, projetos, usuarioAtual: usuario, usuarios }); }
        catch (e) { setErro("Disponibilidade salva, mas a Google Agenda não foi atualizada: " + e.message); setEstado(""); return; }
      }
      onFechar(true);
    } catch (e) { setErro("Não foi possível salvar: " + e.message); setEstado(""); }
  }

  return (
    <div style={fundoModal}>
      <div role="dialog" aria-modal="true" aria-label="Planeje sua semana" style={{ ...caixaModal, maxWidth: 1040 }}>
        <CabecalhoModal rotulo="Primeiro acesso da semana" titulo={`Planeje sua semana, ${String(usuario.nome || "").split(" ")[0]}`}
          subtitulo={`De ${fmtD(dias[0].data)} a ${fmtD(dias[6].data)}: marque quando você vai trabalhar e o sistema distribui as horas dos seus projetos.`} icone="agenda" onFechar={() => onFechar(false)} />
        <div style={{ padding: 20, maxHeight: "74vh", overflowY: "auto", display: "grid", gap: 18 }}>
          <EditorDisponibilidade periodos={periodos} onChange={setPeriodos} semana={semana} compacto />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: K.mar, marginBottom: 8 }}>Prévia do plano · {(Math.round(plano.alocado * 10) / 10).toLocaleString("pt-BR")} h em {plano.metas.length} projeto(s)</div>
            {plano.metas.length ? <VisaoPlano plano={plano} compacto /> : <div style={{ fontSize: 13, color: K.sub }}>Nenhum projeto em andamento com você na equipe.</div>}
            {plano.semEspaco > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: "#92400e" }}>Faltam {plano.semEspaco.toLocaleString("pt-BR")} h para cumprir todas as metas — acrescente períodos se puder.</div>}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: K.tx, cursor: "pointer" }}>
            <input type="checkbox" checked={agendaOn} onChange={e => setAgendaOn(e.target.checked)} style={{ accentColor: K.azul, width: 17, height: 17 }} />
            Enviar para a minha Google Agenda ({[pref.blocos && "blocos de trabalho", pref.entregas && "calendário de entregas"].filter(Boolean).join(" e ") || "nada escolhido — ajuste em Agenda → Minha semana"})
          </label>
          {erro && <div role="alert" style={{ fontSize: 13, color: "#9f1239", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "9px 12px" }}>{erro}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 20px", borderTop: `1px solid ${K.borda}`, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: K.sub }}>Total disponível: <b style={{ color: K.mar }}>{horasSemana(periodos).toLocaleString("pt-BR")} h</b> · dá para mudar depois em Agenda → Minha semana</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onFechar(false)} style={btn("sec")}>Agora não</button>
            <button onClick={confirmar} disabled={!!estado} style={btn("pri", { opacity: estado ? .7 : 1 })}><Icone nome="check" tam={16} />{estado || "Confirmar minha semana"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvisoBackup({ usuario, onFechar }) {
  const [estado, setEstado] = useState("");
  const [feito, setFeito] = useState(null);
  const [erro, setErro] = useState("");
  async function fazer() {
    setErro("");
    try { const r = await fazerBackupNoDrive(usuario, setEstado); setFeito(r); }
    catch (e) { setErro(e.message); }
    finally { setEstado(""); }
  }
  return (
    <div role="status" style={{ position: "fixed", left: 20, bottom: 20, zIndex: 900, width: 340, maxWidth: "calc(100vw - 40px)", background: "#fff", border: `1px solid ${K.borda}`, borderRadius: 14, boxShadow: "0 12px 40px rgba(10,25,55,.2)", padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: feito ? "#dcfce7" : "#e9f1fd", color: feito ? K.verde : K.azul, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icone nome={feito ? "check" : "nuvem"} tam={18} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: K.mar }}>{feito ? "Backup da semana salvo" : "Backup semanal pendente"}</div>
          <div style={{ fontSize: 12.5, color: K.sub, marginTop: 2, lineHeight: 1.45 }}>
            {feito ? <>{feito.registros} registros de {feito.tabelas} tabelas em <a href={feito.link} target="_blank" rel="noreferrer" style={{ color: K.azul, fontWeight: 600 }}>{feito.arquivo}</a></>
              : "Copia todos os dados do sistema para a pasta “Backups Sistema WM” no Google Drive."}
          </div>
          {erro && <div style={{ fontSize: 12, color: "#9f1239", marginTop: 6 }}>{erro}</div>}
          {!feito && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={fazer} disabled={!!estado} style={btn("pri", { padding: "7px 12px", fontSize: 13 })}>{estado || "Fazer agora"}</button>
            <button onClick={() => onFechar()} disabled={!!estado} style={btn("sec", { padding: "7px 12px", fontSize: 13 })}>Depois</button>
          </div>}
        </div>
        <button onClick={() => onFechar()} aria-label="Fechar" style={{ border: "none", background: "none", color: K.sub, cursor: "pointer", padding: 2 }}><Icone nome="fechar" tam={16} /></button>
      </div>
    </div>
  );
}

export default function RotinaSemanal({ user, usuarios, projetos, registros, pausado }) {
  const semana = inicioSemana();
  const [inicial, setInicial] = useState(null);
  const [backup, setBackup] = useState(false);
  const gestor = ["admin", "gestor"].includes(user?.perfil);
  useEffect(() => {
    if (!user?.id) return;
    let vivo = true;
    (async () => {
      if (!ss.ler(`wm-semana-adiada-${user.id}-${semana}`)) {
        const ja = await disponibilidade.ler(user.id, semana);
        if (!ja && vivo) {
          const ult = await disponibilidade.ultima(user.id, semana);
          const eu = (usuarios || []).find(u => String(u.id) === String(user.id)) || user;
          setInicial(ult || periodosDoExpediente(eu.expediente));
        }
      }
      if (gestor && !ss.ler(`wm-backup-adiado-${semana}`) && await backupPendente() && vivo) setBackup(true);
    })();
    return () => { vivo = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || pausado) return null;
  const eu = (usuarios || []).find(u => String(u.id) === String(user.id)) || user;
  return (
    <>
      {inicial && <ModalSemana usuario={{ ...eu, email: eu.email || user.email }} usuarios={usuarios} projetos={projetos} registros={registros} semana={semana} inicial={inicial}
        onFechar={ok => { if (!ok) ss.gravar(`wm-semana-adiada-${user.id}-${semana}`, "1"); setInicial(null); }} />}
      {backup && !inicial && <AvisoBackup usuario={user} onFechar={() => { ss.gravar(`wm-backup-adiado-${semana}`, "1"); setBackup(false); }} />}
    </>
  );
}
