let regionUsageColor = {};
(function (global, document, $) {
    'use strict';

    document.addEventListener('readystatechange', () => {
        if(document.readyState === 'complete') {
            if(!isMobile()) $('#nav-collapse').remove();

            TGMap.init();
            $('.marquee').html(`
                <span class="glyphicon glyphicon-bullhorn">
                    <span>
                        ${loadInstantElectricityConsumption()}
                    </span>
                </span>
            `);

            displayDefaultLayerGroup();
            initialMapInfoDivision();
            createMenus(['typhoon', 'wind-map']);
        }
    });

    function displayDefaultLayerGroup() {
        let $defaultLayer = $('#defaultLayerGroup-container.group-modal'),
            $blocker = $('.blocker');

        if(readCookie('isNeverShowDefaultLayer') === 'true') {
            $blocker.remove();
        }

        $defaultLayer.html(`
            <div class="header">
                <div class="title">選擇您的身分</div>
                <span class="closer">✖</span>
            </div>
            <div class="body">
                <div class="group-item">
                    <span>政府人員</span>
                </div>
                <div class="group-item">
                    <span>研究人員</span>
                </div>
                <div class="group-item">
                    <span>普通民眾</span>
                </div>
            </div>
            <div class="footer">
                <label>
                    <input type="checkbox" name="neverShow">
                    不再顯示
                </label>
            </div>
        `);

        $blocker.show();
        $defaultLayer.css('display', 'inline-block');

        $($defaultLayer.children('.body')
            .children('.group-item', '.group-item span')).on('click', (e) => {
                const features = ((type) => {
                    switch (type) {
                        case '政府人員':
                            return ['各縣市年度用電比例', '各縣市年度用電度數'];
                        case '研究人員':
                            return ['近十年再生能源結構'];
                        case '普通民眾':
                            $(`.menu.typhoon`).trigger('click');
                            return ['建置太陽能發電站', '風力發電站', '太陽能發電站',
                                '未來預估電力資訊', '即時供電現況'];
                    }
                })($(e.target).children('span').text() || $(e.target).text());

                features.forEach((feature) => {
                    $('#treeTable').trigger('fancytreeDefaultLayerItemClick', [feature]);
                });

                let isNeverShow = $defaultLayer
                    .find('.footer input[name="neverShow"]').prop('checked');
                createCookie('isNeverShowDefaultLayer', isNeverShow);

                $blocker.remove();
            });

        $defaultLayer.find('.header .closer').on('click', () => {
            let isNeverShow = $defaultLayer
                .find('.footer input[name="neverShow"]').prop('checked');
            createCookie('isNeverShowDefaultLayer', isNeverShow);

            $blocker.remove();
        });
    }

    function initialMapInfoDivision() {
        $('#map-info-container').html(`
            <div id="coordinate-system">
                本圖臺坐標系統
                <a href="https://epsg.io/3857" target="_blank">EPSG:3857</a>
            </div>
            <div id="mouse-position">
                經緯度 ( <span id="longitude"></span> ,<span id="latitude"></span>)
            </div>
            <div id="scale-bar">
                <span id="text"></span>
                <div id="bar"></div>
            </div>
        `);

        $('#map-info-container #mouse-position').hide();
        $('#map-info-container #scale-bar').hide();
    }

    const menuerList = {};
    function createMenus(types) {
        types.forEach((type) => {
            $('#menu-container').append(`
                <div class="menu ${type}" data-type="${type}"></div>
            `);
            _menuEvent(type);

            $(`.menu.${type}`).click((e) => {
                $(e.target).toggleClass('active');
                _menuEvent(type, $(e.target).hasClass('active'));
            });
        });

        function _menuEvent(type, active) {
            let menuer;
            switch (type) {
                case 'typhoon':
                    menuer = new Menuer.TyphoonMenuer();
                    break;
                case 'wind-map':
                    menuer = new Menuer.WindMapMenuer();
                    break;
            }

            if(!menuerList.hasOwnProperty(type) || !menuerList[type]) {
                menuer.init();
                menuerList[type] = menuer;
            }else {
                menuer = menuerList[type];
                if(active) menuer.enable();
                else menuer.disable();
            }
        }
    }
    
    function loadInstantElectricityConsumption() {
        let text = '';
        $.ajax({
            url: 'https://cors-anywhere.herokuapp.com/www.taipower.com.tw/d006/loadGraph/loadGraph/data/genloadareaperc.csv',
            async: false,
            success: (csv) => {
                const data = {};
                csv = csv.split(/\r?\n|\r/)[0].split(',');

                for(let i = 1, count = 0; i < csv.length; i+=2, count++) {
                    let index = i - 1 - count;
                    data[['北部', '中部', '南部', '東部'][index]] = {
                        supply: Number(csv[i]),
                        usage: Number(csv[i + 1]),
                        rate: [0.35, 0.33, 0.32, 0.022][index]
                    };
                }

                let date = new Date(),
                    nowDate = date.getTWDFullDate(['年', '月', '日']),
                    nowTime = date.getFullTime();

                text = `全台各區域即時用電資訊(更新時間:${nowDate + ' ' + nowTime}):　`;

                for(let [region, {supply, usage, rate}] of Object.entries(data)) {
                    let color = '#008000';
                    if(usage * rate >= Math.round(supply * 0.8)) {
                        color = '#dc3912';
                    }else if(usage * rate >= Math.round(supply * 0.75)) {
                        color = '#ff9900';
                    }
                    text += `<span style="color: ${color};">${region}即時用電量: ${usage}萬瓩　　</span>`;
                    regionUsageColor[region] = color;
                }
            },
            error: (xhr, status, error) => {
                text = readCookie('InstantElectricityConsumptionData');
                if(text === 'null') {
                    text = '跑馬燈暫時無法使用';
                }
            }
        });
        /*$.ajax({
            url: 'https://www.taiwanstat.com/powers/latest/',
            async: false,
            success: ({reserveData, regionData}) => {
                let areaMaxSupply = [0.35, 0.33, 0.32, 0.022].map((rate) =>
                    Math.round(rate * reserveData.reserveSupply));
                let [updateDate, updateTime] = reserveData.updateTime.split(')');

                text = `全台各區域即時用電資訊(更新時間:${updateDate + ') ' + updateTime}):　`;

                let usages = {
                    北部: regionData.northUsage,
                    中部: regionData.centerUsage,
                    南部: regionData.southUsage,
                    東部: regionData.eastUsage,
                };

                for(let [index, [region, usage]] of Object.entries(Object.entries(usages))) {
                    let color = '#008000';
                    if(Number(usage) >= Math.round(areaMaxSupply[index] * 0.8)) {
                        color = '#dc3912';
                    }else if(Number(usage) >= Math.round(areaMaxSupply[index] * 0.75)) {
                        color = '#ff9900';
                    }
                    text += `<span style="color: ${color};">${region}即時用電量: ${usage}萬瓩　　</span>`;
                    regionUsageColor[region] = color;
                }
            },
            error: (xhr, status, error) => {
                text = readCookie('InstantElectricityConsumptionData');
                if(text === 'null') {
                    text = '跑馬燈暫時無法使用';
                }
            }
        });*/

        createCookie('InstantElectricityConsumptionData', text, 1);
        return text;
    }

    $(function () {
        global.basicDataURL = '../GoGoEnergy/data/';
        global.basicAssetsURL = '../GoGoEnergy/assets/';

        Date.prototype.getTWDFullDate = function(separator) {
            separator = !$.isArray(separator) ?
                new Array(3) : separator;

            for(let i = 0; i < 3; i++) {
                separator[i] = separator[i] || '/';
            }

            return (this.getFullYear() - 1911) + separator[0] +
                (this.getMonth() + 1) + separator[1] +
                (this.getDate()) + separator[2];
        };

        Date.prototype.getFullTime = function() {
            let o = {
                h: this.getHours().toString(),
                m: this.getMinutes().toString()
            };
            let format = (ele) => (ele.length === 1 ? '0' : '') + ele;

            return format(o.h) + ':' + format(o.m);
        };

        let executed = true;
        global.executeNonRepeatable = (func, ...args) => {
            if(executed) {
                executed = false;

                if(args.length >= 1) func.call(null, ...args);
                else func.call();

                setTimeout(() => executed = true, 1000);
            }
        };

        global.isMobile = () =>
            global.matchMedia('(max-width: 480px)').matches;

        global.convertCSVtoJSON = (csv) => {
            let [title, ...data] = csv.split(/\r?\n|\r/);
            title = title.split(',');

            const JSON = [];
            data.forEach((data) => {
                let temp = {};
                data.split(',').forEach((data, index) => {
                    let obj = {};
                    obj[title[index]] = data;
                    Object.assign(temp, obj);
                });
                JSON.push(temp);
            });

            return JSON;
        };

        global.createCookie = (name, value, days) => {
            let expires = '';
            if(days) {
                let date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = '; expires=' + date.toString();
            }
            document.cookie = name + '=' + value + expires;
        };

        global.readCookie = (name) => {
            let cookies = document.cookie.split(';');

            for(let cookie of cookies) {
                let kvPair = cookie.split('=');
                if(kvPair.length === 2) {
                    let key = $.trim(kvPair[0]),
                        value = $.trim(kvPair[1]);

                    if(key === name) return value;
                }
            }

            return null;
        };

        global.eraseCookie = (name) =>
            createCookie(name, '', -1);
    });

})(window, document, jQuery);

