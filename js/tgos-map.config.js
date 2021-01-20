const TGMap = (function (document) {
    'use strict';

    let pMap;

    return {
        init: function() {
            pMap = new TGOS.TGOnlineMap(document.getElementById('tgMap'), TGOS.TGCoordSys.EPSG3857);
            pMap.setMapTypeId('NLSCMAP');
            pMap.setCenter(new TGOS.TGPoint(120.5, 23.75));
            pMap.setZoom(6);
            pMap.setOptions({
                mapTypeControl: false,
                scaleControl: false,
                navigationControl: false,
                mapBounds: new TGOS.TGEnvelope(113.5884760904839, 27.57144206466311,
                    130.5634772598658, 20.437573393627737),
                minZoom: 6
            });

            this.addListener(pMap, 'mousemove', (e) => {
                let {x, y} = e.point;
                $('#map-info-container #mouse-position').show();
                $('#map-info-container #longitude').text(x.toFixed(3));
                $('#map-info-container #latitude').text(y.toFixed(3));
            });

            this.addListener(pMap, 'idle', () => {
                let $pSBar = $('#pScaleBar', '#tgMap div.hpack'),
                    barWidth = Number($pSBar.children('div:nth-child(3)')
                        .css('left').split('px')[0]),
                    barText = $pSBar.children('div:last-child')
                        .text().split('公'),
                    barNumber = Number(barText[0]),
                    barUnit = barText[1];

                if(barWidth > $('#map-info-container').width() - 20) {
                    barWidth /= 2;
                    barNumber /= 2;
                }

                $('#map-info-container #scale-bar').show();
                $('#map-info-container #scale-bar #text')
                    .css('left', `${barWidth / 2 - 10}px`)
                    .text(barNumber + {'里': 'km', '尺': 'm'}[barUnit]);
                $('#map-info-container #scale-bar #bar').width(barWidth);
            });
        },
        reset: function() {
            pMap.setCenter(new TGOS.TGPoint(120.5, 23.75));
            pMap.setZoom(7); //為了防止fill跑掉
            pMap.setZoom(6);
        },
        addListener: function(tgObj, event, handler) {
            if(!(('click dbclick rightclick clusterclick mousemove mouseout mouseover mouseup ' +
                'dragstart drag dragend idle').split(' ').includes(event))) {
                console.log(new Error('未包含的TGOS Map事件'));
                return;
            }
            TGOS.TGEvent.addListener(tgObj, event, handler);
        },
        customLayer: function(options = {}) {
            const CustomLayer = function () {
                let {width, height, map} = options.style || {};

                this.width = width || '100%';
                this.height = height || '100%';
                this.setMap(map || pMap);
            };

            CustomLayer.prototype = new TGOS.TGOverlayView();

            CustomLayer.prototype.onAdd = function() {
                let mapLayer = this.getPanes().overlayviewLayer;
                this.mSRS = this.map.getCoordSys();

                this.div = document.createElement('div');
                this.div.id = options.id || 'tgCustomLayer';
                this.div.className = options.className || '';
                this.div.style.position = 'absolute';
                this.div.style.width = '100%';
                this.div.style.height = '100%';
                this.div.style.zIndex = 10;
                this.div.innerHTML = options.innerHTML || '';
                mapLayer.appendChild(this.div);

                if(options.afterAdd) {
                    options.afterAdd.call(this);
                }
            };

            CustomLayer.prototype.onDraw = options.onDraw || function () {};

            CustomLayer.prototype.onRemove = function () {
                if(options.beforeRemove) {
                    options.beforeRemove.call(this);
                }

                this.div.parentNode.removeChild(this.div);
                this.div = null;
            };

            return new CustomLayer();
        },
        getMap: function() {
            return pMap;
        }
    };

})(document);