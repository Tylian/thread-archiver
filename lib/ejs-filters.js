var ejs = require('ejs');

ejs.filters.truncate = function(obj) {
	return obj.length <= 15 ? obj : obj.substr(0, 15) + '(...)';
}
ejs.filters.bytesize = function(obj) {
	var suffix = ['B', 'KB', 'MB', 'GB', 'TB'];
	for(var i = suffix.length - 1; i >= 0; i--) {
		if(Math.round(obj / Math.pow(1024, i)) > 1) {
			return Math.round(obj / Math.pow(1024, i)) + " " + suffix[i];
		}
	}
	return "0 B";
};