(function (global, $) {

    let Menuer = {};
    global.Menuer = Menuer || {};

    Menuer.TyphoonMenuer = function() {
        let typhoons = {},
            intervals = {};

        this.init = function () {
            loadCWBtyphoonData();
        };

        this.enable = function () {
            Object.keys(typhoons).forEach((typhID) => {
                enableTyphAnimation(typhoons[typhID].typhPoints, typhID);
            });
        };

        this.disable = function () {
            Object.keys(typhoons).forEach((typhID) => {
                typhoons[typhID].typhPoints.forEach((point) => {
                    point['circle'].setMap(null);
                    point['innerCircle'].setMap(null);
                    point['line'].setMap(null);
                    point['messageBox'].close();
                });
                clearInterval(intervals[typhID]);
            });
        };

        function enableTyphAnimation(points, id) {
            let count = 0;
            intervals[id] = setInterval(() => {
                if (count === 0) {
                    points.forEach((point) => {
                        point['circle'].setMap(null);
                        point['innerCircle'].setMap(null);
                        point['line'].setMap(null);
                        point['messageBox'].close();
                    });
                }
                points[count]['circle'].setMap(TGMap.getMap());
                points[count]['innerCircle'].setMap(TGMap.getMap());
                points[count]['line'].setMap(TGMap.getMap());
                points[count]['messageBox'].open(TGMap.getMap());
                setMessageBoxStyle(points[count]['messageBox'], points[count].status);
                count++;
                if (count === points.length) count = 0;
            }, 400);
        }

        function loadCWBtyphoonData() {
            /*氣象局颱風公開資料
              http://opendata.cwb.gov.tw/opendataapi?dataid=W-C0034-004&authorizationkey=CWB-61180A08-E8EC-43AE-9836-E2E461C41EAB
            */
            $.ajax({
                url: basicDataURL + '氣象局-颱風即時動態資訊(1081119).xml',
                dataType: 'XML',
                success: function (xml) {
                    let color = {
                        past: '#0000FF',
                        curr: '#00FF00',
                        fcst: '#FF0000'
                    };

                    for(let typhoon of $(xml).find('typhoon')) {
                        typhoon = new Typhoon(typhoon);
                        typhoons[typhoon.typhName.EN] = typhoon;

                        for(let [index, point] of typhoon.typhPoints.entries()) {
                            let circle = new TGOS.TGCircle();
                            circle.setCenter(point.latlng);
                            circle.setRadius(point.radius);

                            point.circle = new TGOS.TGFill(null, circle, {
                                fillColor: color[point.status],
                                fillOpacity: 0,
                                strokeColor: color[point.status],
                                strokeWeight: 5,
                                strokeOpacity: .5
                            });

                            let innerCircle = new TGOS.TGMarker(null, point.latlng);
                            innerCircle.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/typhoon-eye.png',
                                new TGOS.TGSize(40, 40)));
                            point.innerCircle = innerCircle;

                            let lineString = new TGOS.TGLineString([
                                index > 0 ? typhoon.typhPoints[index - 1].latlng : point.latlng,
                                point.latlng
                            ]);

                            point.line = new TGOS.TGLine(null, lineString, {
                                strokeColor: '#00AA88',
                                strokeWeight: 5
                            });

                            let isCurr = point.status === 'curr',
                                content = (isCurr ? `<h5 class="font-weight-bold" style="color: #6D0101;">${typhoon.typhName.TW}颱風現在位置</h5>`
                                    : '') + point.date.split('-')[2] + '日' +
                                    point.time.split(':')[0] + `時<br />${point.movement}`;

                            point.messageBox = new TGOS.TGInfoWindow(content, point.latlng, {
                                maxWidth: 160,
                                zIndex: isCurr ? 99 : 98,
                                pixelOffset: new TGOS.TGSize(5, -30)
                            });
                        }
                    }
                }
            });
        }

        function setMessageBoxStyle(messageBox, status) {
            status = status === 'curr';
            let orgHeight = $(messageBox.getContentPane()).parent().height(),
                orgTop = Number($(messageBox.getContentPane()).parent()
                    .css('top').split('px')[0]),
                height = status ? 125 : 40;

            $(messageBox.getContentPane())
                .children('p:not(:only-child)').remove();
            $(messageBox.getContentPane()).parent().css({
                'width': status ? 200 : 92,
                'height': height,
                'top': `${orgTop + orgHeight - height + 2}px`,
                'overflow': 'hidden',
                'font-weight': 'bolder',
                'background-color': status ? '#FDFF85' : '#FFFFFF'
            }).next().next().remove();
        }

        function Typhoon(xml) {
            let $xml = $(xml);

            this.typhName = {
                EN: $xml.find('typhname')[0].attributes['value'].value,
                TW: $xml.find('typhname')[1].attributes['value'].value
            };
            this.typhPoints = [];
            this.typhTracks = [];

            let past = $xml.find('past')[0], //過去
                curr = $xml.find('curr')[0], //現在
                fcst = $xml.find('fcst')[0]; //未來

            createTyphoonTrack(past, 'past', this.typhPoints, this.typhTracks);
            createTyphoonTrack(curr, 'curr', this.typhPoints, this.typhTracks);
            createTyphoonTrack(fcst, 'fcst', this.typhPoints, this.typhTracks);

            function createTyphoonTrack(data, status, points, tracks) {
                for(let point of $(data).children('point')) {
                    let lat = $(point).find('latitude')[0].attributes['value'].value,
                        lng = $(point).find('longitude')[0].attributes['value'].value;
                    let latlng = new TGOS.TGPoint(lng, lat);

                    let movement = $(point).find('movement')[0],
                        transition = $(point).find('transition')[0],
                        warning = $(point).find('warning')[0];

                    let dateString = point.attributes['time'].value.split('+')[0];

                    let radius = 0;
                    for(let r of $(point).find('radius')) {
                        radius += Number(r.attributes['value'].value);
                    }

                    points.push({
                        date: dateString.split('T')[0],
                        time: dateString.split('T')[1],
                        status: status,
                        movement: $(movement).text(),
                        transition: $(transition).text(),
                        warning: $(warning).text(),
                        x: lat,
                        y: lng,
                        latlng: latlng,
                        radius: radius * 100
                    });
                    tracks.push(latlng);
                }
            }
        }
    };

    Menuer.WindMapMenuer = function() {
        this.init = function () {
            this.disable();
        };

        this.enable = function () {
            $('#windMap-frame').toggle();
        };

        this.disable = function () {
            $('#windMap-frame').toggle();
        };
    };

})(window, jQuery);