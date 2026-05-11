"""Tests for config.py — shared constants."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestCadenceDefaults:
    def test_ae_default_trimestrielle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["auto-entrepreneur"] == "trimestrielle"

    def test_sasu_default_mensuelle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["SASU"] == "mensuelle"

    def test_sarl_default_mensuelle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["SARL"] == "mensuelle"

    def test_salarie_default_annuelle(self):
        from config import CADENCE_DEFAULTS
        assert CADENCE_DEFAULTS["salarié"] == "annuelle"
