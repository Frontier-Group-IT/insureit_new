#!/usr/bin/env python3
"""R0/R1 ONLY: compare an authenticated v2 archive TOC to isolated managed catalogs.

Never imports rows, applies DDL, changes privileges, or reads customer data.
Logs only aggregate metadata, never SQL, role names, paths or credentials.
"""
from collections import Counter
from contextlib import contextmanager
import os
from pathlib import Path
import re
import ssl
import sys
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit

SOURCE_REF = "ilzhsfqqjyppzzvfscmh"
TARGET_REF = "klnodxnmlqbofolxxrsr"
TARGET_DIRECT = f"db.{TARGET_REF}.supabase.co"
POOLER_DOMAIN = ".pooler.supabase.com"
# Match longer PostgreSQL TOC object kinds first. Object names never leave
# this process; only family-count aggregates are printed.
TOC_KINDS = (
    "TABLE DATA", "TABLE", "VIEW", "MATERIALIZED VIEW", "INDEX",
    "CONSTRAINT", "FK CONSTRAINT", "SEQUENCE", "SEQUENCE SET",
    "FUNCTION", "PROCEDURE", "TRIGGER", "POLICY", "ROW SECURITY",
    "ACL", "DEFAULT ACL", "EXTENSION", "SCHEMA", "TYPE", "DOMAIN",
    "EVENT TRIGGER", "TABLE ATTACH", "RULE", "PUBLICATION",
)
RECORD = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+("
    + "|".join(re.escape(kind) for kind in
               sorted(TOC_KINDS, key=len, reverse=True))
    + r")\s+(\S+)\s+(\S+)(?:\s|$)"
)
MANAGED = frozenset(("auth", "storage", "realtime", "vault",
                     "supabase_migrations"))
MAX_TOC = 32 * 1024 * 1024


def checked_target_connection(url):
    """Returns libpq keyword args; URL may contain unescaped @ in password.

    A recognized pooler DNS suffix alone is NOT sufficient: username MUST
    include the isolated project ref, and the direct hostname must be exact.
    """
    if not isinstance(url, str) or not url or any(c in url for c in "\r\n\x00"):
        raise ValueError("Malformed target connection")
    parsed = urlsplit(url)
    if parsed.scheme not in ("postgres", "postgresql") or parsed.fragment:
        raise ValueError("Malformed target connection")
    host = parsed.hostname
    user = unquote(parsed.username or "", errors="strict")
    password = unquote(parsed.password or "", errors="strict")
    direct = host == TARGET_DIRECT and user == "postgres"
    pooler = (isinstance(host, str) and host.endswith(POOLER_DOMAIN)
              and host != POOLER_DOMAIN
              and user == f"postgres.{TARGET_REF}")
    if not (direct or pooler) or not password or parsed.path != "/postgres":
        raise ValueError("Unapproved destination")
    if SOURCE_REF in url or any(c in user + password for c in "\r\n\x00"):
        raise ValueError("Forbidden project reference or credentials")
    if parsed.port not in (None, 5432):
        raise ValueError("Session/direct port 5432 required")
    options = parse_qsl(parsed.query, strict_parsing=True,
                        keep_blank_values=True)
    if any(k != "sslmode" for k, _ in options) or len(options) > 1:
        raise ValueError("Unapproved connection options")
    if options and options[0][1] not in ("require", "verify-ca", "verify-full"):
        raise ValueError("TLS required")
    return dict(host=host, port=5432, dbname="postgres", user=user,
                password=password)


def toc_inventory(path):
    p = Path(path)
    if not p.is_file() or not 0 < p.stat().st_size <= MAX_TOC:
        raise ValueError("Missing or oversized private TOC")
    counts = Counter()
    archive_definitions = set()
    archive_data = set()
    for line in p.read_text(encoding="utf-8", errors="strict").splitlines():
        match = RECORD.match(line)
        if match is None:
            continue
        kind, schema, obj = match.groups()
        family = ("managed" if schema in MANAGED else
                  "application" if schema == "public" else "dependency")
        counts[(kind, family)] += 1
        if kind == "TABLE":
            archive_definitions.add((schema, obj))
        if kind == "TABLE DATA":
            archive_data.add((schema, obj))
    required = {("auth", "users"), ("storage", "buckets"),
                ("storage", "objects"),
                ("supabase_migrations", "schema_migrations")}
    if not required.issubset(archive_data):
        raise ValueError("Critical archived metadata missing")
    if not any(schema == "public" for schema, _ in archive_definitions):
        raise ValueError("Archived application schema missing")
    return counts, archive_definitions, archive_data


