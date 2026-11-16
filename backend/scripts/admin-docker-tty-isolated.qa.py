#!/usr/bin/env python3
"""P6: isolated Docker TTY bootstrap QA, never targets the running Compose stack.

Requires an explicitly built local image: ogtb-p6-backend-check:temporary.
Creates a new Docker network and --rm --tmpfs PostgreSQL container with NO
host-published ports or persistent volumes; removes everything in finally.
Dev runtime uses node:24-alpine with a read-only checkout mount.
Test-only secrets are generated in memory and never printed.
"""
import os
import pty
import select
import secrets
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACKEND = REPO / "backend"
NETWORK = "ogtb-p6-tty-only-net"
PG = "ogtb-p6-tty-only-postgres"
PROD_IMAGE = "ogtb-p6-backend-check:temporary"
DEV_IMAGE = "node:24-alpine"

def run(args, *, env=None, check=True, timeout=50):
    proc = subprocess.run(args, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, env=env, timeout=timeout)
    if check and proc.returncode:
        raise AssertionError("Command failed: " + " ".join(args[:4]) +
                             "\n" + proc.stdout[-900:])
    return proc

def exists(kind, name):
    return run(["docker", kind, "inspect", name], check=False, timeout=10).returncode == 0

def wait_for(master, token, process, *, timeout=25):
    output = b""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], 0.2)
        if ready:
            try:
                output += os.read(master, 8192)
            except OSError:
                pass
            if token in output:
                return output
        if process.poll() is not None and not ready:
            break
    raise AssertionError("Bootstrap TTY output did not contain expected prompt or result: " +
                         token.decode() + " (no secrets printed)")

def cli_args(mode):
    if mode == "production":
        return ["docker", "run", "--rm", "-it", "--network", NETWORK,
                "-e", "DATABASE_URL", PROD_IMAGE, "npm", "run", "admin:bootstrap"]
    return ["docker", "run", "--rm", "-it", "--network", NETWORK,
            "-e", "DATABASE_URL",
            "--mount", "type=bind,source=" + str(BACKEND) + ",target=/app,readonly",
            "--workdir", "/app", DEV_IMAGE, "npm", "run", "admin:bootstrap"]

def exec_tty(cmd, env, secret, expect_created):
    master, slave = pty.openpty()
    proc = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave,
                            env=env, start_new_session=True)
    os.close(slave)
    captured = b""
    try:
        if expect_created:
            for prompt, value in [
                (b"Name: ", "P6 Docker Operator"),
                (b"Email: ", "p6-operator@isolated.example.test"),
                (b"Password (hidden): ", secret),
                (b"Confirm password (hidden): ", secret),
            ]:
                segment = wait_for(master, prompt, proc)
                captured += segment
                # After a prompt is seen, consume only newly received text,
                # so old prompt strings cannot satisfy subsequent waits.
                os.write(master, (value + "\r").encode())
            deadline = time.monotonic() + 30
            while proc.poll() is None and time.monotonic() < deadline:
                ready, _, _ = select.select([master], [], [], 0.25)
                if ready:
                    try:captured += os.read(master, 8192)
                    except OSError:pass
        else:
            deadline = time.monotonic() + 25
            while proc.poll() is None and time.monotonic() < deadline:
                ready, _, _ = select.select([master], [], [], 0.2)
                if ready:
                    try:captured += os.read(master, 8192)
                    except OSError:pass
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)
            raise AssertionError("Docker bootstrap TTY timed out")
        captured_text = captured.decode("utf-8", "replace").replace(secret, "[redacted]")
        expected = "FIRST_ADMIN_CREATED" if expect_created else "ADMIN_BOOTSTRAP_ALREADY_COMPLETED"
        assert expected in captured_text, "Expected " + expected + "; got " + captured_text[-800:]
        assert proc.returncode == (0 if expect_created else 1), ("CLI status", proc.returncode)
        assert secret.encode() not in captured, "Secret was echoed to terminal"
        return {"mode": "tty", "result": expected, "exit": proc.returncode, "secretEchoed": False}
    finally:
        os.close(master)

