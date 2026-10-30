// Aba Ajuda: fluxo de trabalho da WM e tutoriais de cada parte do sistema.
import { useState, useMemo } from "react";

const K = { azul:"#0d1e35", azulM:"#1a4a7a", azulC:"#2e6da8", borda:"#e2eaf3", sub:"#64748b", fundo:"#f0f4f8", verde:"#16a34a", amarelo:"#b45309" };

// ── Fluxo principal ─────────────────────────────────────────────────────────────
const FLUXO = [
  { n:1, icone:"🧮", titulo:"Orçamento", aba:"orcamentos", quem:"Gestor",
    texto:"Preencha cliente, local, pavimentos e disciplinas. \"Gerar / Imprimir PDF\" salva o orçamento e o marca como Enviado." },
  { n:2, icone:"🤝", titulo:"Cliente fecha", aba:"orcamentos", quem:"Gestor",
    texto:"Em \"Orçamentos salvos\", mude o status para Fechado (ou Recusado). Aparece o botão \"Gerar contrato\"." },
  { n:3, icone:"📄", titulo:"Contrato", aba:"contratos", quem:"Gestor",
    texto:"\"Gerar contrato\" (ou \"A partir de orçamento\" na aba Contratos) já preenche os dados. Complete CPF, endereço e testemunhas, salve e gere o PDF/Word." },
  { n:4, icone:"📎", titulo:"Contrato assinado", aba:"contratos", quem:"Gestor",
    texto:"\"Anexar assinado\": envie o PDF assinado. O contrato fica marcado como Assinado." },
  { n:5, icone:"⚙️", titulo:"Automático", aba:"projetos", quem:"Sistema",
    texto:"O sistema cria a pasta no Drive (NN.TT.MMAA - Cliente), salva o PDF nela, cria o projeto Em andamento e monta o checklist com os prazos do Anexo II." },
  { n:6, icone:"✅", titulo:"Execução", aba:"obras", quem:"Equipe",
    texto:"A equipe registra horas no projeto e marca o checklist. O progresso do projeto sobe sozinho até a entrega." },
];

