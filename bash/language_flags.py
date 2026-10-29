"""Keep language selectors consistent; never link to a missing translation.

Run after generating translated pages: python bash/language_flags.py
HTML bytes are decoded as Latin-1 and re-encoded unchanged outside selectors.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BLOCK = re.compile(r'<div id="infoFlags"[^>]*>.*?</div>', re.S)
LINK = re.compile(r'<a\b([^>]*)>(.*?)</a>', re.S)
HREF = re.compile(r'href\s*=\s*"([^"]+)"')
FLAGS = {'es': ('flagSpain.svg', 'Espa&#241;ol'),
         'en': ('flagUSA.png', 'English'),
         'de': ('flagGerman.png', 'Deutsch')}


def synchronize(html, filename, available):
    def selector(match):
        block = match[0]
        targets = {}
        extras = []
        for attrs, content in LINK.findall(block):
            href = HREF.search(attrs)
            if not href:
                continue
            target = href[1]
            language = next((lang for lang, (asset, _) in FLAGS.items()
                             if asset in content), None)
            if language:
                stem = re.sub(r'_(es|ger)$', '', Path(target).stem)
                suffix = {'en': '', 'de': '_ger', 'es': '_es'}[language]
                expected = stem + suffix + '.html'
                if expected in available:
                    target = expected
                if target in available:
                    targets[language] = target
            else:
                extras.append('<a' + attrs + '>' + content + '</a>')
        # Variant pages already switch to the canonical English/German scenario.
        # Use that same scenario for Spanish, rather than inventing a variant.
        for target in list(targets.values()):
            stem = re.sub(r'_(es|ger)$', '', Path(target).stem)
            spanish = stem + '_es.html'
            if spanish in available:
                targets.setdefault('es', spanish)
                break
        width = '27%' if len(targets) == 3 or extras else '45%'
        links = []
        for lang, (asset, label) in FLAGS.items():
            if lang not in targets:
                continue
            target = targets[lang]
            current = ' aria-current="page"' if target == filename else ''
            links.append('<a href="' + target + '" lang="' + lang + '"' + current
                         + '><img src="figs/' + asset + '" alt="' + label
                         + '" title="' + label + '" width="' + width + '"></a>')
        opening = block[:block.index('>') + 1]
        return opening + '\n' + '\n'.join(links + extras) + '\n</div>'
    return BLOCK.sub(selector, html)


def sync_repository(root=ROOT):
    pages = list(root.glob('*.html'))
    available = {p.name for p in pages}
    changed = []
    for page in pages:
        original = page.read_bytes()
        html = original.decode('latin1')
        # These German-only scenarios gained Spanish counterparts, but had no
        # language selector of their own to provide the return link.
        if page.name in ('onramp_BaWue_ger.html', 'roadworks_BaWue_ger.html') and not BLOCK.search(html):
            spanish = page.stem.removesuffix('_ger') + '_es.html'
            if spanish in available:
                block = '<div id="infoFlags"><a href="' + page.name + '"><img src="figs/flagGerman.png"></a></div>\n'
                html = html.replace('</body>', block + '</body>')
        updated = synchronize(html, page.name, available).encode('latin1')
        if updated != original:
            page.write_bytes(updated)
            changed.append(page.name)
    return changed


if __name__ == '__main__':
    print('Updated language selectors:', len(sync_repository()))
