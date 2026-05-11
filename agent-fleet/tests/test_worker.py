from fleet.worker import _extract_acceptance


def test_extracts_section_present():
    body = "Some intro.\n\n### Acceptance criteria\n- Tests pass\n- No regressions"
    assert _extract_acceptance(body) == "- Tests pass\n- No regressions"


def test_extracts_section_stops_at_next_heading():
    body = "### Acceptance criteria\n- Do X\n\n### Other section\nIgnored"
    assert _extract_acceptance(body) == "- Do X"


def test_fallback_when_section_missing():
    assert _extract_acceptance("No criteria here.") == "(See issue body)"


def test_empty_body():
    assert _extract_acceptance("") == "(See issue body)"
