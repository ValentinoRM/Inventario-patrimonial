#!/usr/bin/env bash
# Arranca o detiene el servidor de desarrollo de la aplicación.
#   ./scripts/iniciar.sh        -> arranca en $APP_HOST:$APP_PORT
#   ./scripts/iniciar.sh stop   -> detiene el servidor
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHP_BIN="${PHP_BIN:-/opt/lampp/bin/php}"
PID_FILE="/tmp/inventario-patrimonial-php.pid"
LOG_FILE="/tmp/inventario-patrimonial-php.log"

if [[ -f "$RAIZ/.env" ]]; then
  APP_HOST="$(grep -E '^APP_HOST=' "$RAIZ/.env" | cut -d= -f2- | tr -d '[:space:]')"
  APP_PORT="$(grep -E '^APP_PORT=' "$RAIZ/.env" | cut -d= -f2- | tr -d '[:space:]')"
fi
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-8000}"

detener() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")"
    echo "Servidor detenido."
  fi
  # Cierra también procesos huérfanos de este proyecto.
  pkill -f "$PHP_BIN -S ${APP_HOST}:${APP_PORT} -t $RAIZ" 2>/dev/null || true
  rm -f "$PID_FILE"
}

if [[ "${1:-}" == "stop" ]]; then
  detener
  exit 0
fi

detener 2>/dev/null || true
setsid "$PHP_BIN" -S "${APP_HOST}:${APP_PORT}" -t "$RAIZ" "$RAIZ/scripts/router-dev.php" > "$LOG_FILE" 2>&1 < /dev/null &
echo $! > "$PID_FILE"
sleep 1

if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Servidor corriendo en http://${APP_HOST}:${APP_PORT}"
  echo "  Log     : $LOG_FILE"
  echo "  Cuentas : scripts/crear-admin.php"
else
  echo "No se pudo iniciar el servidor. Revisa $LOG_FILE"
  exit 1
fi
