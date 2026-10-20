#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and checks the behaviour
# they are supposed to produce. Touches no Supabase project and no real data.
#
#   brew install postgresql@17     # or any Postgres 15+ on PATH
#   ./scripts/verify-migrations.sh
#
# The migrations reference Supabase-managed objects (auth.users, auth.uid(),
# storage.objects, the supabase_realtime publication). supabase/tests/scaffold.sql
# provides minimal stand-ins so the real migration files run unmodified.

set -euo pipefail
cd "$(dirname "$0")/.."

export LC_ALL=C   # Homebrew Postgres refuses to start on macOS without this.
for candidate in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
  [ -d "$candidate" ] && PATH="$candidate:$PATH"
done
command -v initdb >/dev/null || { echo "Postgres not found. Try: brew install postgresql@17"; exit 1; }

PORT="${PGPORT:-55432}"
DATA_DIR="$(mktemp -d)/pgdata"
# The socket lives under /tmp because a Unix socket path is capped at 103 bytes.
SOCKET_DIR="$(mktemp -d /tmp/kalinga-pg.XXXXXX)"
cleanup() {
  pg_ctl -D "$DATA_DIR" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR"
}
trap cleanup EXIT

initdb -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA_DIR" -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=" -l "$DATA_DIR/pg.log" start >/dev/null
psql() { command psql -h "$SOCKET_DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }

psql -q -c "create database kalinga;"
run() { psql -q -d kalinga "$@"; }

run -f supabase/tests/scaffold.sql >/dev/null 2>&1
echo "scaffold ready"

# Pre-existing migrations, then the history they left behind, then the rest. The
# split lets the notification backfill run against realistic prior data.
for file in supabase/migrations/*.sql; do
  [[ "$(basename "$file")" < 202609070001 ]] || continue
  run -f "$file" >/dev/null 2>&1
  echo "applied  $(basename "$file")"
done
run -f supabase/tests/seed-legacy-history.sql >/dev/null
for file in supabase/migrations/20260907*.sql; do
  run -f "$file" >/dev/null 2>&1
  echo "applied  $(basename "$file")"
done

echo
results="$(psql -d kalinga -tA -f supabase/tests/checks.sql)"
echo "$results"
echo
if echo "$results" | grep -q '^FAIL'; then
  echo "$(echo "$results" | grep -c '^FAIL') check(s) failed"
  exit 1
fi
echo "$(echo "$results" | grep -c '^ok') checks passed"

for file in supabase/migrations/*.sql; do
  [[ "$(basename "$file")" > 202609079999 ]] || continue
  run -f "$file"
  echo "applied  $(basename "$file")"
done
for file in supabase/tests/guest-access.sql supabase/tests/guest-usage.sql; do
  [ -f "$file" ] || continue
  run -f "$file"
done
if [ -f supabase/migrations/202610200002_guest_usage_limits.sql ]; then
  race_guest_a="set role authenticated; select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000001',false);"
  race_guest_b="set role authenticated; select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000003',false);"
  run -c "$race_guest_a select public.claim_guest_gabay_request();" > "$DATA_DIR/race-a.log" 2>&1 &
  race_pid_a=$!
  run -c "$race_guest_b select public.claim_guest_gabay_request();" > "$DATA_DIR/race-b.log" 2>&1 &
  race_pid_b=$!
  wait "$race_pid_a"
  wait "$race_pid_b"
  run -c "do \$\$ begin if (select used from public.guest_ai_days where usage_date=(now() at time zone 'UTC')::date)<>200 then raise exception 'FAIL concurrent global AI cap'; end if; end \$\$;"
  echo "ok concurrent AI calls cannot overshoot the shared cap"
  for race_kind in question upload; do
    run -c "$race_guest_b select public.test_guest_race('$race_kind');" > "$DATA_DIR/race-a.log" 2>&1 &
    race_pid_a=$!
    run -c "$race_guest_b select public.test_guest_race('$race_kind');" > "$DATA_DIR/race-b.log" 2>&1 &
    race_pid_b=$!
    wait "$race_pid_a"
    wait "$race_pid_b"
  done
  run -c "do \$\$ begin
    if (select count(*) from public.teacher_discussions where title='Race question')<>1 then raise exception 'FAIL concurrent questions'; end if;
    if (select count(*) from storage.objects where name like '%/race-%')<>1 then raise exception 'FAIL concurrent uploads'; end if;
  end \$\$;"
  echo "ok concurrent questions and uploads cannot overshoot their caps"
fi
