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
// ****** Send to elm *******

/*
function ogdShopTopicChanged(topic) {
    // body...
    elmApp.ports.topicChanged.send(topic);
}

function ogdShopTabActivated(tabName) {
    // body...
    elmApp.ports.tabActivated.send(tabName);
}
*/
var DSOlMap = {
	elmApp: null,
	mapconfig: null,
	map : null,
	projection : null,
	view : null,
	periLayer : null,
	featureSource : null,
	// interactions
	boxExtent : null,
	drawBox : null,
	select : null,
	snap: null,
	modify : null,
	translate : null,

	setConfig: function (mapconfig, elmApp) {
		var features;
		if (DSOlMap.map === null) {
			DSOlMap.setupMap (mapconfig, elmApp);
		} else {
	  		//DSOlMap.featureSource.clear();
	  		DSOlMap.mapconfig = mapconfig;
	  		DSOlMap.view.setCenter(DSOlMap.mapconfig.center);
	  		DSOlMap.view.setZoom(DSOlMap.mapconfig.zoom);
	  		// Remove Features (https://gis.stackexchange.com/questions/251770/how-can-i-clear-a-vector-layer-features-in-openlayers-4)
/*
	  		features = DSOlMap.periLayer.getSource().getFeatures();
		    features.forEach((feature) => {
		        DSOlMap.periLayer.getSource().removeFeature(feature);
		    });
*/
		}
	  	DSOlMap.addPeri(mapconfig);
	  	DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	},

	// ****** Zoomen auf aktiven Perimeter
	zoomToPeri: function () {
		DSOlMap.view.fit(DSOlMap.periLayer.getSource().getExtent(),{duration: 1000});
	},

	// ****** Feature löschen und Zeichentool aktivieren
	deletePeri: function () {
		DSOlMap.removeInteractions();
		// Remove Features (https://gis.stackexchange.com/questions/251770/how-can-i-clear-a-vector-layer-features-in-openlayers-4)
  		features = DSOlMap.periLayer.getSource().getFeatures();
	    features.forEach((feature) => {
	        DSOlMap.periLayer.getSource().removeFeature(feature);
	    });
		if (DSOlMap.mapconfig.perimeter === 'polygon') {
	    	DSOlMap.mapconfig.polygon = [];
    		DSOlMap.map.addInteraction(DSOlMap.drawPoly);
	    } else if (DSOlMap.mapconfig.perimeter === 'box') {
			DSOlMap.mapconfig.box = [];
	    	DSOlMap.map.addInteraction(DSOlMap.drawBox);
	    }
	    DSOlMap.elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
	},

	// ****** Send to elm *******
    updatePerimeter: function (newPeri, fromInteractionString) {
		if (DSOlMap.mapconfig.perimeter === "polygon") {
			DSOlMap.mapconfig.polygon = newPeri;
		} else if (DSOlMap.mapconfig.perimeter === "box"){
			DSOlMap.mapconfig.box = newPeri;
		}
		console.log(fromInteractionString, ': ', newPeri);
		DSOlMap.elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
	},

	// ****** Verhindern, dass nach Doppelklick beim Zeichnen gezoomt wird
	//Setup drawend event handle function
	onFinishDrawing: function (evt) {
		//Call to double click zoom control function to deactivate zoom event
		DSOlMap.controlDoubleClickZoom(false);
		//Delay execution of activation of double click zoom function
		setTimeout(function(){DSOlMap.controlDoubleClickZoom(true);},251);
	},
	//Control active state of double click zoom interaction
	controlDoubleClickZoom: function (active){
	    //Find double click interaction
	    var interactions = DSOlMap.map.getInteractions();
	    for (var i = 0; i < interactions.getLength(); i++) {
	        var interaction = interactions.item(i);
	        if (interaction instanceof ol.interaction.DoubleClickZoom) {
	            interaction.setActive(active);
	        }
	    }
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

	removeInteractions: function () {
		DSOlMap.map.removeInteraction(DSOlMap.drawBox);
		DSOlMap.map.removeInteraction(DSOlMap.select);
		DSOlMap.map.removeInteraction(DSOlMap.modify);
		DSOlMap.map.removeInteraction(DSOlMap.translate);
		DSOlMap.map.removeInteraction(DSOlMap.snap);
		DSOlMap.map.removeInteraction(DSOlMap.boxExtent);
		DSOlMap.map.removeInteraction(DSOlMap.drawPoly);

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
	        zoom: mapconfig.zoom //15
	    });
		DSOlMap.view.on('change', function(e) {
	        DSOlMap.mapconfig.center = e.target.getCenter();
	        DSOlMap.mapconfig.extent = e.target.calculateExtent(DSOlMap.map.getSize());
	        DSOlMap.mapconfig.zoom = DSOlMap.map.getView().getZoom();
	        // ******** sendet die aktualisierte mapconfig nach jeder Änderung an elm
	        console.log("view change: ", DSOlMap.mapconfig.extent.toString(), DSOlMap.mapconfig.center, DSOlMap.mapconfig.zoom);
	        elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
	    });

		DSOlMap.featureSource = new ol.source.Vector({wrapX: false});
		DSOlMap.periLayer = new ol.layer.Vector({
	        source: DSOlMap.featureSource,
	        style: new ol.style.Style({
	            fill: new ol.style.Fill({
	                color: 'rgba(255, 255, 255, 0.3)'
	            }),
	            stroke: new ol.style.Stroke({
	                color: '#9999FF',
	                width: 2
	            }),
	            image: new ol.style.Circle({
	                radius: 7,
	                fill: new ol.style.Fill({
	                    color: '#9999FF'
	                })
	            })
	        })
	    });



	    DSOlMap.boxExtent = new ol.interaction.Extent({
	    	source : DSOlMap.featureSource,
	        //condition: ol.events.condition.platformModifierKeyOnly
	    });
	    DSOlMap.boxExtent.on('extentchanged', function(e) {
	        console.log(e.extent);
	    });

	    // draw box
	    DSOlMap.drawBox = new ol.interaction.Draw({
	    	type : 'Circle',
	    	source : DSOlMap.featureSource,
	    	geometryFunction : ol.interaction.Draw.createBox()
	    });
	    DSOlMap.drawBox.on('drawend', function(e) {
	    	var peri = e.feature.getGeometry().getCoordinates();
	    	DSOlMap.updatePerimeter (peri, 'drawend');
	    	DSOlMap.removeInteractions();
	        DSOlMap.map.addInteraction(DSOlMap.translate);
	    });

	    // draw polygon
	    DSOlMap.drawPoly = new ol.interaction.Draw({
	    	type : 'Polygon',
	    	source : DSOlMap.featureSource
	    });
	    DSOlMap.drawPoly.on('drawend', function(e) {
	    	// stop doubleclick zoom
	    	DSOlMap.onFinishDrawing();

	    	var peri = e.feature.getGeometry().getCoordinates();
	    	DSOlMap.updatePerimeter (peri, 'drawend');
	    	DSOlMap.removeInteractions();
	        DSOlMap.map.addInteraction(DSOlMap.modify);
	    });
	/*
	  	DSOlMap.select = new ol.interaction.Select({
	  		source: DSOlMap.featureSource
	  	});

	  	DSOlMap.snap = new ol.interaction.Snap({
	  		source: DSOlMap.featureSource
	  	});
	*/
	  	// modify
	  	DSOlMap.modify = new ol.interaction.Modify({
	  		source: DSOlMap.featureSource
	  	});
	    DSOlMap.modify.on('modifyend', function(e) {
	    	var peri = e.features.getArray()[0].getGeometry().getCoordinates();
	    	DSOlMap.updatePerimeter (peri, 'modifyend');
	    });

	    // translate
	  	DSOlMap.translate = new ol.interaction.Translate({
	    	source: DSOlMap.featureSource
	    });
	  	DSOlMap.translate.on('translateend', function(e) {
	  		var peri = e.features.getArray()[0].getGeometry().getCoordinates();
	  		DSOlMap.updatePerimeter (peri, 'translateend');
	    });

	  	// create map
		DSOlMap.map = new ol.Map({
	        // target: 'myOlMap',
	        controls: ol.control.defaults().extend([
	          new ol.control.ScaleLine()
	        ]),
	        // layers: [DSOlMap.buildLkLayer(), DSOlMap.buildUpLayer(), DSOlMap.periLayer],
	        layers: [DSOlMap.buildUpLayer(), DSOlMap.periLayer],
	        view: DSOlMap.view
	    });
	    DSOlMap.map.setTarget(document.getElementById('myOlMap'));
	},

	addPeri: function (mapconfig) {
		var feature = null;
		if (mapconfig.perimeter === 'polygon') {
	    	// add polygon to featureSource if present
	    	if (mapconfig.polygon.length > 0) {
	        	feature = new ol.Feature({
					geometry: new ol.geom.Polygon(mapconfig.polygon),
					name: 'polygon'
				});
				feature.setId(12345);
	        	DSOlMap.featureSource.addFeature(feature);
	        	DSOlMap.removeInteractions();
	        	DSOlMap.map.addInteraction(DSOlMap.modify);

	    	} else {
	    		DSOlMap.removeInteractions();
	    		DSOlMap.map.addInteraction(DSOlMap.drawPoly);
	    	}
	    } else if (mapconfig.perimeter === 'box') {
	    	// add box to featureSource if present
	    	if (mapconfig.box.length > 0) {
	        	feature = new ol.Feature({
					geometry: new ol.geom.Polygon(mapconfig.box),
					name: 'box'
				});
				feature.setId(23456);
	        	DSOlMap.featureSource.addFeature(feature);
	        	DSOlMap.removeInteractions();
	        	DSOlMap.map.addInteraction(DSOlMap.translate);

			} else {
				DSOlMap.removeInteractions();
	    		DSOlMap.map.addInteraction(DSOlMap.drawBox);
			}
		} else if (mapconfig.perimeter === 'extent') {
			DSOlMap.mapconfig.extent = DSOlMap.view.calculateExtent(DSOlMap.map.getSize());
			DSOlMap.removeInteractions();
			DSOlMap.elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
	    } else {
	    	DSOlMap.removeInteractions();
	    }
	    if (mapconfig.oltool == "setCenter") {
	    	DSOlMap.map.getView().setCenter(mapconfig.center);
	    	mapconfig.oltool = "none";
	    	DSOlMap.elmApp.ports.mapConfigChanged.send(DSOlMap.mapconfig);
	    }
	}
};
