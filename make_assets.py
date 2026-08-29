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
