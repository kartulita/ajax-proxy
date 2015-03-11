(function (angular, _) {
	'use strict';

	angular.module('battlesnake.ajax-proxy', [])
		.factory('httpProxy', httpProxyFactory)
		.config(function ($httpProvider) {
			if (/err\.ee/.test(location.hostname)) {
				return;
			}
			$httpProvider.interceptors.push('httpProxy');
		});

	function httpProxyFactory() {
		return {
			request: requestDecorator
		};

		function requestDecorator(config) {
			if (!/^(https?:)?:?\/\//.test(config.url)) {
				return config;
			}
			var url = config.url;
			var query = _(config.params)
				.map(function (v, k) {
					return encodeURIComponent(k) + '=' + encodeURIComponent(v);
				})
				.join('&');
			config.params = {};
			url = url + (/\?/.test(url) ? '&' : '?') + query;
			config.url = location.protocol + '//' + location.host + '/?url=' + encodeURIComponent(url);
			return config;
		}
	}

})(window.angular, window._);
