/* ═══════════════════════════════════════════════════════════════════════
   Typeback — 랜딩 페이지

   이 페이지는 «설명하는 곳»이다. 파일을 다루는 일은 restore.html 이 전담한다.
   여기서는 (1) 복원 전/후 슬라이더, (2) 스크롤 등장, (3) 문의 주소 채우기만 한다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── 문의 이메일 ──────────────────────────────────────────────────
     ▼▼▼  주소가 생기면 아래 «한 줄»만 바꾸세요  ▼▼▼
     예:  var 문의이메일 = "hello@typeback.kr";
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

/* ═══════════════════════════════════════════════════════════════════════
   Typeback — 인터랙션 (2026-08-30 추가)

   전부 «실제 측정치»로만 움직인다. 보기 좋으라고 만든 가짜 수치는 넣지 않는다.
     · 판정 탐색기 : assets/probe.json — 샘플에서 나온 글리프별 후보 점수
     · 복원 사례   : assets/gallery.json + assets/gallery/<키>/{before,after}.png
     · 숫자 세기   : 화면에 들어올 때 한 번만
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 숫자 세기 ────────────────────────────────────────────────── */
  function countUp(el) {
    var to = parseFloat(el.dataset.to), suf = el.dataset.suffix || "";
    if (isNaN(to)) return;
    // 기본 표시는 «최종값» 이다. 스크립트가 못 돌면 0 이 남아 틀린 숫자를 보여 준다.
    if (RM) { el.textContent = to + suf; return; }
    var t0 = null, dur = 900;
    el.textContent = "0" + suf;
    function tick(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e) + suf;
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        co.unobserve(en.target); countUp(en.target);
      });
    }, { threshold: .5 });
    document.querySelectorAll(".count").forEach(function (el) { co.observe(el); });
  } else {
    document.querySelectorAll(".count").forEach(countUp);
  }

  /* ── 판정 탐색기 ──────────────────────────────────────────────── */
  (function () {
    var tabs = document.getElementById("probeTabs"),
        bars = document.getElementById("probeBars"),
        note = document.getElementById("probeNote");
    if (!tabs) return;

    fetch("assets/probe.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) throw new Error("no data");
        var keys = Object.keys(d);
        keys.forEach(function (ch, i) {
          var b = document.createElement("button");
          b.type = "button"; b.textContent = ch;
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", i === 0 ? "true" : "false");
          b.addEventListener("click", function () { pick(ch, b); });
          tabs.appendChild(b);
        });
        pick(keys[0], tabs.firstElementChild);

        function pick(ch, btn) {
          [].forEach.call(tabs.children, function (x) {
            x.setAttribute("aria-selected", String(x === btn));
          });
          var alts = d[ch].alts;
          bars.innerHTML = alts.map(function (a) {
            return '<div class="probe-bar"><b>' + a[0] + "</b>" +
              '<span class="track"><span class="fill"></span></span>' +
              '<span class="v">' + a[1].toFixed(4) + "</span></div>";
          }).join("");
          // 다음 프레임에 폭을 넣어야 전환이 보인다.
          requestAnimationFrame(function () {
            [].forEach.call(bars.querySelectorAll(".fill"), function (f, i) {
              f.style.width = (alts[i][1] * 100).toFixed(1) + "%";
            });
          });
          var gap = alts[0][1] - alts[1][1];
          note.innerHTML = "1등 <b>" + alts[0][0] + "</b> 과 2등 <b>" + alts[1][0] +
            "</b> 의 점수 차이는 <b>" + gap.toFixed(4) + "</b> 입니다. " +
            (gap > 0.05
              ? "충분히 벌어져 있어 <b>" + alts[0][0] + "</b> 로 확정했습니다."
              : "너무 붙어 있어 모양만으로는 고를 수 없습니다 — 이런 글자는 따로 확인합니다.");
        }
      })
      .catch(function () {
        document.getElementById("probe").style.display = "none";
      });
  })();

  /* ── 복원 사례 갤러리 ─────────────────────────────────────────── */
  (function () {
    var tabs = document.getElementById("galTabs");
    if (!tabs) return;
    var view = document.getElementById("galView"),
        top = document.getElementById("galTop"),
        handle = document.getElementById("galHandle"),
        imgA = document.getElementById("galAfter"),
        imgB = document.getElementById("galBefore");
    var pos = 0.5, dragging = false;

    function paint() {
      top.style.clipPath = "inset(0 " + ((1 - pos) * 100).toFixed(2) + "% 0 0)";
      handle.style.left = (pos * 100).toFixed(2) + "%";
    }
    function at(x) {
      var r = view.getBoundingClientRect();
      pos = Math.min(1, Math.max(0, (x - r.left) / r.width)); paint();
    }
    view.addEventListener("pointerdown", function (e) {
      dragging = true; view.setPointerCapture(e.pointerId); at(e.clientX); e.preventDefault();
    });
    view.addEventListener("pointermove", function (e) { if (dragging) at(e.clientX); });
    ["pointerup", "pointercancel"].forEach(function (t) {
      view.addEventListener(t, function () { dragging = false; });
    });
    view.tabIndex = 0;
    view.setAttribute("role", "slider");
    view.setAttribute("aria-label", "복원 전과 후 비교");
    view.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { pos = Math.max(0, pos - .04); paint(); e.preventDefault(); }
      if (e.key === "ArrowRight") { pos = Math.min(1, pos + .04); paint(); e.preventDefault(); }
    });
    paint();

    fetch("assets/gallery.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.items || !d.items.length) throw new Error("no data");
        d.items.forEach(function (it, i) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "gal-tab";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", i === 0 ? "true" : "false");
          b.innerHTML = it.label + '<span class="c">' + it.restored + "/" + it.detected + "</span>";
          b.addEventListener("click", function () { pick(it, b); });
          tabs.appendChild(b);
        });
        pick(d.items[0], tabs.firstElementChild);

        function pick(it, btn) {
          [].forEach.call(tabs.children, function (x) {
            x.setAttribute("aria-selected", String(x === btn));
          });
          imgA.src = "assets/gallery/" + it.key + "/after.png";
          imgB.src = "assets/gallery/" + it.key + "/before.png";
          document.getElementById("galLabel").textContent = it.label;
          document.getElementById("galNote").textContent = it.note;
          document.getElementById("galRestored").textContent = it.restored + "줄";
          document.getElementById("galDetected").textContent = it.detected + "줄";
          document.getElementById("galRefused").textContent = it.refused + "줄";
          document.getElementById("galSecs").textContent = Math.round(it.seconds) + "초";
          pos = 0.5; paint();
        }
      })
      .catch(function () {
        var g = document.getElementById("gal");
        if (g) g.closest("section").style.display = "none";
      });
  })();
})();

