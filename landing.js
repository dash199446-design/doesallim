/* ═══════════════════════════════════════════════════════════════════════
   되살림 — 랜딩 페이지

   이 페이지는 «설명하는 곳»이다. 파일을 다루는 일은 restore.html 이 전담한다.
   여기서는 (1) 복원 전/후 슬라이더, (2) 스크롤 등장, (3) 문의 주소 채우기만 한다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── 문의 이메일 ──────────────────────────────────────────────────
     ▼▼▼  주소가 생기면 아래 «한 줄»만 바꾸세요  ▼▼▼
     예:  var 문의이메일 = "hello@doesallim.kr";
     비워 두면 «준비 중»으로 정직하게 표시됩니다.                    */
  var 문의이메일 = "";
  /* ▲▲▲  여기까지  ▲▲▲ */

  var addr = (문의이메일 || "").trim();
  document.querySelectorAll("[data-mail-text]").forEach(function (el) {
    if (!addr) return;
    var a = document.createElement("a");
    a.href = "mailto:" + addr;
    a.textContent = addr;
    el.replaceWith(a);
  });

  /* ── 복원 전 / 후 슬라이더 ────────────────────────────────────── */
  (function () {
    var ba = document.getElementById("ba"),
        topEl = document.getElementById("baTop"),
        handle = document.getElementById("baHandle");
    if (!ba) return;
    var pos = 0.5, dragging = false;

    function paint() {
      topEl.style.clipPath = "inset(0 " + ((1 - pos) * 100).toFixed(2) + "% 0 0)";
      handle.style.left = (pos * 100).toFixed(2) + "%";
      ba.setAttribute("aria-valuenow", Math.round(pos * 100));
    }
    function at(x) {
      var r = ba.getBoundingClientRect();
      pos = Math.min(1, Math.max(0, (x - r.left) / r.width)); paint();
    }
    ba.addEventListener("pointerdown", function (e) {
      dragging = true; ba.setPointerCapture(e.pointerId); at(e.clientX); e.preventDefault();
    });
    ba.addEventListener("pointermove", function (e) { if (dragging) at(e.clientX); });
    ["pointerup", "pointercancel"].forEach(function (t) {
      ba.addEventListener(t, function () { dragging = false; });
    });
    ba.tabIndex = 0;
    ba.setAttribute("role", "slider");
    ba.setAttribute("aria-label", "복원 전과 후 비교");
    ba.setAttribute("aria-valuemin", "0");
    ba.setAttribute("aria-valuemax", "100");
    ba.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { pos = Math.max(0, pos - .04); paint(); e.preventDefault(); }
      if (e.key === "ArrowRight") { pos = Math.min(1, pos + .04); paint(); e.preventDefault(); }
    });
    paint();

    // 처음 화면에 들어올 때 한 번 쓸어 보여 준다 — 끌 수 있다는 걸 알리는 용도.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches &&
        "IntersectionObserver" in window) {
      var teased = false;
      new IntersectionObserver(function (es, o) {
        es.forEach(function (en) {
          if (!en.isIntersecting || teased) return;
          teased = true; o.disconnect();
          var t0 = null;
          function tick(t) {
            if (t0 === null) t0 = t;
            var k = Math.min(1, (t - t0) / 1600);
            var e2 = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            pos = 0.5 + Math.sin(e2 * Math.PI) * 0.34; paint();
            if (k < 1 && !dragging) requestAnimationFrame(tick);
            else if (!dragging) { pos = 0.5; paint(); }
          }
          setTimeout(function () { if (!dragging) requestAnimationFrame(tick); }, 500);
        });
      }, { threshold: .4 }).observe(ba);
    }
  })();

  /* ── 스크롤 등장 · 네비 고정선 ────────────────────────────────── */
  (function () {
    var nav = document.getElementById("nav");
    addEventListener("scroll", function () {
      nav.classList.toggle("stuck", scrollY > 8);
    }, { passive: true });

    var els = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window) ||
        matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        el.classList.add("in");
        // 등장이 끝나면 클래스를 아예 떼어 낸다. opacity/transform 이 남아 있으면
        // 요소마다 합성 레이어가 유지돼 긴 페이지에서 스크롤이 무거워진다.
        el.addEventListener("transitionend", function h(ev) {
          if (ev.propertyName !== "opacity") return;
          el.removeEventListener("transitionend", h);
          el.classList.remove("rv", "in");
        });
      });
    }, { threshold: .1, rootMargin: "0px 0px -40px" });
    els.forEach(function (el) { io.observe(el); });
  })();
})();
