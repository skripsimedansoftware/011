const fs = require('fs');
const path = require('path');
const files = new Object;

fs.readdirSync(__dirname).filter(file => {
	if (path.basename(file).split('.').slice(0, -1).join('.') !== path.basename(__filename).split('.').slice(0, -1).join('.')) {
		return (file.slice(-3).match(/\.(js|ts)/));
	}
}).forEach(file => {
	var file_name = [path.basename(file).split('.').slice(0, -1).join('.')];
	var file_path = require(path.join(__dirname, file));
	response = { [file_name]: file_path };
	Object.assign(files, response);
});

module.exports = files;
