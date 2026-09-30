# PTCG Journal

Aplicativo pessoal para registrar partidas de Pokémon TCG Live, importar baralhos e acompanhar resultados por confronto. Construído com **Tauri 2, React, TypeScript, Rust e SQLite**.

## O que esta primeira versão faz

- Importa exports com cabeçalhos em português ou inglês.
- Confere quantidades, entradas por categoria, impressões duplicadas e o total de 60 cartas.
- Preserva nomes, coleção, número, categoria e o texto original.
- Salva novos baralhos e versões imutáveis de baralhos existentes.
- Registra vitória, derrota ou empate, adversário, ordem de jogo, formato, modalidade e observações.
- Sugere baralhos adversários já cadastrados enquanto você digita. Nomes novos exigem escolher **Cadastrar novo**; diferenças de maiúsculas e espaços reutilizam o cadastro existente.
- Mostra histórico, taxa de vitória e estatísticas por adversário, com filtros por versão, formato e modalidade.
- Permite excluir um registro incorreto mediante confirmação na interface.
- Oferece um overlay compacto, movível pelo título, configurado como sempre no topo.

O registro é **manual**, com data e hora atuais. Ainda não há leitura automática do jogo, validação de legalidade de cartas, sincronização, login, edição de partidas ou backup integrado. O overlay aceita cliques e não acompanha automaticamente a posição da janela do jogo. A janela principal continua utilizável sem o overlay.

## Preparar o ambiente