// ── Tutoriais ───────────────────────────────────────────────────────────────────
const TOPICOS = [
  { id:"fluxo", icone:"🔁", titulo:"Fluxo de trabalho (do orçamento à entrega)", aba:null, fluxo:true,
    resumo:"Como um serviço anda dentro do sistema, do pedido de orçamento até o projeto entregue.",
    secoes:[
      { t:"O que acontece ao anexar o contrato assinado", itens:[
        "A pasta do projeto é criada no Google Drive, dentro da pasta do ano, no padrão NN.TT.MMAA - Cliente (NN = próximo número do ano, TT = tipo, MMAA = mês e ano). Se já existir uma pasta com o nome do cliente, o sistema oferece usar a existente.",
        "O PDF assinado é salvo nessa pasta com o nome \"CONTRATO ASSINADO - Cliente.pdf\".",
        "O projeto é criado com status Em andamento, valor, parcelas (entrada e final), prazo, data de entrega prevista, link da pasta e equipe (cada disciplina vai para quem tem aquela especialidade em Configurações).",
        "A obra é criada no módulo Obras com o checklist só das disciplinas contratadas, e cada disciplina recebe a data de término do cronograma (Anexo II).",
        "O orçamento de origem fica marcado como Fechado e ligado ao contrato.",
      ]},
      { t:"Tipo do projeto", itens:[
        "Uma disciplina contratada: o tipo é o da disciplina (PE estrutural, PH hidrossanitário, EL elétrico, PA arquitetônico, PF fundação).",
        "Mais de uma disciplina: o tipo sugerido é CB (compatibilização). Você pode trocar na tela de anexar antes de confirmar.",
      ]},
      { t:"Se algo der errado", itens:[
        "Cada etapa aparece com ✅ ou ❌. Corrija o problema e clique em \"Tentar de novo\": o que já foi feito (pasta, PDF) não é repetido.",
        "Se o checklist não for criado automaticamente, abra o projeto → aba Checklist → \"Criar obra a partir deste projeto\".",
        "A primeira vez, o Google pede permissão para o sistema criar pastas e salvar arquivos no Drive. Use a conta que tem acesso à pasta WM ENGENHARIA.",
      ]},
    ]},
  { id:"orcamentos", icone:"🧮", titulo:"Orçamentos", aba:"orcamentos",
    resumo:"Gerador de propostas com cálculo por m², piscina, muro, nota fiscal e valores manuais.",
    secoes:[
      { t:"Fazer um orçamento", itens:[
        "Preencha cliente, local (Cidade / UF) e tipo de edificação.",
        "Informe a área de cada pavimento (a soma alimenta o cálculo) e marque as disciplinas.",
        "Use \"Acrescentar impostos\" quando houver nota fiscal e \"Editar valores manualmente\" para ajustar algum item.",
        "Ajuste prazo e validade e clique em \"Gerar / Imprimir PDF\". Escolha \"Salvar como PDF\" na janela de impressão e envie ao cliente.",
      ]},
      { t:"Orçamentos salvos e status", itens:[
        "Gerar o PDF já salva o orçamento como Enviado. \"Salvar orçamento\" salva sem mudar o status.",
        "Os orçamentos ficam no sistema: todos da equipe veem a mesma lista, em qualquer computador.",
        "Em \"Orçamentos salvos\" filtre por status e mude a situação: Em aberto, Enviado, Fechado ou Recusado.",
        "Quando o status é Fechado aparece \"Gerar contrato\", que abre a aba Contratos já preenchida.",
      ]},
    ]},
  { id:"contratos", icone:"📄", titulo:"Contratos", aba:"contratos",
    resumo:"Contrato de prestação de serviços em 4 passos, com Anexo I (escopo) e Anexo II (cronograma).",
    secoes:[
      { t:"Criar", itens:[
        "\"A partir de orçamento\": escolha um orçamento e o contrato vem com cliente, disciplinas, área, valor, prazo e cronograma.",
        "Do zero: em \"Contratos Salvos\" → \"+ Novo Contrato\".",
        "Passos: Cliente → Projeto (serviços, área, cronograma) → Valores (entrada %, prazo) → Finalizar (testemunhas).",
        "O cronograma pode vir de um modelo e ser ajustado ao prazo total; ele vira o Anexo II.",
        "Salve e use \"Imprimir / PDF\" ou \"Word\".",
      ]},
      { t:"Anexar o contrato assinado", itens:[
        "Na lista de contratos ou no contrato aberto, clique em \"📎 Anexar assinado\".",
        "Escolha o PDF, confira cliente, tipo, início do prazo e código, conecte o Google Drive e confirme.",
        "O contrato passa a mostrar \"✔ Assinado\" com o link do PDF. Veja o tópico Fluxo de trabalho para tudo o que é criado.",
      ]},
    ]},
  { id:"projetos", icone:"📁", titulo:"Projetos", aba:"projetos",
    resumo:"Lista de projetos com status, prazos, equipe, financeiro, revisões, checklist e portal do cliente.",
    secoes:[
      { t:"Cadastro", itens:[
        "Projetos novos chegam pelo contrato assinado, pela importação do Drive (Dashboard) ou por \"+ Novo projeto\".",
        "Código no padrão NN.TT.MMAA. Status automático calcula Em andamento, Atrasado e Concluído pelas datas e pelo progresso.",
        "Aba Projeto: equipe por disciplina, pausas e datas. Aba Financeiro: parcelas e o que já foi pago.",
        "Aba Checklist: o checklist da obra ligado a este projeto. Aba Revisões: controle de revisão interna.",
        "Aba Portal Cliente: gere um link para o cliente acompanhar o andamento.",
      ]},
    ]},
  { id:"obras", icone:"🏠", titulo:"Obras, checklist e briefing", aba:"obras",
    resumo:"Checklist por disciplina, cadastro/briefing do cliente, atas e histórico da obra.",
    secoes:[
      { t:"Usar", itens:[
        "Uma obra reúne os projetos do mesmo cliente (hidrossanitário, elétrico, estrutural…). O progresso do checklist atualiza o projeto.",
        "Cada disciplina tem etapas e itens. Marque o status de cada item e defina o prazo da disciplina (quando vem do contrato, já vem preenchido).",
        "Cadastro: perguntas sobre o cliente e os ambientes. Gere o link do formulário e envie ao cliente para ele responder o briefing; as respostas voltam para a obra.",
        "Atas: registre reuniões e anexe a ata assinada.",
      ]},
    ]},
  { id:"horas", icone:"⏱", titulo:"Horas trabalhadas", aba:"horas",
    resumo:"Registro de sessões por projeto ou atividade administrativa, banco de horas e horas extras.",
    secoes:[
      { t:"Registrar", itens:[
        "Clique em \"▶ Iniciar\" na barra superior, escolha Projeto ou Administrativa, descreva o que vai fazer e inicie.",
        "Para trocar de projeto use \"Mudar\"; para terminar o dia, \"🏁 Encerrar expediente\".",
        "Sessões fora do expediente contam como hora extra.",
        "Modo escuro: botão da lua na barra superior (o sol volta ao claro). A escolha fica salva no navegador.",
        "Gestores: em Banco de horas, \"+ Lançar horas\" registra horas de dias anteriores para qualquer colaborador (data, projeto ou atividade, entrada e saída). O sistema calcula a hora extra, impede horários sobrepostos e marca o registro como \"Manual\".",
        "Os registros ficam guardados no computador até o servidor confirmar. Se aparecer a faixa amarela de \"registros não salvos\", não feche o sistema e clique em \"Tentar agora\".",
      ]},
      { t:"Consultar", itens:[
        "Banco de Horas: histórico por pessoa e mês, edição de observação, horas extras e relatório em PDF.",
        "Produtividade: horas por projeto e por pessoa.",
      ]},
    ]},
  { id:"agenda", icone:"📅", titulo:"Agenda e escalas", aba:"agenda",
    resumo:"Calendário com feriados e recessos, e escalas de revisão de projetos e coleta de lixo.",
    secoes:[{ t:"Usar", itens:[
      "Calendário: visualize o mês, feriados e recessos. Gestores cadastram feriados e recessos/pontes.",
      "Escalas: veja quem está na revisão de projetos e na coleta de lixo da semana.",
    ]}]},
  { id:"tarefas", icone:"✅", titulo:"Tarefas e notificações", aba:"tarefas",
    resumo:"Lembretes automáticos (sino), tarefas da equipe e notificações no computador.",
    secoes:[{ t:"Usar", itens:[
      "O sino 🔔 mostra lembretes automáticos: projetos atrasados, sem contrato, parcelas a cobrar, sessão de horas aberta, obra parada, briefing respondido e ata sem assinatura.",
      "Cada lembrete pode ser aberto, adiado ou dispensado.",
      "Tarefas: crie tarefas com responsável, prazo e projeto; marque como concluídas.",
      "Ative as notificações do computador no sino para receber os avisos mesmo com o sistema fechado.",
    ]}]},
  { id:"relatorios", icone:"📊", titulo:"Relatórios", aba:"relatorios",
    resumo:"Relatórios gerais ou de um projeto, com as informações que você escolher, em PDF ou planilha.",
    secoes:[{ t:"Gerar um relatório", itens:[
      "Escolha Geral (todos os projetos, com filtros por situação, tipo e colaborador) ou Por projeto (busque e selecione o projeto).",
      "Escolha o período: este mês, mês passado, últimos 90 dias, este ano, todo o período ou datas personalizadas.",
      "Marque as informações que vão sair: resumo, andamento, entregas, financeiro, parcelas pendentes, horas, sessões detalhadas, tarefas, orçamentos e contratos, equipe. A escolha fica salva para a próxima vez.",
      "A prévia mostra exatamente o que sai. Clique em Gerar PDF (na janela de impressão escolha Salvar como PDF) ou em Planilha (Excel).",
      "Os valores financeiros vêm das parcelas de cada projeto. Horas, tarefas e entregas respeitam o período escolhido.",
    ]}]},
  { id:"calculadoras", icone:"📐", titulo:"Calculadoras e materiais de apoio", aba:"calculadoras",
    resumo:"Ferramentas de cálculo técnico e guias de conferência de projeto (hidrossanitário e elétrico).",
    secoes:[{ t:"Usar", itens:[
      "Escolha a calculadora na grade (ou busque pelo nome). Os resultados atualizam enquanto você digita.",
      "Sapata associada: preencha materiais, pilares e geometria; na etapa Resultados é possível baixar o desenho em DXF.",
      "Na aba Materiais de apoio ficam os guias de conferência em PDF: leia dentro do sistema (com o sumário ao lado) ou baixe o arquivo. A busca encontra por assunto ou norma (ex.: NBR 5410).",
      "Use o filtro ao lado da busca para ver só uma disciplina (hidrossanitário, elétrico, estrutural…).",
      "Adicionar PDF envia um material novo para toda a equipe: o sistema lê a capa, o número de páginas e as normas citadas; confira o título, escolha a disciplina e salve. Antes do primeiro envio, rode no Supabase o arquivo supabase/materiais_apoio.sql.",
    ]}]},
  { id:"ifc", icone:"🧊", titulo:"Visualizador IFC e link do cliente", aba:"ifc",
    resumo:"Abra modelos BIM, confira elementos e envie um link para o cliente ver o modelo 3D sem login.",
    secoes:[
      { t:"Visualizar", itens:[
        "Clique em Abrir arquivo .ifc ou arraste o arquivo para a área 3D (IFC 2x3 e IFC 4: estrutural, arquitetônico, hidrossanitário, elétrico).",
        "Arrastar gira, botão direito move, a roda aproxima. Clique num elemento para ver nome, pavimento, materiais e propriedades.",
        "No painel Modelo, oculte disciplinas, categorias ou pavimentos. A barra inferior tem corte horizontal, raio-X, arestas, modo caminhar (W A S D) e imagem da vista.",
        "Sobrepor modelo carrega outro arquivo junto (compatibilização). Use Cores → Por arquivo para diferenciar cada um.",
      ]},
      { t:"Vincular ao projeto e enviar ao cliente", itens:[
        "Com o modelo aberto, vá na aba Link do painel, escolha o projeto, a disciplina e a versão e clique em Salvar no projeto e gerar link.",
        "Copie o link ou envie pelo WhatsApp. O cliente abre no navegador ou no celular, sem login.",
        "O modelo também aparece no Portal do cliente do projeto. Desative o link ou gere um novo quando quiser que o anterior pare de funcionar.",
        "Modelos sobrepostos: em Modelos dos projetos use \"Sobrepor todos\" (ou Sobrepor em cada modelo). Na aba Link aparece o link com todos sobrepostos (copiar, WhatsApp, QR). \"Link de todos\" copia direto. O cliente liga e desliga cada modelo no olho; modelos com link desativado ficam de fora (máx. 10).",
        "QR code: no botão QR code (aba Link, lista de modelos ou Portal do cliente) baixe o QR em PNG ou SVG, ou a etiqueta pronta com logo e legenda para colar na prancha. Se gerar um novo link, gere e troque o QR.",
        "Em Modelos dos projetos ficam todos os modelos salvos, agrupados por projeto, para abrir de novo, sobrepor, copiar o link ou excluir.",
        "Antes do primeiro uso, rode no Supabase o arquivo supabase/modelos_ifc_comparativos.sql (cria a tabela e a pasta de arquivos). Limite de 50 MB por arquivo.",
      ]},
    ]},
  { id:"comparativo", icone:"⚖️", titulo:"Comparativo de modelos", aba:"comparativo",
    resumo:"Compare aço, concreto, forma e custo de até 6 soluções estruturais e gere o PDF com o papel timbrado da WM.",
    secoes:[
      { t:"Preencher", itens:[
        "Digite os quantitativos por elemento (Enter pula para a próxima célula) ou use Importar do Eberick com o Resumo de Materiais em .xlsx.",
        "Ajuste o preço do aço por bitola e do concreto em cada modelo. Itens extras (movimento de terra, cubetas…) entram no total.",
        "Duplique um modelo para testar variações. O resumo à direita mostra o mais econômico e a diferença dos demais.",
        "Vincule a um projeto e clique em Salvar para continuar depois (Abrir salvo).",
      ]},
      { t:"Gerar o PDF", itens:[
        "Clique em Gerar PDF: aparece a prévia em folhas A4 com o papel timbrado da WM.",
        "Escolha o responsável, se quer o detalhamento de cada modelo e edite as considerações (o botão Sugerir texto escreve um resumo automático).",
        "Clique em Baixar PDF e, na janela de impressão, escolha Salvar como PDF.",
      ]},
      { t:"Estimativa de custo das instalações (elétrico e hidrossanitário)", itens:[
        "Na aba Instalações · estimativa de custo, importe a Lista de Materiais exportada pelo QiBuilder em .xlsx (pode importar o elétrico e o hidrossanitário juntos).",
        "Cada item recebe o preço da composição SINAPI MG (set/2026, não desonerado) de fornecimento e instalação. Os selos mostram a origem: SINAPI, Estimado (equivalência de bitola ou peça), Incluído, Informado ou Sem preço.",
        "Filtre Sem preço e informe os valores que faltam (acessórios de piscina, padrão de entrada, duchas…). Ao salvar, esses preços ficam guardados e são usados nas próximas estimativas.",
        "Desmarque um sistema para tirá-lo do total, ajuste o BDI ou marque Somente materiais. Gere o PDF com o papel timbrado da WM, com ou sem o detalhamento dos itens.",
        "Antes do primeiro uso, rode no Supabase o arquivo supabase/estimativa_instalacoes.sql.",
      ]},
    ]},
  { id:"financeiro", icone:"💰", titulo:"Financeiro", aba:"financeiro",
    resumo:"Valores contratados, recebidos e pendentes por projeto.",
    secoes:[{ t:"Usar", itens:[
      "As parcelas vêm do contrato assinado (entrada e parcela final) ou são lançadas na aba Financeiro do projeto.",
      "Marque a parcela como paga quando o valor entrar. Os totais do Dashboard e do Financeiro são atualizados.",
    ]}]},
  { id:"acesso", icone:"🔐", titulo:"Login, usuários e configurações", aba:"config",
    resumo:"Entrada com a conta Google, perfis e expediente de cada pessoa.",
    secoes:[{ t:"Usar", itens:[
      "Entre com \"Entrar com Google\" usando o e-mail cadastrado. Marque \"Manter conectado\" no seu computador.",
      "Configurações: cadastro de usuários, perfil (admin, gestor, colaborador), e-mail Google, especialidades e expediente.",
      "As especialidades definem para quem vai cada disciplina quando um projeto é criado pelo contrato.",
    ]}]},
];

