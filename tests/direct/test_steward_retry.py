import json


def player(contract, address):
    return json.loads(
        contract.get_player(str(address))
    )


def quiz(contract, address, level):
    return json.loads(
        contract.get_quiz_status(
            str(address),
            str(level),
        )
    )


def current_player(contract):
    caller = contract._addr()
    return caller, contract._get_player(caller)


def seed_failed_quiz(contract, level="1"):
    caller, p = current_player(contract)

    q_ids = [
        f"retry_test_{level}_{i}"
        for i in range(5)
    ]

    for i, qid in enumerate(q_ids):
        contract.questions[qid] = json.dumps({
            "id": qid,
            "question": f"Question {i} about security?",
            "options": {
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D",
            },
            "correct": "A",
            "explanation": (
                "A is the correct answer for this test."
            ),
            "level": level,
        })

    p[f"quiz_{level}"] = {
        "status": "COMPLETED",
        "q_ids": q_ids,
        "answers": {
            "0": "B",
            "1": "B",
            "2": "B",
            "3": "B",
            "4": "B",
        },
        "score": 0,
        "results": [{"dummy": True}],
        "xp_earned": 0,
        "passed": False,
        "completed_at": "2026-08-17T00:00:00Z",
    }

    contract._save_player(caller, p)

    return q_ids


def seed_active_quiz(contract, level="1"):
    caller, p = current_player(contract)

    q_ids = [
        f"active_{level}_{i}"
        for i in range(5)
    ]

    p[f"quiz_{level}"] = {
        "status": "IN_PROGRESS",
        "q_ids": q_ids,
        "answers": {},
        "score": None,
        "results": [],
        "xp_earned": 0,
        "passed": False,
    }

    contract._save_player(caller, p)

    return q_ids


def test_failed_retry_keeps_same_question_ids(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    original_ids = seed_failed_quiz(contract)

    contract.retry_quiz("1")

    caller = contract._addr()
    status = json.loads(
        contract.get_quiz_status(
            caller,
            "1",
        )
    )

    assert status["status"] == "IN_PROGRESS"
    assert status["q_ids"] == original_ids


def test_failed_retry_keeps_same_question_content(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    original_ids = seed_failed_quiz(contract)

    before = [
        contract.questions.get(qid)
        for qid in original_ids
    ]

    contract.retry_quiz("1")

    after = [
        contract.questions.get(qid)
        for qid in original_ids
    ]

    assert after == before


def test_failed_retry_clears_attempt_state_only(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    original_ids = seed_failed_quiz(contract)

    contract.retry_quiz("1")

    caller = contract._addr()
    status = json.loads(
        contract.get_quiz_status(
            caller,
            "1",
        )
    )

    assert status["status"] == "IN_PROGRESS"
    assert status["q_ids"] == original_ids
    assert status["answers"] == {}
    assert status["score"] is None
    assert status["results"] == []
    assert status["xp_earned"] == 0
    assert status["passed"] is False


def test_active_quiz_cannot_be_discarded(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    seed_active_quiz(contract)

    with direct_vm.expect_revert(
        "Active quiz must be completed before retry"
    ):
        contract.retry_quiz("1")


def test_retry_does_not_increment_question_counter(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    seed_failed_quiz(contract)

    before = int(contract.q_count)

    contract.retry_quiz("1")

    after = int(contract.q_count)

    assert after == before
