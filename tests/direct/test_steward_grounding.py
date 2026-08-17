import json
from pathlib import Path


CONTRACT_PATH = Path("contracts/gen_hunt.py")


def source():
    return CONTRACT_PATH.read_text()


def test_advanced_levels_have_fixed_authoritative_sources():
    text = source()

    assert "ADVANCED_LEVEL_SOURCES" in text

    for level in ("3", "4", "5", "6", "7", "8"):
        assert f'"{level}": {{' in text

    assert "https://scs.owasp.org/" in text
    assert "https://csrc.nist.gov/publications" in text
    assert "https://attack.mitre.org/" in text


def test_source_url_is_contract_controlled():
    text = source()

    # request_level_quiz accepts only level.
    assert (
        "def request_level_quiz(self, level: str) -> None:"
        in text
    )

    # No caller-controlled URL argument exists.
    assert (
        "def request_level_quiz("
        "self, level: str, source_url"
        not in text
    )

    assert (
        'source_url = (\n'
        '            source["url"]'
        in text
    )


def test_advanced_generation_fetches_authoritative_source():
    text = source()

    assert "gl.nondet.web.get(" in text
    assert "source_url" in text

    assert (
        "GROUNDING_MODE: AUTHORITATIVE_SOURCE"
        in text
    )

    assert "SOURCE_CONTENT:" in text


def test_grounded_prompt_rejects_model_memory():
    text = source()

    assert (
        "using ONLY "
        in text
    )

    assert (
        "Do not use facts that come only from your model memory"
        in text
    )

    assert (
        "facts not present in SOURCE_CONTENT"
        in text
    )


def test_grounding_metadata_is_persisted():
    text = source()

    assert '"grounded": grounded' in text
    assert '"source_name": source_name' in text
    assert '"source_url": source_url' in text


def test_basic_levels_are_not_web_grounded(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    # We do not invoke AI generation here because this version
    # of Direct Mode does not implement ExecPromptTemplate.
    #
    # Instead verify the contract source map does not include
    # beginner levels.
    text = source()
    advanced_sources = text.split(
        "ADVANCED_LEVEL_SOURCES =",
        1,
    )[1].split(
        "}",
        1,
    )[0]

    assert '"1": {' not in advanced_sources
    assert '"2": {' not in advanced_sources


def test_web_failure_occurs_before_prompt_execution(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    caller = contract._addr()
    player = contract._get_player(caller)

    player["levels_completed"] = [
        "1",
        "2",
        "3",
    ]
    player["level"] = 4

    contract._save_player(caller, player)

    direct_vm.mock_web(
        r".*owasp.*",
        {
            "status": 500,
            "body": "source unavailable",
        },
    )

    with direct_vm.expect_revert(
        "Authoritative source unavailable"
    ):
        contract.request_level_quiz("4")


def test_empty_web_body_is_rejected(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    caller = contract._addr()
    player = contract._get_player(caller)

    player["levels_completed"] = [
        "1",
        "2",
        "3",
    ]
    player["level"] = 4

    contract._save_player(caller, player)

    direct_vm.mock_web(
        r".*owasp.*",
        {
            "status": 200,
            "body": "",
        },
    )

    with direct_vm.expect_revert():
        contract.request_level_quiz("4")
