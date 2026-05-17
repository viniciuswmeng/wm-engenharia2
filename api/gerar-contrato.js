import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType
} from "docx";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = req.body;
  if (!form) return res.status(400).json({ error: "Dados não enviados" });

  const fmtMoeda = v => isNaN(Number(v)) || v === "" ? "R$ 0,00"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const entrada   = Number(form.valorTotal || 0) * Number(form.percEntrada || 0) / 100;
  const parcFinal = Number(form.valorTotal || 0) - entrada;

  const dataFmt = d => { if (!d) return "___/___/______"; const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };
  const dataExtenso = d => { if (!d) return ""; return new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"}); };
  const extensoNum = n => ({"1":"uma","2":"duas","3":"três","4":"quatro","5":"cinco"}[n]||n);
  const extensoPrazo = n => ({"30":"trinta","45":"quarenta e cinco","60":"sessenta","65":"sessenta e cinco","90":"noventa","120":"cento e vinte"}[String(n)]||String(n));

  const FONT="Arial", SZ=24;

  const secao = (texto) => new Paragraph({
    alignment:AlignmentType.CENTER, spacing:{before:160,after:80},
    border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"CCCCCC",space:3}},
    children:[new TextRun({text:texto.toUpperCase(),bold:true,size:SZ,font:FONT})]
  });
  const clausula = (id,texto) => new Paragraph({
    alignment:AlignmentType.BOTH, spacing:{before:80,after:60},
    children:[new TextRun({text:`${id}. `,bold:true,size:SZ,font:FONT}),new TextRun({text:texto,size:SZ,font:FONT})]
  });
  const par = (texto,bold=false) => new Paragraph({
    alignment:AlignmentType.BOTH, spacing:{before:60,after:60},
    children:[new TextRun({text:texto,bold,size:SZ,font:FONT})]
  });

  const cronoRows=[];
  if(form.cronograma&&form.cronograma.length>0){
    for(const etapa of form.cronograma){
      cronoRows.push(new TableRow({children:[new TableCell({columnSpan:3,shading:{fill:"1a4a7a",type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:[new TextRun({text:etapa.etapa,bold:true,color:"FFFFFF",size:20,font:FONT})]})]})]})  );
      for(const t of (etapa.tarefas||[])){
        cronoRows.push(new TableRow({children:[
          new TableCell({width:{size:5000,type:WidthType.DXA},margins:{top:50,bottom:50,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:t.nome||"",size:20,font:FONT})]})]}),
          new TableCell({width:{size:2000,type:WidthType.DXA},margins:{top:50,bottom:50,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:t.duracao||"",size:20,font:FONT})]})]}),
          new TableCell({width:{size:1200,type:WidthType.DXA},margins:{top:50,bottom:50,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:t.pred||"",size:20,font:FONT})]})]}),
        ]}));
      }
    }
  }

  const pageProps={size:{width:11906,height:16838},margin:{top:2268,right:1134,bottom:2551,left:1134}};

  const assTabela=(l1,c1,l2,c2)=>new Table({width:{size:8200,type:WidthType.DXA},columnWidths:[4100,4100],rows:[new TableRow({children:[
    new TableCell({width:{size:4100,type:WidthType.DXA},borders:{top:{style:BorderStyle.SINGLE,size:6,color:"333333"},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},margins:{top:60,bottom:60,left:0,right:100},children:l1.map(t=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60},children:[new TextRun({text:t,size:20,font:FONT})]}))}),
    new TableCell({width:{size:4100,type:WidthType.DXA},borders:{top:{style:BorderStyle.SINGLE,size:6,color:"333333"},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},margins:{top:60,bottom:60,left:100,right:0},children:l2.map(t=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60},children:[new TextRun({text:t,size:20,font:FONT})]}))}),
  ]})]});

  const secaoContrato={properties:{page:pageProps},children:[
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},children:[new TextRun({text:"CONTRATO DE PRESTAÇÃO DE SERVIÇOS",bold:true,size:28,font:FONT})]}),
    secao("Identificação das Partes Contratantes"),
    new Paragraph({alignment:AlignmentType.BOTH,spacing:{before:80,after:60},children:[
      new TextRun({text:"CONTRATANTE: ",bold:true,size:SZ,font:FONT}),
      new TextRun({text:`${form.nomeCompleto||""}, ${form.tipoPessoa==="fisica"?(form.nacionalidade||"")+", "+(form.estadoCivil||"")+",":""} portador(a) do ${form.tipoPessoa==="fisica"?"CPF":"CNPJ"} nº ${form.cpfCnpj||""}, domiciliado(a) na ${form.endereco||""}, doravante denominado(a) simplesmente `,size:SZ,font:FONT}),
      new TextRun({text:"CONTRATANTE",bold:true,size:SZ,font:FONT}),new TextRun({text:".",size:SZ,font:FONT}),
    ]}),
    new Paragraph({alignment:AlignmentType.BOTH,spacing:{before:60,after:60},children:[
      new TextRun({text:"CONTRATADA: ",bold:true,size:SZ,font:FONT}),
      new TextRun({text:"WM Engenharia Integrada (Wilk Martins Engenharia Ltda), pessoa jurídica, CNPJ nº ",size:SZ,font:FONT}),
      new TextRun({text:"60.959.603/0001-47",bold:true,size:SZ,font:FONT}),
      new TextRun({text:", com sede na Av. JK, nº 1571, Bairro São Paulo, CEP 35.030-210, Governador Valadares/MG, representada pelos responsáveis técnicos: ",size:SZ,font:FONT}),
      new TextRun({text:"Jonathan Charles Lucas Martins Almeida Siqueira",bold:true,size:SZ,font:FONT}),
      new TextRun({text:", brasileiro, casado, Engenheiro Civil, CREA 394707/MG, RG nº MG-20.111.074, CPF nº 020.571.056-52; e ",size:SZ,font:FONT}),
      new TextRun({text:"Vinicius Wilk Bezerra Rezende",bold:true,size:SZ,font:FONT}),
      new TextRun({text:", brasileiro, casado, Engenheiro Civil, CREA 394892/MG, RG nº MG-20.597.543, CPF nº 120.912.666-47; doravante denominada simplesmente ",size:SZ,font:FONT}),
      new TextRun({text:"CONTRATADA",bold:true,size:SZ,font:FONT}),new TextRun({text:".",size:SZ,font:FONT}),
    ]}),
    par("As partes têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes."),
    secao("Do Objeto do Contrato"),
    clausula("Cláusula 1ª",`É objeto deste contrato a elaboração de ${(form.servicos||[]).join(", ")} de uma edificação ${form.descricaoEdificacao||""}${form.areaTotal?", com área total de "+form.areaTotal:""}, localizada em ${form.cidadeUF||""}${form.enderecoObra?", no endereço "+form.enderecoObra:""}.`),
    clausula("Parágrafo único","Os projetos seguirão as normas ABNT NBR 6118, NBR 6122, NBR 5626 e NBR 5410, com base no Projeto Arquitetônico do CONTRATANTE, conforme Anexo I, parte integrante deste instrumento."),
    secao("Das Revisões e Alterações"),
    clausula("Cláusula 2ª",`O valor contratado contempla até ${form.rodadasRevisao||"2"} (${extensoNum(form.rodadasRevisao||"2")}) rodada(s) de revisão por disciplina. Revisões adicionais ou alterações no Projeto Arquitetônico após o início dos serviços serão orçadas separadamente e executadas mediante novo acordo escrito.`),
    secao("Das Obrigações das Partes"),
    clausula("Cláusula 3ª",`O CONTRATANTE obriga-se a: (I) fornecer à CONTRATADA, em até ${form.prazoDocumentos||"5"} dias após a assinatura, todos os documentos do Anexo I; (II) manter disponibilidade para reuniões de alinhamento; (III) efetuar os pagamentos conforme Cláusula 7ª.`),
    clausula("Cláusula 4ª","A CONTRATADA obriga-se a: (I) elaborar os projetos com qualidade técnica conforme normas vigentes; (II) fornecer cópia deste instrumento; (III) emitir recibos de todos os pagamentos; (IV) comunicar imediatamente qualquer fato que possa comprometer o prazo."),
    secao("Da Entrega dos Projetos"),
    clausula("Cláusula 5ª",`A entrega será em formato digital (${form.formatoEntrega||"PDF e DWG"}), enviados ao e-mail ${form.email||"a ser informado posteriormente"}, com confirmação de recebimento. Considera-se concluída a entrega no envio dos arquivos finais, independentemente de manifestação de aceite.`),
    secao("Da Propriedade Intelectual"),
    clausula("Cláusula 6ª","Os projetos são protegidos pela Lei nº 9.610/1998 e permanecem de titularidade da CONTRATADA até a quitação integral. Após a quitação, os direitos de uso são cedidos ao CONTRATANTE exclusivamente para esta obra, sendo vedada a reprodução para outras edificações sem autorização escrita da CONTRATADA."),
    secao("Do Preço e das Condições de Pagamento"),
    new Paragraph({alignment:AlignmentType.BOTH,spacing:{before:80,after:60},children:[
      new TextRun({text:"Cláusula 7ª. ",bold:true,size:SZ,font:FONT}),
      new TextRun({text:"O serviço será remunerado pela quantia total de ",size:SZ,font:FONT}),
      new TextRun({text:fmtMoeda(form.valorTotal),bold:true,size:SZ,font:FONT}),
      new TextRun({text:`, pagos em: (I) `,size:SZ,font:FONT}),
      new TextRun({text:`Entrada (${form.percEntrada||"50"}%): `,bold:true,size:SZ,font:FONT}),
      new TextRun({text:`${fmtMoeda(entrada)}, devida na assinatura; (II) `,size:SZ,font:FONT}),
      new TextRun({text:`Parcela final (${100-Number(form.percEntrada||50)}%): `,bold:true,size:SZ,font:FONT}),
      new TextRun({text:`${fmtMoeda(parcFinal)}, devida na entrega conforme Cláusula 5ª. Pagamentos via TED/PIX. Atraso do CONTRATANTE: IPCA + multa 2% + juros 1% a.m. Atraso imputável à CONTRATADA: correção da parcela final pelo IPCA.`,size:SZ,font:FONT}),
    ]}),
    secao("Do Inadimplemento e das Penalidades"),
    clausula("Cláusula 8ª","Inadimplemento do CONTRATANTE: multa de 2%, juros de 1% ao mês e correção pelo IPCA. Em cobrança judicial: custas e honorários advocatícios de 20%."),
    clausula("Cláusula 9ª","O descumprimento de qualquer cláusula, exceto a 7ª, sujeitará a parte infratora à multa compensatória de 5% do valor total, sem prejuízo de perdas e danos."),
    secao("Da Rescisão Imotivada"),
    clausula("Cláusula 10ª","Qualquer parte poderá rescindir este contrato a qualquer tempo, com notificação escrita prévia de 10 (dez) dias corridos."),
    clausula("Cláusula 11ª","Rescisão pelo CONTRATANTE após pagamento: devolução deduzindo o proporcional executado (conforme Anexo II) e taxa administrativa de 2%."),
    clausula("Cláusula 12ª","Rescisão pela CONTRATADA: devolução das etapas não executadas, acrescidos de taxa administrativa de 2% como indenização."),
    secao("Do Prazo de Execução"),
    new Paragraph({alignment:AlignmentType.BOTH,spacing:{before:80,after:60},children:[
      new TextRun({text:"Cláusula 13ª. ",bold:true,size:SZ,font:FONT}),
      new TextRun({text:"Prazo de ",size:SZ,font:FONT}),
      new TextRun({text:`${form.prazoExecucao||"65"} (${extensoPrazo(form.prazoExecucao||"65")}) dias corridos`,bold:true,size:SZ,font:FONT}),
      new TextRun({text:", contados a partir do atendimento simultâneo de: (I) assinatura do contrato; (II) recebimento da entrada; (III) recebimento do Projeto Arquitetônico e documentos do Anexo I. O prazo fica suspenso durante indisponibilidade do CONTRATANTE.",size:SZ,font:FONT}),
    ]}),
    clausula("Cláusula 14ª","Atividades marcadas com ⚠ no Anexo II dependem da disponibilidade do CONTRATANTE e não serão imputadas à CONTRATADA em caso de atraso por sua parte."),
    ...(cronoRows.length>0?[
      secao("Cronograma de Execução — Anexo II"),
      new Table({width:{size:8200,type:WidthType.DXA},columnWidths:[5000,2000,1200],rows:[
        new TableRow({tableHeader:true,children:[
          new TableCell({width:{size:5000,type:WidthType.DXA},shading:{fill:"0d1e35",type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:[new TextRun({text:"Tarefa",bold:true,color:"FFFFFF",size:20,font:FONT})]})]  }),
          new TableCell({width:{size:2000,type:WidthType.DXA},shading:{fill:"0d1e35",type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:[new TextRun({text:"Duração",bold:true,color:"FFFFFF",size:20,font:FONT})]})]}),
          new TableCell({width:{size:1200,type:WidthType.DXA},shading:{fill:"0d1e35",type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:[new TextRun({text:"Pred.",bold:true,color:"FFFFFF",size:20,font:FONT})]})]}),
        ]}),
        ...cronoRows
      ]}),
    ]:[]),
    secao("Da Confidencialidade"),
    clausula("Cláusula 15ª","As partes manterão sigilo sobre todas as informações técnicas, financeiras e pessoais por 5 (cinco) anos após o encerramento. A CONTRATADA poderá usar imagens não identificáveis da obra em portfólio mediante autorização do CONTRATANTE."),
    secao("Das Condições Gerais"),
    clausula("Cláusula 16ª","Inexistência de vínculo empregatício entre as partes."),
    clausula("Cláusula 17ª","Vedada a subcontratação sem autorização escrita do CONTRATANTE, sob pena de rescisão imediata e multa da Cláusula 9ª."),
    clausula("Cláusula 18ª","Este instrumento constitui o acordo integral. Alterações somente por escrito e assinadas por ambas as partes."),
    secao("Do Foro"),
    clausula("Cláusula 19ª","As partes elegem, com expressa renúncia a qualquer outro foro, o foro da Comarca de Governador Valadares, Estado de Minas Gerais."),
    par("Por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor, na presença das testemunhas abaixo.",false),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:160},children:[new TextRun({text:`${form.cidade||"Governador Valadares"}, ${dataExtenso(form.dataAssinatura)}.`,size:SZ,font:FONT})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:240,after:40},border:{top:{style:BorderStyle.SINGLE,size:6,color:"333333",space:4}},children:[new TextRun({text:`CONTRATANTE: ${form.nomeCompleto||""}`,bold:true,size:SZ,font:FONT})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},children:[new TextRun({text:`${form.tipoPessoa==="fisica"?"CPF":"CNPJ"}: ${form.cpfCnpj||""}`,size:SZ,font:FONT})]}),
    assTabela(
      ["Jonathan Charles L. M. A. Siqueira","CPF: 020.571.056-52 | CREA: 394707/MG","WM Engenharia Integrada"],
      null,
      ["Vinicius Wilk Bezerra Rezende","CPF: 120.912.666-47 | CREA: 394892/MG","WM Engenharia Integrada"],
      null
    ),
    assTabela(
      [`Testemunha 1: ${form.testemunha1Nome||"[não informado]"}`,`CPF: ${form.testemunha1CPF||"[não informado]"}`],
      null,
      [`Testemunha 2: ${form.testemunha2Nome||"[não informado]"}`,`CPF: ${form.testemunha2CPF||"[não informado]"}`],
      null
    ),
  ]};

  const secaoAnexo={properties:{page:pageProps},children:[
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},children:[new TextRun({text:"ANEXO I – ESCOPO DETALHADO DOS SERVIÇOS",bold:true,size:26,font:FONT})]}),
    new Paragraph({spacing:{before:60,after:60},children:[new TextRun({text:"Contratante: ",bold:true,size:SZ,font:FONT}),new TextRun({text:form.nomeCompleto||"",size:SZ,font:FONT}),new TextRun({text:"     Data: ",bold:true,size:SZ,font:FONT}),new TextRun({text:dataFmt(form.dataAssinatura),size:SZ,font:FONT})]}),
    new Paragraph({spacing:{before:60,after:60},children:[new TextRun({text:"Obra: ",bold:true,size:SZ,font:FONT}),new TextRun({text:`${form.descricaoEdificacao||""}${form.areaTotal?", área "+form.areaTotal:""}, localizada em ${form.cidadeUF||""}.`,size:SZ,font:FONT})]}),
    new Paragraph({spacing:{before:100,after:60},children:[new TextRun({text:"1. Documentos a Fornecer pelo Contratante",bold:true,size:SZ,font:FONT})]}),
    par("☐ Projeto arquitetônico completo (plantas, cortes, fachadas) em DWG ou PDF;"),
    par("☐ Sondagem de solo (SPT) ou laudo geotécnico;"),
    par("☐ Número do processo de aprovação na Prefeitura (se houver);"),
    par("☐ Dados do fornecimento de energia da concessionária (se disponível)."),
    new Paragraph({spacing:{before:100,after:60},children:[new TextRun({text:"2. Entregas da Contratada",bold:true,size:SZ,font:FONT})]}),
    ...(form.servicos||[]).map(s=>par(`${s}: Plantas, detalhes construtivos, memória de cálculo e ART conforme normas técnicas vigentes. Arquivos em ${form.formatoEntrega||"PDF e DWG"}.`)),
    ...(form.adicionaisInclusos?[new Paragraph({spacing:{before:60,after:60},children:[new TextRun({text:"Adicionais: ",bold:true,size:SZ,font:FONT}),new TextRun({text:form.adicionaisInclusos,size:SZ,font:FONT})]})]: []),
    new Paragraph({spacing:{before:100,after:60},children:[new TextRun({text:"3. O Que Não Está Incluso",bold:true,size:SZ,font:FONT})]}),
    ...(form.naoInclusos||[]).map(n=>par(`☐ ${n}`)),
    assTabela(["CONTRATANTE"],null,["CONTRATADA – WM Engenharia Integrada"],null),
  ]};

  const doc=new Document({sections:[secaoContrato,secaoAnexo]});
  const buffer=await Packer.toBuffer(doc);
  const nomeArq=`Contrato_WM_${(form.nomeCompleto||"Contrato").replace(/\s+/g,"_")}.docx`;
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition",`attachment; filename="${nomeArq}"`);
  res.send(buffer);
}
