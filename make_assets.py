# -*- coding: utf-8 -*-
"""웹사이트용 «진짜» 이미지 자산 생성기.

왜 스톡 이미지나 AI 생성 이미지를 쓰지 않는가:
  이 서비스가 파는 것은 «측정된 정확도»다. 그런데 랜딩 페이지에 그럴듯한 가짜 이미지를 쓰면
  그 주장 전체의 신뢰가 깎인다. 그렇다고 고객 파일을 쓸 수도 없다 —
  대부분 미공개 디자인이고, 포트폴리오 사용은 서면 동의가 필요하다 (business/09 R-11).

  그래서 **샘플 라벨을 직접 만들어 실제 파이프라인에 통과시키고, 그 결과를 촬영한다.**
  고객 데이터 0, 연출 0, 실제 제품 출력 100%.

산출:
  site/assets/before.png    아웃라인 상태 (받은 파일)
  site/assets/after.png     복원 결과
  site/assets/overlay.png   원본↔복원 겹쳐보기 (검증 이미지)
  site/assets/report.png    검증리포트 첫 장
  site/assets/meta.json     실제 측정 수치 (사이트에 표기할 값)

실행:  python site/make_assets.py
"""
from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "assets"
WORK = ROOT / "공장" / "작업중" / "SITE_SAMPLE"

# 완전히 가상의 브랜드·문구. 실존 제품과 무관하다.
BRAND = "AURELIA"
NAME = "수분 진정 토너"
EN = "HYDRA CALMING TONER"
SUB = "민감성 피부용 · 200 mL"

# (제목, 본문 여러 줄) — 실제 화장품 라벨의 정보 구조를 그대로 흉내 낸다.
BLOCKS = [
    ("전성분", [
        "정제수, 글리세린, 부틸렌글라이콜, 나이아신아마이드, 판테놀, 알란토인,",
        "병풀추출물, 히알루론산, 마데카소사이드, 시어버터, 토코페롤, 향료",
    ]),
    ("사용법", [
        "세안 후 적당량을 화장솜에 덜어 얼굴 전체에 부드럽게 도포합니다.",
    ]),
    ("사용 시 주의사항", [
        "사용 중 붉은 반점, 부어오름 등의 이상이 있는 경우 사용을 중지하고",
        "전문의와 상담하십시오. 상처 부위에는 사용을 삼가십시오.",
    ]),
]
FOOTER = [
    "제조판매업자  아우렐리아코스메틱  ·  서울시 강남구 테헤란로 000",
    "소비자상담실  0000-0000  ·  www.example.com  ·  MADE IN KOREA",
]


def font(weight: str) -> Path:
    p = ROOT / "fonts" / "ofl" / f"Pretendard-{weight}.otf"
    if not p.exists():
        raise SystemExit(f"폰트를 찾지 못했다: {p}")
    return p


INK = (0.055, 0.086, 0.078)      # 거의 검정 — 인쇄 먹판
MUTED = (0.29, 0.34, 0.32)


