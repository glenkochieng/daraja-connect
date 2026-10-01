from daraja.preprocess import display_term, has_content, normalise_text


def test_glossary_maps_aircraft_aliases_to_one_token():
    text = normalise_text("Worked on the B787 Dreamliner and the Boeing 787-8.")
    assert text.split().count("boeing787") == 3
    assert "b787" not in text


def test_longest_variant_wins():
    assert "boeing737freighter" in normalise_text("Loading the Boeing 737 freighter")
    assert "boeing737 freighter" not in normalise_text("Loading the Boeing 737 freighter")


def test_abbreviations_are_normalised():
    assert normalise_text("DGR and dangerous goods") == "dangerousgoods and dangerousgoods"


def test_glossary_does_not_match_inside_words():
    # 'sep' must not match inside 'separate', 'ame' not inside 'name'
    assert normalise_text("separate name") == "separate name"


def test_glossary_can_be_disabled():
    assert "b787" in normalise_text("B787 checks", use_glossary=False)


def test_has_content():
    assert not has_content("")
    assert not has_content("  123 ")
    assert has_content("line maintenance")


def test_display_term_maps_canonical_tokens_back():
    assert display_term("dangerousgoods") == "dangerous goods"
    assert display_term("boeing787 checks") == "Boeing 787 checks"
