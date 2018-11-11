// Ports
var myGeolocationState = null;

var GeolocationState = {
	elmApp: null,
	watchId: 0,

	geo_success: function (rawPosition) {
		myGeolocationState.elmApp.ports.changelocation.send(toLocation(rawPosition));
	},

	geo_error: function (rawError) {
		myGeolocationState.elmApp.ports.errorlocation.send(toError(rawError));
	},

	geo_id: function (watchId) {
		myGeolocationState.elmApp.ports.watchid.send(watchId);
	}
};

function Geolocation_port_init(elmApp){
/*
	// default
	var geo_options = {
		enableHighAccuracy: true,
		maximumAge        : 0, // 30000,
		timeout           : Infinity // 27000
	};
*/
	var geo_options = {
		enableHighAccuracy: true,
		maximumAge        : 10000,
		timeout           : 9000
	};

	myGeolocationState = Object.create(GeolocationState);



	// ****** Ports from elm (subscriptions)
	elmApp.ports.watch.subscribe(function() {
        //console.info("got from Elm: watch, old_watchId = ", myGeolocationState.watchId);
		if (myGeolocationState.watchId) {
			navigator.geolocation.clearWatch(myGeolocationState.watchId);
		}
        myGeolocationState.watchId = navigator.geolocation.watchPosition(myGeolocationState.geo_success, myGeolocationState.geo_error, geo_options);
        myGeolocationState.geo_id(myGeolocationState.watchId);
    });

    elmApp.ports.clearWatch.subscribe(function (watchId) {
        //console.info("got from Elm: clear watchID = ", watchId, " /// JS watchId = ", myGeolocationState.watchId);
        navigator.geolocation.clearWatch(watchId);
        myGeolocationState.watchId = null;
    });

	myGeolocationState.elmApp = elmApp;
}



// LOCATIONS

function toLocation(rawPosition)
{
	var coords = rawPosition.coords;

	return {
		longitude: coords.longitude,
		latitude: coords.latitude,
		accuracyPos: coords.accuracy,
		altitude: coords.altitude,
		accuracyAltitude: coords.altitudeAccuracy,
		movingSpeed: coords.speed,
		movingDegrees: coords.heading,
		timestamp: rawPosition.timestamp
	};
}


// ERRORS

var errorTypes = ['PermissionDenied', 'PositionUnavailable', 'Timeout'];

function toError(rawError)
{
	return {
		//errcode: errorTypes[rawError.code],
		errcode: rawError.code,
		message: rawError.message
	};
}


