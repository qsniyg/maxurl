const fs = require("fs");

var file = process.argv[2];
var contents = fs.readFileSync(file, "utf8");

var lines = contents.split("\n");

var table = [];
var opt_table = [];
var batch_table = [];
var last = [];
for (const line of lines) {
    if (line[0] !== '0' || line[1] !== 'x')
        continue;

    var match = line.match(/^(0x[0-9A-F]+)\s+(0x[0-9A-F]+)\s+/);
    if (!match)
        continue;

    var current = [parseInt(match[1]), parseInt(match[2])];

    if (current[0] === current[1])
        continue;

    table.push(current);

    if (last[0] + 1 === current[0] && last[1] + 1 === current[1]) {
        var lastopt = opt_table[opt_table.length - 1];
        if (lastopt.length === 2) {
            lastopt[2] = 1;
        } else {
            lastopt[2]++;
        }
    } else {
        opt_table.push(current);
    }

    if (last[0] + 1 === current[0]) {
        //batch_table[batch_table.length - 1][1].push(current[1]);
        batch_table[batch_table.length - 1][1] += String.fromCharCode(current[1]);
    } else {
        //batch_table.push([current[0], [current[1]]]);
        batch_table.push([current[0], String.fromCharCode(current[1])]);
    }

    last = current;
}

console.log(JSON.stringify(batch_table));