function Fluxograma({ irPara }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10, margin:"4px 0 20px" }}>
      {FLUXO.map((f, i) => (
        <button key={f.n} onClick={() => irPara(f.aba)} title={`Ir para ${f.titulo}`}
          style={{ position:"relative", textAlign:"left", background:f.quem === "Sistema" ? "#ecfdf3" : "#fff", border:`1.5px solid ${f.quem === "Sistema" ? "#bbf7d0" : K.borda}`, borderRadius:12, padding:"14px 14px 12px", cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:24, height:24, borderRadius:12, background:f.quem === "Sistema" ? K.verde : K.azulM, color:"#fff", fontSize:12, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center", flex:"none" }}>{f.n}</span>
            <span style={{ fontSize:18 }}>{f.icone}</span>
            <span style={{ fontWeight:800, color:K.azul, fontSize:14 }}>{f.titulo}</span>
          </div>
          <div style={{ fontSize:12.5, color:K.sub, lineHeight:1.5 }}>{f.texto}</div>
          <div style={{ fontSize:11, fontWeight:700, color:f.quem === "Sistema" ? K.verde : K.azulC, marginTop:"auto" }}>{f.quem}{i < FLUXO.length - 1 ? "  →" : "  ✓"}</div>
        </button>
      ))}
    </div>
  );
}

