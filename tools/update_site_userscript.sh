cd "`dirname "$0"`"/../

if [ ! -d site ]; then
    echo "Site directory doesn't exist"
    exit 1
fi

cd site

if [ ! -z "`git diff --staged`" ]; then
    echo "Site has staged changes, aborting."
    exit 1
fi

cp ../userscript_smaller.user.js .

git add userscript_smaller.user.js
git diff
echo "Continue? (CTRL+C to exit)"
read
git commit -m "Update userscript"
git push origin gh-pages
