import json


def seed_rewarded_quiz(contract):
    caller = contract._addr()
    player = contract._get_player(caller)

    q_ids = [
        f"steward_retry_{i}"
        for i in range(5)
    ]

    for i, q_id in enumerate(q_ids):
        contract.questions[q_id] = json.dumps({
            "id": q_id,
            "question": f"Security question {i}?",
            "options": {
                "A": "Correct answer",
                "B": "Wrong answer B",
                "C": "Wrong answer C",
                "D": "Wrong answer D",
            },
            "correct": "A",
            "explanation": (
                "A is correct for this regression test."
            ),
            "level": "1",
        })

    player["quiz_1"] = {
        "status": "IN_PROGRESS",
        "q_ids": q_ids,
        "answers": {},
        "score": None,
        "results": [],
        "xp_earned": 0,
        "passed": False,
        "reward_eligible": True,
        "practice_retry": False,
    }

    contract._save_player(
        caller,
        player,
    )


def test_fail_read_retry_pass_awards_zero_xp(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = direct_deploy(
        "contracts/gen_hunt.py"
    )

    direct_vm.sender = direct_alice

    seed_rewarded_quiz(contract)

    caller = contract._addr()

    # 1. Fail the rewarded attempt.
    failing_answers = json.dumps({
        "0": "B",
        "1": "B",
        "2": "B",
        "3": "B",
        "4": "B",
    })

    contract.submit_quiz_answers(
        "1",
        failing_answers,
    )

    failed = json.loads(
        contract.get_quiz_status(
            caller,
            "1",
        )
    )

    assert failed["status"] == "COMPLETED"
    assert failed["passed"] is False

    # 2. Confirm the failed result reveals the key.
    assert len(failed["results"]) == 5

    for result in failed["results"]:
        assert result["correct"] == "A"
        assert result["explanation"]

    player_after_fail = json.loads(
        contract.get_player(caller)
    )

    xp_after_fail = player_after_fail["xp"]

    # 3. Retry after answer disclosure.
    contract.retry_quiz("1")

    retry_state = contract._get_player(
        caller
    )["quiz_1"]

    assert retry_state["status"] == "IN_PROGRESS"
    assert retry_state["reward_eligible"] is False
    assert retry_state["practice_retry"] is True

    # 4. Pass using the now-known answer key.
    perfect_answers = json.dumps({
        "0": "A",
        "1": "A",
        "2": "A",
        "3": "A",
        "4": "A",
    })

    contract.submit_quiz_answers(
        "1",
        perfect_answers,
    )

    final_player = json.loads(
        contract.get_player(caller)
    )

    final_status = json.loads(
        contract.get_quiz_status(
            caller,
            "1",
        )
    )

    # Progression is allowed.
    assert final_status["passed"] is True
    assert "1" in final_player["levels_completed"]
    assert final_player["level"] == 2

    # But the exposed retry earns absolutely nothing.
    assert final_status["xp_earned"] == 0
    assert final_player["xp"] == xp_after_fail
