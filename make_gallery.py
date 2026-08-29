# -*- coding: utf-8 -*-
"""랜딩 «이런 것들을 복원합니다» 갤러리용 샘플 생성기.

왜 스톡/생성 이미지가 아니라 이걸 만드는가:
  「화장품 패키지도, 브로슈어도, 명함도 됩니다」를 그림으로 보여 주려면
  그럴듯한 이미지를 붙이는 방법이 제일 쉽다. 그런데 이 서비스가 파는 것은
  «측정된 정확도»라서, 한 장이라도 가짜를 붙이면 옆에 있는 숫자까지 같이 의심받는다.

  그래서 **인쇄물 종류별로 샘플을 직접 만들어 실제 파이프라인에 통과시키고,
  그 결과와 실제 측정치를 그대로 싣는다.** 고객 데이터 0, 연출 0.

산출: site/assets/gallery/<키>/{before,after}.png + site/assets/gallery.json

실행:  python site/make_gallery.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "assets" / "gallery"
TMP = ROOT / "site" / "assets" / "_gal"

INK = (0.055, 0.086, 0.078)
MUTED = (0.30, 0.35, 0.33)
LINE = (0.80, 0.82, 0.81)


def font(w: str) -> str:
    p = ROOT / "fonts" / "ofl" / f"Pretendard-{w}.otf"
    if not p.exists():
        raise SystemExit(f"폰트 없음: {p}")
    return str(p)


class Page:
    """작은 조판 도우미. 실제 인쇄물처럼 보이도록 최소한만 갖춘다."""

    def __init__(self, w: float, h: float):
        self.doc = pymupdf.open()
        self.p = self.doc.new_page(width=w, height=h)
        self.w, self.h = w, h
        self.p.draw_rect(pymupdf.Rect(0, 0, w, h), color=(1, 1, 1), fill=(1, 1, 1), width=0)
        for n, wt in (("R", "Regular"), ("M", "Medium"), ("S", "SemiBold"), ("B", "Bold")):
            self.p.insert_font(fontname=n, fontfile=font(wt))

    def band(self, y0, y1, rgb):
        self.p.draw_rect(pymupdf.Rect(0, y0, self.w, y1), color=rgb, fill=rgb, width=0)

    def rule(self, x0, y, x1, rgb=LINE, wdt=0.5):
        self.p.draw_line(pymupdf.Point(x0, y), pymupdf.Point(x1, y), color=rgb, width=wdt)

    def t(self, x, y, s, size=6, f="R", color=None, right=None):
        color = MUTED if color is None else color
        if right is not None:
            fp = {"R": "Regular", "M": "Medium", "S": "SemiBold", "B": "Bold"}[f]
            wdt = pymupdf.Font(fontfile=font(fp)).text_length(s, size)
            x = right - wdt
        self.p.insert_text((x, y), s, fontname=f, fontsize=size, color=color)

    def save(self, path: Path):
        self.doc.save(path)
        self.doc.close()


# ══════════════════════════════════════════════════════════════════════════
# 샘플들 — 전부 가상의 브랜드·문구다. 실존 제품과 무관하다.
# ══════════════════════════════════════════════════════════════════════════
def sample_cosmetic(dst: Path):
    g = Page(300, 200)
    mint = (0.878, 0.914, 0.898); acc = (0.196, 0.404, 0.333)
    g.band(0, 52, mint); g.band(174, 200, mint)
    g.t(22, 17, "AURELIA", 6.4, "S", acc)
    g.t(22, 33, "수분 진정 토너", 13.5, "B", INK)
    g.t(22, 44, "HYDRA CALMING TONER", 5.6, "R", acc)
    g.t(0, 33, "민감성 피부용 · 200 mL", 6.4, "R", MUTED, right=278)
    y = 72
    for title, lines in [
        ("전성분", ["정제수, 글리세린, 부틸렌글라이콜, 나이아신아마이드, 판테놀, 알란토인,",
                  "병풀추출물, 히알루론산, 마데카소사이드, 시어버터, 토코페롤, 향료"]),
        ("사용법", ["세안 후 적당량을 화장솜에 덜어 얼굴 전체에 부드럽게 도포합니다."]),
        ("사용 시 주의사항", ["사용 중 붉은 반점, 부어오름 등의 이상이 있는 경우 사용을 중지하고",
                        "전문의와 상담하십시오. 상처 부위에는 사용을 삼가십시오."]),
    ]:
        g.rule(22, y - 9.5, 33, acc, 0.9)
        g.t(22, y, title, 7.2, "S", INK); y += 11.5
        for ln in lines:
            g.t(22, y, ln, 6.1); y += 9.4
        y += 6.5
    g.t(22, 185, "제조판매업자  아우렐리아코스메틱  ·  서울시 강남구 테헤란로 000", 5.1)
    g.t(22, 193, "소비자상담실  0000-0000  ·  www.example.com", 5.1)
    g.save(dst)


def sample_supplement(dst: Path):
    g = Page(260, 318)
    navy = (0.12, 0.19, 0.31)
    g.band(0, 60, navy)
    g.t(20, 26, "DAILY BALANCE", 6.2, "S", (0.72, 0.79, 0.90))
    g.t(20, 44, "종합비타민 미네랄", 15, "B", (1, 1, 1))
    g.t(20, 78, "영양기능식품", 7, "S", INK)
    g.rule(20, 84, 240, LINE, 0.8)
    rows = [("1일 섭취량당 함량", "%영양성분 기준치"),
            ("비타민 A  350 μg RE", "50%"), ("비타민 C  200 mg", "200%"),
            ("비타민 D  10 μg", "100%"), ("비타민 E  11 mg α-TE", "100%"),
            ("나이아신  15 mg NE", "100%"), ("엽산  400 μg DFE", "100%"),
            ("아연  8.5 mg", "100%"), ("셀레늄  55 μg", "100%")]
    y = 96
    for i, (a, b) in enumerate(rows):
        g.t(20, y, a, 6.4, "M" if i == 0 else "R", INK if i == 0 else MUTED)
        g.t(0, y, b, 6.4, "M" if i == 0 else "R", INK if i == 0 else MUTED, right=240)
        g.rule(20, y + 3.6, 240, (0.90, 0.91, 0.90), 0.4)
        y += 13
    g.t(20, y + 12, "섭취방법", 7, "S", INK)
    g.t(20, y + 24, "1일 1회, 1회 1정을 충분한 물과 함께 섭취하십시오.", 6.2)
    g.t(20, y + 40, "섭취 시 주의사항", 7, "S", INK)
    for i, ln in enumerate([
            "특정 질환이 있거나 의약품 복용 중인 경우 전문가와 상담하십시오.",
            "이상 사례 발생 시 섭취를 중단하고 전문가와 상담하십시오.",
            "어린이 손이 닿지 않는 곳에 보관하십시오."]):
        g.t(20, y + 52 + i * 9, "· " + ln, 6.0)
    g.t(20, 306, "제조원  데일리밸런스  ·  소비자상담실 0000-0000", 5.2)
    g.save(dst)


def sample_brochure(dst: Path):
    g = Page(420, 280)
    g.band(0, 96, (0.96, 0.95, 0.93))
    g.t(34, 40, "2026 SPRING PROGRAM", 6.4, "S", (0.42, 0.36, 0.28))
    g.t(34, 66, "머무는 동안, 천천히", 20, "B", INK)
    g.t(34, 82, "회복을 위한 4주 프로그램 안내", 7.4, "R", MUTED)
    left = [("프로그램 구성", [
        "1주차   신체 회복 평가와 개인별 계획 수립",
        "2주차   식이·수면 리듬 조정, 주 3회 물리치료",
        "3주차   근력 회복 운동과 자세 교정 세션",
        "4주차   퇴소 전 재평가 및 가정 관리 안내"]),
        ("포함 사항", [
        "1인실 숙박 · 3식 및 간식 제공",
        "주 2회 전문의 상담 · 24시간 간호 인력 상주",
        "프로그램 교재 및 퇴소 후 관리 키트"])]
    right = [("문의와 예약", [
        "전화   0000-0000 (평일 09:00 – 18:00)",
        "이메일  hello@example.com",
        "주소   서울특별시 강남구 테헤란로 000",
        "",
        "방문 상담은 사전 예약을 부탁드립니다.",
        "주차는 건물 지하 2층을 이용하실 수 있습니다."])]
    y = 124
    for title, lines in left:
        g.rule(34, y - 10, 46, (0.42, 0.36, 0.28), 0.9)
        g.t(34, y, title, 8, "S", INK); y += 13
        for ln in lines:
            g.t(34, y, ln, 6.4); y += 10
        y += 12
    y = 124
    for title, lines in right:
        g.rule(236, y - 10, 248, (0.42, 0.36, 0.28), 0.9)
        g.t(236, y, title, 8, "S", INK); y += 13
        for ln in lines:
            if ln:
                g.t(236, y, ln, 6.4)
            y += 10
    g.rule(34, 258, 386)
    g.t(34, 270, "본 안내문의 내용은 사정에 따라 변경될 수 있습니다.", 5.6)
    g.save(dst)


def sample_card(dst: Path):
    g = Page(255, 150)
    g.band(0, 150, (0.07, 0.09, 0.11))
    g.t(24, 52, "김 하 린", 15, "B", (1, 1, 1))
    g.t(24, 68, "브랜드 디렉터  ·  Brand Director", 6.4, "R", (0.62, 0.66, 0.68))
    g.rule(24, 84, 84, (0.30, 0.34, 0.36), 0.7)
    for i, ln in enumerate([
            "M   010-0000-0000",
            "E   hello@example.com",
            "A   서울특별시 중구 세종대로 000, 12층"]):
        g.t(24, 100 + i * 11, ln, 6.2, "R", (0.72, 0.76, 0.78))
    g.t(0, 130, "STUDIO PANOPTICON", 6.4, "S", (0.55, 0.75, 0.66), right=231)
    g.save(dst)


def sample_food(dst: Path):
    g = Page(280, 272)
    g.band(0, 46, (0.98, 0.93, 0.80))
    g.t(20, 22, "고소한 아침", 12, "B", (0.35, 0.24, 0.10))
    g.t(20, 36, "통곡물 그래놀라  ·  350 g", 6.4, "R", (0.45, 0.35, 0.20))
    g.t(20, 68, "원재료명 및 함량", 7.2, "S", INK)
    g.rule(20, 74, 260)
    for i, ln in enumerate([
            "귀리(호주산) 32%, 통밀(국산) 18%, 아몬드(미국산) 12%,",
            "건포도(칠레산) 9%, 해바라기씨 7%, 코코넛칩 6%,",
            "현미유, 조청, 정제소금, 계피가루"]):
        g.t(20, 86 + i * 9.4, ln, 6.1)
    g.t(20, 128, "영양정보", 7.2, "S", INK)
    g.rule(20, 134, 260)
    rows = [("총 내용량 350 g", "100 g당"), ("열량", "428 kcal"), ("나트륨", "95 mg (5%)"),
            ("탄수화물", "62 g (19%)"), ("당류", "14 g (14%)"), ("지방", "15 g (28%)"),
            ("단백질", "9 g (16%)")]
    y = 146
    for i, (a, b) in enumerate(rows):
        g.t(20, y, a, 6.2, "M" if i == 0 else "R", INK if i == 0 else MUTED)
        g.t(0, y, b, 6.2, "M" if i == 0 else "R", INK if i == 0 else MUTED, right=260)
        y += 11
    g.t(20, y + 12, "알레르기 유발물질  밀, 아몬드, 대두 함유", 6.0, "M", INK)
    g.t(20, y + 24, "직사광선을 피해 서늘한 곳에 보관하십시오.", 5.6)
    g.t(20, y + 33, "개봉 후에는 밀봉하여 보관하십시오.", 5.6)
    g.t(20, 264, "제조원  고소한아침  ·  소비자상담실 0000-0000  ·  MADE IN KOREA", 5.2)
    g.save(dst)


SAMPLES = [
    ("cosmetic", "화장품 라벨", "전성분·사용법이 빼곡한 뒷면", sample_cosmetic, 300.0),
    ("supplement", "건강기능식품", "영양성분표와 주의사항", sample_supplement, 260.0),
    ("brochure", "브로슈어 내지", "2단 구성의 안내물", sample_brochure, 420.0),
    ("card", "명함", "흰 글자 · 어두운 배경", sample_card, 255.0),
    ("food", "식품 패키지", "원재료명·영양정보 표", sample_food, 280.0),
]


def run_one(key: str, label: str, note: str, build, page_w: float) -> dict | None:
    work = TMP / key
    work.mkdir(parents=True, exist_ok=True)
    live = work / "live.pdf"
    build(live)

    r = subprocess.run([sys.executable, str(ROOT / "tests" / "make_ground_truth.py"),
                        str(live), "--page", "0", "--keep-graphics",
                        "--out", str(work / "gt")],
                       cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    gt = next((work / "gt").glob("*/outlined.pdf"), None)
    if gt is None:
        print(f"  [{key}] 아웃라인 실패\n{r.stdout[-600:]}{r.stderr[-600:]}")
        return None

    job = f"GAL_{key.upper()}"
    for bucket in ("작업중", "출고", "검수대기", "실패"):
        shutil.rmtree(ROOT / "공장" / bucket / job, ignore_errors=True)
    r = subprocess.run([sys.executable, "-m", "textrevival.cli", "run", str(gt),
                        "--job-id", job, "--keep", "--emit", "pdf", "--no-vision"],
                       cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    jd = None
    for bucket in ("출고", "검수대기", "작업중", "실패"):
        d = ROOT / "공장" / bucket / job
        if d.is_dir():
            jd = d; break
    if jd is None:
        print(f"  [{key}] 작업 폴더 없음 (종료 {r.returncode})")
        return None

    restored = next((jd / "out").glob("*_TEXT-LIVE.pdf"), None)
    W = jd / "work"
    lines = json.loads((W / "lines.json").read_text("utf-8")) if (W / "lines.json").exists() else {}
    spec = json.loads((W / "spec.json").read_text("utf-8")) if (W / "spec.json").exists() else {}
    meta = json.loads((jd / "job.json").read_text("utf-8")) if (jd / "job.json").exists() else {}

    dest = OUT / key
    dest.mkdir(parents=True, exist_ok=True)
    from PIL import Image
    for src, name in ((gt, "before"), (restored, "after")):
        if src is None:
            continue
        d = pymupdf.open(src)
        pm = d[0].get_pixmap(dpi=200, alpha=False)
        d.close()
        im = Image.open(__import__("io").BytesIO(pm.tobytes("png")))
        w = 1000
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.convert("RGB").quantize(colors=128).save(dest / f"{name}.png", optimize=True)

    det = len(lines.get("lines", []))
    ok = (spec.get("summary") or {}).get("ok", 0)
    secs = sum(float(v.get("seconds") or 0) for v in (meta.get("stages") or {}).values())
    print(f"  [{key}] {label}: {ok}/{det}줄, {secs:.0f}초")
    return {"key": key, "label": label, "note": note,
            "detected": det, "restored": ok,
            "refused": max(0, det - ok), "seconds": round(secs, 1)}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    print("인쇄물 종류별 샘플을 실제 파이프라인에 통과시킵니다…")
    rows = [x for x in (run_one(*s) for s in SAMPLES) if x]
    (ROOT / "site" / "assets" / "gallery.json").write_text(
        json.dumps({"note": "자체 제작 샘플을 실제 복원 시스템에 통과시킨 결과. 고객 파일 아님.",
                    "items": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"완료: {len(rows)}종")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
