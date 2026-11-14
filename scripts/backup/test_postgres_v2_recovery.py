"""Secret-free v2 snapshot, R2 envelope, extraction and full row-parity tests."""
import base64
import io
import json
import tempfile
from pathlib import Path
from unittest import TestCase, mock

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from postgres_to_r2 import MAGIC
from postgres_v2_to_r2 import (
    AAD, EXPECTED, FORMAT, PREFIX, PROJECT_REF,
    make_v2_archive, commit_v2,
)
from verify_postgres_v2_r2 import get_v2_manifest, extract_v2, require_expected_snapshot, require_snapshot_stamp
from verify_postgres_v2_rows import archive_counts, quote, verify


class FakeR2:
    def __init__(self):
        self.objects = {}

    def upload_fileobj(self, source, bucket, key, ExtraArgs=None):
        self.objects[key] = source.read()

    def download_file(self, bucket, key, path):
        Path(path).write_bytes(self.objects[key])

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.objects[Key] = Body

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[Key])}


class V2BackupTests(TestCase):
    def test_archive_roundtrip_and_non_v1_prefix(self):
        self.assertEqual(PREFIX, "postgresql/v2")
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "roles.sql").write_text("-- synthetic roles\n")
            (root / "database.dump").write_bytes(b"PGDMPsynthetic")
            tar = root / "source.tar.gz"
            make_v2_archive(root, tar)
            target = root / "staged"
            target.mkdir()
            extract_v2(tar, target)
            for name in EXPECTED:
                self.assertEqual((root / name).read_bytes(), (target / name).read_bytes())

    def test_r2_manifest_authenticated_with_independent_v2_aad(self):
        from postgres_to_r2 import encrypt_file
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            raw = path / "source"
            raw.write_bytes(b"safe synthetic snapshot")
            key = bytes(range(32))
            encrypted = path / "encrypted"
            checksum = encrypt_file(raw, encrypted, key)
            r2 = FakeR2()
            commit_v2(r2, "private", encrypted, checksum, "20261108T000000Z", key)
            self.assertTrue(any(k.startswith("postgresql/v2/archives/") for k in r2.objects))
            self.assertFalse(any(k.startswith("postgresql/v1/") for k in r2.objects))
            manifest = get_v2_manifest(r2, "private", key)
            self.assertEqual(manifest["format"], FORMAT)
            self.assertEqual(manifest["project_ref"], PROJECT_REF)
            self.assertEqual(manifest["contents"], list(EXPECTED))
            location = json.loads(r2.objects["postgresql/v2/latest.json"])["manifest_key"]
            raw_manifest = bytearray(r2.objects[location])
            raw_manifest[-1] ^= 1
            r2.objects[location] = bytes(raw_manifest)
            with self.assertRaises(Exception):
                get_v2_manifest(r2, "private", key)

    def test_snapshot_lock_and_timestamp_rejected_on_drift(self):
        snapshot = "20261114T033000Z"
        self.assertEqual(
            require_expected_snapshot({"created_at": snapshot}, snapshot),
            snapshot,
        )
        self.assertEqual(
            require_expected_snapshot({"created_at": snapshot}, ""),
            snapshot,
        )
        with self.assertRaises(ValueError):
            require_expected_snapshot(
                {"created_at": snapshot}, "20261113T033000Z",
            )
        for unsafe in ("20261114T033000Z\\n", "../20261114T033000Z", "", "latest"):
            with self.subTest(unsafe=unsafe):
                with self.assertRaises(ValueError):
                    require_snapshot_stamp(unsafe)

    def test_rejects_traversal_tar_member(self):
        import tarfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tar = root / "unsafe.tar.gz"
            with tarfile.open(tar, "w:gz") as stream:
                for name in ("roles.sql", "../database.dump"):
                    body = b"synthetic"
                    item = tarfile.TarInfo(name)
                    item.size = len(body)
                    stream.addfile(item, io.BytesIO(body))
            with self.assertRaises(ValueError):
                extract_v2(tar, root)


class V2AllTableParityTests(TestCase):
    SAMPLE = (
        "COPY auth.users (id, email) FROM stdin;\n"
        "1\ta@example.invalid\n"
        "\\.\n"
        "COPY storage.buckets (id) FROM stdin;\n"
        "insureit-test\n"
        "\\.\n"
        "COPY storage.objects (id, bucket_id) FROM stdin;\n"
        "\\.\n"
        "COPY supabase_migrations.schema_migrations (version) FROM stdin;\n"
        "20261108\n"
        "\\.\n"
        "COPY public.motor_policies (id) FROM stdin;\n"
        "one\n"
        "two\n"
        "\\.\n"
    )

    def sample_path(self, root, contents=None):
        source = Path(root) / "data.sql"
        source.write_text(self.SAMPLE if contents is None else contents)
        return source

    def test_all_destinations_reconciled_and_no_rows_logged(self):
        with tempfile.TemporaryDirectory() as root:
            source = self.sample_path(root)
            expected = archive_counts(source)
            self.assertEqual(expected[("public", "motor_policies")], 2)
            self.assertEqual(len(expected), 5)
            import contextlib
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                verify(source, lambda _: expected.copy())
            self.assertIn("archived_copy_tables=5", output.getvalue())
            self.assertNotIn("motor_policies", output.getvalue())
            self.assertNotIn("a@example.invalid", output.getvalue())

    def test_detects_dropped_rows_in_any_business_table(self):
        with tempfile.TemporaryDirectory() as root:
            path = self.sample_path(root)
            expected = archive_counts(path)
            altered = expected.copy()
            altered[("public", "motor_policies")] -= 1
            with self.assertRaises(ValueError):
                verify(path, lambda _: altered)

    def test_fails_closed_without_critical_managed_tables(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                archive_counts(self.sample_path(root, "COPY public.demo (id) FROM stdin;\n\\.\n"))

    def test_identifier_escaping(self):
        self.assertEqual(quote('needs"escaping'), '"needs""escaping"')
        with self.assertRaises(ValueError):
            quote("bad\x00identifier")

    def test_missing_copy_terminator_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                archive_counts(self.sample_path(root, self.SAMPLE[:-3]))
