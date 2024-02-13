(function() { 
	let template = document.createElement("template");
	template.innerHTML = `
		<link rel="stylesheet" href="https://js.arcgis.com/4.15/esri/themes/light/main.css">
		<style>
			#custom-map-view {
				width: 500px;
				height: 500px;
    }
		</style>
		<div id='custom-map-view'></div>
	`;

	class Map extends HTMLElement {
		constructor() {
			super(); 
			//this._shadowRoot = this.attachShadow({mode: "open"});
			this.appendChild(template.content.cloneNode(true));
			this._props = {};
			let that = this;

			require([
                "esri/Map",
                "esri/views/MapView",
                "esri/layers/GeoJSONLayer",
                "esri/layers/support/Field",
                "esri/PopupTemplate"
            ], function(Map, MapView, GeoJSONLayer, Field, PopupTemplate) {

				that._map = new Map({
					basemap: "topo-vector"
                });
			
				that._view = new MapView({
					container: "custom-map-view",
					map: that._map,
					center: [
                        142.7028,
                        -20.9176
                    ],
					zoom: 5
                });

				const template = new PopupTemplate({
					title: "{HHS} ventilators",
					content: "{Measure} ventilators",
					fieldInfos: [
                        {
						fieldName: "Measure",
						format: {
						  digitSeparator: true,
						  places: 0
                            }
                        },
                        {
						fieldName: "Max",
						format: {
						  digitSeparator: true,
						  places: 0
                            }
                        }
                    ]
                })

				const fields = [
					new Field({
					  name: "ObjectID",
					  alias: "ObjectID",
					  type: "oid"
                    }), 
					new Field({
						name: "HHS",
						alias: "HHS",
						type: "string"
                    }), 
					new Field({
					  name: "Measure",
					  alias: "Measure",
					  type: "double"
                    }), 
					new Field({
					  name: "Max",
					  alias: "Max",
					  type: "double"
                    })
                ];

				let renderer = {
					type: "simple", 
					symbol: {
						type: "simple-fill", 
						outline: {
						color: "lightgray",
						width: 0.5
                        }
                    },
					label: "%",
					visualVariables: [
                        {
						type: "color", 
						field: "Measure",
						normalizationField: "Max",
						stops: [
                                {
							value: 0.5, 
							color: "#00FF00",
							label: "50%"
                                },
                                {
							value: 0.9,
							color: "#FF0000",
							label: "90%"
                                }
                            ]
                        }
                    ]
                };
				
				that._spatialLayer = new GeoJSONLayer({
					url: "http://localhost:3000/Map/spatial.json",
					renderer: renderer,
					fields: fields,
					outFields: [
                        "*"
                    ],
					popupTemplate: template
                });


				that._map.add(that._spatialLayer);
				
				that._view.on("click", function(event) {

					that._view.hitTest(event).then(function (response) {
						var regionGraphics = response.results.filter(function (result) {
							return result.graphic.layer === that._spatialLayer;
                        });

						if (regionGraphics.length) {
							const event = new Event("onSelectRegion");
							that._currentSelection = regionGraphics[
                                0
                            ].graphic.attributes['HHS'
                            ]
							that.dispatchEvent(event);
                        } else {
							const event = new Event("onDeselectRegion");
							that._currentSelection = null;
							that.dispatchEvent(event);
                        }
                    });
                });
            });

			/*
			fetch('http://localhost:3000/Map/spatial.json')
				.then(response => response.json())
				.then((data) => {
					console.log(data)
				});
			*/
        }

		getSelection() {
			return this._currentSelection;
        }

		async setDataSource(source) {
			this._dataSource = source;
			let googleResult = await fetch("https://cors-anywhere.herokuapp.com/https://www.rfs.nsw.gov.au/feeds/majorIncidents.json");
			let results = await googleResult.json();
			console.log(results);

			let resultSet = await source.getResultSet();
			const that = this;
			this._spatialLayer.queryFeatures().then(function(mapFeatures){
				const features = mapFeatures.features;

				const edits = {
					updateFeatures: []
                }

				const loc_id = that._props[
                    "locId"
                ] || "";

				let max = 0;
				for(let feature of features) {
					let result = resultSet.find((result) => feature.attributes[loc_id
                    ] == result[loc_id
                    ].id);
					let value = result ? parseFloat(result[
                        "@MeasureDimension"
                    ].rawValue) : null;

					feature.attributes[
                        "Measure"
                    ] = value;
					max = value > max ? value : max;

					edits.updateFeatures.push(feature);
                }

				edits.updateFeatures.forEach((feature) => feature.attributes[
                    "Max"
                ] = max);

				that._spatialLayer.applyEdits(edits)
					.then((editResults) => {
						console.log(editResults);
                })
					.catch((error) => {
						console.log("===============================================");
						console.error(
						  "[ applyEdits ] FAILURE: ",
						  error.code,
						  error.name,
						  error.message
						);
						console.log("error = ", error);
                })
            });
        }

		onCustomWidgetBeforeUpdate(changedProperties) {
			this._props = { ...this._props, ...changedProperties
            };
        }

		onCustomWidgetAfterUpdate(changedProperties) {}
    }

	let scriptSrc = "https://js.arcgis.com/4.15/"
	let onScriptLoaded = function() {
		customElements.define("com-sap-test-map", Map);
    }
    //SHARED FUNCTION: reuse between widgets
    //function(src, callback) {
	let customElementScripts = window.sessionStorage.getItem("customElementScripts") || [];

	let scriptStatus = customElementScripts.find(function(element) {
		return element.src == scriptSrc;
    });

	if (scriptStatus) {
		if(scriptStatus.status == "ready") {
			onScriptLoaded();
        } else {
			scriptStatus.callbacks.push(onScriptLoaded);
        }
    } else {

		let scriptObject = {
            "src": scriptSrc,
            "status": "loading",
            "callbacks": [onScriptLoaded
            ]
        }

		customElementScripts.push(scriptObject);

		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = scriptSrc;
		script.onload = function(){
			scriptObject.status = "ready";
			scriptObject.callbacks.forEach((callbackFn) => callbackFn.call());
        };
		document.head.appendChild(script);
    }
    //} 
    //END SHARED FUNCTION
})();