def build_live_pdf(dst: Path) -> None:
    """라이브 텍스트가 든 샘플 라벨을 만든다 (= 디자이너가 막 만든 상태)."""
    W, H = 300, 200            # 라벨 크기(pt)
    M = 22                     # 여백
    band = 52                  # 상단 색 밴드 높이
    mint = (0.878, 0.914, 0.898)
    accent = (0.196, 0.404, 0.333)

    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)

    page.draw_rect(pymupdf.Rect(0, 0, W, H), color=(1, 1, 1), fill=(1, 1, 1), width=0)
    page.draw_rect(pymupdf.Rect(0, 0, W, band), color=mint, fill=mint, width=0)
    page.draw_rect(pymupdf.Rect(0, H - 26, W, H), color=mint, fill=mint, width=0)

    page.insert_font(fontname="pB", fontfile=str(font("Bold")))
    page.insert_font(fontname="pS", fontfile=str(font("SemiBold")))
    page.insert_font(fontname="pR", fontfile=str(font("Regular")))

    # ── 헤더 ───────────────────────────────────────────────────────────────
    page.insert_text((M, 17), BRAND, fontname="pS", fontsize=6.4, color=accent)
    page.insert_text((M, 33), NAME, fontname="pB", fontsize=13.5, color=INK)
    page.insert_text((M, 44), EN, fontname="pR", fontsize=5.6, color=accent)
    sub_w = pymupdf.Font(fontfile=str(font("Regular"))).text_length(SUB, 6.4)
    page.insert_text((W - M - sub_w, 33), SUB, fontname="pR", fontsize=6.4, color=MUTED)

    y = band + 20
    for title, body in BLOCKS:
        page.draw_line(pymupdf.Point(M, y - 9.5), pymupdf.Point(M + 11, y - 9.5),
                       color=accent, width=0.9)
        page.insert_text((M, y), title, fontname="pS", fontsize=7.2, color=INK)
        y += 11.5
        for ln in body:
            page.insert_text((M, y), ln, fontname="pR", fontsize=6.1, color=MUTED)
            y += 9.4
        y += 6.5

    fy = H - 15
    for ln in FOOTER:
        page.insert_text((M, fy), ln, fontname="pR", fontsize=5.1, color=MUTED)
        fy += 8.2

    doc.save(dst)
    doc.close()


def render(pdf: Path, png: Path, dpi: int = 220, clip=None) -> tuple[int, int]:
    d = pymupdf.open(pdf)
    pm = d[0].get_pixmap(dpi=dpi, clip=clip, alpha=False)
    png.parent.mkdir(parents=True, exist_ok=True)
    pm.save(png)
    d.close()
    return pm.width, pm.height


def crop_zoom(src: Path, dst: Path, box_pt, page_w_pt: float, out_w: int = 1000) -> None:
    """겹쳐보기 이미지의 한 부분을 확대해 잘라 낸다.

    전체를 축소해 놓으면 붉고 푸른 «어긋난 픽셀»이 눈에 보이지 않아
    범례와 화면이 따로 논다. 실제로 보이도록 한 줄만 확대한다.
    box_pt 는 원본 PDF 좌표(pt) 기준 (x0, y0, x1, y1).
    """
    from PIL import Image
    im = Image.open(src)
    k = im.width / page_w_pt
    box = tuple(round(v * k) for v in box_pt)
    c = im.crop(box)
    c = c.resize((out_w, round(c.height * out_w / c.width)), Image.LANCZOS)
    c.convert("RGB").save(dst, optimize=True)


def optimize(png: Path, max_w: int, colors: int = 128) -> None:
    """웹용으로 줄인다: 표시 폭의 2배까지만 남기고 팔레트로 양자화한다.

    이 이미지들은 «단색 글자 + 단색 배경»이라 색 수가 적다. RGB 로 두면
    파일이 네 배로 불어나므로 반드시 팔레트(P 모드)로 저장한다.
    """
    from PIL import Image
    im = Image.open(png)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT)       .save(png, optimize=True)


