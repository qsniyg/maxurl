#!/bin/bash

cd "`dirname "$0"`/.."

which jq >/dev/null 2>&1
if [ $? -ne 0 ]; then
	echo jq not installed
	exit 1
fi

URL=`curl 'https://addons.mozilla.org/api/v5/addons/addon/image-max-url/versions/' | jq -r '.results[0].files[0].url'`
wget $URL -O build/ImageMaxURL_signed.xpi
