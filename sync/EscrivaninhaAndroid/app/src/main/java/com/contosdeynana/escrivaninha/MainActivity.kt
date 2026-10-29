package com.contosdeynana.escrivaninha

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.View
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Locale

/**
 * Contos de Ynana no celular.
 *
 * Dois jeitos:
 *  - Ler minhas histórias: o leitor que vem dentro do app (assets/leitor). Funciona sem o
 *    computador: baixa a história de um dos 4 slots online, lê, edita, salva no slot e exporta
 *    o livro em PDF ou Word.
 *  - Abrir o computador: a Escrivaninha que está rodando no computador, pelo Wi-Fi de casa
 *    (todas as telas e o Claude). Pede o endereço e o código de Opções › Celular.
 *
 * Do celular vêm: escolher imagens da galeria, a voz do "Ouvir" (motor de voz do Android),
 * imprimir/salvar em PDF, compartilhar o Word e o botão voltar.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var painel: View
    private lateinit var campoEndereco: EditText
    private lateinit var campoCodigo: EditText
    private lateinit var aviso: TextView

    private var tts: TextToSpeech? = null
    private var ttsPronto = false
    private var polyfillNoInicio: String? = null
    private var escolherArquivos: ValueCallback<Array<Uri>>? = null
    private val prefs by lazy { getSharedPreferences("escrivaninha", MODE_PRIVATE) }
    private val leitor by lazy {
        WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
    }
    private var impressao: WebView? = null

    private val seletor = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val cb = escolherArquivos ?: return@registerForActivityResult
        escolherArquivos = null
        val uris = mutableListOf<Uri>()
        val dados = r.data
        if (r.resultCode == RESULT_OK && dados != null) {
            dados.clipData?.let { c -> for (i in 0 until c.itemCount) uris.add(c.getItemAt(i).uri) }
            if (uris.isEmpty()) dados.data?.let { uris.add(it) }
        }
        cb.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)
        painel = findViewById(R.id.painel)
        campoEndereco = findViewById(R.id.endereco)
        campoCodigo = findViewById(R.id.codigo)
        aviso = findViewById(R.id.aviso)

        findViewById<Button>(R.id.conectar).setOnClickListener { conectar() }
        findViewById<Button>(R.id.ler).setOnClickListener { abrirLeitor() }
        campoCodigo.setOnEditorActionListener { _, acao, _ ->
            if (acao == EditorInfo.IME_ACTION_GO) { conectar(); true } else false
        }

        configurarWeb()
        tts = TextToSpeech(this) { status ->
            ttsPronto = status == TextToSpeech.SUCCESS
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) = fimDaFala(utteranceId, false)
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) = fimDaFala(utteranceId, true)
                override fun onError(utteranceId: String?, errorCode: Int) = fimDaFala(utteranceId, true)
            })
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    web.visibility == View.VISIBLE && modoLeitor() ->
                        web.evaluateJavascript("window.__voltarLeitor && window.__voltarLeitor()") { r -> if (r != "true") finish() }
                    web.visibility == View.VISIBLE && web.canGoBack() -> web.goBack()
                    painel.visibility == View.VISIBLE && prefs.getString("base", null) != null && web.url != null -> mostrarWeb()
                    else -> finish()
                }
            }
        })

        val base = prefs.getString("base", null)
        when {
            prefs.getString("modo", "") == "leitor" -> abrirLeitor()
            base == null -> mostrarPainel(null)
            else -> {
                campoEndereco.setText(base.removePrefix("http://"))
                abrir(base)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configurarWeb() {
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
            allowFileAccess = false
        }
        CookieManager.getInstance().setAcceptCookie(true)
        web.addJavascriptInterface(Ponte(), "EscrivaninhaAndroid")

        // A voz do "Ouvir": troca a voz do navegador pela do Android antes da página carregar
        val polyfill = assets.open("tts.js").bufferedReader().use { it.readText() }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, polyfill, setOf("*"))
        } else {
            polyfillNoInicio = polyfill
        }

        web.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                polyfillNoInicio?.let { view.evaluateJavascript(it, null) }
            }

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                leitor.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val base = prefs.getString("base", "") ?: ""
                val u = request.url
                if (u.host == LEITOR_HOST) return false
                if (u.scheme != "http" && u.scheme != "https") return true
                if (base.isNotEmpty() && u.toString().startsWith(base)) return false
                // link para fora da Escrivaninha: abre no navegador do celular
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && request.url.host != LEITOR_HOST) {
                    mostrarPainel(
                        "Não achei a Escrivaninha em ${prefs.getString("base", "")}. " +
                            "Confira: o computador está ligado com a Escrivaninha aberta, o acesso pelo celular " +
                            "está ligado em Opções › Celular, e o celular está no mesmo Wi-Fi."
                    )
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                escolherArquivos?.onReceiveValue(null)
                escolherArquivos = callback
                val aceita = params.acceptTypes.joinToString(",").lowercase()
                val tipo = if (aceita.contains("image") || Regex("png|jpe?g|webp|gif").containsMatchIn(aceita)) "image/*" else "*/*"
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = tipo
                    if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                return try {
                    seletor.launch(Intent.createChooser(intent, "Escolher arquivo"))
                    true
                } catch (e: Exception) {
                    escolherArquivos = null
                    false
                }
            }
        }
    }

    private fun conectar() {
        var e = campoEndereco.text.toString().trim().removeSuffix("/")
        val c = campoCodigo.text.toString().trim()
        if (e.isEmpty()) {
            aviso.text = getString(R.string.falta_endereco)
            return
        }
        if (!e.startsWith("http://") && !e.startsWith("https://")) e = "http://$e"
        if (!Regex(":\\d+$").containsMatchIn(e.substringAfter("://"))) e = "$e:8800"
        prefs.edit().putString("base", e).putString("modo", "computador").apply()
        aviso.text = ""
        abrir(if (c.isNotEmpty()) "$e/celular?codigo=${Uri.encode(c)}" else e)
    }

    private fun modoLeitor() = web.url?.startsWith(LEITOR_URL) == true

    private fun abrirLeitor() {
        prefs.edit().putString("modo", "leitor").apply()
        abrir(LEITOR_URL)
    }

    private fun abrir(url: String) {
        mostrarWeb()
        web.loadUrl(url)
    }

    private fun mostrarWeb() {
        painel.visibility = View.GONE
        web.visibility = View.VISIBLE
    }

    private fun mostrarPainel(mensagem: String?) {
        runOnUiThread {
            prefs.getString("base", null)?.let { if (campoEndereco.text.isEmpty()) campoEndereco.setText(it.removePrefix("http://")) }
            campoCodigo.setText("")
            aviso.text = mensagem ?: ""
            web.visibility = View.GONE
            painel.visibility = View.VISIBLE
        }
    }

    private fun fimDaFala(utteranceId: String?, erro: Boolean) {
        val id = utteranceId?.removePrefix("fala-")?.toIntOrNull() ?: return
        runOnUiThread { web.evaluateJavascript("window.__ttsFim && window.__ttsFim($id, $erro)", null) }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    /** O livro em PDF: abre a página do livro escondida e chama a impressão do Android ("Salvar como PDF"). */
    private fun imprimir(titulo: String, html: String) {
        runOnUiThread {
            val w = WebView(this)
            w.settings.javaScriptEnabled = false
            w.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    leitor.shouldInterceptRequest(request.url)

                override fun onPageFinished(view: WebView, url: String?) {
                    // um respiro para as fontes carregarem
                    view.postDelayed({
                        val pm = getSystemService(PRINT_SERVICE) as PrintManager
                        val atributos = PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A5).build()
                        pm.print(titulo, view.createPrintDocumentAdapter(titulo), atributos)
                    }, 600)
                }
            }
            impressao = w
            w.loadDataWithBaseURL(LEITOR_URL, html, "text/html", "utf-8", null)
        }
    }

    /** O livro (PDF ou Word) direto na pasta Downloads/Contos de Ynana e já abre. Android 8 e 9: Compartilhar. */
    private fun salvar(nome: String, tipo: String, base64: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            compartilhar(nome, tipo, base64)
            return "ok compartilhar"
        }
        return try {
            val dados = Base64.decode(base64, Base64.DEFAULT)
            val limpo = nome.replace(Regex("[^\\p{L}\\p{N} ._()-]"), "").ifBlank { "livro" }
            val valores = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, limpo)
                put(MediaStore.Downloads.MIME_TYPE, tipo)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Contos de Ynana")
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores)
                ?: return "erro: o Android não deixou criar o arquivo em Downloads"
            contentResolver.openOutputStream(uri)?.use { it.write(dados) } ?: return "erro: não consegui escrever em Downloads"
            runOnUiThread {
                Toast.makeText(this, "Salvo em Downloads/Contos de Ynana", Toast.LENGTH_LONG).show()
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, tipo).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                }
            }
            "ok Download/Contos de Ynana/$limpo"
        } catch (e: Exception) {
            "erro: ${e.message}"
        }
    }

    /** O livro em Word: grava no celular e abre o "Compartilhar" (WhatsApp, Drive, e-mail, Arquivos…). */
    private fun compartilhar(nome: String, tipo: String, base64: String) {
        runCatching {
            val pasta = File(cacheDir, "exportados").apply { mkdirs() }
            pasta.listFiles()?.forEach { it.delete() }
            val arquivo = File(pasta, nome.replace(Regex("[^\\p{L}\\p{N} ._()-]"), "").ifBlank { "livro.docx" })
            arquivo.writeBytes(Base64.decode(base64, Base64.DEFAULT))
            val uri = FileProvider.getUriForFile(this, "$packageName.arquivos", arquivo)
            val envio = Intent(Intent.ACTION_SEND).apply {
                type = tipo
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            runOnUiThread { startActivity(Intent.createChooser(envio, "Compartilhar o livro")) }
        }
    }

    override fun onDestroy() {
        tts?.shutdown()
        web.destroy()
        super.onDestroy()
    }

    /** O que a página pode pedir ao celular (window.EscrivaninhaAndroid). */
    inner class Ponte {
        @JavascriptInterface
        fun trocarComputador() = mostrarPainel(null)

        @JavascriptInterface
        fun imprimirHtml(titulo: String, html: String) = imprimir(titulo, html)

        @JavascriptInterface
        fun salvarArquivo(nome: String, tipo: String, base64: String): String = salvar(nome, tipo, base64)

        @JavascriptInterface
        fun compartilharArquivo(nome: String, tipo: String, base64: String) = compartilhar(nome, tipo, base64)

        @JavascriptInterface
        fun vozes(): String {
            val lista = JSONArray()
            runCatching {
                tts?.voices?.filter { it.locale.language == "pt" }?.sortedBy { it.name }?.forEach { v ->
                    lista.put(
                        JSONObject()
                            .put("name", v.name)
                            .put("lang", v.locale.toLanguageTag())
                            .put("localService", !v.isNetworkConnectionRequired)
                    )
                }
            }
            if (lista.length() == 0) lista.put(JSONObject().put("name", "Voz do celular").put("lang", "pt-BR").put("localService", true))
            return lista.toString()
        }

        @JavascriptInterface
        fun falar(id: Int, texto: String, velocidade: Double, idioma: String, voz: String) {
            val t = tts
            if (t == null || !ttsPronto) {
                fimDaFala("fala-$id", true)
                return
            }
            t.setSpeechRate(velocidade.toFloat())
            val v = runCatching { t.voices?.firstOrNull { it.name == voz } }.getOrNull()
            if (v != null) t.setVoice(v) else t.setLanguage(Locale.forLanguageTag(idioma.ifEmpty { "pt-BR" }))
            t.speak(texto, TextToSpeech.QUEUE_ADD, null, "fala-$id")
        }

        @JavascriptInterface
        fun parar() {
            tts?.stop()
        }
    }
}

private const val LEITOR_HOST = WebViewAssetLoader.DEFAULT_DOMAIN
private const val LEITOR_URL = "https://$LEITOR_HOST/assets/leitor/celular.html"
