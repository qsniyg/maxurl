#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")/.."

# This option enables extra consistency checks and generates extra files (sites.txt and those under build/)
# The resulting extension builds are identical, so there's little reason to use this if you're not a maintainer
RELEASE=
if [ "$1" == "release" ]; then
    RELEASE=1
fi

get_userscript_version() {
    cat $1 | grep '@version *[0-9.]* *$' | sed 's/.*@version *\([0-9.]*\) *$/\1/g'
}

USERVERSION=`get_userscript_version userscript.user.js`
MANIFESTVERSION=`cat manifest.json | grep '"version": *"[0-9.]*", *$' | sed 's/.*"version": *"\([0-9.]*\)", *$/\1/g'`

if [ -z "$USERVERSION" -o -z "$MANIFESTVERSION" ]; then
    echo Broken version regex
    exit 1
fi

if [ "$USERVERSION" != "$MANIFESTVERSION" ]; then
    echo 'Conflicting versions (userscript and manifest)'
    exit 1
fi

if [ -f ./tools/remcomments.js ]; then
    echo "Generating userscript_smaller.user.js"
    node ./tools/remcomments.js userscript.user.js nowatch
else
    echo "Warning: remcomments.js not available, skipping generating userscript_smaller.user.js"
fi

if [ ! -z $RELEASE ]; then
    if [ -f ./tools/gen_minified.js ]; then
        node ./tools/gen_minified.js
        MINVERSION=`get_userscript_version build/userscript_extr_min.user.js`

        if [ "$MINVERSION" != "$USERVERSION" ]; then
            echo 'Conflicting versions (userscript and minified)'
            exit 1
        fi
    else
        echo "Warning: gen_minified.js not available, skipping OpenUserJS minified version of the userscript"
    fi
fi

if [ ! -z $RELEASE ]; then
    if [ -f ./build/userscript_extr.user.js ]; then
        grep '// imu:require_rules' ./build/userscript_extr.user.js 2>&1 >/dev/null
        if [ $? -eq 0 ]; then
            echo 'require_rules present in extr.user.js (commit build/rules.js)'
            exit 1
        fi
    else
        echo "Warning: userscript_extr.user.js not available"
    fi
fi

if [ ! -z $RELEASE ]; then
    if [ -d site ]; then
        echo "Updating website files"
        cp site/style.css extension/options.css
        cp userscript_smaller.user.js site/
    else
        echo "Warning: website is not available, skipping website build"
    fi
fi

echo
echo Creating extension readme file

cat << EOF > EXTENSION_README.txt
To build the extension, run:

$ ./tools/build_libs.sh
$ ./tools/package_extension.sh

The built extension can be found in build/ImageMaxURL_unsigned.xpi.

Please refer to lib/libs.txt for the source URLs of the libraries stored in lib/orig.
 You can also fetch the libraries automatically by using ./lib/fetch_libs.sh.

The libraries are patched in order to be compatible with the script in a number of ways.
 Please refer to lib/patch_libs.js for details on how the libraries are patched.

