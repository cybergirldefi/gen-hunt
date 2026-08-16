import json
import pytest


VALID_QUIZ = json.dumps([
    {
        "question": "Which action best protects a crypto account from password reuse attacks?",
        "options": {
            "A": "Use the same password everywhere",
            "B": "Use a unique strong password and a password manager",
            "C": "Share the password with a trusted friend",
            "D": "Disable two-factor authentication",
        },
        "correct": "B",
        "explanation": "Unique strong passwords reduce credential stuffing risk, while password managers make them practical.",
    },
    {
        "question": "What is a common sign of a phishing website?",
        "options": {
            "A": "A suspicious or misspelled domain name",
            "B": "A valid HTTPS connection alone",
            "C": "A bookmarked website",
            "D": "A hardware wallet",
        },
        "correct": "A",
        "explanation": "Attackers often register domains that closely imitate legitimate websites to steal credentials.",
    },
    {
        "question": "What does two-factor authentication improve?",
        "options": {
            "A": "Transaction speed",
            "B": "Token liquidity",
            "C": "Account security by requiring another authentication factor",
            "D": "Blockchain block size",
        },
        "correct": "C",
        "explanation": "Two-factor authentication adds another independent proof of identity beyond a password.",
    },
    {
        "question": "What should you do before connecting a wallet to an unfamiliar dApp?",
        "options": {
            "A": "Approve every permission requested",
            "B": "Verify the domain and understand the requested permissions",
            "C": "Publish your seed phrase",
            "D": "Turn off wallet warnings",
        },
        "correct": "B",
        "explanation": "Checking the domain and requested wallet permissions reduces the risk of phishing and malicious approvals.",
    },
    {
        "question": "Which information should never be shared with another person?",
        "options": {
            "A": "Public wallet address",
            "B": "Blockchain transaction hash",
            "C": "Seed phrase",
            "D": "Token symbol",
        },
        "correct": "C",
        "explanation": "A seed phrase controls access to the wallet and should remain secret at all times.",
    },
])


def deploy_genhunt(direct_deploy):
    return direct_deploy("contracts/gen_hunt.py")


def addr(address):
    return "0x" + bytes(address).hex()


def player(contract, address):
    return json.loads(contract.get_player(addr(address)))


def test_new_player_defaults(direct_deploy, direct_alice):
    contract = deploy_genhunt(direct_deploy)
    p = player(contract, direct_alice)

    assert p["level"] == 1
    assert p["xp"] == 0
    assert p["streak"] == 0
    assert p["best_streak"] == 0
    assert p["total_correct"] == 0
    assert p["total_answered"] == 0
    assert p["levels_completed"] == []


def test_set_username(direct_vm, direct_deploy, direct_alice):
    contract = deploy_genhunt(direct_deploy)
    direct_vm.sender = direct_alice

    contract.set_username("CyberHunter")

    assert player(contract, direct_alice)["username"] == "CyberHunter"


def test_empty_username_reverts(direct_vm, direct_deploy, direct_alice):
    contract = deploy_genhunt(direct_deploy)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Username required"):
        contract.set_username("   ")


def test_long_username_reverts(direct_vm, direct_deploy, direct_alice):
    contract = deploy_genhunt(direct_deploy)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Username must be 32 characters or fewer"):
        contract.set_username("x" * 33)


def test_players_are_isolated(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy_genhunt(direct_deploy)

    direct_vm.sender = direct_alice
    contract.set_username("Alice")

    direct_vm.sender = direct_bob
    contract.set_username("Bob")

    alice = player(contract, direct_alice)
    bob = player(contract, direct_bob)

    assert alice["username"] == "Alice"
    assert bob["username"] == "Bob"
    assert alice["address"] != bob["address"]


def test_cannot_skip_level(direct_vm, direct_deploy, direct_alice):
    contract = deploy_genhunt(direct_deploy)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Complete Level 1 first"):
        contract.request_level_quiz("2")


def test_validate_good_generated_questions(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    questions = contract._validate_generated_questions(VALID_QUIZ)

    assert len(questions) == 5
    assert questions[0]["correct"] == "B"
    assert set(questions[0]["options"].keys()) == {"A", "B", "C", "D"}


def test_bad_ai_json_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    with pytest.raises(Exception, match="AI returned invalid JSON"):
        contract._validate_generated_questions("this is not json")


def test_wrong_question_count_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)
    questions = json.loads(VALID_QUIZ)
    questions.pop()

    with pytest.raises(Exception, match="AI must generate exactly 5 questions"):
        contract._validate_generated_questions(json.dumps(questions))


def test_duplicate_ai_questions_revert(direct_deploy):
    contract = deploy_genhunt(direct_deploy)
    questions = json.loads(VALID_QUIZ)

    questions[1]["question"] = questions[0]["question"]

    with pytest.raises(Exception, match="AI generated duplicate questions"):
        contract._validate_generated_questions(json.dumps(questions))


def test_duplicate_options_revert(direct_deploy):
    contract = deploy_genhunt(direct_deploy)
    questions = json.loads(VALID_QUIZ)

    questions[0]["options"]["C"] = questions[0]["options"]["B"]

    with pytest.raises(Exception, match="contains duplicate options"):
        contract._validate_generated_questions(json.dumps(questions))


def test_invalid_correct_answer_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)
    questions = json.loads(VALID_QUIZ)

    questions[0]["correct"] = "X"

    with pytest.raises(Exception, match="invalid correct answer"):
        contract._validate_generated_questions(json.dumps(questions))


def test_validate_good_answers(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    answers = json.dumps({
        "0": "b",
        "1": "A",
        "2": "c",
        "3": "B",
        "4": "C",
    })

    result = contract._validate_answers(answers, 5)

    assert result == {
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
        "4": "C",
    }


def test_invalid_answer_shape_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    bad_answers = json.dumps({
        "x": "A",
        "y": "B",
        "z": "C",
        "a": "D",
        "b": "A",
    })

    with pytest.raises(
        Exception,
        match="Answers must contain exactly one answer for every question",
    ):
        contract._validate_answers(bad_answers, 5)


def test_invalid_answer_letter_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    bad_answers = json.dumps({
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
        "4": "X",
    })

    with pytest.raises(Exception, match="Answer 5 must be A, B, C or D"):
        contract._validate_answers(bad_answers, 5)


def test_missing_answer_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    bad_answers = json.dumps({
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
    })

    with pytest.raises(
        Exception,
        match="Answers must contain exactly one answer for every question",
    ):
        contract._validate_answers(bad_answers, 5)


def test_extra_answer_reverts(direct_deploy):
    contract = deploy_genhunt(direct_deploy)

    bad_answers = json.dumps({
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
        "4": "C",
        "5": "A",
    })

    with pytest.raises(
        Exception,
        match="Answers must contain exactly one answer for every question",
    ):
        contract._validate_answers(bad_answers, 5)
