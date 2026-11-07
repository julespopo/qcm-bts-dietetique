#!/usr/bin/env python3
"""Exercise standalone generation and stale-output rejection in an isolated fixture."""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    fixture = Path(directory)
    (fixture / 'scripts').mkdir()
    shutil.copyfile(root / 'scripts/build.py', fixture / 'scripts/build.py')
    shutil.copytree(root / 'src', fixture / 'src')
    def run(*args):
        return subprocess.run([sys.executable, str(fixture / 'scripts/build.py'), *args], capture_output=True)
    assert run('--check').returncode == 1, 'missing outputs accepted'
    assert run().returncode == 0
    web = (fixture / 'index.html').read_text()
    local = (fixture / 'index_local.html').read_text()
    assert re.search(r'<script>([\s\S]*?)</script>', web)[1] == re.search(r'<script>([\s\S]*?)</script>', local)[1], 'editions contain different application code'
    assert re.search(r'<style>([\s\S]*?)</style>', web)[1] == re.search(r'<style>([\s\S]*?)</style>', local)[1], 'editions contain different styles'
    assert 'id="folderInput"' not in web and 'id="folderInput"' in local
    assert run('--check').returncode == 0
    with (fixture / 'src/styles.css').open('a') as output:
        output.write('\n/* changed source */\n')
    assert run('--check').returncode == 1, 'stale output accepted'
    assert (fixture / 'index.html').read_text() == web, '--check modified an output'
    assert run().returncode == 0
    assert run('--check').returncode == 0
print('OK — build: shared scripts/styles, local loader and read-only freshness checks')
