/* ═══════════════════════════════════════════════════════════════════════
   Typeback — 복원 작업실

   4단계로 진행한다. 각 단계가 «지금 파일이 어디에 있는가» 를 분명히 말한다.

     1) 파일 놓기        — 파일은 브라우저 안에만 있다
     2) 브라우저 안 진단  — 여전히 전송하지 않는다. 복원 대상인지만 본다
     3) 복원             — 여기서부터 서버로 간다. 사용자가 직접 눌러야 넘어간다
     4) 결과             — 비교·줄별 결과·내려받기·즉시 삭제

   설계 원칙:
     - «되는 척» 하지 않는다. 서버가 꺼져 있으면 꺼졌다고 말한다.
     - 측정하지 못한 값은 «0.00» 이 아니라 «측정 제외» 로 적고 이유를 붙인다.
     - 복원하지 않은 줄은 숨기지 않고 이유와 함께 보여 준다. 그게 이 서비스의 약속이다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API = null;                  // 접수구 주소 (없으면 복원 불가)
  var picked = null;               // 사용자가 고른 File
  var busy = false;

  var $ = function (id) { return document.getElementById(id); };
  var svc = $("svc"), drop = $("drop"), input = $("file");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtBytes(n) {
    return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";
  }
  function show(sec) { var e = $(sec); if (e) e.hidden = false; }
  function hide(sec) { var e = $(sec); if (e) e.hidden = true; }

  /* ── 접수구 상태 ───────────────────────────────────────────────── */
  function badge(on, text, sub) {
    if (!svc) return;
    svc.hidden = false;
    svc.className = "svc " + (on ? "on" : "off");
    svc.innerHTML = '<span class="d"></span><span>' + esc(text) + "</span>" +
      (sub ? " <small>" + esc(sub) + "</small>" : "");
  }

  function checkService() {
    return fetch("endpoint.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.online || !d.api) throw new Error("offline");
        var base = d.api.replace(/\/+$/, "");
        return fetch(base + "/api/health", { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (h) {
            if (!h || !h.ok) throw new Error("health");
            API = base;
            badge(true, "접수 중", "보통 1~3분");
          });
      })
      .catch(function () {
        API = null;
        badge(false, "지금은 접수를 받지 않습니다", "진단은 그대로 됩니다");
      });
  }

  /* ── 1단계: 파일 받기 ─────────────────────────────────────────── */
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("hot"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("hot"); });
  });
  drop.addEventListener("drop", function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) accept(f);
  });
  input.addEventListener("change", function () { if (input.files[0]) accept(input.files[0]); });

  function accept(f) {
    picked = f;
    hide("s3"); hide("s4");
    $("runBox").innerHTML = ""; $("resultBox").innerHTML = "";
    diagnoseLocally(f);
  }

  /* ── 2단계: 브라우저 안 진단 ──────────────────────────────────── */
  async function inflateStreams(buf) {
    // FlateDecode 스트림을 최대 40개까지 풀어 본문 텍스트 연산자를 찾는다.
    if (typeof DecompressionStream === "undefined") return "";
    var bytes = new Uint8Array(buf), txt = "", found = 0;
    var s = new TextDecoder("latin1").decode(bytes);
    var re = /stream\r?\n/g, m;
    while ((m = re.exec(s)) && found < 40) {
      var start = m.index + m[0].length, end = s.indexOf("endstream", start);
      if (end < 0) continue;
      try {
        var ds = new DecompressionStream("deflate");
        var r = new Response(new Blob([bytes.subarray(start, end)]).stream().pipeThrough(ds));
        txt += await r.text(); found++;
      } catch (_) { /* 이 스트림은 못 풀었다 — 다음으로 */ }
      re.lastIndex = end;
    }
    return txt;
  }

  function fileCard(f) {
    var ext = (f.name.split(".").pop() || "").toUpperCase();
    return '<div class="filecard"><span class="ic">' + esc(ext) + "</span>" +
      "<div><b>" + esc(f.name) + "</b><span>" + fmtBytes(f.size) + "</span></div>" +
      '<button class="btn btn-g sm" type="button" id="reBtn">다른 파일</button></div>';
  }

  function verdictHtml(kind, title, desc, facts) {
    var f = (facts || []).map(function (x) {
      return '<div class="fact"><b>' + esc(x[1]) + "</b><span>" + esc(x[0]) + "</span></div>";
    }).join("");
    return '<div class="verdict v-' + kind + '" style="margin-top:16px"><span class="vdot"></span>' +
      "<div><b>" + esc(title) + "</b><span>" + desc + "</span></div></div>" +
      (f ? '<div class="facts">' + f + "</div>" : "");
  }

  async function diagnoseLocally(f) {
    show("s2");
    var box = $("diagBox");
    box.innerHTML = fileCard(f) +
      '<p class="small muted" style="margin-top:16px">브라우저 안에서 살펴보는 중…</p>';
    wireRe();

    var ext = (f.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "ai") {
      return render("no", "이 형식은 복원할 수 없습니다",
        ".ai 또는 .pdf 파일이어야 합니다. 스캔 이미지나 JPG 에는 글자 도형 정보가 없어 " +
        "이 방식으로는 되살릴 수 없습니다.", []);
    }

    var buf;
    try { buf = await f.arrayBuffer(); }
    catch (_) { return render("warn", "파일을 읽지 못했습니다", "파일이 손상되었을 수 있습니다.", []); }

    var head = new TextDecoder("latin1").decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 2048)));
    if (head.indexOf("%PDF") !== 0) {
      return render("warn", "PDF 호환 파일이 아닙니다",
        "일러스트레이터에서 저장하실 때 <b>«PDF 호환 파일 만들기»</b> 옵션을 켜고 " +
        "다시 저장해 주세요. 그 상태여야 안을 열어볼 수 있습니다.",
        [["파일 크기", fmtBytes(f.size)]]);
    }

    var raw = new TextDecoder("latin1").decode(new Uint8Array(buf));
    var inflated = await inflateStreams(buf);
    var all = raw + inflated;
    var fontRes = (raw.match(/\/(FontFile2?3?|BaseFont)\b/g) || []).length;
    var textOps = (all.match(/(?<![A-Za-z])(Tj|TJ)(?![A-Za-z])/g) || []).length;
    var btOps = (all.match(/(?<![A-Za-z])BT(?![A-Za-z])/g) || []).length;
    var pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length || 1;

    // ★ 아웃라인 «양» 을 센다.
    //
    // 왜 (2026-09-01, 실사용 제보): 예전에는 «서체 정보 + 텍스트 명령이 있으면 거절» 이었다.
    // 그런데 실무 인쇄 파일은 헤드라인만 아웃라인이고 본문은 살아 있는 경우가 가장 흔하다.
    // 그 파일을 «이미 살아 있다» 고 돌려보내면, 정작 복원이 필요한 고객을 문 앞에서 쫓아낸다.
    //
    // 그래서 «있다/없다» 가 아니라 «얼마나» 를 본다. 글리프를 아웃라인으로 딴 자리에는
    // 채움 연산(f / f* / re + f)이 글자 수만큼 쌓인다. 한글 한 글자에 수십 개가 나온다.
    // 반면 배경 색면·괘선만 있는 파일은 이 수가 두 자리를 넘지 않는다.
    var fillOps = (all.match(/(?<![A-Za-z0-9])(f\*?|B\*?)(?![A-Za-z0-9])/g) || []).length;
    var curveOps = (all.match(/(?<![A-Za-z0-9])[cvy](?![A-Za-z0-9])/g) || []).length;
    var pathish = fillOps + curveOps;
    var hasLive = fontRes > 0 && (textOps > 0 || btOps > 0);
    // 문턱은 «배경 그림만 있는 파일» 과 «글자를 아웃라인 딴 파일» 을 가르는 자리다.
    // 실측: 혼합 샘플(아웃라인 24줄 + 라이브 11줄)에서 도형 394개 / 글리프후보 369개였다.
    var OUTLINE_HINT = 120;

    var facts = [["파일 크기", fmtBytes(f.size)], ["페이지", pages + "쪽"],
                 ["서체 정보", fontRes > 0 ? fontRes + "건" : "없음"],
                 ["텍스트 명령", (textOps + btOps) + "건"],
                 ["글자 도형", pathish > 0 ? pathish + "개" : "없음"]];

    if (hasLive && pathish < OUTLINE_HINT) {
      return render("warn", "이미 텍스트가 살아 있는 것 같습니다",
        "서체 정보와 텍스트 명령이 있고, 아웃라인으로 딴 글자 도형은 거의 없습니다. " +
        "일러스트레이터에서 열어 글자를 더블클릭해 보세요 — 바로 고쳐질 수 있습니다. " +
        "그렇다면 복원이 필요 없습니다.", facts);
    }
    if (hasLive) {
      return render("ok", "일부만 아웃라인 처리된 파일입니다",
        "살아 있는 텍스트와 <b>아웃라인으로 딴 글자 도형이 함께</b> 있습니다 — " +
        "인쇄 파일에서 가장 흔한 형태입니다. " +
        "<b>이미 살아 있는 글자는 그대로 두고, 도형이 된 글자만</b> 되살립니다. " +
        "몇 줄이 실제로 되살아나는지는 돌려봐야 정확합니다.", facts);
    }
    render("ok", "복원할 수 있는 파일로 보입니다",
      "서체 정보 없이 도형만 발견됐습니다. 아웃라인 처리된 파일입니다. " +
      "<b>몇 줄이 실제로 되살아나는지는 돌려봐야 정확합니다.</b>", facts);

    function render(kind, title, desc, fs) {
      box.innerHTML = fileCard(f) + verdictHtml(kind, title, desc, fs) + nextStep(kind);
      wireRe();
      var b = $("startBtn");
      if (b) b.addEventListener("click", function () { startRestore(f); });
    }
  }

  function nextStep(kind) {
    if (kind !== "ok") {
      return '<p class="privacy-note" style="margin-top:18px">' +
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.9 12H9.1v-1.8h1.8V14Zm0-3.2H9.1V5.5h1.8v5.3Z"/></svg>' +
        "<span>이 파일은 복원 대상이 아닙니다. 파일이 전송되지 않았고, 요금도 발생하지 않습니다.</span></p>";
    }
    if (!API) {
      return '<p class="privacy-note warn" style="margin-top:18px">' +
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.8 1.5 17h17L10 1.8Zm.9 11.4H9.1V8h1.8v5.2Zm0 3H9.1v-1.8h1.8V16Z"/></svg>' +
        "<span><b>복원 서버가 지금 꺼져 있습니다.</b> 잠시 뒤 다시 시도해 주세요 — " +
        "이 페이지는 서버가 켜지면 자동으로 알아챕니다.</span></p>";
    }
    return '<div class="btn-row" style="margin-top:22px">' +
      '<button class="btn btn-p" type="button" id="startBtn">복원 시작 — 무료 베타</button></div>' +
      '<p class="privacy-note warn" style="margin-top:14px">' +
      '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a5 5 0 0 0-5 5v1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V7a5 5 0 0 0-5-5Zm3 6H7V7a3 3 0 1 1 6 0v1Z"/></svg>' +
      "<span><b>여기서부터 파일이 복원 서버로 전송됩니다.</b> " +
      "72시간 뒤 자동 삭제되고, 결과 화면에서 즉시 삭제하실 수도 있습니다.</span></p>";
  }

  function wireRe() {
    var b = $("reBtn");
    if (b) b.addEventListener("click", function () { input.value = ""; input.click(); });
  }

  /* ── 3단계: 복원 ──────────────────────────────────────────────── */
  var STAGE = {
    probe: ["파일 해부", "안에 무엇이 들었는지 살펴봅니다"],
    parse: ["벡터 도형 추출", "페이지 안의 패스를 전부 꺼냅니다"],
    lines: ["줄 묶기", "낱글자를 단어와 줄로 다시 묶습니다"],
    recognize: ["글자 판독", "서체 원본과 겹쳐 보며 어느 글자인지 찾습니다"],
    vision: ["교차 검증", "모양만으로 못 가르는 글자를 따로 확인합니다"],
    fontid: ["서체 확정", "어느 서체·굵기인지 정하고 라이선스를 봅니다"],
    spec: ["조판 역산", "크기·자간·행간을 되짚어 계산합니다"],
    emit: ["텍스트 삽입", "도형을 지우고 같은 자리에 진짜 텍스트를 넣습니다"],
    emit_pdf: ["PDF 만들기", "편집 가능한 파일로 씁니다"],
    verify: ["겹쳐서 검증", "원본 위에 포개어 어긋난 픽셀을 찾습니다"],
    report: ["리포트 작성", "무엇을 어떻게 했는지 기록합니다"]
  };

  function stageList(stages, elapsed) {
    var seen = {}, out = [];
    (stages || []).forEach(function (s) {
      if (seen[s.stage]) return;
      seen[s.stage] = 1;
      var info = STAGE[s.stage] || [s.label || s.stage, ""];
      var cls = s.state === "done" ? "done" : (s.state === "running" ? "now" : "");
      out.push('<li class="' + cls + '"><span class="m">' +
        (s.state === "done" ? "✓" : "") + "</span>" +
        "<span>" + esc(info[0]) +
        (cls === "now" && info[1] ? ' <span class="muted" style="font-weight:400">— ' +
          esc(info[1]) + "</span>" : "") + "</span>" +
        '<span class="t">' + (s.seconds ? (Math.round(s.seconds * 10) / 10) + "초" : "") +
        "</span></li>");
    });
    return '<p class="small muted">' + esc(picked ? picked.name : "") +
      " · " + elapsed + "초 경과</p>" +
      '<ul class="steps-live" style="margin-top:16px">' + out.join("") + "</ul>";
  }

  function failBox(msg, detail) {
    hide("s3");
    show("s4");
    $("resultBox").innerHTML =
      '<div class="verdict v-no"><span class="vdot"></span><div><b>' + esc(msg) + "</b>" +
      "<span>" + esc(detail || "") + "</span></div></div>" +
      '<p class="tiny muted" style="margin-top:14px">요금은 발생하지 않았습니다. ' +
      "같은 파일로 다시 시도하시거나, 위쪽 접수 상태를 확인해 주세요.</p>" +
      '<div class="btn-row"><button class="btn btn-g" type="button" id="againBtn">다시 시도</button></div>';
    var b = $("againBtn");
    if (b) b.addEventListener("click", function () { if (picked) startRestore(picked); });
    busy = false;
  }

  async function startRestore(file) {
    if (busy || !API) return;
    busy = true;
    var sb = $("startBtn");
    if (sb) { sb.disabled = true; sb.textContent = "보내는 중…"; }

    show("s3"); hide("s4");
    $("s3title").textContent = "복원하는 중입니다";
    $("runBox").innerHTML = '<p class="small muted">파일을 보내는 중…</p>';
    $("s3").scrollIntoView({ block: "start", behavior: "smooth" });

    try {
      var fd = new FormData();
      fd.append("file", file, file.name);
      var dR = await fetch(API + "/api/diagnose", { method: "POST", body: fd });
      var d = await dR.json();
      if (!dR.ok) return failBox(d.message || "진단에 실패했습니다.", d.error);
      if (d.verdict !== "retypeset_required") {
        return failBox("이 파일은 복원 대상이 아닙니다",
          (d.result && (d.result.title || d.result.detail)) ||
          "이미 편집 가능한 텍스트가 있거나, 이 방식으로 처리할 수 없는 형식입니다.");
      }

      var jf = new FormData();
      jf.append("diagnosis_id", d.diagnosis_id);
      var jR = await fetch(API + "/api/jobs", { method: "POST", body: jf });
      var j = await jR.json();
      if (!jR.ok) return failBox(j.message || "접수하지 못했습니다.", j.error);

      var t0 = Date.now(), last = null;
      for (var i = 0; i < 1200; i++) {
        var sR = await fetch(API + "/api/jobs/" + j.job_id, { cache: "no-store" });
        var st = await sR.json();
        if (!sR.ok) return failBox(st.message || "상태를 읽지 못했습니다.");
        last = st;
        $("runBox").innerHTML = stageList(st.stages, Math.round((Date.now() - t0) / 1000));
        if (st.status === "done" || st.status === "review" || st.status === "failed") break;
        await new Promise(function (r) { setTimeout(r, 1500); });
      }
      if (!last || last.status === "failed") {
        return failBox("복원하지 못했습니다.", last && last.error_code);
      }
      if (last.status !== "done" && last.status !== "review") {
        return failBox("시간이 너무 오래 걸립니다.", "서버 상태를 확인해 주세요.");
      }
      await renderResult(j, last);
    } catch (e) {
      failBox("서버에 닿지 못했습니다.", String((e && e.message) || e));
    } finally {
      busy = false;
      if (sb) { sb.disabled = false; sb.textContent = "복원 시작 — 무료 베타"; }
    }
  }

  /* ── 4단계: 결과 ──────────────────────────────────────────────── */
  async function renderResult(job, status) {
    var rR = await fetch(API + "/api/jobs/" + job.job_id + "/result", { cache: "no-store" });
    var r = await rR.json();
    var sum = r.summary || {}, ln = sum.lines || {}, acc = sum.accuracy || {};

    hide("s3"); show("s4");
    var base = API + "/api/jobs/" + job.job_id;
    var took = Math.max(1, Math.round(
      (new Date(status.finished_at) - new Date(status.started_at)) / 1000));

    // 정확도: null 은 «0.00» 이 아니라 «측정 못 함» 이다. 이유까지 적는다.
    var dx = (acc.dx_max_pt != null)
      ? { v: acc.dx_max_pt + "pt", t: "위치 오차 (최대)" }
      : { v: "측정 제외", t: "상용 서체 — 검증기가 그리지 못함" };

    var html = "";
    html += '<div class="verdict v-' + (status.status === "review" ? "warn" : "ok") + '">' +
      '<span class="vdot"></span><div><b>' +
      (status.status === "review" ? "복원했습니다 — 확인이 필요한 줄이 있습니다"
                                  : "복원했습니다") + "</b>" +
      "<span>" + esc(status.filename || "") + " · " + took + "초 걸렸습니다.</span></div></div>";

    html += '<div class="runsum">' +
      "<div><b>" + esc(ln.accepted != null ? ln.accepted : "—") + " / " +
      esc(ln.detected != null ? ln.detected : "—") + "</b><span>되살린 줄 / 찾은 줄</span></div>" +
      "<div><b>" + esc(sum.grade || "—") + "</b><span>" + esc(sum.grade_label || "등급") + "</span></div>" +
      '<div><b style="font-size:' + (acc.dx_max_pt != null ? "17px" : "14px") + '">' +
      esc(dx.v) + "</b><span>" + esc(dx.t) + "</span></div>" +
      "<div><b>" + esc(ln.refused != null ? ln.refused : "—") +
      "</b><span>손대지 않은 줄</span></div></div>";

    // 자기 파일의 복원 전 / 후 비교
    html += '<h3 style="font-size:16.5px;margin-top:26px">복원 전 / 후</h3>' +
      '<p class="small muted" style="margin-top:5px">손잡이를 좌우로 끌어 비교해 보세요. ' +
      "겉모습은 바뀌지 않는 것이 정상입니다.</p>" +
      '<div class="ba-live" id="baLive" style="margin-top:14px">' +
      '<img src="' + base + '/preview?side=restored" alt="복원 후 미리보기">' +
      '<div class="top" id="baTop"><img src="' + base + '/preview?side=original" alt="복원 전 미리보기"></div>' +
      '<span class="ba-tag l">복원 전</span><span class="ba-tag r">복원 후</span>' +
      '<div class="ba-handle" id="baHandle"><div class="ba-knob">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 7 5 12l4.5 5V7Zm5 0v10l4.5-5-4.5-5Z"/></svg>' +
      "</div></div></div>";

    if (ln.refused) {
      html += '<div class="bigwarn" style="margin-top:22px">' +
        '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.8 1.5 17h17L10 1.8Zm.9 11.4H9.1V8h1.8v5.2Zm0 3H9.1v-1.8h1.8V16Z"/></svg>' +
        "<div><b>" + esc(ln.refused) + "줄은 일부러 손대지 않았습니다</b>" +
        "<p>서체를 확정하지 못했거나 조판값이 어긋난 줄입니다. " +
        "<b>삭제되지 않고 원본 도형 그대로</b> 남아 있으니 인쇄에는 문제가 없습니다. " +
        "그럴듯하지만 틀린 글자가 들어가는 것이 최악이라 이렇게 합니다.</p></div></div>";
    }

    html += '<h3 style="font-size:16.5px;margin-top:26px">받으실 것</h3>' +
      '<div class="dlgrid">';
    if (r.download) {
      html += '<a class="dlcard" id="dlMain" href="' + base + "/download?t=" +
        encodeURIComponent(job.job_token) + '">' +
        '<span class="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5Zm-7 2h14v2H5v-2Z"/></svg></span>' +
        "<div><b>전체 꾸러미 (ZIP)</b><span>복원된 PDF · 검증 리포트 · 겹쳐보기 이미지 · " +
        "줄별 판정 · 폰트 매니페스트</span></div></a>";
    } else {
      html += '<div class="dlcard" style="cursor:default">' +
        '<span class="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v2H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1V7a5 5 0 0 0-5-5Zm3 7H9V7a3 3 0 1 1 6 0v2Z"/></svg></span>' +
        "<div><b>지금은 내려받을 수 없습니다</b><span>" +
        esc(r.download_requires || "") + "</span></div></div>";
    }
    html += '<button class="dlcard" type="button" id="delBtn" style="text-align:left;font:inherit;cursor:pointer">' +
      '<span class="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 6V4h10v2h4v2H3V6h4Zm-2 4h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10Z"/></svg></span>' +
      "<div><b>지금 서버에서 삭제</b><span>기다리지 않고 바로 지웁니다. " +
      "지우면 다시 받을 수 없습니다.</span></div></button>";
    html += "</div>";

    if (r.free_beta) {
      html += '<p class="tiny muted" style="margin-top:14px">' +
        "무료 베타 기간이라 요금을 받지 않습니다.</p>";
    }

    html += '<div class="bigwarn" style="margin-top:24px">' +
      '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.8 1.5 17h17L10 1.8Zm.9 11.4H9.1V8h1.8v5.2Zm0 3H9.1v-1.8h1.8V16Z"/></svg>' +
      "<div><b>인쇄에 넘기시기 전에 한 번 열어 확인해 주세요</b>" +
      "<p>이 결과는 <b>기계 검사만 통과한 상태</b>입니다. 일러스트레이터에서 열어 " +
      "글자를 더블클릭해 보시고, 기호(괄호·따옴표·단위)가 제대로 나오는지 봐 주세요. " +
      "저희 경험상 그 확인에서만 잡히는 문제가 있었습니다.</p></div></div>";

    html += '<div class="btn-row"><button class="btn btn-g" type="button" id="moreBtn">다른 파일 복원하기</button></div>';

    $("resultBox").innerHTML = html;
    $("s4").scrollIntoView({ block: "start", behavior: "smooth" });
    wireSlider();

    var del = $("delBtn");
    if (del) del.addEventListener("click", async function () {
      del.disabled = true;
      del.querySelector("b").textContent = "삭제하는 중…";
      try {
        await fetch(base + "?t=" + encodeURIComponent(job.job_token), { method: "DELETE" });
        del.querySelector("b").textContent = "삭제했습니다";
        del.querySelector("span").textContent = "서버에 남아 있지 않습니다.";
        var m = $("dlMain"); if (m) m.remove();
      } catch (e) {
        del.querySelector("b").textContent = "삭제하지 못했습니다";
        del.disabled = false;
      }
    });
    var more = $("moreBtn");
    if (more) more.addEventListener("click", function () { input.value = ""; input.click(); });
  }

  function wireSlider() {
    var ba = $("baLive"), top = $("baTop"), handle = $("baHandle");
    if (!ba) return;
    var pos = 0.5, dragging = false;
    function paint() {
      top.style.clipPath = "inset(0 " + ((1 - pos) * 100).toFixed(2) + "% 0 0)";
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
    ba.setAttribute("aria-valuemin", "0"); ba.setAttribute("aria-valuemax", "100");
    ba.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { pos = Math.max(0, pos - .04); paint(); e.preventDefault(); }
      if (e.key === "ArrowRight") { pos = Math.min(1, pos + .04); paint(); e.preventDefault(); }
    });
    paint();
  }

  /* ── 시작 ─────────────────────────────────────────────────────── */
  checkService();
  setInterval(checkService, 60000);
  addEventListener("scroll", function () {
    $("nav").classList.toggle("stuck", scrollY > 8);
  }, { passive: true });
})();
