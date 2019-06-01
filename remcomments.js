const fs = require("fs");

function update() {
  console.log("Updating...");
  var userscript = fs.readFileSync(process.argv[2] || "userscript.user.js").toString();
  var lines = userscript.split("\n");

  var newlines = [];
  var in_bigimage = false;
  var in_falserule = false;

  var firstcomment = true;
  var within_header = true;
  var within_firstcomment = false;
  for (const line of lines) {
    if (!in_bigimage) {
      if (firstcomment) {
        if (line.match(/^\s*\/\//)) {
          if (line.match(/==\/UserScript==/)) {
            within_header = false;
          } else if (!within_header) {
            within_firstcomment = true;
          }
        } else if (within_firstcomment) {
          firstcomment = false;
          newlines.push("");
          newlines.push("// Due to Greasyfork's 2MB limit, all comments within bigimage() had to be removed");
          newlines.push("// You can view the original source code here: https://github.com/qsniyg/maxurl/blob/master/userscript.user.js");
        }
      }

      if (line.match(/^\s+\/\/ -- start bigimage --/))
        in_bigimage = true;
      newlines.push(line);
      continue;
    }

    if (line.match(/^\s+\/\/ -- end bigimage --/)) {
      newlines.push(line);
      in_bigimage = false;
      continue;
    }

    if (in_falserule) {
      if (line.match(/^ {8}[}](?:[*][/])?$/))
        in_falserule = false;
      continue;
    }

    if (!line.match(/^\s*\/\//)) {
      var exclude_false = true;
      if (exclude_false && line.match(/^ {8}(?:[/][*])?if [(]false *&&/)) {
        in_falserule = true;
        continue;
      } else {
        newlines.push(line);
      }
    } else {
      if (!line.match(/\/\/\s+https?:\/\//) && false)
        console.log(line);
    }
  }

  fs.writeFileSync("userscript_smaller.user.js", newlines.join("\n"));
  console.log("Done");
}

update();
console.log("");
console.log("Watching");
fs.watchFile("userscript.user.js", update);