The userscript has the following changes applied:
  * All comments within bigimage() have been removed (comments are nearly always test cases, and currently comprise ~2MB of the userscript's size)
  * It removes useless rules, such as: if (false && ...
  * It removes pieces of code only used for development, marked by imu:begin_exclude and imu:end_exclude
  * Debug calls (nir_debug) are modified to only run when debugging is enabled (which requires editing the source code). This is for performance.
  * common_functions.multidomain__* functions are inlined for performance
  * Unneeded strings within the strings object have been removed

This version is identical to userscript_smaller.user.js in the Github repository.
 This is generated when running package_extension.sh, or manually by using: node ./tools/remcomments.js userscript.user.js nowatch

Below are the versions of the programs used to generate this extension:

---

EOF

separator() {
    echo >> "$1"
    echo "---" >> "$1"
    echo >> "$1"
}

unzip -v >> EXTENSION_README.txt
separator EXTENSION_README.txt
zip -v >> EXTENSION_README.txt
separator EXTENSION_README.txt
# no longer needed as the relevant patching code is now written in JS
#dos2unix --version >> EXTENSION_README.txt
#separator EXTENSION_README.txt
#unix2dos --version >> EXTENSION_README.txt
#separator EXTENSION_README.txt
wget --version >> EXTENSION_README.txt
separator EXTENSION_README.txt
# same
#patch --version >> EXTENSION_README.txt
#separator EXTENSION_README.txt
sed --version >> EXTENSION_README.txt
separator EXTENSION_README.txt
echo -n "Node.js " >> EXTENSION_README.txt
node --version >> EXTENSION_README.txt
separator EXTENSION_README.txt

echo
echo Building Firefox extension

BASEFILES="LICENSE.txt manifest.json userscript.user.js resources/logo_40.png resources/logo_48.png resources/logo_96.png resources/disabled_40.png resources/disabled_48.png resources/disabled_96.png extension/background.js extension/options.css extension/options.html extension/popup.js extension/popup.html"
NONFFFILES="lib/ffmpeg.js lib/stream_parser.js"
NONAMOFILES="lib/testcookie_slowaes.js lib/cryptojs_aes.js lib/jszip.js lib/shaka.debug.js"
AMOFILES="lib/orig/slowaes.js lib/orig/cryptojs_aes.js lib/orig/jszip.js lib/orig/mux.js lib/orig/shaka-player.compiled.debug.js"
SOURCEFILES="tools/fetch_libs.sh tools/build_libs.sh lib/libs.txt EXTENSION_README.txt tools/package_extension.sh tools/remcomments.js tools/util.js tools/patch_libs.js"
DIRS="extension lib lib/orig resources tools"

zip_tempcreate() {
    mkdir tempzip

    for dir in $DIRS; do
        mkdir tempzip/$dir
    done

    for file in $BASEFILES $NONFFFILES $NONAMOFILES $AMOFILES $SOURCEFILES; do
        sourcefile="$file"
        if [ "$file" == "userscript.user.js" ]; then
            sourcefile=userscript_smaller.user.js
        fi

        cp "$sourcefile" tempzip/"$file"
    done
}

zip_tempcreate

# firefox doesn't currently support ffmpeg.wasm (lacking proper SharedArrayBuffer support)
# even if it were to support it, we'd still be running foreign code because a 20MB .wasm file cannot be reasonably included in the extension
# the proper fix is likely to build our own version, or better yet, find a way to avoid use it
sed -i 's/has_ffmpeg_lib = true/has_ffmpeg_lib = false/' tempzip/userscript.user.js

# remove chrome/opera-specific properties for firefox build
sed -i \
    -e '/"options_page": /d' \
    -e '/"key": /d' \
    -e '/"update_url": /d' tempzip/manifest.json

zipcmd() {
    echo
    echo "Building extension package: $1"
    echo

    FILES2="$NONFFFILES $NONAMOFILES"
    if [ "$2" = "amoff" ]; then # this may not be necessary
        FILES2="$AMOFILES"

        cd tempzip
        sed -i 's/amo_build = false;/amo_build = true;/g' extension/background.js
        cat ../tools/patch_libs.js extension/background.js > temp
        rm extension/background.js
        mv temp extension/background.js
        cd ..
    elif [ "$2" = "firefox" ]; then
        FILES2="$NONAMOFILES"
    fi

    cd tempzip
    zip -r ../"$1" $BASEFILES $FILES2 -x "*~"
    cd ..
}

zipsourcecmd() {
    echo
    echo "Building source package: $1"
    echo

    cd tempzip
    zip -r ../"$1" $BASEFILES $AMOFILES $SOURCEFILES -x "*~"
    cd ..
}

mkdir -p build
outxpi=build/ImageMaxURL_unsigned.xpi

rm -f "$outxpi"
zipcmd "$outxpi" firefox

getzipfiles() {
    unzip -l "$1" | awk '{print $4}' | awk 'BEGIN{x=0;y=0} /^----$/{x=1} {if (x==1) {x=2} else if (x==2) {print}}' | sed '/^ *$/d' | sort
}

FILES=$(getzipfiles "$outxpi")
echo "$FILES" > files.txt

assemble_file_list() {
    out=$1
    shift

    rm -f files_temp.txt

    for i in "$@"; do
        echo "$i" >> files_temp.txt
    done

    cat files_temp.txt | sort > $out
    rm files_temp.txt
}

diffzipfiles() {
    cat $1 $2 | sort | uniq -u
}

assemble_file_list files1.txt $BASEFILES $NONAMOFILES

DIFF="$(diffzipfiles files.txt files1.txt)"
if [ ! -z "$DIFF" ]; then
    echo
    echo 'Wrong files for firefox extension'
    exit 1
fi

rm -rf tempzip
zip_tempcreate
cp userscript.user.js tempzip/userscript.user.js

sourcezip=build/extension_source.zip
rm -f "$sourcezip"
zipsourcecmd "$sourcezip"

FILES=$(getzipfiles "$sourcezip")
echo "$FILES" > files.txt

assemble_file_list files1.txt $BASEFILES $AMOFILES $SOURCEFILES

DIFF="$(diffzipfiles files.txt files1.txt)"
if [ ! -z "$DIFF" ]; then
    echo
    echo 'Wrong files for source package'
    exit 1
fi

rm files.txt
rm files1.txt

rm -rf tempzip

hascmd() {
    which "$1" >/dev/null 2>&1
}

if [ -f ./maxurl.pem ]; then
    echo
    echo Building chrome extension
    # This is based on http://web.archive.org/web/20180114090616/https://developer.chrome.com/extensions/crx#scripts

    name=maxurl
    crx="build/ImageMaxURL_crx2.crx"
    crx3="build/ImageMaxURL_crx3.crx"
    pub="$name.pub"
    sig="$name.sig"
    zip="$name.zip"
    key="$name.pem"

    rm -f "$zip" "$pub" "$sig"

    zip_tempcreate
    zipcmd "$zip"
    rm -rf tempzip

    # signature
    openssl sha1 -sha1 -binary -sign "$key" < "$zip" > "$sig"

    # public key
    openssl rsa -pubout -outform DER < "$key" > "$pub" 2>/dev/null

    byte_swap () {
    # Take "abcdefgh" and return it as "ghefcdab"
    echo "${1:6:2}${1:4:2}${1:2:2}${1:0:2}"
    }

    crmagic_hex="4372 3234" # Cr24
    version_hex="0200 0000" # 2
    pub_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$pub" | awk '{print $5}')))
    sig_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$sig" | awk '{print $5}')))
    (
    echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | xxd -r -p
    cat "$pub" "$sig" "$zip"
    ) > "$crx"

    rm "$pub" "$sig"

    if hascmd crx3; then
        cat "$zip" | crx3 -p "$key" -o "$crx3"
    else
        echo "crx3 not found, not building CRX v3 extension"
        echo "Install using npm install -g crx3"
    fi

    rm "$zip"

    sed -i "s/version=\"[0-9.]*\"/version=\"$USERVERSION\"/g" extension/updates.xml
else
    echo "Warning: skipping chrome extension build"
fi

if [ ! -z $RELEASE ]; then
    echo
    echo "Release checklist:"
    echo
    echo ' * Ensure translation strings are updated'
    echo ' * Ensure xx00+ count is updated (userscript - greasyfork/oujs, reddit post, mozilla/opera, website)'
    echo ' * Ensure CHANGELOG.txt is updated'
    echo ' * git add userscript.user.js userscript_smaller.user.js userscript.meta.js CHANGELOG.txt build/userscript_extr.user.js build/userscript_extr_min.user.js build/ImageMaxURL_crx3.crx build/ImageMaxURL_unsigned.xpi extension/updates.xml manifest.json sites.txt'
    echo ' * git commit ('$USERVERSION')'
    echo ' * Update greasyfork, oujs, firefox, opera, changelog.txt'
    echo ' * git tag v'$USERVERSION
    echo ' * Update userscript.user.js for site (but check about.js for site count before)'
    echo ' * Update Discord changelog'
    echo ' * Update build/ImageMaxURL_signed.xpi'
else
    echo
    echo "Non-maintainer build finished"
fi
