import hashlib
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import Mock
import sys

sys.path.insert(0, str(Path(__file__).parent))
import postgres_to_r2 as pg


class DatabaseArchiveTests(unittest.TestCase):
    def test_encrypt_stream_roundtrip_and_corruption_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            src = Path(folder) / "source"
            enc = Path(folder) / "source.aes"
            src.write_bytes(os.urandom(64000) + b"database backup")
            key = bytes(range(32))
            reference = pg.encrypt_file(src, enc, key)
            self.assertEqual(reference["bytes"], src.stat().st_size)
            self.assertEqual(reference["sha256"], hashlib.sha256(src.read_bytes()).hexdigest())
            self.assertEqual(pg.verify_file(enc, key, reference), src.stat().st_size)
            tampered = bytearray(enc.read_bytes())
            tampered[50] ^= 1
            enc.write_bytes(tampered)
            with self.assertRaises(Exception):
                pg.verify_file(enc, key, reference)

    def test_empty_dump_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            for name in pg.EXPECTED:
                (Path(folder) / name).write_bytes(b"")
            with self.assertRaises(RuntimeError):
                pg.make_archive(folder, Path(folder) / "out.tar.gz")

    def test_archive_contains_three_expected_files_only(self):
        with tempfile.TemporaryDirectory() as folder:
            for name in pg.EXPECTED:
                (Path(folder) / name).write_text("-- fixture " + name)
            (Path(folder) / "secret.txt").write_text("not part of archive")
            output = Path(folder) / "out.tar.gz"
            pg.make_archive(folder, output)
            with tarfile.open(output, "r:gz") as archive:
                self.assertEqual(set(archive.getnames()), set(pg.EXPECTED))

    def test_r2_publish_requires_valid_readback(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "archive.tar.gz"
            ciphertext = Path(folder) / "archive.aes"
            source.write_bytes(os.urandom(5000))
            key = bytes(range(32))
            expected = pg.encrypt_file(source, ciphertext, key)
            s3 = Mock()
            s3.download_file.side_effect = lambda bucket, key, filename: Path(filename).write_bytes(
                b"invalid encrypted payload")
            with self.assertRaises(Exception):
                pg.commit_backup(s3, "backup-bucket", ciphertext, expected, "20261103T000000Z", key)
            s3.put_object.assert_not_called()


if __name__ == "__main__":
    unittest.main()
