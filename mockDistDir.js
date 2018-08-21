// this file simply copies/modifies root package.json into the 
// dist dir with the correct paths

// this is only useful for ./src/demo

// the copy of the file at dist/package.json is npm-ignored

fs = require('fs');
pkg = require('./package.json');

// just remove "dist/"" from paths
pkg.main = pkg.main.replace('dist/', '');
pkg.types = pkg.types.replace('dist/', '');

// write the modified json into the dist folder
fs.writeFile('./dist/package.json', JSON.stringify(pkg, null, 4), (err) => {
    if (err) throw err;
});
