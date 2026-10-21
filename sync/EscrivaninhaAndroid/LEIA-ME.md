# Contos de Ynana no celular (Android)

O app do celular abre a **Escrivaninha que está rodando no computador**, pelo Wi-Fi de casa. Todas as telas funcionam no celular (capítulos, fichas, famílias, castas, empresas, parlamento, acontecimentos, calendário, estilo, opções) e o **Claude também**, porque ele continua rodando no computador. O celular é a janela.

Do próprio celular vêm: escolher imagens da galeria (fotos de fichas, logos), a voz do botão **🔊 Ouvir** (motor de voz do Android) e o botão voltar.

## 1. No computador (uma vez)

1. Atualize a Escrivaninha (versão 2.13.0 ou mais nova).
2. Vá em **Opções › Celular › Ligar acesso pelo celular**.
3. Na primeira vez, o Windows pergunta se libera o acesso à rede: marque **Redes privadas** e clique em **Permitir**.
4. Anote o **endereço** (ex.: `192.168.0.15:8800`) e o **código** de 6 números.

## 2. Gerar o app no Android Studio

1. Copie a pasta `EscrivaninhaAndroid` inteira para o seu computador.
2. No Android Studio: **File › Open** e escolha a pasta `EscrivaninhaAndroid`. Espere o "Gradle sync" terminar (na primeira vez ele baixa o que precisa).
3. Se ele oferecer atualizar o "Android Gradle Plugin", pode aceitar.
4. Ligue o celular no cabo com a **Depuração USB** ativa (Configurações › Opções do desenvolvedor) e clique em **Run ▶**. O app "Contos de Ynana" é instalado.
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
- Uma tela só (`MainActivity`): um WebView que abre `http://<computador>:8800`. Na primeira vez abre `/celular?codigo=…`; o computador confere o código e entrega um cookie, guardado pelo app.
- `assets/tts.js` troca a voz do navegador pela do Android (`TextToSpeech`), para o "Ouvir".
- O acesso pela rede vale só na rede de casa e só com o código; é o computador que liga, desliga e troca o código.
