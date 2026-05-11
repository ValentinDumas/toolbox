import json
import textwrap
from pathlib import Path

import pytest

from fleet.inspector.code import _collect_source, MAX_SOURCE_CHARS


# --- _collect_source ---

def test_collects_python_files(tmp_path):
    (tmp_path / "a.py").write_text("x = 1")
    (tmp_path / "b.py").write_text("y = 2")
    result = _collect_source(tmp_path)
    assert "x = 1" in result
    assert "y = 2" in result


def test_excludes_venv_and_pycache(tmp_path):
    (tmp_path / ".venv").mkdir()
    (tmp_path / ".venv" / "lib.py").write_text("hidden = True")
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "__pycache__" / "cached.py").write_text("cached = True")
    (tmp_path / "visible.py").write_text("visible = True")
    result = _collect_source(tmp_path)
    assert "hidden" not in result
    assert "cached" not in result
    assert "visible" in result


def test_truncates_at_max_chars(tmp_path):
    (tmp_path / "big.py").write_text("x" * 200)
    result = _collect_source(tmp_path, max_chars=100)
    assert len(result) <= 100 + 50  # header overhead is small


def test_empty_repo(tmp_path):
    result = _collect_source(tmp_path)
    assert result == ""


# --- JSON fence stripping (tested via the parsing logic inline) ---

def _strip_fences(raw: str) -> str:
    """Mirror of the stripping logic in inspector/code.py run()."""
    if "```" in raw:
        raw = raw.split("```", 1)[1]
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    elif "[" in raw:
        raw = raw[raw.index("["):]
    return raw


def test_strip_plain_json():
    raw = '[{"title": "fix it"}]'
    assert json.loads(_strip_fences(raw)) == [{"title": "fix it"}]


def test_strip_fenced_json():
    raw = "Here is the output:\n```json\n[{\"title\": \"fix it\"}]\n```"
    assert json.loads(_strip_fences(raw)) == [{"title": "fix it"}]


def test_strip_prose_before_json():
    raw = 'Sure! Here are the issues:\n[{"title": "fix it"}]'
    assert json.loads(_strip_fences(raw)) == [{"title": "fix it"}]


def test_strip_fenced_no_language_tag():
    raw = "```\n[{\"title\": \"x\"}]\n```"
    assert json.loads(_strip_fences(raw)) == [{"title": "x"}]
