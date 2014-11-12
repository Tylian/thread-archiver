var Promise = require('promise')
  , ejs = require('ejs')
  , fs = require('fs-extra')
  , path = require('path')
  , http = require('http')
  , minify = require('html-minifier').minify;

require('./ejs-filters.js');

var writeFile = Promise.denodeify(fs.writeFile);
var readFile = Promise.denodeify(fs.readFile);
var outputJson = Promise.denodeify(fs.outputJson);
var readJson = Promise.denodeify(fs.readJson);
var exists = Promise.denodeify(fs.exists);
var ensureDir = Promise.denodeify(fs.ensureDir);
var copy = Promise.denodeify(fs.copy);

function downloadJson(url) {
	return new Promise(function(resolve, reject) {
		http.get(url, function(res) {
			if(res.statusCode !== 200) {
				return reject(new Error('Non-OK statusCode when fetching JSON: ' + res.statusCode));
			}
			
			var body = "";
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				body += chunk;
			});
			res.on('end', function() {
				resolve(JSON.parse(body));
			});
		});
	});
}

function downloadFile(local, remote) {
	return new Promise(function(resolve, reject) {
		ensureDir(path.dirname(local))
			.then(function() {
				if(fs.existsSync(local)) {
					return resolve();
				}
			
				var file = fs.createWriteStream(local);
				http.get(remote, function(res) {
					res.pipe(file);
					file.on('finish', function() {
						file.close(resolve);
					});
				});
			});
	});
}

var archive = {
	// Download a thread's JSON data, as well as images.
	fetch: function(board, thread, basePath) {
		var jsonLocal = path.join(basePath, thread + '.json');
		var jsonRemote = 'http://a.4cdn.org/' + board + '/thread/' + thread + '.json';
		
		return downloadJson(jsonRemote)
			.then(function(data) {
				data.thread = thread;
				data.board = board;

				return data;
			}).then(function(data) {
				return outputJson(jsonLocal, data)
				.then(function() {
					return data;
				});
			})
			.then(function(data) {
				var imagePath = path.join(basePath, 'img');
				var thumbUrl = 'http://i.4cdn.org/' + data.board + '/';
				var fullUrl =  'http://t.4cdn.org/' + data.board + '/';

				var queue = [];
				for(var i = 0; i < data.posts.length; i++) {
					var post = data.posts[i];
					if(typeof post.tim !== 'undefined') {
						var thumbName = post.tim + 's.jpg';
						var fullName = post.tim + post.ext;

						queue.push(
							downloadFile(path.join(imagePath, thumbName), fullUrl + thumbName),
							downloadFile(path.join(imagePath, fullName), thumbUrl + fullName)
						);
					}
				}

				return Promise.all(queue);
			});
	},
	// Update an already fetched archive, generating the template page from the saved JSON as well as copying static resources over
	update: function(jsonPath) {
		var data;
		var basePath = path.dirname(jsonPath);
		var modulePath = path.join(__dirname, '..');

		return readJson(jsonPath).then(function(json) {
			data = json;
			data.filename = path.join(modulePath, 'template', 'index.ejs');
			return readFile(data.filename, 'utf8');
		}).then(function(template) {
			var contents = ejs.render(template, data);
			return minify(contents, { collapseWhitespace: true });
		}).then(function(contents) {
			var filename = data.thread + '-' + data.posts[0].semantic_url + '.html';
			return writeFile(path.join(basePath, filename), contents);
		}).then(copy(path.join(modulePath, 'static'), basePath));
	}
};

module.exports = archive;