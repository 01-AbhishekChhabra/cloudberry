angular.module('cloudberry.map', ['leaflet-directive', 'cloudberry.common','cloudberry.cache'])
  .controller('MapCtrl', function($scope, $rootScope, $window, $http, $compile, cloudberry, leafletData, cloudberryConfig, Cache) { // use $rootScope event to get maptypeChange notification

    cloudberry.parameters.maptype = 'countmap';

    // map change notification
    $rootScope.$on('maptypeChange', function (event, data) {
      switch (cloudberry.parameters.maptype) {
        case 'countmap':
          cleanPointMap();
          setCountMapStyle();
          setInfoControlCountMap();
          cloudberry.query(cloudberry.parameters, cloudberry.queryType);
          break;

        case 'heatmap':
          break;

        case 'pointmap':
          cleanCountMap();
          setPointMapStyle();
          setInfoControlPointMap();
          cloudberry.query(cloudberry.parameters, cloudberry.queryType);
          break;

        default:
          // unrecognized map type
          break;
      }
    });

    // add an alert bar of IE
    if (L.Browser.ie) {
      var alertDiv = document.getElementsByTagName("alert-bar")[0];
      var div = L.DomUtil.create('div', 'alert alert-warning alert-dismissible')
      div.innerHTML = [
        '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>',
        '<strong>Warning! </strong> TwitterMap currently doesn\'t support IE.'
      ].join('');
      div.style.position = 'absolute';
      div.style.top = '0%';
      div.style.width = '100%';
      div.style.zIndex = '9999';
      div.style.fontSize = '23px';
      alertDiv.appendChild(div);
    }

    $scope.result = {};
    $scope.doNormalization = false;
    $scope.doSentiment = false;
    $scope.infoPromp = config.mapLegend;
    $scope.cityIdSet = new Set();

    // map setting
    angular.extend($scope, {
      tiles: {
        name: 'Mapbox',
        url: 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}',
        type: 'xyz',
        options: {
          accessToken: 'pk.eyJ1IjoiamVyZW15bGkiLCJhIjoiY2lrZ2U4MWI4MDA4bHVjajc1am1weTM2aSJ9.JHiBmawEKGsn3jiRK_d0Gw',
          id: 'jeremyli.p6f712pj'
        }
      },
      controls: {
        custom: []
      },
      geojsonData: {},
      polygons: {},
      status: {
        init: true,
        zoomLevel: 4,
        logicLevel: 'state'
      },
      styles: {
        initStyle: {
          weight: 1.5,
          fillOpacity: 0.5,
          color: 'white'
        },
        stateStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        stateUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        countyStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        countyUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        cityStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        hoverStyle: {
          weight: 5,
          color: '#666',
          fillOpacity: 0.5
        },
        colors: [ '#ffffff', '#92d1e1', '#4393c3', '#2166ac', '#f4a582', '#d6604d', '#b2182b'],
        sentimentColors: ['#ff0000', '#C0C0C0', '#00ff00']
      }
    });

    function resetGeoIds(bounds, polygons, idTag) {
      cloudberry.parameters.geoIds = [];
        if (polygons != undefined) {
            polygons.features.forEach(function (polygon) {
                if (bounds._southWest.lat <= polygon.properties.centerLat &&
                    polygon.properties.centerLat <= bounds._northEast.lat &&
                    bounds._southWest.lng <= polygon.properties.centerLog &&
                    polygon.properties.centerLog <= bounds._northEast.lng) {
                    cloudberry.parameters.geoIds.push(polygon.properties[idTag]);
                }
            });
        }
    }

    function resetGeoInfo(level) {
      $scope.status.logicLevel = level;
      cloudberry.parameters.geoLevel = level;
      if ($scope.geojsonData[level])
        resetGeoIds($scope.bounds, $scope.geojsonData[level], level + 'ID');
    }


    // initialize
    $scope.init = function() {
      leafletData.getMap().then(function(map) {
        $scope.map = map;
        $scope.bounds = map.getBounds();
        //making attribution control to false to remove the default leaflet sign in the bottom of map
        map.attributionControl.setPrefix(false);
        map.setView([$scope.lat, $scope.lng],$scope.zoom);
      });

      //Reset Zoom Button
      var button = document.createElement("a");
      var text =  document.createTextNode("Reset");
      button.appendChild(text);
      button.title = "Reset";
      button.href = "#";
      button.style.position = 'inherit';
      button.style.top = '150%';
      button.style.left = '-53%';
      var body = document.getElementsByTagName("search-bar")[0];
      body.appendChild(button);
      button.addEventListener ("click", function() {
        $scope.map.setView([$scope.lat, $scope.lng], 4);
      });

      resetGeoInfo("state");

      //Adjust Map to be County or State
      switch (cloudberry.parameters.maptype) {
        case 'countmap':
          setInfoControlCountMap();
          break;
        case 'heatmap':
          setInfoControlHeatMap();
          break;
        case 'pointmap':
          setInfoControlPointMap();
          break;
        default:
          break;
      }
    };
    
    function resetPolygonLayers() {
      if ($scope.polygons.statePolygons) {
        $scope.polygons.statePolygons.setStyle($scope.styles.stateStyle);
      }
      if ($scope.polygons.countyPolygons) {
        $scope.polygons.countyPolygons.setStyle($scope.styles.countyStyle);
      }
      if ($scope.polygons.cityPolygons) {
        $scope.polygons.cityPolygons.setStyle($scope.styles.cityStyle);
      }
      if ($scope.polygons.stateUpperPolygons) {
        $scope.polygons.stateUpperPolygons.setStyle($scope.styles.stateUpperStyle);
      }
      if ($scope.polygons.countyUpperPolygons) {
        $scope.polygons.countyUpperPolygons.setStyle($scope.styles.countyUpperStyle);
      }
    }
    
    function setCountMapStyle() {
      $scope.styles = {
        initStyle: {
          weight: 1.5,
          fillOpacity: 0.5,
          color: 'white'
        },
        stateStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        stateUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        countyStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        countyUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        cityStyle: {
          fillColor: '#f7f7f7',
          weight: 1.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0.5
        },
        hoverStyle: {
          weight: 5,
          color: '#666',
          fillOpacity: 0.5
        },
        colors: [ '#ffffff', '#92d1e1', '#4393c3', '#2166ac', '#f4a582', '#d6604d', '#b2182b'],
        sentimentColors: ['#ff0000', '#C0C0C0', '#00ff00']
      };
      
      resetPolygonLayers();
    }
    
    function setPointMapStyle() {
      $scope.styles = {
        initStyle: {
          weight: 0.5,
          fillOpacity: 0,
          color: 'white'
        },
        stateStyle: {
          fillColor: '#f7f7f7',
          weight: 0.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0
        },
        stateUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 0.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0
        },
        countyStyle: {
          fillColor: '#f7f7f7',
          weight: 0.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0
        },
        countyUpperStyle: {
          fillColor: '#f7f7f7',
          weight: 0.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0
        },
        cityStyle: {
          fillColor: '#f7f7f7',
          weight: 0.5,
          opacity: 1,
          color: '#92d1e1',
          fillOpacity: 0
        },
        hoverStyle: {
          weight: 0.7,
          color: '#666',
          fillOpacity: 0
        },
        colors: [ '#ffffff', '#92d1e1', '#4393c3', '#2166ac', '#f4a582', '#d6604d', '#b2182b'],
        sentimentColors: ['#ff0000', '#C0C0C0', '#00ff00']
      };
      
      resetPolygonLayers();
    }

    function cleanCountMap() {

      function removeMapControl(name){
        var ctrlClass = $("."+name);
        if (ctrlClass) {
          ctrlClass.remove();
        }
      }

      // remove CountMap controls
      removeMapControl('legend');
      removeMapControl('normalize');
      removeMapControl('sentiment');

    }

    function setInfoControlCountMap() {
      // Interaction function
      function highlightFeature(leafletEvent) {
        if (cloudberry.parameters.maptype == 'countmap'){
          var layer = leafletEvent.target;
          layer.setStyle($scope.styles.hoverStyle);
          if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
          }
          $scope.selectedPlace = layer.feature;
        }
      }

      function resetHighlight(leafletEvent) {
        if (cloudberry.parameters.maptype == 'countmap'){
          var style;
          if (!$scope.status.init){
            style = {
              weight: 1.5,
              fillOpacity: 0.5,
              color: '#92d1e1'
            };
          }
          else {
            style = {
              weight: 1.5,
              fillOpacity: 0.5,
              color: '#92d1e1'
            };
          }
          if (leafletEvent){
            leafletEvent.target.setStyle(style);
          }
        }
      }

      function zoomToFeature(leafletEvent) {
        if (leafletEvent)
          $scope.map.fitBounds(leafletEvent.target.getBounds());
      }

      function onEachFeature(feature, layer) {
        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
          click: zoomToFeature
        });
      }

      // add info control
      var info = L.control();

      info.onAdd = function() {
        this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
        this._div.style.margin = '20% 0 0 0';
        this._div.innerHTML = [
          '<h4>{{ infoPromp }} by {{ status.logicLevel }}</h4>',
          '<b>{{ selectedPlace.properties.name || "No place selected" }}</b>',
          '<br/>',
          '{{ infoPromp }} {{ selectedPlace.properties.countText || "0" }}'
        ].join('');
        $compile(this._div)($scope);
        return this._div;
      };

      info.options = {
        position: 'topleft'
      };
      $scope.controls.custom.push(info);

      loadGeoJsonFiles(onEachFeature);

      // remove original zoomfunction associated with zoom event
      if ($scope.zoomfunction) {
        $scope.zoomfunction()
      }
      // add new zoomfunction
      $scope.zoomfunction = $scope.$on("leafletDirectiveMap.zoomend", function() {
        if ($scope.map) {
          $scope.status.zoomLevel = $scope.map.getZoom();
          $scope.bounds = $scope.map.getBounds();
          if($scope.status.zoomLevel > 9) {
            resetGeoInfo("city");
            if ($scope.polygons.statePolygons) {
              $scope.map.removeLayer($scope.polygons.statePolygons);
            }
            if ($scope.polygons.countyPolygons) {
              $scope.map.removeLayer($scope.polygons.countyPolygons);
            }
            if ($scope.polygons.stateUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.stateUpperPolygons);
            }
            $scope.map.addLayer($scope.polygons.countyUpperPolygons);
            loadCityJsonByBound(onEachFeature);
          } else if ($scope.status.zoomLevel > 5) {
            resetGeoInfo("county");
            if (!$scope.status.init) {
              cloudberry.query(cloudberry.parameters);
            }
            if($scope.polygons.statePolygons) {
              $scope.map.removeLayer($scope.polygons.statePolygons);
            }
            if($scope.polygons.cityPolygons) {
              $scope.map.removeLayer($scope.polygons.cityPolygons);
            }
            if($scope.polygons.countyUpperPolygons){
              $scope.map.removeLayer($scope.polygons.countyUpperPolygons);
            }
            $scope.map.addLayer($scope.polygons.stateUpperPolygons);
            $scope.map.addLayer($scope.polygons.countyPolygons);
          } else if ($scope.status.zoomLevel <= 5) {
            resetGeoInfo("state");
            if (!$scope.status.init) {
              cloudberry.query(cloudberry.parameters);
            }
            if($scope.polygons.countyPolygons) {
              $scope.map.removeLayer($scope.polygons.countyPolygons);
            }
            if($scope.polygons.cityPolygons) {
              $scope.map.removeLayer($scope.polygons.cityPolygons);
            }
            if ($scope.polygons.stateUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.stateUpperPolygons);
            }
            if($scope.polygons.countyUpperPolygons){
              $scope.map.removeLayer($scope.polygons.countyUpperPolygons);
            }
            if ($scope.polygons.statePolygons) {
                $scope.map.addLayer($scope.polygons.statePolygons);
            }
          }
        }
      });

      // remove original dragfunction associated with drag event
      if ($scope.dragfunction) {
        $scope.dragfunction()
      }
      // add new dragfunction
      $scope.dragfunction = $scope.$on("leafletDirectiveMap.dragend", function() {
        if (!$scope.status.init) {
          $scope.bounds = $scope.map.getBounds();
          var geoData;
          if ($scope.status.logicLevel === 'state') {
            geoData = $scope.geojsonData.state;
          } else if ($scope.status.logicLevel === 'county') {
            geoData = $scope.geojsonData.county;
          } else if ($scope.status.logicLevel === 'city') {
            geoData = $scope.geojsonData.city;
          } else {
            console.error("Error: Illegal value of logicLevel, set to default: state");
            $scope.status.logicLevel = 'state';
            geoData = $scope.geojsonData.state;
          }
        }
        if ($scope.status.logicLevel === 'city') {
          loadCityJsonByBound(onEachFeature);
        } else {
          resetGeoIds($scope.bounds, geoData, $scope.status.logicLevel + "ID");
          cloudberry.parameters.geoLevel = $scope.status.logicLevel;
          cloudberry.query(cloudberry.parameters);
        }
      });

    }

    function setInfoControlHeatMap() {
      //TODO For HeatMap use later.
    }

    function cleanPointMap() {
      $scope.points = [];
      $scope.pointIDs = [];
      //$scope.map.off('mousemove', $scope.onMapMouseMove);
      if($scope.pointsLayer != null) {
        $scope.map.removeLayer($scope.pointsLayer);
        $scope.pointsLayer = null;
      }
      if ($scope.currentMarker != null) {
        $scope.map.removeLayer($scope.currentMarker);
        $scope.currentMarker = null;
      }
    }

    function setInfoControlPointMap() {

      function zoomToFeature(leafletEvent) {
          if (leafletEvent)
              $scope.map.fitBounds(leafletEvent.target.getBounds());
      }

      function onEachFeature(feature, layer) {
        layer.on({
          click: zoomToFeature
        });
      }

      loadGeoJsonFiles(onEachFeature);
      
      if ($scope.zoomfunction) {
        $scope.zoomfunction()
      }
      $scope.zoomfunction = $scope.$on("leafletDirectiveMap.zoomend", function () {
        if ($scope.map) {
          $scope.status.zoomLevel = $scope.map.getZoom();
          $scope.bounds = $scope.map.getBounds();
          if ($scope.status.zoomLevel > 9) {
            resetGeoInfo("city");
            if ($scope.polygons.statePolygons) {
              $scope.map.removeLayer($scope.polygons.statePolygons);
            }
            if ($scope.polygons.countyPolygons) {
              $scope.map.removeLayer($scope.polygons.countyPolygons);
            }
            if ($scope.polygons.stateUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.stateUpperPolygons);
            }
            $scope.map.addLayer($scope.polygons.countyUpperPolygons);
            loadCityJsonByBound(onEachFeature);
          } else if ($scope.status.zoomLevel > 5) {
            resetGeoInfo("county");
            if (!$scope.status.init) {
              cloudberry.query(cloudberry.parameters);
            }
            if ($scope.polygons.statePolygons) {
              $scope.map.removeLayer($scope.polygons.statePolygons);
            }
            if ($scope.polygons.cityPolygons) {
              $scope.map.removeLayer($scope.polygons.cityPolygons);
            }
            if ($scope.polygons.countyUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.countyUpperPolygons);
            }
            $scope.map.addLayer($scope.polygons.stateUpperPolygons);
            $scope.map.addLayer($scope.polygons.countyPolygons);
          } else if ($scope.status.zoomLevel <= 5) {
            resetGeoInfo("state");
            if (!$scope.status.init) {
              cloudberry.query(cloudberry.parameters);
            }
            if ($scope.polygons.countyPolygons) {
              $scope.map.removeLayer($scope.polygons.countyPolygons);
            }
            if ($scope.polygons.cityPolygons) {
              $scope.map.removeLayer($scope.polygons.cityPolygons);
            }
            if ($scope.polygons.stateUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.stateUpperPolygons);
            }
            if ($scope.polygons.countyUpperPolygons) {
              $scope.map.removeLayer($scope.polygons.countyUpperPolygons);
            }
            if ($scope.polygons.statePolygons) {
              $scope.map.addLayer($scope.polygons.statePolygons);
            }
          }
        }

        //For rescaling the metric of distance between points and mouse cursor.
        $scope.currentBounds = $scope.map.getBounds();
        $scope.scale_x = Math.abs($scope.currentBounds.getEast() - $scope.currentBounds.getWest());
        $scope.scale_y = Math.abs($scope.currentBounds.getNorth() - $scope.currentBounds.getSouth());
      });

      if ($scope.dragfunction) {
        $scope.dragfunction()
      }
      $scope.dragfunction = $scope.$on("leafletDirectiveMap.dragend", function () {
        if (!$scope.status.init) {
          $scope.bounds = $scope.map.getBounds();
          var geoData;
          if ($scope.status.logicLevel === 'state') {
            geoData = $scope.geojsonData.state;
          } else if ($scope.status.logicLevel === 'county') {
            geoData = $scope.geojsonData.county;
          } else if ($scope.status.logicLevel === 'city') {
            geoData = $scope.geojsonData.city;
          } else {
            console.error("Error: Illegal value of logicLevel, set to default: state");
            $scope.status.logicLevel = 'state';
            geoData = $scope.geojsonData.state;
          }
        }
        if ($scope.status.logicLevel === 'city') {
            loadCityJsonByBound(onEachFeature, false);
        } else {
          resetGeoIds($scope.bounds, geoData, $scope.status.logicLevel + "ID");
          cloudberry.parameters.geoLevel = $scope.status.logicLevel;
          cloudberry.query(cloudberry.parameters);
        }
      });

      $scope.mouseOverPointI = 0;
    }

    function setCenterAndBoundry(features) {

      for(var id in features){
        var minLog = Number.POSITIVE_INFINITY;
        var maxLog = Number.NEGATIVE_INFINITY;
        var minLat = Number.POSITIVE_INFINITY;
        var maxLat = Number.NEGATIVE_INFINITY;
        if(features[id].geometry.type === "Polygon") {
          features[id].geometry.coordinates[0].forEach(function(pair) {
            minLog = Math.min(minLog, pair[0]);
            maxLog = Math.max(maxLog, pair[0]);
            minLat = Math.min(minLat, pair[1]);
            maxLat = Math.max(maxLat, pair[1]);
          });
        } else if( features[id].geometry.type === "MultiPolygon") {
          features[id].geometry.coordinates.forEach(function(array){
            array[0].forEach(function(pair){
              minLog = Math.min(minLog, pair[0]);
              maxLog = Math.max(maxLog, pair[0]);
              minLat = Math.min(minLat, pair[1]);
              maxLat = Math.max(maxLat, pair[1]);
            });
          });
        }
        features[id].properties["centerLog"] = (maxLog + minLog) / 2;
        features[id].properties["centerLat"] = (maxLat + minLat) / 2;
      }
    }
    // load geoJson
    function loadGeoJsonFiles(onEachFeature) {
      if (typeof($scope.polygons.statePolygons) === "undefined" || $scope.polygons.statePolygons == null){
        $http.get("assets/data/state.json")
        .success(function(data) {
          $scope.geojsonData.state = data;
          $scope.polygons.statePolygons = L.geoJson(data, {
            style: $scope.styles.stateStyle,
            onEachFeature: onEachFeature
          });
          $scope.polygons.stateUpperPolygons = L.geoJson(data, {
            style: $scope.styles.stateUpperStyle
          });
          setCenterAndBoundry($scope.geojsonData.state.features);
          $scope.polygons.statePolygons.addTo($scope.map);
        })
        .error(function(data) {
          console.error("Load state data failure");
        });
      }
      if (typeof($scope.polygons.countyPolygons) === "undefined" || $scope.polygons.countyPolygons == null){
        $http.get("assets/data/county.json")
        .success(function(data) {
          $scope.geojsonData.county = data;
          $scope.polygons.countyPolygons = L.geoJson(data, {
            style: $scope.styles.countyStyle,
            onEachFeature: onEachFeature
          });
          $scope.polygons.countyUpperPolygons = L.geoJson(data, {
            style: $scope.styles.countyUpperStyle
          });
          setCenterAndBoundry($scope.geojsonData.county.features);
        })
        .error(function(data) {
          console.error("Load county data failure");
        });
      }
    }

    function loadCityJsonByBound(onEachFeature){

      var bounds = $scope.map.getBounds();
      var rteBounds = "city/" + bounds._northEast.lat + "/" + bounds._southWest.lat + "/" + bounds._northEast.lng + "/" + bounds._southWest.lng;

        // Caching feature only works when the given threshold is greater than zero.
        if (cloudberryConfig.cacheThreshold > 0) {
            Cache.getCityPolygonsFromCache(rteBounds).done(function(data) {


                //set center and boundary done by Cache
                if (!$scope.status.init) {
                    resetGeoIds($scope.bounds, data, 'cityID');
                    cloudberry.parameters.geoLevel = 'city';
                    cloudberry.query(cloudberry.parameters);
                }

                $scope.status.logicLevel = 'city';

                // initializes the $scope.geojsonData.city and $scope.cityIdSet when first time zoom in
                if(typeof $scope.polygons.cityPolygons === 'undefined'){
                    $scope.geojsonData.city = data;
                    $scope.polygons.cityPolygons = L.geoJson(data, {
                      style: $scope.styles.cityStyle,
                      onEachFeature: onEachFeature
                    });

                    for (i = 0; i < $scope.geojsonData.city.features.length; i++) {
                        $scope.cityIdSet.add($scope.geojsonData.city.features[i].properties.cityID);
                    }
                } else {
                    // compares the current region's cityIds with previously stored cityIds
                    // stores the new delta cities' ID and polygon info
                    // add the new polygons as GeoJson objects incrementally on the layer

                    for (i = 0; i < data.features.length; i++) {
                        if (!$scope.cityIdSet.has(data.features[i].properties.cityID)) {
                            $scope.geojsonData.city.features.push(data.features[i]);
                            $scope.cityIdSet.add(data.features[i].properties.cityID);
                            $scope.polygons.cityPolygons.addData(data.features[i]);
                        }
                    }
                }

                // To add the city level map only when it doesn't exit
                if(!$scope.map.hasLayer($scope.polygons.cityPolygons)){
                    $scope.map.addLayer($scope.polygons.cityPolygons);
                }
            });
        } else {
            // No caching used here.
            $http.get(rteBounds)
                .success(function (data) {
                    $scope.geojsonData.city = data;
                    if ($scope.polygons.cityPolygons) {
                        $scope.map.removeLayer($scope.polygons.cityPolygons);
                    }
                    $scope.polygons.cityPolygons = L.geoJson(data, {
                        style: $scope.styles.cityStyle,
                        onEachFeature: onEachFeature
                    });
                    setCenterAndBoundry($scope.geojsonData.city.features);
                    resetGeoInfo("city");
                    if (!$scope.status.init) {
                        cloudberry.query(cloudberry.parameters);
                    }
                    $scope.map.addLayer($scope.polygons.cityPolygons);
                })
                .error(function (data) {
                    console.error("Load city data failure");
                });
        }
    }


    /**
     * Update map based on a set of spatial query result cells
     * @param    result  =>  mapPlotData, an array of coordinate and weight objects
     */
    function drawCountMap(result) {

      var colors = $scope.styles.colors;
      var sentimentColors = $scope.styles.sentimentColors;
      var normalizedCountMax = 0,
          normalizedCountMin = 0,
          intervals = colors.length - 1,
          difference = 0;

      function getSentimentColor(d) {
        if( d < cloudberryConfig.sentimentUpperBound / 3) {    // 1/3
          return sentimentColors[0];
        } else if( d < 2 * cloudberryConfig.sentimentUpperBound / 3){    // 2/3
          return sentimentColors[1];
        } else{     // 3/3
          return sentimentColors[2];
        }
      }

      function getNormalizedCountColor(d) {
        var i = 1;
        for (; i <= intervals; i++){
          if ( d <= normalizedCountMin + ((i * difference) / intervals)){  // bound = min + (i / 6) * difference
            return colors[i];
          }
        }
        return colors[intervals]; // in case of max
      }

      function getUnnormalizedCountColor(d) {
        if(!d || d <= 0) {
          d = 0;
        } else if (d ===1 ){
          d = 1;
        } else {
          d = Math.ceil(Math.log10(d));
          if(d <= 0) // treat smaller counts the same as 0
            d = 0
        }
        d = Math.min(d, colors.length-1);
        return colors[d];
      }

      function getColor(d) {
        if($scope.doSentiment)  // 0 <= d <= 4
          return getSentimentColor(d);
        else if($scope.doNormalization)
          return getNormalizedCountColor(d);
        else
          return getUnnormalizedCountColor(d);
      }

      function style(feature) {
        if (!feature.properties.count || feature.properties.count === 0){
          return {
            fillColor: '#f7f7f7',
            weight: 1.5,
            opacity: 1,
            color: '#92d1e1',
            fillOpacity: 0.5
          };
        } else {
          return {
            fillColor: getColor(feature.properties.count),
            weight: 1.5,
            opacity: 1,
            color: '#92d1e1',
            fillOpacity: 0.5
          };
        }
      }

      function setNormalizedCountText(geo){
        // beautify 0.0000123 => 1.23e-5, 1.123 => 1.1
        if(geo["properties"]["count"] < 1){
          geo["properties"]["countText"] = geo["properties"]["count"].toExponential(1);
        } else{
          geo["properties"]["countText"] = geo["properties"]["count"].toFixed(1);
        }
        geo["properties"]["countText"] += cloudberryConfig.normalizationUpscaleText; // "/M"
      }

      function resetCount(geo) {
        if (geo['properties']['count'])
          geo['properties']['count'] = 0;
        if (geo['properties']['countText'])
          geo['properties']['countText'] = "";
      }

      function setNormalizedCount(geo, r){
        var normalizedCount = r['count'] / r['population'] * cloudberryConfig.normalizationUpscaleFactor;
        geo['properties']['count'] = normalizedCount;
        if(normalizedCount > normalizedCountMax)  // update max to enable dynamic legends
          normalizedCountMax = normalizedCount;
        setNormalizedCountText(geo);
      }

      function setUnnormalizedCount(geo ,r) {
        geo['properties']['count'] = r['count'];
        geo['properties']['countText'] = geo['properties']['count'].toString();
      }

      function updateTweetCountInGeojson(){
        var level = $scope.status.logicLevel;
        var geojsonData = $scope.geojsonData[level];
        if(geojsonData){
          angular.forEach(geojsonData['features'], function (geo) {
            resetCount(geo);
            angular.forEach(result, function (r) {
              if (r[level] === geo['properties'][level+"ID"]){
                if($scope.doSentiment){
                  // sentimentScore for all the tweets in the same polygon / number of tweets with the score
                  geo['properties']['count'] = r['sentimentScoreSum'] / r['sentimentScoreCount'];
                  geo["properties"]["countText"] = geo["properties"]["count"].toFixed(1);
                } else if ($scope.doNormalization) {
                  setNormalizedCount(geo, r);
                } else{
                  setUnnormalizedCount(geo, r);
                }
              }
            });
          });
          difference = normalizedCountMax - normalizedCountMin;  // to enable dynamic legend for normalization
          // draw
          $scope.polygons[level+"Polygons"].setStyle(style);
        }
      }

      // Loop through each result and update its count information on its associated geo record
      updateTweetCountInGeojson();

      /**
       * add information control: legend, toggle
       * */

      function addMapControl(name, position, initDiv, initJS){
        var ctrlClass = $("."+name);
        if (ctrlClass) {
          ctrlClass.remove();
        }

        $scope[name]= L.control({
          position: position
        });

        $scope[name].onAdd = function() {
          var div = L.DomUtil.create('div', 'info ' + name);
          initDiv(div);
          return div;
        };
        if ($scope.map) {
          $scope[name].addTo($scope.map);
          if (initJS)
            initJS();
        }
      }

      function initNormalize(div) {
        if($scope.doNormalization)
          div.innerHTML = '<p>Normalize</p><input id="toggle-normalize" checked type="checkbox">';
        else
          div.innerHTML = '<p>Normalize</p><input id="toggle-normalize" type="checkbox">';
      }

      function initNormalizeToggle() {
        var toggle = $('#toggle-normalize');
        toggle.bootstrapToggle({
          on: "By Population"
        });
        if($scope.doSentiment){
          toggle.bootstrapToggle('off');
          toggle.bootstrapToggle('disable');
        }
      }

      function initSentiment(div) {
        if($scope.doSentiment)
          div.innerHTML = '<p>Sentiment Analysis</p><input id="toggle-sentiment" checked type="checkbox">';
        else
          div.innerHTML = '<p>Sentiment Analysis</p><input id="toggle-sentiment" type="checkbox">';
      }

      function initSentimentToggle() {
        $('#toggle-sentiment').bootstrapToggle({
          on: "By OpenNLP"
        });
      }

      function setSentimentLegend(div) {
        div.setAttribute("title", "Sentiment Score: Negative(0)-Positive(4)");  // add tool-tips for the legend
        div.innerHTML +=
          '<i style="background:' + getColor(1) + '"></i>Negative<br>';
        div.innerHTML +=
          '<i style="background:' + getColor(2) + '"></i>Neutral<br>';
        div.innerHTML +=
          '<i style="background:' + getColor(3) + '"></i>Positive<br>';
      }

      function setGrades(grades) {
        var i = 0;
        for(; i < grades.length; i++){
          if ($scope.doNormalization)
            grades[i] = normalizedCountMin + ((i * difference) / intervals);
          else
            grades[i] = Math.pow(10, i);
        }
      }

      function getGradesNames(grades) {
        return grades.map( function(d) {
          var returnText = "";
          if (d < 1000){
            returnText = d.toFixed();
          } else if (d < 1000 * 1000) {
            returnText = (d / 1000).toFixed() + "K";
          } else if (d < 1000 * 1000 * 1000) {
            returnText = (d / 1000 / 1000).toFixed() + "M";
          } else{
            returnText = (d / 1000 / 1000).toFixed() + "M+";
          }
          if($scope.doNormalization)
            return returnText + cloudberryConfig.normalizationUpscaleText; //["1/M", "10/M", "100/M", "1K/M", "10K/M", "100K/M"];
          else
            return returnText; //["1", "10", "100", "1K", "10K", "100K"];
        });
      }

      function setCountLegend(div) {
        var grades = new Array(colors.length -1); //[1, 10, 100, 1000, 10000, 100000]
        setGrades(grades);
        var gName  = getGradesNames(grades);
        if($scope.doNormalization)
          div.setAttribute("title", "# of Tweets per Million People");  // add tool-tips for the legend to explain the meaning of "M"
        // loop through our density intervals and generate a label with a colored square for each interval
        i = 1;
        for (; i < grades.length; i++) {
          div.innerHTML +=
            '<i style="background:' + getColor(grades[i]) + '"></i>' + gName[i-1] + '&ndash;' + gName[i] + '<br>';
        }
        if ($scope.doNormalization)
          div.innerHTML += '<i style="background:' + getColor(grades[i-1] + ((difference) / intervals)) + '"></i> ' + gName[i-1] + '+';
        else
          div.innerHTML += '<i style="background:' + getColor(grades[i-1]*10) + '"></i> ' + gName[i-1] + '+';
      }

      function initLegend(div) {
        if($scope.doSentiment){
          setSentimentLegend(div);
        } else {
          setCountLegend(div);
        }
      }

      // add legend
      addMapControl('legend', 'topleft', initLegend, null);

      // add toggle normalize
      addMapControl('normalize', 'topleft', initNormalize, initNormalizeToggle);

      // add toggle sentiment analysis
      if(cloudberryConfig.sentimentEnabled)
        addMapControl('sentiment', 'topleft', initSentiment, initSentimentToggle);

    }

    // function for drawing heatmap
    function drawHeatMap(result) {
    }

    // function for drawing pointmap
    function drawPointMap(result) {

      if ($scope.currentMarker != null) {
        $scope.map.removeLayer($scope.currentMarker);
      }

      //For randomize coordinates by bounding_box
      //TODO Should be reused by HeatMap in HeatMap PR.
      var gseed;

      function CustomRandom() {
        var x = Math.sin(gseed++) * 10000;
        return x - Math.floor(x);
      }

      function randomNorm(mean, stdev) {
        return mean + (((CustomRandom() + CustomRandom() + CustomRandom() + CustomRandom() + CustomRandom() + CustomRandom()) - 3) / 3) * stdev;
      }

      function rangeRandom(seed, minV, maxV){
        gseed = seed;
        var ret = randomNorm((minV + maxV) / 2, (maxV - minV) / 16);
        return ret;
      }

      //To initialize the points layer
      if (!$scope.pointsLayer) {
        $scope.pointsLayer = new L.TileLayer.MaskCanvas({
          opacity: 0.8,
          radius: 1.2,//80,
          useAbsoluteRadius: false,//true,
          color: '#00aced',//'#0084b4'
          noMask: true,
          lineColor: '#00aced'//'#00aced'
        });

        $scope.map.addLayer($scope.pointsLayer);

        //Create a new event called 'mouseintent' by listening to 'mousemove'.
        $scope.map.on('mousemove', onMapMouseMove);
        var timer = null;
        //If user hang the mouse cursor for 300ms, fire a 'mouseintent' event.
        function onMapMouseMove(e) {
          var duration = 300;
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
          timer = setTimeout(L.Util.bind(function() {
            this.fire('mouseintent', {
              latlng : e.latlng,
              layer : e.layer
            });
            timer = null;
          }, this), duration);
        }

        $scope.currentBounds = null;
        $scope.scale_x = 0;
        $scope.scale_y = 0;

        //To generate Tweet Popup content from Twitter API (oembed.json?) response JSON
        function translateOembedTweet(tweetJSON) {
          var userName = "";
          try {
            userName = tweetJSON.author_name;
          }
          catch (e){
            console.log("author_name missing in this Tweet.:" + e.message);
          }

          var userLink = "";
          try {
            userLink = tweetJSON.author_url;
          }
          catch (e) {
            console.log("author_url missing in this Tweet.:" + e.message);
          }

          var tweetLink = "";
          try {
            tweetLink = tweetJSON.url;
          }
          catch (e){
            console.log("url missing in this Tweet.:" + e.message);
          }

          var tweetText = "";
          try {
            var tweetHtml = new DOMParser().parseFromString(tweetJSON.html, 'text/html');
            tweetText = tweetHtml.getElementsByTagName('p')[0].innerHTML;
          }
          catch (e){
            console.log("html missing in this Tweet.:" + e.message);
          }

          var tweetTemplate = "\n"
            + "<div class=\"tweet\">\n "
            + "  <div class=\"tweet-body\">"
            + "    <div class=\"user-info\"> "
            + "      <span class=\"name\"> "
            + "        <a href=\""
            + userLink
            + "        \"> "
            + "@"
            + userName
            + "        </a>"
            + "      </span> "
            + "    </div>\n	"
            + "    <div class=\"tweet-text\">"
            + tweetText
            + "\n &nbsp;&nbsp;<a href=\""
            + tweetLink
            + "      \"> "
            + "[more]..."
            + "      </a>"
            + "    </div>\n	 "
            + "  </div>\n	"
            + "</div>\n";

          return tweetTemplate;
        }

        $scope.map.on('mouseintent', onMapMouseIntent);

        $scope.currentMarker = null;
        $scope.points = [];
        $scope.pointIDs = [];

        function onMapMouseIntent(e) {
          //make sure the scale metrics are updated
          if ($scope.currentBounds == null || $scope.scale_x == 0 || $scope.scale_y == 0) {
            $scope.currentBounds = $scope.map.getBounds();
            $scope.scale_x = Math.abs($scope.currentBounds.getEast()
              - $scope.currentBounds.getWest());
            $scope.scale_y = Math.abs($scope.currentBounds.getNorth()
              - $scope.currentBounds.getSouth());
          }

          var i = isMouseOverAPoint(e.latlng.lat, e.latlng.lng);

          //if mouse over a new point, show the Popup Tweet!
          if (i >= 0 && $scope.mouseOverPointI != i) {
            $scope.mouseOverPointI = i;
            //(1) If previous Marker is not null, destroy it.
            if ($scope.currentMarker != null) {
              $scope.map.removeLayer($scope.currentMarker);
            }
            //(2) Create a new Marker to highlight the point.
            $scope.currentMarker = L.circleMarker(e.latlng, {
              radius : 6,
              color : '#0d3e99',
              weight : 1.5,
              fillColor : '#b8e3ff',
              fillOpacity : 1.0
            }).addTo($scope.map);
            //(3) Send request to twitter.com for the oembed json tweet content.
            var url = "https://api.twitter.com/1/statuses/oembed.json?callback=JSON_CALLBACK&id=" + $scope.pointIDs[i];
            $http.jsonp(url).success(function (data) {
              var tweetContent = translateOembedTweet(data);
              $scope.popUpTweet = L.popup({maxWidth:300, minWidth:300, maxHight:300});
              $scope.popUpTweet.setContent(tweetContent);
              $scope.currentMarker.bindPopup($scope.popUpTweet).openPopup();
            }).
            error(function() {
              var tweetContent = "Sorry! It seems the tweet with that ID has been deleted by the author.@_@";
              $scope.popUpTweet = L.popup({maxWidth:300, minWidth:300, maxHight:300});
              $scope.popUpTweet.setContent(tweetContent);
              $scope.currentMarker.bindPopup($scope.popUpTweet).openPopup();
            });
          }
        }

        function isMouseOverAPoint(x, y) {
          for (var i = 0; i < $scope.points.length; i += 1) {
            var dist_x = Math.abs(($scope.points[i][0] - x) / $scope.scale_x);
            var dist_y = Math.abs(($scope.points[i][1] - y) / $scope.scale_y);
            if (dist_x <= 0.01 && dist_y <= 0.01) {
              return i;
            }
          }
          return -1;
        }
      }

      //Update the points data
      if (result.length > 0){
        $scope.points = [];
        $scope.pointIDs = [];
        for (var i = 0; i < result.length; i++) {
          if (result[i].hasOwnProperty('coordinate')){
            $scope.points.push([result[i].coordinate[1], result[i].coordinate[0]]);
          }
          else if (result[i].hasOwnProperty('place.bounding_box')){
            $scope.points.push([rangeRandom(result[i].id, result[i]["place.bounding_box"][0][1], result[i]["place.bounding_box"][1][1]), rangeRandom(result[i].id + 79, result[i]["place.bounding_box"][0][0], result[i]["place.bounding_box"][1][0])]);
          }
          $scope.pointIDs.push(result[i].id);
        }
        $scope.pointsLayer.setData($scope.points);
      }
      else {
        $scope.points = [];
        $scope.pointIDs = [];
        $scope.pointsLayer.setData($scope.points);
      }
    }

    $scope.$watchCollection(
      function() {
        return {
          'mapResult': cloudberry.mapResult,
          'pointsResult': cloudberry.pointsResult,
          'totalCount': cloudberry.totalCount,
          'doNormalization': $('#toggle-normalize').prop('checked'),
          'doSentiment': $('#toggle-sentiment').prop('checked')
        };
      },

      function(newResult, oldValue) {
        switch (cloudberry.parameters.maptype) {
          case 'countmap':
            if (newResult['mapResult'] !== oldValue['mapResult']) {
              $scope.result = newResult['mapResult'];
              if (Object.keys($scope.result).length !== 0) {
                $scope.status.init = false;
                drawCountMap($scope.result);
              } else {
                drawCountMap($scope.result);
              }
            }
            if (newResult['totalCount'] !== oldValue['totalCount']) {
              $scope.totalCount = newResult['totalCount'];
            }
            if(newResult['doNormalization'] !== oldValue['doNormalization']) {
              $scope.doNormalization = newResult['doNormalization'];
              drawCountMap($scope.result);
            }
            if(newResult['doSentiment'] !== oldValue['doSentiment']) {
              $scope.doSentiment = newResult['doSentiment'];
              if($scope.doSentiment) {
                $scope.infoPromp = "Score";  // change the info promp
              } else {
                $scope.infoPromp = config.mapLegend;
              }
              drawCountMap($scope.result);
            }
            break;

          case 'heatmap':
            break;

          case 'pointmap':
            if (newResult['pointsResult'] !== oldValue['pointsResult']) {
                $scope.result = newResult['pointsResult'];
                if (Object.keys($scope.result).length !== 0) {
                    $scope.status.init = false;
                    drawPointMap($scope.result);
                } else {
                    drawPointMap($scope.result);
                }
            }
            if (newResult['totalCount'] !== oldValue['totalCount']) {
                $scope.totalCount = newResult['totalCount'];
            }
            break;

          default:
            // unrecognized map type
            break;
        }
      }
    );
  })
  .directive("map", function () {
    return {
      restrict: 'E',
      scope: {
        lat: "=",
        lng: "=",
        zoom: "="
      },
      controller: 'MapCtrl',
      template:[
        '<leaflet lf-center="center" tiles="tiles" events="events" controls="controls" width="100%" height="100%" ng-init="init()"></leaflet>'
      ].join('')
    };
  });
