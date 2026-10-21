/* Contos de Ynana no celular: a voz do "Ouvir" usa o motor de voz do Android.
   Troca speechSynthesis e SpeechSynthesisUtterance do navegador por uma ponte para o app. */
(function () {
  if (window.__ttsAndroid || !window.EscrivaninhaAndroid) return;
  window.__ttsAndroid = true;
  var A = window.EscrivaninhaAndroid, fila = {}, seq = 0, vozes = null;
  function Utterance(texto) { this.text = texto || ""; this.rate = 1; this.lang = "pt-BR"; this.voice = null; this.onend = null; this.onerror = null; this.onstart = null; }
  function lerVozes() { if (!vozes) { try { vozes = JSON.parse(A.vozes() || "[]"); } catch (e) { vozes = []; } } return vozes; }
  var ss = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return lerVozes(); },
    speak: function (u) {
      var id = ++seq; fila[id] = u; ss.speaking = true;
      A.falar(id, String(u.text || ""), Number(u.rate) || 1, (u.voice && u.voice.lang) || u.lang || "pt-BR", (u.voice && u.voice.name) || "");
    },
    cancel: function () { fila = {}; ss.speaking = false; A.parar(); },
    pause: function () { A.parar(); }, resume: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
  };
  window.__ttsFim = function (id, erro) {
    var u = fila[id]; delete fila[id];
    if (!Object.keys(fila).length) ss.speaking = false;
    if (!u) return;
    if (erro) { if (u.onerror) u.onerror({ error: "synthesis-failed", utterance: u }); }
    else if (u.onend) u.onend({ utterance: u });
  };
  try { Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true }); } catch (e) { window.speechSynthesis = ss; }
  window.SpeechSynthesisUtterance = Utterance;
})();
