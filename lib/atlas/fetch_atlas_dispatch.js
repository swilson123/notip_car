//GET the latest dispatch from Atlas and hand back its JSON
var FETCH_TIMEOUT_MS = 10000;

var fetch_atlas_dispatch = function (white_rabbit, done) {
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
			done(err);
		});
};


module.exports = fetch_atlas_dispatch;
