import { useState, useEffect } from "react";
import { supabase, cabecalhoAuth } from "../supabase.js";
import CronogramaEditor from "../contratos/CronogramaEditor.jsx";
import { gerar as gerarCronograma, normalizar as normalizarCronograma, tabelaHTML as cronogramaTabelaHTML } from "../contratos/cronograma.js";
import AnexarContrato from "../fluxo/AnexarContrato.jsx";
import { pdfAssinadoDe, vendor as vendorAssinatura } from "../portal/assinaturaDados.js";
import SeletorOrcamento from "../fluxo/SeletorOrcamento.jsx";
import { orcamentoParaContrato } from "../fluxo/fluxo.js";
import PagamentoEditor from "../contratos/PagamentoEditor.jsx";
import { calcularPagamento, clausulaPagamento, parcelasDoForm, resumoPagamento } from "../contratos/pagamento.js";
import { Btn, C_CONTRATO, Card, DRIVE_ROOT_ID, InpC, SecC, SelC, TIPOS } from "../nucleo.jsx";
import Icone from "../ui/Icone.jsx";

// Escapa recursivamente todas as strings (números e booleanos ficam iguais)
const escTexto = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function escProfundo(v) {
  if (typeof v === "string") return escTexto(v);
  if (Array.isArray(v)) return v.map(escProfundo);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, escProfundo(x)]));
  return v;
}

