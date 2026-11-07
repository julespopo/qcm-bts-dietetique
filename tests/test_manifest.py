#!/usr/bin/env python3
"""Verify the generator in an isolated fixture; never modify repository banks."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    fixture = Path(directory)
    generator = fixture / 'generer_manifest.py'
    shutil.copyfile(root / generator.name, generator)
    bank = fixture / 'banques' / 'Test' / '01_test.json'
    bank.parent.mkdir(parents=True)
    bank.write_text(json.dumps({'title': 'Test', 'questions': []}), encoding='utf-8')

    def run(*args):
        return subprocess.run([sys.executable, str(generator), *args], capture_output=True, text=True)

    assert run().returncode == 0
    manifest_path = fixture / 'manifest.json'
    data = json.loads(manifest_path.read_text())
    data['updated'] = '2020-01-01'
    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    original = manifest_path.read_bytes()
    assert run('--check').returncode == 0
    assert manifest_path.read_bytes() == original, '--check modified the manifest'
    assert run().returncode == 0
    assert manifest_path.read_bytes() == original, 'unchanged banks caused a daily diff'
    bank.write_text(json.dumps({'title': 'Changed', 'questions': []}), encoding='utf-8')
    assert run('--check').returncode == 1, 'stale manifest accepted'
    assert manifest_path.read_bytes() == original, 'failed --check modified the manifest'
    assert run().returncode == 0
    assert run('--check').returncode == 0
print('OK — manifest: read-only check, stale data rejection and deterministic regeneration')
