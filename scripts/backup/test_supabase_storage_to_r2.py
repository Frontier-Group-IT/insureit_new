import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "backup", Path(__file__).with_name("supabase_storage_to_r2.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupCryptographyTests(unittest.TestCase):
    def test_roundtrip_binary(self):
        key = bytes(range(32))
        plain = b"%PDF-1.7\n\x00\xfftest"
        identity = '["policy-documents","test.pdf"]'
        encrypted = module.encrypt(plain, key, identity)
        self.assertNotEqual(encrypted, plain)
        self.assertEqual(module.decrypt(encrypted, key, identity), plain)

    def test_wrong_identity_rejected(self):
        blob = module.encrypt(b"record", bytes(32), '["a","one.pdf"]')
        with self.assertRaises(Exception):
            module.decrypt(blob, bytes(32), '["b","one.pdf"]')

    def test_corrupted_blob_rejected(self):
        blob = bytearray(module.encrypt(b"record", bytes(32), "manifest"))
        blob[-1] ^= 1
        with self.assertRaises(Exception):
            module.decrypt(bytes(blob), bytes(32), "manifest")

    def test_missing_env_fails_closed(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(RuntimeError):
                module.required("BACKUP_ENCRYPTION_KEY")


if __name__ == "__main__":
    unittest.main()
