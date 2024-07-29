<div align="center">

[English](../../README.rst) | **Português (Brasil)**

</div>

---

   <p align="center">
     <img src="https://raw.githubusercontent.com/qsniyg/maxurl/master/resources/imu_opera_banner_transparent.png" alt="Image Max URL" title="Image Max URL" />
   </p>

**Image Max URL** é um programa que busca versões maiores ou originais de imagens e vídeos, substituindo padrões de URL.

Suporta mais de 9000 sites (veja a lista completa em [sites-suportados.txt](sites-suportados.txt)), além de vários mecanismos genéricos como WordPress e MediaWiki.

Disponível como:

- **Userscript**: (maioria dos navegadores)
  - Estável: [userscript_smaller.user.js](https://github.com/qsniyg/maxurl/blob/master/userscript_smaller.user.js?raw=true) ou [OpenUserJS](https://openuserjs.org/scripts/qsniyg/Image_Max_URL)
  - Desenvolvimento: [userscript.user.js](https://github.com/qsniyg/maxurl/blob/master/userscript.user.js?raw=true) (recomendado)
  - Serve como base para todas as opções listadas abaixo. Também funciona como um módulo node (usado pelo bot do Reddit) e pode ser incorporado em um site.

- **Extensão de navegador**: [Firefox](https://addons.mozilla.org/firefox/addon/image-max-url/) (outros navegadores compatíveis com WebExtensions podem carregar a extensão via repositório git)
  - Extensões possuem mais privilégios que userscripts, oferecendo funcionalidades extras.
  - Código fonte: [manifest.json](https://github.com/qsniyg/maxurl/blob/master/manifest.json) e pasta [extension](https://github.com/qsniyg/maxurl/tree/master/extension)

- **Website**: [https://qsniyg.github.io/maxurl/](https://qsniyg.github.io/maxurl/)
  - Devido a restrições de segurança, algumas URLs (que exigem solicitações de origem cruzada) não são suportadas.
  - Código fonte: branch [gh-pages](https://github.com/qsniyg/maxurl/tree/gh-pages)

- **Bot do Reddit**: [/u/MaxImageBot](https://www.reddit.com/user/MaxImageBot/)
  - Código fonte: [comment-bot.js](https://github.com/qsniyg/maxurl/blob/master/reddit-bot/comment-bot.js) e [dourl.js](https://github.com/qsniyg/maxurl/blob/master/reddit-bot/dourl.js)

**Comunidade**:
- [Servidor Discord](https://discord.gg/fH9Pf54)
- [Matrix](https://matrix.to/#/#image-max-url:tedomum.net?via=tedomum.net)
- [Subreddit](http://reddit.com/r/MaxImage)

## Carregando a extensão manualmente

A extensão não está disponível em outras lojas (como Chrome e Microsoft Edge), mas pode ser carregada manualmente:

- **Repositório**:
  - Baixe o repositório (recomendado clonar via git para facilitar atualizações)
  - **Chromium**:
    - Vá para `chrome://extensions` ou `edge://extensions`, ative o "Modo de desenvolvedor", clique em "Carregar sem pacote" e navegue até a pasta clonada do maxurl.
  - **Firefox**:
    - Vá para `about:debugging -> Este Firefox`, selecione "Carregar complemento temporário..." e navegue até `manifest.json` na pasta clonada do maxurl.
    - A extensão será excluída ao fechar o Firefox.

- **CRX (navegadores baseados em Chromium)**:
  - Baixe o arquivo CRX em [ImageMaxURL_crx3.crx](https://github.com/qsniyg/maxurl/blob/master/build/ImageMaxURL_crx3.crx)
  - Vá para `chrome://extensions`, ative o "Modo do desenvolvedor", arraste e solte o arquivo CRX na página.

- **XPI (navegadores baseados em Firefox)**:
  - Baixe o arquivo XPI em [ImageMaxURL_signed.xpi](https://github.com/qsniyg/maxurl/blob/master/build/ImageMaxURL_signed.xpi)
  - Vá para `about:addons`, clique no ícone de engrenagem, selecione "Instalar complemento de arquivo..." e navegue até o arquivo XPI baixado.

## Contribuindo

Contribuições são bem-vindas! Para relatórios de bugs, solicitações de recursos ou novos sites, abra uma issue no repositório.

Se não tem uma conta Github, use os links da comunidade ou entre em contato diretamente [aqui](https://qsniyg.github.io/).

Para contribuir com código ou traduções, consulte [CONTRIBUTING.md](CONTRIBUTING.pt-BR.md).

## Integrando o IMU no seu programa

O `userscript.user.js` também funciona como um módulo Node.

```javascript
var maximage = require('./userscript.user.js');

maximage(smallimage, {
  // Se definido como false, retornará apenas a URL sem propriedades adicionais.
  // Recomendado manter como true para obter informações detalhadas.
  // Utilizado como um hack para verificar se o IMU já suporta uma regra.
  fill_object: true,

  // Número máximo de iterações para buscar a imagem maior.
  // Recomendado pelo menos 5.
  iterations: 200,

  // Define se deve armazenar e utilizar um cache interno para URLs.
  // Use "read" para usar o cache sem armazenar novos resultados.
  use_cache: true,

  // Tempo de validade (em segundos) para entradas no cache de URL.
  urlcache_time: 60 * 60,

  // Lista de problemas (ex: marcas d'água, imagens corrompidas) a serem excluídos.
  // Por padrão, todos os problemas são excluídos.
  // Defina como [] para não excluir nenhum problema.
  //exclude_problems: [],

  // Define se deve excluir vídeos dos resultados.
  exclude_videos: false,

  // Incluirá um histórico de objetos encontrados durante as iterações.
  // Desativar manterá apenas os objetos da última iteração bem-sucedida.
  include_pastobjs: true,

  // Tentará encontrar a página original da imagem, mesmo que exija solicitações extras.
  force_page: false,

  // Permite o uso de regras que utilizam sites de terceiros para encontrar imagens maiores.
  allow_thirdparty: false,

  // Implementa uma lista negra ou lista branca de URLs.
  // Se não especificado, aceita todas as URLs.
  filter: function(url) {
    return true;
  },

  // Função auxiliar para realizar solicitações HTTP, usada para sites como Flickr.
  // Espera-se que a API seja semelhante à API GM_xmlHTTPRequest.
  // Uma implementação usando o módulo de solicitação do Node pode ser encontrada em reddit-bot/dourl.js
  do_request: function(options) {
    // options = {
    //   url: "",
    //   method: "GET",
    //   data: "", // para method: "POST"
    //   overrideMimeType: "", // usado para decodificar conjuntos de caracteres alternativos
    //   headers: {}, // Se um cabeçalho for null ou "", não inclua esse cabeçalho
    //   onload: function(resp) {
    //     // resp é esperado como um objeto semelhante a XMLHttpRequest, implementando estes campos:
    //     //   finalUrl
    //     //   readyState
    //     //   responseText
    //     //   status
    //   }
    // }
  },

  // Função de callback para processar os resultados.
  cb: function(result) {
    if (!result) return;

    if (result.length === 1 && result[0].url === smallimage) {
       // Nenhuma imagem maior foi encontrada.
       return;
    }

    for (var i = 0; i < result.length; i++) {
      // Processa o objeto resultante.
    }
  }
});
```

O resultado é uma lista de objetos com propriedades úteis:

```javascript
[{
  // URL da imagem
  url: null,

  // Se a URL é de um vídeo
  video: false,

  // Se a URL deve funcionar sempre
  // Não dependa deste valor se não for necessário
  always_ok: false,

  // Se a URL provavelmente funcionará
  likely_broken: false,

  // Se o servidor suporta requisições HEAD
  can_head: true,

  // Lista de erros HEAD que podem ser ignorados
  head_ok_errors: [],

  // Se o servidor pode retornar um cabeçalho Content-Type incorreto na requisição HEAD
  head_wrong_contenttype: false,

  // Se o servidor pode retornar um cabeçalho Content-Length incorreto na requisição HEAD
  head_wrong_contentlength: false,

  // Se a URL está aguardando processamento
  // Este valor será sempre falso se um callback estiver sendo usado
  waiting: false,

  // Se a URL redireciona para outra URL
  redirects: false,

  // Se a URL é temporária ou funciona apenas no IP atual (como um link de download gerado)
  is_private: false,

  // Se a URL é da imagem original armazenada nos servidores do site
  is_original: false,

  // Se true, não deve inserir esta URL novamente no IMU
  norecurse: false,

  // Se a URL deve ser usada ou não
  // Se true, trate como um erro 404
  // Se "mask", esta imagem é uma máscara sobreposta
  bad: false,

  // Lista de condições para considerar a imagem ruim
  // Exemplo:
  // [{
  //    headers: {"Content-Length": "1000"},
  //    status: 301
  // }]
  // Use maximage.check_bad_if(bad_if, resp) para verificar se a resposta corresponde a uma condição ruim
  // (resp é esperado como um objeto XHR)
  bad_if: [],

  // Se a URL é uma URL "falsa" usada internamente (ou seja, se true, não use esta URL)
  fake: false,

  // Cabeçalhos necessários para visualizar a URL retornada
  // Se um cabeçalho for null, não inclua esse cabeçalho
  headers: {},

  // Propriedades adicionais que podem ser úteis
  extra: {
    // Página original onde a imagem estava hospedada
    page: null,

    // Título ou legenda anexada à imagem
    caption: null
  },

  // Nome de arquivo descritivo para a imagem
  filename: "",

  // Lista de problemas com a imagem. Use exclude_problems para excluir imagens com problemas específicos
  problems: {
    // Se true, a imagem é provavelmente maior que a inserida, mas contém uma marca d'água (quando a inserida não tem)
    watermark: false,

    // Se true, a imagem é provavelmente menor que a inserida, mas não tem marca d'água
    smaller: false,

    // Se true, a imagem pode ser totalmente diferente da inserida
    possibly_different: false,

    // Se true, a imagem pode estar corrompida (como GIFs no Tumblr)
    possibly_broken: false
  }
}]
```
