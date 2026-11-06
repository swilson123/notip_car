//GET the latest dispatch from Atlas and hand back its JSON
//Retried a few times: Node's fetch can reuse a keep-alive socket the server already closed, and fails in a blink with "fetch failed"
var FETCH_TIMEOUT_MS = 10000;
var FETCH_TRIES = 3;
var FETCH_RETRY_MS = 500;

var fetch_atlas_dispatch = function (white_rabbit, done, attempt) {
	attempt = attempt || 1;

	fetch(white_rabbit.atlas.dispatch_url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
		.then(function (response) {
			if (!response.ok) {
				throw new Error('HTTP ' + response.status);
			}
			return response.json();
		})
		.then(function (dispatch) {
			done(null, dispatch);
		})
		.catch(function (err) {
			//"fetch failed" hides the real reason (ECONNRESET, ENOTFOUND, ...) in err.cause
			var reason = err.message + (err.cause ? ' (' + (err.cause.code || err.cause.message) + ')' : '');

			if (attempt < FETCH_TRIES) {
				console.log('ATLAS dispatch fetch ' + attempt + '/' + FETCH_TRIES + ' failed: ' + reason + ' - retrying');
				setTimeout(function () {
					fetch_atlas_dispatch(white_rabbit, done, attempt + 1);
				}, FETCH_RETRY_MS);
				return;
			}

			done(new Error(reason));
		});
};


module.exports = fetch_atlas_dispatch;
