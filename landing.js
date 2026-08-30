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
          // 순차 등장 컨테이너는 자식이 다 나타난 뒤에 걷어야 한다.
          // 먼저 걷으면 남은 자식이 튀어나온다.
          var wait = el.hasAttribute("data-stagger")
            ? 80 * el.children.length + 600 : 0;
          setTimeout(function () { el.classList.remove("rv", "in"); }, wait);
        });
      });
    }, { threshold: .1, rootMargin: "0px 0px -40px" });
    els.forEach(function (el) { io.observe(el); });

    // ★ 안전장치 — 관찰자가 안 돌거나 늦으면 내용이 영영 숨는다.
    //   실제로 한 번 그렇게 섹션이 통째로 비어 나갔다 (2026-08-30).
    //   6초가 지나면 이유를 따지지 않고 전부 보이게 한다.
    setTimeout(function () {
      document.querySelectorAll(".rv:not(.in)").forEach(function (el) {
        el.classList.add("in");
      });
    }, 6000);
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
    // 납품 내역서는 제외한다 — 가만히 읽는 목록이라 안내가 필요 없고,
    // 두 줄이 동시에 걸리면 오히려 헷갈린다.
    document.querySelectorAll(".strip-row").forEach(function (el) {
      hot.observe(el);
    });

    /* ── 목록은 한 줄씩 차례로 나타난다 ────────────────────────────
       기존 .rv 관찰자에 얹는다. 별도 관찰자를 두면 숨기는 장치가 둘이 되고,
       하나만 안 돌아도 내용이 사라진다. */
    // data-stagger 는 HTML 에 적어 둔다. 여기서 클래스를 붙이면 이미 지나간
    // 관찰자가 그 요소를 못 보고, 내용이 영영 숨는다.
    document.querySelectorAll("[data-stagger]").forEach(function (g) {
      [].forEach.call(g.children, function (c, i) {
        c.style.transitionDelay = (i * 70) + "ms";
      });
    });

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

/* ═══════════════════════════════════════════════════════════════════════
   히어로 오른쪽 — 살아 움직이는 라벨 (2026-08-30)

   세 단계를 돌린다.
     ① 도형          모든 글자가 윤곽선 + 앵커점. 채움이 없다.
     ② 되살아남       한 글자씩 진짜 글자로 채워진다.
     ③ 고칠 수 있음   전화번호가 실제로 새 번호로 바뀐다 (지우고 다시 친다).

   ※ 이건 «무엇을 할 수 있는가» 를 보여 주는 시연이다. 측정 결과가 아니므로
     여기에 정확도 수치를 붙이지 않는다 — 실측치는 아래 섹션들에 있다.
   ※ 화면 밖·탭 비활성·reduced-motion 이면 돌지 않는다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var lab = document.getElementById("lab"),
      shot = lab && lab.closest(".shot"),
      state = document.getElementById("labState");
  if (!lab) return;

  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 각 줄을 글자 단위로 쪼갠다. data-edit 이 있으면 «고칠 부분» 을 따로 만든다. */
  var lines = [];
  [].forEach.call(lab.querySelectorAll("[data-t]"), function (el) {
    var glyphs = [];
    function put(str, into) {
      str.split("").forEach(function (c) {
        var g = document.createElement("span");
        g.className = (c === " ") ? "g sp" : "g";
        g.textContent = c;
        into.appendChild(g);
        glyphs.push(g);
      });
    }
    el.textContent = "";
    put(el.getAttribute("data-t"), el);

    var edit = el.getAttribute("data-edit");
    if (edit) {
      var parts = edit.split("|");
      var holder = document.createElement("span");
      holder.className = "editable";
      el.appendChild(holder);
      put(parts[0], holder);
      el.__edit = { holder: holder, from: parts[0], to: parts[1] };
    }
    lines.push({ el: el, glyphs: glyphs });
  });

  var all = lines.reduce(function (a, l) { return a.concat(l.glyphs); }, []);
  var editLine = lines.filter(function (l) { return l.el.__edit; })[0];

  if (RM) {
    all.forEach(function (g) { g.classList.add("on"); });
    if (state) state.textContent = "복원 후에는 글자를 직접 고치실 수 있습니다";
    return;
  }

  var timers = [], visible = false;
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function stop() { timers.forEach(clearTimeout); timers = []; }

  function say(txt, live) {
    if (state) state.textContent = txt;
    if (shot) shot.classList.toggle("is-live", !!live);
  }

  function reset() {
    stop();
    all.forEach(function (g) { g.classList.remove("on", "now"); });
    if (editLine) {
      var e = editLine.el.__edit;
      e.holder.classList.remove("edit");
      e.holder.textContent = "";
      e.from.split("").forEach(function (c) {
        var g = document.createElement("span");
        g.className = (c === " ") ? "g sp" : "g";
        g.textContent = c;
        e.holder.appendChild(g);
      });
      editLine.glyphs = editLine.glyphs.filter(function (g) {
        return g.parentNode !== e.holder;
      }).concat([].slice.call(e.holder.children));
    }
    say("아웃라인 처리된 상태 — 글자가 전부 도형입니다", false);
  }

  /* ② 되살아남 — 위에서 아래로, 줄마다 조금씩 빠르게 */
  function revive(done) {
    var i = 0, seq = [];
    lines.forEach(function (l) {
      [].forEach.call(l.el.querySelectorAll(".g"), function (g) { seq.push(g); });
    });
    say("글자를 맞히는 중… 서체와 크기를 역산합니다", false);
    (function step() {
      if (!visible) return;
      if (i >= seq.length) { say("되살렸습니다 — 이제 진짜 텍스트입니다", true); later(done, 900); return; }
      var n = Math.max(1, Math.round(seq.length / 46));   // 전체가 ~2.6초에 끝나게
      for (var k = 0; k < n && i < seq.length; k++, i++) seq[i].classList.add("on");
      later(step, 56);
    })();
  }

  /* ③ 고칠 수 있음 — 전화번호를 지우고 새로 친다 */
  function editPhone(done) {
    if (!editLine) { later(done, 1200); return; }
    var e = editLine.el.__edit, h = e.holder;
    say("이제 고치실 수 있습니다 — 전화번호를 바꿔 보겠습니다", true);
    h.classList.add("edit");

    var caret = document.createElement("span");
    caret.className = "caret";

    later(function () {
      h.textContent = "";
      h.appendChild(caret);
      var typed = "", i = 0;
      (function type() {
        if (!visible) return;
        if (i >= e.to.length) {
          later(function () { caret.remove(); h.classList.remove("edit"); done(); }, 1400);
          return;
        }
        typed += e.to[i++];
        h.textContent = typed;
        h.appendChild(caret);
        later(type, 105);
      })();
    }, 620);
  }

  function loop() {
    if (!visible) return;
    reset();
    later(function () {
      revive(function () {
        editPhone(function () { later(loop, 1600); });
      });
    }, 700);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var was = visible;
        visible = en.isIntersecting;
        if (visible && !was) loop();
        if (!visible) stop();
      });
    }, { threshold: .25 }).observe(lab);
  } else { visible = true; loop(); }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (visible) loop();
  });
})();
