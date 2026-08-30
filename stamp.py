# -*- coding: utf-8 -*-
"""CSS·JS 링크에 내용 해시를 붙여 캐시가 옛 파일을 물고 있지 않게 한다.

왜 필요한가 (2026-08-30 실측):
  사이트를 고쳐 배포했는데 브라우저가 옛 `landing.js` 를 계속 쓰고 있었다.
  서버는 새 파일을 주는데도 그렇다 — 정적 호스팅은 캐시 수명을 길게 잡는다.
  «고쳤는데 안 고쳐졌다» 로 보이는 가장 흔한 원인이고, 실제로 그렇게 헤맸다.

  파일 내용이 바뀌면 주소가 바뀌게 만들면 이 문제가 사라진다.
      <link href="style.css?v=1a2b3c4d">

  이미지는 건드리지 않는다. 이름이 바뀌면 새로 만들면 되고,
  캐시가 오래 남는 편이 오히려 낫다.

실행:  python site/stamp.py     (배포 직전에 한 번)
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGES = ("index.html", "restore.html", "terms.html", "privacy.html")
ASSETS = ("style.css", "landing.js", "restore.js")


def short_hash(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()[:8]


def main() -> int:
    stamps = {}
    for name in ASSETS:
        f = HERE / name
        if f.exists():
            stamps[name] = short_hash(f)

    changed = 0
    for page in PAGES:
        p = HERE / page
        if not p.exists():
            continue
        s = p.read_text(encoding="utf-8")
        before = s
        for name, h in stamps.items():
            # href="style.css" / href="style.css?v=옛해시" 둘 다 잡는다
            s = re.sub(r'(["\'])' + re.escape(name) + r'(\?v=[0-9a-f]+)?\1',
                       r'\g<1>' + name + f'?v={h}' + r'\g<1>', s)
        if s != before:
            p.write_text(s, encoding="utf-8")
            changed += 1
        print(f"  {page}: " + ", ".join(f"{n}?v={h}" for n, h in stamps.items()))
    print(f"버전 스탬프 완료 ({changed}개 파일 갱신)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
