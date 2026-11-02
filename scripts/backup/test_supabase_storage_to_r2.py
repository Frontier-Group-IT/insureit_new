import ast
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

    def test_checkpoint_key_is_deterministic_and_metadata_sensitive(self):
        identity = '["policy-documents","some.pdf"]'
        v1 = {"updated_at": "2026-10-31", "size": 123}
        v2 = {"updated_at": "2026-11-02", "size": 123}
        self.assertEqual(module.checkpoint_key(identity, v1),
                         module.checkpoint_key(identity, v1))
        self.assertNotEqual(module.checkpoint_key(identity, v1),
                            module.checkpoint_key(identity, v2))
        self.assertTrue(module.checkpoint_key(identity, v1).startswith(
            module.PREFIX + "/checkpoints/"))

    def test_resume_from_valid_encrypted_checkpoint_without_source_download(self):
        from unittest.mock import Mock, patch
        key = bytes(range(32))
        identity = module.json.dumps(["policy-documents", "some.pdf"],
                                     ensure_ascii=False, separators=(",", ":"))
        metadata = {"updated_at": "2026-10-31", "size": 5}
        entry = {"blob": "supabase-storage/v1/blobs/test.aes",
                 "sha256": "example", "bytes": 5, "source": metadata}
        document = {"identifier": identity, "source": metadata, "entry": entry}
        cipher = module.encrypt(module.json.dumps(document).encode(), key,
                                "checkpoint:" + identity)
        s3 = Mock()
        s3.get_object.return_value = {"Body": Mock(read=Mock(return_value=cipher))}
        with patch.object(module, "api", side_effect=AssertionError("source downloaded")):
            result = module.copy_one(
                ("policy-documents", "some.pdf",
                 {"updated_at": "2026-10-31", "metadata": {"size": 5}}),
                s3, "r2", "https://example.supabase.co", "redacted", key, {}, {},
                "20261102T000000Z")
        self.assertEqual(result[2], "checkpoint")
        s3.head_object.assert_called_once_with(Bucket="r2", Key=entry["blob"])

    def test_main_has_no_undefined_timestamp_references(self):
        source = Path(module.__file__).read_text()
        tree = ast.parse(source)
        main = next(node for node in tree.body
                    if isinstance(node, ast.FunctionDef) and node.name == "main")
        names = {node.id for node in ast.walk(main)
                 if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load)}
        self.assertNotIn("today", names,
                         "The backup must publish the latest pointer using snapshot")
        self.assertIn('"created_at": snapshot', source)

    def test_missing_env_fails_closed(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(RuntimeError):
                module.required("BACKUP_ENCRYPTION_KEY")


if __name__ == "__main__":
    unittest.main()
