#!/bin/sh
# Crea una base de datos separada para las pruebas automatizadas.
# Las pruebas de integración NUNCA se ejecutan contra la base de datos de desarrollo.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE ${POSTGRES_TEST_DB:-sky_beauty_test};
EOSQL
