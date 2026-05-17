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

  const dataFmt = d => {
    if (!d) return "___/___/______";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  const dataExtenso = d => {
    if (!d) return "";
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  };

  const extensoNum = n => ({ "1":"uma","2":"duas","3":"três","4":"quatro","5":"cinco" }[n] || n);
  const extensoPrazo = n => ({ "30":"trinta","45":"quarenta e cinco","60":"sessenta","65":"sessenta e cinco","90":"noventa","120":"cento e vinte" }[String(n)] || String(n));

  // Helpers de formatação
  const titulo = (texto) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
    children: [new TextRun({ text: texto.toUpperCase(), bold: true, size: 22, font: "Times New Roman" })]
  });

  const clausula = (id, texto) => new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({ text: `${id}. `, bold: true, size: 22, font: "Times New Roman" }),
      new TextRun({ text: texto, size: 22, font: "Times New Roman" })
    ]
  });

  const paragrafo = (texto, bold = false) => new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: texto, bold, size: 22, font: "Times New Roman" })]
  });

  const espaco = () => new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun("")] });

  const linhaSec = (texto) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: texto, bold: true, size: 22, font: "Times New Roman" })]
  });

  // Montar cláusulas cronograma
  const cronoRows = [];
  if (form.cronograma && form.cronograma.length > 0) {
    for (const etapa of form.cronograma) {
      cronoRows.push(new TableRow({
        children: [new TableCell({
          columnSpan: 3,
          shading: { fill: "1a4a7a", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: etapa.etapa, bold: true, color: "FFFFFF", size: 20, font: "Times New Roman" })] })]
        })]
      }));
      for (const t of (etapa.tarefas || [])) {
        cronoRows.push(new TableRow({
          children: [
            new TableCell({ width: { size: 5000, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.nome || "", size: 20, font: "Times New Roman" })] })] }),
            new TableCell({ width: { size: 2000, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.duracao || "", size: 20, font: "Times New Roman" })] })] }),
            new TableCell({ width: { size: 1200, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: t.pred || "", size: 20, font: "Times New Roman" })] })] }),
          ]
        }));
      }
    }
  }

  const children = [
    // Título
    espaco(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", bold: true, size: 26, font: "Times New Roman" })]
    }),

    // Partes
    titulo("Identificação das Partes Contratantes"),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 100, after: 80 },
      children: [
        new TextRun({ text: "CONTRATANTE: ", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `${form.nomeCompleto || ""}, ${form.tipoPessoa === "fisica" ? (form.nacionalidade || "") + ", " + (form.estadoCivil || "") + "," : ""} portador(a) do ${form.tipoPessoa === "fisica" ? "CPF" : "CNPJ"} nº ${form.cpfCnpj || ""}, domiciliado(a) na ${form.endereco || ""}, doravante denominado(a) simplesmente `, size: 22, font: "Times New Roman" }),
        new TextRun({ text: "CONTRATANTE", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ".", size: 22, font: "Times New Roman" }),
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({ text: "CONTRATADA: ", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: "WM Engenharia Integrada (Wilk Martins Engenharia Ltda), pessoa jurídica, CNPJ nº ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: "60.959.603/0001-47", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ", com sede na Av. JK, nº 1571, Bairro São Paulo, CEP 35.030-210, Governador Valadares/MG, representada pelos responsáveis técnicos: ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: "Jonathan Charles Lucas Martins Almeida Siqueira", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ", brasileiro, casado, Engenheiro Civil, CREA 394707/MG, RG nº MG-20.111.074, CPF nº 020.571.056-52; e ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: "Vinicius Wilk Bezerra Rezende", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ", brasileiro, casado, Engenheiro Civil, CREA 394892/MG, RG nº MG-20.597.543, CPF nº 120.912.666-47; doravante denominada simplesmente ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: "CONTRATADA", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ".", size: 22, font: "Times New Roman" }),
      ]
    }),
    paragrafo("As partes têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes."),

    // Objeto
    titulo("Do Objeto do Contrato"),
    clausula("Cláusula 1ª", `É objeto deste contrato a elaboração de ${(form.servicos || []).join(", ")} de uma edificação ${form.descricaoEdificacao || ""}${form.areaTotal ? ", com área total de " + form.areaTotal : ""}, localizada em ${form.cidadeUF || ""}${form.enderecoObra ? ", no endereço " + form.enderecoObra : ""}.`),
    clausula("Parágrafo único", "Os projetos seguirão as normas ABNT NBR 6118, NBR 6122, NBR 5626 e NBR 5410, com base no Projeto Arquitetônico do CONTRATANTE, conforme Anexo I, parte integrante deste instrumento."),

    titulo("Das Revisões e Alterações"),
    clausula("Cláusula 2ª", `O valor contratado contempla até ${form.rodadasRevisao || "2"} (${extensoNum(form.rodadasRevisao || "2")}) rodada(s) de revisão por disciplina. Revisões adicionais ou alterações no Projeto Arquitetônico após o início dos serviços serão orçadas separadamente e executadas mediante novo acordo escrito.`),

    titulo("Das Obrigações das Partes"),
    clausula("Cláusula 3ª", `O CONTRATANTE obriga-se a: (I) fornecer à CONTRATADA, em até ${form.prazoDocumentos || "5"} dias após a assinatura, todos os documentos do Anexo I; (II) manter disponibilidade para reuniões de alinhamento; (III) efetuar os pagamentos conforme Cláusula 7ª.`),
    clausula("Cláusula 4ª", "A CONTRATADA obriga-se a: (I) elaborar os projetos com qualidade técnica conforme normas vigentes; (II) fornecer cópia deste instrumento; (III) emitir recibos de todos os pagamentos; (IV) comunicar imediatamente qualquer fato que possa comprometer o prazo."),

    titulo("Da Entrega dos Projetos"),
    clausula("Cláusula 5ª", `A entrega será em formato digital (${form.formatoEntrega || "PDF e DWG"}), enviados ao e-mail ${form.email || "a ser informado posteriormente"}, com confirmação de recebimento. Considera-se concluída a entrega no envio dos arquivos finais, independentemente de manifestação de aceite.`),

    titulo("Da Propriedade Intelectual"),
    clausula("Cláusula 6ª", "Os projetos são protegidos pela Lei nº 9.610/1998 e permanecem de titularidade da CONTRATADA até a quitação integral. Após a quitação, os direitos de uso são cedidos ao CONTRATANTE exclusivamente para esta obra, sendo vedada a reprodução para outras edificações sem autorização escrita da CONTRATADA."),

    titulo("Do Preço e das Condições de Pagamento"),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 100, after: 80 },
      children: [
        new TextRun({ text: "Cláusula 7ª. ", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: "O serviço será remunerado pela quantia total de ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: fmtMoeda(form.valorTotal), bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `, pagos em: (I) `, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `Entrada (${form.percEntrada || "50"}%): `, bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `${fmtMoeda(entrada)}, devida na assinatura; (II) `, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `Parcela final (${100 - Number(form.percEntrada || 50)}%): `, bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `${fmtMoeda(parcFinal)}, devida na entrega conforme Cláusula 5ª. Pagamentos via TED/PIX. Atraso do CONTRATANTE: IPCA + multa 2% + juros 1% a.m. Atraso imputável à CONTRATADA: correção da parcela final pelo IPCA.`, size: 22, font: "Times New Roman" }),
      ]
    }),

    titulo("Do Inadimplemento e das Penalidades"),
    clausula("Cláusula 8ª", "Inadimplemento do CONTRATANTE: multa de 2%, juros de 1% ao mês e correção pelo IPCA. Em cobrança judicial: custas e honorários advocatícios de 20%."),
    clausula("Cláusula 9ª", "O descumprimento de qualquer cláusula, exceto a 7ª, sujeitará a parte infratora à multa compensatória de 5% do valor total, sem prejuízo de perdas e danos."),

    titulo("Da Rescisão Imotivada"),
    clausula("Cláusula 10ª", "Qualquer parte poderá rescindir este contrato a qualquer tempo, com notificação escrita prévia de 10 (dez) dias corridos."),
    clausula("Cláusula 11ª", "Rescisão pelo CONTRATANTE após pagamento: devolução deduzindo o proporcional executado (conforme Anexo II) e taxa administrativa de 2%."),
    clausula("Cláusula 12ª", "Rescisão pela CONTRATADA: devolução das etapas não executadas, acrescidos de taxa administrativa de 2% como indenização."),

    titulo("Do Prazo de Execução"),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 100, after: 80 },
      children: [
        new TextRun({ text: "Cláusula 13ª. ", bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: "Prazo de ", size: 22, font: "Times New Roman" }),
        new TextRun({ text: `${form.prazoExecucao || "65"} (${extensoPrazo(form.prazoExecucao || "65")}) dias corridos`, bold: true, size: 22, font: "Times New Roman" }),
        new TextRun({ text: ", contados a partir do atendimento simultâneo de: (I) assinatura do contrato; (II) recebimento da entrada; (III) recebimento do Projeto Arquitetônico e documentos do Anexo I. O prazo fica suspenso durante indisponibilidade do CONTRATANTE.", size: 22, font: "Times New Roman" }),
      ]
    }),
    clausula("Cláusula 14ª", "Atividades marcadas com ⚠ no Anexo II dependem da disponibilidade do CONTRATANTE e não serão imputadas à CONTRATADA em caso de atraso por sua parte."),

    ...(cronoRows.length > 0 ? [
      titulo("Cronograma de Execução — Anexo II"),
      new Table({
        width: { size: 8200, type: WidthType.DXA },
        columnWidths: [5000, 2000, 1200],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ width: { size: 5000, type: WidthType.DXA }, shading: { fill: "0d1e35", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Tarefa", bold: true, color: "FFFFFF", size: 20, font: "Times New Roman" })] })] }),
              new TableCell({ width: { size: 2000, type: WidthType.DXA }, shading: { fill: "0d1e35", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Duração", bold: true, color: "FFFFFF", size: 20, font: "Times New Roman" })] })] }),
              new TableCell({ width: { size: 1200, type: WidthType.DXA }, shading: { fill: "0d1e35", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Pred.", bold: true, color: "FFFFFF", size: 20, font: "Times New Roman" })] })] }),
            ]
          }),
          ...cronoRows
        ]
      }),
      espaco(),
    ] : []),

    titulo("Da Confidencialidade"),
    clausula("Cláusula 15ª", "As partes manterão sigilo sobre todas as informações técnicas, financeiras e pessoais por 5 (cinco) anos após o encerramento. A CONTRATADA poderá usar imagens não identificáveis da obra em portfólio mediante autorização do CONTRATANTE."),

    titulo("Das Condições Gerais"),
    clausula("Cláusula 16ª", "Inexistência de vínculo empregatício entre as partes."),
    clausula("Cláusula 17ª", "Vedada a subcontratação sem autorização escrita do CONTRATANTE, sob pena de rescisão imediata e multa da Cláusula 9ª."),
    clausula("Cláusula 18ª", "Este instrumento constitui o acordo integral. Alterações somente por escrito e assinadas por ambas as partes."),

    titulo("Do Foro"),
    clausula("Cláusula 19ª", "As partes elegem, com expressa renúncia a qualquer outro foro, o foro da Comarca de Governador Valadares, Estado de Minas Gerais."),

    espaco(),
    paragrafo("Por estarem assim justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor, na presença das testemunhas abaixo."),
    espaco(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 240 },
      children: [new TextRun({ text: `${form.cidade || "Governador Valadares"}, ${dataExtenso(form.dataAssinatura)}.`, size: 22, font: "Times New Roman" })]
    }),

    // Assinaturas
    espaco(),
    espaco(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 4 } },
      children: [new TextRun({ text: `CONTRATANTE: ${form.nomeCompleto || ""}`, bold: true, size: 22, font: "Times New Roman" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: `${form.tipoPessoa === "fisica" ? "CPF" : "CNPJ"}: ${form.cpfCnpj || ""}`, size: 22, font: "Times New Roman" })]
    }),

    new Table({
      width: { size: 8200, type: WidthType.DXA },
      columnWidths: [4100, 4100],
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 4100, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 80, bottom: 80, left: 0, right: 120 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jonathan Charles L. M. A. Siqueira", bold: true, size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CPF: 020.571.056-52", size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CREA: 394707/MG", size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "WM Engenharia Integrada", size: 20, font: "Times New Roman" })] }),
            ]
          }),
          new TableCell({
            width: { size: 4100, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 80, bottom: 80, left: 120, right: 0 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vinicius Wilk Bezerra Rezende", bold: true, size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CPF: 120.912.666-47", size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CREA: 394892/MG", size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "WM Engenharia Integrada", size: 20, font: "Times New Roman" })] }),
            ]
          }),
        ]
      })]
    }),

    espaco(),
    espaco(),
    new Table({
      width: { size: 8200, type: WidthType.DXA },
      columnWidths: [4100, 4100],
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 4100, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 80, bottom: 80, left: 0, right: 120 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Testemunha 1: ${form.testemunha1Nome || "[não informado]"}`, size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `CPF: ${form.testemunha1CPF || "[não informado]"}`, size: 20, font: "Times New Roman" })] }),
            ]
          }),
          new TableCell({
            width: { size: 4100, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "333333" }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 80, bottom: 80, left: 120, right: 0 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Testemunha 2: ${form.testemunha2Nome || "[não informado]"}`, size: 20, font: "Times New Roman" })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `CPF: ${form.testemunha2CPF || "[não informado]"}`, size: 20, font: "Times New Roman" })] }),
            ]
          }),
        ]
      })]
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1418, right: 1134, bottom: 1134, left: 1134 } // ~2.5cm top, 2cm others
        }
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  const nomeArq = `Contrato_WM_${(form.nomeCompleto || "Contrato").replace(/\s+/g, "_")}.docx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeArq}"`);
  res.send(buffer);
}
