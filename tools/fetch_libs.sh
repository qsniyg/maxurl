#!/bin/bash

cd "`dirname "$0"`"
cd ../lib

if [ ! -d orig ]; then
	mkdir orig
fi
cd orig

cat ../libs.txt | sed -e '/^ *$/d' -e '/^ *#/d' | while read line; do
	URL=`echo "$line" | sed 's/^\([^ ]*\).*$/\1/g'`

	NAME=
	echo "$line" | grep ' = ' >/dev/null 2>&1
	if [ $? -eq 0 ]; then
		NAME=`echo "$line" | sed 's/.* = *\([^ ]*\) *$/\1/g'`
	fi

	if [ -z "$NAME" ]; then
		NAME=`basename "$URL"`
	fi

	wget "$URL" -O "$NAME"
done