def classify_connection_error(error):
    """Return only a fixed category: NEVER log libpq's raw error message.

    libpq errors can echo hosts, tenant identifiers, or credential fragments.
    Preserve fail-closed TLS verification and report a coarse remediation type.
    """
    message = str(error).lower()
    if any(marker in message for marker in (
        "hostname mismatch", "does not match the host", "hostname does not match",
        "certificate does not match", "name mismatch",
    )):
        return "TLS_HOSTNAME_MISMATCH"
    if any(marker in message for marker in (
        "certificate verify failed", "self-signed certificate",
        "unable to get local issuer", "unknown ca", "certificate chain",
        "certificate issuer", "certificate authority",
    )):
        return "TLS_CA_UNTRUSTED"
    if any(marker in message for marker in (
        "password authentication failed", "invalid password",
        "authentication failed for user",
    )):
        return "DATABASE_PASSWORD_REJECTED"
    if any(marker in message for marker in (
        "tenant or user not found", "tenant not found",
        "invalid tenant", "invalid project", "user not found",
    )):
        return "POOLER_TENANT_OR_USER"
    if any(marker in message for marker in (
        "unsupported startup parameter", "unsupported options",
        "invalid startup option", "unsupported configuration parameter",
    )):
        return "POOLER_STARTUP_OPTIONS"
    if any(marker in message for marker in (
        "could not translate host name", "name or service not known",
        "temporary failure in name resolution", "nodename nor servname provided",
    )):
        return "HOST_DNS_RESOLUTION"
    if any(marker in message for marker in (
        "connection timed out", "timeout expired", "operation timed out",
    )):
        return "NETWORK_TIMEOUT"
    if any(marker in message for marker in (
        "network is unreachable", "no route to host", "connection refused",
    )):
        return "NETWORK_UNREACHABLE"
    if any(marker in message for marker in (
        "server closed the connection unexpectedly", "connection reset",
        "connection unexpectedly closed", "server closed connection",
    )):
        return "SERVER_CLOSED_CONNECTION"
    if "ssl" in message or "tls" in message:
        return "TLS_OTHER"
    return "CONNECTION_OTHER"


@contextmanager
def isolated_ssl_root_cert():
    """Temporarily trust ONLY the CA pasted from isolated Supabase settings.

    PEM is supplied exclusively by protected GitHub environment secret.
    Never fall back to SSL 'require', disabled verification or production CA.
    """
    pem = os.environ.get("RECOVERY_DB_SSL_ROOT_CERT_PEM", "")
    if not pem:
        raise RuntimeError("Isolated Supabase CA certificate secret is missing")
    if (len(pem) > 65536 or
        "-----BEGIN CERTIFICATE-----" not in pem or
        "-----END CERTIFICATE-----" not in pem or
        "PRIVATE KEY" in pem or
        "\\n" in pem):
        raise ValueError("Invalid isolated Supabase CA certificate format")
    try:
        # Validate PEM via OpenSSL, without logging certificate contents.
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.load_verify_locations(cadata=pem)
    except (ssl.SSLError, ValueError):
        raise ValueError("Invalid isolated Supabase CA certificate") from None
    with tempfile.TemporaryDirectory(prefix="insureit-recovery-ca-") as folder:
        cert_path = Path(folder) / "isolated-supabase-root-ca.crt"
        try:
            cert_path.write_text(pem, encoding="ascii")
        except UnicodeError:
            raise ValueError("Invalid non-ASCII CA certificate") from None
        cert_path.chmod(0o600)
        yield str(cert_path)


