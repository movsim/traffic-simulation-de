import sys
sys.dont_write_bytecode = True
import tempfile
import unittest
from pathlib import Path
from language_flags import synchronize, sync_repository, ROOT, BLOCK, LINK, HREF


class LanguageFlagsTest(unittest.TestCase):
    def test_variant_uses_existing_canonical_translation(self):
        html = '<div id="infoFlags"><a href="ring.html"><img src="figs/flagUSA.png"></a></div>'
        result = synchronize(html, 'ringOld.html', {'ring.html', 'ring_es.html'})
        self.assertIn('href="ring_es.html"', result)
        self.assertNotIn('ringOld_es.html', result)
        self.assertEqual(result, synchronize(result, 'ringOld.html', {'ring.html', 'ring_es.html'}))

    def test_missing_translation_is_not_linked(self):
        html = '<div id="infoFlags"><a href="test.html"><img src="figs/flagUSA.png"></a><a href="test_ger.html"><img src="figs/flagGerman.png"></a></div>'
        result = synchronize(html, 'test.html', {'test.html'})
        self.assertNotIn('flagGerman', result)
        self.assertNotIn('flagSpain', result)
        self.assertIn('aria-current="page"', result)

    def test_legacy_encoding_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original = b'<p>\xfc</p>\r\n<div id="infoFlags"><a href="test.html"><img src="figs/flagUSA.png"></a></div>'
            (root / 'test.html').write_bytes(original)
            sync_repository(root)
            self.assertTrue((root / 'test.html').read_bytes().startswith(b'<p>\xfc</p>\r\n'))
            self.assertEqual(sync_repository(root), [])

    def test_repository_links_exist_and_selectors_are_current(self):
        pages = list(ROOT.glob('*.html'))
        available = {p.name for p in pages}
        for page in pages:
            html = page.read_bytes().decode('latin1')
            with self.subTest(page=page.name):
                self.assertEqual(html, synchronize(html, page.name, available))
                for block in BLOCK.findall(html):
                    for attrs, content in LINK.findall(block):
                        href = HREF.search(attrs)
                        self.assertIsNotNone(href)
                        self.assertIn(href[1], available)
                        if 'flag' in content:
                            self.assertIn('alt="', content)
                            self.assertIn('title="', content)
                            self.assertIn('lang="', attrs)


if __name__ == '__main__':
    unittest.main()
