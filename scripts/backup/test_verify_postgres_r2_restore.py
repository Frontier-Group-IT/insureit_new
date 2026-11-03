import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import Mock
import sys

sys.path.insert(0, str(Path(__file__).parent))
import verify_postgres_r2_restore as verify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from postgres_to_r2 import MAGIC


class R2DatabaseRestoreTests(unittest.TestCase):
    def test_latest_pointer_and_authenticated_manifest(self):
        key = bytes(range(32))
        manifest = {
            "project_ref": verify.PROJECT_REF, "version": 1,
            "created_at": "20261103T061621Z",
            "archive_key": "postgresql/v1/archives/archive.tar.gz.aes",
            "sha256": "a" * 64, "plaintext_bytes": 100,
            "contents": list(verify.EXPECTED)
        }
        pointer = {"manifest_key": "postgresql/v1/manifests/test.json.aes",
                   "created_at": manifest["created_at"]}
        nonce = bytes(range(12))
        encrypted = MAGIC + nonce + AESGCM(key).encrypt(
            nonce, json.dumps(manifest).encode(), b"postgres-manifest"
        )
        s3 = Mock()
        def get_object(*, Bucket, Key):
            data = json.dumps(pointer).encode() if Key.endswith("latest.json") else encrypted
            return {"Body": io.BytesIO(data)}
        s3.get_object.side_effect = get_object
        self.assertEqual(verify.read_manifest(s3, "bucket", key)["created_at"],
                         manifest["created_at"])
        pointer["created_at"] = "wrong"
        with self.assertRaises(RuntimeError):
            verify.read_manifest(s3, "bucket", key)

    def test_extracts_only_expected_sql_files(self):
        with tempfile.TemporaryDirectory() as folder:
            archive_file = Path(folder) / "data.tar.gz"
            with tarfile.open(archive_file, "w:gz") as arc:
                for name in verify.EXPECTED:
                    body = b"-- harmless fixture"
                    info = tarfile.TarInfo(name)
                    info.size = len(body)
                    arc.addfile(info, io.BytesIO(body))
            dest = Path(folder) / "restore"
            dest.mkdir()
            self.assertGreater(verify.extract_safe(archive_file, dest), 0)
            self.assertEqual({p.name for p in dest.iterdir()}, set(verify.EXPECTED))

    def test_rejects_traversal_tar_member(self):
        with tempfile.TemporaryDirectory() as folder:
            archive_file = Path(folder) / "bad.tar.gz"
            with tarfile.open(archive_file, "w:gz") as arc:
                for name in ("roles.sql", "schema.sql", "../data.sql"):
                    info = tarfile.TarInfo(name)
                    info.size = 1
                    arc.addfile(info, io.BytesIO(b"x"))
            with self.assertRaises(RuntimeError):
                verify.extract_safe(archive_file, folder)

    def test_rejects_wrong_archive_origin(self):
        key = bytes(range(32))
        manifest = {
            "project_ref": "other-project", "version": 1,
            "created_at": "20261103T061621Z",
            "archive_key": "postgresql/v1/archives/test.tar.gz.aes",
            "sha256": "a"*64, "plaintext_bytes": 1,
            "contents": list(verify.EXPECTED)
        }
        pointer = {"manifest_key": "postgresql/v1/manifests/test.json.aes",
                   "created_at": manifest["created_at"]}
        nonce = bytes(range(12))
        enc = MAGIC + nonce + AESGCM(key).encrypt(nonce, json.dumps(manifest).encode(), b"postgres-manifest")
        s3 = Mock()
        s3.get_object.side_effect = lambda **kw: {
            "Body": io.BytesIO(json.dumps(pointer).encode() if kw["Key"].endswith("latest.json") else enc)
        }
        with self.assertRaises(RuntimeError):
            verify.read_manifest(s3, "backup-bucket", key)


if __name__ == "__main__":
    unittest.main()