export function GeradorContratos({ projetos, usuarios, usuarioAtual, drive, onSalvarProjeto, onAbrirProjeto, orcamentoInicial, onOrcamentoUsado }) {
  const C2 = C_CONTRATO;
  const [seletorOrc, setSeletorOrc] = useState(false);
  const [anexando, setAnexando] = useState(null);
  const [emitindo, setEmitindo] = useState(null);
  const [assin, setAssin] = useState(null); // situação da assinatura eletrônica do contrato aberto
  const [passo, setPasso] = useState(1);
  const [gerado, setGerado] = useState(false);
  const [lista, setLista] = useState([]);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [contratoId, setContratoId] = useState(null);
  const [msgSalvo, setMsgSalvo] = useState("");

  // Carregar lista de contratos salvos
  const carregarLista = async () => {
    try {
      const { data } = await supabase.from("contratos").select("id,titulo,criado_por,created_at,updated_at,dados").order("updated_at",{ascending:false});
      setLista(data||[]);
    } catch(e) { console.error(e); }
  };

  useEffect(()=>{ carregarLista(); },[]);

  // Salvar contrato
  const salvarContrato = async () => {
    setSalvando(true);
    const titulo = `${form.nomeCompleto||"Sem nome"} — ${new Date().toLocaleDateString("pt-BR")}`;
    let id = contratoId;
    try {
      if (contratoId) {
        const { error } = await supabase.from("contratos").update({ titulo, dados:form, updated_at: new Date().toISOString(), criado_por: usuarioAtual?.id }).eq("id", contratoId);
        if (error) throw error;
        setMsgSalvo("✅ Contrato atualizado!");
      } else {
        const { data, error } = await supabase.from("contratos").insert({ titulo, dados:form, criado_por: usuarioAtual?.id }).select().single();
        if (error) throw error;
        id = data?.id;
        setContratoId(id);
        setMsgSalvo("✅ Contrato salvo!");
      }
      // Contrato feito a partir de orçamento: o orçamento passa a apontar para ele
      const orcId = form._fluxo?.orcamentoId;
      if (orcId && id) {
        const { error:e2 } = await supabase.from("orcamentos").update({ contrato_id:String(id), status:"fechado", updated_at:new Date().toISOString() }).eq("id", orcId);
        if (e2) console.warn("Orçamento não vinculado:", e2);
      }
      carregarLista();
    } catch(e) {
      console.error("Erro ao salvar contrato:", e);
      const m = e?.message || String(e||"");
      const motivo = /permission|policy|row-level|42501/i.test(m) ? "o banco não deu permissão de gravar contratos (rode supabase/contratos_permissoes.sql no Supabase) — " + m
        : /Failed to fetch|NetworkError|network/i.test(m) ? "sem conexão com o servidor"
        : m;
      setMsgSalvo("❌ Erro ao salvar: " + motivo); id = null;
    }
    setSalvando(false);
    setTimeout(()=>setMsgSalvo(""), id ? 3000 : 12000);
    return id ? { id, titulo, dados:form } : null;
  };

  // Preenche um contrato novo com os dados de um orçamento (ou abre o contrato já gerado dele)
  const aplicarOrcamento = async (orc) => {
    setSeletorOrc(false);
    if (orc.contratoId) {
      const { data } = await supabase.from("contratos").select("id,titulo,criado_por,created_at,updated_at,dados").eq("id", orc.contratoId).maybeSingle();
      if (data) { carregarContrato(data); setMsgSalvo("✅ Contrato deste orçamento aberto"); setTimeout(()=>setMsgSalvo(""), 3000); return; }
    }
    const hj = new Date().toISOString().slice(0,10);
    const patch = orcamentoParaContrato(orc);
    setForm({
      tipoPessoa:"fisica", cpfCnpj:"", nomeCompleto:"", nacionalidade:"brasileiro(a)", estadoCivil:"solteiro(a)",
      endereco:"", email:"", servicos:[], descricaoEdificacao:"", areaTotal:"", numPavimentos:"",
      cidadeUF:"", enderecoObra:"", rodadasRevisao:"2", formatoEntrega:"PDF e DWG", adicionaisInclusos:"",
      naoInclusos:[], valorTotal:"", percEntrada:"50", dataContrato:hj, prazoExecucao:"65", prazoDocumentos:"5",
      cronograma:[], cidade:"Governador Valadares", dataAssinatura:hj,
      testemunha1Nome:"", testemunha1CPF:"", testemunha2Nome:"", testemunha2CPF:"",
      ...patch,
    });
    setContratoId(null); setMostrarLista(false); setGerado(false); setPasso(1);
    setMsgSalvo("✅ Dados do orçamento aplicados — complete CPF, endereço e testemunhas");
    setTimeout(()=>setMsgSalvo(""), 5000);
  };

  // Vindo do botão "Gerar contrato" da aba Orçamentos
  useEffect(() => {
    if (!orcamentoInicial) return;
    (async () => {
      const { data, error } = await supabase.from("orcamentos").select("*").eq("id", orcamentoInicial).maybeSingle();
      if (!error && data) aplicarOrcamento({ ...(data.dados||{}), id:data.id, status:data.status, contratoId:data.contrato_id, total:Number(data.total)||data.dados?.total||0 });
      else setMsgSalvo("❌ Orçamento não encontrado no banco");
      onOrcamentoUsado?.();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoInicial]);

  const abrirEmitir = async () => {
    const salvo = await salvarContrato();
    if (salvo) setEmitindo(salvo);
  };
  // Contrato emitido pelo portal: confere a situação e, quando assinado por todos, abre o "Anexar" já com o PDF assinado
  const verificarAssinatura = async (concluir) => {
    const a = form._fluxo?.assinatura; if (!a?.docId) return;
    setAssin({ carregando:true });
    try {
      const { data, error } = await supabase.from("documentos_assinatura").select("id,status,token,codigo,signatarios").eq("id", a.docId).maybeSingle();
      if (error) throw error;
      const { data:ass } = await supabase.from("documentos_assinaturas").select("signatario_id,nome,assinado_em").eq("documento_id", a.docId);
      const info = { status:data?.status || "?", feitas:(ass || []).length, total:(data?.signatarios || []).length, token:data?.token || a.token };
      setAssin(info);
      if (concluir && info.status === "assinado") {
        setAssin({ ...info, carregando:true });
        const r = await pdfAssinadoDe(info.token);
        const arquivo = new File([r.blob], `CONTRATO ASSINADO - ${form.nomeCompleto || "cliente"}.pdf`.replace(/[\\/:*?"<>|]/g, ""), { type:"application/pdf" });
        setAssin(info);
        setAnexando({ id:contratoId, titulo:`${form.nomeCompleto||"Contrato"}`, dados:form, arquivoInicial:arquivo });
      }
    } catch (e) { setAssin({ erro:e.message || String(e) }); }
  };

  const abrirAnexar = async (item) => {
    if (item) { setAnexando(item); return; }
    const salvo = await salvarContrato();   // garante que o contrato aberto está salvo
    if (salvo) setAnexando(salvo);
  };

  // Carregar contrato salvo
  const carregarContrato = async (item) => {
    const hj = new Date().toISOString().slice(0,10);
    const FORM_DEFAULT = {
      tipoPessoa:"fisica", cpfCnpj:"", nomeCompleto:"", nacionalidade:"brasileiro(a)", estadoCivil:"solteiro(a)",
      endereco:"", email:"", servicos:[], descricaoEdificacao:"", areaTotal:"", numPavimentos:"",
      cidadeUF:"", enderecoObra:"", rodadasRevisao:"2", formatoEntrega:"PDF e DWG", adicionaisInclusos:"",
      naoInclusos:["Projeto arquitetônico","Paisagismo / ar-condicionado / incêndio","Aprovação em órgãos públicos","Acompanhamento de obra"],
      valorTotal:"", percEntrada:"50", dataContrato:hj, prazoExecucao:"65", prazoDocumentos:"5",
      cronograma:[], cidade:"Governador Valadares", dataAssinatura:hj,
      testemunha1Nome:"", testemunha1CPF:"", testemunha2Nome:"", testemunha2CPF:"",
    };
    const dados = item.dados||{};
    setForm({...FORM_DEFAULT, ...dados, cronograma: normalizarCronograma(dados.cronograma)});
    setContratoId(item.id);
    setMostrarLista(false);
    setGerado(false);
    setPasso(1);
  };

  // Excluir contrato
  const excluirContrato = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Excluir este contrato?")) return;
    await supabase.from("contratos").delete().eq("id", id);
    carregarLista();
    if (contratoId === id) { setContratoId(null); }
  };
  const hoje = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState(()=>({
    tipoPessoa:"fisica", cpfCnpj:"", nomeCompleto:"", nacionalidade:"brasileiro(a)", estadoCivil:"solteiro(a)",
    endereco:"", email:"",
    servicos:[], descricaoEdificacao:"", areaTotal:"", numPavimentos:"", cidadeUF:"", enderecoObra:"",
    rodadasRevisao:"2", formatoEntrega:"PDF e DWG", adicionaisInclusos:"",
    naoInclusos:["Projeto arquitetônico","Paisagismo / ar-condicionado / incêndio","Aprovação em órgãos públicos","Acompanhamento de obra"],
    valorTotal:"", percEntrada:"50", dataContrato:hoje, prazoExecucao:"65", prazoDocumentos:"5",
    cronograma: gerarCronograma(["Projeto Estrutural","Projeto Hidrossanitário","Projeto Elétrico"], 65),
    cidade:"Governador Valadares", dataAssinatura:hoje,
    testemunha1Nome:"", testemunha1CPF:"", testemunha2Nome:"", testemunha2CPF:"",
  }));
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const assinado = form._fluxo?.status === "assinado";
  const emAssinatura = form._fluxo?.status === "em_assinatura" && !!form._fluxo?.assinatura?.docId;
  const fmtMoeda = v => isNaN(Number(v))||v==="" ? "R$ 0,00" : Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const parcelasPag = parcelasDoForm(form);
  const calcPag = calcularPagamento(parcelasPag, form.valorTotal);
  const dataFmt  = d => { if(!d) return "___/___/______"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };
  const dataExtenso = d => { if(!d) return ""; const dt=new Date(d+"T12:00:00"); return dt.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}); };
  const extensoNum = n => {const m={"1":"uma","2":"duas","3":"três","4":"quatro","5":"cinco"};return m[n]||n;};
  const extensoPrazo = n => {const m={"30":"trinta","45":"quarenta e cinco","60":"sessenta","65":"sessenta e cinco","90":"noventa","120":"cento e vinte"};return m[String(n)]||String(n);};
  const SERVICOS = ["Projeto Estrutural","Projeto Hidrossanitário","Projeto Elétrico","Projeto Arquitetônico","Projeto de Fundações","Compatibilização BIM"];
  const NAO_INCLUSO = ["Projeto arquitetônico","Paisagismo / ar-condicionado / incêndio","Aprovação em órgãos públicos","Acompanhamento de obra","Sondagem de solo","Memorial descritivo arquitetônico"];
  const toggleServico = s => set("servicos", form.servicos.includes(s)?form.servicos.filter(x=>x!==s):[...form.servicos,s]);
  const toggleNaoIncluso = s => set("naoInclusos", form.naoInclusos.includes(s)?form.naoInclusos.filter(x=>x!==s):[...form.naoInclusos,s]);
  const resp1 = (usuarios||[]).find(u=>u.perfil==="gestor") || usuarioAtual;
  const resp2 = (usuarios||[]).filter(u=>u.perfil==="gestor")[1];

  // Todo texto do formulário vem do banco (contratos/orçamentos): escapa antes de montar o HTML.
  const gerarHTML = () => gerarHTMLDe({ ...escProfundo(form), cronograma: form.cronograma });
  const gerarHTMLDe = (form, opc = {}) => {
    const el = opc.eletronico; // assinatura eletrônica pelo portal: cliente + um sócio (sem testemunhas)
    // sócio que assina pela WM: nome completo, CPF e CREA (os mesmos da qualificação da CONTRATADA)
    const SOCIOS = { jonathan:"Jonathan Charles Lucas Martins Almeida Siqueira, CPF 020.571.056-52, CREA 394707/MG", vinicius:"Vinicius Wilk Bezerra Rezende, CPF 120.912.666-47, CREA 394892/MG" };
    const chaveSocio = String(el?.socio?.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0];
    const socioNome = SOCIOS[chaveSocio] || escProfundo(el?.socio?.nome || "sócio da CONTRATADA");
    // eslint-disable-next-line react-hooks/purity -- nonce novo a cada documento gerado
    const NONCE = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const linhasContrato = `
<h1>Contrato de Prestação de Serviços</h1>
<h2 class="sec">Identificação das Partes Contratantes</h2>
<p><strong>CONTRATANTE:</strong> ${form.nomeCompleto}, ${form.tipoPessoa==="fisica"?form.nacionalidade+", "+form.estadoCivil+",":" "} portador(a) do ${form.tipoPessoa==="fisica"?"CPF":"CNPJ"} nº ${form.cpfCnpj}, domiciliado(a) na ${form.endereco}, doravante denominado(a) simplesmente <strong>CONTRATANTE</strong>.</p>
<p><strong>CONTRATADA:</strong> WM Engenharia Integrada (Wilk Martins Engenharia Ltda), pessoa jurídica, CNPJ nº <strong>60.959.603/0001-47</strong>, com sede na Av. JK, nº 1571, Bairro São Paulo, CEP 35.030-210, Governador Valadares/MG, representada pelos responsáveis técnicos: <strong>Jonathan Charles Lucas Martins Almeida Siqueira</strong>, brasileiro, casado, Engenheiro Civil, CREA 394707/MG, RG nº MG-20.111.074, CPF nº 020.571.056-52; e <strong>Vinicius Wilk Bezerra Rezende</strong>, brasileiro, casado, Engenheiro Civil, CREA 394892/MG, RG nº MG-20.597.543, CPF nº 120.912.666-47; doravante denominada simplesmente <strong>CONTRATADA</strong>.</p>
<p>As partes têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes.</p>
<h2 class="sec">Do Objeto do Contrato</h2>
<p><strong>Cláusula 1ª.</strong> É objeto deste contrato a elaboração de <strong>${form.servicos.join(", ")}</strong> de uma edificação ${form.descricaoEdificacao}${form.areaTotal?", com área total de "+form.areaTotal:""}, localizada em ${form.cidadeUF}${form.enderecoObra?", no endereço "+form.enderecoObra:""}.</p>
<p><strong>Parágrafo único.</strong> Os projetos seguirão as normas ABNT NBR 6118, NBR 6122, NBR 5626 e NBR 5410, com base no Projeto Arquitetônico do CONTRATANTE, conforme Anexo I, parte integrante deste instrumento.</p>
<h2 class="sec">Das Revisões e Alterações</h2>
<p><strong>Cláusula 2ª.</strong> O valor contratado contempla até <strong>${form.rodadasRevisao} (${extensoNum(form.rodadasRevisao)}) rodada(s)</strong> de revisão por disciplina. Revisões adicionais ou alterações no Projeto Arquitetônico após o início dos serviços serão orçadas separadamente e executadas mediante novo acordo escrito.</p>
<h2 class="sec">Das Obrigações das Partes</h2>
<p><strong>Cláusula 3ª.</strong> O CONTRATANTE obriga-se a: (I) fornecer à CONTRATADA, em até <strong>${form.prazoDocumentos} dias</strong> após a assinatura, todos os documentos do Anexo I; (II) manter disponibilidade para reuniões de alinhamento; (III) efetuar os pagamentos conforme Cláusula 7ª.</p>
<p><strong>Cláusula 4ª.</strong> A CONTRATADA obriga-se a: (I) elaborar os projetos com qualidade técnica conforme normas vigentes; (II) fornecer cópia deste instrumento; (III) emitir recibos de todos os pagamentos; (IV) comunicar imediatamente qualquer fato que possa comprometer o prazo.</p>
<h2 class="sec">Da Entrega dos Projetos</h2>
<p><strong>Cláusula 5ª.</strong> A entrega será em formato digital (${form.formatoEntrega}), enviados ao e-mail ${form.email||"a ser informado posteriormente"}, com confirmação de recebimento. Considera-se concluída a entrega no envio dos arquivos finais, independentemente de manifestação de aceite.</p>
<h2 class="sec">Da Propriedade Intelectual</h2>
<p><strong>Cláusula 6ª.</strong> Os projetos são protegidos pela Lei nº 9.610/1998 e permanecem de titularidade da CONTRATADA até a quitação integral. Após a quitação, os direitos de uso são cedidos ao CONTRATANTE exclusivamente para esta obra, sendo vedada a reprodução para outras edificações sem autorização escrita da CONTRATADA.</p>
<h2 class="sec">Do Preço e das Condições de Pagamento</h2>
<p><strong>Cláusula 7ª.</strong> O serviço será remunerado pela quantia total de <strong>${fmtMoeda(form.valorTotal)}</strong>, pagos em: ${clausulaPagamento(form)}. Pagamentos via TED/PIX. Atraso do CONTRATANTE: IPCA + multa 2% + juros 1% a.m. Atraso imputável à CONTRATADA: correção pelo IPCA das parcelas ainda não pagas.</p>
<h2 class="sec">Do Inadimplemento e das Penalidades</h2>
<p><strong>Cláusula 8ª.</strong> Inadimplemento do CONTRATANTE: multa de 2%, juros de 1% ao mês e correção pelo IPCA. Em cobrança judicial: custas e honorários advocatícios de 20%.</p>
<p><strong>Cláusula 9ª.</strong> O descumprimento de qualquer cláusula, exceto a 7ª, sujeitará a parte infratora à multa compensatória de 5% do valor total, sem prejuízo de perdas e danos.</p>
<h2 class="sec">Da Rescisão Imotivada</h2>
<p><strong>Cláusula 10ª.</strong> Qualquer parte poderá rescindir este contrato a qualquer tempo, com notificação escrita prévia de 10 (dez) dias corridos.</p>
<p><strong>Cláusula 11ª.</strong> Rescisão pelo CONTRATANTE após pagamento: devolução deduzindo o proporcional executado (conforme Anexo II) e taxa administrativa de 2%.</p>
<p><strong>Cláusula 12ª.</strong> Rescisão pela CONTRATADA: devolução das etapas não executadas, acrescidos de taxa administrativa de 2% como indenização.</p>
<h2 class="sec">Do Prazo de Execução</h2>
<p><strong>Cláusula 13ª.</strong> Prazo de <strong>${form.prazoExecucao} (${extensoPrazo(form.prazoExecucao)}) dias corridos</strong>, contados a partir do atendimento simultâneo de: (I) assinatura do contrato; (II) recebimento da entrada; (III) recebimento do Projeto Arquitetônico e documentos do Anexo I. O prazo fica suspenso durante indisponibilidade do CONTRATANTE.</p>
<p><strong>Cláusula 14ª.</strong> Atividades marcadas com ⚠ no Anexo II dependem da disponibilidade do CONTRATANTE e não serão imputadas à CONTRATADA em caso de atraso por sua parte.</p>
<h2 class="sec">Da Confidencialidade</h2>
<p><strong>Cláusula 15ª.</strong> As partes manterão sigilo sobre todas as informações técnicas, financeiras e pessoais por 5 (cinco) anos após o encerramento. A CONTRATADA poderá usar imagens não identificáveis da obra em portfólio mediante autorização do CONTRATANTE.</p>
<h2 class="sec">Das Condições Gerais</h2>
<p><strong>Cláusula 16ª.</strong> Inexistência de vínculo empregatício entre as partes.</p>
<p><strong>Cláusula 17ª.</strong> Vedada a subcontratação sem autorização escrita do CONTRATANTE, sob pena de rescisão imediata e multa da Cláusula 9ª.</p>
<p><strong>Cláusula 18ª.</strong> Este instrumento constitui o acordo integral. Alterações somente por escrito e assinadas por ambas as partes.</p>
<h2 class="sec">Do Foro</h2>
<p><strong>Cláusula 19ª.</strong> As partes elegem, com expressa renúncia a qualquer outro foro, o foro da Comarca de Governador Valadares, Estado de Minas Gerais.</p>
${el ? `<p>Por estarem assim justos e contratados, as partes assinam o presente instrumento eletronicamente, admitindo como válida a assinatura eletrônica realizada na plataforma da CONTRATADA, com identificação de cada signatário por código de uso único enviado ao seu e-mail, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001. A folha de assinaturas, com data, hora e código de verificação do documento, é parte integrante deste contrato.</p>`
  : `<p>Por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor, na presença das testemunhas abaixo.</p>`}
<p style="text-align:center;margin-top:16px">${form.cidade}, ${dataExtenso(form.dataAssinatura)}.</p>
${el ? `<div class="ass-grid" style="margin-top:20px">
  <div class="ass-line"><strong>CONTRATANTE: ${form.nomeCompleto}</strong><br/>${form.tipoPessoa==="fisica"?"CPF":"CNPJ"}: ${form.cpfCnpj}<br/><em>Assinatura eletrônica — ver folha de assinaturas</em></div>
  <div class="ass-line"><strong>CONTRATADA: WM Engenharia Integrada</strong><br/>CNPJ 60.959.603/0001-47<br/>por ${socioNome}<br/><em>Assinatura eletrônica — ver folha de assinaturas</em></div>
</div>` : `<div class="ass-wrap">
  <div class="ass-line"><strong>CONTRATANTE: ${form.nomeCompleto}</strong><br/>${form.tipoPessoa==="fisica"?"CPF":"CNPJ"}: ${form.cpfCnpj}</div>
  <div class="ass-grid">
    <div class="ass-line"><strong>Jonathan Charles L. M. A. Siqueira</strong><br/>CPF: 020.571.056-52<br/>CREA: 394707/MG<br/>WM Engenharia Integrada</div>
    <div class="ass-line"><strong>Vinicius Wilk Bezerra Rezende</strong><br/>CPF: 120.912.666-47<br/>CREA: 394892/MG<br/>WM Engenharia Integrada</div>
  </div>
  <div class="ass-grid" style="margin-top:32px">
    <div class="ass-line">Testemunha 1: ${form.testemunha1Nome||"[não informado]"}<br/>CPF: ${form.testemunha1CPF||"[não informado]"}</div>
    <div class="ass-line">Testemunha 2: ${form.testemunha2Nome||"[não informado]"}<br/>CPF: ${form.testemunha2CPF||"[não informado]"}</div>
  </div>
</div>`}
<div data-quebra="1"></div>
<h1>Anexo I – Escopo Detalhado dos Serviços</h1>
<p><strong>Contratante:</strong> ${form.nomeCompleto} &nbsp;&nbsp; <strong>Data:</strong> ${dataFmt(form.dataAssinatura)}</p>
<p><strong>Obra:</strong> ${form.descricaoEdificacao}${form.areaTotal?", área "+form.areaTotal:""}, localizada em ${form.cidadeUF}.</p>
<h3>1. Documentos a Fornecer pelo Contratante</h3>
<p>☐ Projeto arquitetônico completo (plantas, cortes, fachadas) em DWG ou PDF;<br/>☐ Sondagem de solo (SPT) ou laudo geotécnico;<br/>☐ Número do processo de aprovação na Prefeitura (se houver);<br/>☐ Dados do fornecimento de energia da concessionária (se disponível).</p>
<h3>2. Entregas da Contratada</h3>
${(form.servicos||[]).map(s=>`<p><strong>${s}:</strong> Plantas, detalhes construtivos e ART, conforme normas técnicas vigentes. Arquivos em ${form.formatoEntrega}.</p>`).join("")}
<p>Memória de cálculo e memorial descritivo não fazem parte das entregas; podem ser fornecidos somente se contratados à parte.</p>
${form.adicionaisInclusos?`<p><strong>Adicionais:</strong> ${form.adicionaisInclusos}</p>`:""}
<h3>3. O Que Não Está Incluso</h3>
${(form.naoInclusos||[]).map(n=>`<p>☐ ${n}</p>`).join("")}
<div class="ass-grid" style="margin-top:34px">
  <div class="ass-line">CONTRATANTE: ${form.nomeCompleto}</div>
  <div class="ass-line">CONTRATADA – WM Engenharia Integrada</div>
</div>
${(form.cronograma||[]).length?`<div data-quebra="1"></div>
<h1>Anexo II – Cronograma de Execução</h1>
<p class="meta"><strong>Contratante:</strong> ${form.nomeCompleto} &nbsp;·&nbsp; <strong>Prazo de execução:</strong> ${form.prazoExecucao} dias corridos (Cláusula 13ª)</p>
<p class="nota">Dias corridos contados a partir do início do prazo (Cláusula 13ª). A coluna "Pred." indica as tarefas que precisam estar concluídas para a tarefa começar. Atividades marcadas com ⚠ dependem da disponibilidade do CONTRATANTE (Cláusula 14ª).</p>
${cronogramaTabelaHTML(form.cronograma)}
<p class="nota">⚠ Condicionado à disponibilidade do CONTRATANTE — prazo suspenso em caso de atraso por sua parte.</p>`:""}`;

    const PAPEL = "data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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";
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https:; style-src 'unsafe-inline'; font-src data: https:; script-src 'nonce-${NONCE}'">
<title>Contrato – ${form.nomeCompleto}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{background:#d1d5db}
body{width:210mm;margin:0 auto;padding:6mm 0;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
@media print{html{background:#fff}body{padding:0}.pg{margin:0!important;box-shadow:none!important}}
.pg{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;margin:0 auto 6mm;box-shadow:0 2px 12px rgba(0,0,0,.25);break-after:page;page-break-after:always}
.pg:last-child{break-after:auto;page-break-after:auto}
.pg img.fundo{position:absolute;top:0;left:0;width:210mm;height:297mm;z-index:0}
.area{position:absolute;z-index:1;overflow:visible}
.npag{position:absolute;z-index:1;font:8pt Arial,Helvetica,sans-serif;color:#6b7280;text-align:right}
.doc{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#1a1a1a}
.doc h1{text-align:center;font-size:12.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#0d1e35;margin:0 0 10px}
.doc .sec{text-align:center;font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#1a4a7a;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #c7d2e0}
.doc p{margin:0 0 6px;text-align:justify}
.doc h3{font-size:10.5pt;font-weight:700;color:#0d1e35;margin:12px 0 4px}
.doc .meta{text-align:left}
.doc .nota{font-size:9pt;line-height:1.4;color:#4b5563;text-align:left}
.doc table.crono{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;line-height:1.3;margin:6px 0 8px}
.doc table.crono th{background:#0d1e35;color:#fff;font-weight:700;padding:5px 6px;text-align:left;border:1px solid #0d1e35}
.doc table.crono td{padding:3.5px 6px;border:1px solid #d5dce6;vertical-align:top}
.doc table.crono .c{text-align:center}
.doc table.crono tr.cr-total td{background:#e8eef6;font-weight:700;color:#0d1e35}
.doc table.crono tr.cr-etapa td{background:#1a4a7a;color:#fff;font-weight:700;border-color:#1a4a7a}
.doc table.crono tr.cr-grupo td{background:#eef2f7;font-weight:700;color:#1a4a7a}
.doc table.crono td.n{color:#6b7280}
.doc .cr-cli{font-size:8.5pt}
.doc .ass-wrap{margin-top:24px}
.doc .ass-line{border-top:1px solid #333;margin-top:34px;padding-top:4px;text-align:center;font-size:9.5pt;line-height:1.4}
.doc .ass-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}
</style>
</head><body>
<div id="fonte" class="doc" style="position:absolute;left:-10000px;top:0">${linhasContrato}</div>
<script nonce="${NONCE}">
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){
  // Margens (mm) — área útil entre o cabeçalho e o rodapé do papel timbrado
  var TOPO = 44, BASE = 36, ESQ = 24, DIR = 24;
  // Folga de segurança: ao imprimir, o navegador pode refazer as quebras de linha e
  // ganhar uma linha a mais por página; a folga evita que o texto encoste no rodapé.
  var FOLGA = 8;
  var PAPEL = ${JSON.stringify(PAPEL)};
  var r = document.createElement("div"); r.style.cssText = "position:absolute;width:100mm;height:1px;visibility:hidden"; document.body.appendChild(r);
  var MM = r.getBoundingClientRect().width / 100; r.remove();
  var UTIL_H = (297 - TOPO - BASE) * MM, UTIL_W = (210 - ESQ - DIR) * MM;
  var fonte = document.getElementById("fonte"); fonte.style.width = UTIL_W + "px";
  var paginas = [], fluxo = null;
  function novaPagina(){
    var pg = document.createElement("div"); pg.className = "pg";
    var img = document.createElement("img"); img.className = "fundo"; img.src = PAPEL; img.alt = ""; pg.appendChild(img);
    var area = document.createElement("div"); area.className = "area doc";
    area.style.cssText = "top:" + TOPO + "mm;left:" + ESQ + "mm;width:" + UTIL_W + "px;height:" + UTIL_H + "px";
    fluxo = document.createElement("div"); area.appendChild(fluxo); pg.appendChild(area);
    var np = document.createElement("div"); np.className = "npag"; np.style.cssText = "right:" + DIR + "mm;top:" + (297 - BASE + 3) + "mm"; pg.appendChild(np);
    document.body.appendChild(pg); paginas.push(np);
  }
  function cabe(){ return fluxo.offsetHeight <= UTIL_H - FOLGA * MM; }
  function vazio(){ return !fluxo.children.length; }
  function ehTitulo(n){ return /^H[1-3]$/.test(n.tagName); }
  function tabelaNova(modelo){
    var t = modelo.cloneNode(false); var cg = modelo.querySelector("colgroup"); if (cg) t.appendChild(cg.cloneNode(true));
    var th = modelo.querySelector("thead"); if (th) t.appendChild(th.cloneNode(true));
    var tb = document.createElement("tbody"); t.appendChild(tb); fluxo.appendChild(t); return tb;
  }
  function colocarTabela(tab){
    var linhas = Array.prototype.slice.call(tab.querySelectorAll("tbody > tr"));
    var tb = tabelaNova(tab);
    linhas.forEach(function(tr){
      tb.appendChild(tr);
      if (cabe()) return;
      tb.removeChild(tr);
      // não deixa título de etapa/subetapa sozinho no fim da página
      var levar = [tr];
      while (tb.lastElementChild && /cr-(etapa|grupo|total)/.test(tb.lastElementChild.className)) levar.unshift(tb.removeChild(tb.lastElementChild));
      if (!tb.children.length) tb.parentNode.remove();
      novaPagina(); tb = tabelaNova(tab);
      levar.forEach(function(x){ tb.appendChild(x); });
    });
  }
  novaPagina();
  var nos = Array.prototype.slice.call(fonte.children);
  nos.forEach(function(no, i){
    if (no.getAttribute("data-quebra")) { if (!vazio()) novaPagina(); return; }
    if (no.tagName === "TABLE" && /crono/.test(no.className)) { colocarTabela(no); return; }
    fluxo.appendChild(no);
    if (!cabe() && fluxo.children.length > 1) { fluxo.removeChild(no); novaPagina(); fluxo.appendChild(no); }
    // título não fica sozinho no fim da página
    var prox = nos[i + 1];
    if ((ehTitulo(no) || /\bsec\b/.test(no.className)) && prox && fluxo.children.length > 1 && (UTIL_H - FOLGA * MM - fluxo.offsetHeight) < 22 * MM) {
      fluxo.removeChild(no); novaPagina(); fluxo.appendChild(no);
    }
  });
  fonte.remove();
  paginas.forEach(function(np, i){ np.textContent = "Página " + (i + 1) + " de " + paginas.length; });
});
</script>
</body>
</html>`;
  };
;

  const imprimir = () => {
    const htmlStr = gerarHTML();
    const win = window.open("","_blank","width=900,height=700");
    win.document.write(htmlStr);
    win.document.close();
    setTimeout(()=>{ win.focus(); win.print(); }, 1000);
  };
  const baixarWord = async () => {
    try {
      const resp = await fetch("/api/gerar-contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAuth()) },
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error("Erro ao gerar DOCX");
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `Contrato_WM_${(form.nomeCompleto||"Contrato").replace(/\s+/g,"_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert("Erro ao gerar Word: " + e.message);
    }
  };



  const passos = [{n:1,label:"Cliente",sub:"Dados do contratante"},{n:2,label:"Projeto",sub:"Serviços e escopo"},{n:3,label:"Valores",sub:"Pagamento e prazos"},{n:4,label:"Finalizar",sub:"Assinatura"}];
  const [buscaLista, setBuscaLista] = useState("");
  const novoContrato = () => {setContratoId(null);setForm(f=>({...f,nomeCompleto:"",cpfCnpj:"",endereco:"",email:"",servicos:[],descricaoEdificacao:"",areaTotal:"",numPavimentos:"",cidadeUF:"",enderecoObra:"",valorTotal:"",dataContrato:hoje,dataAssinatura:hoje,_fluxo:undefined}));setMostrarLista(false);setPasso(1);setGerado(false);};
  const listaFiltrada = lista.filter(i=>!buscaLista.trim()||String(i.titulo||"").toLowerCase().includes(buscaLista.trim().toLowerCase()));
  const nAssinados = lista.filter(i=>i.dados?._fluxo?.status==="assinado").length;
  const chip = (txt,bg,cor) => <span style={{fontSize:11.5,fontWeight:700,background:bg,color:cor,borderRadius:20,padding:"3px 9px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>{txt}</span>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,paddingBottom:48}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
        <div>
          <h1 style={{margin:0,fontSize:30,fontWeight:800,color:"#0a2557",letterSpacing:-.5,lineHeight:1.15}}>Contratos</h1>
          <div style={{fontSize:14.5,color:"#6b7a90",marginTop:6}}>Gere contratos de prestação de serviços, a partir de um orçamento ou do zero.</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {msgSalvo&&<span role="status" style={{fontSize:13,fontWeight:600,color:msgSalvo.startsWith("✅")?C2.verde:"#dc2626"}}>{msgSalvo.replace(/^[✅❌]\s*/,"")}</span>}
          <Btn variant="ghost" onClick={()=>setMostrarLista(v=>!v)}><Icone nome="pasta" tam={17}/>Contratos salvos<span style={{background:"#eef1f6",color:C2.sub,borderRadius:10,padding:"0 7px",fontSize:12}}>{lista.length}</span></Btn>
          <Btn variant="secondary" onClick={()=>setSeletorOrc(true)}><Icone nome="calculadora" tam={17}/>A partir de orçamento</Btn>
          <Btn onClick={novoContrato}><Icone nome="mais" tam={17}/>Novo contrato</Btn>
        </div>
      </div>

      {seletorOrc&&<SeletorOrcamento supabase={supabase} onEscolher={aplicarOrcamento} onFechar={()=>setSeletorOrc(false)}/>}
      {emitindo&&<AnexarContrato modo="emitir" contrato={emitindo} drive={drive} driveRaizId={DRIVE_ROOT_ID} projetos={projetos} usuarios={usuarios} tipos={TIPOS} supabase={supabase}
        onSalvarProjeto={onSalvarProjeto}
        gerarPdf={async (socio, progresso) => { const m = await vendorAssinatura(); return m.htmlParaPdf(gerarHTMLDe({ ...escProfundo(emitindo.dados||form), cronograma:(emitindo.dados||form).cronograma }, { eletronico:{ socio } }), { aoProgresso:progresso }); }}
        onConcluido={r=>{ if(emitindo.id===contratoId) setForm(f=>({...f,email:r.dados.email,_fluxo:r.dados._fluxo})); carregarLista(); }}
        onFechar={proj=>{ setEmitindo(null); if(proj&&proj.id) onAbrirProjeto?.(proj.id); }}/>}
      {anexando&&<AnexarContrato arquivoInicial={anexando.arquivoInicial} contrato={anexando} drive={drive} driveRaizId={DRIVE_ROOT_ID} projetos={projetos} usuarios={usuarios} tipos={TIPOS} supabase={supabase}
        onSalvarProjeto={onSalvarProjeto}
        onConcluido={r=>{ if(anexando.id===contratoId) setForm(f=>({...f,_fluxo:r.dados._fluxo})); carregarLista(); }}
        onFechar={proj=>{ setAnexando(null); if(proj&&proj.id) onAbrirProjeto?.(proj.id); }}/>}

      {/* Lista de contratos salvos */}
      {mostrarLista&&<Card style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderBottom:`1px solid ${C2.borda}`,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 200px"}}>
            <div style={{fontWeight:700,fontSize:15.5,color:"#0a2557"}}>Contratos salvos</div>
            <div style={{fontSize:12.5,color:C2.sub}}>{lista.length} contrato(s) · {nAssinados} assinado(s)</div>
          </div>
          <input value={buscaLista} onChange={e=>setBuscaLista(e.target.value)} placeholder="Buscar cliente…" aria-label="Buscar contrato"
            style={{border:`1px solid #d9e2ee`,borderRadius:10,padding:"8px 12px",fontSize:13.5,minWidth:200}}/>
          <button onClick={()=>setMostrarLista(false)} aria-label="Fechar lista" style={{border:"none",background:"#f1f4f9",borderRadius:10,width:34,height:34,cursor:"pointer",color:C2.sub,display:"flex",alignItems:"center",justifyContent:"center"}}><Icone nome="fechar" tam={17}/></button>
        </div>
        <div style={{maxHeight:420,overflowY:"auto"}}>
        {listaFiltrada.length===0
          ? <div style={{padding:"24px",textAlign:"center",color:C2.sub,fontSize:13.5}}>{lista.length?"Nenhum contrato encontrado.":"Nenhum contrato salvo ainda."}</div>
          : listaFiltrada.map(item=>{
            const fl=item.dados?._fluxo||{};
            return (
            <div key={item.id} role="button" tabIndex={0} onClick={()=>carregarContrato(item)} onKeyDown={e=>{if(e.key==="Enter")carregarContrato(item);}} style={{
              display:"flex",alignItems:"center",gap:14,padding:"12px 18px",borderBottom:`1px solid ${C2.borda}`,cursor:"pointer",
              background:contratoId===item.id?"#f2f7fe":"#fff"}}>
              <span style={{width:38,height:38,borderRadius:10,background:fl.status==="assinado"?"#e7f7ee":"#eef3fb",color:fl.status==="assinado"?C2.verde:C2.azulM,display:"flex",alignItems:"center",justifyContent:"center",flex:"none"}}><Icone nome={fl.status==="assinado"?"check":"documento"} tam={19}/></span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:"#0f1f3d",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.titulo}</div>
                <div style={{fontSize:12,color:C2.sub,marginTop:2}}>
                  {(usuarios||[]).find(u=>u.id===item.criado_por)?.nome||"—"} · atualizado em {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
                {fl.orcamentoId&&chip("Orçamento","#f1f4f9",C2.sub)}
                {contratoId===item.id&&chip("Aberto","#e9f1fd",C2.azulM)}
                {fl.status==="em_assinatura"&&chip("Em assinatura","#fffbeb","#b45309")}
                {fl.status==="assinado"
                  ? chip("Assinado","#e7f7ee",C2.verde)
                  : <button onClick={e=>{e.stopPropagation();abrirAnexar(item);}} style={{background:"#fff",color:C2.verde,border:`1px solid #bfe3cf`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12.5,fontWeight:600}}>Anexar assinado</button>}
                <button onClick={e=>excluirContrato(item.id,e)} aria-label="Excluir contrato" title="Excluir" style={{background:"none",color:"#c0392b",border:"none",borderRadius:8,padding:6,cursor:"pointer"}}><Icone nome="lixeira" tam={17}/></button>
              </div>
            </div>);
          })}
        </div>
      </Card>}

      <div style={{display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{flex:"3 1 560px",minWidth:0,display:"flex",flexDirection:"column",gap:16}}>
          {!gerado&&<Card style={{padding:"16px 20px"}}>
            <ol aria-label="Etapas do contrato" style={{listStyle:"none",margin:0,padding:0,display:"flex",alignItems:"center",gap:8}}>
              {passos.map((p,i)=>{
                const ativo=passo===p.n, feito=passo>p.n;
                return <li key={p.n} style={{display:"flex",alignItems:"center",gap:8,flex:i<3?1:"none",minWidth:0}}>
                  <button onClick={()=>setPasso(p.n)} aria-current={ativo?"step":undefined} style={{display:"flex",alignItems:"center",gap:10,border:"none",background:"none",cursor:"pointer",padding:0,textAlign:"left",fontFamily:"inherit",minWidth:0}}>
                    <span style={{width:32,height:32,borderRadius:16,flex:"none",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13.5,
                      background:ativo?C2.azulM:feito?"#e7f7ee":"#eef1f6",color:ativo?"#fff":feito?C2.verde:C2.sub,boxShadow:ativo?"0 0 0 4px #dce9fc":"none"}}>{feito?<Icone nome="check" tam={15} traco={2.6}/>:p.n}</span>
                    <span className="wm-esconde-celular" style={{minWidth:0}}>
                      <span style={{display:"block",fontSize:13.5,fontWeight:ativo?700:600,color:ativo?"#0a2557":feito?"#0f1f3d":C2.sub}}>{p.label}</span>
                      <span style={{display:"block",fontSize:11.5,color:C2.sub,whiteSpace:"nowrap"}}>{p.sub}</span>
                    </span>
                  </button>
                  {i<3&&<span aria-hidden="true" style={{flex:1,height:2,background:feito?"#bfe3cf":"#e6ecf4",borderRadius:2,minWidth:12}}/>}
                </li>;
              })}
            </ol>
          </Card>}

          {!gerado&&<Card style={{padding:"22px 24px"}}>
        {passo===1&&<>
          <SecC titulo="Dados do Contratante"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <SelC label="Tipo de Pessoa" val={form.tipoPessoa} onChange={v=>set("tipoPessoa",v)} opts={[{v:"fisica",l:"Pessoa Física (CPF)"},{v:"juridica",l:"Pessoa Jurídica (CNPJ)"}]}/>
            <InpC label={form.tipoPessoa==="fisica"?"CPF":"CNPJ"} val={form.cpfCnpj} onChange={v=>set("cpfCnpj",v)} placeholder={form.tipoPessoa==="fisica"?"XXX.XXX.XXX-XX":"XX.XXX.XXX/XXXX-XX"}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:16}}>
            <InpC label="Nome Completo / Razão Social" val={form.nomeCompleto} onChange={v=>set("nomeCompleto",v)} placeholder="Nome do cliente ou empresa" full/>
          </div>
          {form.tipoPessoa==="fisica"&&<div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:16}}>
            <InpC label="Nacionalidade" val={form.nacionalidade} onChange={v=>set("nacionalidade",v)} placeholder="brasileiro(a)"/>
            <SelC label="Estado Civil" val={form.estadoCivil} onChange={v=>set("estadoCivil",v)} opts={["solteiro(a)","casado(a)","divorciado(a)","viúvo(a)","separado(a)"]}/>
          </div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:16}}>
            <InpC label="Endereço Completo do Contratante" val={form.endereco} onChange={v=>set("endereco",v)} placeholder="Rua/Av., nº, Bairro, CEP, Cidade/UF" full/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:16}}>
            <InpC label="E-mail do Contratante" val={form.email} onChange={v=>set("email",v)} placeholder="email@exemplo.com" full/>
          </div>
        </>}

        {passo===2&&<>
          <SecC titulo="Tipo de Serviço"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:4}}>
            {SERVICOS.map(s=><button key={s} onClick={()=>toggleServico(s)} className="wm-chip" aria-pressed={form.servicos.includes(s)} style={{padding:"9px 14px",borderRadius:10,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,
              border:`1px solid ${form.servicos.includes(s)?"#9cc0f3":C2.borda}`,background:form.servicos.includes(s)?"#e9f1fd":"#fff",color:form.servicos.includes(s)?C2.azulM:C2.texto}}>
              <span style={{width:16,height:16,borderRadius:5,border:`1.5px solid ${form.servicos.includes(s)?C2.azulM:"#c3cedd"}`,background:form.servicos.includes(s)?C2.azulM:"#fff",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{form.servicos.includes(s)&&<Icone nome="check" tam={11} traco={3}/>}</span>{s}</button>)}
          </div>
          <SecC titulo="Dados da Edificação"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <InpC label="Descrição da Edificação" val={form.descricaoEdificacao} onChange={v=>set("descricaoEdificacao",v)} placeholder="Ex: residência unifamiliar de dois pavimentos" full/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:16,marginTop:16}}>
            <InpC label="Área Total" val={form.areaTotal} onChange={v=>set("areaTotal",v)} placeholder="Ex: 185,76 m²"/>
            <InpC label="Nº de Pavimentos" val={form.numPavimentos} onChange={v=>set("numPavimentos",v)} placeholder="Ex: 2 pavimentos"/>
            <InpC label="Cidade/UF da Obra" val={form.cidadeUF} onChange={v=>set("cidadeUF",v)} placeholder="Ex: Duque de Caxias/RJ"/>
            <InpC label="Endereço Completo da Obra" val={form.enderecoObra} onChange={v=>set("enderecoObra",v)} placeholder="Rua, nº, Bairro, Cidade"/>
          </div>
          <SecC titulo="Escopo"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <SelC label="Rodadas de Revisão" val={form.rodadasRevisao} onChange={v=>set("rodadasRevisao",v)}
              opts={[{v:"1",l:"1 rodada"},{v:"2",l:"2 rodadas"},{v:"3",l:"3 rodadas"},{v:"4",l:"4 rodadas"}]}/>
            <SelC label="Formato de Entrega" val={form.formatoEntrega} onChange={v=>set("formatoEntrega",v)}
              opts={["PDF","PDF e DWG","PDF, DWG e RVT","Apenas PDF","A definir"]}/>
            <InpC label="Adicionais Inclusos (ex: ART, memorial)" val={form.adicionaisInclusos} onChange={v=>set("adicionaisInclusos",v)} placeholder="Deixe em branco se não houver" full/>
          </div>
          <SecC titulo="O Que Não Está Incluso"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {NAO_INCLUSO.map(s=><button key={s} onClick={()=>toggleNaoIncluso(s)} aria-pressed={form.naoInclusos.includes(s)} style={{padding:"8px 13px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,
              border:`1px solid ${form.naoInclusos.includes(s)?"#f5c2c0":C2.borda}`,background:form.naoInclusos.includes(s)?"#fdf1f0":"#fff",color:form.naoInclusos.includes(s)?"#c0392b":C2.sub}}>
              {form.naoInclusos.includes(s)?<Icone nome="fechar" tam={13} traco={2.6}/>:<Icone nome="mais" tam={13}/>}{s}</button>)}
          </div>
        </>}

        {passo===3&&<>
          <SecC titulo="Honorários e Pagamento"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <InpC label="Valor Total do Contrato (R$)" val={form.valorTotal} onChange={v=>set("valorTotal",v)} type="number" placeholder="0,00"/>
          </div>
          <SecC titulo="Parcelas e vencimentos"/>
          <div style={{fontSize:12.5,color:C2.sub,margin:"-6px 0 12px"}}>Digite o percentual <b>ou</b> o valor de cada parcela (o outro é calculado) e escolha quando vence. O texto da Cláusula 7ª é montado a partir desta lista.</div>
          <PagamentoEditor parcelas={parcelasPag} valorTotal={form.valorTotal} C2={C2}
            onChange={lista=>setForm(f=>({...f,pagamento:lista,percEntrada:lista[0]?.vencimento==="assinatura"&&lista[0]?.modo!=="valor"?String(lista[0].pct||"0"):f.percEntrada}))}/>
          <SecC titulo="Prazos"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <InpC label="Prazo de Execução (Dias Corridos)" val={form.prazoExecucao} onChange={v=>set("prazoExecucao",v)} type="number" placeholder="65"/>
            <InpC label="Prazo para Entrega de Documentos (dias)" val={form.prazoDocumentos} onChange={v=>set("prazoDocumentos",v)} type="number" placeholder="5"/>
            <InpC label="Data do Contrato" val={form.dataContrato} onChange={v=>set("dataContrato",v)} type="date"/>
          </div>
          <SecC titulo="Cronograma de Execução (Anexo II)"/>
          <CronogramaEditor etapas={form.cronograma||[]} onChange={v=>set("cronograma",v)}
            prazo={form.prazoExecucao} onPrazo={n=>set("prazoExecucao",String(n))}
            servicos={form.servicos} usuarioAtual={usuarioAtual} supabase={supabase} C2={C2}/>
        </>}

        {passo===4&&<>
          <SecC titulo="Dados para Assinatura"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <InpC label="Cidade de Assinatura" val={form.cidade} onChange={v=>set("cidade",v)} placeholder="Governador Valadares"/>
            <InpC label="Data de Assinatura" val={form.dataAssinatura} onChange={v=>set("dataAssinatura",v)} type="date"/>
          </div>
          <SecC titulo="Testemunhas"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
            <InpC label="Testemunha 1 — Nome" val={form.testemunha1Nome} onChange={v=>set("testemunha1Nome",v)} placeholder="Nome completo"/>
            <InpC label="Testemunha 1 — CPF"  val={form.testemunha1CPF}  onChange={v=>set("testemunha1CPF",v)}  placeholder="XXX.XXX.XXX-XX"/>
            <InpC label="Testemunha 2 — Nome" val={form.testemunha2Nome} onChange={v=>set("testemunha2Nome",v)} placeholder="Nome completo"/>
            <InpC label="Testemunha 2 — CPF"  val={form.testemunha2CPF}  onChange={v=>set("testemunha2CPF",v)}  placeholder="XXX.XXX.XXX-XX"/>
          </div>
          <SecC titulo="Resumo do Contrato"/>
          <div style={{background:C2.cinza,borderRadius:12,padding:"16px 18px",fontSize:13.5,color:C2.texto,lineHeight:1.9}}>
            <div><strong>Cliente:</strong> {form.nomeCompleto||"—"} · {form.tipoPessoa==="fisica"?"CPF":"CNPJ"}: {form.cpfCnpj||"—"}</div>
            <div><strong>Serviços:</strong> {form.servicos.join(", ")||"—"}</div>
            <div><strong>Obra:</strong> {form.descricaoEdificacao||"—"} · {form.areaTotal||"—"} · {form.cidadeUF||"—"}</div>
            <div><strong>Valor Total:</strong> {fmtMoeda(form.valorTotal)}{!calcPag.fechado&&calcPag.total>0&&<span style={{color:"#b45309",fontWeight:600}}> · ⚠ parcelas somam {fmtMoeda(calcPag.soma)}</span>}</div>
            <div><strong>Pagamento:</strong> {resumoPagamento(form)}</div>
            <div><strong>Prazo:</strong> {form.prazoExecucao} dias corridos</div>
            <div><strong>Assinatura:</strong> {form.cidade}, {dataFmt(form.dataAssinatura)}</div>
          </div>
        </>}

            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:26,paddingTop:18,borderTop:`1px solid ${C2.borda}`}}>
              <Btn variant="ghost" onClick={()=>setPasso(p=>Math.max(1,p-1))} disabled={passo===1}>Anterior</Btn>
              {passo<4
                ?<Btn onClick={()=>setPasso(p=>Math.min(4,p+1))}>Próximo<Icone nome="setaDir" tam={16}/></Btn>
                :<Btn variant="verde" onClick={()=>setGerado(true)}><Icone nome="documento" tam={16}/>Gerar contrato</Btn>}
            </div>
          </Card>}

          {gerado&&<Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",borderBottom:`1px solid ${C2.borda}`}}>
              <div style={{fontWeight:700,fontSize:15.5,color:"#0a2557"}}>Prévia do contrato</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <Btn variant="ghost" small onClick={()=>{setGerado(false);setPasso(1);}}>Editar</Btn>
                <Btn variant="ghost" small onClick={baixarWord}>Word</Btn>
                <Btn small onClick={imprimir}>Imprimir / PDF</Btn>
              </div>
            </div>
            <iframe sandbox="allow-scripts allow-modals" srcDoc={gerarHTML()} style={{width:"100%",height:"80vh",border:"none",display:"block",background:"#e5e9ef"}} title="Prévia do contrato"/>
          </Card>}
        </div>

        {/* Resumo lateral */}
        <aside style={{flex:"1 1 280px",maxWidth:380,position:"sticky",top:88,display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:"18px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:12}}>
              <span style={{fontSize:12,fontWeight:700,color:C2.sub,textTransform:"uppercase",letterSpacing:.5}}>Resumo</span>
              {assinado?chip("Assinado","#e7f7ee",C2.verde):contratoId?chip("Salvo","#e9f1fd",C2.azulM):chip("Rascunho","#f1f4f9",C2.sub)}
            </div>
            <div style={{fontSize:17,fontWeight:800,color:"#0a2557",lineHeight:1.3}}>{form.nomeCompleto||"Cliente não informado"}</div>
            <div style={{fontSize:13,color:C2.sub,marginTop:3}}>{[form.descricaoEdificacao,form.cidadeUF].filter(Boolean).join(" · ")||"Obra não informada"}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>
              {(form.servicos||[]).length?form.servicos.map(sv=>chip(sv.replace("Projeto ",""),"#eef3fb",C2.azulM)):<span style={{fontSize:12.5,color:C2.sub}}>Nenhum serviço escolhido</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
              <div style={{background:"#f6f8fc",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:11.5,color:C2.sub}}>Valor total</div><div style={{fontWeight:800,color:"#0f1f3d",fontSize:15}}>{fmtMoeda(form.valorTotal)}</div></div>
              <div style={{background:"#f6f8fc",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:11.5,color:C2.sub}}>Prazo</div><div style={{fontWeight:800,color:"#0f1f3d",fontSize:15}}>{form.prazoExecucao||"—"} dias</div></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
              <Btn onClick={salvarContrato} disabled={salvando} style={{justifyContent:"center"}}><Icone nome="check" tam={16}/>{salvando?"Salvando…":contratoId?"Salvar alterações":"Salvar contrato"}</Btn>
              {!gerado&&<Btn variant="ghost" onClick={()=>setGerado(true)} style={{justifyContent:"center"}}><Icone nome="documento" tam={16}/>Ver prévia do contrato</Btn>}
              {(contratoId||form.nomeCompleto)&&!assinado&&!emAssinatura&&<Btn onClick={abrirEmitir} disabled={salvando} style={{justifyContent:"center"}}><Icone nome="link" tam={16}/>Emitir para assinatura no portal</Btn>}
              {emAssinatura&&<div style={{border:"1px solid #fde68a",background:"#fffbeb",borderRadius:10,padding:"10px 12px",fontSize:13,color:"#92400e",display:"grid",gap:8}}>
                <b>Em assinatura no portal{assin?.total?` · ${assin.feitas}/${assin.total}`:""}{assin?.status==="assinado"?" · assinado por todos":""}</b>
                {assin?.erro&&<span style={{color:"#9f1239"}}>{assin.erro}</span>}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <a href={`/assinar/${form._fluxo.assinatura.token}`} target="_blank" rel="noreferrer" style={{background:"#fff",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px",color:"#92400e",fontWeight:600,textDecoration:"none",fontSize:12.5}}>Página de assinatura</a>
                  <button onClick={()=>verificarAssinatura(false)} disabled={assin?.carregando} style={{background:"#fff",border:"1px solid #fde68a",borderRadius:8,padding:"6px 10px",color:"#92400e",fontWeight:600,cursor:"pointer",fontSize:12.5}}>{assin?.carregando?"Verificando…":"Verificar"}</button>
                  {assin?.status==="assinado"&&<button onClick={()=>verificarAssinatura(true)} disabled={assin?.carregando} style={{background:C2.verde,border:"none",borderRadius:8,padding:"6px 10px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:12.5}}>Concluir assinatura</button>}
                </div>
                <span style={{fontSize:12}}>Concluir: salva o PDF assinado no Drive, passa o projeto para Em andamento e monta o checklist.</span>
              </div>}
              {(contratoId||form.nomeCompleto)&&(assinado
                ? <a href={form._fluxo?.resultado?.arquivo?.url||"#"} target="_blank" rel="noreferrer" style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,background:"#e7f7ee",color:C2.verde,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:14,textDecoration:"none"}}><Icone nome="check" tam={16}/>Ver contrato assinado</a>
                : <Btn variant="ghost" onClick={()=>abrirAnexar(null)} disabled={salvando} style={{justifyContent:"center"}}><Icone nome="link" tam={16}/>Anexar assinado (papel/gov.br)</Btn>)}
            </div>
          </Card>
          <div style={{fontSize:12.5,color:C2.sub,lineHeight:1.5,padding:"0 4px"}}>Emitir para assinatura: o sistema gera o PDF, cria a pasta no Drive, o projeto e o portal do cliente com o contrato esperando a assinatura do cliente e de um sócio (código por e-mail). Assinado em papel ou gov.br? Use “Anexar assinado”.</div>
        </aside>
      </div>
    </div>
  );
}
