"""Secret-free tests for bounded restore permissions diagnostics and fallback gate."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from classify_pg_restore_error import classify, toc_error_context, main as classify_main
from allow_no_acl_restore_fallback import allowed, main as allow_main


class RestorePermissionDiagnosticsTests(unittest.TestCase):
    DENIED = (
        'pg_restore: while PROCESSING TOC:\n'
        'pg_restore: from TOC entry 1511; 0 0 ACL TABLE auth PRIVATE_CUSTOMER_NAMED_TABLE postgres\n'
        'pg_restore: error: could not execute query: ERROR: permission denied for relation PRIVATE_CUSTOMER_NAMED_TABLE\n'
        'Command was: GRANT ALL ON TABLE auth.PRIVATE_CUSTOMER_NAMED_TABLE TO someprivate;\n'
    )

    def test_acl_permission_failure_can_attempt_degraded_mode(self):
        self.assertEqual(classify(self.DENIED), "permission_denied")
        self.assertTrue(allowed(self.DENIED))
        self.assertEqual(toc_error_context(self.DENIED), {
            "toc_entry": 1511, "kind": "acl", "schema": "auth",
        })

    def test_non_acl_permission_fallback_is_only_a_trial(self):
        # This test prevents interpreting 'permission_denied' as proof that
        # only ACLs fail. The second, strict no-ACL pg_restore MUST also pass.
        denial = 'pg_restore: error: could not execute query: ERROR: permission denied to create extension'
        self.assertTrue(allowed(denial))
        self.assertIsNone(toc_error_context(denial))

    def test_fail_closed_for_non_permission_errors(self):
        for problem in (
            'pg_restore: error: ERROR: extension secret is not available',
            'pg_restore: error: ERROR: relation private_customer_table already exists',
            'pg_restore: error: ERROR: invalid input syntax for type uuid',
            'pg_restore: error: ERROR: violates foreign key constraint',
        ):
            with self.subTest(msg=problem[:22]):
                self.assertFalse(allowed(problem))

    def test_toc_descriptor_does_not_expose_custom_table_names(self):
        raw = (
            'pg_restore: from TOC entry 41; 1259 30000 TABLE private_customer_tenant SECRET_PAYMENT_ACCOUNT postgres\n'
            'pg_restore: error: could not execute query: ERROR: permission denied for relation SECRET_PAYMENT_ACCOUNT'
        )
        info = toc_error_context(raw)
        self.assertEqual(info, {
            "toc_entry": 41, "kind": "table", "schema": "other_or_unqualified",
        })
        self.assertNotIn("SECRET_PAYMENT_ACCOUNT", str(info))
        self.assertNotIn("private_customer_tenant", str(info))

    def test_command_lines_not_printed_from_private_log(self):
        with tempfile.TemporaryDirectory() as temp:
            log = Path(temp) / "private.log"
            log.write_text(self.DENIED, encoding="utf-8")
            out = io.StringIO()
            with mock.patch("sys.argv", ["classifier", "data", str(log)]):
                with contextlib.redirect_stdout(out):
                    classify_main()
            value = out.getvalue()
            self.assertIn("category=permission_denied", value)
            self.assertIn("kind=acl", value)
            self.assertNotIn("PRIVATE_CUSTOMER_NAMED_TABLE", value)
            self.assertNotIn("someprivate", value)
            with mock.patch("sys.argv", ["fallback", str(log)]):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(allow_main(), 0)

    def test_fallback_rejects_unclassified_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            log = Path(temp) / "private.log"
            log.write_text('ERROR: foreign key constraint violated', encoding="utf-8")
            with mock.patch("sys.argv", ["fallback", str(log)]):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(allow_main(), 1)


if __name__ == "__main__":
    unittest.main()
