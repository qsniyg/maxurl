#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")"

USERVERSION=`cat userscript.user.js | grep '@version *[0-9.]* *$' | sed 's/.*@version *\([0-9.]*\) *$/\1/g'`
MANIFESTVERSION=`cat manifest.json | grep '"version": *"[0-9.]*", *$' | sed 's/.*"version": *"\([0-9.]*\)", *$/\1/g'`

if [ -z "$USERVERSION" -o -z "$MANIFESTVERSION" ]; then
    echo Broken version regex
    exit 1
fi

if [ "$USERVERSION" != "$MANIFESTVERSION" ]; then
    echo Conflicting versions
    exit 1
fi

rm extension.xpi
zip -r extension.xpi manifest.json userscript.user.js extension -x "*~"

FILES=$(unzip -l extension.xpi | awk '{print $4}' | awk 'BEGIN{x=0;y=0} /^----$/{x=1} {if (x==1) {x=2} else if (x==2) {print}}' | sed '/^ *$/d' | sort)

echo "$FILES" > files.txt
cat <<EOF >> files.txt
extension/
extension/background.js
extension/options.css
extension/options.html
manifest.json
userscript.user.js
EOF

DIFF="$(cat files.txt | sort | uniq -u)"
rm files.txt

if [ ! -z "$DIFF" ]; then
    echo Wrong files
    exit 1
fi
