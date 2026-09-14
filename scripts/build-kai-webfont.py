#!/usr/bin/env python3
"""Slice 全字庫正楷體 (TW-Kai) into woff2 subsets for printing.

`.official-font-when-printing` asks for a Kai face; readers who have one installed use theirs, and
everyone else (every phone, in practice) downloads these. The source is the government's own
TW-Kai-98_1.ttf — the BMP face, 35 MB and 39k glyphs — which is far too large to serve whole, so it
is cut into unicode-range subsets the way Google Fonts cuts CJK: the browser fetches only the slices
the text on the page actually needs.

Slices are ordered by how often each character appears in this site's own corpus, because that is
the only text the font is ever used to render. The result is that a typical legislation is covered
by the first few slices. Characters outside the corpus still ship, in later slices, so newly added
content renders correctly without regenerating anything.

Usage:
    python scripts/build-kai-webfont.py --source path/to/TW-Kai-98_1.ttf [--corpus corpus.txt]
    python scripts/build-kai-webfont.py --source ... --plan     # report sizes, write nothing

Get TW-Kai from https://data.gov.tw/dataset/5961 (全字庫, 政府資料開放授權條款 第1版).
Requires: pip install fonttools brotli
"""

import argparse
import html
import os
import re
import shutil
import sys
from collections import Counter

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

OUT_DIR = os.path.join('public', 'fonts', 'tw-kai')
CSS_PATH = os.path.join('public', 'fonts', 'tw-kai.css')
CSS_HREF = '/fonts/tw-kai.css'
FAMILY = 'TW-Kai'
# Big enough that a page rarely needs many slices, small enough that a slice is a cheap request.
CHUNK = 200


def big5_chars(lo: int, hi: int) -> list[str]:
    """Characters in a Big5 code range, in Big5 order."""
    out = []
    for lead in range(lo >> 8, (hi >> 8) + 1):
        for trail in [*range(0x40, 0x7F), *range(0xA1, 0xFF)]:
            code = (lead << 8) | trail
            if lo <= code <= hi:
                try:
                    out.append(bytes([lead, trail]).decode('big5'))
                except UnicodeDecodeError:
                    pass
    return out


def corpus_frequency(path: str | None) -> Counter:
    if not path:
        return Counter()
    with open(path, encoding='utf-8', errors='ignore') as fh:
        text = fh.read()
    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', text, flags=re.S | re.I)
    return Counter(html.unescape(re.sub(r'<[^>]+>', ' ', text)))


def ordered_charset(cmap: set[int], frequency: Counter) -> list[int]:
    """Characters to ship, most worth fetching first."""
    ordered: list[int] = []
    seen: set[int] = set()

    def add(chars):
        for ch in chars:
            cp = ord(ch)
            if cp in cmap and cp not in seen:
                seen.add(cp)
                ordered.append(cp)

    # Corpus first, commonest first: this is the text the font actually has to render.
    add(ch for ch, _ in frequency.most_common())
    # Then the standard sets, so content added later is covered without regenerating.
    add(chr(c) for c in range(0x20, 0x7F))  # ASCII
    add(big5_chars(0xA140, 0xA3BF))  # Big5 symbols and punctuation
    add(big5_chars(0xA440, 0xC67E))  # Big5 level 1, 常用字
    add(big5_chars(0xC940, 0xF9D5))  # Big5 level 2, 次常用字
    return ordered


def unicode_range(codepoints: list[int]) -> str:
    """Collapse a sorted codepoint list into CSS `unicode-range` syntax."""
    parts = []
    start = prev = codepoints[0]
    for cp in codepoints[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        parts.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
        start = prev = cp
    parts.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
    return ', '.join(parts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, help='TW-Kai-98_1.ttf')
    parser.add_argument('--corpus', help='text or HTML to derive the slice ordering from')
    parser.add_argument('--plan', action='store_true', help='report and write nothing')
    args = parser.parse_args()

    frequency = corpus_frequency(args.corpus)
    cmap = set(TTFont(args.source, lazy=True).getBestCmap())
    ordered = ordered_charset(cmap, frequency)
    chunks = [ordered[i : i + CHUNK] for i in range(0, len(ordered), CHUNK)]
    print(f'{len(cmap)} glyphs in source, {len(ordered)} shipped, {len(chunks)} slices of {CHUNK}')
    if args.plan:
        covered = sum(1 for ch in frequency if ord(ch) in cmap)
        print(f'corpus contributes {covered} characters')
        return 0

    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)

    faces, total = [], 0
    for index, chunk in enumerate(chunks):
        font = TTFont(args.source)
        options = Options()
        options.flavor = 'woff2'
        options.notdef_outline = True
        options.drop_tables += ['DSIG', 'FFTM']
        subsetter = Subsetter(options=options)
        subsetter.populate(text=''.join(chr(cp) for cp in chunk))
        subsetter.subset(font)
        name = f'tw-kai-{index:03d}.woff2'
        font.flavor = 'woff2'
        font.save(os.path.join(OUT_DIR, name))
        size = os.path.getsize(os.path.join(OUT_DIR, name))
        total += size
        faces.append((name, unicode_range(sorted(chunk))))
        print(f'  {name}  {len(chunk):4d} chars  {size / 1024:6.0f} KB', flush=True)

    with open(CSS_PATH, 'w', encoding='utf-8', newline='\n') as css:
        css.write(
            '/* 全字庫正楷體 (TW-Kai), 政府資料開放授權條款 第1版 — https://data.gov.tw/dataset/5961\n'
            ' * Generated by scripts/build-kai-webfont.py; do not edit by hand.\n'
            ' * Loaded only when someone prints on a device with no Kai font of its own, so the\n'
            ' * `local()` source below keeps readers who have TW-Kai installed off the network. */\n'
        )
        for name, ranges in faces:
            css.write(
                f"\n@font-face {{\n"
                f"  font-family: '{FAMILY}';\n"
                f"  font-style: normal;\n"
                f"  font-weight: 400;\n"
                f"  font-display: swap;\n"
                f"  src: local('{FAMILY}'), url('/fonts/tw-kai/{name}') format('woff2');\n"
                f"  unicode-range: {ranges};\n"
                f"}}\n"
            )
    print(f'{total / 1048576:.1f} MB across {len(faces)} slices -> {CSS_PATH} ({CSS_HREF})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
