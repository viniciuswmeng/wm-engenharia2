// Portal do cliente — Termos de uso, Política de Privacidade (LGPD) e Política de Cookies.
// Usado pelo aceite no primeiro acesso e pela aba "Privacidade" do portal (cliente.html).
// Ao mudar o texto de forma relevante, troque a "versao": todos os clientes verão o aceite de novo.
(function () {
  var EMAIL = "projeto@wmengenhariaintegrada.com.br", FONE = "(33) 98416-1081";
  window.WM_LEGAL = {
    versao: "2026-11-19",
    atualizado: "19/11/2026",
    resumo:
      '<p>Este portal mostra as informações do seu projeto com a <b>WM Engenharia Integrada</b>. Antes de continuar, leia e aceite os <b>Termos de uso</b>. Em resumo:</p>' +
      '<ul>' +
        '<li>O link é <b>pessoal</b>: quem tiver o endereço vê o seu projeto. Compartilhe só com quem participa da obra.</li>' +
        '<li>Usamos os seus dados <b>apenas para executar o projeto contratado</b>, cumprir obrigações legais e manter o portal seguro. Não vendemos dados nem usamos para publicidade.</li>' +
        '<li>O portal <b>não usa cookies de publicidade nem de rastreamento</b>; guarda no seu navegador só a lembrança deste aceite.</li>' +
        '<li>Respostas enviadas por aqui (formulário, aprovações e pedidos de ajuste) ficam registradas com data e hora.</li>' +
        '<li>Você pode pedir acesso, correção ou exclusão dos seus dados pelo e-mail ' + EMAIL + '.</li>' +
      '</ul>',
    docs: [
      { id: "termos", titulo: "Termos de uso", html:
        '<p>Estes termos regem o uso do Portal do Cliente da <b>WM Engenharia Integrada</b> ("WM"), com sede em Governador Valadares/MG, pelo contratante do projeto e pelas pessoas que ele autorizar ("você"). Ao tocar em <b>Aceitar e entrar</b>, você declara que leu e concorda com estes termos.</p>' +
        '<h4>1. Para que serve o portal</h4><p>Acompanhar o andamento do projeto contratado, responder o formulário de cadastro da obra, ver e responder a apresentação de interiores, consultar atas de reunião, baixar as entregas e abrir os modelos 3D.</p>' +
        '<h4>2. Acesso pelo link</h4><p>O acesso é feito por um link individual, sem senha. Você é responsável por guardar o link e compartilhá-lo só com quem participa da obra (por exemplo, o arquiteto ou o construtor). Se o link for repassado por engano, avise a WM: um link novo é gerado e o anterior deixa de funcionar na hora.</p>' +
        '<h4>3. Manifestações pelo portal</h4><p>As respostas do formulário, as aprovações de ambientes e os pedidos de ajuste enviados pelo portal valem como manifestação do contratante sobre o projeto e são registrados com data e hora. Mudanças pedidas depois de uma etapa aprovada podem ser tratadas como alteração de escopo, conforme o contrato.</p>' +
        '<h4>4. Projetos e arquivos</h4><p>Os projetos, pranchas, memoriais, modelos 3D e imagens são obras técnicas protegidas pela Lei de Direitos Autorais (Lei nº 9.610/1998) e pela legislação profissional. O seu uso está autorizado para a obra contratada. Reproduzir, alterar ou usar em outra obra depende de autorização por escrito da WM. As imagens de apresentação são ilustrativas: valem as especificações do projeto executivo.</p>' +
        '<h4>5. Uso adequado</h4><p>Não é permitido tentar acessar projetos de terceiros, testar links aleatórios, sobrecarregar o sistema ou burlar as proteções. Tentativas desse tipo são registradas e bloqueadas.</p>' +
        '<h4>6. Disponibilidade</h4><p>A WM se esforça para manter o portal no ar, mas ele pode ficar indisponível por manutenção ou falhas de terceiros (internet, hospedagem). Os links de download têm validade limitada por segurança e são renovados quando você abre o portal. O portal é um canal de acompanhamento e não substitui o contrato nem as comunicações formais.</p>' +
        '<h4>7. Dados pessoais</h4><p>O tratamento dos seus dados segue a <b>Política de Privacidade</b> e a <b>Política de Cookies</b> abaixo, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).</p>' +
        '<h4>8. Alterações e foro</h4><p>Estes termos podem ser atualizados; quando a mudança for relevante, o portal pedirá um novo aceite. Fica eleito o foro da comarca de Governador Valadares/MG, ressalvados os direitos do consumidor.</p>' },

      { id: "privacidade", titulo: "Política de Privacidade (LGPD)", html:
        '<p>Esta política explica como a <b>WM Engenharia Integrada</b>, controladora dos dados, trata os dados pessoais no Portal do Cliente, de acordo com a Lei nº 13.709/2018 (LGPD).</p>' +
        '<h4>1. Quais dados tratamos</h4><ul>' +
          '<li><b>Dados do contrato e do projeto</b>: nome do cliente, código e tipo do projeto, endereço da obra, prazos e andamento.</li>' +
          '<li><b>Respostas do formulário de cadastro</b>: dados da obra, rotina e preferências da família para cada ambiente.</li>' +
          '<li><b>Respostas da apresentação de interiores</b>: aprovações, pedidos de ajuste e comentários.</li>' +
          '<li><b>Documentos do projeto</b>: atas de reunião, pranchas, memoriais e modelos 3D.</li>' +
          '<li><b>Registros técnicos</b>: endereço IP, navegador, data e hora do aceite destes termos e de tentativas de acesso com links inválidos.</li>' +
        '</ul>' +
        '<h4>2. Para que usamos (e com qual base legal)</h4><ul>' +
          '<li>Elaborar e entregar o projeto contratado e falar com você sobre ele — <i>execução de contrato</i> (art. 7º, V).</li>' +
          '<li>Cumprir obrigações legais e profissionais, como a responsabilidade técnica perante o CREA — <i>obrigação legal</i> (art. 7º, II).</li>' +
          '<li>Manter o portal seguro, prevenir fraudes e acessos indevidos — <i>legítimo interesse</i> (art. 7º, IX).</li>' +
          '<li>Guardar a prova do que foi combinado e aprovado — <i>exercício regular de direitos</i> (art. 7º, VI).</li>' +
        '</ul><p>Não usamos os seus dados para publicidade, não vendemos dados e não fazemos decisões automatizadas sobre você.</p>' +
        '<h4>3. Com quem compartilhamos</h4><p>Só com fornecedores que operam o portal em nosso nome, sob contrato e com medidas de segurança: <b>Supabase</b> (banco de dados e arquivos), <b>Vercel</b> (hospedagem do site) e <b>Google</b> (Google Drive, onde ficam as pastas de entregas e as imagens, e fontes de texto da apresentação). Alguns desses serviços guardam dados em servidores fora do Brasil, com as garantias previstas no art. 33 da LGPD. Também podemos compartilhar dados quando a lei ou uma autoridade exigir, e com os profissionais da obra que você indicar.</p>' +
        '<h4>4. Por quanto tempo guardamos</h4><p>Enquanto durar o contrato e, depois, pelo prazo necessário para cumprir obrigações legais e profissionais e para a defesa em eventuais processos. Depois disso, os dados são eliminados ou anonimizados.</p>' +
        '<h4>5. Como protegemos</h4><p>Conexão criptografada (HTTPS), link individual e desativável a qualquer momento, arquivos em armazenamento privado com links temporários (atas por 7 dias, modelos 3D por 2 horas), acesso da equipe só com login e registro de tentativas de acesso indevido.</p>' +
        '<h4>6. Seus direitos (art. 18 da LGPD)</h4><p>Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; portabilidade; informação sobre com quem compartilhamos; e revisão desta política. Também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD). Alguns dados podem ser mantidos quando a lei exigir.</p>' +
        '<h4>7. Encarregado e contato</h4><p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o encarregado de dados da WM pelo e-mail <b>' + EMAIL + '</b> ou pelo WhatsApp <b>' + FONE + '</b>. Respondemos em até 15 dias.</p>' },

      { id: "cookies", titulo: "Política de Cookies", html:
        '<p>Cookies e armazenamento local são pequenos registros que um site guarda no seu navegador.</p>' +
        '<h4>O que o portal usa</h4><ul>' +
          '<li><b>Armazenamento local do navegador (necessário)</b>: guarda só a informação de que você aceitou estes termos, e a versão aceita, para não perguntar de novo a cada visita. Não contém dados do projeto.</li>' +
        '</ul>' +
        '<h4>O que o portal não usa</h4><p>Não usamos cookies de publicidade, de rastreamento entre sites nem ferramentas de análise de navegação (como Google Analytics ou pixels de redes sociais).</p>' +
        '<h4>Conteúdo de terceiros</h4><p>Ao abrir imagens e arquivos guardados no Google Drive, ou as fontes de texto da apresentação, o seu navegador se conecta aos servidores do Google, que recebem dados técnicos como o endereço IP, conforme a política de privacidade do próprio Google. Ao baixar arquivos pelo Drive, valem também as regras do Google.</p>' +
        '<h4>Como apagar</h4><p>Você pode limpar os dados do site nas configurações do navegador. Nesse caso, o portal pedirá o aceite dos termos de novo no próximo acesso.</p>' }
    ]
  };
})();
