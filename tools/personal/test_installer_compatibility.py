"""Exercise the real shell compatibility gate without installing anything."""
from pathlib import Path
import subprocess
import tempfile
import unittest

class CompatibilityTests(unittest.TestCase):
    def check(self, image, component=None, missing=None, symlink=None,
              target='4.1.10', device='nocturne'):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'os-release').write_text(f'ID={device}\nVERSION_ID={image}\n')
            (root/'required-image-version.txt').write_text(target+'\n')
            overlay = root/'overlay'
            for name in ['.floor-version', 'daemon/nocturned.current', 'webapps/ui/index.html']:
                p = overlay/name
                p.parent.mkdir(parents=True, exist_ok=True)
                if component is not None and name != missing:
                    p.write_text(component if name == '.floor-version' else 'fixture')
                    if name == symlink:
                        real = p.with_name(p.name+'.real')
                        p.rename(real)
                        p.symlink_to(real)
            source = (Path(__file__).parent/'install-device.sh').read_text()
            # Execute the complete production gate, stop before checksum/install work.
            source = source.split('sha256sum -c SHA256SUMS')[0]
            source = source.replace('. /etc/os-release', f'. "{root}/os-release"')
            source = source.replace('overlay=/var/lib/bandaid/nocturne', f'overlay="{overlay}"')
            (root/'check.sh').write_text(source)
            return subprocess.run(['sh', str(root/'check.sh')], capture_output=True, text=True).returncode == 0

    def test_full_image(self):
        self.assertTrue(self.check('4.1.10'))

    def test_confirmed_component_update(self):
        for version in ['4.1.10', '4.1.10+20261124001143']:
            with self.subTest(version=version):
                self.assertTrue(self.check('4.1.9', version))

    def test_old_missing_future_or_malformed_components_rejected(self):
        for version in [None, '4.1.9', '4.1.11', '4.1.10-beta', '4.1.10+', '4.1.10+abc']:
            with self.subTest(version=version):
                self.assertFalse(self.check('4.1.9', version))

    def test_incomplete_or_symlinked_overlay_rejected(self):
        for name in ['.floor-version', 'daemon/nocturned.current', 'webapps/ui/index.html']:
            with self.subTest(name=name):
                self.assertFalse(self.check('4.1.9', '4.1.10', missing=name))
                self.assertFalse(self.check('4.1.9', '4.1.10', symlink=name))

    def test_exception_does_not_accept_other_combinations(self):
        self.assertFalse(self.check('4.1.8', '4.1.10'))
        self.assertFalse(self.check('4.1.9', '4.1.10', target='4.1.11'))
        self.assertFalse(self.check('4.1.9', '4.1.10', device='other'))
