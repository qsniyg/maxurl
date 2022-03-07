#!/bin/sh

cd "$(dirname "$(readlink -f "$0")")/.."

# tsc --watch segfaults after a few updates
while true; do
	npx tsc --watch
	sleep 1 # eases ^C
done
