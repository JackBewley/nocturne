import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


pack = module('pack', 'package.py')
watch = module('watch', 'check-release.py')


class AutomationTests(unittest.TestCase):
    def test_review_is_required(self):
        for value in [False, None, 'true', 1]:
            self.assertIsNone(pack.validated_config({'compatibilityReviewed': value}))

    def test_reject_invalid_image_version(self):
        with self.assertRaises(ValueError):
            pack.validated_config({'compatibilityReviewed': True, 'requiredImageVersion': '4.1.9;echo bad', 'upstreamTag': 'v4.1.9'})

    def test_wrong_device_version_stops_before_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'os-release').write_text('ID=nocturne\nVERSION_ID=4.1.8\n')
            (root / 'required-image-version.txt').write_text('4.1.9\n')
            script = (HERE / 'install-device.sh').read_text().replace('. /etc/os-release', f'. "{root}/os-release"')
            (root / 'install.sh').write_text(script)
            result = subprocess.run(['sh', str(root / 'install.sh')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Nothing installed', result.stdout)
            self.assertNotIn('sha256sum', result.stderr)

    def test_already_merged_release_does_nothing(self):
        def run(*args, **kwargs):
            return subprocess.CompletedProcess(args, 0, 'a' * 40 + '\n' if args[1] == 'rev-parse' else '', '')
        with patch.dict(watch.os.environ, GITHUB_REPOSITORY=watch.REPO), patch.object(watch, 'api', return_value={'tag_name':'v4.1.9','draft':False,'prerelease':False}), patch.object(watch, 'run', side_effect=run) as commands, patch.object(watch, 'output') as out:
            watch.main()
            out.assert_called_once_with(changed='false')
            self.assertFalse(any('push' in c.args for c in commands.call_args_list))

    def test_duplicate_pr_is_not_recreated(self):
        def run(*args, **kwargs):
            return subprocess.CompletedProcess(args, 1 if args[1] == 'merge-base' else 0, 'a' * 40, '')
        with patch.dict(watch.os.environ, GITHUB_REPOSITORY=watch.REPO), patch.object(watch, 'api', side_effect=[{'tag_name':'v4.2.0','draft':False,'prerelease':False}, [{'html_url':'https://github.com/JackBewley/nocturne/pull/1'}]]) as api, patch.object(watch, 'run', side_effect=run), patch.object(watch, 'output') as out:
            watch.main()
            out.assert_called_once_with(changed='false')
            self.assertEqual(api.call_count, 2)

    def test_prerelease_is_rejected(self):
        with patch.dict(watch.os.environ, GITHUB_REPOSITORY=watch.REPO), patch.object(watch, 'api', return_value={'tag_name':'v4.2.0-beta','draft':False,'prerelease':True}), patch.object(watch, 'run') as run:
            with self.assertRaises(RuntimeError):
                watch.main()
            run.assert_not_called()

    def test_bundle_has_checksums_and_excludes_preview_fixtures(self):
        import tarfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tools = root / 'tools/personal'
            tools.mkdir(parents=True)
            (tools/'config.json').write_text(json.dumps({'upstreamTag':'v4.1.9','requiredImageVersion':'4.1.9','compatibilityReviewed':True}))
            (tools/'install-device.sh').write_bytes((HERE/'install-device.sh').read_bytes())
            dist = root/'packages/ui/dist'
            dist.mkdir(parents=True)
            (dist/'index.html').write_text('test')
            (dist/'preview-test.jpg').write_text('exclude')
            with patch.object(pack, 'ROOT', root), patch.object(pack.subprocess, 'check_output', return_value='a'*40), patch.object(pack, 'outputs'):
                pack.main()
            with tarfile.open(root/'personal-dist/personal-ui-bundle.tar.gz') as bundle:
                self.assertEqual(set(bundle.getnames()), {'ui.tar.gz','SHA256SUMS','install-device.sh','required-image-version.txt'})
                with tarfile.open(fileobj=bundle.extractfile('ui.tar.gz')) as ui:
                    self.assertNotIn('preview-test.jpg', ui.getnames())
                    self.assertIn('personal-files.sha256', ui.getnames())
                    checksum = ui.extractfile('personal-files.sha256').read().decode()
                    self.assertIn(pack.digest(dist/'index.html'), checksum)

class MergeIntegrationTests(unittest.TestCase):
    def exercise_merge(self, conflict):
        import os
        original_run = watch.run
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bare = root / 'remote.git'
            repo = root / 'repo'
            subprocess.run(['git', 'init', '--bare', str(bare)], check=True, capture_output=True)
            subprocess.run(['git', 'init', '-b', 'personal/nocturne', str(repo)], check=True, capture_output=True)
            os.chdir(repo)
            try:
                original_run('git','config','user.name','Test')
                original_run('git','config','user.email','test@example.invalid')
                (repo/'tools/personal').mkdir(parents=True)
                (repo/'.github/workflows').mkdir(parents=True)
                (repo/'tools/personal/config.json').write_text(json.dumps({'upstreamTag':'v4.1.9','requiredImageVersion':'4.1.9','compatibilityReviewed':True}))
                (repo/'.github/workflows/test.yml').write_text('original workflow')
                (repo/'app.txt').write_text('original\n')
                original_run('git','add','.')
                original_run('git','commit','-m','base')
                original_run('git','checkout','-b','upstream')
                (repo/'app.txt').write_text('upstream\n')
                (repo/'.github/workflows/test.yml').write_text('new upstream workflow')
                original_run('git','add','.')
                original_run('git','commit','-m','release')
                original_run('git','tag','v4.2.0')
                original_run('git','checkout','personal/nocturne')
                if conflict:
                    (repo/'app.txt').write_text('personal\n')
                    original_run('git','add','.')
                    original_run('git','commit','-m','personal change')
                base = original_run('git','rev-parse','HEAD').stdout.strip()
                original_run('git','remote','add','origin',str(bare))
                original_run('git','push','origin','personal/nocturne')
                def local_run(*args, **kwargs):
                    args = tuple(str(repo) if a == 'https://github.com/usenocturne/nocturne.git' else a for a in args)
                    return original_run(*args, **kwargs)
                responses = [{'tag_name':'v4.2.0','draft':False,'prerelease':False}, [], {'number':1,'html_url':'https://github.com/JackBewley/nocturne/pull/1'}, {}]
                with patch.dict(os.environ, GITHUB_REPOSITORY=watch.REPO, GITHUB_RUN_ID='123'), patch.object(watch,'api',side_effect=responses) as api, patch.object(watch,'run',side_effect=local_run), patch.object(watch,'output') as out:
                    watch.main()
                    self.assertEqual(out.call_args.kwargs['clean'], str(not conflict).lower())
                    self.assertEqual(api.call_args_list[2].args[1]['draft'], conflict)
                self.assertEqual(original_run('git','rev-parse','personal/nocturne').stdout.strip(),base)
                self.assertFalse(json.loads((repo/'tools/personal/config.json').read_text())['compatibilityReviewed'])
                self.assertEqual((repo/'.github/workflows/test.yml').read_text(),'original workflow')
                self.assertEqual((repo/'tools/personal/update-conflicts.md').exists(),conflict)
                self.assertEqual((repo/'app.txt').read_text(),'personal\n' if conflict else 'upstream\n')
            finally:
                os.chdir(previous)

    def test_clean_merge_preserves_personal_branch_and_requires_review(self):
        self.exercise_merge(False)

    def test_conflict_aborts_merge_and_creates_draft_report(self):
        self.exercise_merge(True)