/* ═══════════════════════════════════════════════════════════════════════
   스크롤 연동 모션 (2026-08-30)

   원칙: 움직임은 «지금 무엇을 보고 있는지» 를 알려 주는 데만 쓴다.
   예뻐 보이려고 흔드는 것은 넣지 않는다. 화면 멀미를 줄이려면 폭이 작아야 한다.
   prefers-reduced-motion 을 켠 사람에게는 전부 끈다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ── 히어로 그림 시차 — 스크롤보다 조금 느리게 따라온다 ────────── */
  var shot = document.querySelector(".hero .shot");
  if (shot) {
    shot.classList.add("par");
    var ticking = false;
    function move() {
      var y = Math.min(scrollY, 700);
      shot.style.transform = "translate3d(0," + (y * -0.055).toFixed(1) + "px,0)";
      ticking = false;
    }
    addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(move); }
    }, { passive: true });
    move();
  }

  /* ── 지금 보고 있는 줄을 밝힌다 (필름스트립·납품 내역서) ────────── */
  if ("IntersectionObserver" in window) {
    var hot = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        en.target.classList.toggle("hot", en.isIntersecting);
      });
    }, { rootMargin: "-42% 0px -42% 0px" });
    document.querySelectorAll(".strip-row, .slip-row").forEach(function (el) {
      hot.observe(el);
    });

    /* ── 목록은 한 줄씩 차례로 나타난다 ──────────────────────────── */
    document.querySelectorAll(".plain3, .slip, .gal-tabs").forEach(function (g) {
      g.classList.add("rv-stagger");
      [].forEach.call(g.children, function (c, i) {
        c.style.transitionDelay = (i * 70) + "ms";
      });
    });
    var st = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        st.unobserve(en.target);
        en.target.classList.add("in");
      });
    }, { threshold: .15 });
    document.querySelectorAll(".rv-stagger").forEach(function (g) { st.observe(g); });

    /* ── 판정 막대는 화면에 들어올 때 한 번 채워진다 ─────────────── */
    var pb = document.getElementById("probeBars");
    if (pb) {
      var once = new IntersectionObserver(function (es, o) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          o.disconnect();
          [].forEach.call(pb.querySelectorAll(".fill"), function (f) {
            var w = f.style.width; f.style.width = "0";
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { f.style.width = w; });
            });
          });
        });
      }, { threshold: .4 });
      once.observe(pb);
    }

    /* ── 갤러리도 처음 보일 때 한 번 쓸어 준다 ───────────────────── */
    var gv = document.getElementById("galView");
    if (gv) {
      var teased = false;
      new IntersectionObserver(function (es, o) {
        es.forEach(function (en) {
          if (!en.isIntersecting || teased) return;
          teased = true; o.disconnect();
          var top = document.getElementById("galTop"),
              hd = document.getElementById("galHandle"), t0 = null;
          function tick(t) {
            if (t0 === null) t0 = t;
            var k = Math.min(1, (t - t0) / 1500);
            var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            var pos = 0.5 + Math.sin(e * Math.PI) * 0.32;
            top.style.clipPath = "inset(0 " + ((1 - pos) * 100).toFixed(2) + "% 0 0)";
            hd.style.left = (pos * 100).toFixed(2) + "%";
            if (k < 1) requestAnimationFrame(tick);
          }
          setTimeout(function () { requestAnimationFrame(tick); }, 420);
        });
      }, { threshold: .35 }).observe(gv);
    }
  }
})();