def query_target(connection_kwargs):
    # Imported only on a protected manual run. No database access in PR CI.
    import psycopg
    # Full CA chain and hostname verification is mandatory. The GitHub
    # runner's generic system roots do not trust this Supabase target CA.
    # Never print libpq's original exception or connection parameters.
    with isolated_ssl_root_cert() as ca_bundle:
        try:
            connection = psycopg.connect(
                **connection_kwargs, sslmode="verify-full", sslrootcert=ca_bundle,
                connect_timeout=12, autocommit=True,
            )
        except psycopg.OperationalError as error:
            print("MANAGED PREFLIGHT TARGET CONNECT:"
                  f" failure_class={classify_connection_error(error)}"
                  " sensitive_details=withheld", file=sys.stderr)
            raise
    with connection as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            try:
                cur.execute(
                    "SELECT current_database(), current_setting('server_version_num'),"
                    " current_setting('transaction_read_only')"
                )
                db, version, read_only = cur.fetchone()
                if db != "postgres" or not version.startswith("17") or read_only != "on":
                    raise RuntimeError("Unexpected target connection state")
                cur.execute(
                    "SELECT n.nspname, c.relname FROM pg_catalog.pg_class c"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE c.relkind IN ('r','p') AND n.nspname NOT IN"
                    " ('pg_catalog','information_schema') AND"
                    " n.nspname NOT LIKE 'pg_toast%'"
                )
                table_set = {(s, n) for s, n in cur.fetchall()}
                cur.execute("SELECT extname,extversion FROM pg_catalog.pg_extension")
                extensions = dict(cur.fetchall())
                cur.execute(
                    "SELECT rolname FROM pg_catalog.pg_roles"
                    " WHERE rolname !~ '^pg_'"
                )
                roles = {row[0] for row in cur.fetchall()}
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_auth_members"
                )
                membership_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM auth.users")
                auth_users = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM auth.identities")
                identities = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM storage.buckets")
                buckets = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM storage.objects")
                objects = cur.fetchone()[0]
                # Read-only managed-schema policy and application-trigger counts.
                # Avoid any row data, policy expressions, function bodies or names.
                cur.execute(
                    "SELECT n.nspname,count(*) FROM pg_catalog.pg_policy pol"
                    " JOIN pg_catalog.pg_class c ON c.oid=pol.polrelid"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE n.nspname IN ('auth','storage','realtime','vault')"
                    " GROUP BY n.nspname"
                )
                managed_policies = dict(cur.fetchall())
                cur.execute(
                    "SELECT n.nspname,count(*) FROM pg_catalog.pg_trigger t"
                    " JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE n.nspname IN ('auth','storage','realtime','vault')"
                    " AND NOT t.tgisinternal AND t.tgenabled <> 'D'"
                    " GROUP BY n.nspname"
                )
                managed_triggers = dict(cur.fetchall())
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_proc WHERE prosecdef"
                )
                definers = cur.fetchone()[0]
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_proc p"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace"
                    " WHERE n.nspname='public' AND p.prosecdef AND"
                    " (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR"
                    " pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))"
                )
                exposed_definers = cur.fetchone()[0]
            finally:
                cur.execute("ROLLBACK")
    return dict(tables=table_set, extensions=extensions, roles=roles,
                memberships=membership_count, auth_users=auth_users,
                identities=identities, buckets=buckets, objects=objects,
                security_definers=definers,
                exposed_public_definers=exposed_definers,
                managed_policies=managed_policies, managed_triggers=managed_triggers)


def compare_archive(toc_path, target_url):
    counts, definitions, data = toc_inventory(toc_path)
    target = query_target(checked_target_connection(target_url))
    if any((target[k] != 0) for k in
           ("auth_users", "identities", "buckets", "objects")):
        raise RuntimeError("Isolated recovery project is no longer empty")
    public_tables = sum(s == "public" for s, _ in target["tables"])
    if public_tables:
        raise RuntimeError("Recovery target contains application tables")
    for kind in TOC_KINDS:
        if sum(counts[(kind, family)] for family in
               ("application", "managed", "dependency")) == 0:
            continue
        print("MANAGED PREFLIGHT TOC:"
              f" kind={kind.lower().replace(' ', '_')}"
              f" public={counts[(kind,'application')]}"
              f" managed={counts[(kind,'managed')]}"
              f" dependencies={counts[(kind,'dependency')]}")
    missing_existing = len(definitions & target["tables"])
    missing_data_targets = len(data - target["tables"])
    print("MANAGED PREFLIGHT CATALOG:"
          f" archive_table_definitions={len(definitions)}"
          f" archive_data_targets={len(data)}"
          f" already_seeded_table_definitions={missing_existing}"
          f" data_targets_not_preseeded={missing_data_targets}"
          f" target_roles={len(target['roles'])}"
          f" target_role_memberships={target['memberships']}"
          f" target_security_definers={target['security_definers']}"
          f" target_ext_installed={len(target['extensions'])}"
          f" public_executable_definers={target['exposed_public_definers']}"
          f" target_storage_rls_policies={target['managed_policies'].get('storage',0)}"
          f" target_auth_user_triggers={target['managed_triggers'].get('auth',0)}")
    print("MANAGED PREFLIGHT: status=REVIEW_ONLY"
          " no_import=1 no_privilege_change=1 no_production_connection=1")
    # A green read-only inspection is NOT permission to import.
    return target


def main(argv):
    if len(argv) == 2 and argv[1] == "--check-target":
        checked_target_connection(os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
        print("MANAGED PREFLIGHT TARGET ALLOWLIST PASSED")
        return
    if len(argv) == 2 and argv[1] == "--probe-target":
        target = query_target(
            checked_target_connection(os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
        )
        if any(target[k] for k in ("auth_users", "identities", "buckets", "objects")):
            raise RuntimeError("Target contains existing service data")
        if any(schema == "public" for schema, _ in target["tables"]):
            raise RuntimeError("Target contains application tables")
        print("MANAGED PREFLIGHT TARGET PROBE: connected=1 tls_verify_full=1"
              " transaction_read_only=1 empty_target=1")
        return
    if len(argv) == 3 and argv[1] == "--compare":
        compare_archive(argv[2], os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
        return
    raise ValueError("Usage: managed_recovery_preflight.py --check-target | --probe-target | --compare PRIVATE_TOC")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except Exception as error:
        print("MANAGED PREFLIGHT FAILED:"
              f" category={type(error).__name__};"
              " sensitive details withheld", file=sys.stderr)
        raise SystemExit(1)
