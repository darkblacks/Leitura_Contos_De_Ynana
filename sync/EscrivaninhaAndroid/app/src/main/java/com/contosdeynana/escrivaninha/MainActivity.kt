package com.contosdeynana.escrivaninha

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
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
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Contos de Ynana no celular.
 *
 * O app abre a Escrivaninha que está rodando no computador, pelo Wi-Fi de casa: todas as telas
 * e o Claude continuam no computador; o celular é a janela. Na primeira vez pede o endereço e o
 * código que aparecem no computador, em Opções › Celular.
 *
 * Do celular vêm: escolher imagens da galeria, a voz do "Ouvir" (motor de voz do Android) e o
 * botão voltar.
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
                    web.visibility == View.VISIBLE && web.canGoBack() -> web.goBack()
                    painel.visibility == View.VISIBLE && prefs.getString("base", null) != null && web.url != null -> mostrarWeb()
                    else -> finish()
                }
            }
        })

        val base = prefs.getString("base", null)
        if (base == null) {
            mostrarPainel(null)
        } else {
            campoEndereco.setText(base.removePrefix("http://"))
            abrir(base)
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

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val base = prefs.getString("base", "") ?: ""
                val u = request.url
                if (u.scheme != "http" && u.scheme != "https") return true
                if (base.isNotEmpty() && u.toString().startsWith(base)) return false
                // link para fora da Escrivaninha: abre no navegador do celular
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
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
        prefs.edit().putString("base", e).apply()
        aviso.text = ""
        abrir(if (c.isNotEmpty()) "$e/celular?codigo=${Uri.encode(c)}" else e)
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
