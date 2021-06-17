#!/bin/bash

cd "`dirname "$0"`"
cd ../lib

if [ "$1" = "fetch" ]; then
	../tools/fetch_libs.sh
fi

CLEANUP_FILES=

strip_whitespace() {
	sed -i -e 's/[ \t]*$//g' -e 's/^ *$//g' "$1"
}

to_uricomponent() {
	cat "$@" | node -e 'var fs = require("fs"); var data = fs.readFileSync(0, "utf8"); process.stdout.write(encodeURIComponent(data));'
}

node ../tools/patch_libs.js slowaes orig > testcookie_slowaes.js
node ../tools/patch_libs.js cryptojs_aes orig > cryptojs_aes.js
node ../tools/patch_libs.js shaka orig > shaka.debug.js
node ../tools/patch_libs.js jszip orig > jszip.js

# The following libraries are not present in the Firefox version

if [ -f orig/ffmpeg.min.js ]; then
	cp orig/ffmpeg.min.js ffmpeg.min.orig.js
	cp orig/ffmpeg-core.js ffmpeg-core.orig.js
	cp ffmpeg-core.orig.js ffmpeg-core.js
	# window.* and self->_fakeGlobal are for preventing leaking
	# remove sourcemapping to avoid warnings under devtools
	sed -i \
		-e 's/window.FFMPEG_CORE_WORKER_SCRIPT/FFMPEG_CORE_WORKER_SCRIPT/g' \
		-e 's/window\.createFFmpegCore/createFFmpegCore/g' \
		-e 's/(self,(function/(_fakeGlobal,(function/' \
		-e '/\/\/# sourceMappingURL=/d' ffmpeg.min.orig.js
	# prevents blob urls from being used, fixes loading under chrome
	# node is used instead of sed due to the size of ffmpeg-core.orig.js
	node <<EOF
var fs = require("fs");
var ffmpeg = fs.readFileSync("ffmpeg.min.orig.js", "utf8");
var core = fs.readFileSync("ffmpeg-core.orig.js", "utf8");
//ffmpeg = ffmpeg.replace(/mainScriptUrlOrBlob:[a-zA-Z0-9]+,/, 'mainScriptUrlOrBlob:"data:application/x-javascript,' + encodeURIComponent(core) + '",');
ffmpeg = ffmpeg.replace(/mainScriptUrlOrBlob:[a-zA-Z0-9]+,/, 'mainScriptUrlOrBlob:new Blob([decodeURIComponent("' + encodeURIComponent(core) + '")]),');
fs.writeFileSync("ffmpeg.min.orig.js", ffmpeg);
EOF
	# since ffmpeg-core is being prepended, this is necessary in order to have requests work properly
	# note that the unpkg url is used instead of integrating it in the repo. this is for cache reasons, as all other scripts using ffmpeg.js will use the same url
	sed -i 's/{return [a-z]*\.locateFile[?][a-z]*\.locateFile(a,[^}]*}var/{return "https:\/\/unpkg.com\/@ffmpeg\/core@0.8.5\/dist\/" + a}var/' ffmpeg-core.js
	# inject the worker directly, fixes more cors issues
	WORKER_CODE=`to_uricomponent orig/ffmpeg-core.worker.js`
	#sed -i 's/{var a=..("ffmpeg-core.worker.js");\([^}]*\.push(new Worker(a))}\)/{var a="data:application\/x-javascript,'$WORKER_CODE'";\1/g' ffmpeg-core.js
	# use blob instead of data, works on more sites (such as instagram)
	sed -i 's/{var a=..("ffmpeg-core.worker.js");\([^}]*\.push(new Worker(a))}\)/{var a=URL.createObjectURL(new Blob([decodeURIComponent("'$WORKER_CODE'")]));\1/g' ffmpeg-core.js
	# finally cat it all together
	echo "var FFMPEG_CORE_WORKER_SCRIPT;var _fakeGlobal={window:window};" > ffmpeg.js
	cat fetch_shim.js >> ffmpeg.js
	cat ffmpeg-core.js >> ffmpeg.js
	echo "" >> ffmpeg.js
	cat ffmpeg.min.orig.js >> ffmpeg.js
	echo "" >> ffmpeg.js
	echo "var lib_export = _fakeGlobal.FFmpeg;" >> ffmpeg.js
	cat shim.js >> ffmpeg.js
	dos2unix ffmpeg.js
	strip_whitespace ffmpeg.js

	CLEANUP_FILES="$CLEANUP_FILES ffmpeg.min.orig.js ffmpeg-core.orig.js ffmpeg-core.js"
fi

if [ -f orig/mpd-parser.js ]; then
	cp orig/mpd-parser.js mpd-parser.js
	# isNaN prevents failing under firefox addon
	# location.href is to avoid resolving to the local href (breaks v.redd.it dash streams)
	sed -i \
		-e 's/}(this, (function (exports/}(_fakeGlobal, (function (exports/' \
		-e 's/window\.isNaN/isNaN/g' \
		-e 's/window__[^ ]*\.location\.href/""/g' mpd-parser.js
	cp orig/m3u8-parser.js m3u8-parser.js
	sed -i 's/}(this, function (exports/}(_fakeGlobal, function (exports/' m3u8-parser.js
	echo "var _fakeGlobal={window: window};" > stream_parser.js
	cat mpd-parser.js m3u8-parser.js >> stream_parser.js
	echo "" >> stream_parser.js
	echo "var lib_export = { dash: _fakeGlobal.mpdParser, hls: _fakeGlobal.m3u8Parser };" >> stream_parser.js
	cat shim.js >> stream_parser.js
	dos2unix stream_parser.js
	strip_whitespace stream_parser.js

	CLEANUP_FILES="$CLEANUP_FILES mpd-parser.js m3u8-parser.js"
fi

CLEANUP=1
if [ $CLEANUP -eq 1 ] && [ ! -z "$CLEANUP_FILES" ]; then
	rm $CLEANUP_FILES
fi
