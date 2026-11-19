// Guia do Portal do Cliente — conteúdo único usado pela aba "Ajuda" do portal (cliente.html)
// e pela página de impressão (portal/guia.html), que gera o manual em PDF.
// Texto fixo, escrito pela equipe (sem dados de clientes). As imagens usam um projeto fictício.
(function () {
  var F = function (img, legenda, celular) {
    return '<figure class="g-fig' + (celular ? ' g-cel' : '') + '"><img src="/portal/guia/' + img + '.jpg" alt="' + legenda + '" loading="lazy"><figcaption>' + legenda + '</figcaption></figure>';
  };
  var B = function (t) { return '<span class="g-bt">' + t + '</span>'; };
  var T = function (t, cls) { return '<span class="g-tag ' + (cls || '') + '">' + t + '</span>'; };

  window.WM_GUIA = {
    titulo: "Como acompanhar o seu projeto pelo portal",
    intro: "Pelo link que enviamos, você vê o andamento, responde o formulário da obra, aprova a apresentação de interiores, baixa as entregas e abre os modelos 3D. Este guia mostra cada parte em poucos minutos.",
    aviso: "As imagens deste guia usam um projeto de exemplo, com nomes e datas fictícios. No seu link aparecem os dados do seu projeto.",
    secoes: [
      { id: "acessar", titulo: "Como acessar", html:
        '<div class="g-lado">' +
          '<div><ol class="g-passos">' +
            '<li>Abra o link que enviamos por WhatsApp ou e-mail. Ele começa com <b>sistema.wmengenhariaintegrada.com.br/cliente/</b>.</li>' +
            '<li>A página abre direto no seu projeto. Não precisa de senha nem de cadastro.</li>' +
            '<li>Salve o link nos favoritos do navegador, ou fixe a conversa no WhatsApp, para voltar quando quiser.</li>' +
          '</ol>' +
          '<p>Funciona no celular, no tablet e no computador: a página se ajusta ao tamanho da tela, sem textos cortados. As informações se atualizam sozinhas — cada vez que você abre o link, vê a situação do projeto naquele momento.</p>' +
          '<p>No topo ficam o código do projeto, o nome, o tipo de serviço e a situação atual (por exemplo, ' + T("Em andamento", "g-azul") + '). Logo abaixo, o menu leva direto a cada seção — inclusive a esta <b>Ajuda</b>.</p></div>' +
          F("celular", "O portal no celular.", true) +
        '</div>' },

      { id: "visao", titulo: "Visão geral", html:
        '<p>Quatro números resumem o projeto: o <b>andamento</b> em porcentagem, a <b>entrega prevista</b> com os dias que faltam, quantas <b>disciplinas</b> já foram entregues e quantos <b>arquivos</b> estão disponíveis para baixar.</p>' +
        '<p>Quando a equipe tem um aviso para você, ele aparece na faixa amarela <b>Recado da equipe</b>.</p>' +
        F("visao", "Tela inicial do portal no computador.") },

      { id: "formulario", titulo: "Formulário de cadastro", html:
        '<p>O formulário reúne o que precisamos saber para projetar: dados da obra, rotina da família e o que você quer em cada ambiente. Quanto mais completo, menos ajustes depois. Enquanto ele não for enviado, a seção aparece como <b>Formulário · falta a sua parte</b>.</p>' +
        F("form-card", "O formulário esperando as suas respostas.") +
        '<ol class="g-passos">' +
          '<li>Toque em ' + B("Preencher agora") + '. O formulário abre em outra aba.</li>' +
          '<li>Responda as perguntas. Muitas têm opções prontas; algumas aceitam mais de uma.</li>' +
          '<li>Em <b>Ambientes</b>, preencha cada cômodo. Se faltar algum, use <b>Adicionar ambiente</b>.</li>' +
          '<li>As respostas são salvas sozinhas. Pode parar e continuar depois pelo mesmo link: o botão passa a mostrar ' + B("Continuar") + '.</li>' +
          '<li>Ao terminar, toque em <b>Enviar respostas</b>, no final da página. A situação muda para ' + T("✓ Enviado", "g-verde") + ' e a equipe é avisada.</li>' +
        '</ol>' +
        F("form-pagina", "A barra no topo mostra quantas perguntas já foram respondidas.") +
        '<p>Depois de enviar, você ainda pode corrigir uma resposta pelo botão <b>Ver respostas</b>, até a equipe encerrar o formulário para começar o projeto.</p>' },

      { id: "interiores", titulo: "Apresentação de interiores", novo: true, html:
        '<p>Nos projetos de interiores, a proposta de cada ambiente chega pelo portal. Você vê as imagens, a planta, as cores e os materiais, e responde ambiente por ambiente: <b>aprovar</b> ou <b>pedir ajuste</b>.</p>' +
        F("interiores", "A apresentação no portal, com a situação da sua resposta.") +
        '<p>A situação aparece ao lado: ' + T("Aguardando você", "g-azul") + ' enquanto você não respondeu, ' + T("Em análise", "g-amarelo") + ' quando já há respostas e ' + T("✓ Resposta enviada", "g-verde") + ' depois de enviar para a equipe. Toque em ' + B("Abrir apresentação") + ' para começar.</p>' +
        '<h4>Capa e planta</h4>' +
        '<p>A capa mostra o projeto, a versão (R00, R01…) e os ambientes. Toque em <b>Começar a apresentação</b>. Na planta do projeto, toque num ambiente para ir direto às imagens dele.</p>' +
        F("ap-capa", "Capa da apresentação.") + F("ap-planta", "Planta clicável: cada área leva ao seu ambiente.") +
        '<h4>Cada ambiente</h4>' +
        '<ul class="g-lista">' +
          '<li><b>Imagens</b>: a principal em destaque e as outras em miniatura logo abaixo. Toque para ampliar.</li>' +
          '<li><b>Planta baixa</b>: no alto, à direita, mostra onde fica o ambiente. Use <b>ver na planta</b> para ver a planta inteira.</li>' +
          '<li><b>Paleta</b>, <b>Materiais</b> e <b>Mobiliário</b>: as cores, os acabamentos e os itens escolhidos para o ambiente.</li>' +
          '<li>Quando houver, <b>Antes × depois</b> compara a foto atual com a proposta, e <b>Ver em 360°</b> abre a imagem panorâmica.</li>' +
        '</ul>' +
        F("ap-ambiente", "Um ambiente: imagens à esquerda; planta, paleta e materiais à direita.") +
        '<h4>Aprovar ou pedir ajuste</h4>' +
        '<ol class="g-passos">' +
          '<li>Gostou? Toque em ' + B("✓ Aprovar ambiente") + '.</li>' +
          '<li>Quer mudar algo? Toque em <b>Pedir ajuste</b>, toque no ponto da imagem que você quer comentar e escreva o que deseja. Toque em <b>Salvar comentário</b>. Pode marcar vários pontos, ou usar <b>Comentar sem marcar ponto</b>.</li>' +
          '<li>Mudou de ideia? <b>Desfazer minha resposta</b> volta o ambiente para sem resposta.</li>' +
        '</ol>' +
        F("ap-ajuste", "Pedido de ajuste: o número marca o ponto comentado na imagem.") +
        '<h4>Enviar a resposta</h4>' +
        '<p>No final, o <b>Resumo</b> mostra o que você respondeu em cada ambiente. Toque em ' + B("Enviar minha resposta para a equipe") + '. As respostas ficam salvas enquanto você navega; só são enviadas nesse botão.</p>' +
        F("ap-resumo", "Resumo antes de enviar.") +
        '<div class="g-dica">Quando a equipe publicar uma nova versão com os ajustes, ela aparece no mesmo lugar, e em cada ambiente você vê o que pediu na versão anterior. Use ' + B("Baixar PDF") + ', no topo, para guardar a apresentação completa.</div>' },

      { id: "atas", titulo: "Atas de reunião", html:
        '<p>Cada reunião do projeto gera uma ata. Ela aparece como ' + T("Aguardando assinatura", "g-amarelo") + ' até todos assinarem. Depois de assinada, mostra ' + T("✓ Assinada", "g-verde") + ' e o botão ' + B("⬇ Baixar ata") + '.</p>' +
        F("atas", "Atas assinadas e aguardando assinatura.") +
        '<p>Por segurança, o link de download da ata vale por 7 dias e é renovado sempre que você abre o portal. Se ele não abrir, atualize a página.</p>' },

      { id: "entregas", titulo: "Entregas do projeto", html:
        '<p>Cada entrega, parcial ou final, aparece num quadro com a data, um recado da equipe e os arquivos (pranchas em PDF, memoriais, planilhas, modelos). Os arquivos ficam <b>separados por disciplina</b> — Estrutural, Hidráulico, Sanitário, Elétrico… — cada uma com a sua cor, para achar rápido o que procura.</p>' +
        '<ul class="g-lista">' +
          '<li>' + B("Ver") + ' abre o arquivo no navegador.</li>' +
          '<li>' + B("Baixar") + ' salva o arquivo no seu aparelho.</li>' +
          '<li>' + B("⬇ Baixar tudo") + ' abre a pasta da entrega no Google Drive. Lá, use <b>Fazer download</b> para baixar todos os arquivos de uma vez.</li>' +
        '</ul>' +
        F("entregas", "Uma entrega com os arquivos separados por disciplina.") },

      { id: "modelos", titulo: "Modelos 3D", html:
        '<p>Os modelos BIM do projeto ficam separados em dois grupos:</p>' +
        '<ul class="g-lista"><li>' + T("PRELIMINAR", "g-azul") + ' versões de estudo, para conferência e aprovação.</li><li>' + T("FINAL", "g-verde") + ' versão final, para execução da obra.</li></ul>' +
        '<p>Toque em um modelo para abrir só aquela disciplina, ou em <b>Todos os modelos … sobrepostos</b> para ver todas juntas e conferir como estrutura, hidráulica e elétrica se encaixam. Não precisa instalar nenhum programa.</p>' +
        F("modelos", "Modelos finais e preliminares.") },

      { id: "visualizador", titulo: "Usando o visualizador 3D", html:
        '<p>O modelo abre numa página própria. No topo aparecem o projeto e as disciplinas carregadas. Em modelos grandes, aguarde a mensagem <b>Baixando…</b> terminar.</p>' +
        F("viewer", "Três disciplinas sobrepostas. Modelo simplificado, só para ilustrar.") +
        '<h4>Mover a vista</h4>' +
        '<table class="g-tab"><thead><tr><th>Para</th><th>No computador</th><th>No celular</th></tr></thead><tbody>' +
          '<tr><td>Girar</td><td>Arraste com o botão esquerdo</td><td>Arraste com um dedo</td></tr>' +
          '<tr><td>Aproximar e afastar</td><td>Rodinha do mouse</td><td>Pinça com dois dedos</td></tr>' +
          '<tr><td>Mover para o lado</td><td>Arraste com o botão direito</td><td>Arraste com dois dedos</td></tr>' +
          '<tr><td>Vistas prontas</td><td colspan="2">3D, Topo, Frente e Lateral, no canto superior direito</td></tr>' +
        '</tbody></table>' +
        '<h4>Ligar e desligar disciplinas</h4>' +
        '<p>Toque no olho ao lado de cada modelo (no canto superior esquerdo ou no painel <b>Modelo</b>) para esconder ou mostrar aquela disciplina. No painel também dá para esconder só uma categoria, como pilares ou tubulações.</p>' +
        F("viewer-oculto", "Com a estrutura escondida, ficam só as instalações.") +
        '<h4>Ver as informações de um elemento</h4>' +
        '<p>Clique ou toque em qualquer peça do modelo. A aba <b>Propriedades</b> mostra o nome, o tipo e os dados dela. Ali também estão <b>Isolar</b> (mostra só a peça), <b>Ocultar</b> e <b>Mostrar todos</b>.</p>' +
        '<h4>Ferramentas da barra inferior</h4>' +
        '<table class="g-tab"><thead><tr><th>Ferramenta</th><th>Para que serve</th></tr></thead><tbody>' +
          '<tr><td>Enquadrar modelo</td><td>Volta a mostrar o modelo inteiro na tela.</td></tr>' +
          '<tr><td>Corte horizontal</td><td>Corta o modelo numa altura para ver o interior; ajuste a altura na barra que aparece.</td></tr>' +
          '<tr><td>Raio-X</td><td>Deixa tudo transparente para enxergar o que está embutido.</td></tr>' +
          '<tr><td>Arestas</td><td>Mostra só as linhas dos elementos.</td></tr>' +
          '<tr><td>Modo caminhar</td><td>No computador, passeia por dentro com W A S D (Q e E sobem e descem; Esc sai).</td></tr>' +
          '<tr><td>Cores do modelo</td><td>Pinta por categoria ou por arquivo (uma cor por disciplina).</td></tr>' +
          '<tr><td>Salvar imagem</td><td>Baixa uma foto da vista atual.</td></tr>' +
          '<tr><td>Tela cheia</td><td>Ocupa a tela toda.</td></tr>' +
        '</tbody></table>' +
        '<p>Por segurança, o arquivo do modelo é liberado por 2 horas a cada abertura. Se a página ficar aberta muito tempo e parar de carregar, abra o link de novo.</p>' },

      { id: "andamento", titulo: "Andamento", html:
        '<p>A barra maior mostra o andamento geral do projeto. Abaixo, cada disciplina tem a sua porcentagem e o selo ' + T("✓ Entregue", "g-verde") + ' com a data, quando concluída. À direita aparecem os nomes da equipe responsável.</p>' +
        F("andamento", "Andamento geral e por disciplina.") },

      { id: "duvidas", titulo: "Segurança e dúvidas frequentes", html:
        '<p>O link é pessoal: quem tiver o endereço vê as informações do seu projeto. Compartilhe só com quem participa da obra, como o arquiteto ou o construtor. Se ele for repassado por engano, peça um link novo; o anterior para de funcionar na hora.</p>' +
        '<div class="g-faq">' +
          '<details><summary>O link não abre ou diz que foi desativado</summary><p>Confira se o endereço foi copiado inteiro. Se continuar, fale conosco para receber um link novo.</p></details>' +
          '<details><summary>Não aparece a seção de Atas, Interiores ou Modelos 3D</summary><p>Essas seções só aparecem quando já têm conteúdo para você.</p></details>' +
          '<details><summary>Um arquivo não baixa</summary><p>Atualize a página e tente de novo. No celular, abra o link pelo navegador (Chrome ou Safari), e não pela pré-visualização do WhatsApp.</p></details>' +
          '<details><summary>O modelo 3D fica carregando</summary><p>Modelos grandes demoram mais no celular ou em internet lenta. Prefira o Wi-Fi ou o computador, e reabra o link se ficou muito tempo aberto.</p></details>' +
          '<details><summary>Enviei a resposta da apresentação e quero mudar</summary><p>Enquanto a equipe não publicar uma nova versão, abra a apresentação, mude a resposta do ambiente e toque em <b>Enviar de novo para a equipe</b>.</p></details>' +
          '<details><summary>Preciso mudar uma resposta depois que o formulário foi encerrado</summary><p>Fale com o responsável pelo projeto, que faz o ajuste para você.</p></details>' +
        '</div>' }
    ],
    contato: { email: "projeto@wmengenhariaintegrada.com.br", whatsapp: "(33) 98416-1081", wa: "5533984161081", instagram: "@engenharia.wm" }
  };
})();
