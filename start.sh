#!/bin/bash
PORT=${PORT:-4173}
exec bun run preview --host --port $PORT
