#!/bin/sh

cd "`dirname "$0"`/.."

LASTTAG="`git tag | sort -V | tail -n1`"
curl 'https://raw.githubusercontent.com/qsniyg/maxurl/'"$LASTTAG"'/userscript_smaller.user.js' -o olduserscript
