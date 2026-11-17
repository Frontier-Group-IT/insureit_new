"""Synthetic-only R5 target baseline assertions. Never connects to Supabase."""
import unittest
from check_restored_target_storage_preflight import verify_r5_target


def fake_target(**changes):
    state = {
        "tables": {("public", f"app_{i}") for i in range(183)},
        "auth_users": 87, "identities": 91,
        "buckets": 0, "objects": 0,
        "exposed_public_definers": 0,
        "managed_policies": {"storage": 0},
        "managed_triggers": {"auth": 0},
    }
    state.update(changes)
    return state


class R5TargetPreflightTests(unittest.TestCase):
    def test_restored_target_accepted(self):
        self.assertEqual(verify_r5_target(fake_target()), 183)

    def test_empty_or_dirty_or_privilege_risky_target_rejected(self):
        variants = [
            {"tables": set()}, {"auth_users": 0}, {"identities": 0},
            {"buckets": 1}, {"objects": 1}, {"exposed_public_definers": 1},
            {"managed_policies": {"storage": 35}},
            {"managed_triggers": {"auth": 1}},
        ]
        for changes in variants:
            with self.subTest(changes=tuple(changes)):
                with self.assertRaises(RuntimeError):
                    verify_r5_target(fake_target(**changes))


if __name__ == "__main__":
    unittest.main()
