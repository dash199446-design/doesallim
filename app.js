/* ═══════════════════════════════════════════════════════════════════════
   되살림 — 업로드 → 자동 복원 → 내려받기

   구조:
     이 페이지는 GitHub Pages(정적)에 있고, 실제 복원은 운영자 PC 에서 돈다.
     복원 엔진은 폰트 수십 GB 와 수 GB 메모리를 쓰기 때문에 무료 클라우드에 올라가지
     않는다. 그래서 «접수구» 주소를 endpoint.json 한 파일로 알려 주고, 서버가 꺼져
     있으면 이 페이지가 스스로 «접수 중지» 로 바뀐다.

     endpoint.json 은 scripts/공개서비스.ps1 이 켜고 끌 때마다 갱신해 올린다.

   중요:
     - 이 파일 안에서 «되는 척» 하지 않는다. 서버가 꺼져 있으면 꺼졌다고 말한다.
     - 브라우저 안의 간이 진단(index.html)과 서버의 정식 진단은 다른 것이다.
       간이 진단은 파일을 보내지 않고, 정식 접수부터 파일이 서버로 간다.
       그 사실을 버튼 옆에 반드시 적는다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var svc = document.getElementById("svc");
  var runBox = document.getElementById("run");
  var API = null;                 // 접수구 주소 (없으면 접수 불가)
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function fmtSec(x) { return (x == null ? "" : (Math.round(x * 10) / 10) + "초"); }

  /* ── 1) 접수구가 열려 있는지 확인 ─────────────────────────────────── */
  function badge(on, text, sub) {
    if (!svc) return;
    svc.hidden = false;
    svc.className = "svc rv in " + (on ? "on" : "off");
    svc.innerHTML = '<span class="d"></span><span>' + esc(text) + "</span>" +
      (sub ? ' <small>' + esc(sub) + "</small>" : "");
  }

  function check() {
    // 캐시를 피한다 — 접수 상태는 몇 분 단위로 바뀐다.
    fetch("endpoint.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.online || !d.api) {
          API = null;
          badge(false, "지금은 접수를 받지 않습니다",
            "복원 서버가 꺼져 있습니다. 아래 진단은 그대로 쓰실 수 있습니다.");
          return;
        }
        // 주소만 적혀 있고 실제로 안 닿는 경우가 있다. 반드시 확인하고 켠다.
        return fetch(d.api.replace(/\/+$/, "") + "/api/health", { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (h) {
            if (!h || !h.ok) throw new Error("health 실패");
            API = d.api.replace(/\/+$/, "");
            badge(true, "지금 접수 중 — 올리시면 바로 복원합니다",
              "결과는 보통 1~3분 안에 나옵니다.");
          });
      })
      .catch(function () {
        API = null;
        badge(false, "지금은 접수를 받지 않습니다",
          "복원 서버에 닿지 않습니다. 아래 진단은 그대로 쓰실 수 있습니다.");
      });
  }

  /* ── 2) 진단이 끝나면 «복원 시작» 버튼을 붙인다 ──────────────────── */
  window.__onDiagnosed = function (kind, file) {
    var result = document.getElementById("result");
    if (!result || !file) return;
    var old = document.getElementById("startRow");
    if (old) old.remove();
    if (runBox) { runBox.hidden = true; runBox.innerHTML = ""; }

    if (kind !== "ok") return;               // 복원 대상이 아니면 접수 버튼을 붙이지 않는다
    if (!API) {
      result.appendChild(el(
        '<p id="startRow" class="tiny muted" style="margin:14px 0 0">' +
        '복원 서버가 지금 꺼져 있어 접수를 받지 못합니다. ' +
        '켜지면 이 자리에 «복원 시작» 버튼이 나타납니다.</p>'));
      return;
    }
    // 서버가 켜져 있으면 «이메일로 문의» 버튼은 군더더기다. 바로 복원할 수 있으니 치운다.
    var mailCta = result.querySelector('a.btn[href="#request"]');
    if (mailCta) mailCta.remove();

    var row = el(
      '<div id="startRow" style="margin-top:16px">' +
      '<button class="btn btn-p" type="button" id="startBtn">이 파일 복원 시작 — 무료 베타</button>' +
      '<p class="tiny muted" style="margin:10px 0 0">' +
      '여기서부터는 파일이 복원 서버로 전송됩니다. ' +
      '작업 외 용도로 쓰지 않고 <b>72시간 뒤 자동 삭제</b>되며, 원하시면 즉시 삭제하실 수 있습니다.' +
      '</p></div>');
    result.appendChild(row);
    row.querySelector("#startBtn").addEventListener("click", function () { start(file); });
  };

  /* ── 3) 복원 실행 ─────────────────────────────────────────────────── */
  var STAGE_LABEL = {
    probe: "파일 해부", parse: "벡터 도형 추출", lines: "줄 묶기",
    recognize: "글자 판독", vision: "교차 검증", fontid: "서체 확정",
    spec: "조판 역산", emit: "텍스트 삽입", emit_pdf: "PDF 만들기",
    verify: "겹쳐서 검증", report: "리포트 작성"
  };

  function shell(title, body) {
    runBox.hidden = false;
    runBox.innerHTML = "<h4>" + esc(title) + "</h4>" + body;
  }

  function stageList(stages) {
    var seen = {}, out = [];
    (stages || []).forEach(function (s) {
      if (seen[s.stage]) return;
      seen[s.stage] = 1;
      var cls = s.state === "done" ? "done" : (s.state === "running" ? "now" : "");
      out.push('<li class="' + cls + '"><span class="m">' +
        (s.state === "done" ? "✓" : "") + "</span>" +
        esc(STAGE_LABEL[s.stage] || s.label || s.stage) +
        '<span class="t">' + esc(s.seconds ? fmtSec(s.seconds) : "") + "</span></li>");
    });
    return '<ul class="steps-live">' + out.join("") + "</ul>";
  }

  function fail(msg, detail) {
    shell("복원하지 못했습니다",
      '<p class="small muted" style="margin-top:6px">' + esc(msg) + "</p>" +
      (detail ? '<p class="tiny muted" style="margin-top:10px">' + esc(detail) + "</p>" : "") +
      '<p class="tiny muted" style="margin-top:12px">' +
      '같은 파일로 다시 시도하시거나, 서버가 꺼져 있는지 위 상태 표시를 확인해 주세요.</p>');
    var sb = document.getElementById("startBtn");
    if (sb) { sb.disabled = false; sb.textContent = "다시 시도"; }
    busy = false;
  }

  async function start(file) {
    if (busy || !API) return;
    busy = true;
    var startBtn = document.getElementById("startBtn");
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = "접수 중…"; }
    shell("파일을 보내는 중입니다", '<p class="small muted">' + esc(file.name) + "</p>");

    try {
      // 3-1) 서버 진단 (엔진이 직접 열어 본다 — 브라우저 간이 판정과 다르다)
      var fd = new FormData();
      fd.append("file", file, file.name);
      var dR = await fetch(API + "/api/diagnose", { method: "POST", body: fd });
      var d = await dR.json();
      if (!dR.ok) return fail(d.message || "진단을 받지 못했습니다.", d.error);
      if (d.verdict !== "retypeset_required") {
        return fail(
          "이 파일은 복원 대상이 아닙니다.",
          (d.result && (d.result.title || d.result.detail)) ||
          "이미 편집 가능한 텍스트가 있거나, 이 방식으로 처리할 수 없는 형식입니다.");
      }

      // 3-2) 접수
      var jf = new FormData();
      jf.append("diagnosis_id", d.diagnosis_id);
      var jR = await fetch(API + "/api/jobs", { method: "POST", body: jf });
      var j = await jR.json();
      if (!jR.ok) return fail(j.message || "접수하지 못했습니다.", j.error);

      // 3-3) 진행 지켜보기
      var t0 = Date.now(), last = null;
      for (var i = 0; i < 900; i++) {
        var sR = await fetch(API + "/api/jobs/" + j.job_id, { cache: "no-store" });
        var st = await sR.json();
        if (!sR.ok) return fail(st.message || "상태를 읽지 못했습니다.");
        last = st;
        shell("복원하는 중입니다  ·  " + Math.round((Date.now() - t0) / 1000) + "초",
          stageList(st.stages));
        if (st.status === "done" || st.status === "review" || st.status === "failed") break;
        await new Promise(function (r) { setTimeout(r, 1500); });
      }
      if (!last || last.status === "failed") {
        return fail("복원에 실패했습니다.", last && last.error_code);
      }
      if (last.status !== "done" && last.status !== "review") {
        return fail("시간이 너무 오래 걸립니다.", "서버 상태를 확인해 주세요.");
      }

      await finish(j, last);
    } catch (e) {
      fail("서버에 닿지 못했습니다.", String(e && e.message || e));
    } finally {
      busy = false;
    }
  }

  async function finish(job, status) {
    var rR = await fetch(API + "/api/jobs/" + job.job_id + "/result", { cache: "no-store" });
    var r = await rR.json();
    var sum = r.summary || {};
    var ln = sum.lines || {};

    var body = "";
    body += '<p class="small muted" style="margin-top:6px">' +
      esc(status.filename || "") + " · " +
      Math.round((new Date(status.finished_at) - new Date(status.started_at)) / 1000) + "초 걸렸습니다.</p>";

    // 정확도는 summary.accuracy 에 있다. 값이 null 인 것은 «0.00» 이 아니라 «측정 못 함»이다.
    // 상용 서체를 임베딩하지 않은 라인은 검증기가 그릴 수 없어 기하 채점에서 빠진다.
    // 그걸 «—» 로만 두면 고장처럼 보이므로 이유를 함께 적는다.
    var acc = sum.accuracy || {};
    var measured = acc.measured_lines || 0;
    var dxCell = (acc.dx_max_pt != null)
      ? { v: acc.dx_max_pt + "pt", t: "위치 오차 (최대)" }
      : { v: "측정 제외", t: measured ? "일부 라인 미측정" : "상용 서체 — 검증기가 못 그림" };

    body += '<div class="runsum">' +
      '<div><b>' + esc(ln.accepted != null ? ln.accepted : "—") + " / " +
      esc(ln.detected != null ? ln.detected : "—") + "</b><span>되살린 줄 / 찾은 줄</span></div>" +
      '<div><b>' + esc(sum.grade || "—") + "</b><span>등급 " +
      esc(sum.grade_label || "") + "</span></div>" +
      '<div><b style="font-size:' + (acc.dx_max_pt != null ? "17px" : "14px") + '">' +
      esc(dxCell.v) + "</b><span>" + esc(dxCell.t) + "</span></div>" +
      '<div><b>' + esc(ln.refused != null ? ln.refused : "—") +
      "</b><span>손대지 않은 줄</span></div></div>";

    body += '<figure class="shotout" style="margin:20px 0 0">' +
      '<img alt="복원 결과 미리보기" src="' + API + "/api/jobs/" + job.job_id + '/preview">' +
      "</figure>";

    if (ln.refused) {
      body += '<p class="tiny muted" style="margin-top:12px">' +
        "복원하지 않은 " + esc(ln.refused) + "줄은 <b>삭제되지 않고 원본 도형 그대로</b> 남아 있습니다. " +
        "확신이 없는 줄은 손대지 않는 것이 원칙입니다.</p>";
    }

    if (r.download) {
      var url = API + r.download + "?t=" + encodeURIComponent(job.job_token);
      body += '<div class="btn-row" style="margin-top:20px">' +
        '<a class="btn btn-p" href="' + url + '">복원 파일 내려받기</a>' +
        '<button class="btn btn-g" type="button" id="delBtn">지금 서버에서 삭제</button></div>';
      if (r.free_beta) {
        body += '<p class="tiny muted" style="margin-top:10px">' +
          "무료 베타 기간이라 요금을 받지 않습니다.</p>";
      }
    } else {
      body += '<p class="small muted" style="margin-top:18px">' +
        esc(r.download_requires || "지금은 내려받을 수 없습니다.") + "</p>";
    }

    body += '<p class="tiny muted" style="margin-top:12px">' +
      "이 결과는 <b>기계 검사만 통과한 상태</b>입니다. 인쇄에 넘기시기 전에 " +
      "일러스트레이터로 열어 글자를 한 번 확인해 주세요.</p>";

    shell(status.status === "review" ? "복원했습니다 — 확인이 필요한 줄이 있습니다"
                                     : "복원했습니다", body);

    // 끝났으면 버튼을 되돌린다. «접수 중…» 인 채로 두면 멈춘 것처럼 보인다.
    var sb = document.getElementById("startBtn");
    if (sb) { sb.disabled = false; sb.textContent = "다른 파일로 다시 하기"; }

    var del = document.getElementById("delBtn");
    if (del) {
      del.addEventListener("click", async function () {
        del.disabled = true; del.textContent = "삭제 중…";
        try {
          await fetch(API + "/api/jobs/" + job.job_id + "?t=" +
            encodeURIComponent(job.job_token), { method: "DELETE" });
          del.textContent = "삭제했습니다";
        } catch (e) { del.textContent = "삭제 실패"; del.disabled = false; }
      });
    }
  }

  check();
  setInterval(check, 90000);          // 서버가 켜지고 꺼지는 것을 따라간다
})();
