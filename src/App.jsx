import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { db, supabase, authClient, iniciarRealtime, enviarEmail, chat } from "./supabase.js";
import { SinoNotificacoes, PaginaTarefas } from "./lembretes/Central.jsx";
import { useCentral, usePush, useAvisosAbertos } from "./lembretes/hooks.js";
import * as syncHoras from "./sessoesSync.js";
import { ACESSOS_GOOGLE, C, prepararFoto, CHECK_INTERVAL, TelaLogin, USUARIOS_PADRAO, calcStatusAuto, expedientePadrao, expedienteParaDiaSemana, fimExpediente, horaMin, normEmail, normNome, normalizarExpediente, notificarSistema, notificarUmaVez, obrasProgressoListeners, pedirPermissaoNotificacao, piscarTitulo, statusN, tocarSomChat, useGoogleDrive, verificarForaExpediente, verificarHoraExtra } from "./nucleo.jsx";
import { ModalHoras } from "./paginas/ModalHoras.jsx";
import Icone from "./ui/Icone.jsx";
import { BuscaGlobal, MenuUsuario, CarregandoPagina, CabecalhoPagina } from "./ui/Topo.jsx";

// Título das páginas que não têm cabeçalho próprio
const CABECALHOS = {
  projetos:   { titulo:"Projetos",      subtitulo:"Todos os projetos com status, prazos, equipe e financeiro." },
  financeiro: { titulo:"Financeiro",    subtitulo:"Valores contratados, recebidos e pendentes por projeto." },
  horas:      { titulo:"Horas",         subtitulo:"Banco de horas, horas extras e produtividade da equipe." },
  agenda:     { titulo:"Agenda",        subtitulo:"Calendário, feriados, recessos e escalas." },
  config:     { titulo:"Configurações", subtitulo:"Usuários, perfis, especialidades e expediente." },
};
import { useCalendario } from "./calendario.js";

// Páginas carregadas sob demanda (o navegador só baixa o código da página aberta)
const carregarPagina = (imp, nome) => lazy(() => imp().then(m => ({ default: m[nome] })));
const imp_horas = () => import("./paginas/horas.jsx");
const AbaHoras = carregarPagina(imp_horas, "AbaHoras");
const imp_agenda = () => import("./paginas/agenda.jsx");
const AbaAgenda = carregarPagina(imp_agenda, "AbaAgenda");
const imp_configuracoes = () => import("./paginas/configuracoes.jsx");
const Configuracoes = carregarPagina(imp_configuracoes, "Configuracoes");
const imp_projetos = () => import("./paginas/projetos.jsx");
const ModalProjeto = carregarPagina(imp_projetos, "ModalProjeto");
const ListaProjetos = carregarPagina(imp_projetos, "ListaProjetos");
const Financeiro = carregarPagina(imp_projetos, "Financeiro");
const imp_dashboard = () => import("./paginas/dashboard.jsx");
const Dashboard = carregarPagina(imp_dashboard, "Dashboard");
const imp_chat = () => import("./paginas/chat.jsx");
const ChatFlutuante = carregarPagina(imp_chat, "ChatFlutuante");
const imp_contratos = () => import("./paginas/contratos.jsx");
const GeradorContratos = carregarPagina(imp_contratos, "GeradorContratos");
const PaginaAjuda = lazy(() => import("./ajuda/PaginaAjuda.jsx"));
const PaginaCalculadoras = carregarPagina(() => import("./calculadoras/Calculadoras.jsx"), "AbaCalculadoras");
const PaginaRelatorios = carregarPagina(() => import("./paginas/relatorios.jsx"), "PaginaRelatorios");

