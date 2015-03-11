#!/usr/bin/env node
'use strict';

var port = 2302;

var http = require('http');
var URL = require('url');
var fs = require('fs');
var path = require('path');

/* url object must match at least one filter */
var filters = [
	function errApi(url) { return /err\.ee\/api/.test(url); }
];

http.createServer(requestHandler).listen(port);

function testFilters(url) {
	for (var i = 0; i < filters.length; i++) {
		if (filters[i](url)) {
			return true;
		}
	}
	return false;
}

function requestHandler(req, res) {
	var url = URL.parse(req.url, true, true);
	var target = url.query.url;
	if (target && url.pathname === '/') {
		if (!testFilters(target)) {
			console.error('proxy-reject  ', target);
			res.writeHead(400);
			res.end();
		} else {
			console.log('proxy         ', target);
			serveProxy(req, res, target);
		}
	} else {
		if (req.method !== 'GET') {
			console.log('static-reject ', req.method, url.pathname);
			res.send(400);
			res.end();
		} else {
			console.log('static        ', url.pathname);
			serveStatic(req, res, url.pathname);
		}
	}
}

function serveProxy(req, res, target) {
	var url = URL.parse(target);
	var proxy = http.createClient(url.port || 80, url.host);
	var preq = proxy.request(req.method, target, req.headers);
	preq.addListener('response', function (pres) {
		res.writeHead(pres.statusCode, pres.headers);
		pres.addListener('data', function (chunk) {
			res.write(chunk, 'binary');
		});
		pres.addListener('end', function () {
			res.end();
		});
	});
	req.addListener('data', function (chunk) {
		preq.write(chunk, 'binary');
	});
	req.addListener('end', function () {
		preq.end();
	});
}

function serveStatic(req, res, file) {
	if (/\.{2,}/.test(file)) {
		console.error('invalid       ', file);
		res.writeHeader(400);
		res.end();
		return;
	}

	var fn = [
		function (cb) { serveFile(file, cb); },
		function (cb) { serveFile(file + 'index.html', cb); },
		function (cb) { serveDirectory(file, cb); }
	];

	next();

	return;

	function next() {
		if (!fn.length) {
			console.error('fail          ', file);
			res.writeHeader(404);
			res.end();
			return;
		}
		var func = fn.shift();
		func(function (done) {
			if (done) {
				res.end();
			} else {
				next();
			}
		});
	}

	function serveFile(file, cb) {
		fs.readFile(path.join('.', file), function (err, data) {
			if (err) {
				return cb();
			}
			res.writeHead(200);
			res.write(data, 'binary');
			return cb(true);
		});
	}

	function serveDirectory(file, cb) {
		fs.readdir(path.join('.', file), function (err, data) {
			if (err) {
				return cb();
			}
			if (!/\/$/.test(file)) {
				res.writeHead(301, { Location: file + '/' });
				return cb(true);
			}
			res.writeHead(200);
			res.write('<!doctype html><html><head><meta charset="utf8"></head><body>' +
				data.map(function (d) { return '<a href="' + path.join(file, d) + '">' + d + '</a>'; }).join('<br>') +
				'</body></html>', 'utf-8');
			return cb(true);
		});
	}
}
