### Traduções

As traduções são feitas através de arquivos padrão `.po` (gettext), localizados no [subdiretório `po`](https://github.com/qsniyg/maxurl/tree/master/po). Você pode traduzir manualmente usando um editor de texto ou utilizar ferramentas de tradução `.po`, como [Poedit](https://poedit.net/) ou [POEditor](https://poeditor.com/) (online).

Para testar uma tradução modificada, execute: `node tools/update_from_po.js`. Isso atualizará `src/userscript.ts` com as traduções do subdiretório `po`.

**Nota:** Ao enviar uma pull request para uma tradução, não inclua o arquivo `userscript.ts` modificado para evitar conflitos de mesclagem.

Para adicionar suporte a um novo idioma, crie um novo arquivo `.po` para o código do idioma a partir de [po/imu.pot](https://github.com/qsniyg/maxurl/blob/master/po/imu.pot) e certifique-se de traduzir `$language_native$` (a palavra nativa para seu idioma, como "Français" para francês ou "한국어" para coreano).

### Contribuições de Sites/Regras

Se você encontrar problemas com regras existentes ou quiser sugerir novos sites, **abra uma issue**. Pull requests são aceitas (especialmente se a regra for complexa), mas devido ao armazenamento atual em um único arquivo (`src/userscript.ts`), pode haver conflitos de mesclagem.

Se decidir fazer uma pull request, siga estas diretrizes gerais. Não se preocupe em acertar perfeitamente; posso corrigir eventuais erros.

- **Verifique se a regra já existe:** 

  - Há a chance de a regra existir, mas sem suporte para o site específico. Pesquise no script usando regex para ver se uma regra semelhante já foi criada.

- **Novas regras específicas de sites:** 

  - Adicione antes da linha `// -- general rules --`.
  - Regras gerais são adicionadas no final da seção de regras gerais.
  - Algumas regras precisam estar acima de outras por vários motivos (ex.: regras específicas de host).

- **Use `domain`, `domain_nosub` ou `domain_nowww` com comparação `===` para a verificação `if`:**

  - Para testes regex, use `/regex/.test(...)` após a comparação inicial `===`.
    Por exemplo, se você quiser corresponder a `img[0-9]+\.example\.com`, pode usar `if (domain_nosub === "example.com" && /^img[0-9]+\./.test(domain))`.
    Isso ajuda a garantir que o desempenho não será muito ruim.
  - `domain_nowww` corresponde a example.com e www.example.com. Use `domain_nowww` a menos que ambos os domínios sejam diferentes.
  - Para buckets da Amazon, use `amazon_container === "bucket"`. 
    Note que ambas as formas de URL são geralmente (sempre?) válidas, então certifique-se de que a regra considera ambas.
    Por exemplo, tenha cuidado ao fazer algo como: `://[^/]+\/+images\/+`, pois não funcionará para a segunda forma.

- **Use funções wrapper do script:** 

  - Ex.: `array_indexof` ou `string_indexof` em vez de `foo.indexOf()`, `base64_decode` em vez de `atob`, `JSON_parse` em vez de `JSON.parse`.
    Isso ocorre porque alguns sites (ou bloqueadores de anúncios) substituem essas funções com implementações quebradas.
    O IMU usará sua própria implementação dessas funções se a versão do navegador falhar em alguns testes de sanidade.
    - Procure por `var JSON_parse` no userscript para encontrar uma lista delas.

- **Funções auxiliares úteis:** (você pode encontrar uma lista delas em `variables_list` em [tools/gen_rules_js.js](https://github.com/qsniyg/maxurl/blob/master/tools/gen_rules_js.js)). Elas estão atualmente sem documentação, mas aqui está uma lista das mais comumente usadas:

  - `get_queries`: Retorna consultas como um objeto:
    - `get_queries("https://example.com/?a=5&b=10")` -> `{a: 5, b: 10}`
  - `remove_queries`: Remove consultas especificadas:
    - `remove_queries("https://example.com/?a=5&b=10&c=20", ["b", "c"])` -> `"https://example.com/?a=5"`
    - `remove_queries("https://example.com/?a=5&b=10&c=20", "b")` -> `"https://example.com/?a=5&c=20"`

  - `keep_queries`: Remove todas as consultas, exceto as especificadas:
    - `keep_queries("https://example.com/?a=5&b=10&c=20", ["b", "c"])` -> `"https://example.com/?b=10&c=20"`
    - `keep_queries("https://example.com/?a=5&b=10&c=20", "b")` -> `"https://example.com/?b=10"`
    - `keep_queries("https://example.com/?a=5&b=10&c=20", ["b", "c"], {overwrite: {"c": 1, "d": 2}})` -> `"https://example.com/?b=10&c=1&d=2"`
    - `keep_queries("https://example.com/?a=5&b=10", ["b", "c"], {required: ["c"]})` -> `"https://example.com/?a=5&b=10"`
  - `add_queries`: Adiciona ou sobrescreve consultas:
    - `add_queries("https://example.com/?a=5&b=10", {b: 20, c: 30})` -> `"https://example.com/?a=5&b=20&c=30"`

  - `decodeuri_ifneeded`: Executa `decodeURIComponent` se uma URL parecer codificada:
    - `decodeuri_ifneeded("https%3A%2F%2Fexample.com%2F")` -> `"https://example.com/"`
    - `decodeuri_ifneeded("https%253A%252F%252Fexample.com%252F")` -> `"https://example.com/"` (suporta decodificação mais de uma vez)
    - `decodeuri_ifneeded("https://example.com/?a=5%20")` -> `"https://example.com/?a=5%20"` (inalterado porque `https://` não está codificado)
    - Use esta função se quiser retornar uma URL de uma consulta (por exemplo, `https://example.com/thumb.php?img=https%3A%2F%2Fexample.com%2Ftest.png`)

- **Adicione casos de teste:**

  - Formato geral:

    ```ts
    // https://img1.example.com/thumbs/image.jpg -- imagem menor
    //   https://img1.example.com/medium/image.jpg -- imagem maior
    //   https://img1.example.com/images/image.jpg -- maior imagem
    ```

  - O "formato" é bastante solto, então não se preocupe muito em acertá-lo.
  - **Por favor, não adicione nenhum caso de teste NSFW.**

- **Estilo Regex:**

  - Identificadores de pasta (`/`) devem ser referidos como `/+` (a menos que o servidor web diferencie entre uma ou mais barras).
  - Strings de consulta ou hash podem incluir um `/`. Adicione `(?:[?#].*)?$` no final.
  - Mantenha a regra precisa:

    ```ts
    // https://www.example.com/images/image_500.jpg
    //   https://www.example.com/images/image.jpg
    return src.replace(/(\/images\/+[^/?#]+)_[0-9]+(\.[^/.]+(?:[?#].*)?)$/, "$1$2"); // bom
    return src.replace(/_[0-9]+(\.[^/.]+(?:[?#].*)?)$/, "$1$2"); // ruim
    ```

  - Embora não seja uma regra estrita, eu não uso `\d` ou `\w` porque acho que especificar exatamente quais caracteres são permitidos torna mais fácil de entender e modificar. Sua escolha :)

- **Regras mais antigas podem não seguir essas diretrizes:** Atualize-as conforme necessário.

- Você provavelmente verá que muitas das regras não seguem muitas das diretrizes acima. Regras mais recentes tendem a seguir melhor as diretrizes, mas regras mais antigas não foram atualizadas e são muitas vezes ou muito específicas ou muito genéricas como resultado. Tento atualizá-las conforme as vejo, mas como existem literalmente milhares de regras, e cada atualização muitas vezes quebra algo (o que significa que pelo menos algumas edições são necessárias para atualizar uma única regra), não consegui atualizar a maioria do script ainda. As maravilhas do software escrito organicamente!

### Para construir o userscript:

- Build único: `npm run build`
- Build e assistir por mudanças: `npm run watch`

Pessoalmente, instalo `build/userscript_extr_cat.js` como um userscript no Violentmonkey, com a configuração "Track local file..." habilitada. Isso permite atualizações automáticas em cerca de 5 segundos após salvar. Usar o arquivo compilado em vez de `userscript.user.js` tem vantagens:

 - Devido ao tamanho do userscript, seu editor pode demorar para salvar o script inteiro, o que pode levar a uma condição de corrida onde o Violentmonkey atualizará uma versão incompleta do userscript. Embora ainda seja possível ao usar uma versão compilada, é significativamente menos provável.
 - Como a versão compilada é a que é publicada no Greasyfork/OUJS, caso haja algum problema com ela (como se uma variável compartilhada estiver faltando), isso permite que os problemas sejam detectados muito mais rapidamente.

### Chamadas de API/Regras de links de página

Existem algumas considerações para implementar regras que usam chamadas de API:

- Verifique `options.do_request` e `options.cb`:
  - Algumas partes do script chamam `bigimage` sem `do_request`, o que pode causar falhas nas chamadas de API.
  - `website_query` trata isso automaticamente.

- Retorne `{waiting: true}` no final da função se o resultado for retornado em um callback (`options.cb`).

  - Caso contrário, resultará em comportamento inconsistente (como múltiplos popups).
  - Pense nisso como retornar uma Promise.

- Use `api_cache` para reduzir chamadas de API duplicadas:

  - Prefira `api_cache.fetch` sobre `api_cache.has/get` + `api_cache.set`.
  - Você (provavelmente) não precisará interagir com `api_cache` se usar `api_query` ou `website_query` (mais sobre isso adiante)
  - Para a duração do cache, minha regra geral (embora um tanto arbitrária) é uma hora (`60*60`) para dados que foram gerados (ou que se espera que mudem dentro de um dia ou mais), e 6 horas (`6*60*60`) para dados permanentes, a menos que sejam enormes (por exemplo, páginas HTML, scripts ou imagens).

- Use `api_query` em vez de `api_cache.fetch` + `options.do_request`.

  - Isso permite um código muito mais simples com menos indentação. Note que, embora `options.do_request` seja chamado implicitamente, você ainda deve verificá-lo.

- Use regras de links de página (`website_query`) em vez de `api_query` ou `options.do_request`.

  - Regras de links de página são relativamente novas no script, mas permitem um código (geralmente) mais simples, acesso à mídia principal incorporada em uma página apenas a partir do link, e para deduplicação de código sem depender de `common_functions`.

  A ideia por trás das regras de links de página é suportar uma URL pública, geralmente (sempre?) uma página HTML, e então retornar a mídia principal (ou um álbum).

### Exemplo de regra de link de página:

Para documentar, darei um exemplo com uma rede social imaginária:

```ts
if (domain_nowww === "mysocialnetwork.com") {
  // Exemplo de URL: https://mysocialnetwork.com/post/123

  // Observe que `newsrc` é definido no início de `bigimage`, então não há necessidade de `var newsrc = ...`.
  newsrc = website_query({
    // Expressão regular para URLs suportados.
    // O grupo de captura é o ID, usado internamente como chave de cache (mysocialnetwork.com:ID)
    // e externamente para consultar a página ou API.
    // Pode ser um array para suportar múltiplos padrões.
    website_regex: /^[a-z]+:\/\/[^/]+\/+post\/+([0-9]+)(?:[?#].*)?$/,

    // ${id} é substituído pelo primeiro grupo de captura. Também pode usar ${1}, ${2}, etc. para grupos adicionais.
    // Consulta a página e executa `process`.
    query_for_id: "https://mysocialnetwork.com/post/${id}",

    // Argumentos similares a `api_query`, com "match" adicionado, que é a correspondência da regex.
    process: function(done, resp, cache_key, match) {
      var img_match = resp.responseText.match(/<img id="main-image" src="([^"]+)" \/>/);
      if (!img_match) {
        // Erro para facilitar a depuração se falhar
        console_error(cache_key, "Não foi possível encontrar correspondência de imagem para", resp);

        // Primeiro argumento é o resultado (nulo) e o segundo é o tempo de armazenamento (false significa não armazenar)
        return done(null, false);
      }

      var title = get_meta(resp.responseText, "og:description");

      // Decodifica entidades HTML no interior das tags.
      // Adicionalmente, faz isso para garantir a correta exibição de fontes de imagens.
      var src = decode_entities(img_match[1]);

      return done({
        url: src,
        extra: {
          caption: title
        }
      }, 6 * 60 * 60); // Armazena a imagem por 6 horas (em segundos)
    }
  });

  // `newsrc` será undefined (se a URL não corresponder ou `options.do_request` não existir) ou {waiting: true}
  if (newsrc) return newsrc;
}

if (domain === "image.mysocialnetwork.com") {
  // Exemplo de URL: https://image.mysocialnetwork.com/postimage/123.jpg?width=500

  // Substitui a URL para remover parâmetros de consulta.
  newsrc = src.replace(/(\/postimage\/+[0-9]+\.[^/.?#]+)(?:[?#].*)?$/, "$1$2");
  // Permite continuar para a próxima parte da regra se a URL não for substituída.
  // `bigimage` geralmente é executado mais de uma vez, resultando em um histórico,
  // o que permite cair de volta para esta URL (ou a anterior) se a próxima falhar.
  if (newsrc !== src)
    return newsrc;

  match = src.match(/\/postimage\/+([0-9]+)\./);
  if (match) {
    return {
      url: "https://mysocialnetwork.com/post/" + match[1],

      // Impede que redirecione ou consulte a página erroneamente no popup,
      // caso `bigimage` não seja executado novamente por qualquer motivo.
      is_pagelink: true
    };
  }
}
```

---

Agradecemos qualquer contribuição!