def main():
    if os.environ.get("OGTB_P6_DOCKER_QA") != "yes":
        raise AssertionError("Explicit OGTB_P6_DOCKER_QA=yes required")
    if not BACKEND.is_dir():
        raise AssertionError("Backend checkout not found")
    if exists("network", NETWORK) or exists("container", PG):
        raise AssertionError("Isolated QA names already exist; refusing to reuse resources")
    assert run(["docker", "image", "inspect", PROD_IMAGE], check=False).returncode == 0
    test_passed = []
    password = secrets.token_urlsafe(28)
    dbpass = secrets.token_urlsafe(24)
    env = dict(os.environ, POSTGRES_USER="ogtb_p6", POSTGRES_PASSWORD=dbpass,
               POSTGRES_DB="ogtb_p6_prod")
    created_net = False
    created_pg = False
    try:
        run(["docker", "network", "create", "--driver", "bridge", NETWORK])
        created_net = True
        run(["docker", "run", "--rm", "-d", "--name", PG, "--network", NETWORK,
             "--network-alias", "p6-postgres",
             "--label", "ogtb.purpose=p6-disposable-tty-admin-qa",
             "--tmpfs", "/var/lib/postgresql/data:rw,size=256m",
             "-e", "POSTGRES_USER", "-e", "POSTGRES_PASSWORD",
             "-e", "POSTGRES_DB", "postgres:17-alpine"], env=env)
        created_pg = True
        inspect = run(["docker", "inspect", PG, "--format",
                       "{{.HostConfig.AutoRemove}}|{{json .Mounts}}|{{json .NetworkSettings.Ports}}|{{json .HostConfig.Tmpfs}}"]).stdout
        assert "true|[]|" in inspect and '5432/tcp":null' in inspect, inspect
        assert "/var/lib/postgresql/data" in inspect
        for _ in range(40):
            result = run(["docker", "exec", PG, "pg_isready", "-U", "ogtb_p6",
                          "-d", "ogtb_p6_prod"], check=False, timeout=8)
            if result.returncode == 0:break
            time.sleep(.4)
        else:raise AssertionError("Isolated PostgreSQL did not start")
        run(["docker", "exec", PG, "psql", "-v", "ON_ERROR_STOP=1",
             "-U", "ogtb_p6", "-d", "ogtb_p6_prod", "-c",
             "CREATE DATABASE ogtb_p6_dev;"])

        for mode in ("production", "development"):
            db = "ogtb_p6_prod" if mode == "production" else "ogtb_p6_dev"
            local_env = dict(env, DATABASE_URL="postgresql://ogtb_p6:" + dbpass +
                             "@p6-postgres:5432/" + db + "?schema=public")
            run(["docker", "run", "--rm", "--network", NETWORK, "-e",
                 "DATABASE_URL", PROD_IMAGE, "npm", "run", "db:deploy"], env=local_env)
            test_passed.append(mode + " migration completed in disposable DB")
            created = exec_tty(cli_args(mode), local_env, password, True)
            test_passed.append(mode + " first ADMIN created from interactive Docker TTY")
            rejected = exec_tty(cli_args(mode), local_env, password, False)
            test_passed.append(mode + " second initial ADMIN blocked")
            assert created["secretEchoed"] is False and rejected["exit"] == 1
            query = ('SELECT (SELECT COUNT(*) FROM "User" WHERE role=\'ADMIN\')::text ||\',\' || '
                     '(SELECT COUNT(*) FROM "AdminBootstrapState")::text ||\',\' || '
                     '(SELECT COUNT(*) FROM "AdminAuditLog" WHERE action=\'INITIAL_ADMIN_BOOTSTRAP\')::text;')
            count = run(["docker", "exec", PG, "psql", "-At", "-U", "ogtb_p6",
                         "-d", db, "-c", query]).stdout.strip()
            assert count == "1,1,1", ("unexpected disposable DB state", mode, count)
            test_passed.append(mode + " DB counts ADMIN=1 marker=1 audit=1")

        print("P6 Docker TTY QA PASSED", len(test_passed), "/", len(test_passed))
        for item in test_passed:print("PASS",item)
    finally:
        if created_pg:
            run(["docker", "stop", PG], check=False, timeout=35)
        if created_net:
            run(["docker", "network", "rm", NETWORK], check=False, timeout=15)

if __name__ == "__main__":
    main()