export default function App(){
  const calendario = useCalendario();
  const [projetos,  setProjetos]  = useState([]);
  const [usuarios,  setUsuarios]  = useState(USUARIOS_PADRAO);
  const [registros, setRegistros] = useState([]);
  const [carregando,setCarregando]= useState(true);

  // ── PWA + Menu: hooks sempre no topo, antes de qualquer return condicional ─
  const [pwaPrompt,   setPwaPrompt]   = useState(null);
  const [pwaInstalado,setPwaInstalado]= useState(false);
  const [menuAberto,  setMenuAberto]  = useState(false);
  useEffect(()=>{
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', ()=>{ setPwaInstalado(true); setPwaPrompt(null); });
    return ()=> window.removeEventListener('beforeinstallprompt', handler);
  },[]);
  const instalarPWA = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') { setPwaInstalado(true); setPwaPrompt(null); }
  };
  const [user, setUser] = useState(()=>{
    try {
      const s = localStorage.getItem("intec_user_logado");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [aba,       setAba]       = useState("dashboard");
  const [modal,     setModal]     = useState(null);
  const [modalH,    setModalH]    = useState(null);
  const drive    = useGoogleDrive();
  const timerRef      = useRef(null);
  const expRef        = useRef(null);
  const notifRef      = useRef(null);
  const registrosRef  = useRef([]);
  const encerrarRef   = useRef(null);
  const projetosRef   = useRef([]);
  const userRef       = useRef(null);
  const chatSubsRef     = useRef({});   // assinaturas de mensagens por canal {canalId: sub}
  const chatMembrosSub      = useRef(null); // assinatura de novos DMs
  const chatCanaisPublicosSub = useRef(null); // assinatura de novos canais públicos
  const canalAtivoRef   = useRef(null); // ref para evitar stale closure
  const [chatCanais,       setChatCanais]     = useState([]);
  const [chatCanalAtivo,   setChatCanalAtivo] = useState(null);
  const [chatMensagens,    setChatMensagens]  = useState([]);
  const [chatNaoLidos,     setChatNaoLidos]   = useState({});  // {canalId: count}
  const [chatMencao,       setChatMencao]     = useState(false);
  const [chatAberto,       setChatAberto]     = useState(false);
  const [chatPulsando,     setChatPulsando]   = useState(false);
  const chatAbertoRef = useRef(false);
  useEffect(()=>{ chatAbertoRef.current = chatAberto; },[chatAberto]);

  // ── Helper: selecionar canal — carrega mensagens + zera badge ───────────
  const chatSelecionarCanal = useCallback(async (canal) => {
    setChatCanalAtivo(canal);
    canalAtivoRef.current = canal;
    setChatMensagens([]);
    try {
      const msgs = await chat.listarMensagens(canal.id, 100);
      setChatMensagens(msgs);
    } catch(e){ console.error(e); }
    // Zerar badge deste canal
    setChatNaoLidos(prev=>{
      const novo = {...prev};
      delete novo[canal.id];
      const total = Object.values(novo).reduce((a,b)=>a+b,0);
      if(total===0) setChatMencao(false);
      return novo;
    });
    if(user) chat.marcarLido(canal.id, user.id).catch(()=>{});
  }, [user?.id]);

  // ── Helper: assinar canal (reutilizável para novos DMs) ─────────────────
  const chatCanaisAutorizados = useRef(new Set()); // IDs que o usuário pode ver

  const assinarCanalGlobal = useCallback((c) => {
    if(chatSubsRef.current[c.id]) return;
    // SEGURANÇA: DMs só podem ser assinadas se o usuário for membro autorizado.
    // Canais públicos (tipo='canal') todos podem assinar.
    // DMs só chegam aqui via assinarMembros ou chatIniciarDM — ambos já verificados.
    // Se for DM e não estiver no set de autorizados, ignorar.
    if(c.tipo === 'direto' && !chatCanaisAutorizados.current.has(c.id)) return;
    const sub = chat.assinarCanal(c.id, (msg) => {
      const canalAberto = canalAtivoRef.current?.id === c.id && chatAbertoRef.current;
      if(canalAberto) {
        // Está visualizando — adiciona na lista sem badge
        setChatMensagens(prev=>{
          if(prev.find(m=>m.id===msg.id)) return prev;
          return [...prev, msg];
        });
        if(user) chat.marcarLido(c.id, user.id).catch(()=>{});
      } else {
        // Canal não ativo ou chat fechado — incrementa badge
        if(msg.autor_id !== userRef.current?.id) {
          setChatNaoLidos(prev=>({...prev,[c.id]:(prev[c.id]||0)+1}));
        }
      }
      if(msg.autor_id === userRef.current?.id) return;
      tocarSomChat();
      const eMencao = (msg.mencoes||[]).includes(userRef.current?.id);
      if(eMencao){ setChatMencao(true); setTimeout(tocarSomChat, 200); }
      piscarTitulo(eMencao?`🔔 ${msg.autor_nome} mencionou você!`:`💬 ${msg.autor_nome}: ${msg.conteudo.slice(0,30)}`);
      const cNome = c.tipo==="direto"?(c.nome||"").split("↔").find(n=>n.trim()!==userRef.current?.nome)?.trim()||"Mensagem":"# "+c.nome;
      notificarSistema(
        eMencao?`🔔 ${msg.autor_nome} mencionou você em ${cNome}!`:`💬 ${msg.autor_nome} — ${cNome}`,
        msg.conteudo.slice(0,80), "intec-chat-"+c.id, eMencao?12000:8000
      );
      if(!chatAbertoRef.current){
        setChatPulsando(true);
        setTimeout(()=>setChatPulsando(false), 800);
      }
    });
    chatSubsRef.current[c.id] = sub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper: enviar mensagem (optimistic) ─────────────────────────────────
  const chatEnviar = useCallback(async (canalId, texto, mencoes, arquivo=null) => {
    const tempId = "temp-"+Date.now();
    const tempMsg = {
      id:tempId, canal_id:canalId,
      autor_id:userRef.current?.id, autor_nome:userRef.current?.nome,
      autor_cor:userRef.current?.cor||C.azulMedio,
      conteudo:texto, mencoes,
      arquivo_url: arquivo?.url||null,
      arquivo_nome: arquivo?.nome||null,
      arquivo_tipo: arquivo?.tipo||null,
      arquivo_tamanho: arquivo?.tamanho||null,
      created_at:new Date().toISOString(),
    };
    setChatMensagens(prev=>[...prev,tempMsg]);
    try {
      const salva = await chat.enviarMensagem(canalId, userRef.current.id, userRef.current.nome, userRef.current.cor||C.azulMedio, texto, mencoes, arquivo);
      setChatMensagens(prev=>prev.map(m=>m.id===tempId?salva:m));
    } catch(e){
      setChatMensagens(prev=>prev.filter(m=>m.id!==tempId));
    }
  }, []);

  // ── Helper: iniciar DM ────────────────────────────────────────────────────
  const chatIniciarDM = useCallback(async (outro) => {
    const canal = await chat.obterOuCriarDM(user.id, outro.id, user.nome, outro.nome);
    chatCanaisAutorizados.current.add(canal.id);
    setChatCanais(prev=>prev.find(c=>c.id===canal.id)?prev:[...prev,canal]);
    assinarCanalGlobal(canal);
    chatSelecionarCanal(canal);
    // Notificar o outro usuário via Broadcast (direto, sem passar por postgres_changes)
    chat.notificarNovoDM(outro.id, canal).catch(()=>{});
  }, [user?.id, assinarCanalGlobal, chatSelecionarCanal]);

  // ── Helper: criar canal ───────────────────────────────────────────────────
  const chatCriarCanal = useCallback(async ({nome,descricao,icone}) => {
    const c = await chat.criarCanal(nome,descricao,icone,"canal",user?.id);
    setChatCanais(prev=>[...prev,c]);
    assinarCanalGlobal(c);
    chatSelecionarCanal(c);
  }, [user?.id, assinarCanalGlobal, chatSelecionarCanal]);

  // ── Helper: deletar canal/DM ──────────────────────────────────────────────
  const chatDeletar = useCallback(async (canalId) => {
    await chat.excluirCanal(canalId).catch(()=>{});
    if(chatSubsRef.current[canalId]){ chat.desassinarCanal(chatSubsRef.current[canalId]); delete chatSubsRef.current[canalId]; }
    setChatCanais(prev=>{
      const nova = prev.filter(c=>c.id!==canalId);
      if(canalAtivoRef.current?.id===canalId){
        const prox = nova.find(c=>c.tipo==="canal")||null;
        setChatCanalAtivo(prox); canalAtivoRef.current=prox;
        if(prox) chatSelecionarCanal(prox);
      }
      return nova;
    });
    setChatNaoLidos(prev=>{ const n={...prev}; delete n[canalId]; return n; });
  }, [chatSelecionarCanal]);

  // Manter refs sempre atualizados (evita stale closure nos timers)
  useEffect(() => {
    registrosRef.current = registros;
  }, [registros]);
  useEffect(() => { projetosRef.current  = projetos;   }, [projetos]);

  // ── Ponte com o módulo Obras (public/obras.html, mesmo domínio) ──
  useEffect(() => {
    window.WMObras = {
      supabase,
      usuario:   () => userRef.current || {},
      projetos:  () => (projetosRef.current || []).map(p => ({ id:p.id, codigo:p.codigo, cliente:p.cliente, tipo:p.tipo, progresso:p.progresso||0, status:p.status })),
      abrirProjeto: (id) => {
        const p = (projetosRef.current || []).find(x => x.id === id);
        if (p) setModal({ projeto:p, modo:"editar" });
      },
      atualizarProgresso: async (id, pct) => {
        const p = (projetosRef.current || []).find(x => x.id === id);
        if (!p) return;
        const progresso = Math.max(0, Math.min(100, Math.round(pct || 0)));
        if ((p.progresso || 0) === progresso) return;
        const n = { ...p, progresso };
        // Status automático: o checklist só conclui o projeto (100%); demais mudanças ficam para o salvar normal
        if (n.statusAuto && calcStatusAuto(n) === "CONCLUÍDO") n.status = "CONCLUÍDO";
        projetosRef.current = (projetosRef.current || []).map(x => x.id === id ? n : x);
        setProjetos(ps => ps.map(x => x.id === id ? { ...x, progresso, status:n.status } : x));
        obrasProgressoListeners.forEach(fn => { try { fn(id, progresso); } catch { /* ignore */ } });
        try {
          const { error } = await supabase.from('projetos').update({ progresso, status:n.status }).eq('id', id);
          if (error) throw error;
        } catch (e) { console.error("Erro ao atualizar progresso pela obra:", e); }
      },
    };
    return () => { delete window.WMObras; };
  }, []);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Chat global: carrega canais + assinaturas sempre ativas ─────────────
  useEffect(()=>{
    if(!user) return;
    let cancelado = false;
    chatCanaisAutorizados.current = new Set(); // limpar ao trocar usuário
    const init = async () => {
      try {
        const lista = await chat.listarCanais(user.id);
        if(cancelado) return;
        // Registrar todos os canais que o usuário pode ver
        lista.forEach(c => chatCanaisAutorizados.current.add(c.id));
        setChatCanais(lista);
        lista.forEach(c => assinarCanalGlobal(c));
        const primeiro = lista.find(c=>c.tipo==="canal");
        if(primeiro && !canalAtivoRef.current) {
          chatSelecionarCanal(primeiro);
        }
      } catch(e){ console.warn("Chat init:", e); }
    };
    init();

    // Escuta quando o usuário é adicionado a um novo DM
    const subMembros = chat.assinarMembros(user.id, (novoCanal) => {
      if(cancelado) return;
      // Autorizar antes de assinar
      chatCanaisAutorizados.current.add(novoCanal.id);
      setChatCanais(prev=>prev.find(c=>c.id===novoCanal.id)?prev:[...prev,novoCanal]);
      assinarCanalGlobal(novoCanal);
      setChatNaoLidos(prev=>({...prev,[novoCanal.id]:1}));
      setChatPulsando(true); setTimeout(()=>setChatPulsando(false),800);
      const quem = (novoCanal.nome||"").split("↔").find(n=>n.trim()!==user.nome)?.trim()||"alguém";
      notificarSistema(`💬 ${quem} iniciou uma conversa com você`,"Clique no Chat para responder","intec-dm-novo",10000);
    });
    chatMembrosSub.current = subMembros;

    // Escuta criação de canais públicos por qualquer usuário
    const subCanaisPublicos = chat.assinarCanaisPublicos(
      (novoCanal) => {
        if(cancelado) return;
        // IMPORTANTE: ignorar DMs — elas chegam via assinarMembros filtrado por usuário
        // Se processar aqui, todos veriam DMs privadas de outros usuários
        if(novoCanal.tipo !== 'canal') return;
        setChatCanais(prev=>{
          if(prev.find(c=>c.id===novoCanal.id)) return prev;
          return [...prev, novoCanal];
        });
        assinarCanalGlobal(novoCanal);
      },
      (canalId) => {
        if(cancelado) return;
        // Remover da lista para todos
        setChatCanais(prev=>{
          const nova = prev.filter(c=>c.id!==canalId);
          // Se estava visualizando esse canal, mudar para o primeiro disponível
          if(canalAtivoRef.current?.id===canalId){
            const prox = nova.find(c=>c.tipo==="canal")||null;
            setChatCanalAtivo(prox);
            canalAtivoRef.current = prox;
            setChatMensagens([]);
            if(prox) chatSelecionarCanal(prox);
          }
          return nova;
        });
        // Limpar assinatura de mensagens do canal deletado
        if(chatSubsRef.current[canalId]){
          chat.desassinarCanal(chatSubsRef.current[canalId]);
          delete chatSubsRef.current[canalId];
        }
        setChatNaoLidos(prev=>{ const n={...prev}; delete n[canalId]; return n; });
      }
    );
    chatCanaisPublicosSub.current = subCanaisPublicos;

    return ()=>{
      cancelado = true;
      Object.values(chatSubsRef.current).forEach(s=>{ try{ chat.desassinarCanal(s); }catch(e){} });
      chatSubsRef.current = {};
      if(chatMembrosSub.current){ try{ chat.desassinarCanal(chatMembrosSub.current); }catch(e){} chatMembrosSub.current=null; }
      if(chatCanaisPublicosSub.current){ try{ chat.desassinarCanal(chatCanaisPublicosSub.current); }catch(e){} chatCanaisPublicosSub.current=null; }
    };
  },[user?.id, assinarCanalGlobal, chatSelecionarCanal]);

  // ── Carregar dados do Supabase ao iniciar ──
  useEffect(() => {
    async function carregarTudo() {
      try {
        const [p, u, s] = await Promise.all([
          db.projetos.listar(),
          db.usuarios.listar(),
          db.sessoes.listar(),
        ]);
        const vistos = new Set();
        setProjetos(p.filter(x => { if(vistos.has(x.id)) return false; vistos.add(x.id); return true; }));
        const listaUsuarios = u.length > 0 ? u : USUARIOS_PADRAO;
        setUsuarios(listaUsuarios);
        // Atualiza dados do usuário logado se já estiver logado
        setUser(current => {
          if(!current) return current;
          const atualizado = listaUsuarios.find(x=>x.id===current.id);
          if(atualizado) {
            // Garantir formato correto de expediente
            const u = {...atualizado, expediente: expedienteParaDiaSemana(atualizado.expediente)};
            localStorage.setItem("intec_user_logado", JSON.stringify(u));
            return u;
          }
          return current;
        });
        // Junta com o que ainda não foi confirmado pelo banco (fila local)
        const cache = syncHoras.lerCache();
        if(s.length===0 && cache.length>0) {
          // Banco veio vazio mas este computador tem registros: não apaga nada, mostra o cache e reenvia
          console.warn("[banco de horas] servidor retornou 0 sessões; usando cópia local e reenviando", cache.length);
          syncHoras.reenviar(cache);
          setRegistros(syncHoras.mesclar(cache));
        } else {
          setRegistros(syncHoras.mesclar(s));
        }
      } catch(e) {
        console.error("Erro ao carregar Supabase:", e);
        // Fallback para localStorage se Supabase falhar
        const lp = localStorage.getItem("intec_projetos");
        const lu = localStorage.getItem("intec_usuarios");
        const ls = localStorage.getItem("intec_horas");
        if(lp) { try { setProjetos(JSON.parse(lp)); } catch{} }
        if(lu) { try {
          const us = JSON.parse(lu);
          // Normalizar expediente de cada usuário ao carregar do localStorage
          setUsuarios(us.map(u=>({...u, expediente: normalizarExpediente(u.expediente)})));
        } catch{} }
        if(ls) { try { setRegistros(syncHoras.mesclar(JSON.parse(ls))); } catch{} }
        else setRegistros(syncHoras.mesclar([]));
      } finally {
        setCarregando(false);
      }
    }
    carregarTudo();
  }, []);

  // ── Realtime: atualiza dados automaticamente quando outro usuário faz mudanças ──
  useEffect(() => {
    const cleanup = iniciarRealtime({
      onProjetosChange: async (payload) => {
        // Recarrega lista completa de projetos
        try {
          const p = await db.projetos.listar();
          const vistos = new Set();
          setProjetos(p.filter(x => { if(vistos.has(x.id)) return false; vistos.add(x.id); return true; }));
        } catch(e) { console.error("Realtime projetos:", e); }
      },
      onSessoesChange: async (payload) => {
        // Atualiza só a sessão modificada para não recarregar tudo
        try {
          if(payload.eventType === "DELETE") {
            setRegistros(r => r.filter(x => x.id !== payload.old?.id));
          } else {
            const s = await db.sessoes.listar();
            setRegistros(syncHoras.mesclar(s));
          }
        } catch(e) { console.error("Realtime sessoes:", e); }
      },
    });
    return cleanup; // cleanup ao desmontar
  }, []);

  // ── Banco de horas: cópia local sempre atualizada + reenvio automático ──
  useEffect(() => { if(!carregando) syncHoras.salvarCache(registros); }, [registros, carregando]);
  useEffect(() => { syncHoras.iniciarSincronizacaoAutomatica(); }, []);
  const [statusHoras, setStatusHoras] = useState(syncHoras.getStatus());
  useEffect(() => syncHoras.onStatus(setStatusHoras), []);

  // ── Timer central de notificações (30min) ──────────────────────────────────
  useEffect(()=>{
    if(!user) return;

    const verificarTudo = () => {
      const u        = userRef.current;
      const regs     = registrosRef.current;
      const projs    = projetosRef.current;
      if (!u) return;

      const agora    = new Date();
      const hojeISO  = agora.toISOString().slice(0,10);
      const dow      = agora.getDay(); // 0=dom,5=sex,6=sab
      const horaAtual= agora.toTimeString().slice(0,5);

      // ── 1. VERIFICAÇÃO DE SESSÃO ATIVA ──────────────────────────────────
      const sessaoAberta = regs.find(r=>r.usuarioId===u.id&&!r.horaFim);
      if (sessaoAberta) {
        // Verificar se o usuário já respondeu este aviso na última hora
        // Persiste no localStorage para sobreviver a recarregamentos de página
        const chaveAviso = `intec_aviso_respondido_${u.id}`;
        const ultimoResposto = parseInt(localStorage.getItem(chaveAviso)||"0");
        const umHoraAtras = Date.now() - CHECK_INTERVAL;
        if (ultimoResposto > umHoraAtras) return; // já respondeu, aguardar 1h

        setModalH(prev => {
          if (prev) return prev; // já tem modal aberto, mantém
          notificarSistema(
            "⏰ WM — Verificação de Atividade",
            `Olá, ${u.nome}! Você ainda está trabalhando no projeto?`,
            "intec-atividade", 15000
          );
          return "aviso";
        });
      }

      // ── 2. LEMBRETE DE SESSÃO NÃO INICIADA (em horário comercial) ───────
      if (!sessaoAberta) {
        const [hh, mm] = horaAtual.split(":").map(Number);
        const dentroDoExpediente = (() => {
          if (!u.expediente) return hh >= 9 && hh < 18;
          if (u.expediente.segunda) {
            const dias = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
            const diaExp = u.expediente[dias[dow]];
            if (!diaExp?.ativo) return false;
            const ini = diaExp.turno1?.inicio ? parseInt(diaExp.turno1.inicio) : 9;
            const fim = diaExp.turno2?.ativo ? parseInt(diaExp.turno2.fim||"18") : parseInt(diaExp.turno1?.fim||"18");
            return hh >= ini && hh < fim;
          }
          return hh >= 9 && hh < 18;
        })();
        if (dentroDoExpediente && dow >= 1 && dow <= 5) {
          notificarSistema(
            "📋 WM — Sessão não iniciada",
            `${u.nome}, você está no horário de trabalho mas sem sessão ativa. Não esqueça de registrar!`,
            "intec-sem-sessao", 12000
          );
        }
      }

      // ── 3. LEMBRETE DO LIXO — toda sexta ────────────────────────────────
      if (dow === 5) {
        try {
          const dadosLixo = JSON.parse(localStorage.getItem("intec_escala_lixo")||"{}");
          if (dadosLixo.membros && dadosLixo.dataInicio) {
            const ini = new Date(dadosLixo.dataInicio+"T12:00:00");
            const diffSem = Math.round((agora - ini) / (7*24*60*60*1000));
            const idx = ((diffSem % dadosLixo.membros.length) + dadosLixo.membros.length) % dadosLixo.membros.length;
            const responsavel = dadosLixo.membros[idx];
            const chave = `lixo-${hojeISO}`;
            notificarUmaVez(
              chave,
              "🗑 WM — Coleta de Lixo",
              `Esta semana é a vez de ${responsavel} tirar o lixo!`,
              "intec-lixo"
            );
          }
        } catch(e) {}
      }

      // ── 4. PROJETOS VENCENDO ESTA SEMANA ────────────────────────────────
      if (projs && projs.length > 0) {
        const criticos = projs.filter(p => {
          if (!p.dataEntregaPrevista) return false;
          if (["CONCLUÍDO","CANCELADO"].includes(p.status)) return false;
          // Só os projetos que o usuário é responsável
          const ehResp = p.responsavel===u.nome || p.coresponsavel===u.nome ||
                         p.coresponsavel2===u.nome || p.coresponsavel3===u.nome;
          if (!ehResp && u.perfil==="colaborador") return false;
          const dias = Math.ceil((new Date(p.dataEntregaPrevista) - agora) / 86400000);
          return dias >= 0 && dias <= 7;
        });
        if (criticos.length > 0) {
          const chave = `prazo-${hojeISO}-${criticos.map(p=>p.id).join(",")}`;
          const nomes = criticos.map(p=>p.codigo).join(", ");
          notificarUmaVez(
            chave,
            `⚠️ WM — ${criticos.length} projeto(s) vencendo esta semana`,
            `Prazo próximo: ${nomes}. Acesse o sistema para verificar.`,
            "intec-prazo"
          );
        }
      }

      // ── 5. REVISÃO DE PROJETOS — toda sexta ─────────────────────────────
      if (dow === 5) {
        try {
          const dadosRevisao = JSON.parse(localStorage.getItem("intec_escala_revisao")||"{}");
          if (dadosRevisao.membros && dadosRevisao.dataInicio) {
            const ini = new Date(dadosRevisao.dataInicio+"T12:00:00");
            const diffSem = Math.round((agora - ini) / (7*24*60*60*1000));
            const idx = ((diffSem % dadosRevisao.membros.length) + dadosRevisao.membros.length) % dadosRevisao.membros.length;
            const responsavel = dadosRevisao.membros[idx];
            const chave = `revisao-${hojeISO}`;
            notificarUmaVez(
              chave,
              "🔍 WM — Revisão de Projetos",
              `Esta semana a revisão de projetos é responsabilidade de ${responsavel}.`,
              "intec-revisao"
            );
            // Notificar o próprio responsável especialmente
            if (responsavel === u.nome) {
              notificarUmaVez(
                `revisao-voce-${hojeISO}`,
                "🔍 WM — É a sua vez de revisar!",
                `${u.nome}, hoje é sexta e esta semana a revisão de projetos é sua. Não esqueça!`,
                "intec-revisao-voce"
              );
            }
          }
        } catch(e) {}
      }
    };

    // Roda APENAS a cada 1 hora — não dispara ao logar/recarregar
    timerRef.current = setInterval(verificarTudo, CHECK_INTERVAL);
    return()=>{ clearInterval(timerRef.current); };
  },[user]); // NÃO depende de estado — usa refs

  // Verificação fim de expediente (a cada 30s para maior precisão)
  // Usa refs para sempre ter registros e encerrar atualizados — evita stale closure
  useEffect(()=>{
    if(!user) return;
    expRef.current = setInterval(()=>{
      const agora = new Date().toTimeString().slice(0,5);
      const fim   = fimExpediente(user.expediente);
      if(!fim || agora < fim) return;

      const regsAtuais = registrosRef.current;
      const aberta = regsAtuais.find(r => r.usuarioId===user.id && !r.horaFim);
      if(!aberta) return;

      // NÃO encerrar se a sessão foi iniciada fora do expediente (hora extra)
      if(aberta.horaExtra) return;
      // NÃO encerrar se a sessão começou depois do fim do expediente
      if(aberta.horaInicio >= fim) return;

      const [fh,fm] = fim.split(":").map(Number);
      const [ah,am] = agora.split(":").map(Number);
      const diff = (ah*60+am) - (fh*60+fm);

      if(diff === 0){
        // Exatamente na hora — mostra modal para o usuário encerrar
        setModalH("encerramento");
      } else if(diff >= 5){
        // 5+ minutos após o expediente sem resposta — encerra automaticamente
        if(encerrarRef.current) {
          // Bug 3/4: pegar sessão ANTES de encerrar para o email
          const uAtual = registrosRef.current.find(r => r.usuarioId === user.id && !r.horaFim);
          encerrarRef.current(fim, "Encerrado automaticamente pelo sistema");
          notificarSistema(
            "⏹ WM — Sessão Encerrada",
            `Sua sessão foi encerrada automaticamente às ${fim}. Expediente finalizado!`,
          );
          if(uAtual) {
            const proj = uAtual.projetoId
              ? `Projeto ${uAtual.projetoId}`
              : (uAtual.categoriaAdmin || "Atividade administrativa");
            enviarEmail("encerramento_auto", {
              colaborador: user.nome,
              email: user.email,
              projetoOuAtividade: proj,
              horaInicio: uAtual.horaInicio,
              horaFim: fim,
            }).catch(()=>{});
          }
        }
      }
    }, 30000); // verifica a cada 30 segundos
    return()=>clearInterval(expRef.current);
  },[user]); // NÃO depende de registros — usa ref

  const sessaoAtiva=registros.find(r=>r.usuarioId===user?.id&&!r.horaFim);

  // ── Sessões ──
  // ── INICIAR SESSÃO ─────────────────────────────────────────────────────────
  // Bug fix: bloqueia início se já existe sessão aberta do mesmo usuário
  const iniciar = async (projetoId, hi, obsInicio, categoriaAdmin=null) => {
    const jaAberta = registrosRef.current.find(r => r.usuarioId===user.id && !r.horaFim);
    if (jaAberta) {
      console.warn("Já existe sessão aberta, ignorando iniciar()");
      setModalH(null);
      return;
    }
    const dataHoje = new Date().toISOString().slice(0,10);
    const uExp = usuarios.find(u2=>u2.id===user.id)?.expediente;
    const fim  = fimExpediente(uExp);
    // Sessão iniciada fora do expediente (antes, intervalo, depois, folga) = hora extra
    const foraExp = verificarForaExpediente(hi, uExp);
    const eHoraExtra = !!foraExp;
    const nova = {
      id: Date.now().toString(),
      usuarioId:      user.id,
      projetoId:      projetoId||null,
      categoriaAdmin: categoriaAdmin||null,
      data:           dataHoje,
      horaInicio:     hi,
      horaFim:        null,
      duracaoMin:     null,
      minutosExtras:  0,
      inicioTs:       Date.now(),
      obsInicio:      obsInicio||"",
      obsFim:         "",
      obs:            obsInicio||"",
      horaExtra:      eHoraExtra || false,
    };
    // Atualizar estado e ref imediatamente — evita race condition
    setRegistros(prev => { const novo = [...prev, nova]; registrosRef.current = novo; return novo; });
    setModalH(null);
    syncHoras.salvar(nova);
  };

  // ── ENCERRAR SESSÃO ─────────────────────────────────────────────────────────
  // Bug fix: usa ID fixo da sessão, não busca por !horaFim no momento do setState
  const encerrar = async (hf, obsFim) => {
    // Pegar a sessão aberta ANTES de qualquer setState
    const sessaoAberta = registrosRef.current.find(r => r.usuarioId===user.id && !r.horaFim);
    if (!sessaoAberta) {
      console.warn("Nenhuma sessão aberta para encerrar");
      setModalH(null);
      return;
    }

    const sessaoId  = sessaoAberta.id;
    const horaInicio= sessaoAberta.horaInicio;
    const dataS     = sessaoAberta.data;
    const uExp      = usuarios.find(u2=>u2.id===user.id)?.expediente;
    const dur       = Math.max(0, horaMin(hf) - horaMin(horaInicio));
    const {minutosExtras} = verificarHoraExtra(horaInicio, hf, uExp, dataS);
    const sessaoFechada = {
      ...sessaoAberta,
      horaFim:       hf,
      duracaoMin:    dur,
      minutosExtras,
      obsFim:        obsFim||"",
      obs:           sessaoAberta.obsInicio||sessaoAberta.obs||"",
    };

    // Bug 1 e 3: atualizar estado e ref atomicamente pelo ID — nunca pelo !horaFim
    setRegistros(prev => {
      const novo = prev.map(r => r.id===sessaoId ? sessaoFechada : r);
      registrosRef.current = novo; // manter ref sincronizada
      return novo;
    });
    setModalH(null);

    // Persistir no banco
    // Grava a sessão completa (upsert): se o início não tinha chegado ao banco, cria agora
    syncHoras.salvar(sessaoFechada);
  };

  // Atualizar ref da função encerrar para o timer sempre usar a versão mais recente
  encerrarRef.current = encerrar;

  // Verificação de projetos críticos (roda 1x ao logar e a cada 6h)
  useEffect(() => {
    if (!user || !["admin","gestor"].includes(user.perfil)) return;
    const verificarCriticos = () => {
      const criticos = projetos.filter(p => {
        if (!p.dataEntregaPrevista) return false;
        if (["CONCLUÍDO","CANCELADO"].includes(statusN(p.status))) return false;
        const dias = Math.ceil((new Date(p.dataEntregaPrevista) - new Date()) / 86400000);
        return dias <= 7 && dias >= -30;
      });
      if (criticos.length > 0) {
        // Agrupa por responsável e envia email
        const porResp = {};
        criticos.forEach(p => {
          const resp = p.responsavel || "—";
          if (!porResp[resp]) porResp[resp] = [];
          porResp[resp].push({
            codigo: p.codigo,
            cliente: p.cliente,
            responsavel: p.responsavel,
            dias: Math.ceil((new Date(p.dataEntregaPrevista) - new Date()) / 86400000),
          });
        });
        Object.entries(porResp).forEach(([responsavel, projResp]) => {
          const uResp = usuarios.find(u => u.nome === responsavel);
          enviarEmail("projetos_vencendo", {
            destinatario: responsavel,
            emailResponsavel: uResp?.email || null,
            projetos: projResp,
          }).catch(()=>{});
        });
      }
    };
    // Roda 1x ao logar (com delay de 5s para não sobrecarregar)
    const t1 = setTimeout(verificarCriticos, 5000);
    // Roda a cada 6h
    const t2 = setInterval(verificarCriticos, 6 * 60 * 60 * 1000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [user?.id, projetos.length]);

  const mudar=(pid)=>{
    const h=new Date().toTimeString().slice(0,5);
    encerrar(h,"Mudou de projeto");
    setTimeout(()=>iniciar(pid,h,""),200);
  };

  // ── Projetos ──
  const abrirP = p => setModal({projeto:p, modo:"editar"});

  // Foto do usuário logado (menu do usuário e Configurações)
  const alterarFoto = async (arquivo) => {
    const foto = arquivo ? await prepararFoto(arquivo) : "";
    await db.usuarios.salvarFoto(user.id, foto, usuarios.find(x => x.id === user.id) || user);
    const u = { ...user, foto };
    setUser(u);
    try { localStorage.setItem("intec_user_logado", JSON.stringify(u)); } catch { /* sem espaço */ }
    setUsuarios(us => us.map(x => x.id === u.id ? { ...x, foto } : x));
  };

  // ── Fluxo orçamento → contrato → projeto ──
  const [orcParaContrato, setOrcParaContrato] = useState(null);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || e.data?.tipo !== "wm-gerar-contrato") return;
      setOrcParaContrato(e.data.orcamentoId); setAba("contratos");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  // Projeto criado/atualizado pelo contrato assinado
  const salvarProjetoFluxo = async (proj, novo) => {
    const n = { ...proj, status: proj.statusAuto ? calcStatusAuto(proj) : proj.status };
    projetosRef.current = novo ? [...(projetosRef.current||[]).filter(x=>x.id!==n.id), n] : (projetosRef.current||[]).map(x => x.id===n.id ? n : x);
    setProjetos(ps => novo ? [...ps.filter(x=>x.id!==n.id), n] : ps.map(x => x.id===n.id ? n : x));
    await db.projetos.salvar(n);
    return n;
  };
  const abrirProjetoPorId = (id) => {
    const p = (projetosRef.current||[]).find(x => x.id===id);
    if (p) { setAba("projetos"); setModal({projeto:p, modo:"editar"}); }
  };
  const novoP  = () => setModal({projeto:null, modo:"novo"});

  const salvarP = async (f) => {
    const c = f.codigo?.trim(); if(!c) return;
    const n = {
      ...f,
      id: c,
      // Recalcular status automático se ativo
      status:             f.statusAuto ? calcStatusAuto(f) : f.status,
      // Sincronizar campos do portal explicitamente
      progresso:          f.progresso          ?? 0,
      obs_cliente:        f.obsCliente         ?? f.obs_cliente ?? "",
      obsCliente:         f.obsCliente         ?? f.obs_cliente ?? "",
      linkClienteAtivo:   f.linkClienteAtivo   ?? f.link_cliente_ativo ?? false,
      link_cliente_ativo: f.linkClienteAtivo   ?? f.link_cliente_ativo ?? false,
      token_cliente:      f.tokenCliente       || f.token_cliente || "",
    };
    if(modal.modo==="novo") setProjetos(p=>[...p,n]);
    else setProjetos(p=>p.map(x=>x.id===modal.projeto.id?n:x));
    setModal(null);
    try {
      await db.projetos.salvar(n);
    } catch(e){ console.error("Erro salvar projeto:", e); }
  };

  const excluirP = async (id) => {
    if(!window.confirm("Excluir?")) return;
    setProjetos(p=>p.filter(x=>x.id!==id));
    setModal(null);
    try { await db.projetos.excluir(id); } catch(e){ console.error("Erro excluir projeto:", e); }
  };

  const importar = async (ns) => {
    const ids = new Set(projetos.map(x=>x.id));
    const cs  = new Set(projetos.map(x=>x.codigo?.trim().toUpperCase()));
    const novos = ns.filter(x=>!ids.has(x.id)&&!cs.has(x.codigo?.trim().toUpperCase()));
    setProjetos(p=>[...p,...novos]);
    for(const n of novos) {
      try { await db.projetos.salvar(n); } catch(e){ console.error("Erro importar:", e); }
    }
  };

  // ── Usuários ──
  const salvarUsuarios = async (lista) => {
    setUsuarios(lista);
    for(const u of lista) {
      try { await db.usuarios.salvar(u); } catch(e){ console.error("Erro salvar usuario:", e); }
    }
  };

  const fazerLogin = (u) => {
    const uBase = { ...(usuarios.find(x=>x.id===u.id) || {}), ...u };
    // Garantir que o expediente está no formato por dia da semana
    const uAtualizado = {...uBase, expediente: expedienteParaDiaSemana(uBase.expediente)};
    setUser(uAtualizado);
    localStorage.setItem("intec_user_logado", JSON.stringify(uAtualizado));
    pedirPermissaoNotificacao();
    setTimeout(()=>setModalH("checkin"),600);
  };
  const fazerLogout = () => {
    localStorage.removeItem("intec_user_logado");
    setUser(null);
    authClient.auth.signOut().catch(()=>{});
  };

  // ── Central de lembretes e tarefas ──
  const central = useCentral({ supabase, user, usuarios, projetos, registros });
  const push = usePush({ supabase, user });
  useAvisosAbertos(central.meus);
  const [tarefaFoco, setTarefaFoco] = useState(null);
  const [obraFoco, setObraFoco] = useState(null);
  const abrirLembrete = (lk) => {
    if (!lk) return;
    if (lk.projetoId) { const p = projetos.find(x => x.id === lk.projetoId); if (p) setModal({ projeto:p, modo:"editar" }); return; }
    if (lk.obraId) { setObraFoco(lk.obraId); setAba("obras"); return; }
    if (lk.tarefaId) { setTarefaFoco(lk.tarefaId); setAba("tarefas"); return; }
    if (lk.aba) setAba(lk.aba);
  };

  // ── Login com Google (Supabase Auth) ──
  const [authStatus, setAuthStatus] = useState("verificando"); // verificando | fora | dentro
  const [authEmail,  setAuthEmail]  = useState("");
  const [authErro,   setAuthErro]   = useState("");
  useEffect(() => {
    let vivo = true;
    authClient.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setAuthEmail(normEmail(data.session?.user?.email));
      setAuthStatus(data.session ? "dentro" : "fora");
    }).catch(() => { if (vivo) setAuthStatus("fora"); });
    const { data: sub } = authClient.auth.onAuthStateChange((_ev, session) => {
      setAuthEmail(normEmail(session?.user?.email));
      setAuthStatus(session ? "dentro" : "fora");
    });
    return () => { vivo = false; sub?.subscription?.unsubscribe(); };
  }, []);
  const entrarComGoogle = async (dica) => {
    setAuthErro("");
    const { error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: dica ? { login_hint: dica } : { prompt: "select_account" } },
    });
    if (error) { setAuthErro("Não foi possível abrir o login do Google: " + error.message); throw error; }
  };
  // Vincula a conta Google a um usuário do sistema
  useEffect(() => {
    if (carregando || authStatus === "verificando") return;
    if (authStatus === "fora") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (user) { localStorage.removeItem("intec_user_logado"); setUser(null); }
      return;
    }
    const email = authEmail;
    if (!email) return;
    const b = ACESSOS_GOOGLE[email];
    const provisorios = Object.values(ACESSOS_GOOGLE).map(x => x.id);
    // Já logado com o cadastro certo: nada a fazer. Com id provisório (ex.: "jonathan"), refaz o vínculo.
    if (user && normEmail(user.email) === email && !(provisorios.includes(user.id) && usuarios.some(x => !provisorios.includes(x.id) && x.ativo !== false &&
      (normEmail(x.email) === email || (b && normNome(x.nome).split(" ")[0] === normNome(b.nome).split(" ")[0]))))) return;
    // Sempre preferir o cadastro que já existe no banco (com o id original): as horas,
    // tarefas e projetos estão ligados a esse id. Busca por id, e-mail e, por fim, nome.
    const todosAtivos = usuarios.filter(x => x.ativo !== false);
    const reais = todosAtivos.filter(x => !provisorios.includes(x.id));
    const ativos = reais.length ? reais : todosAtivos;
    const primeiroNome = n => normNome(n).split(" ")[0];
    let u = null;
    // e-mail só vale se for a mesma pessoa (mesmo nome ou mesmo perfil): no cadastro antigo o
    // e-mail da WM estava no usuário do Vinicius
    if (b) u = ativos.find(x => normEmail(x.email) === email && (primeiroNome(x.nome) === primeiroNome(b.nome) || x.perfil === b.perfil))
      || ativos.find(x => normNome(x.nome) === normNome(b.nome))
      || (ativos.filter(x => primeiroNome(x.nome) === primeiroNome(b.nome)).length === 1 ? ativos.find(x => primeiroNome(x.nome) === primeiroNome(b.nome)) : null)
      || todosAtivos.find(x => x.id === b.id);
    else u = ativos.find(x => normEmail(x.email) === email);
    if (!u && !b) {
      setAuthErro(`A conta ${email} não tem acesso ao sistema. Peça a um administrador para cadastrar este e-mail em Configurações → Colaboradores.`);
      authClient.auth.signOut();
      return;
    }
    if (!u) {
      // Usuário novo: id no mesmo formato do banco (uuid), senão as gravações são recusadas
      const novoId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : b.id;
      u = { id: novoId, nome: b.nome, email, perfil: b.perfil, cor: b.cor,
        iniciais: b.nome.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase(),
        ativo: true, salario: 0, expediente: expedientePadrao(), especialidades: [] };
    } else if (normEmail(u.email) !== email) {
      u = { ...u, email };
    }
    const lista = usuarios.some(x => x.id === u.id) ? usuarios.map(x => x.id === u.id ? u : x) : [...usuarios, u];
    if (JSON.stringify(lista) !== JSON.stringify(usuarios)) {
      setUsuarios(lista);
      db.usuarios.salvar(u).catch(e => console.error("Erro ao vincular usuário:", e));
    }
    // Horas registradas com o id provisório antigo (ex.: "jonathan") passam para o id certo
    if (b && b.id !== u.id) {
      syncHoras.remapearUsuario(b.id, u.id);
      setRegistros(rs => rs.some(r => r.usuarioId === b.id) ? rs.map(r => r.usuarioId === b.id ? { ...r, usuarioId: u.id } : r) : rs);
    }
    setAuthErro("");
    try { localStorage.setItem("wm-ultima-conta", JSON.stringify({ email, nome: u.nome })); } catch { /* sem armazenamento */ }
    fazerLogin(u);
  }, [carregando, authStatus, authEmail, usuarios]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tela de carregamento
  if(carregando) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.azulEscuro},${C.azulMedio})`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <img src="/Logo_Sem_Fundo.png" alt="WM Engenharia" style={{height:44,objectFit:"contain",filter:"brightness(0) invert(1)"}}/>
      <div style={{color:"rgba(255,255,255,0.7)",fontSize:14}}>Carregando dados...</div>
    </div>
  );

  if(!user || authStatus!=="dentro") return <TelaLogin estado={authStatus} erro={authErro} onGoogle={entrarComGoogle}/>;

  const isAdmin    = user.perfil === "admin";
  const isGestorOuAdmin = ["admin","gestor"].includes(user.perfil);
  const isColab    = user.perfil === "colaborador";



  // Menu lateral
  const abasMenu=[
    {id:"dashboard",  label:"Dashboard",     icone:"painel",      grupo:"principal"},
    {id:"projetos",   label:"Projetos",      icone:"pasta",       grupo:"principal"},
    ...(!isColab ? [{id:"financeiro", label:"Financeiro", icone:"grafico", grupo:"principal"}] : []),
    {id:"horas",      label:"Horas",         icone:"relogio",     grupo:"principal"},
    {id:"agenda",     label:"Agenda",        icone:"agenda",      grupo:"principal"},
    ...(!isColab ? [{id:"contratos",  label:"Contratos",  icone:"documento",   grupo:"principal"}] : []),
    ...(!isColab ? [{id:"orcamentos", label:"Orçamentos", icone:"calculadora", grupo:"principal"}] : []),
    {id:"obras",      label:"Obras",         icone:"capacete",    grupo:"principal"},
    {id:"tarefas",    label:"Tarefas",       icone:"tarefa",      grupo:"principal"},
    {id:"calculadoras", label:"Calculadoras", icone:"regua",      grupo:"principal"},
    {id:"relatorios", label:"Relatórios",    icone:"relatorio",   grupo:"principal"},
    {id:"config",     label:"Configurações", icone:"config",      grupo:"config"},
    {id:"ajuda",      label:"Ajuda",         icone:"ajuda",       grupo:"config"},
  ];



  return(
    <div className={"wm-shell"+(menuAberto?" menu-aberto":"")}>
      <div className="wm-fundo-menu" onClick={()=>setMenuAberto(false)}/>
      {/* ── MENU LATERAL ── */}
      <aside className="wm-sidebar" aria-label="Menu principal">
        <div className="wm-logo"><img src="/Logo_Branco.png" alt="WM Engenharia"/></div>
        <nav className="wm-nav">
          {abasMenu.filter(a=>a.grupo!=="config").map(a=>{
            const ativo = aba===a.id;
            return <button key={a.id} className={"wm-nav-item"+(ativo?" ativo":"")} aria-current={ativo?"page":undefined}
              onClick={()=>{setAba(a.id);setMenuAberto(false);}}>
              <Icone nome={a.icone} tam={21}/><span>{a.label}</span>
            </button>;
          })}
        </nav>
        <div className="wm-nav-rodape">
          {abasMenu.filter(a=>a.grupo==="config"&&a.id!=="ajuda").map(a=>(
            <button key={a.id} className={"wm-nav-item"+(aba===a.id?" ativo":"")} onClick={()=>{setAba(a.id);setMenuAberto(false);}}>
              <Icone nome={a.icone} tam={21}/><span>{a.label}</span>
            </button>
          ))}
          <button className="wm-nav-item" onClick={()=>{if(window.confirm("Sair do sistema?"))fazerLogout();}}>
            <Icone nome="sair" tam={21}/><span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="wm-coluna">
        {/* ── BARRA SUPERIOR ── */}
        <header className="wm-topo">
          <button className="wm-icone-btn wm-hamburguer" onClick={()=>setMenuAberto(m=>!m)} aria-label="Abrir menu"><Icone nome="menu"/></button>
          <BuscaGlobal projetos={projetos} tarefas={central.tarefas||[]} abas={abasMenu} onAbrirProjeto={abrirP} onIrPara={setAba}
            onAbrirTarefa={id=>{setTarefaFoco(id);setAba("tarefas");}}/>
          <div className="wm-topo-acoes">
            {pwaPrompt&&!pwaInstalado&&(
              <button className="wm-icone-btn wm-esconde-celular" onClick={instalarPWA} title="Instalar como aplicativo" aria-label="Instalar como aplicativo"><Icone nome="instalar"/></button>
            )}
            {sessaoAtiva
              ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span className="wm-esconde-celular" style={{display:"inline-flex",alignItems:"center",gap:6,background:"#ecfdf3",color:C.verde,border:"1px solid #bbf7d0",borderRadius:20,padding:"6px 12px",fontSize:12.5,fontWeight:700}}>
                    <span style={{width:8,height:8,borderRadius:4,background:C.verde}}/>Sessão ativa</span>
                  <button className="wm-icone-btn" onClick={()=>setModalH("encerramento")} title="Encerrar sessão" aria-label="Encerrar sessão" style={{color:C.vermelho}}><Icone nome="stop" tam={18}/></button>
                </div>
              : <button className="wm-btn" onClick={()=>setModalH("checkin")} style={{display:"inline-flex",alignItems:"center",gap:6,background:C.azulMedio,color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13.5,cursor:"pointer"}}>
                  <Icone nome="play" tam={15}/><span className="wm-esconde-celular">Iniciar sessão</span></button>}
            <SinoNotificacoes central={central} push={push} user={user} usuarios={usuarios} projetos={projetos}
              onAbrir={abrirLembrete} onVerTarefas={()=>setAba("tarefas")} gestor={["admin","gestor"].includes(user.perfil)}/>
            <button className="wm-icone-btn" onClick={()=>setAba("ajuda")} aria-label="Ajuda e tutoriais" style={aba==="ajuda"?{background:"#e9f1fd",color:C.azulMedio}:undefined}>
              <Icone nome="ajuda" tam={21}/><span className="wm-esconde-celular">Ajuda</span>
            </button>
            <MenuUsuario user={user} onConfig={()=>setAba("config")} onFoto={alterarFoto} onSair={()=>{if(window.confirm("Sair do sistema?"))fazerLogout();}}/>
          </div>
        </header>
      {statusHoras.pendentes>0 && statusHoras.erro && (
        <div style={{background:"#FEF3C7",borderBottom:"1px solid #F59E0B",color:"#7C2D12",padding:"8px 20px",fontSize:13,display:"flex",gap:12,alignItems:"center",justifyContent:"center",flexWrap:"wrap",position:"relative",zIndex:201}}>
          <span>⚠️ <b>{statusHoras.pendentes} registro(s) de horas ainda não foram salvos no servidor</b> — estão guardados neste computador e serão reenviados automaticamente. Motivo: {statusHoras.erro}</span>
          <button onClick={()=>syncHoras.sincronizar()} disabled={statusHoras.sincronizando}
            style={{background:"#B45309",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
            {statusHoras.sincronizando?"Enviando…":"Tentar agora"}
          </button>
        </div>
      )}
        <main className={"wm-conteudo"+((aba==="obras"||aba==="orcamentos")?" wm-conteudo-cheio":"")}>
          <Suspense fallback={<CarregandoPagina/>}>
            {CABECALHOS[aba]&&<CabecalhoPagina {...CABECALHOS[aba]}/>} 
        {aba==="dashboard" &&<Dashboard projetos={projetos} onAbrirProjeto={abrirP} drive={drive} onImportar={importar} usuarioAtual={user} onIrPara={setAba}/>}
        {aba==="projetos"  &&<ListaProjetos projetos={projetos} onAbrirProjeto={abrirP} onNovoProjeto={novoP} usuarios={usuarios} usuarioAtual={user}/>}
        {aba==="financeiro"&&<Financeiro projetos={projetos}/>}
        {aba==="horas"     &&<AbaHoras registros={registros} setRegistros={setRegistros} usuarios={usuarios} projetos={projetos} usuarioAtual={user} calendario={calendario} onAbrirEncerramento={()=>setModalH("encerramento")}/>}
        {aba==="agenda"    &&<AbaAgenda calendario={calendario} usuarioAtual={user} registros={registros} usuarios={usuarios}/>}
        {aba==="config"    &&<Configuracoes usuarios={usuarios} onSalvarUsuarios={salvarUsuarios} usuarioAtual={user} onFoto={alterarFoto}/>}
        {aba==="contratos"  &&<GeradorContratos projetos={projetos} usuarios={usuarios} usuarioAtual={user} drive={drive}
          onSalvarProjeto={salvarProjetoFluxo} onAbrirProjeto={abrirProjetoPorId}
          orcamentoInicial={orcParaContrato} onOrcamentoUsado={()=>setOrcParaContrato(null)}/>}
        {aba==="ajuda" && <PaginaAjuda usuarioAtual={user} irPara={setAba}/>}
        {aba==="calculadoras" && <PaginaCalculadoras/>}
        {aba==="relatorios" && <PaginaRelatorios projetos={projetos} usuarios={usuarios} registros={registros} tarefas={central.tarefas||[]} usuarioAtual={user}/>}
        {aba==="tarefas" && <PaginaTarefas central={central} user={user} usuarios={usuarios} projetos={projetos}
          gestor={["admin","gestor"].includes(user.perfil)} tarefaFoco={tarefaFoco} onFocoUsado={()=>setTarefaFoco(null)}/>}
        {aba==="obras" && (
          <div className="wm-frame">
            <iframe
              key={obraFoco||"obras"}
              src={obraFoco?`/obras.html?obra=${encodeURIComponent(obraFoco)}`:"/obras.html"}
              title="Obras"
              style={{width:"100%",height:"100%",border:"none",display:"block"}}
            />
          </div>
        )}
        {aba==="orcamentos" && (
          <div className="wm-frame">
            <iframe
              src="/orcamentos.html"
              title="Gerador de Orçamentos"
              style={{width:"100%",height:"100%",border:"none",display:"block"}}
            />
          </div>
        )}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
      {modal&&<ModalProjeto projeto={modal.projeto} modo={modal.modo} onClose={()=>setModal(null)} onSave={salvarP} onExcluir={excluirP} usuarios={usuarios}/>}

      {modalH&&<ModalHoras tipo={modalH} projetos={projetos} usuarioAtual={user} sessaoAtiva={sessaoAtiva} onIniciar={iniciar} onEncerrar={encerrar} onMudar={mudar} onFechar={acao=>{
  if(acao==="encerrar") {
    encerrar(new Date().toTimeString().slice(0,5),"Encerrado pelo colaborador");
  } else if(acao==="continuar_extra") {
    const agora = new Date().toTimeString().slice(0,5);
    const sessaoAtual = registrosRef.current.find(r=>r.usuarioId===user.id&&!r.horaFim);
    if(sessaoAtual){
      encerrar(agora, "Encerrado no fim do expediente — continuou em hora extra");
      setTimeout(()=>{ iniciar(sessaoAtual.projetoId, agora, sessaoAtual.obsInicio||"", sessaoAtual.categoriaAdmin); }, 500);
    }
    setModalH(null);
  } else {
    localStorage.setItem(`intec_aviso_respondido_${user.id}`, Date.now().toString());
    setModalH(null);
  }
}}/>}

      <ChatFlutuante
        usuario={user} usuarios={usuarios}
        aberto={chatAberto} onToggle={()=>setChatAberto(a=>!a)}
        pulsando={chatPulsando} temMencao={chatMencao} naoLidos={chatNaoLidos}
        canais={chatCanais} canalAtivo={chatCanalAtivo} mensagens={chatMensagens}
        onSelecionarCanal={chatSelecionarCanal}
        onEnviar={chatEnviar}
        onIniciarDM={chatIniciarDM}
        onCriarCanal={chatCriarCanal}
        onDeletarDM={chatDeletar}
      />
      </Suspense>
    </div>
  );
}
