fs = require('fs');
pkg = require('./package.json');

pkg.main = pkg.main.replace('dist/', '');
pkg.types = pkg.types.replace('dist/', '');

fs.writeFile('./dist/package.json', JSON.stringify(pkg, null, 4), (err) => {
    if (err) throw err;
});