export default function PaginaAjuda({ irPara }) {
  const [sel, setSel] = useState("fluxo");
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const lista = useMemo(() => !q ? TOPICOS : TOPICOS.filter(t =>
    [t.titulo, t.resumo, ...t.secoes.flatMap(s => [s.t, ...s.itens])].join(" ").toLowerCase().includes(q)), [q]);
  const atual = TOPICOS.find(t => t.id === sel) || TOPICOS[0];

  return (
    <div style={{ maxWidth:1240 }}>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ margin:0, fontSize:30, fontWeight:800, color:"#0a2557", letterSpacing:-.5 }}>Ajuda e tutoriais</h1>
        <div style={{ fontSize:14.5, color:K.sub, marginTop:6 }}>Como usar cada parte do sistema e o fluxo de trabalho da WM.</div>
      </div>
      <div style={{ display:"flex", gap:18, alignItems:"flex-start", flexWrap:"wrap" }}>
        <nav aria-label="Tópicos de ajuda" style={{ flex:"1 1 230px", maxWidth:300, background:"#fff", border:`1px solid ${K.borda}`, borderRadius:12, padding:10, position:"sticky", top:96 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na ajuda…" aria-label="Buscar na ajuda"
            style={{ width:"100%", boxSizing:"border-box", border:`1.5px solid ${K.borda}`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", marginBottom:8 }} />
          {lista.map(t => (
            <button key={t.id} onClick={() => setSel(t.id)}
              style={{ display:"flex", gap:8, alignItems:"center", width:"100%", textAlign:"left", border:"none", borderRadius:8, padding:"9px 10px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:sel === t.id ? 800 : 600,
                background:sel === t.id ? "#e8f1fb" : "transparent", color:sel === t.id ? K.azulM : K.azul }}>
              <span>{t.icone}</span><span>{t.titulo}</span>
            </button>
          ))}
          {!lista.length && <div style={{ fontSize:12, color:K.sub, padding:8 }}>Nada encontrado.</div>}
        </nav>

        <article style={{ flex:"3 1 480px", minWidth:0, background:"#fff", border:`1px solid ${K.borda}`, borderRadius:12, padding:"22px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div>
              <h2 style={{ margin:0, fontSize:19, color:K.azul }}>{atual.icone} {atual.titulo}</h2>
              <p style={{ margin:"6px 0 16px", color:K.sub, fontSize:13.5, lineHeight:1.5 }}>{atual.resumo}</p>
            </div>
            {atual.aba && <button onClick={() => irPara(atual.aba)} style={{ background:K.azulM, color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Abrir {atual.titulo.split(",")[0]} →</button>}
          </div>
          {atual.fluxo && <Fluxograma irPara={irPara} />}
          {atual.secoes.map(s => (
            <section key={s.t} style={{ marginBottom:18 }}>
              <h3 style={{ fontSize:14.5, color:K.azulM, margin:"0 0 8px" }}>{s.t}</h3>
              <ol style={{ margin:0, paddingLeft:22, color:"#1e293b", fontSize:13.5, lineHeight:1.65 }}>
                {s.itens.map((it, i) => <li key={i} style={{ marginBottom:4 }}>{it}</li>)}
              </ol>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
