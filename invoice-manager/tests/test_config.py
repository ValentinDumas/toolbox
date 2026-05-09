"""Tests for config.py — optional config loading with fallback."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DEFAULT_CONFIG, load_config, _deep_merge
import copy


class TestDeepMerge:
    def test_top_level_override(self):
        base = {"a": 1, "b": 2}
        _deep_merge(base, {"b": 99})
        assert base == {"a": 1, "b": 99}

    def test_nested_merge(self):
        base = {"extraction": {"ocr_dpi": 300, "ocr_lang": "fra"}}
        _deep_merge(base, {"extraction": {"ocr_dpi": 600}})
        assert base["extraction"]["ocr_dpi"] == 600
        assert base["extraction"]["ocr_lang"] == "fra"

    def test_new_key_added(self):
        base = {"a": 1}
        _deep_merge(base, {"b": 2})
        assert base["b"] == 2

    def test_does_not_mutate_override(self):
        base = {"x": {"y": 1}}
        override = {"x": {"z": 2}}
        original_override = copy.deepcopy(override)
        _deep_merge(base, override)
        assert override == original_override


class TestLoadConfig:
    def test_missing_file_returns_defaults(self, tmp_path):
        cfg = load_config(tmp_path / "nonexistent.toml")
        assert cfg == DEFAULT_CONFIG

    def test_valid_config_overrides_defaults(self, tmp_path):
        (tmp_path / "config.toml").write_text(
            '[extraction]\nocr_dpi = 600\n[fiscal]\ndefault_profile = "SASU"\n'
        )
        cfg = load_config(tmp_path / "config.toml")
        assert cfg["extraction"]["ocr_dpi"] == 600
        assert cfg["fiscal"]["default_profile"] == "SASU"

    def test_partial_config_keeps_unset_defaults(self, tmp_path):
        (tmp_path / "config.toml").write_text('[extraction]\nocr_dpi = 150\n')
        cfg = load_config(tmp_path / "config.toml")
        assert cfg["extraction"]["ocr_dpi"] == 150
        assert cfg["extraction"]["ocr_lang"] == DEFAULT_CONFIG["extraction"]["ocr_lang"]
        assert cfg["paths"] == DEFAULT_CONFIG["paths"]

    def test_invalid_toml_falls_back_to_defaults(self, tmp_path):
        (tmp_path / "config.toml").write_bytes(b"not valid toml [[[")
        cfg = load_config(tmp_path / "config.toml")
        assert cfg == DEFAULT_CONFIG

    def test_unreadable_file_falls_back_to_defaults(self, tmp_path):
        p = tmp_path / "config.toml"
        p.write_text("[extraction]\nocr_dpi = 999\n")
        p.chmod(0o000)
        try:
            cfg = load_config(p)
            assert cfg == DEFAULT_CONFIG
        finally:
            p.chmod(0o644)

    def test_does_not_mutate_default_config(self, tmp_path):
        before = copy.deepcopy(DEFAULT_CONFIG)
        (tmp_path / "config.toml").write_text('[extraction]\nocr_dpi = 999\n')
        load_config(tmp_path / "config.toml")
        assert DEFAULT_CONFIG == before


class TestNewOCRConfigKeys:
    def test_defaults_present(self):
        from config import DEFAULT_CONFIG
        ext = DEFAULT_CONFIG["extraction"]
        assert "ocr_preprocess" in ext
        assert ext["ocr_preprocess"] is True
        assert "ocr_easyocr_fallback" in ext
        assert ext["ocr_easyocr_fallback"] is False
        assert "ocr_easyocr_threshold" in ext
        assert ext["ocr_easyocr_threshold"] == 0.4

    def test_easyocr_keys_merged_from_toml(self, tmp_path):
        from config import load_config
        cfg_file = tmp_path / "config.toml"
        cfg_file.write_text('[extraction]\nocr_easyocr_fallback = true\nocr_easyocr_threshold = 0.3\n')
        cfg = load_config(cfg_file)
        assert cfg["extraction"]["ocr_easyocr_fallback"] is True
        assert cfg["extraction"]["ocr_easyocr_threshold"] == 0.3


class TestCadenceDefaults:
    def test_ae_default_trimestrielle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["auto-entrepreneur"] == "trimestrielle"

    def test_sasu_default_mensuelle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["SASU"] == "mensuelle"

    def test_identity_in_default_config(self):
        assert "identity" in DEFAULT_CONFIG
        assert DEFAULT_CONFIG["identity"]["siren"] == ""

    def test_cadence_in_default_config(self):
        assert "cadence_déclaration" in DEFAULT_CONFIG["fiscal"]
        assert DEFAULT_CONFIG["fiscal"]["cadence_déclaration"] == ""