def build_anchor_view(src: Path, dst: Path) -> None:
    """아웃라인 파일을 «일러스트레이터에서 전체 선택한 화면»처럼 그린다.

    왜 필요한가: 복원 전과 후는 «겉모습이 똑같다». 그게 이 서비스의 핵심이지만,
    나란히 놓으면 아무 차이가 없어 보여 슬라이더가 고장난 것처럼 읽힌다.
    그래서 파일의 실제 내용 — 글자마다 박힌 앵커포인트 — 을 보여준다.
    연출이 아니라 outlined.pdf 안에 실제로 들어 있는 좌표를 그대로 찍는 것이다.
    """
    src_doc = pymupdf.open(src)
    page = src_doc[0]
    out = pymupdf.open()
    new = out.new_page(width=page.rect.width, height=page.rect.height)
    new.draw_rect(new.rect, color=(1, 1, 1), fill=(1, 1, 1), width=0)

    sel = (0.16, 0.44, 0.86)          # 일러스트레이터 선택색과 비슷한 파랑
    pts: list[pymupdf.Point] = []
    shape = new.new_shape()
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                shape.draw_line(item[1], item[2]); pts += [item[1], item[2]]
            elif item[0] == "c":
                shape.draw_bezier(item[1], item[2], item[3], item[4])
                pts += [item[1], item[4]]
            elif item[0] == "re":
                shape.draw_rect(item[1]); pts += [item[1].tl, item[1].tr,
                                                  item[1].br, item[1].bl]
    shape.finish(color=sel, width=0.14, fill=None, closePath=False)
    shape.commit()

    # 앵커포인트: 실제 좌표에만 찍는다. 너무 촘촘하면 뭉개지므로 0.35pt 격자로 합친다.
    seen = set()
    box = new.new_shape()
    n = 0
    for p in pts:
        key = (round(p.x / 0.30), round(p.y / 0.30))
        if key in seen:
            continue
        seen.add(key)
        box.draw_rect(pymupdf.Rect(p.x - .34, p.y - .34, p.x + .34, p.y + .34))
        n += 1
    box.finish(color=sel, fill=(1, 1, 1), width=0.16)
    box.commit()
    print(f"   앵커포인트 {n}개")

    out.save(dst)
    out.close(); src_doc.close()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / "_sample_live.pdf"
    print("1) 샘플 라벨 생성 (라이브 텍스트)…")
    build_live_pdf(tmp)

    print("2) 아웃라인 처리 (인쇄소에 넘어간 상태 재현)…")
    gen = ROOT / "tests" / "make_ground_truth.py"
    # --force-black 은 넣지 않는다: 그 옵션은 «흰 글자 + 색 배경» 케이스를 만들 때 쓰는 것이고,
    # 여기서는 배경 색면까지 먹으로 밀어버려서 라벨 디자인이 사라진다.
    r = subprocess.run([sys.executable, str(gen), str(tmp), "--page", "0",
                        "--out", str(OUT / "_gt")],
                       cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print(r.stdout[-1500:], r.stderr[-1500:])
        return 1
    gt = next((OUT / "_gt").glob("*/outlined.pdf"), None)
    if gt is None:
        print("아웃라인 산출물을 찾지 못했다"); return 1
    print(f"   → {gt.relative_to(ROOT)}")

    print("3) 실제 파이프라인 실행 (복원)…")
    if WORK.exists():
        shutil.rmtree(WORK, ignore_errors=True)
    r = subprocess.run([sys.executable, "-m", "textrevival.cli", "run", str(gt),
                        "--job-id", "SITE_SAMPLE", "--keep", "--emit", "pdf"],
                       cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    print(f"   종료 코드 {r.returncode} (0 출고 / 10 검수대기)")
    tail = [l for l in (r.stdout + r.stderr).splitlines() if "라인" in l or "조판" in l]
    for l in tail[-4:]:
        print("   " + l.strip())

    restored = next((WORK / "out").glob("*_TEXT-LIVE.pdf"), None)
    overlay = WORK / "out" / "overlay.png"
    report = WORK / "out" / "검증리포트.pdf"

    print("4) 이미지 촬영…")
    render(gt, OUT / "before.png", dpi=260)
    build_anchor_view(gt, OUT / "_paths.pdf")
    render(OUT / "_paths.pdf", OUT / "before_paths.png", dpi=260)
    if restored:
        render(restored, OUT / "after.png", dpi=260)
    if overlay.exists():
        shutil.copy2(overlay, OUT / "overlay.png")
        # 「전성분」 제목과 첫 본문 줄 — 어긋난 픽셀이 실제로 보이는 구간.
        crop_zoom(overlay, OUT / "overlay_zoom.png", (18, 62, 172, 96), 300.0)
    if report.exists():
        render(report, OUT / "report.png", dpi=170)
        # 리포트는 «검은 글씨 + 흰 배경»이다. 색 팔레트로 줄이면 작은 글자가 뭉개진다.
        # 회색조로 저장하면 글자가 살아 있으면서 용량도 작다.
        from PIL import Image
        im = Image.open(OUT / "report.png").convert("L")
        im = im.resize((1240, round(im.height * 1240 / im.width)), Image.LANCZOS)
        im.save(OUT / "report.png", optimize=True)

    meta = {}
    try:
        spec = json.loads((WORK / "work" / "spec.json").read_text("utf-8"))
        ver = json.loads((WORK / "work" / "verify.json").read_text("utf-8"))
        lines = json.loads((WORK / "work" / "lines.json").read_text("utf-8"))
        meta = {
            "detected_lines": len(lines.get("lines", [])),
            "restored_lines": spec.get("summary", {}).get("ok"),
            "dx_max": ver.get("overall", {}).get("dx_max"),
            "dy_max": ver.get("overall", {}).get("dy_max"),
            "pixel_iou": ver.get("overall", {}).get("pixel_iou"),
            "gate": ver.get("overall", {}).get("gate"),
            "note": "이 수치는 site/make_assets.py 가 만든 가상 샘플을 실제 파이프라인에 "
                    "통과시켜 측정한 값이다. 고객 데이터가 아니다.",
        }
        (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        print("   측정치 수집 실패:", type(exc).__name__, exc)

    print("5) 웹용 최적화…")
    for name, w in (("before.png", 1100), ("after.png", 1100),
                    ("before_paths.png", 1300), ("overlay.png", 1600),
                    ("overlay_zoom.png", 1000)):
        if (OUT / name).exists():
            optimize(OUT / name, w)

    for p in sorted(OUT.glob("*.png")):
        print(f"   {p.name}  {p.stat().st_size/1024:.0f}KB")
    print("측정치:", json.dumps(meta, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


# ══════════════════════════════════════════════════════════════════════════
# 랜딩 페이지용 «줄별 판정» 합성 이미지
# ══════════════════════════════════════════════════════════════════════════
def build_line_strip(out_dir: Path, dst: Path, rows: int = 5, width: int = 1200) -> None:
    """줄별 판정 썸네일을 위아래로 붙여 «이렇게 줄 단위로 확인한다»를 보여 준다.

    이 서비스가 파는 것은 «어디를 되살렸는지 줄 단위로 안다»는 점이다.
    말로 하면 안 와닿으므로 실제 산출물을 그대로 보여 준다.
    """
    from PIL import Image, ImageDraw
    src = out_dir / "텍스트판정"
    files = sorted(src.glob("L*.png"))[:rows]
    if not files:
        print("   줄별 판정 이미지 없음 — 건너뜀")
        return
    ims = [Image.open(f).convert("RGB") for f in files]
    pad, gap, label_h = 18, 12, 0
    w = width
    scaled = []
    for im in ims:
        k = min(1.0, (w - pad * 2) / im.width)
        scaled.append(im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS))
    h = pad * 2 + sum(i.height for i in scaled) + gap * (len(scaled) - 1)
    canvas = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(canvas)
    y = pad
    for im in scaled:
        canvas.paste(im, (pad, y))
        d.rectangle([pad - 1, y - 1, pad + im.width, y + im.height],
                    outline=(228, 232, 230), width=1)
        y += im.height + gap
    canvas.save(dst, optimize=True)
    print(f"   줄별 판정 {len(scaled)}줄 → {dst.name}")


# ══════════════════════════════════════════════════════════════════════════
# 랜딩 «복원 과정» 4칸 — 같은 글자를 같은 배율로 따라간다
# ══════════════════════════════════════════════════════════════════════════
#
# 왜 다시 만들었나 (2026-08-30):
#   처음에는 단계마다 아무 산출물이나 잘라 넣었다. 그랬더니 네 칸의 배율이 제각각이라
#   눈이 갈 곳이 없고, 무엇이 달라지는지 알 수 없었다. 이미지가 스스로를 설명하지 못하면
#   없는 것만 못하다.
#
#   그래서 «같은 글자 한 곳»을 같은 배율로 네 번 보여 준다.
#   보는 사람은 위치를 옮기지 않고 무엇이 달라지는지만 보면 된다.

#: 라벨에서 따라갈 구간 (pt). 「전성분」 제목과 첫 본문 줄.
# 「전성분」 제목 + 본문 두 줄이 «통째로» 들어가는 구간.
# 줄 중간에서 자르면 글자가 반쪽으로 잘려 무엇을 보는지 알 수 없다.
DETAIL_BOX = (19.0, 63.5, 121.0, 93.8)


def detail_crop(pdf: Path, dst: Path, box=DETAIL_BOX, out_w: int = 900) -> None:
    """PDF 의 한 구간만 잘라 같은 크기로 저장한다."""
    from PIL import Image
    d = pymupdf.open(pdf)
    pm = d[0].get_pixmap(dpi=600, clip=pymupdf.Rect(*box), alpha=False)
    im = Image.open(io.BytesIO(pm.tobytes("png")))
    d.close()
    im = im.resize((out_w, round(im.height * out_w / im.width)), Image.LANCZOS)
    im.save(dst, optimize=True)


def detail_from_png(src: Path, dst: Path, page_w_pt: float, box=DETAIL_BOX,
                    out_w: int = 900) -> None:
    """이미 만들어진 전체 PNG 에서 같은 구간을 잘라 낸다 (겹쳐보기용)."""
    from PIL import Image
    im = Image.open(src)
    k = im.width / page_w_pt
    c = im.crop(tuple(round(v * k) for v in box))
    c = c.resize((out_w, round(c.height * out_w / c.width)), Image.LANCZOS)
    c.convert("RGB").save(dst, optimize=True)


def build_match_card(work: Path, outlined: Path, dst: Path, out_w: int = 900) -> None:
    """«모양을 겹쳐 보고 맞힌다»를 한 장으로 보여 준다.

    ① 은 **실제 파일에서 잘라낸 도형**이다. 폰트로 다시 그린 것이 아니다 —
    그러면 «받은 도형»이라는 말이 거짓이 되고, 이 사이트의 다른 주장도 같이 무너진다.
    ② 는 서체 원본, ③ 은 둘을 포개어 놓은 것. 아래에 겹침 점수와 밀린 후보를 적는다.

    이 그림이 이 서비스의 원리 전체다 — 글자를 «읽는» 게 아니라 «겹쳐 재는» 것.
    """
    from PIL import Image, ImageDraw
    import numpy as np
    from textrevival.core import glyphs as G

    recog = json.loads((work / "recog.json").read_text("utf-8"))
    units = json.loads((work / "units.json").read_text("utf-8"))
    by_idx = {u["idx"]: u for u in units} if isinstance(units, list) else {}

    # 후보 점수 차이가 뚜렷하고, 실제 도형을 집어낼 수 있는 글리프를 고른다.
    best = None
    for ln in recog.get("lines", []):
        for pg in ln.get("per_glyph", []):
            alts = pg.get("alts") or []
            u = by_idx.get(pg.get("u"))
            if len(alts) < 3 or pg.get("iou", 0) < 0.98 or u is None:
                continue
            spread = alts[0][1] - alts[1][1]
            # 한글을 우선한다 — 국내 고객이 보는 화면이다.
            score = spread + (0.5 if "가" <= pg["ch"] <= "힣" else 0)
            if best is None or score > best[0]:
                best = (score, pg, ln, u)
    if best is None:
        print("   맞춤 카드: 쓸 만한 글리프를 못 찾음"); return
    _, pg, ln, unit = best
    ch, iou, alts = pg["ch"], pg["iou"], pg["alts"]

    fpath = ROOT / "fonts" / "ofl" / pg["font"]
    if not fpath.exists():
        fpath = next((ROOT / "fonts").rglob(pg["font"]), None)
    if fpath is None:
        print("   맞춤 카드: 폰트를 못 찾음"); return

    # ── ① 실제 파일에서 이 글자의 도형만 잘라 낸다 ────────────────────────
    # ⚠ units.json 의 bbox 는 **PDF 좌표(y 가 아래에서 위)** 다. 반면 렌더러의 clip 은
    #   페이지 좌상단이 원점이다. 뒤집지 않으면 엉뚱한 글자를 잘라 놓고
    #   «받은 도형»이라고 이름 붙이게 된다 (2026-08-30 실제로 그랬다).
    x0, y0, x1, y1 = unit["bbox"]
    doc = pymupdf.open(outlined)
    ph = doc[0].rect.height
    clip = pymupdf.Rect(x0, ph - y1, x1, ph - y0)
    pm = doc[0].get_pixmap(dpi=1200, clip=clip, alpha=False)
    shape = Image.open(io.BytesIO(pm.tobytes("png"))).convert("L")
    doc.close()
    sh = np.asarray(shape) < 128           # 잉크 = True

    # ── ② 서체 원본 ─────────────────────────────────────────────────────
    N = 320
    fh = G.load_font(fpath)
    gname = G.glyph_name_for_char(fh, ch)
    mask = G.glyph_raster(fh, gname, N) if gname else None
    if mask is None:
        print("   맞춤 카드: 래스터 실패"); return
    fo = np.asarray(mask, dtype=bool)

    def to_box(a, n=N):
        """잉크의 경계상자로 맞추되 **가로세로 비율은 지킨다**.

        점수를 재는 알고리즘은 정사각형으로 늘려서 비교하지만, 사람이 보는 그림에서
        그렇게 하면 글자가 찌그러져 무엇인지 알아볼 수 없다. 보여 줄 때는 비율을 지킨다.
        """
        ys, xs = np.where(a)
        if len(xs) == 0:
            return np.zeros((n, n), bool)
        crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = crop.shape
        k = min(n / w, n / h)
        nw, nh = max(1, int(w * k)), max(1, int(h * k))
        im = Image.fromarray((crop * 255).astype("uint8")).resize((nw, nh), Image.LANCZOS)
        out = np.zeros((n, n), bool)
        oy, ox = (n - nh) // 2, (n - nw) // 2
        out[oy:oy + nh, ox:ox + nw] = np.asarray(im) > 127
        return out

    A = to_box(sh)
    B = to_box(fo)

    pad, gap, inset = 26, 22, 16
    cell = (out_w - pad * 2 - gap * 2) // 3
    head, foot = 34, 82
    H = pad + head + cell + foot
    canvas = Image.new("RGB", (out_w, H), (255, 255, 255))
    d = ImageDraw.Draw(canvas)

    def paste(x0c, layers):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        px = img.load()
        for arr, color, edge_only in layers:
            src = arr
            if edge_only:
                e = np.zeros_like(arr)
                e[1:-1, 1:-1] = arr[1:-1, 1:-1] & ~(
                    arr[:-2, 1:-1] & arr[2:, 1:-1] & arr[1:-1, :-2] & arr[1:-1, 2:])
                src = e
            ys, xs = np.where(src)
            for yy, xx in zip(ys.tolist(), xs.tolist()):
                px[xx, yy] = color
        inner = cell - inset * 2
        canvas.paste(img.resize((inner, inner), Image.LANCZOS),
                     (x0c + inset, pad + head + inset), img.resize((inner, inner), Image.LANCZOS))
        d.rectangle([x0c, pad + head, x0c + cell, pad + head + cell],
                    outline=(232, 236, 234), width=1)

    xs3 = [pad, pad + cell + gap, pad + (cell + gap) * 2]
    for x, t in zip(xs3, ("① 받은 도형 — 파일에서 잘라냄", "② 서체 원본", "③ 겹쳐 보면")):
        d.text((x, pad + 8), t, fill=(92, 103, 99), font=_ui(13))
    paste(xs3[0], [(A, (14, 22, 19, 255), False)])
    paste(xs3[1], [(B, (30, 122, 90, 255), True)])
    paste(xs3[2], [(A, (190, 198, 195, 255), False), (B, (30, 122, 90, 255), True)])

    fy = pad + head + cell + 20
    d.text((pad, fy), f"겹침 점수  {iou:.4f}", fill=(14, 22, 19), font=_ui(21, True))
    parts = "   ".join(f"{a[0]} {a[1]:.3f}" for a in alts[:3])
    d.text((pad, fy + 32), f"다음 후보  {parts}", fill=(92, 103, 99), font=_ui(15))
    d.text((out_w - pad - 250, fy + 6),
           str(ln.get("font", "")).replace(".otf", "").replace(".ttf", ""),
           fill=(150, 158, 155), font=_ui(13))
    canvas.save(dst, optimize=True)
    print(f"   맞춤 카드: '{ch}' {iou:.4f} / 후보 {parts}")


def _ui(size: int, bold: bool = False):
    from PIL import ImageFont
    p = ROOT / "fonts" / "ofl" / ("Pretendard-Bold.ttf" if bold else "Pretendard-Regular.ttf")
    try:
        return ImageFont.truetype(str(p), size)
    except Exception:
        return ImageFont.load_default()


def build_ambiguous_card(work: Path, outlined: Path, dst: Path, out_w: int = 900) -> None:
    """«모양이 완벽히 맞았는데도 손대지 않은» 경우를 보여 준다.

    이 서비스에서 가장 중요한 그림이다. 대문자 I 와 소문자 l 은 이 서체에서 모양이
    완전히 같다. 겹침 점수가 0.9999 로 나와도 **어느 쪽인지 알 수 없다.**
    브랜드명에 잘못된 글자가 인쇄되는 것이 최악이므로, 이런 줄은 복원하지 않고
    원본 도형 그대로 둔다.

    실제 샘플에서 손대지 않은 3줄이 전부 이 경우였다.
    «잘 맞는 오답» 이 최악의 실패 모드라는 원칙이 숫자로 드러나는 자리다.
    """
    from PIL import Image, ImageDraw
    import numpy as np
    from textrevival.core import glyphs as G

    recog = json.loads((work / "recog.json").read_text("utf-8"))
    units = json.loads((work / "units.json").read_text("utf-8"))
    by_idx = {u["idx"]: u for u in units} if isinstance(units, list) else {}
    spec = json.loads((work / "spec.json").read_text("utf-8"))
    done = {l["id"] for l in spec.get("lines", [])}

    target = None
    for ln in recog.get("lines", []):
        if ln["id"] in done or not (ln.get("confusables") or []):
            continue
        for pg in ln.get("per_glyph", []):
            if pg.get("ch") in ("l", "I") and by_idx.get(pg.get("u")):
                target = (ln, pg, by_idx[pg["u"]]); break
        if target:
            break
    if target is None:
        print("   미상 카드: 대상 없음"); return
    ln, pg, unit = target

    fpath = ROOT / "fonts" / "ofl" / pg["font"]
    if not fpath.exists():
        fpath = next((ROOT / "fonts").rglob(pg["font"]), None)
    if fpath is None:
        print("   미상 카드: 폰트 없음"); return

    x0, y0, x1, y1 = unit["bbox"]
    doc = pymupdf.open(outlined)
    ph = doc[0].rect.height
    pm = doc[0].get_pixmap(dpi=1600, clip=pymupdf.Rect(x0, ph - y1, x1, ph - y0), alpha=False)
    shape = np.asarray(Image.open(io.BytesIO(pm.tobytes("png"))).convert("L")) < 128
    doc.close()

    N = 300
    fh = G.load_font(fpath)

    def raster(ch):
        gn = G.glyph_name_for_char(fh, ch)
        m = G.glyph_raster(fh, gn, N) if gn else None
        return None if m is None else np.asarray(m, dtype=bool)

    def norm(a, n=N):
        ys, xs = np.where(a)
        if not len(xs):
            return np.zeros((n, n), bool)
        crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = crop.shape
        k = min(n / max(w, 1), n / max(h, 1))
        nw, nh = max(1, int(w * k)), max(1, int(h * k))
        im = Image.fromarray((crop * 255).astype("uint8")).resize((nw, nh), Image.LANCZOS)
        out = np.zeros((n, n), bool)
        oy, ox = (n - nh) // 2, (n - nw) // 2
        out[oy:oy + nh, ox:ox + nw] = np.asarray(im) > 127
        return out

    def iou(a, b):
        u = (a | b).sum()
        return float((a & b).sum() / u) if u else 0.0

    A = norm(shape)
    cands = []
    for ch in ("I", "l"):
        r = raster(ch)
        if r is not None:
            cands.append((ch, norm(r)))
    if len(cands) < 2:
        print("   미상 카드: 후보 래스터 실패"); return

    pad, gap, inset = 26, 22, 22
    cell = (out_w - pad * 2 - gap * 2) // 3
    head, foot = 34, 96
    canvas = Image.new("RGB", (out_w, pad + head + cell + foot), (255, 255, 255))
    d = ImageDraw.Draw(canvas)

    def paste(x, arr, color, outline=False):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        px = img.load()
        src = arr
        if outline:
            e = np.zeros_like(arr)
            e[1:-1, 1:-1] = arr[1:-1, 1:-1] & ~(
                arr[:-2, 1:-1] & arr[2:, 1:-1] & arr[1:-1, :-2] & arr[1:-1, 2:])
            src = e
        for yy, xx in zip(*np.where(src)):
            px[int(xx), int(yy)] = color
        inner = cell - inset * 2
        rs = img.resize((inner, inner), Image.LANCZOS)
        canvas.paste(rs, (x + inset, pad + head + inset), rs)
        d.rectangle([x, pad + head, x + cell, pad + head + cell],
                    outline=(232, 236, 234), width=1)

    xs = [pad, pad + cell + gap, pad + (cell + gap) * 2]
    labels = ["① 받은 도형", f"② 후보 — 대문자 {cands[0][0]}", f"③ 후보 — 소문자 {cands[1][0]}"]
    for x, t in zip(xs, labels):
        d.text((x, pad + 8), t, fill=(92, 103, 99), font=_ui(13))
    paste(xs[0], A, (14, 22, 19, 255))
    paste(xs[1], cands[0][1], (30, 122, 90, 255), outline=True)
    paste(xs[2], cands[1][1], (30, 122, 90, 255), outline=True)

    s1, s2 = iou(A, cands[0][1]), iou(A, cands[1][1])
    fy = pad + head + cell + 18
    d.text((xs[1], fy), f"{s1:.4f}", fill=(14, 22, 19), font=_ui(21, True))
    d.text((xs[2], fy), f"{s2:.4f}", fill=(14, 22, 19), font=_ui(21, True))
    d.text((pad, fy + 2), "판정 — 미상", fill=(180, 83, 74), font=_ui(19, True))
    d.text((pad, fy + 34),
           "두 후보의 모양이 완전히 같습니다. 점수로는 고를 수 없습니다.",
           fill=(92, 103, 99), font=_ui(14))
    d.text((pad, fy + 58),
           f"그래서 이 줄({ln['text'][:26]})은 복원하지 않고 원본 그대로 두었습니다.",
           fill=(92, 103, 99), font=_ui(14))
    canvas.save(dst, optimize=True)
    print(f"   미상 카드: {ln['text'][:24]!r}  I={s1:.4f}  l={s2:.4f}")