Use Node.js 22 LTS ou superior recomendado, npm e Rust estável instalado pelo [rustup](https://rustup.rs/). A interface e os testes também foram executados com o Node 18.19.1 disponível neste ambiente; prefira uma versão mantida para uso contínuo.

No Linux Mint 22 / Ubuntu 24.04:

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev
```

Depois de instalar Rust, abra outro terminal ou carregue seu ambiente:

```bash
source "$HOME/.cargo/env"
```

No Windows, instale também Microsoft C++ Build Tools, com a carga de trabalho de desenvolvimento desktop em C++, e WebView2. Consulte os [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/) para seu sistema.

## Executar

Na raiz do projeto:

```bash
npm ci
npm run tauri dev
```

Para conferir somente as telas no navegador:

```bash
npm run dev
```

Abra `http://localhost:1420`. Nesse modo, gravação, conferência do export e overlay nativo ficam desabilitados: não há banco falso ou persistência alternativa no navegador.

## Primeiro uso

1. Abra **Meus baralhos**.
2. Cole um export ou clique em **Usar exemplo Rocket**.
3. Preencha o nome e clique em **Conferir lista**.
4. Confira as cartas e clique em **Salvar baralho**.
5. Em **Visão geral**, selecione a versão e registre o resultado de uma partida.
6. Clique em **Abrir overlay** para registrar sem usar a janela principal. Arraste o título para mover e use **×** para ocultar.

No campo **Baralho adversário**, clique ou digite para abrir a lista. Use o mouse ou as setas e Enter para selecionar; Escape fecha a lista. Para um nome inédito, escolha **Cadastrar novo** antes de registrar o resultado. Deixe vazio para adversário desconhecido. O cadastro novo só é gravado junto à partida. Essa proteção não mescla duplicações históricas nem considera nomes parecidos automaticamente iguais.

O exemplo fornecido está em [fixtures/team-rocket.txt](fixtures/team-rocket.txt): 29 entradas, 16 Pokémon, 33 Treinadores e 11 Energias, totalizando 60 cartas. As duas impressões de Giovanni ficam separadas.

Para atualizar uma lista, importe novamente e escolha **Nova versão de …**. Partidas anteriores continuam ligadas à versão usada. Em **Ver export**, selecione e copie o texto original para reutilizá-lo.

## Entendendo o código

Os comentários estão em português. Uma sequência sugerida de leitura:

1. [src/lib/types.ts](src/lib/types.ts): formatos dos dados que a interface recebe.
2. [src/components/DeckImporter.tsx](src/components/DeckImporter.tsx): estados da importação, prévia e gravação.
3. [src/lib/api.ts](src/lib/api.ts): comunicação da interface com o Rust por `invoke`.
4. [src-tauri/src/lib.rs](src-tauri/src/lib.rs): comandos expostos e inicialização das janelas e do banco.
5. [src-tauri/src/parser.rs](src-tauri/src/parser.rs): transformação do export em cartas estruturadas.
6. [src-tauri/src/database.rs](src-tauri/src/database.rs): consultas, transações e gravações.
7. [src-tauri/migrations/001_initial.sql](src-tauri/migrations/001_initial.sql): tabelas e relacionamentos.

```text
React / TypeScript → comandos Tauri → Rust → SQLite
```

O importador roda em Rust na conferência e novamente na gravação. A interface não envia SQL ou cartas já consideradas válidas para o banco. Uma transação impede gravações parciais; chaves estrangeiras impedem partidas ligadas a versões inexistentes.

As duas janelas compartilham uma conexão protegida por `Mutex`, que coordena o acesso. Eventos avisam quando os dados mudam. As estatísticas são calculadas dos registros: empates entram no denominador da taxa de vitória; uma amostra vazia mostra `—`, não `0%`.

## Dados locais e evolução

O arquivo `journal.db` fica no diretório de dados do aplicativo, obtido pela API do Tauri. Normalmente:

- Linux: `~/.local/share/dev.ptcg.journal/journal.db` (respeita `XDG_DATA_HOME`).
- Windows: `%APPDATA%\dev.ptcg.journal\journal.db`.

Para um backup manual consistente, **feche o aplicativo antes de copiar o arquivo**. Não guarde o banco real no Git. O arquivo não é criptografado por esta versão.

IDs são UUIDs e datas são armazenadas em UTC. Migrações usam `PRAGMA user_version`, em transação. Uma futura versão online poderá manter SQLite e adicionar API + PostgreSQL; autenticação, conflitos e propagação de exclusões ainda precisarão ser implementados. Atualmente a exclusão de partidas é definitiva no banco local.

## Testes e builds

```bash
npm test
npm run build
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

`test:rust` testa o núcleo sem GTK/WebKit, usando `--no-default-features`. Isso **não valida a integração desktop**. Com os pré-requisitos instalados:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

Execute o build no sistema de destino: Windows para seus instaladores e Linux para seus pacotes. Há um workflow de integração contínua para testar e compilar o executável nos dois sistemas; ele não publica instaladores.

Checklist manual do desktop:

- Importar o exemplo, fechar e reabrir; conferir que o baralho persiste.
- Registrar uma partida, criar uma versão e conferir que o histórico mantém a versão antiga.
- Abrir o overlay, registrar outra partida e observar a atualização da janela principal.
- Ocultar e reabrir o overlay; testar movimentação, foco e sobreposição junto ao jogo.
- Testar no Windows e no ambiente Linux de uso (X11/Wayland). Sempre no topo e transparência dependem do sistema e do modo de exibição do jogo.

## Estado da validação inicial

- Seis testes Rust passaram: importação, erros no export, versões, transações, persistência após reabrir o banco e proteção contra cadastro acidental de adversários duplicados.
- Três testes TypeScript passaram: histórico vazio, empates e agrupamento por adversário.
- A checagem TypeScript, o build da interface e a compilação dos testes com integração desktop passaram no Linux.
- `npm run tauri build -- --debug --no-bundle` gerou o executável Linux em `src-tauri/target/debug/ptcg-overlay`, com a interface incluída, sem gerar instalador.
- A interface ainda precisa de inspeção visual e o overlay precisa ser testado com o jogo aberto. Não havia navegador ou desktop conectado disponível para essa inspeção durante a implementação.
- Windows e instaladores ainda não foram validados. O workflow só terá resultados após ser executado no GitHub.

Projeto independente, sem vínculo com The Pokémon Company.
