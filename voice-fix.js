(() => {
  let recognition = null;
  let listening = false;
  let lastTranscript = '';
  let finalized = false;
  let finalizeTimer = null;

  function toast(message) {
    const t = document.querySelector('#toast');
    if (!t) return;
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  function textarea() { return document.querySelector('#speechText'); }
  function button() { return document.querySelector('#speak'); }

  function setButton(text, active = false) {
    const b = button();
    if (!b) return;
    b.textContent = text;
    b.dataset.listening = active ? '1' : '0';
  }

  function keyboardFallback(reason) {
    listening = false;
    setButton('🎤 使用鍵盤語音聽寫');
    const input = textarea();
    if (input) {
      input.focus({ preventScroll: false });
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    toast(ios
      ? `${reason ? reason + '。' : ''}請點 iPhone 鍵盤上的麥克風進行語音聽寫，完成後按「解析這段文字」。`
      : `${reason ? reason + '。' : ''}瀏覽器語音辨識不可用，可使用系統鍵盤語音輸入。`);
  }

  function clearFinalizeTimer() {
    if (finalizeTimer) clearTimeout(finalizeTimer);
    finalizeTimer = null;
  }

  function finalizeTranscript() {
    if (finalized) return;
    const input = textarea();
    const text = (input?.value || lastTranscript || '').trim();
    if (!text) return;
    finalized = true;
    lastTranscript = text;
    if (input) input.value = text;
    setButton('🎤 開始語音輸入');
    const parse = document.querySelector('#parse');
    if (parse) parse.click();
  }

  function scheduleFinalize(delay = 900) {
    clearFinalizeTimer();
    finalizeTimer = setTimeout(finalizeTranscript, delay);
  }

  function stopRecognition() {
    clearFinalizeTimer();
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
    listening = false;
    setButton('🎤 開始語音輸入');
    if (lastTranscript.trim()) finalizeTranscript();
  }

  function startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      keyboardFallback('此瀏覽器沒有提供 Web Speech 語音辨識');
      return;
    }

    if (listening) {
      stopRecognition();
      return;
    }

    const input = textarea();
    if (!input) return;

    try {
      recognition = new SR();
      recognition.lang = 'zh-TW';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      lastTranscript = '';
      finalized = false;

      recognition.onstart = () => {
        listening = true;
        setButton('● 正在聽… 點一下停止', true);
        toast('請開始說，例如：車費60 早餐30 飲料60');
      };

      recognition.onresult = (event) => {
        let combined = '';
        let hasFinal = false;
        for (let i = 0; i < event.results.length; i++) {
          const text = event.results[i][0]?.transcript || '';
          combined += text;
          if (event.results[i].isFinal) hasFinal = true;
        }
        combined = combined.trim();
        if (!combined) return;
        lastTranscript = combined;
        input.value = combined;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (hasFinal) scheduleFinalize(80);
        else scheduleFinalize(1100);
      };

      recognition.onspeechend = () => {
        if (lastTranscript.trim()) scheduleFinalize(700);
        try { recognition.stop(); } catch (_) {}
      };

      recognition.onend = () => {
        listening = false;
        recognition = null;
        setButton('🎤 開始語音輸入');
        if (lastTranscript.trim()) finalizeTranscript();
      };

      recognition.onerror = (event) => {
        const code = event.error || 'unknown';
        recognition = null;
        listening = false;
        setButton('🎤 開始語音輸入');

        // Some mobile browsers emit no-speech/aborted after already giving a usable interim transcript.
        if (lastTranscript.trim() && ['no-speech', 'aborted', 'network'].includes(code)) {
          finalizeTranscript();
          return;
        }

        const messages = {
          'not-allowed': '麥克風權限未允許',
          'service-not-allowed': '瀏覽器禁止使用語音服務',
          'audio-capture': '找不到可用麥克風',
          'network': '語音服務連線失敗',
          'no-speech': '沒有聽到語音',
          'aborted': '語音辨識已取消'
        };
        keyboardFallback(messages[code] || `語音辨識失敗（${code}）`);
      };

      recognition.start();
    } catch (error) {
      recognition = null;
      listening = false;
      if (lastTranscript.trim()) finalizeTranscript();
      else keyboardFallback(error?.message || '無法啟動語音辨識');
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#speak');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startRecognition();
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) stopRecognition();
  });
})();
