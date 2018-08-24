// Ports and Ol-Tools
function Geotools_port_init(elmApp){
	// ****** Ports from elm (subscriptions)
	elmApp.ports.setOlConfig.subscribe(function(mapconfig) {
		console.log("got from Elm:", mapconfig);
        requestAnimationFrame(function() {
            DSOlMap.setConfig(mapconfig, elmApp);
        });
    });

// receive something from Elm
    elmApp.ports.setOlAction.subscribe(function (strAction) {
        console.log("got from Elm:", strAction);
        if (DSOlMap.map) {
            if (strAction === "zoomToPeri") {
            	DSOlMap.zoomToPeri();
            } else if (strAction === "deletePeri") {
            	DSOlMap.deletePeri();
            }
        }
    });
}

var DSOlMap = {
	elmApp: null,
	mapconfig: null,
	map : null,
	projection : null,
	view : null,
	featureLayer : null,
	featureSource : null,

	refStyle: function () {
		var style = new ol.style.Style({
		image: new ol.style.Circle({
		  radius: 10,
		  stroke: new ol.style.Stroke({
		    color: '#FE7900',
		    width: 2
		  }),
		  fill: new ol.style.Fill({
		  	color: 'rgba(254,121,0,0.5)'
		  	// hellblau: 'rgba(118,146,210, 0.5)'
		    //color: '#FE7900'
		  })
		})
		});
		return [style];
	},

	measureStyle: function () {
		var style = new ol.style.Style({
		image: new ol.style.Circle({
		  radius: 7,
		  stroke: new ol.style.Stroke({
		    color: '#0000FF',
		    width: 1
		  }),
		  fill: new ol.style.Fill({
		  	color: 'rgba(118,146,210,0.7)'
		  })
		})
		});
		return [style];
	},

	buildMeasureFeature: function (coordType, featureId, measure){
		var feature = new ol.Feature(
	        new ol.geom.Point([measure.east, measure.north])
	    );
	    if (coordType=="ref"){
	    	feature.setStyle(DSOlMap.refStyle());
	    } else {
	    	feature.setStyle(DSOlMap.measureStyle());
	    }
    	feature.setId(featureId);
    	return feature;
	},

	addRefLoc: function (refLoc) {
		DSOlMap.featureSource.addFeature(DSOlMap.buildMeasureFeature("ref", refLoc[0], refLoc[1]));
	},

	removeAllFeatures: function () {
	  	// Remove Features (https://gis.stackexchange.com/questions/251770/how-can-i-clear-a-vector-layer-features-in-openlayers-4)
		var oldFeatures = DSOlMap.featureLayer.getSource().getFeatures();

		for (var i = oldFeatures.length - 1; i >= 0; i--) {
			DSOlMap.featureLayer.getSource().removeFeature(oldFeatures[i]);
		}
	},

	addMeasurements: function (measurements) {
/*		measurements.forEach((feature) => {
		        // DSOlMap.featureLayer.getSource().removeFeature(feature);
				DSOlMap.featureSource.addFeature(DSOlMap.buildMeasureFeature("measure", feature.timestamp, feature));
		    }
		);
*/
		for (var j = measurements.length - 1; j >= 0; j--) {
			DSOlMap.featureSource.addFeature(DSOlMap.buildMeasureFeature("measure", measurements[j].timestamp, measurements[j]));
		}
	},


	setConfig: function (mapconfig, elmApp) {
		var features;
		if (DSOlMap.map === null) {
			DSOlMap.setupMap (mapconfig, elmApp);
			DSOlMap.setConfig (mapconfig, elmApp);
		} else {
	  		if (DSOlMap.mapconfig.refLocation[0] != mapconfig.refLocation[0]) {
		  		DSOlMap.view.setCenter(mapconfig.center);
		  		DSOlMap.view.setZoom(mapconfig.zoom);
		  		DSOlMap.removeAllFeatures();
			}

			if (DSOlMap.mapconfig.checkDistance != mapconfig.checkDistance) {
		  		DSOlMap.view.setCenter(mapconfig.center);
		  		DSOlMap.view.setZoom(mapconfig.zoom);
		  		DSOlMap.removeAllFeatures();
			}

	  		if (mapconfig.measurements.length === 0) {
	  			DSOlMap.removeAllFeatures();
	  		}

	  		// add refLocation
	  		if (mapconfig.checkDistance) {
	  			DSOlMap.addRefLoc(mapconfig.refLocation);
	  		}
	  		// add measurements
	  		DSOlMap.addMeasurements(mapconfig.measurements);

	  		DSOlMap.mapconfig = mapconfig;
		}

	  	DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	},




	buildUpLayer: function () {
		return new ol.layer.Image({
			source: new ol.source.ImageWMS({
				url: 'https://wms.zh.ch/uplayerwms/',
				crossOrigin: 'anonymous',
				attributions: '© <a href="https://maps.zh.ch?topic=UPZH&srid=2056" target="_blank">Übersichtsplan / maps.zh.ch</a>',
				params: {'LAYERS': 'uplayerwms','FORMAT': 'image/png; mode=8bit'},
				serverType: 'mapserver'
          	})
        });
	},

	buildLkLayer: function () {
        return new ol.layer.Image({
			source: new ol.source.ImageWMS({
				url: 'https://wms.geo.admin.ch/',
				crossOrigin: 'anonymous',
				attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
				    'en/home.html">Pixelmap 1:1000000 / geo.admin.ch</a>',
				params: {
				  'LAYERS': 'ch.swisstopo.pixelkarte-farbe-pk1000.noscale',
				  'FORMAT': 'image/jpeg'
				},
				serverType: 'mapserver'
			})
        })
	},



	setupMap: function (mapconfig, elmApp) {
		DSOlMap.elmApp = elmApp;
		DSOlMap.mapconfig = mapconfig;
		DSOlMap.projection = new ol.proj.Projection({
	        code: 'EPSG:2056',
	        units: 'm'
	    });
		DSOlMap.view = new ol.View({
	        center: mapconfig.center, // [2701726.2240732517, 1264358.9709083273],
	        projection: DSOlMap.projection,
	        zoom: mapconfig.zoom //18
	    });
		DSOlMap.view.on('change', function(e) {
/*
	        DSOlMap.mapconfig.center = e.target.getCenter();
	        DSOlMap.mapconfig.extent = e.target.calculateExtent(DSOlMap.map.getSize());
	        DSOlMap.mapconfig.zoom = DSOlMap.map.getView().getZoom();
	        // ******** sendet die aktualisierte mapconfig nach jeder Änderung an elm
	        console.log("view change: ", DSOlMap.mapconfig.extent.toString(), DSOlMap.mapconfig.center, DSOlMap.mapconfig.zoom);
	        elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
*/
	    });

		DSOlMap.featureSource = new ol.source.Vector({wrapX: false});
		DSOlMap.featureLayer = new ol.layer.Vector({
	        source: DSOlMap.featureSource,
	        //style: DSOlMap.measureStyle
	    });



	  	// create map
		DSOlMap.map = new ol.Map({
	        // target: 'myOlMap',
	        controls: ol.control.defaults().extend([
	          new ol.control.ScaleLine()
	        ]),
	        // layers: [DSOlMap.buildLkLayer(),  DSOlMap.featureLayer],
	        layers: [DSOlMap.buildUpLayer(), DSOlMap.featureLayer],
	        view: DSOlMap.view
	    });
	    DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	}
};
