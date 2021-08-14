// Ports and Ol-Tools
function Geotools_port_init(elmApp){
	// ****** Ports from elm (subscriptions)
	elmApp.ports.setOlConfig.subscribe(function(mapconfig) {
		console.log("got from Elm:", mapconfig);
        requestAnimationFrame(function() {
            DSOlMap.setConfig(mapconfig, elmApp);
        });
    });

    elmApp.ports.storeRefsInCache.subscribe(function (data) {
        localStorage.setItem('cacheRefs', JSON.stringify (data));
    });

    // send initial orders from cache if available
    if (localStorage.getItem('cacheRefs')) {
        elmApp.ports.getRefsFromCache.send(JSON.parse(localStorage.getItem('cacheRefs')));
    }

/*
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
*/
};

proj4.defs(
	"EPSG:2056",
	"+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs"
);

proj4.defs(
	"EPSG:21781",
	"+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs"
);

ol.proj.proj4.register(proj4);

var DSOlMap = {
	elmApp: null,
	mapconfig: null,
	map : null,
	projection : null,
	view : null,
	featureLayer : null,
	featureSource : null,
	lkTileLayer : null,
	zhWmsLayer : null,

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

	myLocStyle: function () {
		var style = new ol.style.Style({
		image: new ol.style.Circle({
		  radius: 8,
		  stroke: new ol.style.Stroke({
		    color: '#FE7900',
		    width: 2
		  }),
		  fill: new ol.style.Fill({
		  	color: 'rgba(118,146,210,1)'
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
	    } else if (coordType=="myloc"){
	    	feature.setStyle(DSOlMap.myLocStyle());
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

	addMyLoc: function (myLoc) {
		var oldLocation = DSOlMap.featureSource.getFeatureById("myLocation");
		if (oldLocation) {
				DSOlMap.featureSource.removeFeature(oldLocation);
		}
		DSOlMap.featureSource.addFeature(DSOlMap.buildMeasureFeature("myloc", "myLocation", myLoc));
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
	  		if (mapconfig.measurements.length > 0) {
		  		DSOlMap.addMeasurements(mapconfig.measurements);
		  		DSOlMap.addMyLoc(mapconfig.measurements[0]);
		  	}
	  		DSOlMap.mapconfig = mapconfig;
		}

	  	DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	},


	buildUpLayer: function () {
		return new ol.layer.Image({
			source: new ol.source.ImageWMS({
				url: 'https://wms.zh.ch/uplayerwms/',
				//crossOrigin: 'Anonymous',
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
        });
	},

	backgroundLayer: function () {
		return new ol.layer.Tile({
			id: "background-layer",
			source: new ol.source.XYZ({
				url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
			})
		});
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
	        projection:  DSOlMap.projection, // "EPSG:2056"
	        zoom: mapconfig.zoom //18
	    });
		DSOlMap.view.on('change', function(e) {
			actExtent = e.target.calculateExtent(DSOlMap.map.getSize());
			// nur sichtbar, wenn aktueller Ausschnitt nicht vollständig in ÜP-Bereich 
			lkVisible = false; 
			if (actExtent[0] < 2654500 ||
				actExtent[1] < 1222400 ||
				actExtent[2] > 2720000 ||
				actExtent[3] > 1300000
				) {
				lkVisible = true;
			} else {
				lkVisible = false;
			}
			
			// nur sichtbar, wenn aktueller Ausschnitt ÜP-Bereich anschneidet
			upVisible = false;
			if ((actExtent[0] < 2720000 && (actExtent[1] < 1300000 || actExtent[3] > 1222400)) ||
				(actExtent[1] < 1300000 && (actExtent[0] < 2720000 || actExtent[2] > 2654500)) ||
				(actExtent[2] > 2654500 && (actExtent[1] < 1300000 || actExtent[3] > 1222400)) ||
				(actExtent[3] > 1222400 && (actExtent[0] < 2720000 || actExtent[2] > 2654500))
				) {
				upVisible = true;
			} else {
				upVisible = false;
			}

			if  (DSOlMap.map.getView().getZoom() > 17) {
				DSOlMap.lkTileLayer.setVisible(lkVisible);
				DSOlMap.zhWmsLayer.setVisible(upVisible);
			} else {
				if (DSOlMap.map.getView().getZoom() >= 19) {
					DSOlMap.lkTileLayer.setVisible(false);
				} else {
					DSOlMap.lkTileLayer.setVisible(true);
				}
				DSOlMap.zhWmsLayer.setVisible(false);
			}

			// Extent UPZH: 2654500 1222400 2720000 1300000
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

		DSOlMap.lkTileLayer = DSOlMap.backgroundLayer();
		DSOlMap.zhWmsLayer = DSOlMap.buildUpLayer();
		

	  	// create map
		DSOlMap.map = new ol.Map({
	        // target: 'myOlMap',
	        controls: ol.control.defaults().extend([
	          new ol.control.ScaleLine({
				units: "metric"
			  })
	        ]),
	        // layers: [DSOlMap.buildLkLayer(),  DSOlMap.featureLayer],
	        layers: [DSOlMap.lkTileLayer, DSOlMap.zhWmsLayer, DSOlMap.featureLayer],
	        view: DSOlMap.view
	    });
	    DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	}
};
