# Contos de Ynana no celular (Android)

O app tem dois jeitos:

- **Ler minhas histórias** (sem o computador): baixa a história de um dos **4 slots online**, guarda no celular (dá para ler sem internet), deixa editar capítulos e fichas à mão, salvar de volta num slot e **exportar o livro em PDF ou Word** para compartilhar. Sem Claude.
- **Abrir o computador** (Wi-Fi de casa): a Escrivaninha que está rodando no computador, com todas as telas e o **Claude**. O celular é a janela.

Do próprio celular vêm: escolher imagens da galeria (fotos de fichas, logos), a voz do botão **🔊 Ouvir** (motor de voz do Android), salvar em PDF (impressão do Android), compartilhar o Word e o botão voltar.

## 0. Baixar o app pronto (sem Android Studio)

O GitHub monta o APK sozinho a cada versão nova. No celular, abra
`https://github.com/darkblacks/Leitura_Contos_De_Ynana/releases/download/android/ContosDeYnana.apk`
(entrando na sua conta do GitHub), baixe e toque no arquivo para instalar. O Android pede para **permitir instalar apps desta fonte**: permita. Para atualizar, baixe de novo e instale por cima (nada se perde).

## Slots online (para o "Ler minhas histórias")

1. Crie uma conta grátis em **back4app.com** e um app (Build new app › Backend as a Service).
2. Em **App Settings › Security & Keys**, copie a **Application ID** e a **REST API Key**.
   Em **Database**, crie duas tabelas: **Create a class › Custom › Slot**, e de novo com o nome **SlotParte**.
3. No computador: **Opções › Slots online**, cole as duas e toque em **Ligar slots**. Depois **Salvar aqui** num dos 4 slots.
4. No celular: **Ler minhas histórias**, cole as mesmas duas chaves, **Ligar slots** e **Baixar** o slot.
5. Editou no celular? **Salvar aqui** num slot; no computador, **Carregar** esse slot (a história de antes fica guardada em `copias/`).

## 1. Para abrir o computador: no computador (uma vez)

1. Atualize a Escrivaninha (versão 2.13.0 ou mais nova).
2. Vá em **Opções › Celular › Ligar acesso pelo celular**.
3. Na primeira vez, o Windows pergunta se libera o acesso à rede: marque **Redes privadas** e clique em **Permitir**.
4. Anote o **endereço** (ex.: `192.168.0.15:8800`) e o **código** de 6 números.

## 2. Gerar o app no Android Studio (se preferir montar você mesmo)

1. Antes, rode `sync/atualizar-android.sh` (copia o leitor de `ui/static` para `assets/leitor`; o publicar.sh já faz isso).
2. Copie a pasta `EscrivaninhaAndroid` inteira para o seu computador.
3. No Android Studio: **File › Open** e escolha a pasta `EscrivaninhaAndroid`. Espere o "Gradle sync" terminar (na primeira vez ele baixa o que precisa).
4. Se ele oferecer atualizar o "Android Gradle Plugin", pode aceitar.
5. Ligue o celular no cabo com a **Depuração USB** ativa (Configurações › Opções do desenvolvedor) e clique em **Run ▶**. O app "Contos de Ynana" é instalado.
   - Para gerar um arquivo .apk: **Build › Build App Bundle(s) / APK(s) › Build APK(s)**; o arquivo sai em `app/build/outputs/apk/debug/`.

## 3. No celular

1. Abra **Contos de Ynana**.
2. Digite o endereço e o código que aparecem no computador e toque em **Conectar**.
3. Pronto: o celular fica lembrado. Para trocar de computador: **Opções › Celular › Trocar de computador** (dentro do app).

## Se não conectar

- O computador está ligado, com a Escrivaninha **aberta**?
- O acesso pelo celular está **ligado** em Opções › Celular?
- O celular está no **mesmo Wi-Fi** que o computador (não nos dados móveis)?
- O Windows liberou o acesso? Se você negou sem querer: Painel de Controle › Firewall do Windows › Permitir um aplicativo › marque "Escrivaninha" em Privada.
- Gerou código novo no computador? Os celulares precisam digitar o código de novo.

## Detalhes técnicos

- Android 8.0 ou mais novo (minSdk 26), compileSdk/targetSdk 34, Kotlin, AGP 8.5, Gradle 8.7, JDK 17.
- Uma tela só (`MainActivity`) com um WebView. "Ler minhas histórias" abre `assets/leitor/celular.html` (servido como `https://appassets.androidplatform.net/assets/leitor/`, pelo `WebViewAssetLoader`); a história fica no IndexedDB do app. "Abrir o computador" abre `http://<computador>:8800`. Na primeira vez abre `/celular?codigo=…`; o computador confere o código e entrega um cookie, guardado pelo app.
- Ponte `EscrivaninhaAndroid`: `imprimirHtml` (PDF pela impressão do Android, em A5), `compartilharArquivo` (Word pelo Compartilhar, via FileProvider), `trocarComputador`.
- O APK é montado por `.github/workflows/android.yml` e publicado em Releases › "App do celular".
- `assets/tts.js` troca a voz do navegador pela do Android (`TextToSpeech`), para o "Ouvir".
- O acesso pela rede vale só na rede de casa e só com o código; é o computador que liga, desliga e troca o código.
