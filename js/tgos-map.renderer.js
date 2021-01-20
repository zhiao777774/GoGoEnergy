const rendererList = {};
(function (global, $) {

    let Renderer = {};
    global.Renderer = Renderer || {};

    function execRendering(panelTitle, html, callback, ...args) {
        $(`#info-div-body-${panelTitle}`).html(html);

        if(callback && $.isFunction(callback)) {
            if(args.length > 0) callback.call(null, ...args);
            else callback.call();
        }
    }

    function bypassCORS(url) {
        //https://bypasscors.herokuapp.com/api/?url=
        return 'https://cors-anywhere.herokuapp.com/' +
            encodeURIComponent(url);
    }

    function bindCollapsible(selector, trigger = false) {
        const jqObj = $(selector).click((e) => {
            let $target = $(e.target),
                $body = $('#' + $target.attr('id')
                .replace('title', 'body'));
            $body.toggle();

            if($body.css('display') === 'none') {
                $target.removeClass('glyphicon-menu-down')
                    .addClass('glyphicon-menu-right');
            }else {
                $target.removeClass('glyphicon-menu-right')
                    .addClass('glyphicon-menu-down');
            }
        });

        if(trigger) jqObj.trigger('click');

        return jqObj;
    }

    Renderer.BuildSolarPanelAssessmentRenderer = function(panelTitle) {
        this.rendererID = 'BuildSolarPanelAssessmentRenderer';
        let fills = [],
            messageBox = undefined;
        const countiesAvgIncome = fetchCountiesAvgIncome();
        
        this.rendering = function () {
            let html = `
                <div id="calculateForm" class="domainForm">
                    <div class="domainTop">
                        <h6 class="glyphicon glyphicon-flag">太陽能評估計算機</h6>
                        <select id="city"></select>
                        <select id="system">
                            <option value="" selected disabled>請選擇建置類型</option>
                            <option value="屋頂型">屋頂型</option>
                            <option value="地面型">地面型</option>
                            <option value="地面型">水面型</option>
                        </select>
                        <div class="input-group mb-3">
                            <input type="search" id="area" class="form-control" placeholder="可設置太陽能板的面積坪數">
                            <div class="input-group-append">
                                <span class="input-group-text font-weight-bold">坪</span>
                            </div>
                        </div>
                        <button id="btnCalculate" class="btn btn-xs btn-warning">試算</button>
                        <input type="checkbox" id="efficiency">
                        <label class="font-weight-bold">高效能光電模組</label>
                    </div>
                    <div id="form-messages"></div>
                </div>
                <hr />
                <div>
                    <small>本計算器試算結果依照各縣市平均發電量，在無遮蔭情況下之參考發電數據，
                        實際收益及發電量會依現場情況與設置方式而有所不同</small>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                const countiesSolarInfo = fetchCountiesSolarInfo();
                $('#city').append(`<option value="" selected disabled>請選擇縣市</option>`);
                districtsData.adms.forEach((district, index) => {
                    $('#calculateForm #city')
                        .append(`<option value="${district}">${district}</option>`);

                    new TGOS.TGLocateService().locateWGS84({
                        district: district
                    }, (e, status) => {
                        let value = countiesSolarInfo[district].annualAvg,
                            color = (value >= 1000) ? '#FF6D00'
                                : (value >= 600 ? '#FFC849' : '#FFDD94');

                        let polygon = e[0].geometry.geometry;
                        let fill = new TGOS.TGFill(TGMap.getMap(), polygon, {
                            fillColor: color,
                            fillOpacity: .6,
                            strokeColor: '#BF4B12',
                            strokeWeight: 1.5,
                            strokeOpacity: 1
                        });

                        TGMap.addListener(fill, 'mouseover', () => {
                            displayMessageBox({
                                lat: $('#map-info-container #latitude').text(),
                                lng: $('#map-info-container #longitude').text(),
                                district: district,
                                value: value,
                                color: color
                            });
                        });
                        TGMap.addListener(fill, 'mouseout', () => messageBox.close());
                        TGMap.addListener(fill, 'click', async () => {
                            $(`#city option:eq(${index + 1})`).prop('selected', true);
                        });

                        fills.push(fill);
                    });
                });

                //限制只能輸入數字與一位小數點
                $('input#area').keyup((e) => {
                    e = e.target;
                    if(!/^\d+[.]?\d*$/.test(e.value)) {
                        $(e).val(/^\d+[.]?\d*/.exec($(e).val()));
                    }
                    return false;
                });

                $('#btnCalculate').click(function() {
                    $('#form-messages').empty().css('margin-top', '0px');
                    $(this).attr('disabled', 'disabled')
                        .text('計算中...').css('background', '#FFCF26');

                    let response = assessingBuildSolarPanel({
                        city: $('#calculateForm #city').children('option:selected').val(),
                        system: $('#calculateForm #system').children('option:selected').val(),
                        area: $('#calculateForm #area').val(),
                        efficiency: $('#calculateForm #efficiency:checked').val()
                    });

                    if(response.error !== null) {
                        $('#form-messages').html(response.error)
                            .css({'color': 'black', 'margin-top': '10px'});
                        $(this).removeAttr('disabled')
                            .text('試算').css('background', 'rgba(255, 207, 38, 0.6)');
                    }else {
                        setTimeout(() => {
                            renderingDialog(getSolarPanelAssessedDivision());

                            let data = response.data;
                            Object.keys(data).forEach((result) => {
                                let value = (result !== 'income') ?
                                    _thousandComma(data[result]) : data[result];
                                $(`#${result}`).find('h3').text(value);
                            });
                            drawChart(data);

                            $(this).removeAttr('disabled')
                                .text('試算').css('background', 'rgba(255, 207, 38, 0.6)');
                        }, 1000);
                    }

                    function _thousandComma(number) {
                        let num = number.toString();
                        let pattern = /(-?\d+)(\d{3})/;

                        while (pattern.test(num)) {
                            num = num.replace(pattern, '$1,$2');
                        }
                        return num;
                    }
                });
            });
        };

        this.empty = function () {
            fills.forEach((fill) => fill.setMap(null));
            fills.length = 0;
        };

        /*function assessingBuildSolarPanel({city, system, area, efficiency} = {}) {
            const response = {
                error: null,
                data: null
            };

            let isEmpty = (str) => !str || str.length === 0;
            let errorText = isEmpty(city) ? '請選擇縣市 ' : '';
            errorText += isEmpty(system) ? '請選擇建置類型 ' : '';
            errorText += isEmpty(area) ? '請輸入可設置面積 ' : '';
            errorText += parseFloat(area) === 0.0 ? '可設置面積不可為0 ' : '';

            if(!isEmpty(errorText)) {
                response.error = errorText;
                return response;
            }

            efficiency = !(!efficiency || isEmpty(efficiency));
            area = parseFloat(area);

            return $.ajax({
                url: '/api/BuildSolarPanelAssessment',
                type: 'POST',
                dataType: 'JSON',
                data: {
                    area: area,
                    efficiency: efficiency,
                    annualAvg: countiesSolarInfo[city].annualAvg,
                    avgIncome: countiesAvgIncome[city][system]
                },
                success: (json) => json
            });

            let minCost = Math.round(area / 3 * 55000 * (efficiency ? 1.1 : 1)),  //最小建置成本
                maxCost = Math.round(area / 3 * 80000 * (efficiency ? 1.1 : 1)),  //最大建置成本
                kwh = Math.round(countiesSolarInfo[city].annualAvg * area / 3),  //每年發電度數
                twd = Math.round(area * countiesAvgIncome[city][system]
                    * (efficiency ? 1.06 : 1)),  //每年總收益
                income = (twd / kwh).toFixed(4),  //每度收益
                kgco2e = Math.round(kwh * 0.554),  //可減少之碳排放量(公斤)
                tree = Math.round(kgco2e / 12),  //相當於種植幾棵樹
                tree_area = (tree / 1300).toFixed(2);  //相當於種植多少公頃的森林

            response.data = {
                minCost: minCost,
                maxCost: maxCost,
                kwh: kwh,
                twd: twd,
                income: income,
                kgco2e: kgco2e,
                tree: tree,
                tree_area: tree_area,
            };

            return response;
        }*/

        function assessingBuildSolarPanel({city, system, area, efficiency} = {}) {
            const response = {
                error: null,
                data: null
            };

            let isEmpty = (str) => !str || str.length === 0;
            let errorText = isEmpty(city) ? '請選擇縣市 ' : '';
            errorText += isEmpty(system) ? '請選擇建置類型 ' : '';
            errorText += isEmpty(area) ? '請輸入可設置面積 ' : '';
            errorText += parseFloat(area) === 0.0 ? '可設置面積不可為0 ' : '';

            if(!isEmpty(errorText)) {
                response.error = errorText;
                return response;
            }

            efficiency = !(!efficiency || isEmpty(efficiency));
            area = parseFloat(area);
            area = (area < 3.0) ? 3.0 : area;

            const regionGeneratingHours = {
                預設值: '2.8', 基隆市: '2.44', 臺北市: '2.61', 新北市: '2.61', 桃園市: '2.77',
                新竹市: '2.85', 新竹縣: '2.85', 苗栗縣: '3.13', 臺中市: '3.34', 彰化縣: '3.59',
                南投縣: '3.23', 宜蘭縣: '2.52', 花蓮縣: '2.32', 臺東縣: '2.92', 澎湖縣: '3.39',
                金門縣: '3.35', 連江縣: '2.84', 雲林縣: '3.47', 嘉義市: '3.42', 嘉義縣: '3.42',
                臺南市: '3.54', 高雄市: '3.42', 屏東縣: '3.12'
            };

            //每約2.2727坪 = 1kw設置量
            let nSetup = Math.floor(area / 2.2727);

            let rate = (() => {
                switch(system) {
                    case '屋頂型':
                        if(nSetup >= 500) return 4.1579;
                        else if(nSetup >= 100) return 4.2355;
                        else if(nSetup >= 20) return 4.5083;
                        else return 5.7983;
                    case '地面型':
                        return 4.0379;
                    case '水面型':
                        return 4.4324;
                }
            })() * (efficiency ? 1.06 : 1);

            //苗栗以北及離島區域 躉售價+15%
            if(Object.keys(regionGeneratingHours)
                .findIndex((value) => value === city) > 11) rate *= 1.15;

            let kwh = Math.round(nSetup * 365 * regionGeneratingHours[city]),  //預估年發電量
                twd = Math.round(kwh * rate),  //預估每年發電收入
                income = parseFloat((twd / kwh).toFixed(4)); //預估每度收益

            //預估安裝費用
            let cost = Math.round((() => {
                //不同設置量級距所需每1kw建置費用
                if(nSetup >= 500) return 43500;
                else if(nSetup >= 100) return 44700;
                else if(nSetup >= 20) return 46400;
                else return 60700;
            })() * nSetup * (efficiency ? 1.1 : 1));

            let roi = Math.round(twd / cost * 100);  //預估投資報酬率(%)
            let kgco2e = Math.round(kwh * 0.554),  //預估環境的貢獻度
                msmeb = Math.round(twd / 400),  //預估四口之家節省電費(月)
                aircon = Math.round(kwh / 0.9),  //等同減少使用冷氣(小時)
                kmcar = Math.round((kgco2e / 0.224)),  //等同少開多少公里的車
                tree = Math.round(kgco2e / 12),  //相當於種植幾棵樹
                tree_area = parseFloat((tree / 1300).toFixed(2));  //相當於種植多少公頃的森林

            response.data = {
                cost: cost,
                kwh: kwh,
                twd: twd,
                income: income,
                roi: roi,
                msmeb: msmeb,
                aircon: aircon,
                kmcar: kmcar,
                kgco2e: kgco2e,
                tree: tree,
                tree_area: tree_area
            };

            return response;
        }

        function fetchCountiesAvgIncome() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '各縣市太陽能發電系統每坪收益評估.csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [, ...data] = csv.split(/\r?\n|\r/);

                    data.forEach((data) => {
                        let [county, type, income] = data.split(',');

                        if(!JSON[county]) {
                            JSON[county] = {};
                        }
                        JSON[county][type] = income;
                    });
                }
            });
            return JSON;
        }

        function fetchCountiesSolarInfo() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-107年各縣市太陽光電容量、發電量及容量因數.csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [, ...data] = csv.split(/\r?\n|\r/);

                    data.forEach((data) => {
                        let [county, capacity, generation,
                            dailyAvg, annualAvg, factor] = data.split(',');
                        JSON[county] = {
                            capacity: capacity,
                            generation: generation,
                            dailyAvg: dailyAvg,
                            annualAvg: annualAvg,
                            factor: factor
                        };
                    });
                }
            });
            return JSON;
        }

        function displayMessageBox({lat, lng, district, value, color}) {
            if(messageBox) {
                messageBox.close();
                messageBox = undefined;
            }

            messageBox = new TGOS.TGInfoWindow('',
                new TGOS.TGPoint(lng, lat), {
                    maxWidth: 160,
                    zIndex: 99
                });

            if(!$('#county-solar-annualAvg-panel', '#tgMap div.hpack').length) {
                messageBox.open(TGMap.getMap());
                $(messageBox.getContentPane()).parent()
                    .attr('id', 'county-solar-annualAvg-panel')
                    .nextAll().remove();
            }

            messageBox.setContent(`
                <div class="font-weight-bold" style="color: #EE5757;">${district}</div>
                <h6 class="font-weight-bold" style="color: ${color};">${value}度</h6>
            `);
            $(messageBox.getContentPane()).children('p').remove();
            $(messageBox.getContentPane()).parent().css({
                'width': 70,
                'height': 65,
                'overflow': 'hidden',
                'text-align': 'center',
                'border': 0,
                'border-radius': '10px'
            });
        }

        function drawChart({cost, twd}) {
            let income = twd,
                data = [parseFloat(-Math.round(
                    Number(cost)) + Number(income))];
            for(let i = 0; i < 9; i++) {
                data.push(Number(income));
            }

            const {PP, NPV} = FinanceUtils;
            const pp = PP(data), npv = NPV(0.03, data);
            $('#earn-cost').html('成本回收時間: 約' + pp + '年能夠回本');
            $('#fitness').html('評估適合度: ' + (npv >= 1 ? '適合' : '不適合') + '建置太陽能板');

            let ctx = document.getElementById('canvas-access-results-irr').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['第1年', '第2年', '第3年', '第4年', '第5年', '第6年',
                        '第7年', '第8年', '第9年', '第10年'],
                    datasets: [{
                        label: '收益',
                        data: data,
                        backgroundColor: '#FFEC20',
                        fillOpacity: .5
                    }]
                },
                options: {
                    title: {
                        display: true,
                        text: '太陽能評估結果收益圖'
                    },
                    tooltips: {
                        callbacks: {
                            label: function ({datasetIndex, index}, data) {
                                let dataset = data.datasets[datasetIndex];
                                let currentValue = dataset.data[index];
                                return ' ' + data.labels[index] + ': ' +
                                    currentValue + '元';
                            }
                        }
                    },
                    legend: {
                        onClick: (e, legendItem) => {}
                    }
                }
            });
        }
    };

    Renderer.BuildWindPlantAssessmentRenderer = function(panelTitle) {
        this.rendererID = 'BuildWindPlantAssessmentRenderer';
        let intrusionProbGeometries = [],
            generatePosiFills = [],
            groundOverlay = undefined,
            districtWPAssessmentData = undefined,
            locationAsseFills = {
                district: undefined,
                simulation: []
            };
        let isEnableGeneratePosi = false,
            dialogIsInit = false;

        this.rendering = function () {
            let html = `
                <div id="wp-assessment-checkbox-group">
                    <span role="checkbox" class="glyphicon glyphicon-check font-weight-bold cursor-pointer">顯示各縣市颱風入侵機率圖</span>
                    <div style="margin-bottom: 10px;">
                        <label id="typhoon-prob-color-grading-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer">颱風入侵機率分級:</label>
                        <div id="typhoon-prob-color-grading-body" style="padding-left: 20px;">
                            <label class="color-chart" style="background: rgba(7, 237, 99, .3); margin-top: 10px;">　　</label><label>　< 40%</label><br/>
                            <label class="color-chart" style="background: rgba(235, 231, 5, .3);">　　</label><label>　40% ~ 60%</label><br/>
                            <label class="color-chart" style="background: rgba(242, 5, 84, .3);">　　</label><label>　> 60%</label><br/>
                        </div>
                    </div>
                    <span role="checkbox" class="glyphicon glyphicon-unchecked font-weight-bold cursor-pointer">顯示近年颱風生成點位</span>
                    <div style="margin-bottom: 10px;">
                        <label id="typhoon-posi-color-grading-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer">颱風點位分級:</label>
                        <div id="typhoon-posi-color-grading-body" style="padding-left: 20px;">
                            <label class="color-chart" style="background: #00FF00; margin-top: 10px;">　　</label><label>　輕度</label><br/>
                            <label class="color-chart" style="background: #0000FF;">　　</label><label>　中度</label><br/>
                            <label class="color-chart" style="background: #FF0000;">　　</label><label>　強烈</label><br/>
                        </div>
                    </div>
                    <span role="checkbox" class="glyphicon glyphicon-unchecked font-weight-bold cursor-pointer">疊加全臺風速熱區圖</span>
                    <div style="margin-bottom: 10px;">
                        <label id="wind-velocity-color-grading-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer">風速熱區分級(單位:m/s):</label>
                        <div id="wind-velocity-color-grading-body" style="padding-left: 20px;">
                            <label class="color-chart" style="background: #F5F5F5; border: 0.1px solid; margin-top: 10px;">　　</label><label>　< 4.0</label><br/>
                            <label class="color-chart" style="background: #006400;">　　</label><label>　4.0 ~ 4.5</label><br/>
                            <label class="color-chart" style="background: #228B22;">　　</label><label>　4.5 ~ 5.0</label><br/>
                            <label class="color-chart" style="background: #32CD32;">　　</label><label>　5.0 ~ 5.5</label><br/>
                            <label class="color-chart" style="background: #FFFF00;">　　</label><label>　5.5 ~ 6.0</label><br/>
                            <label class="color-chart" style="background: #BDB76B;">　　</label><label>　6.0 ~ 6.5</label><br/>
                            <label class="color-chart" style="background: #B8860B;">　　</label><label>　6.5 ~ 7.0</label><br/>
                            <label class="color-chart" style="background: #DAA520;">　　</label><label>　7.0 ~ 7.5</label><br/>
                            <label class="color-chart" style="background: #FF9A09;">　　</label><label>　7.5 ~ 8.0</label><br/>
                            <label class="color-chart" style="background: #8B0000;">　　</label><label>　8.0 ~ 8.5</label><br/>
                            <label class="color-chart" style="background: #EE82EE;">　　</label><label>　8.5 ~ 9.0</label><br/>
                            <label class="color-chart" style="background: #D387D3;">　　</label><label>　9.0 ~ 9.5</label><br/>
                            <label class="color-chart" style="background: #9400D3;">　　</label><label>　9.5 ~ 10.0</label><br/>
                            <label class="color-chart" style="background: #8C0044;">　　</label><label>　10.0 ~ 10.5</label><br/>
                            <label class="color-chart" style="background: #4B0082;">　　</label><label>　10.5 ~ 11.0</label><br/>
                            <label class="color-chart" style="background: #0066FF;">　　</label><label>　> 11.0</label><br/>
                        </div>
                    </div>
                </div>
                <hr />
                <div id="wp-assessment-build-division">
                    <label class="font-weight-bold">一般型風力發電機組評估：</label>
                    <div class="input-group">
                        <select id="county" class="custom-select"></select>
                        <select id="region" class="custom-select"></select>
                        <div class="input-group-append">
                            <button id="btnAssess" class="btn btn-outline-secondary">查詢</button>
                        </div>
                    </div>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                initBuildDivision();
                loadTyphoonIntrusionProbabilityData();
                loadTyphoonGeneratePositionData();

                $('#wp-assessment-checkbox-group').children('span[role="checkbox"]:nth-of-type(1)')
                    .click((e) => {
                        let target = e.target,
                            $title = $('#typhoon-prob-color-grading-title');
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            if($title.hasClass('glyphicon-menu-down')) {
                                $title.trigger('click');
                            }
                            intrusionProbGeometries.forEach(({fill}) => {
                                fill.setMap(null);
                            });
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            if($title.hasClass('glyphicon-menu-right')) {
                                $title.trigger('click');
                            }
                            displayIntrusionProbGraph();
                        }
                    });

                $('#wp-assessment-checkbox-group').children('span[role="checkbox"]:nth-of-type(2)')
                    .click((e) => {
                        let target = e.target,
                            map = TGMap.getMap(),
                            $title = $('#typhoon-posi-color-grading-title');
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            if($title.hasClass('glyphicon-menu-down')) {
                                $title.trigger('click');
                            }
                            $(target).next().find('div label')
                                .removeClass('text-line-through');
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            if($title.hasClass('glyphicon-menu-right')) {
                                $title.trigger('click');
                            }
                        }
                        $(target).next().find('div label')
                            .toggleClass('cursor-pointer');
                        isEnableGeneratePosi = $(target)
                            .hasClass('glyphicon-check');

                        generatePosiFills.forEach((fill) =>
                            fill.setMap(isEnableGeneratePosi ? map : null));

                        let zoom = isEnableGeneratePosi ? 4 : 7;
                        map.setOptions({ minZoom: zoom });
                        map.setZoom(zoom);
                    });

                $('#wp-assessment-checkbox-group').children('span[role="checkbox"]:nth-of-type(3)')
                    .click((e) => {
                        if(groundOverlay) {
                            groundOverlay.setMap(null);
                            groundOverlay = undefined;
                        }

                        let target = e.target,
                            $title = $('#wind-velocity-color-grading-title');
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            if($title.hasClass('glyphicon-menu-down')) {
                                $title.trigger('click');
                            }
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            if($title.hasClass('glyphicon-menu-right')) {
                                $title.trigger('click');
                            }
                            loadWindVelocityHeatMap();
                            groundOverlay.setMap(TGMap.getMap());
                        }
                    });

                $('#typhoon-posi-color-grading-body').children('label')
                    .click((e) => {
                        let target = e.target;
                        if(!$(target).hasClass('cursor-pointer') ||
                            (!$(target).hasClass('text-line-through') &&
                                $(target).parent()
                                    .children('label.text-line-through')
                                    .length >= 4)) {
                            return;
                        }

                        let intensityColor = $(target)
                                .toggleClass('text-line-through')
                                .css('background-color');
                        if($(target).hasClass('color-chart')) {
                            $(target).next().toggleClass('text-line-through');
                        }else {
                            intensityColor = $(target).prev()
                                .toggleClass('text-line-through')
                                .css('background-color');
                        }
                        intensityColor = _rgb2hex(intensityColor).toUpperCase();

                        let status = $(target).hasClass('text-line-through') ?
                            null : TGMap.getMap();
                        generatePosiFills
                            .filter((fill) => fill.getFillColor() === intensityColor)
                            .forEach((fill) => fill.setMap(status));

                        function _rgb2hex(rgb) {
                            if(rgb.search('rgb') === -1) return rgb;

                            rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);

                            let hex = (x) =>
                                ('0' + parseInt(x).toString(16)).slice(-2);
                            return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
                        }
                    });

                bindCollapsible('#typhoon-prob-color-grading-title');
                bindCollapsible('#typhoon-posi-color-grading-title', true);
                bindCollapsible('#wind-velocity-color-grading-title', true);
            });
        };

        this.empty = function () {
            if(groundOverlay) {
                groundOverlay.setMap(null);
            }

            let intrusionProbFills = intrusionProbGeometries.map(({fill}) => fill);
            $.each([intrusionProbFills, generatePosiFills],
                (index, fills) => {
                fills.forEach((fill) => fill.setMap(null));
                fills.length = 0;
            });

            if(locationAsseFills.district) {
                locationAsseFills.district.setMap(null);
                locationAsseFills.simulation
                    .forEach((fill) => fill.setMap(null));
            }

            if(dialogIsInit) {
                $('#dialog-container')
                    .dialog('close').dialog('destroy');
            }

            if(isEnableGeneratePosi) {
                let map = TGMap.getMap();
                map.setOptions({ minZoom: 7 });
                map.setZoom(7);
            }
        };

        function initBuildDivision() {
            fetch(basicDataURL + '各縣市鄉鎮之風能及風速.json')
                .then((response) => response.json())
                .then((results) => districtWPAssessmentData = results);

            let $county = $('#wp-assessment-build-division select#county'),
                $region = $('#wp-assessment-build-division select#region');

            $county.append('<option value="" selected disabled>選擇縣市</option>');
            $region.append('<option value="" selected disabled>請先選擇縣市</option>');
            districtsData.adms.forEach((district) => {
                $county.append(`<option value="${district}">${district}</option>`);
            });

            $county.change(() => {
                $region.empty();
                let county = $county.children('option:selected').val();

                districtsData.subs[county].forEach((region) => {
                    $region.append(`<option value="${region}">${region}</option>`);
                });
            });

            $('#wp-assessment-build-division #btnAssess')
                .click(() => {
                    let county = $county.children('option:selected').val(),
                        region = $region.children('option:selected').val();
                    districtAssess(county, region);
                });
        }

        function districtAssess(county, region) {
            if(!county || county.length === 0) return;

            new TGOS.TGLocateService().locateWGS84({
                district: county + region
            }, (e, status) => {
                if(locationAsseFills.district) {
                    locationAsseFills.district.setMap(null);
                    locationAsseFills.simulation
                        .forEach((fill) => fill.setMap(null));
                }

                let polygon = e[0].geometry.geometry,
                    envelope = e[0].geometry.geometry.Envelope,
                    map = TGMap.getMap();

                locationAsseFills.district = new TGOS.TGFill(map, polygon, {
                    fillColor: '#FF36B5',
                    fillOpacity: 0,
                    strokeColor: '#FF36B5',
                    strokeWeight: 3,
                    strokeOpacity: 1,
                    zIndex: 50
                });

                for(let [index, rec] of _splitEnvelope(envelope).entries()) {
                    let fill = new TGOS.TGFill(map, rec, {
                        fillColor: '#7DFFDD',
                        fillOpacity: 0,
                        strokeColor: '#7DFFDD',
                        strokeWeight: 4,
                        strokeOpacity: 1,
                        zIndex: 50
                    });

                    TGMap.addListener(fill, 'mouseover', () => {
                        enableDialog(districtWPAssessmentData[county][region][index]);
                    });

                    locationAsseFills.simulation.push(fill);
                }

                map.fitBounds(e[0].geometry.viewport);
                map.setZoom(11);
            });

            function _splitEnvelope({top, bottom, left, right}) {
                const height = top - bottom, width = right - left;
                const recs = [];

                if(height > width) {
                    let intervalH = height / 3,
                        intervalW = width / 2,
                        verLine = left + intervalW,
                        horLine1 = bottom + intervalH,
                        horLine2 = bottom + intervalH * 2;

                    recs.push(new TGOS.TGEnvelope(left, top, verLine, horLine2));
                    recs.push(new TGOS.TGEnvelope(verLine, top, right, horLine2));
                    recs.push(new TGOS.TGEnvelope(left, horLine2, verLine, horLine1));
                    recs.push(new TGOS.TGEnvelope(verLine, horLine2, right, horLine1));
                    recs.push(new TGOS.TGEnvelope(left, horLine1, verLine, bottom));
                    recs.push(new TGOS.TGEnvelope(verLine, horLine1, right, bottom));

                }else if(width > height) {
                    let intervalH = height / 2,
                        intervalW = width / 3,
                        verLine1 = left + intervalW,
                        verLine2 = left + intervalW * 2,
                        horLine = bottom + intervalH;

                    recs.push(new TGOS.TGEnvelope(left, top, verLine1, horLine));
                    recs.push(new TGOS.TGEnvelope(left, horLine, verLine1, bottom));
                    recs.push(new TGOS.TGEnvelope(verLine1, top, verLine2, horLine));
                    recs.push(new TGOS.TGEnvelope(verLine1, horLine, verLine2, bottom));
                    recs.push(new TGOS.TGEnvelope(verLine2, top, right, horLine));
                    recs.push(new TGOS.TGEnvelope(verLine2, horLine, right, bottom));

                }else {
                    let interval = height / 2,
                        verLine = left + interval,
                        horLine = bottom + interval;

                    recs.push(new TGOS.TGEnvelope(left, top, verLine, horLine));
                    recs.push(new TGOS.TGEnvelope(left, horLine, verLine, bottom));
                    recs.push(new TGOS.TGEnvelope(verLine, top, right, horLine));
                    recs.push(new TGOS.TGEnvelope(verLine, horLine, right, bottom));
                }

                return recs;
            }
        }

        let chart;
        function enableDialog(data) {
            chart = undefined;

            $('#dialog-container').css({
                'margin-top': '0vh', 'position': 'unset',
                'padding': '2px', 'overflow': 'hidden'
            }).empty().html(`
                <div id="wp-assessment-result-division"></div>
            `).dialog({
                width: 'auto',
                title: '一般型風力發電機組建置評估',
                position: {
                    my: 'right bottom',
                    at: 'center-300px center-50px',
                    of: window
                },
                autoOpen: true,
                resizable: false,
                close: () => {
                    $('#wp-assessment-result-division #grid-table')
                        .jsGrid('destroy');
                    $('#dialog-container')
                        .empty().removeAttr('style');
                }
            }).dialog('open');

            $('#wp-assessment-result-division').html(`
                風機類型: 
                <select id="wg-type">
                    <option value="1">Vestas V60-850 kW onshore</option>
                    <option value="2">Vestas V90 1800 kW onshore</option>
                    <option value="3">Vestas V80 2000 KW offshore</option>
                    <option value="4">Vestas V80 2000 kW onshore</option>
                    <option value="5">Siemens 107 3600 KW  offshore</option>
                    <option value="6">Enercon E-70 2300 KW onshore</option>
                </select>
                <div id="grid-table"></div>
                <canvas id="canvas-wg-result" height="150"></canvas>
            `).css({
                'font-size': '15px',
                'padding-top': '10px'
            });

            $('#wg-type').change(({target}) => {
                _estimate(data['10m風速'],
                    $(target).children('option:selected').val());
            }).trigger('change');

            $('.ui-dialog .ui-widget-header, .ui-dialog .ui-button').css({
                'background': '#b9cd6d',
                'color': '#ffffff',
                'border': '1px solid #b9cd6d'
            });

            dialogIsInit = true;

            function _estimate(velocity, value) {
                const wgs = [
                    {WgNo: 1, WgName: 'Vestas V60-850 kW onshore', Capacity: 850, VMin: 3, VMax: 20, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 60, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], list_fv: [], list_Pv: [0,0,0,10,33,86,160,262,398,568,732,836,848,850,850,850,850,850,850,850,850], list_fvPv: []},
                    {WgNo: 2, WgName: 'Vestas V90 1800 kW onshore', Capacity: 1800, VMin: 4, VMax: 25, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 80, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], list_fv: [], list_Pv: [0,0,0,0,91,200,362,588,889,1255,1604,1769,1798,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800], list_fvPv: []},
                    {WgNo: 3, WgName: 'Vestas V80 2000 KW offshore', Capacity: 2000, VMin: 4, VMax: 25, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 67, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], list_fv: [], list_Pv: [0,0,0,0,67,154,282,460,696,996,1341,1661,1866,1958,1988,1997,2000,2000,2000,2000,2000,2000,2000,2000,2000,2000], list_fvPv: []},
                    {WgNo: 4, WgName: 'Vestas V80 2000 kW onshore', Capacity: 2000, VMin: 4, VMax: 25, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 67, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], list_fv: [], list_Pv: [0,0,0,0,66,152,280,456,684,946,1217,1480,1710,1868,1950,1983,1995,1999,2000,2000,2000,2000,2000,2000,2000,2000], list_fvPv: []},
                    {WgNo: 5, WgName: 'Siemens 107 3600 KW  offshore', Capacity: 3600, VMin: 3, VMax: 25, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 80, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], list_fv: [], list_Pv: [0,0,0,0,80,238,474,802,1234,1773,2379,2948,3334,3515,3557,3594,3599,3600,3600,3600,3600,3600,3600,3600,3600,3600], list_fvPv: []},
                    {WgNo: 6, WgName: 'Enercon E-70 2300 KW onshore', Capacity: 2300, VMin: 2, VMax: 25, V: 0, AirDensity: 1.225, A: 0, K: 2, AvgV: 0, Fullhours: 0, OperatHours: 0, CapFactor: 0, PowerProduct: 0, HubHeight: 64, list_v: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], list_fv: [], list_Pv: [0,0,2,18,56,127,240,400,626,892,1223,1590,1900,2080,2230,2300,2300,2300,2300,2300,2300,2300,2300,2300,2300,2300], list_fvPv: []}
                    ];
                const data = wgs.find((wg) => wg.WgNo === Number(value));

                data.V = velocity;
                data.AvgV = Math.round(data.V * Math.pow((data.HubHeight / 10), (1 / data.V)) * 100) / 100;
                data.A = Math.round(data.AvgV * 1.12 * 100) / 100;
                data.list_fv = [];
                data.list_fvPv = [];
                if(data.list_fv.length === 0) {
                    for (let i = 0; i < data.list_v.length; i++) {
                        // 原系統既有公式
                        let fv = (data.K / data.A) * Math.pow((data.list_v[i] / data.A), data.K - 1)
                            * Math.exp(-Math.pow((data.list_v[i] / data.A), data.K)) * 100;
                        data.list_fv.push(Math.round(fv)); //f(v)風速機率密度函數
                        data.list_fvPv.push(Math.round(fv * data.list_Pv[i] / 100)); //f(v)P(v)功率取線
                    }
                }
                //年發電量
                // 一年總時數 = 24（小時）* 365（天）= 8760小時 ,原系統有問題吧? (因為乘上8760後與系統資料不符)
                //data.PowerProduct = Math.round(data.list_fvPv.reduce((sum, val) => sum + val , 0) * 8760 * 100) / 100;
                data.PowerProduct = Math.round(data.list_fvPv.reduce((sum, val) => sum + val , 0) * 8864.189); //要乘上8864.189才會跟原系統相符
                //容量因素
                data.CapFactor = Math.round(data.list_fvPv.reduce((sum, val) => sum + val , 0) / data.Capacity * 100 * 100) / 100;
                //滿發小時數
                data.Fullhours = Math.round(data.PowerProduct / data.Capacity);

                $('#wp-assessment-result-division #grid-table').jsGrid({
                    width: '36vw',
                    pageSize: 2,
                    data: [data],
                    fields: [
                        {title: '風機高度風速(公尺/秒)', name: 'AvgV', type: 'text', width: '6vw'},
                        {title: '裝置容量(瓩)', name: 'Capacity', type: 'text', width: '6vw'},
                        {title: '風機高度(公尺)', name: 'HubHeight', type: 'text', width: '6vw'},
                        {title: '年發電量(萬瓩/年)', name: 'PowerProduct', type: 'text', width: '6vw'},
                        {title: '容量因素(%)', name: 'CapFactor', type: 'text', width: '6vw'},
                        {title: '滿發時數(小時/年)', name: 'Fullhours', type: 'text', width: '6vw'}
                    ]
                });

                $('.jsgrid').css({
                    'text-align': 'center',
                    'margin-top': '10px',
                    'margin-bottom': '10px'
                });

                if(chart) {
                    chart.data.labels = data.list_v;
                    chart.data.datasets[0].data = data.list_fv;
                    chart.data.datasets[1].data = data.list_Pv;
                    chart.data.datasets[2].data = data.list_fvPv;
                    chart.update();
                }else {
                    let ctx = document.getElementById('canvas-wg-result').getContext('2d');
                    chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: data.list_v,
                            datasets: [{
                                type: 'line',
                                label: '風速機率密度',
                                data: data.list_fv,
                                yAxisID: 'frequency',
                                borderColor: '#7CB5EC',
                                fill: false,
                                pointRadius: 0,
                                lineTension: 0,
                                borderWidth: 2
                            }, {
                                type: 'line',
                                label: '風力機組功率',
                                data: data.list_Pv,
                                yAxisID: 'power',
                                borderColor: '#434348',
                                fill: false,
                                pointRadius: 0,
                                lineTension: 0,
                                borderWidth: 2
                            }, {
                                type: 'line',
                                label: '發電功率',
                                data: data.list_fvPv,
                                yAxisID: 'frequency',
                                borderColor: '#90ED7D',
                                fill: false,
                                pointRadius: 0,
                                lineTension: 0,
                                borderWidth: 2
                            }]
                        },
                        options: {
                            legend: {
                                display: true,
                                labels: {
                                    fontSize: 14,
                                    generateLabels: function (chart) {
                                        let data = chart.data;

                                        return data.datasets.map(function (data, index) {
                                            return {
                                                text: data.label,
                                                fillStyle: 'white',
                                                strokeStyle: data.borderColor,
                                                lineWidth: 3,
                                                hidden: false,
                                                index: index
                                            };
                                        });
                                    }
                                }
                            },
                            tooltips: {
                                intersect: false,
                                mode: 'index',
                                callbacks: {
                                    title: function ([{xLabel}], data) {
                                        return xLabel + '時';
                                    },
                                    label: function ({datasetIndex, index}, {datasets}) {
                                        let currentValue = datasets[datasetIndex].data[index];
                                        return ' ' + datasets[datasetIndex].label + ': ' +
                                            currentValue + ['%', '瓩', '度'][datasetIndex];
                                    },
                                    labelColor: function({datasetIndex}, {data}) {
                                        return {
                                            borderColor: data.datasets[datasetIndex]
                                                .borderColor,
                                            backgroundColor: 'white'
                                        };
                                    },
                                }
                            },
                            scales: {
                                xAxes: [{
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true
                                    }
                                }],
                                yAxes: [{
                                    id: 'frequency',
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true,
                                        stepSize: 10,
                                        fontColor: '#7CB5EC'
                                    },
                                    scaleLabel:{
                                        display: true,
                                        labelString: 'frequency(%), kwh',
                                        fontColor: "#7CB5EC"
                                    }
                                }, {
                                    id: 'power',
                                    distribution: 'series',
                                    position: 'right',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true,
                                        stepSize: 300,
                                        fontColor: '#434348',
                                        callback: function(label, index, labels) {
                                            if(label === 0) return label;
                                            return (label / 1000) + 'k';
                                        }
                                    },
                                    scaleLabel:{
                                        display: true,
                                        labelString: 'power(kw)',
                                        fontColor: "#434348"
                                    }
                                }]
                            }
                        },
                        plugins: [{
                            beforeInit: function(chart, options) {
                                chart.legend.afterFit = function() {
                                    this.height += 12;
                                };
                            }
                        }]
                    });
                }
            }
        }

        function displayIntrusionProbGraph() {
            let map = TGMap.getMap();
            intrusionProbGeometries.forEach(({district, fill, envelope, viewport}) => {
                TGMap.addListener(fill, 'click',  async ({point}) => {
                    $('#wp-assessment-build-division select#county')
                        .children(`option[value="${district}"]`)
                        .prop('selected', true)
                        .trigger('change');

                    let $chkTaiwanHeatMap = $('#wp-assessment-checkbox-group')
                        .children('span[role="checkbox"]:nth-of-type(3)');

                    if($chkTaiwanHeatMap.hasClass('glyphicon-check')) {
                        $chkTaiwanHeatMap.trigger('click');
                    }else if(groundOverlay) {
                        groundOverlay.setMap(null);
                        groundOverlay = undefined;
                    }

                    loadWindVelocityHeatMap(district, envelope);
                    groundOverlay.setMap(map);

                    map.fitBounds(viewport);
                    map.setZoom(9);
                });
                fill.setMap(map);
            });
        }

        function loadWindVelocityHeatMap(location = '全臺', envelope) {
            envelope = envelope ||
                new TGOS.TGEnvelope(119.521, 25.528, 122.2585, 21.608);

            let image = new TGOS.TGImage();
            image.setUrl(`${basicAssetsURL}img/wind-velocity/${location}.png`);

            groundOverlay = new TGOS.TGGroundOverlay();
            groundOverlay.setImage(image);
            groundOverlay.setBounds(envelope);
            groundOverlay.setOpacity(0.7);
        }
        
        function loadTyphoonGeneratePositionData() {
            $.ajax({
                url: basicDataURL + '歷年發佈警特報颱風生成位置及強度.json',
                dataType: 'JSON',
                success: function (json) {
                    for(let [index, {latlng, intensity}] of json.entries()) {
                        if(index > 200) break;

                        let [lng, lat] = latlng.split(', '),
                            color = {
                                '輕度': '#00FF00',
                                '中度': '#0000FF',
                                '強烈': '#FF0000'
                            }[intensity];

                        let circle = new TGOS.TGCircle();
                        circle.setCenter(new TGOS.TGPoint(lng, lat));
                        circle.setRadius(10000);

                        generatePosiFills.push(new TGOS.TGFill(null, circle, {
                            fillColor: color,
                            fillOpacity: 1,
                            strokeColor: color,
                            strokeWeight: 5,
                            strokeOpacity: 1
                        }));
                    }
                }
            });
        }
        
        function loadTyphoonIntrusionProbabilityData() {
            $.ajax({
                url: basicDataURL + '各縣市颱風入侵機率.json',
                dataType: 'JSON',
                success: function (json) {
                    let map = TGMap.getMap();
                    Object.keys(json).forEach((type, index) => {
                        json[type].forEach((district) => {
                            new TGOS.TGLocateService().locateWGS84({
                                district: district
                            }, ([{geometry}], status) => {
                                let {geometry: polygon,
                                    bounds: envelope, viewport} = geometry;
                                let fill = new TGOS.TGFill(map, polygon, {
                                    fillColor: ['#F20554', '#EBE705', '#07ED63'][index],
                                    fillOpacity: .3,
                                    strokeColor: '#000088',
                                    strokeWeight: 1,
                                    strokeOpacity: 1
                                });

                                TGMap.addListener(fill, 'click',  async ({point}) => {
                                    $('#wp-assessment-build-division select#county')
                                        .children(`option[value="${district}"]`)
                                        .prop('selected', true)
                                        .trigger('change');

                                    let $chkTaiwanHeatMap = $('#wp-assessment-checkbox-group')
                                        .children('span[role="checkbox"]:nth-of-type(3)');

                                    if($chkTaiwanHeatMap.hasClass('glyphicon-check')) {
                                        $chkTaiwanHeatMap.trigger('click');
                                    }else if(groundOverlay) {
                                        groundOverlay.setMap(null);
                                        groundOverlay = undefined;
                                    }

                                    loadWindVelocityHeatMap(district, envelope);
                                    groundOverlay.setMap(map);

                                    map.fitBounds(viewport);
                                    map.setZoom(9);
                                });

                                intrusionProbGeometries.push({
                                    district: district,
                                    fill: fill,
                                    envelope: envelope,
                                    viewport: viewport
                                });
                            });
                        });
                    });
                }
            });
        }
    };

    Renderer.InstantPowerSupplyRenderer = function(panelTitle) {
      this.rendererID = 'InstantPowerSupplyRenderer';
      let geoData = undefined,
          fills = [];

      this.rendering = function () {
          let html = `
            <div id="power-supply-infoDivision">
                <h5 id="updated-time">資料載入中...</h5>
                <h6 id="load-current-src"></h6>
                <h6 id="latest-load-perc"></h6>
                <h6 id="reserve-load-src"></h6>
                <h6 id="load-forecast-max-perc"></h6>
                <h6 id="reserve-supply-src"></h6>
                <img id="power-supply-situation-icon">
                <span></span>
            </div>
            <canvas id="canvas-power-supply-contrast" height="340"></canvas>
          `;

          execRendering(panelTitle, html, () => {
              $('#power-supply-infoDivision').children().css('font-weight', 'bolder');
              $.ajax({
                  url: bypassCORS('www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.txt'),
                  dataType: 'TEXT',
                  success: function (data) {
                      data = data.split('\n');

                      //目前用電量
                      let load_current_src = data[2].replace(/"|",|,/g, '');
                      $('#load-current-src').text('目前用電量: ' + (load_current_src / 10)
                          .toFixed(2) + '萬瓩');
                      //預估最高用電
                      let reserve_load_src = data[3].replace(/"|",|,/g, '');
                      $('#reserve-load-src').text('預估最高用電: ' + (reserve_load_src / 10)
                          .toFixed(2) + '萬瓩');
                      //最大供電能力
                      let reserve_supply_src = data[4].replace(/"|",|,/g, '');
                      $('#reserve-supply-src').text('最大供電能力: ' + (reserve_supply_src / 10)
                          .toFixed(2) + '萬瓩');
                      //更新時間
                      let updatedTime = data[5].replace(/"|",/g, '');
                      $('#updated-time').text('今日電力資訊 ' + updatedTime.split(')')[0] +
                          ') ' + updatedTime.split(')')[1]).css('color', '#A52A2A');

                      let today_reserve =
                          (((reserve_supply_src - reserve_load_src) / reserve_load_src) * 100)
                              .toFixed(2),
                          today_reserve_cap = (reserve_supply_src - reserve_load_src)
                          .toFixed(1);

                      if (today_reserve >= 10.00) {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/01-green.png')
                              .css({'width': '20px', 'height': '20px'});
                          $('#power-supply-situation-icon + span').text('供電充裕').css('color', '#008000');
                      } else if ((today_reserve < 10.00) && (today_reserve > 6)) {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/02-yellow.png')
                              .css({'width': '20px', 'height': '20px'});
                          $('#power-supply-situation-icon + span').text('供電吃緊').css('color', '#FFB862');
                      } else if ((today_reserve <= 6.00) && (today_reserve_cap > 900.0)) {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/03-orange.png')
                              .css({'width': '20px', 'height': '20px'});
                          $('#power-supply-situation-icon + span').text('供電緊戒').css('color', '#F97762');
                      } else if ((today_reserve <= 6.00) && (today_reserve_cap <= 900.0) && (today_reserve_cap > 500.0)) {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/04-red.png')
                              .css({'width': '20px', 'height': '20px'});
                          $('#power-supply-situation-icon + span').text('90萬瓩以下，限電警戒').css('color', '#F93C28');
                          //today_reserve_cap = (Math.floor(today_reserve_cap)) / 10;
                          //$("#reserve").html("<span class='blue'>" + today_reserve_cap + "&nbsp;萬瓩 (" + today_reserve + "%)</span>");
                      } else if ((today_reserve <= 6.00) && (today_reserve_cap <= 500.0)) {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/05-black.png')
                              .css({'width': '20px', 'height': '20px'});
                          $('#power-supply-situation-icon + span').text('50萬瓩以下，限電警戒').css('color', '#F93C28');
                          //today_reserve_cap = (Math.floor(today_reserve_cap)) / 10;
                          //$("#reserve").html("<span class='blue'>" + today_reserve_cap + "&nbsp;萬瓩 (" + today_reserve + "%)</span>");
                      } else {
                          $('#power-supply-situation-icon')
                              .attr('src', 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/01-green.png')
                              .css({'width': '20px', 'height': '20px'});
                      }

                      //目前使用率
                      let current_sys_performance = Math.floor((load_current_src / reserve_supply_src) * 100);
                      $('#latest-load-perc').text('目前使用率: ' + current_sys_performance + '%');
                      //尖峰使用率
                      let peak_sys_performance = Math.floor((reserve_load_src / reserve_supply_src) * 100);
                      $('#load-forecast-max-perc').text('尖峰使用率: ' + peak_sys_performance + '%');
                      $('#power-supply-infoDivision').after('<hr />');
                  }
              });

              fetchTaipowerData().then((results) => {
                  renderingMap();

                  let data = {
                      date: [],
                      yesterday: [],
                      today: [],
                  };

                  for(let {date, yesterday, today} of results) {
                      data.date.push(date.substring(0, 5));
                      data.yesterday.push({
                          t: date,
                          y: yesterday
                      });
                      data.today.push({
                          t: date,
                          y: today
                      });
                  }

                  fetch(bypassCORS('www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.txt'))
                      .then((response) => response.text())
                      .then((results) => {
                          let max_supply = Number(results.split('\n')[4]
                              .replace(/"|",|,/g, ''));
                          max_supply /= 10;

                          let yAxes_max;
                          if(max_supply >= 4500) {
                              if(max_supply >= 4900) {
                                  yAxes_max = 5500;
                              }else {
                                  yAxes_max = 5000;
                              }
                          }else if(max_supply >= 4000) {
                              if(max_supply >= 4400) {
                                  yAxes_max = 5000;
                              }else {
                                  yAxes_max = 4500;
                              }
                          }else if(max_supply >= 3500) {
                              if(max_supply >= 3900) {
                                  yAxes_max = 4500;
                              }else {
                                  yAxes_max = 4000;
                              }
                          }else {
                              if(max_supply >= 3400) {
                                  yAxes_max = 4000;
                              }else {
                                  yAxes_max = 3500;
                              }
                          }

                          let ctx = document.getElementById('canvas-power-supply-contrast').getContext('2d');
                          new Chart(ctx, {
                              type: 'bar',
                              data: {
                                  labels: data.date,
                                  datasets: [{
                                      type: 'line',
                                      label: '今日用電',
                                      data: data.today,
                                      backgroundColor: Chart.helpers.color('red')
                                          .alpha(0.5).rgbString(),
                                      borderColor: 'red',
                                      pointRadius: 0,
                                      fill: true,
                                      lineTension: 0,
                                      borderWidth: 2
                                  }, {
                                      type: 'line',
                                      label: '昨日用電',
                                      data: data.yesterday,
                                      backgroundColor: Chart.helpers.color('blue')
                                          .alpha(0.5).rgbString(),
                                      borderColor: 'blue',
                                      pointRadius: 0,
                                      fill: true,
                                      lineTension: 0,
                                      borderWidth: 2
                                  }]
                              },
                              options: {
                                  scales: {
                                      xAxes: [{
                                          distribution: 'series',
                                          ticks: {
                                              source: 'data',
                                              autoSkip: true
                                          }
                                      }],
                                      yAxes: [{
                                          ticks: {
                                              max: yAxes_max
                                          }
                                      }]
                                  },
                                  title: {
                                      display: true,
                                      text: '今日 vs. 昨日用電曲線圖(單位:萬瓩)'
                                  },
                                  tooltips: {
                                      intersect: false,
                                      mode: 'index'
                                  },
                                  annotation: {
                                      annotations: [{
                                          type: 'line',
                                          mode: 'horizontal',
                                          scaleID: 'y-axis-0',
                                          value: max_supply,
                                          borderColor: 'rgb(245, 227, 50)',
                                          borderWidth: 2,
                                          label: {
                                              backgroundColor: 'rgba(245, 227, 50, 0.8)',
                                              content: '最大供電: ' + max_supply
                                                  .toFixed(2) + '萬瓩',
                                              fontSize: 10,
                                              fontColor: 'black',
                                              enabled: true,
                                              position: 'center'
                                          }
                                      }]
                                  }
                              },
                              plugins: [{
                                  beforeInit: function(chart, options) {
                                      chart.legend.afterFit = function() {
                                          this.height += 20;
                                      };
                                  }
                              }]
                          });
                      });
              });
          });
      };

      this.empty = function () {
          if(geoData) geoData.setMap(null);

          for(let fill of fills) {
              fill.setMap(null);
          }
          fills.length = 0;
      };

      function renderingMap() {
          let map = TGMap.getMap();
          geoData = new TGOS.TGData({
              map: map
          });

          geoData.loadGeoJson(basicDataURL + '臺灣區域分區範圍.geojson',
              {idPropertyName: 'geoJSON'}, function (graphic) {
                  for(let i = 0; i < graphic.length; i++) {
                      let properties = graphic[i].properties;
                      geoData.overrideStyle(graphic[i], {
                          'strokeColor': properties['stroke'],
                          'strokeWeight': properties['stroke-width'],
                          'strokeOpacity': properties['stroke-opacity'],
                          'fillColor': regionUsageColor[properties['region']],
                          'fillOpacity': properties['fill-opacity'],
                      });
                  }
                  geoData.setMap(map);
              });

          [{district: '澎湖縣', region: '南部'}, {district: '蘭嶼鄉', region: '東部'}]
              .forEach(({district, region}) => {
                  new TGOS.TGLocateService().locateWGS84({
                      district: district
                  }, (e, status) => {
                      let polygon = e[0].geometry.geometry;
                      fills.push(new TGOS.TGFill(map, polygon, {
                          fillColor: regionUsageColor[region],
                          fillOpacity: .5,
                          strokeColor: '#000000',
                          strokeWeight: 1,
                          strokeOpacity: 1
                      }));
                  });
              });
      }

      function fetchTaipowerData() {
          async function _fetch() {
              const urls = [
                  bypassCORS('www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadfueltype.csv'),
                  bypassCORS('www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadfueltype_1.csv')
              ];

              return await Promise.all(urls.map(async (url, index) => {
                  let response = await fetch(url);
                  let data = await response.text();
                  return parseCSV(data, index);
              }));
          }

          return _fetch().then((data) => {
              const JSON = [];
              const [dataToday, dataYesterday] = data;

              for (let index in dataYesterday) {
                  let date = String(dataYesterday[index].date)
                      .split(' ')[4];
                  JSON.push({
                      date: date,
                      yesterday: dataYesterday[index].value,
                      today: dataToday[index].value
                  });
              }
              return JSON;
          });
      }

      function parseCSV(data, arg) {
          data = data.replace(/\r\n|\r/g, '\n');
          let dataProvider = [],
              minDate = null;

          for(let row of data.split('\n', 144)) {
              if (row) {
                  let [time, ...values] = row.split(',');

                  if(time) {
                      (time.length === 5) ?
                          minDate = time : console.error('Date Format incorrect!');

                      let date = _parseDate(minDate, arg);
                      if(!values[0]) {
                          dataProvider.push({
                              date: date
                          });
                      }else {
                          let sum = 0;
                          values.forEach((value => sum += Number(value)));
                          dataProvider.push({
                              date: date,
                              value: sum.toFixed(1)
                          });
                      }
                  }else {
                      let dateNow = _parseDate(minDate, arg),
                          dateBound = _parseDate(minDate);
                      let tenMinutesToMilliseconds = 60 * 10 * 1000;
                      for(let time = dateNow.getTime(); time < dateBound.getTime(); time += tenMinutesToMilliseconds) {
                          dataProvider.push({
                              date: new Date(time)
                          });
                      }
                      break;
                  }
              }
          }
          return dataProvider;

          function _parseDate(dateString, arg = -1) {
              let dateArray = dateString.split(':');
              let now = new Date();
              now.setDate(now.getDate() - arg);

              if(arg < 0) {
                  return new Date(now.getFullYear(), now.getMonth(),
                      now.getDate(), '00', '00', '00');
              }else {
                  return new Date(now.getFullYear(), now.getMonth(),
                      now.getDate(), Number(dateArray[0]), Number(dateArray[1]), '00');
              }
          }
      }
    };

    Renderer.EstimateElectricityInformationRenderer = function(panelTitle) {
        this.rendererID = 'EstimateElectricityInformationRenderer';
        let estimateData = undefined,
            dialogIsInit = false;

        this.rendering = function () {
            let html = `
                <h5 id="estimate-elec-text" class="font-weight-bold">資料載入中...</h5>
                <div id="estimate-elec-results-division" style="display: none;">
                    <button id="btnNextWeek" class="btn btn-xs" 
                        style="background-color: #7D92FF">未來一週</button>
                    <button id="btnNextTwoMonths" class="btn btn-xs" 
                        style="background-color: #BECCFF">未來二個月</button>
                    <div style="width: 290px; margin-top: 20px;">
                        <canvas id="canvas-estimate-maximum-capability" width="280" height="300" 
                          style="margin-left: -20px; margin-bottom: 10px;"></canvas>
                        <canvas id="canvas-estimate-reserve-margin" width="280" height="300" 
                          style="margin-left: -20px;"></canvas>
                    </div>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                fetchData().then((json) => {
                    $('#estimate-elec-text').remove();
                    $('#estimate-elec-results-division').show();
                    estimateData = json;
                    drawChart();
                });

                $('#btnNextWeek').click(function() {
                    if($(this).css('background-color') !== '#7D92FF') {
                        $(this).css('background-color', '#7D92FF');
                        $('#btnNextTwoMonths').css('background-color', '#BECCFF');

                        drawChart('nextWeek');
                    }
                });

                $('#btnNextTwoMonths').click(function() {
                    if($(this).css('background-color') !== '#7D92FF') {
                        $(this).css('background-color', '#7D92FF');
                        $('#btnNextWeek').css('background-color', '#BECCFF');

                        drawChart('nextTwoMonths');
                    }
                });
            });
        };

        this.empty = function () {
            if(dialogIsInit) {
                $('#dialog-container')
                    .dialog('close').dialog('destroy');
            }
            capabilityChart = marginChart = undefined;
        };

        let capabilityChart, marginChart;
        function drawChart(type = 'nextWeek') {
            let data = estimateData[type];
            _draw(capabilityChart, 'capability');
            _draw(marginChart, 'margin');
            enableDialog(type);

            function _draw(target, type) {
                let _title = type === 'capability' ? '淨尖峰供電能力' : '備轉容量',
                    _color = type === 'capability' ? '#FFFF00' : '#FFCD38',
                    _data = Object.keys(data).map((date) => data[date][_title]);

                if(target) {
                    target.data.labels = Object.keys(data);
                    target.data.datasets[0].data = _data;
                    target.update();
                }else {
                    let ctx = document.getElementById(type === 'capability' ?
                        'canvas-estimate-maximum-capability' : 'canvas-estimate-reserve-margin').getContext('2d');
                    let chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: Object.keys(data),
                            datasets: [{
                                type: 'line',
                                label: _title,
                                data: _data,
                                backgroundColor: Chart.helpers.color(_color)
                                    .alpha(0.5).rgbString(),
                                borderColor: _color,
                                pointRadius: 0,
                                fill: true,
                                lineTension: 0,
                                borderWidth: 2
                            }]
                        },
                        options: {
                            scales: {
                                xAxes: [{
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true
                                    }
                                }]
                            },
                            title: {
                                display: true,
                                text: _title + '(單位: 萬瓩)'
                            },
                            tooltips: {
                                intersect: false,
                                mode: 'index'
                            },
                            legend: {
                                onClick: (e, legendItem) => {}
                            }
                        },
                        plugins: [{
                            beforeInit: function(chart, options) {
                                chart.legend.afterFit = function() {
                                    this.height += 20;
                                };
                            }
                        }]
                    });

                    type === 'capability' ?
                        capabilityChart = chart :
                        marginChart = chart;
                }
            }
        }

        function enableDialog(type) {
            let data = Object.keys(estimateData[type]).map((date) => {
                let {淨尖峰供電能力, 尖峰負載, 備轉容量, 備轉容量率} =
                    estimateData[type][date];

                let status = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/03-orange.png';
                if(備轉容量率 >= 10) {
                    status = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/01-green.png';
                }else if(備轉容量率 >= 6) {
                    status = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/02-yellow.png';
                }else if(備轉容量 <= 90) {
                    status = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/04-red.png';
                }else if(備轉容量 <= 50) {
                    status = 'https://www.taipower.com.tw/d006/loadGraph/loadGraph/images/05-black.png';
                }

                return {
                    '日期': date,
                    '淨尖峰供電能力(萬瓩)': 淨尖峰供電能力,
                    '尖峰負載(萬瓩)': 尖峰負載,
                    '備轉容量(萬瓩)': 備轉容量,
                    '備轉容量率(%)': 備轉容量率,
                    '備轉容量燈號': status
                };
            });

            $('#dialog-container').css({
                'margin-top': '0vh', 'position': 'unset',
                'padding': '2px', 'overflow': 'hidden'
            }).empty().html(`
                <div id="estimate-elect-grid-table"></div>
            `).dialog({
                width: 'auto',
                title: (type === 'nextWeek' ? '未來一週' : '未來二個月') + '預估電力資訊',
                position: {
                    my: 'right bottom',
                    at: 'center-200px center-50px',
                    of: window
                },
                autoOpen: true,
                resizable: false,
                close: () => {
                    $('#estimate-elect-grid-table').jsGrid('destroy');
                    $('#dialog-container')
                        .empty().removeAttr('style');
                }
            }).dialog('open');

            $('#estimate-elect-grid-table').jsGrid({
                width: '48vw',
                pageSize: 8,
                data: data,
                fields: [
                    {name: '日期', type: 'text', width: '8vw'},
                    {name: '淨尖峰供電能力(萬瓩)', type: 'text', width: '8vw'},
                    {name: '尖峰負載(萬瓩)', type: 'text', width: '8vw'},
                    {name: '備轉容量(萬瓩)', type: 'text', width: '8vw'},
                    {name: '備轉容量率(%)', type: 'text', width: '8vw'},
                    {name: '備轉容量燈號', width: '8vw',
                        itemTemplate: (val, item) =>
                            $('<img>').attr('src', val).css({
                                height: 30, width: 30
                            })
                    }
                ]
            }).find('.jsgrid-grid-body tr').css('height', '3rem');

            $('.ui-dialog .ui-widget-header, .ui-dialog .ui-button').css({
                'background': '#FFEDA5',
                'border': '1px solid #FFEDA5'
            });

            $('.jsgrid').css({
                'font-size': '15px',
                'text-align': 'center',
                'background': 'white'
            });

            dialogIsInit = true;
        }

        async function fetchData() {
            const JSON = {
                nextWeek: {},
                nextTwoMonths: {}
            };

            await Promise.all([
                _fetchData(JSON.nextWeek, 'www.taipower.com.tw/d006/loadGraph/loadGraph/data/reserve_forecast.txt',
                    ['淨尖峰供電能力', '尖峰負載', '備轉容量率', '備轉容量']),
                _fetchData(JSON.nextTwoMonths, 'www.taipower.com.tw/d006/loadGraph/loadGraph/data/reserve_forecast_month.txt',
                    ['淨尖峰供電能力', '尖峰負載', '備轉容量', '備轉容量率'], 10)
            ]);
            return JSON;

            function _fetchData(provider, url, title, scale = 1) {
                return fetch(bypassCORS(url))
                    .then((response) => response.text())
                    .then((results) => {
                        let data = results.split(/\r?\n|\r/);

                        data.forEach((data) => {
                            let [date, ...d] = data.split(',');

                            if(date.startsWith('<')) {
                                return false;
                            }else if(['上', '中', '下']
                                .some(ele => date.includes(ele))) {
                                let year = date.split('/')[0],
                                    month = date.split('/')[1],
                                    section = date.split('/')[2];
                                date = `${year}年${month}月${section}旬`;
                            }

                            provider[date] = {};
                            d.forEach((d, index) => {
                                provider[date][title[index]] =
                                    d / ((title[index] !== '備轉容量率') ? scale : 1);
                            });
                        });
                    });
            }
        }
    };

    Renderer.CountiesElecConsumptionRenderer = function(panelTitle) {
        this.rendererID = 'CountiesElecConsumptionRenderer';
        let fill = undefined,
            wmsLayer = undefined;

        this.rendering = function () {
            let html = `
              <span role="checkbox" id="chk-heat-map" class="glyphicon glyphicon-unchecked font-weight-bold cursor-pointer">疊加全臺農林漁牧業商家熱區圖</span>
              <hr />
              <select id="county"></select>
              <select id="year"></select>
              <select id="month"></select>
              <div style="width: 300px;">
                <canvas id="canvas-elect-consumption" width="300" height="350" 
                      style="margin-top: 60px; margin-left: -20px;"></canvas>
              </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData();
                let $county = $(`#info-div-body-${panelTitle} > #county`),
                    $year = $(`#info-div-body-${panelTitle} > #year`),
                    $month = $(`#info-div-body-${panelTitle} > #month`);

                $county.append(`<option value="合計">合計</option>`);
                districtsData.adms.forEach((district) => {
                    $county.append(`<option value="${district}">${district}</option>`);
                });

                $year.append(`<option value="" selected disabled>選擇年份</option>`);
                Object.keys(JSON).forEach((year) => {
                    $year.append(`<option value="${year}">${year}</option>`);
                });

                $year.change(() => {
                    $month.empty();
                    let year = $year.children('option:selected').val();

                    Object.keys(JSON[year]).reverse().forEach((month) => {
                        $month.append(`<option value="${month}">${month}</option>`);
                    });

                    drawChart();
                });
                $month.change(() => drawChart());
                $county.change(() => drawChart());

                let pieChart, prevCounty;
                let drawChart = () => {
                    let county = $county.children('option:selected').val().replace('臺', '台'),
                        year = $year.children('option:selected').val(),
                        month = $month.children('option:selected').val();

                    if(!(county && year && month)) return;

                    let json = JSON[year][month][county],
                        data = [
                            json['住宅部門售電量(度)'],
                            json['服務業部門售電量(度)'],
                            json['機關用電售電量(度)'],
                            json['農林漁牧售電量(度)']
                        ];

                    if(pieChart) {
                        pieChart.data.datasets[0].data = data;
                        pieChart.options.title.text = county + year + month + '用電比例';
                        pieChart.update();
                    }else {
                        let ctx = document.getElementById('canvas-elect-consumption').getContext('2d');
                        pieChart = new Chart(ctx, {
                            type: 'pie',
                            data: {
                                labels: ['住宅', '服務業', '機關', '農林漁牧'],
                                datasets: [{
                                    data: data,
                                    backgroundColor: ['#FFFF77', '#5599FF', '#FF8888', '#F0F8FF'],
                                    hoverBorderColor: '#FFFFFF'
                                }]
                            },
                            options: {
                                animation: {
                                    animateScale: true,
                                    animateRotate: true
                                },
                                tooltips: {
                                    callbacks: {
                                        label: function (tooltipItem, data) {
                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                return Number(accumulator) + Number(currentValue);
                                            });
                                            let currentValue = dataset.data[tooltipItem.index];
                                            let percent = Math.round(((currentValue / sum) * 100));
                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                        }
                                    }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        fontSize: 14,
                                        generateLabels: function (chart) {
                                            let data = chart.data;

                                            return data.labels.map(function (label, index) {
                                                let ds = data.datasets[0];
                                                let arc = chart.getDatasetMeta(0).data[index];
                                                let custom = arc && arc.custom || {};
                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                let arcOpts = chart.options.elements.arc;

                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                let thousandComma = (number) => {
                                                    let num = number.toString();
                                                    let pattern = /(-?\d+)(\d{3})/;

                                                    while (pattern.test(num)) {
                                                        num = num.replace(pattern, '$1,$2');
                                                    }
                                                    return num;
                                                };

                                                return {
                                                    text: label + ' : ' + thousandComma(value) + '度',
                                                    fillStyle: fill,
                                                    strokeStyle: 'white',
                                                    lineWidth: 2,
                                                    hidden: isNaN(ds.data[index]) || chart.getDatasetMeta(0).data[index].hidden,
                                                    index: index
                                                };
                                            });
                                        }
                                    }
                                },
                                title: {
                                    display: true,
                                    text: county + year + month + '用電比例'
                                }
                            },
                            plugins: [{
                                beforeInit: function(chart, options) {
                                    chart.legend.afterFit = function() {
                                        this.height += 50;
                                    };
                                }
                            }]
                        });
                    }

                    if((!prevCounty && county !== '合計' )|| (county !== '合計'
                        && prevCounty !== county)) {
                        locateCounty(county);
                    }else if(county === '合計' && prevCounty !== county) {
                        if(fill) fill.setMap(null);
                        TGMap.reset();
                    }
                    prevCounty = county;
                };

                $('#chk-heat-map').click((e) => {
                    let target = e.target;
                    if($(target).hasClass('glyphicon-check')) {
                        $(target).removeClass('glyphicon-check')
                            .addClass('glyphicon-unchecked');
                        wmsLayer.removeWmsLayer();
                    }else {
                        $(target).removeClass('glyphicon-unchecked')
                            .addClass('glyphicon-check');
                        loadHeatMap();
                    }
                });
            });
        };

        this.empty = function () {
            if(fill) fill.setMap(null);
            if(wmsLayer) wmsLayer.removeWmsLayer();
        };

        function locateCounty(county) {
            let map = TGMap.getMap();
            new TGOS.TGLocateService().locateWGS84({
                district: county
            }, (e, status) => {
                if(fill) fill.setMap(null);

                let polygon = e[0].geometry.geometry;
                fill = new TGOS.TGFill(map, polygon, {
                    fillColor: '#FAF093',
                    fillOpacity: 0.6,
                    strokeColor: '#FAF093',
                    strokeWeight: 1,
                    strokeOpacity: 1
                });

                map.fitBounds(e[0].geometry.viewport);
                map.setZoom(10);
            });
        }
        
        function loadHeatMap() {
            const url = 'https://maps.moea.gov.tw/moeagis/services/EGIS_Business/MapServer/WMSServer' +
                '?request=GetMap&SERVICE=WMS&LAYERS=%E8%BE%B2%E6%9E%97%E6%BC%81%E7%89%A7%E6%A5%AD&SRS=CRS:84&' +
                'FORMAT=image/png&BBOX=120.07219989872554,21.787762704957707,122.36031047537082,25.385851354059128&WIDTH=800&HEIGHT=1000&styles=&version=1.1.1';
            wmsLayer = new TGOS.TGWmsLayer(url, {
                map: TGMap.getMap(),
                preserveViewport: true,
                wsVisible: true,
                zIndex: 1,
                opacity: 0.5
            });
        }

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-各縣市住宅、服務業及機關用電統計資料.csv',
                dataType: 'TEXT',
                async: false,
                success: function(csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let [date, county, ...d] = data.split(',');
                        let [year, month] = date.split('年');
                        year += '年';

                        if(!JSON[year]) {
                            JSON[year] = {};
                            JSON[year][month] = {};
                        }else if(!JSON[year][month]) {
                            JSON[year][month] = {};
                        }
                        JSON[year][month][county] = {};

                        d.forEach((d, index) => {
                            JSON[year][month][county][title[index + 2]] = d;
                        });
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.WindPlantRenderer = function(panelTitle) {
        this.rendererID = 'WindPlantRenderer';
        let geoData = undefined,
            markerCluster = undefined,
            searchMarker = undefined,
            markers = [];
        let map = TGMap.getMap(),
            graphicDict = {},
            dialogIsInit = false,
            prevCode;

        this.rendering = function () {
            let html = `
                <label class="font-weight-bold">查詢地址是否位於風力發電廠供電範圍內：</label>
                <div class="input-group mb-3">
                  <input id="wp-simul-addr" type="text" class="form-control" placeholder="請輸入地址...">
                  <div class="input-group-append">
                    <button id="btnAddrSearch" class="btn btn-outline-secondary">查詢</button>
                  </div>
                </div>
                <div id="error-messages" style="display: none"></div>
                <label class="font-weight-bold">特定條件搜尋：</label>
                <div style="margin-bottom: -0.5rem!important;">
                    <div class="input-group" style="width: 60%; margin-bottom: 5px;">
                        <div class="input-group-prepend">
                            <div class="input-group-text">
                                <input type="radio" name="wp-simul-radio" data-bind="vendor" checked>
                            </div>
                        </div>
                        <select id="vendor" class="custom-select">
                            <option value="" selected disabled>廠商</option>
                            <option value="台電">台電</option>
                            <option value="觀威">觀威</option>
                            <option value="桃威">桃威</option>
                            <option value="豐威">豐威</option>
                            <option value="崎威">崎威</option>
                            <option value="龍威">龍威</option>
                            <option value="通威">通威</option>
                            <option value="安威">安威</option>
                            <option value="中威">中威</option>
                            <option value="鹿威">鹿威</option>
                            <option value="東和鋼鐵">東和鋼鐵</option>
                            <option value="清風風力">清風風力</option>
                            <option value="海洋風力">海洋風力</option>
                            <option value="苗栗風力">苗栗風力</option>
                            <option value="全部">全部</option>
                        </select>
                    </div>
                    <div class="input-group" style="width: 60%;">
                        <div class="input-group-prepend">
                            <div class="input-group-text">
                                <input type="radio" name="wp-simul-radio" data-bind="brand">
                            </div>
                        </div>
                        <select id="brand" class="custom-select" disabled>
                            <option value="" selected disabled>廠牌</option>
                            <option value="GE">GE</option>
                            <option value="Enercon">Enercon</option>
                            <option value="Gamesa">Gamesa</option>
                            <option value="Vestas">Vestas</option>
                            <option value="Zephyros">Zephyros</option>
                            <option value="Siemens">Siemens</option>
                            <option value="全部">全部</option>
                        </select>
                    </div>
                    <button id="btnFeaturesSearch" class="btn btn-outline-secondary" 
                        style="position: relative; right: -72%; margin-top: -44%;">查詢</button>
                </div>
                <div id="wp-simul-checkbox-group">
                    <span role="checkbox" class="glyphicon glyphicon-check font-weight-bold cursor-pointer">以群聚標記點顯示</span>
                    <span role="checkbox" class="glyphicon glyphicon-check font-weight-bold cursor-pointer">顯示供電範圍</span>
                </div>
                <div style="margin-top: 10px;">
                    <label id="wp-supply-color-grading-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer">供電群集<label>裝置容量</label>分級:<br/>　(單位:瓩)</label>
                    <div id="wp-supply-color-grading-body" style="padding-left: 8px;">
                        <label id="color-grading-one-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer" style="line-height: 1.5; margin-top: 10px;"><label class="color-chart" style="background: linear-gradient(#FFFF6F, #FFFF37, #F9F900, #FFE153, #FFD306); margin-left: 10px;">　　</label></label>　< 13000 (4.95%)<br/>
                        <div id="color-grading-one-body" style="padding-left: 40px;">
                            <label class="color-chart" style="background: #FFFF6F;">　　</label><label id="A">　3,960 (${(((3960 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FFFF37;">　　</label><label id="H">　4,000 (${(((4000 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #F9F900;">　　</label><label id="N">　4,500 (${(((4500 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FFE153;">　　</label><label id="M">　10,200 (${(((10200 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FFD306;">　　</label><label id="D">　11,500 (${(((11500 / 690460) * 100)).toFixed(2)}%)</label><br/>
                        </div>
                        <label id="color-grading-two-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer" style="line-height: 1.5;"><label class="color-chart" style="background: linear-gradient(#FFBB77, #FFAF60, #FFA042, #FF9224); margin-left: 10px;">　　</label></label>　13000 ~ 60000 (17.65%)<br/>
                        <div id="color-grading-two-body" style="padding-left: 40px;">
                            <label class="color-chart" style="background: #FFBB77;">　　</label><label id="B">　13,200 (${(((13200 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FFAF60;">　　</label><label id="G">　27,600 (${(((27600 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FFA042;">　　</label><label id="E">　34,700 (${(((34700 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FF9224;">　　</label><label id="J">　46,300 (${(((46300 / 690460) * 100)).toFixed(2)}%)</label><br/>
                        </div>
                        <label id="color-grading-three-title" class="glyphicon glyphicon-menu-down font-weight-bold cursor-pointer" style="line-height: 1.5;"><label class="color-chart" style="background: linear-gradient(#FF8F59, #FF8040, #FF5809, #F75000, #D94600); margin-left: 10px;">　　</label></label>　> 60000 (77.40%)<br/>
                        <div id="color-grading-three-body" style="padding-left: 40px;">
                            <label class="color-chart" style="background: #FF8F59;">　　</label><label id="L">　74,000 (${(((74000 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FF8040;">　　</label><label id="C">　87,400 (${(((87400 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #FF5809;">　　</label><label id="I">　89,700 (${(((89700 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #F75000;">　　</label><label id="F">　101,800 (${(((101800 / 690460) * 100)).toFixed(2)}%)</label><br/>
                            <label class="color-chart" style="background: #D94600;">　　</label><label id="K">　181,600 (${(((181600 / 690460) * 100)).toFixed(2)}%)</label><br/>
                        </div>
                    </div>
                </div>
                <hr />
                <div id="wp-info-division">
                    點擊地圖上的發電廠圖示或供電範圍區塊可查看詳細資訊
                </div>
                <hr />
                <div id="wp-simul-search-division"></div>
            `;

            execRendering(panelTitle, html, () => {
                $('#wp-supply-color-grading-body')
                    .children('label').css('cursor', 'pointer');
                geoData = new TGOS.TGData({
                    map: map
                });

                geoData.loadGeoJson(basicDataURL + '風力發電廠預估供電範圍.geojson',
                    {idPropertyName: 'geoJSON'}, function (graphic) {
                        createMarkers();
                        enableMarkerCluster();

                        for(let i = 0; i < graphic.length; i++) {
                            let properties = graphic[i].properties;
                            geoData.overrideStyle(graphic[i], {
                                'strokeColor': properties['stroke'],
                                'strokeWeight': properties['stroke-width'],
                                'strokeOpacity': properties['stroke-opacity'],
                                'fillColor': properties['fill'],
                                'fillOpacity': properties['fill-opacity'],
                            });
                            graphicDict[properties['code']] = graphic[i];

                            TGMap.addListener(graphic[i], 'click', (e) => {
                                displayPlantGroup(e.graphic.properties['code']);

                                map.fitBounds(e.point.Envelope);
                                map.setZoom(12);
                            })
                        }
                        geoData.setMap(map);
                    });

                $('input[name="wp-simul-radio"]').change((e) => {
                    let select = $(e.target).attr('data-bind');
                    $('#' + select).removeAttr('disabled');
                    $({'vendor': '#brand', 'brand': '#vendor'}[select])
                        .attr('disabled', '');
                });

                $('#wp-simul-checkbox-group').children('span[role="checkbox"]:nth-of-type(1)')
                    .click((e) => {
                        let target = e.target;
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            disableMarkerCluster();
                            createMarkers();
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            enableMarkerCluster();
                        }
                    });

                $('#wp-simul-checkbox-group').children('span[role="checkbox"]:nth-of-type(2)')
                    .click((e) => {
                        let target = e.target,
                            $title = $('#wp-supply-color-grading-title');
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            if($title.hasClass('glyphicon-menu-down')) {
                                $title.trigger('click');
                            }
                            geoData.setMap(null);
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            if($title.hasClass('glyphicon-menu-right')) {
                                $title.trigger('click');
                            }
                            geoData.setMap(map);
                        }
                    });

                $('#wp-supply-color-grading-title label')
                    .attr('title', `此處裝置容量係指發電機組每小時所能產生的最大電量。`)
                    .css('cursor', 'pointer')
                    .tooltip();

                bindCollapsible('#wp-supply-color-grading-title');
                bindCollapsible('#color-grading-one-title', true);
                bindCollapsible('#color-grading-two-title', true);
                bindCollapsible('#color-grading-three-title', true);

                $('#wp-supply-color-grading-body > label label')
                    .addClass('cursor-pointer')
                    .click((e) => $(e.target).parent().trigger('click'));

                $('#wp-supply-color-grading-body div label:nth-of-type(even)').click((e) => {
                    let code = $(e.target).attr('id');
                    displayPlantGroup(code);

                    map.fitBounds(graphicDict[code].geometry.Envelope);
                    map.setZoom(12);
                });

                $('#wp-supply-color-grading-body div label:nth-of-type(odd)').click((e) => {
                    let code = $(e.target.nextSibling).attr('id');
                    displayPlantGroup(code);

                    map.fitBounds(graphicDict[code].geometry.Envelope);
                    map.setZoom(12);
                });

                $('#btnAddrSearch').click(() => {
                    let val = $('input#wp-simul-addr').val().replace('台', '臺');
                    if(!val || val.length === 0) return;

                    new TGOS.TGLocateService().locateWGS84({
                        address: val
                    }, function(e, status) {
                        let $div = $('#wp-simul-search-division');
                        let accordGroup = Object.keys(graphicDict).filter((code) => {
                            let county = graphicDict[code].properties.county;
                            if(Array.isArray(county)) {
                                let temp = county.filter((coun) =>
                                    coun === val.substring(0, 3)).join('');
                                return temp && temp.length !== 0;
                            }
                            return county === val.substring(0, 3);
                        });

                        if(status !== TGOS.TGLocatorStatus.OK) {
                            $('#error-messages')
                                .css({'display': 'block', 'color': '#FFC849',
                                    'margin': '-13px 0px 10px 6px',
                                    'font-weight': 'bolder', 'font-size': '15px'})
                                .text(val + '不是正確或明確的地址');
                            return;
                        }else if(!accordGroup.length) {
                            if(searchMarker) searchMarker.setMap(null);
                            $div.html(`
                                <h5 style="font-weight: bolder; color: #A03B0A;">查詢結果</h5>
                                <span style="font-weight: bolder; color: #F93C28;">${val}未包含在風力發電廠的供電範圍內</span>
                            `);
                        }else {
                            let {x, y} = e[0].geometry.location;
                            for(let code of accordGroup) {
                                if(searchMarker) searchMarker.setMap(null);

                                if(isPointInPolygon(x, y,
                                    graphicDict[code].geometry.rings_[0].linestring.path)) {
                                    $div.html(`
                                        <h5 style="font-weight: bolder; color: #A03B0A;">查詢結果</h5>
                                        <span style="font-weight: bolder; color: #F3AE15;">${val}有包含在${code}群集的風力發電廠的供電範圍內</span>
                                    `);

                                    searchMarker = new TGOS.TGMarker(map, new TGOS.TGPoint(x, y));
                                    searchMarker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/red-dot.png'));
                                    TGMap.addListener(searchMarker, 'click', () => {
                                        displayPlantGroup(code);

                                        map.fitBounds(e[0].geometry.viewport);
                                        map.setZoom(12);
                                    });
                                    displayPlantGroup(code);

                                    map.fitBounds(e[0].geometry.viewport);
                                    map.setZoom(12);
                                    break;
                                }else {
                                    $div.html(`
                                        <h5 style="font-weight: bolder; color: #A03B0A;">查詢結果</h5>
                                        <span style="font-weight: bolder; color: #F93C28;">${val}未包含在風力發電廠的供電範圍內</span>
                                    `);
                                }
                            }
                        }

                        $('#error-messages')
                            .css('display', 'none')
                            .text('');

                        $(`#info-div-body-${panelTitle}`).animate({
                            scrollTop: $div.offset().top
                        }, 800);
                    });
                });

                $('#btnFeaturesSearch').click(() => {
                    let select = $('input[name="wp-simul-radio"]:checked').attr('data-bind');
                    enableDialog($(`#${select}`).attr('id'),
                        $(`#${select} option:selected`).val());
                });
            });
        };

        this.empty = function () {
            disableMarkerCluster();

            if(dialogIsInit) {
                $('#dialog-container')
                    .dialog('close').dialog('destroy');
            }

            if(searchMarker) searchMarker.setMap(null);
            for (let marker of markers) {
                marker.setMap(null);
            }
            markers.length = 0;
            geoData.setMap(null);
        };

        function createMarkers() {
            if(markers.length > 0) {
                for (let marker of markers) {
                    marker.setMap(null);
                }
                markers.length = 0;
            }

            for (let plant of powerPlantData.wind) {
                let marker = new TGOS.TGMarker(map,
                    new TGOS.TGPoint(Number(plant.lng), Number(plant.lat)), plant.name);
                marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/wind-icon.png',
                    new TGOS.TGSize(60, 60)));

                TGMap.addListener(marker, 'click', (e) => {
                    $('#wp-info-division').html(`
                        <h5 class="font-weight-bold" style="color: #006400;">發電廠資訊</h5>  
                        <h6 class="font-weight-bold" style="color: #A52A2A;">${plant.name}</h6>
                        <span class="font-weight-bold">
                            供電群集: ${plant.group_code}<br/>
                            廠商: ${plant.vendor}<br/>
                            廠牌: ${plant.brand}<br/>
                            裝置數: ${plant.devices}部<br/>
                            裝置容量: ${thousandComma(plant.power_generation)}瓩<br/>
                            平均年發電量: ${thousandComma(plant.avg_power_generation)}萬度
                        </span>
                    `);
                    $(`#info-div-body-${panelTitle}`).animate({
                        scrollTop: $('#wp-info-division').offset().top
                    }, 800);

                    map.fitBounds(e.target.position.Envelope);
                    map.setZoom(12);

                    if(prevCode) {
                        $(`#wp-supply-color-grading-body #${prevCode}`)
                            .css('color', '');
                    }

                    $(`#wp-supply-color-grading-body #${plant.group_code}`)
                        .css('color', '#F5D016');
                    prevCode = plant.group_code;
                });

                markers.push(marker);
            }
        }

        function enableMarkerCluster() {
            markerCluster = new TGOS.TGMarkerCluster(map, markers, {});
            markerCluster.setVisible(true);
            markerCluster.setMaxZoom(9);
            markerCluster.setSearchBounds(30);
            markerCluster.setScaleClass([3,6,9]);
            markerCluster.setZIndex(1);
            markerCluster.redrawAll(true);
            TGMap.addListener(markerCluster, 'clusterclick', (e) => {
                if (e.specifiedCluster.length > 1) {
                    map.fitBounds(e.clusterEnvelope);
                    map.setZoom(map.getZoom() - 1);
                }
            });
        }

        function disableMarkerCluster() {
            markerCluster.removeMarkers(markers, true);
        }

        function displayPlantGroup(code) {
            let plants = powerPlantData.wind.filter((plant) =>
                plant.group_code === code);

            let text = `<h5 class="font-weight-bold" style="color: #006400;">發電廠資訊
                        <label style="font-size: 15px">(供電群集: ${code})</label></h5>`;
            for(let [index, plant] of plants.entries()) {
                text += `
                    <h6 class="font-weight-bold" style="color: #A52A2A;">${plant.name}</h6>
                    <span class="font-weight-bold">
                        廠商: ${plant.vendor}<br/>
                        廠牌: ${plant.brand}<br/>
                        裝置數: ${plant.devices}部<br/>
                        裝置容量: ${thousandComma(plant.power_generation)}瓩<br/>
                        平均年發電量: ${thousandComma(plant.avg_power_generation)}萬度
                    </span>
                    ${index === plants.length - 1 ? '' : '<br/><br/>'}
                `;
            }
            $('#wp-info-division').html(text);
            $(`#info-div-body-${panelTitle}`).animate({
                scrollTop: $('#wp-info-division').offset().top
            }, 800);

            if(prevCode) {
                $(`#wp-supply-color-grading-body #${prevCode}`)
                    .css('color', '');
            }

            $(`#wp-supply-color-grading-body #${code}`)
                .css('color', '#F5D016');
            prevCode = code;
        }

        function enableDialog(type, val) {
            if(!val || val.length === 0) return;

            let data = val === '全部' ? powerPlantData.wind :
                powerPlantData.wind.filter((plant) => plant[type] === val);

            data = data.map((plant) => {
                let {name, region, group_code,
                    vendor, brand, devices,
                    power_generation, avg_power_generation} = plant;

                return {
                    '縣市': region.substring(0, 3),
                    '鄉鎮區': region.substring(3),
                    '名稱': name,
                    '發電群組': group_code,
                    '廠商': vendor,
                    '廠牌': brand,
                    '裝置數(部)': devices,
                    '裝置容量(瓩)': power_generation,
                    '平均年發電量(萬度)': avg_power_generation
                };
            });

            $('#dialog-container').css({
                'margin-top': '0vh', 'position': 'unset',
                'padding': '2px', 'overflow': 'hidden'
            }).empty().html(`
                <div id="externalPager" style="margin: 10px 0;"></div>
                <div id="wp-grid-table"></div>
            `).dialog({
                width: 'auto',
                title: '商轉風機',
                position: {
                    my: 'right bottom',
                    at: 'center-300px center-50px',
                    of: window
                },
                autoOpen: true,
                resizable: false,
                close: () => {
                    $('#wp-grid-table').jsGrid('destroy');
                    $('#dialog-container')
                        .empty().removeAttr('style');
                }
            }).dialog('open');

            $('#wp-grid-table').jsGrid({
                width: '54vw',
                sorting: true,
                paging: true,
                pageSize: 5,
                pagerContainer: '#externalPager',
                pagerFormat: '目前頁數: {pageIndex} &nbsp; {pages} &nbsp; {next} {last} &nbsp;&nbsp; 總頁數: {pageCount} &nbsp; 總筆數: {itemCount}',
                pageNextText: '>',
                pageLastText: '>>',
                data: data,
                fields: [
                    {name: '縣市', type: 'text', width: '6vw', sorting: false},
                    {name: '鄉鎮區', type: 'text', width: '6vw', sorting: false},
                    {name: '名稱', type: 'text', width: '6vw', sorting: false},
                    {name: '發電群組', type: 'text', width: '6vw'},
                    {name: '廠商', type: 'text', width: '6vw'},
                    {name: '廠牌', type: 'text', width: '6vw'},
                    {name: '裝置數(部)', type: 'number', width: '6vw'},
                    {name: '裝置容量(瓩)', type: 'number', width: '6vw'},
                    {name: '平均年發電量(萬度)', type: 'number', width: '6vw'}
                ]
            });

            $('.ui-dialog .ui-widget-header, .ui-dialog .ui-button').css({
                'background': '#b9cd6d',
                'color': '#ffffff',
                'border': '1px solid #b9cd6d'
            });

            $('.jsgrid').css({
                'font-size': '15px',
                'text-align': 'center',
                'background': 'white'
            });

            dialogIsInit = true;
        }

        function isPointInPolygon(lng, lat, polygon) {
            let nPoints = polygon.length,
                lats = [], lngs = [];
            for (let poly of polygon) {
                lats.push(poly.y);
                lngs.push(poly.x);
            }

            let flag = false;
            for (let node = 0, altNode = (nPoints - 1); node < nPoints; altNode = node++) {
                if (((lngs[node] > lng) !== (lngs[altNode] > lng))
                    && (lat < (lats[altNode] - lats[node])
                        * (lng - lngs[node])
                        / (lngs[altNode] - lngs[node])
                        + lats[node])
                ) {
                    flag = !flag;
                }
            }
            return flag;
        }

        function thousandComma(number) {
            let num = number.toString();
            let pattern = /(-?\d+)(\d{3})/;

            while (pattern.test(num)) {
                num = num.replace(pattern, '$1,$2');
            }
            return num;
        }
    };

    Renderer.WindPowerGenerationRenderer = function(panelTitle) {
        this.rendererID = 'WindPowerGenerationRenderer';

        this.rendering = function () {
            let html = `
              <canvas id="canvas-wind-generation-bar" height="300" style="margin-left: -10px;"></canvas>
              <h6 id="wind-generation-title" style="margin-left: 30px;">滑入可查看更詳細資訊</h6>
              <div style="width: 350px; margin-left: -40px;">
                <canvas id="canvas-wind-generation-pie" width="150"></canvas>
              </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData(),
                    TP = [], POE = [];
                JSON.data.forEach((data) => {
                    TP.push(data.台電);
                    POE.push(data.民營);
                });

                let pieChart;
                let ctx = document.getElementById('canvas-wind-generation-bar').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: JSON.years,
                        datasets: [{
                            label: '台電',
                            data: TP,
                            backgroundColor: '#228b22',
                            fillOpacity: .5
                        }, {
                            label: '民營',
                            data: POE,
                            backgroundColor: '#8fbc8f',
                            fillOpacity: .5
                        }]
                    },
                    options: {
                        title: {
                            display: true,
                            text: '風力歷年發電量(單位: 百萬度)'
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                            custom: function (tooltipModel) {
                                if(tooltipModel.body && tooltipModel.body.length > 1) {
                                    let data = [
                                        tooltipModel.body[0].lines[0].substring(3).trim(),
                                        tooltipModel.body[1].lines[0].substring(3).trim()
                                    ];
                                    $('#wind-generation-title').text(tooltipModel.title[0] +
                                        `(合計: ${(Number(data[0]) + Number(data[1])).toFixed(2)})`);

                                    if(pieChart) {
                                        pieChart.data.datasets[0].data = data;
                                        pieChart.update();
                                    }else {
                                        let ctx = document.getElementById('canvas-wind-generation-pie').getContext('2d');
                                        pieChart = new Chart(ctx, {
                                            type: 'doughnut',
                                            data: {
                                                labels: ['台電', '民營'],
                                                datasets: [{
                                                    data: data,
                                                    backgroundColor: ['#228b22', '#8fbc8f'],
                                                    fillOpacity: [.5, .5],
                                                    hoverBorderColor: '#FFFFFF'
                                                }]
                                            },
                                            options: {
                                                tooltips: {
                                                    callbacks: {
                                                        label: function (tooltipItem, data) {
                                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                                return Number(accumulator) + Number(currentValue);
                                                            });
                                                            let currentValue = dataset.data[tooltipItem.index];
                                                            let percent = Math.round(((currentValue / sum) * 100));
                                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                                        }
                                                    }
                                                },
                                                legend: {
                                                    display: true,
                                                    labels: {
                                                        generateLabels: function (chart) {
                                                            let data = chart.data;

                                                            return data.labels.map(function (label, index) {
                                                                let ds = data.datasets[0];
                                                                let arc = chart.getDatasetMeta(0).data[index];
                                                                let custom = arc && arc.custom || {};
                                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                                let arcOpts = chart.options.elements.arc;

                                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                                let stroke = custom.borderColor ? custom.borderColor :
                                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                                return {
                                                                    text: label + ' : ' + value,
                                                                    fillStyle: fill,
                                                                    strokeStyle: stroke,
                                                                    lineWidth: 2,
                                                                    hidden: false,
                                                                    index: index
                                                                };
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: [{
                                                beforeInit: function(chart, options) {
                                                    chart.legend.afterFit = function() {
                                                        this.height += 20;
                                                    };
                                                }
                                            }]
                                        });
                                    }
                                }
                            }
                        },
                        responsive: true,
                        scales: {
                            xAxes: [{
                                stacked: true,
                            }],
                            yAxes: [{
                                stacked: true
                            }]
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            chart.legend.afterFit = function() {
                                this.height += 10;
                            };
                        }
                    }]
                });
            });
        };

        this.empty = function () {

        };

        function fetchData() {
            const JSON = {
                years: [],
                data: []
            };
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年風力發電發電量(91-10806).csv',
                dataType: 'TEXT',
                async: false,
                success: function(csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let temp = {};
                        data.split(',').forEach((data, index) => {
                            let obj = {};
                            obj[title[index]] = data;
                            Object.assign(temp, obj);

                            if(index === 0) {
                                JSON.years.push(data);
                            }
                        });
                        JSON.data.push(temp);
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.SolarPlantRenderer = function(panelTitle) {
        this.rendererID = 'SolarPlantRenderer';
        let markers = {
            all: {},
            currents: []
        };
        let intervalID = undefined,
            timoutID = undefined,
            messageBox = undefined,
            nRegions = {};
        const allPrevYearsSolarData = fetchAllPrevYearsSolarData();

        this.rendering = function () {
            let html = `
                <div id="solar-info-checkbox-group">
                    <span role="checkbox" class="glyphicon glyphicon-check font-weight-bold cursor-pointer">光電廠址動畫輪播</span>
                </div>
                <div id="solar-info-animation-division"></div>
                <hr />
                <div id="solar-info-division">點擊地圖上標記可查看詳細資訊<br/>(需先關閉廠址輪播動畫)</div>
                <select id="year" style="display: none;"></select>
                <div id="solar-info-canvas-division" style="display: none;">
                    <div style="width: 290px; margin-top: 10px;">
                        <canvas id="canvas-solar-plant-capacity" width="280" height="200" 
                            style="margin-left: -20px;"></canvas>
                    </div>
                    <div style="width: 290px;">
                        <canvas id="canvas-solar-plant-generation" width="280" height="200" 
                            style="margin-left: -20px;"></canvas>
                    </div>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                let map = TGMap.getMap();

                powerPlantData.solar.forEach((plant) => {
                    let marker = new TGOS.TGMarker(null,
                        new TGOS.TGPoint(Number(plant.lng), Number(plant.lat)), plant.name);
                    marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/red-dot.png',
                        new TGOS.TGSize(30, 40)));
                    TGMap.addListener(marker, 'click', (e) => {
                        let data = getDataByName(plant.name),
                            startYear = Object.keys(data)[0],
                            startMonth = Object.keys(data[startYear])[0];

                        let thousandComma = (number) => {
                            let num = number.toString();
                            let pattern = /(-?\d+)(\d{3})/;

                            while (pattern.test(num)) {
                                num = num.replace(pattern, '$1,$2');
                            }
                            return num;
                        };

                        $('#solar-info-division').html(`
                            <h5 class="font-weight-bold" style="color: #A52A2A;">${plant.name}</h5>
                            <span class="font-weight-bold">
                                啟用時間: ${Number(startYear) - 1911}年${startMonth}<br/>
                                地址: ${plant.addr}<br/>
                                單機容量: ${plant.capacity}瓩<br/>
                                發電量: ${thousandComma(plant.generation)}度<br/>
                                平均單位裝置容量每日發電量: ${plant.avgUnitGerer}瓩
                            </span>
                            <hr />
                        `);

                        let $year = $('#solar-info-division + select#year');

                        $year.show().empty();
                        $('#solar-info-canvas-division').show();
                        Object.keys(data).reverse().forEach((year) => {
                            $year.append(`<option value="${year}">${year}年</option>`);
                        });

                        $year.off('change').on('change', (e) => {
                            let year = $(e.target).children('option:selected').val();
                            drawChart(year, data);

                            $(`#info-div-body-${panelTitle}`).animate({
                                scrollTop: $('#solar-info-canvas-division').offset().top
                            }, 800);
                        }).trigger('change');

                        map.fitBounds(e.target.position.Envelope);
                        map.setZoom(12);
                    });

                    markers.currents.push(marker);
                });

                enableAnimation();
                $('#solar-info-checkbox-group').children('span[role="checkbox"]')
                    .click((e) => {
                        let target = e.target;
                        if($(target).hasClass('glyphicon-check')) {
                            $(target).removeClass('glyphicon-check')
                                .addClass('glyphicon-unchecked');
                            disableAnimation();
                        }else {
                            $(target).removeClass('glyphicon-unchecked')
                                .addClass('glyphicon-check');
                            enableAnimation();
                        }
                    });
            });
        };

        this.empty = function () {
            disableAnimation();
            messageBox.close();

            for(let marker of markers.currents) {
                marker.setMap(null);
            }
            markers.currents.length = 0;
        };
        
        function enableAnimation() {
            for(let marker of markers.currents) {
                marker.setMap(null);
            }

            if(!messageBox) {
                messageBox = new TGOS.TGInfoWindow('',
                    new TGOS.TGPoint(123.416, 22.320), {
                    maxWidth: 160,
                    zIndex: 99
                });
            }

            const years = Object.keys(markers.all);
            let start = Number(years[0]),
                end = Number(years[years.length - 1]),
                count = start;

            intervalID = setInterval(() => {
                if(count === start) {
                    markers.all[end].forEach((marker) => marker.setMap(null));
                }else {
                    markers.all[count - 1].forEach((marker) => marker.setMap(null));
                }

                timoutID = setTimeout(() => {
                    markers.all[count].forEach((marker) => marker.setMap(TGMap.getMap()));
                    $('#solar-info-animation-division').html(`
                        <h5 style="color: #EE5757">${count}年</h5>
                        <h6>廠址數: ${markers.all[count].length}間</h6>
                        ${
                            Object.keys(nRegions[count]).map((region) => {
                                return `<h6>${region}: ${nRegions[count][region]}間</h6>`
                            }).join('')
                        }
                    `).css('margin-top', '10px');

                    $('#solar-info-animation-division h5, ' +
                        '#solar-info-animation-division h6')
                        .addClass('font-weight-bold');

                    displayMessageBox(count,
                        $('#solar-info-animation-division').html());

                    count++;
                    if(count > end) count = start;
                }, 800);
            }, 800);
        }

        function disableAnimation() {
            $('#solar-info-animation-division').html(`
                <h5 style="color: #EE5757">2019年</h5>
                <h6>廠址數: ${markers.all['2019'].length}間</h6>
                ${
                    Object.keys(nRegions['2019']).map((region) => {
                        return `<h6>${region}: ${nRegions['2019'][region]}間</h6>`
                    }).join('')
                }
            `);

            $('#solar-info-animation-division h5, ' +
                '#solar-info-animation-division h6')
                .addClass('font-weight-bold');

            messageBox.close();

            clearInterval(intervalID);
            clearTimeout(timoutID);
            Object.keys(markers.all).forEach((year) => {
                for(let marker of markers.all[year]) {
                    marker.setMap(null);
                }
            });

            for(let marker of markers.currents) {
                marker.setMap(TGMap.getMap());
            }
        }

        function displayMessageBox(year, text) {
            if(!$('#solar-plants-info-panel', '#tgMap div.hpack').length) {
                messageBox.open(TGMap.getMap());
                $(messageBox.getContentPane()).parent()
                    .attr('id', 'solar-plants-info-panel')
                    .nextAll().remove();
            }

            let nNewest = markers.all[year].filter((marker) =>
                marker.getIcon().getUrl().split('/')[4]
                === 'yellow-dot.png').length;

            messageBox.setContent(`
                <div>${text}</div>
                <hr />
                <div class="font-weight-bold">
                    <img src="../GoGoEnergy/assets/icon/red-dot.png" alt="red-dot"
                        style="width: 28px; height: 40px;"> 舊有維持電廠: ${markers.all[year].length - nNewest}間
                    <img src="../GoGoEnergy/assets/icon/yellow-dot.png" alt="yellow-dot"
                        style="width: 40px; height: 40px; margin-top: 10px; margin-left: -12px;">此年新建電廠: ${nNewest}間 
                </div>
            `);
            $(messageBox.getContentPane()).children('p').remove();
            $(messageBox.getContentPane()).parent().css({
                'width': 210,
                'height': 325,
                'overflow': 'hidden',
                'top': '81px',
                'text-align': 'center',
                'border': 0,
                'border-radius': '10px'
            });
        }
        
        function determineRegion(county) {
            let index = districtsData.adms
                    .indexOf(county.replace('台', '臺')),
                region = '北部';

            if(index > 19) {
                region = '離島';
            }else if(index > 15) {
                if(index === 19) {
                    region = '南部';
                }else if(index > 16 && index <= 18) {
                    region = '東部';
                }else if(index === 16) {
                    region = '北部';
                }
            }else if(index > 10) {
                region = '南部';
            }else if(index > 5) {
                region = '中部';
            }

            return region;
        }
        
        function fetchAllPrevYearsSolarData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-太陽光電發電量及平均單位裝置容量每日發電量統計表.csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);

                    data.forEach((data) => {
                        let [year, month, name, ...information] = data.split(',');
                        month += '月';

                        if(!JSON[year]) {
                            JSON[year] = {};
                            JSON[year][month] = {};
                        }else if(!JSON[year][month]) {
                            JSON[year][month] = {};
                        }

                        let [capacity, generation, avgUnitGerer,
                            addr, lat, lng] = information;
                        JSON[year][month][name] = {
                            addr: addr,
                            lat: lat,
                            lng: lng,
                            capacity: capacity,
                            generation: generation,
                            avgUnitGerer: avgUnitGerer
                        };
                    });
                }
            });

            Object.keys(JSON).forEach((year) => {
                let temp = [];
                Object.keys(JSON[year]).forEach((month) => {
                    temp.push(...Object.keys(JSON[year][month]));
                });

                let results = new Set();
                temp.forEach((item) => {
                    if(!results.has(item))
                        results.add(item);
                });

                let _nRegions = [];
                markers.all[year] = [];
                [...results].forEach((plantName) => {
                    for(let month = 1; month <= Object.keys(JSON[year]).length; month++) {
                        if(JSON[year][month + '月'][plantName]) {
                            _nRegions.push(determineRegion(JSON[year][month + '月'][plantName]
                                .addr.substring(0, 3)));

                            let lat = JSON[year][month + '月'][plantName].lat,
                                lng = JSON[year][month + '月'][plantName].lng,
                                prevYear = Number(year) - 1,
                                markerImgName = 'red-dot',
                                markerWidth = 30;

                            let marker = new TGOS.TGMarker(null,
                                new TGOS.TGPoint(Number(lng), Number(lat)));

                            if(JSON[prevYear] &&
                                !Object.keys(JSON[prevYear]['12月']).includes(plantName)) {
                                markerImgName = 'yellow-dot';
                                markerWidth = 40;
                            }
                            marker.setIcon(new TGOS.TGImage(`${basicAssetsURL}icon/${markerImgName}.png`,
                                new TGOS.TGSize(markerWidth, 40)));

                            markers.all[year].push(marker);
                            break;
                        }
                    }
                });

                nRegions[year] = {
                    北部區域: _nRegions.filter((region) => region === '北部').length,
                    中部區域: _nRegions.filter((region) => region === '中部').length,
                    南部區域: _nRegions.filter((region) => region === '南部').length,
                    東部區域: _nRegions.filter((region) => region === '東部').length,
                    離島區域: _nRegions.filter((region) => region === '離島').length,
                };
            });

            return JSON;
        }

        function getDataByName(plantName) {
            const JSON = allPrevYearsSolarData, data = {};

            Object.keys(JSON).forEach((year) => {
                Object.keys(JSON[year]).forEach((month) => {
                    if(JSON[year][month][plantName]) {
                        if(!data[year]) {
                            data[year] = {};
                        }
                        data[year][month] = {};
                        data[year][month].capacity = JSON[year][month][plantName].capacity;
                        data[year][month].generation = JSON[year][month][plantName].generation;
                    }
                });
            });

            return data;
        }

        let capacityChart, generationChart;
        function drawChart(year, data) {
            data = data[year];
            _draw(capacityChart, 'capacity');
            _draw(generationChart, 'generation');

            function _draw(target, type) {
                let _data = Object.keys(data).map((month) => data[month][type]),
                    _colors = [];

                for(let i = 0; i < _data.length; i++) {
                    _colors.push(type === 'capacity' ? '#FFC26A' : '#FF9C7A');
                }

                if(target) {
                    target.data.labels = Object.keys(data);
                    target.data.datasets[0].data = _data;
                    target.data.datasets[0].backgroundColor = _colors;
                    target.options.title.text = `${year}年${$('#solar-info-division h5').text() + 
                        (type === 'capacity' ? '單機容量(單位: 瓩)' : '發電量(單位: 度)')}`;
                    target.update();
                }else {
                    let ctx = document.getElementById(`canvas-solar-plant-${type}`).getContext('2d');
                    let chart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: Object.keys(data),
                            datasets: [{
                                label: type === 'capacity' ? '單機容量' : '發電量',
                                data: _data,
                                backgroundColor: _colors,
                            }]
                        },
                        options: {
                            scales: {
                                xAxes: [{
                                    ticks: {
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 11
                                    }
                                }],
                                yAxes: [{
                                    ticks: {
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 9
                                    }
                                }]
                            },
                            title: {
                                display: true,
                                text: `${year}年${$('#solar-info-division h5').text() + 
                                    (type === 'capacity' ? '單機容量(單位: 瓩)' : '發電量(單位: 度)')}`
                            },
                            legend: {
                                onClick: (e, legendItem) => {}
                            }
                        }
                    });

                    type === 'capacity' ?
                        capacityChart = chart :
                        generationChart = chart;
                }
            }
        }
    };

    Renderer.SolarPowerGenerationRenderer = function(panelTitle) {
        this.rendererID = 'SolarPowerGenerationRenderer';

        this.rendering = function () {
            let html = `
              <canvas id="canvas-solar-generation-bar" height="300" style="margin-left: -10px;"></canvas>
              <h6 id="solar-generation-title" style="margin-left: 30px;">滑入可查看更詳細資訊</h6>
              <div style="width: 350px; margin-left: -40px;">
                <canvas id="canvas-solar-generation-pie" width="150"></canvas>
              </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData(),
                    TP = [], POE = [];
                JSON.data.forEach((data) => {
                    TP.push(data.台電);
                    POE.push(data.民營);
                });

                let pieChart;
                let ctx = document.getElementById('canvas-solar-generation-bar').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: JSON.years,
                        datasets: [{
                            label: '台電',
                            data: TP,
                            backgroundColor: '#FFBB00',
                            fillOpacity: .5
                        }, {
                            label: '民營',
                            data: POE,
                            backgroundColor: '#FFDD55',
                            fillOpacity: .5
                        }]
                    },
                    options: {
                        title: {
                            display: true,
                            text: '太陽能歷年發電量(單位: 百萬度)'
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                            custom: function (tooltipModel) {
                                if(tooltipModel.body && tooltipModel.body.length > 1) {
                                    let data = [
                                        tooltipModel.body[0].lines[0].substring(3).trim(),
                                        tooltipModel.body[1].lines[0].substring(3).trim()
                                    ];
                                    $('#solar-generation-title').text(tooltipModel.title[0] +
                                        `(合計: ${(Number(data[0]) + Number(data[1])).toFixed(2)})`);

                                    if(pieChart) {
                                        pieChart.data.datasets[0].data = data;
                                        pieChart.update();
                                    }else {
                                        let ctx = document.getElementById('canvas-solar-generation-pie').getContext('2d');
                                        pieChart = new Chart(ctx, {
                                            type: 'doughnut',
                                            data: {
                                                labels: ['台電', '民營'],
                                                datasets: [{
                                                    data: data,
                                                    backgroundColor: ['#FFBB00', '#FFDD55'],
                                                    fillOpacity: [.5, .5],
                                                    hoverBorderColor: '#FFFFFF'
                                                }]
                                            },
                                            options: {
                                                tooltips: {
                                                    callbacks: {
                                                        label: function (tooltipItem, data) {
                                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                                return Number(accumulator) + Number(currentValue);
                                                            });
                                                            let currentValue = dataset.data[tooltipItem.index];
                                                            let percent = Math.round(((currentValue / sum) * 100));
                                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                                        }
                                                    }
                                                },
                                                legend: {
                                                    display: true,
                                                    labels: {
                                                        generateLabels: function (chart) {
                                                            let data = chart.data;

                                                            return data.labels.map(function (label, index) {
                                                                let ds = data.datasets[0];
                                                                let arc = chart.getDatasetMeta(0).data[index];
                                                                let custom = arc && arc.custom || {};
                                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                                let arcOpts = chart.options.elements.arc;

                                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                                let stroke = custom.borderColor ? custom.borderColor :
                                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                                return {
                                                                    text: label + ' : ' + value,
                                                                    fillStyle: fill,
                                                                    strokeStyle: stroke,
                                                                    lineWidth: 2,
                                                                    hidden: false,
                                                                    index: index
                                                                };
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: [{
                                                beforeInit: function(chart, options) {
                                                    chart.legend.afterFit = function() {
                                                        this.height += 20;
                                                    };
                                                }
                                            }]
                                        });
                                    }
                                }
                            }
                        },
                        responsive: true,
                        scales: {
                            xAxes: [{
                                stacked: true,
                            }],
                            yAxes: [{
                                stacked: true
                            }]
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            chart.legend.afterFit = function() {
                                this.height += 10;
                            };
                        }
                    }]
                });
            });
        };

        this.empty = function () {

        };

        function fetchData() {
            const JSON = {
                years: [],
                data: []
            };
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年太陽能發電發電量(97-10806).csv',
                dataType: 'TEXT',
                async: false,
                success: function(csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let temp = {};
                        data.split(',').forEach((data, index) => {
                            let obj = {};
                            obj[title[index]] = data;
                            Object.assign(temp, obj);

                            if(index === 0) {
                                JSON.years.push(data);
                            }
                        });
                        JSON.data.push(temp);
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.CountiesSolarPowerDevelopingRenderer = function(panelTitle) {
        this.rendererID = 'CountiesSolarPowerDevelopingRenderer';
        let fills = [],
            messageBox = undefined;
        const JSON = fetchData();

        this.rendering = function () {
            let html = `
                <button id="btnDevelopSituation" class="btn btn-xs" 
                    style="background-color: #FBF99A">成長情形</button>
                <button id="btnCapacityRank" class="btn btn-xs" 
                    style="background-color: #FAFBC2">裝置容量排名</button>
                <div id="canvas-container" style="width: 290px; margin-top: 20px;">
                    <canvas id="canvas-solor-develop" width="280" height="550" 
                      style="margin-left: -20px; margin-bottom: 30px;"></canvas>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                drawChart();
                drawAllGrading();

                $('#btnDevelopSituation').click(function() {
                    if($(this).css('background-color') !== '#FBF99A') {
                        $(this).css('background-color', '#FBF99A');
                        $('#btnCapacityRank').css('background-color', '#FAFBC2');

                        $('#canvas-container').empty()
                            .html(`<canvas id="canvas-solor-develop" width="280" height="550" 
                                    style="margin-left: -20px; margin-bottom: 30px;"></canvas>`);

                        drawChart('develop-situation');
                        drawAllGrading();
                    }
                });

                $('#btnCapacityRank').click(function() {
                    if($(this).css('background-color') !== '#FBF99A') {
                        $(this).css('background-color', '#FBF99A');
                        $('#btnDevelopSituation').css('background-color', '#FAFBC2');

                        $('#canvas-container').empty()
                            .html(`
                                <span class="glyphicon glyphicon-info-sign font-weight-bold"></span>
                                <span class="font-weight-bold">點擊圖例可查看該容量等級的<br/>縣市</span>
                                <canvas id="canvas-solor-develop" width="280" height="550" 
                                    style="margin: 10px 0 30px -20px;"></canvas>
                            `);

                        drawChart('capacity-rank');
                    }
                });
            });
        };

        this.empty = function () {
            for(let fill of fills) {
                fill.setMap(null);
            }
            fills.length = 0;
        };

        function drawChart(type = 'develop-situation') {
            let ctx = document.getElementById('canvas-solor-develop').getContext('2d');
            switch (type) {
                case 'develop-situation':
                    new Chart(ctx, {
                        type: 'horizontalBar',
                        data: {
                            labels: Object.keys(JSON.byCounty),
                            datasets: [{
                                label: '101年',
                                data: Object.values(JSON.byYear['101年']),
                                backgroundColor: '#FFF98F',
                            }, {
                                label: '102年',
                                data: Object.values(JSON.byYear['102年']),
                                backgroundColor: '#FFE551',
                            }, {
                                label: '103年',
                                data: Object.values(JSON.byYear['103年']),
                                backgroundColor: '#FFF1AB',
                            }, {
                                label: '104年',
                                data: Object.values(JSON.byYear['104年']),
                                backgroundColor: '#FFE1AB',
                            }, {
                                label: '105年',
                                data: Object.values(JSON.byYear['105年']),
                                backgroundColor: '#FFD1AB',
                            }, {
                                label: '106年',
                                data: Object.values(JSON.byYear['106年']),
                                backgroundColor: '#FFCB4F',
                            }, {
                                label: '107年',
                                data: Object.values(JSON.byYear['107年']),
                                backgroundColor: '#FFB559',
                            }]
                        },
                        options: {
                            scales: {
                                xAxes: [{
                                    ticks: {
                                        beginAtZero: true,
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 11,
                                        callback: function(label, index, labels) {
                                            if(label === 0) return label;
                                            return (label / 1000) + 'k';
                                        }
                                    },
                                    stacked: true
                                }],
                                yAxes: [{
                                    ticks: {
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 11
                                    },
                                    stacked: true
                                }]
                            },
                            title: {
                                display: true,
                                text: '101-107年各縣市太陽光電成長情形(單位:瓩)'
                            }
                        },
                        plugins: [{
                            beforeInit: function(chart, options) {
                                chart.legend.afterFit = function() {
                                    this.height += 10;
                                };
                            }
                        }]
                    });
                    break;
                case 'capacity-rank':
                    let data = Object.keys(JSON.byCounty).map((county) => {
                        return {
                            county: county,
                            value: Object.values(JSON.byCounty[county])
                                .reduce((accumulator, currentValue) => {
                                    return Number(accumulator) + Number(currentValue);
                                })
                        };
                    });
                    data = data.sort((obj1, obj2) =>
                        obj2.value - obj1.value);

                    let counties = data.map((obj) => Object.values(obj)[0]);
                    let values = data.map((obj) => Object.values(obj)[1]);
                    let colors = values.map((value) => {
                        if(value >= 1000000) return '#FFB559';
                        else if(value >= 100000) return '#FFCB4F';
                        return '#FFD1AB';
                    });

                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: counties,
                            datasets: [{
                                data: values,
                                backgroundColor: colors,
                            }]
                        },
                        options: {
                            hover: {
                                onHover: function(e) {
                                    e.target.style.cursor = 'auto';
                                }
                            },
                            scales: {
                                xAxes: [{
                                    ticks: {
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 11
                                    }
                                }],
                                yAxes: [{
                                    ticks: {
                                        fontFamily: "'Open Sans Bold', sans-serif",
                                        fontSize: 9,
                                        callback: function(label, index, labels) {
                                            if(label === 0) return label;
                                            return (label / 1000) + 'k';
                                        }
                                    }
                                }]
                            },
                            title: {
                                display: true,
                                text: ['101-107年各縣市太陽光電裝置容量排名', '(單位:瓩)']
                            },
                            legend: {
                                labels: {
                                    generateLabels: function (chart) {
                                        let labels = [{
                                            label: '超過100萬瓩',
                                            color: '#FFB559'
                                        }, {
                                            label: '超過10萬瓩',
                                            color: '#FFCB4F'
                                        }, {
                                            label: '10萬瓩以下',
                                            color: '#FFD1AB'
                                        }];

                                        return labels.map(({label, color}, index) => {
                                            return {
                                                text: label,
                                                fillStyle: color,
                                                strokeStyle: 'white',
                                                lineWidth: 2,
                                                hidden: false,
                                                index: index
                                            };
                                        });
                                    }
                                },
                                onHover: function(e) {
                                    e.target.style.cursor = 'pointer';
                                },
                                onClick: function(e, legendItem) {
                                    fills.forEach((fill) => fill.setMap(null));
                                    fills.length = 0;

                                    let matchData = ((index) => {
                                        switch (index) {
                                            case 0:
                                                return data.filter(({value}) =>
                                                    value >= 1000000);
                                            case 1:
                                                return data.filter(({value}) =>
                                                    value >= 100000 && value < 1000000);
                                            case 2:
                                                return data.filter(({value}) =>
                                                    value < 100000);
                                        }
                                    })(legendItem.index);

                                    for(let county of matchData.map((obj) => Object.values(obj)[0])) {
                                        new TGOS.TGLocateService().locateWGS84({
                                            district: county
                                        }, (e, status) => {
                                            let color = ['#FFB559', '#FFCB4F', '#FFD1AB'][legendItem.index];
                                            let polygon = e[0].geometry.geometry;
                                            fills.push(new TGOS.TGFill(TGMap.getMap(), polygon, {
                                                fillColor: color,
                                                fillOpacity: .5,
                                                strokeColor: color,
                                                strokeWeight: 1,
                                                strokeOpacity: 1
                                            }));
                                        });
                                    }
                                }
                            }
                        },
                        plugins: [{
                            beforeInit: function(chart, options) {
                                chart.legend.afterFit = function() {
                                    this.height += 10;
                                };
                            }
                        }]
                    });
                    break;
            }
        }

        function drawAllGrading() {
            fills.forEach((fill) => fill.setMap(null));
            fills.length = 0;

            Object.keys(JSON.byCounty).map((county) => {
                return {
                    county: county,
                    value: Object.values(JSON.byCounty[county])
                        .reduce((accumulator, currentValue) => {
                            return Number(accumulator) + Number(currentValue);
                        })
                };
            }).forEach(({county, value}) => {
                new TGOS.TGLocateService().locateWGS84({
                    district: county
                }, ([{geometry}], status) => {
                    let color = ((value) => {
                        if(value >= 1000000) return '#FFB559';
                        else if(value >= 100000) return '#FFCB4F';
                        return '#FFD1AB';
                    })(value);

                    let polygon = geometry.geometry;
                    let fill = new TGOS.TGFill(TGMap.getMap(), polygon, {
                        fillColor: color,
                        fillOpacity: .5,
                        strokeColor: '#FF7044',
                        strokeWeight: 1.2,
                        strokeOpacity: 1
                    });
                    TGMap.addListener(fill, 'mouseover', () => {
                        displayMessageBox({
                            latlng: geometry.location,
                            district: county,
                            value: value,
                            color: color
                        });
                    });
                    TGMap.addListener(fill, 'mouseout', () => messageBox.close());

                    fills.push(fill);
                });
            });
        }

        function displayMessageBox({latlng, district, value, color}) {
            if(messageBox) {
                messageBox.close();
                messageBox = undefined;
            }

            messageBox = new TGOS.TGInfoWindow('', latlng, {
                    maxWidth: 160,
                    zIndex: 99
                });

            if(!$('#county-solar-developing-panel', '#tgMap div.hpack').length) {
                messageBox.open(TGMap.getMap());
                $(messageBox.getContentPane()).parent()
                    .attr('id', 'county-solar-developing-panel')
                    .nextAll().remove();
            }

            value = (Number(value) / 1000).toFixed(2);
            messageBox.setContent(`
                <div class="font-weight-bold" style="color: #EE5757;">${district}</div>
                <h6 class="font-weight-bold" style="color: ${color};">${value}千瓩</h6>
            `);
            $(messageBox.getContentPane()).children('p').remove();
            $(messageBox.getContentPane()).parent().css({
                'width': 85 + (value.toString().length - 4) * 10,
                'height': 65,
                'overflow': 'hidden',
                'text-align': 'center',
                'border': 0,
                'border-radius': '10px'
            });
        }

        function fetchData() {
            const JSON = {
                byYear: {},
                byCounty: {}
            };
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年各縣市太陽光電裝置容量(101-10712).csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let [county, ...d] = data.split(',');
                        county.replace('台', '臺');

                        d.forEach((d, index) => {
                            let year = title[index + 1].substring(0, 3) + '年';

                            if(!JSON.byYear[year]) {
                                JSON.byYear[year] = {};
                            }
                            JSON.byYear[year][county] = d;

                            if(!JSON.byCounty[county]) {
                                JSON.byCounty[county] = {};
                            }
                            JSON.byCounty[county][year] = d;
                        });
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.RenewableEnergyStructureInTenYearsRenderer = function(panelTitle) {
        this.rendererID = 'RenewableEnergyStructureInTenYearsRenderer';

        this.rendering = function () {
            let html = `
                <canvas id="canvas-renewable-energy-structure-line" height="350" style="margin-left: -10px;"></canvas>
                <h6 id="renewable-energy-structure-title" style="margin-left: 30px; margin-top: 10px">滑入可查看更詳細資訊</h6>
                <div style="width: 350px; margin-left: -40px; margin-bottom: 25px;">
                    <canvas id="canvas-renewable-energy-structure-pie" height="200"></canvas>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData();
                let datasets = [],
                    colors = {
                        水力: '#7D92FF', 風力: '#228b22', 太陽能: '#FFB559',
                        生質能: '#BDB76B', 垃圾沼氣: '#696969'
                    };

                Object.keys(colors).forEach((type, index) => {
                    let data = [];
                    Object.keys(JSON).forEach((year) => {
                        let first = Object.keys(JSON[year])[0];
                        let sum = Object.keys(JSON[year]).reduce((accumulator, _type) => {
                            return accumulator + (_type.includes(type) ?
                                Number(JSON[year][_type]) : 0);
                        }, first.includes(type) ? Number(JSON[year][first]) : 0);

                        data.push(sum / 100);
                    });

                    datasets.push({
                        label: type,
                        data: data,
                        backgroundColor: colors[type],
                        fillOpacity: .7,
                        pointRadius: 0
                    });
                });

                let pieChart;
                let ctx = document.getElementById('canvas-renewable-energy-structure-line').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Object.keys(JSON),
                        datasets: datasets
                    },
                    options: {
                        title: {
                            display: true,
                            text: '近十年再生能源結構(單位: 億度)'
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                            custom: function (tooltipModel) {
                                if(tooltipModel.body && tooltipModel.body.length > 4) {
                                    let data = [], labels = [], pieColors = [];
                                    tooltipModel.body.forEach((body, index) => {
                                        let text = body.lines[0];
                                        data.push(text.substring(text.indexOf(':') + 1).trim());
                                        labels.push(text.substring(0, text.indexOf(':')));
                                        pieColors.push(colors[labels[index]]);
                                    });

                                    let sum = data.reduce((accumulator, currentValue) => {
                                        return Number(accumulator) + Number(currentValue);
                                    }).toFixed(2);

                                    $('#renewable-energy-structure-title')
                                        .text(tooltipModel.title[0] + `(合計: ${sum})`);

                                    if(pieChart) {
                                        pieChart.data.datasets[0].data = data;
                                        pieChart.update();
                                    }else {
                                        let ctx = document.getElementById('canvas-renewable-energy-structure-pie').getContext('2d');
                                        pieChart = new Chart(ctx, {
                                            type: 'doughnut',
                                            data: {
                                                labels: labels,
                                                datasets: [{
                                                    data: data,
                                                    backgroundColor: pieColors,
                                                    fillOpacity: .5,
                                                    hoverBorderColor: '#FFFFFF'
                                                }]
                                            },
                                            options: {
                                                tooltips: {
                                                    callbacks: {
                                                        label: function (tooltipItem, data) {
                                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                                return Number(accumulator) + Number(currentValue);
                                                            });
                                                            let currentValue = dataset.data[tooltipItem.index];
                                                            let percent = Math.round(((currentValue / sum) * 100));
                                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                                        }
                                                    }
                                                },
                                                legend: {
                                                    display: true,
                                                    labels: {
                                                        generateLabels: function (chart) {
                                                            let data = chart.data;

                                                            return data.labels.map(function (label, index) {
                                                                let ds = data.datasets[0];
                                                                let arc = chart.getDatasetMeta(0).data[index];
                                                                let custom = arc && arc.custom || {};
                                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                                let arcOpts = chart.options.elements.arc;

                                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                                let stroke = custom.borderColor ? custom.borderColor :
                                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                                return {
                                                                    text: label + ' : ' + value,
                                                                    fillStyle: fill,
                                                                    strokeStyle: stroke,
                                                                    lineWidth: 2,
                                                                    hidden: false,
                                                                    index: index
                                                                };
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: [{
                                                beforeInit: function(chart, options) {
                                                    chart.legend.afterFit = function() {
                                                        this.height += 20;
                                                    };
                                                }
                                            }]
                                        });
                                    }
                                }
                            }
                        },
                        responsive: true,
                        scales: {
                            xAxes: [{
                                ticks: {
                                    callback: (label, index, labels) => label + '年'
                                },
                                stacked: true
                            }],
                            yAxes: [{
                                stacked: true
                            }]
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            chart.legend.afterFit = function() {
                                this.height += 10;
                            };
                        }
                    }]
                });
            });
        };

        this.empty = function () {

        };

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年再生能源發購電量(95-107).csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let [year, ...information] = data.split(',');

                        if(Number(year) < 97) {
                            return false;
                        }else if(!JSON[year]) {
                            JSON[year] = {};
                        }

                        information.forEach((data, index) => {
                            JSON[year][title[index + 1]] = data;
                        });
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.RenewableEnergyInstalledCapacityInTenYearsRenderer = function(panelTitle) {
        this.rendererID = 'RenewableEnergyInstalledCapacityInTenYearsRenderer';

        this.rendering = function () {
            let html = `
                <canvas id="canvas-renewable-energy-instCap-bar" height="350" style="margin-left: -10px;"></canvas>
                <h6 id="renewable-energy-instCap-title" style="margin-left: 30px; margin-top: 10px">滑入可查看更詳細資訊</h6>
                <div style="width: 350px; margin-left: -40px; margin-bottom: 45px">
                    <canvas id="canvas-renewable-energy-instCap-pie" height="200"></canvas>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData();
                let datasets = [],
                    colors = {
                        太陽光電: '#FFB559', 風力: '#228b22', 生質能: '#FFE551',
                        廢棄物: '#FFDD94', 慣常水力: '#7D92FF', 地熱: '#F97253'
                    };

                Object.keys(JSON).forEach((type, index) => {
                   datasets.push({
                       label: type,
                       data: JSON[type],
                       backgroundColor: Object.values(colors)[index],
                       fillOpacity: .5
                   });
                });

                let pieChart;
                let ctx = document.getElementById('canvas-renewable-energy-instCap-bar').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['98年', '99年', '100年', '101年', '102年',
                            '103年', '104年', '105年', '106年'],
                        datasets: datasets
                    },
                    options: {
                        title: {
                            display: true,
                            text: '近十年再生能源裝置容量(單位: 萬瓦)'
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                            custom: function (tooltipModel) {
                                if(tooltipModel.body && tooltipModel.body.length > 5) {
                                    let data = [], labels = [], pieColors = [];
                                    tooltipModel.body.forEach((body, index) => {
                                        let text = body.lines[0];
                                        data.push(text.substring(text.indexOf(':') + 1).trim());
                                        labels.push(text.substring(0, text.indexOf(':')));
                                        pieColors.push(colors[labels[index]]);
                                    });

                                    let sum = data.reduce((accumulator, currentValue) => {
                                        return Number(accumulator) + Number(currentValue);
                                    });

                                    $('#renewable-energy-instCap-title').text(tooltipModel.title[0] +
                                        `(合計: ${sum})`);

                                    if(pieChart) {
                                        pieChart.data.datasets[0].data = data;
                                        /*pieChart.options.legend.labels.generateLabels = function(chart) {
                                            let data = chart.data;

                                            return data.labels.map(function (label, index) {
                                                if(!labels.includes(label)) {
                                                    console.log(index, label);
                                                    return true;
                                                }

                                                console.log(index, label);
                                                console.log(chart.getDatasetMeta(0).data);
                                                let ds = data.datasets[0];
                                                let arc = chart.getDatasetMeta(0).data[index];
                                                let custom = arc && arc.custom || {};
                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                let arcOpts = chart.options.elements.arc;

                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                let stroke = custom.borderColor ? custom.borderColor :
                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                return {
                                                    text: label + ' : ' + value,
                                                    fillStyle: fill,
                                                    strokeStyle: stroke,
                                                    lineWidth: 2,
                                                    hidden: false,
                                                    index: index
                                                };
                                            });
                                        };*/
                                        pieChart.update();
                                    }else {
                                        let ctx = document.getElementById('canvas-renewable-energy-instCap-pie').getContext('2d');
                                        pieChart = new Chart(ctx, {
                                            type: 'doughnut',
                                            data: {
                                                labels: labels,
                                                datasets: [{
                                                    data: data,
                                                    backgroundColor: pieColors,
                                                    fillOpacity: .5,
                                                    hoverBorderColor: '#FFFFFF'
                                                }]
                                            },
                                            options: {
                                                tooltips: {
                                                    callbacks: {
                                                        label: function (tooltipItem, data) {
                                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                                return Number(accumulator) + Number(currentValue);
                                                            });
                                                            let currentValue = dataset.data[tooltipItem.index];
                                                            let percent = Math.round(((currentValue / sum) * 100));
                                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                                        }
                                                    }
                                                },
                                                legend: {
                                                    display: true,
                                                    labels: {
                                                        generateLabels: function (chart) {
                                                            let data = chart.data;

                                                            return data.labels.map(function (label, index) {
                                                                let ds = data.datasets[0];
                                                                let arc = chart.getDatasetMeta(0).data[index];
                                                                let custom = arc && arc.custom || {};
                                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                                let arcOpts = chart.options.elements.arc;

                                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                                let stroke = custom.borderColor ? custom.borderColor :
                                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                                return {
                                                                    text: label + ' : ' + value,
                                                                    fillStyle: fill,
                                                                    strokeStyle: stroke,
                                                                    lineWidth: 2,
                                                                    hidden: false,
                                                                    index: index
                                                                };
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: [{
                                                beforeInit: function(chart, options) {
                                                    chart.legend.afterFit = function() {
                                                        this.height += 20;
                                                    };
                                                }
                                            }]
                                        });
                                    }
                                }
                            }
                        },
                        responsive: true,
                        scales: {
                            xAxes: [{
                                stacked: true,
                            }],
                            yAxes: [{
                                stacked: true
                            }]
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            chart.legend.afterFit = function() {
                                this.height += 10;
                            };
                        }
                    }]
                });
            });
        };

        this.empty = function () {

        };

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '近十年再生能源裝置容量資訊.json',
                dataType: 'JSON',
                async: false,
                success: function (json) {
                    json.forEach((json) => {
                        JSON[json.name] = json.data;
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.CountiesRenewableEnergyRatioRenderer = function(panelTitle) {
        this.rendererID = 'CountiesRenewableEnergyRatioRenderer';
        let fill = undefined;

        this.rendering = function () {
            let html = `
                <select id="county"></select>
                <select id="year"></select>
                <div style="width: 300px;">
                    <canvas id="canvas-renewable-energy-ratio" width="350" height="350" 
                        style="margin-top: 60px; margin-left: -20px;"></canvas>
                </div>
            `;

            execRendering(panelTitle, html, () => {
               const JSON = fetchData();
                let $county = $(`#info-div-body-${panelTitle} > #county`),
                    $year = $(`#info-div-body-${panelTitle} > #year`);

                districtsData.adms.forEach((district) => {
                    $county.append(`<option value="${district}">${district}</option>`);
                });

                $year.append(`<option value="" selected disabled>選擇年份</option>`);
                Object.keys(JSON).forEach((year) => {
                    $year.append(`<option value="${year}">${year}</option>`);
                });

                $county.change(() => drawChart());
                $year.change(() => drawChart());

                let pieChart;
                let drawChart = () => {
                    let county = $county.children('option:selected').val(),
                        year = $year.children('option:selected').val();

                    if(!year) return;

                    let data = Object.values(JSON[year][county]);

                    if(pieChart) {
                        pieChart.data.datasets[0].data = data;
                        pieChart.options.title.text = county + year + '可再生能源比例(單位:瓩)';
                        pieChart.update();
                    }else {
                        let ctx = document.getElementById('canvas-renewable-energy-ratio').getContext('2d');
                        pieChart = new Chart(ctx, {
                            type: 'pie',
                            data: {
                                labels: ['風力', '太陽光電', '其他(含水力)'],
                                datasets: [{
                                    data: data,
                                    backgroundColor: ['#8FBC8F', '#FFDEAD', '#B0C4DE'],
                                    fillOpacity: [.5, .5, .5],
                                    hoverBorderColor: '#FFFFFF'
                                }]
                            },
                            options: {
                                tooltips: {
                                    callbacks: {
                                        label: function (tooltipItem, data) {
                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                return Number(accumulator) + Number(currentValue);
                                            });
                                            let currentValue = dataset.data[tooltipItem.index];
                                            let percent = Math.round(((currentValue / sum) * 100));
                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                        }
                                    }
                                },
                                legend: {
                                    display: true,
                                    labels: {
                                        generateLabels: function (chart) {
                                            let data = chart.data;

                                            return data.labels.map(function (label, index) {
                                                let ds = data.datasets[0];
                                                let arc = chart.getDatasetMeta(0).data[index];
                                                let custom = arc && arc.custom || {};
                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                let arcOpts = chart.options.elements.arc;

                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                let stroke = custom.borderColor ? custom.borderColor :
                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                let thousandComma = (number) => {
                                                    let num = number.toString();
                                                    let pattern = /(-?\d+)(\d{3})/;

                                                    while (pattern.test(num)) {
                                                        num = num.replace(pattern, '$1,$2');
                                                    }
                                                    return num;
                                                };

                                                return {
                                                    text: label + ' : ' + thousandComma(value),
                                                    fillStyle: fill,
                                                    strokeStyle: stroke,
                                                    lineWidth: 2,
                                                    hidden: false,
                                                    index: index
                                                };
                                            });
                                        }
                                    }
                                },
                                title: {
                                    display: true,
                                    text: county + year + '可再生能源比例(單位:瓩)'
                                }
                            },
                            plugins: [{
                                beforeInit: function(chart, options) {
                                    chart.legend.afterFit = function() {
                                        this.height += 20;
                                    };
                                }
                            }]
                        });
                    }
                    locateCounty(county);
                };
            });
        };

        this.empty = function () {
            if(fill) fill.setMap(null);
        };

        function locateCounty(county) {
            new TGOS.TGLocateService().locateWGS84({
                district: county
            }, (e, status) => {
                if(fill) fill.setMap(null);

                let polygon = e[0].geometry.geometry;
                fill = new TGOS.TGFill(TGMap.getMap(), polygon, {
                    fillColor: '#80FA67',
                    fillOpacity: 0.5,
                    strokeColor: '#80FA67',
                    strokeWeight: 1,
                    strokeOpacity: 1
                });
            });
        }

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年各縣市再生能源裝置容量(101-10712).csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let [year, county, ...d] = data.split(',');
                        year = year.substring(0, 3) + '年';
                        county = county.replace('台', '臺');

                        if(!JSON[year]) {
                            JSON[year] = {};
                        }
                        JSON[year][county] = {};

                        d.forEach((d, index) => {
                            JSON[year][county][title[index + 2]] = d;
                        });
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.CountiesRenewableEnergyPurchaseRenderer = function(panelTitle) {
        this.rendererID = 'CountiesRenewableEnergyPurchaseRenderer';
        let fill = undefined;
        const JSON = fetchData();

        this.rendering = function () {
            let html = `
                <table id="renewable-purchase-infoTable" style="width: 240px;">
                    <tbody>
                        <tr>
                            <td>
                                <h6 id="cName" class="font-weight-bold"></h6>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px;">風力</td>
                            <td><span id="wind-number" style="color: forestgreen;"></span> 件</td>
                            <td><span id="wind-capacity" style="color: forestgreen;"></span> 瓩</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px;">太陽光電</td>
                            <td><span id="solar-number" style="color: orange;"></span> 件</td>
                            <td><span id="solar-capacity" style="color: orange;"></span> 瓩</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px;">其他(含水力)</td>
                            <td><span id="others-number" style="color: royalblue;"></span> 件</td>
                            <td><span id="others-capacity" style="color: royalblue;"></span> 瓩</td>
                        </tr>
                        <tr>
                            <td style="font-size: 14px; border-top: solid 1px gray">合計</td>
                            <td style="border-top: solid 1px gray;"><span id="total-number" style="color: gray;"></span> 件</td>
                            <td style="border-top: solid 1px gray;"><span id="total-capacity" style="color: gray;"></span> 瓩</td>
                        </tr>
                    </tbody>
                </table>
                <hr />
                <div style="width: 290px">
                    <canvas id="canvas-renewable-purchase" width="280" height="550" 
                      style="margin-left: -20px; margin-bottom: 30px;"></canvas>
                </div>
            `;

            execRendering(panelTitle, html, () => {
                let ctx = document.getElementById('canvas-renewable-purchase').getContext('2d');
                new Chart(ctx, {
                    type: 'horizontalBar',
                    data: {
                        labels: Object.keys(JSON),
                        datasets: [{
                            label: '風力',
                            data: Object.keys(JSON).map((county) => JSON[county].wind.capacity),
                            backgroundColor: '#8FBC8F',
                        }, {
                            label: '太陽光電',
                            data: Object.keys(JSON).map((county) => JSON[county].solar.capacity),
                            backgroundColor: '#FFDEAD',
                        }, {
                            label: '其他(含水力)',
                            data: Object.keys(JSON).map((county) => JSON[county].others.capacity),
                            backgroundColor: '#B0C4DE',
                        }]
                    },
                    options: {
                        scales: {
                            xAxes: [{
                                ticks: {
                                    beginAtZero: true,
                                    fontFamily: "'Open Sans Bold', sans-serif",
                                    fontSize: 11,
                                    callback: function(label, index, labels) {
                                        if(label === 0) return label;
                                        return (label / 1000) + 'k';
                                    }
                                },
                                stacked: true
                            }],
                            yAxes: [{
                                ticks: {
                                    fontFamily: "'Open Sans Bold', sans-serif",
                                    fontSize: 11
                                },
                                stacked: true
                            }]
                        },
                        title: {
                            display: true,
                            text: ['107年各縣市再生能源購入情形', '(依躉購容量(單位: 瓩))']
                        },
                        onClick: function(e, items) {
                            if(items.length === 0) return;
                            displayTable(items[0]._index);
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            displayTable(0);
                        }
                    }]
                });
            });
        };

        this.empty = function () {
            fill.setMap(null);
        };

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-107年各縣市再生能源購入情形.csv',
                dataType: 'TEXT',
                async: false,
                success: function (csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);

                    data.forEach((data) => {
                        let [county, ...d] = data.split(',');
                        county = county.replace('台', '臺');

                        if(!JSON[county]) {
                            JSON[county] = {};
                        }

                        for(let i = 0; i < d.length / 2; i++) {
                            let type  = ['wind', 'solar', 'others'];
                            JSON[county][type[i]] = {
                                number: d[i],
                                capacity: d[i + 3]
                            };
                        }
                    });
                }
            });
            return JSON;
        }

        function displayTable(index) {
            let county = Object.keys(JSON)[index],
                data = JSON[county],
                total = { number: 0, capacity: 0 },
                $table = $('#renewable-purchase-infoTable');

            $table.find('td h6#cName').text(county);
            $table.find('td:not(:first-child)').css('text-align', 'right');

            Object.keys(data).forEach((type) => {
                let {number, capacity} = data[type];
                $table.find(`td span#${type}-number`).text(number);
                $table.find(`td span#${type}-capacity`).text(capacity);
                total.number += Number(number);
                total.capacity += Number(capacity);
            });

            $table.find('td span#total-number').text(total.number);
            $table.find('td span#total-capacity').text(total.capacity);

            $(`#info-div-body-${panelTitle}`).animate({
                scrollTop: $table.offset().top
            }, 800);

            locateDistrict(county);
        }

        function locateDistrict(county) {
            if(fill) fill.setMap(null);

            new TGOS.TGLocateService().locateWGS84({
                district: county
            }, (e, status) => {
                let polygon = e[0].geometry.geometry;
                fill = new TGOS.TGFill(TGMap.getMap(), polygon, {
                    fillColor: '#FA6A76',
                    fillOpacity: 0.5,
                    strokeColor: '#FA6A76',
                    strokeWeight: 1,
                    strokeOpacity: 1
                });
            });
        }
    };

    Renderer.HydroPlantRenderer = function(panelTitle) {
        this.rendererID = 'HydroPlantRenderer';
        let markers = [];

        this.rendering = function () {
            let html = `
                <div id="hydro-info-division">點擊地圖上標記可查看詳細資訊</div>
            `;

            execRendering(panelTitle, html, () => {
                let map = TGMap.getMap();
                powerPlantData.hydro.forEach((plant) => {
                    new TGOS.TGLocateService().locateWGS84({
                        address: plant.addr
                    }, (e, status) => {
                        let lat = 0, lng = 0;
                        if (status !== TGOS.TGLocatorStatus.OK) {
                            lat = 24.813056;
                            lng = 121.243611;
                        }

                        let marker = new TGOS.TGMarker(map, new TGOS.TGPoint(lng, lat), plant.name);
                        marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/hydro-icon.png',
                            new TGOS.TGSize(60, 60)));
                        marker.setPosition(e[0].geometry.location);
                        TGMap.addListener(marker, 'click', (e) => {
                            $('#hydro-info-division').html(`
                                <h5 style="font-weight: bolder; color: #A52A2A;">${plant.name}</h5>
                                <span style="font-weight: bolder;">
                                    機組名稱: ${plant.setName}<br />
                                    商轉日期: ${plant.cpDate}<br/>
                                    裝置容量: ${plant.capacity}瓩<br />
                                    地址: ${plant.addr}<br />
                                    連絡電話: ${plant.tel}<br />
                                    傳真電話: ${plant.fax}
                                </span>
                            `);

                            map.fitBounds(e.target.position.Envelope);
                            map.setZoom(12);
                        });

                        markers.push(marker);
                    });
                });
            });
        };

        this.empty = function () {
            for (let marker of markers) {
                marker.setMap(null);
            }
            markers.length = 0;
        };
    };

    Renderer.InstantReservoirSituationRenderer = function(panelTitle) {
        this.rendererID = 'InstantReservoirSituationRenderer';
        let markers = [],
            fills = [];
        const instReservoirSitnData =
            fetchInstantReservoirSituation().responseJSON[0];

        this.rendering = function () {
            let html = `
                <div class="font-weight-bold">
                    <img src="${basicAssetsURL + 'icon/reservoir-icon.png'}" alt="水情正常圖示" width="30px"> 正常　
                    <img src="${basicAssetsURL + 'icon/reservoir-warning-icon.png'}" alt="水情警戒中圖示" width="30px"> 警戒中<br/>
                    <span role="checkbox" class="glyphicon glyphicon-check font-weight-bold cursor-pointer" style="margin-top: 10px; margin-left: 5px;">只顯示有即時資料的水庫</span>
                </div>
                <hr/>
                <div id="reservoir-info-division" class="font-weight-bold">
                    點擊地圖上水庫圖標可查看詳細資訊
                </div>
            `;

            execRendering(panelTitle, html, () => {
                const districtCodeMap = {
                    '63': ['臺北市', 'Taipei', {
                        '6300400': '中正區',
                        '6300600': '大同區',
                        '6300500': '中山區',
                        '6300100': '松山區',
                        '6300300': '大安區',
                        '6300700': '萬華區',
                        '6300200': '信義區',
                        '6301100': '士林區',
                        '6301200': '北投區',
                        '6301000': '內湖區',
                        '6300900': '南港區',
                        '6300800': '文山區'
                    }],
                    '64': ['高雄市', 'Kaohsiung', {
                        '6400600': '新興區',
                        '6400700': '前金區',
                        '6400800': '苓雅區',
                        '6400100': '鹽埕區',
                        '6400200': '鼓山區',
                        '6401000': '旗津區',
                        '6400900': '前鎮區',
                        '6400500': '三民區',
                        '6400400': '楠梓區',
                        '6401100': '小港區',
                        '6400300': '左營區',
                        '6401700': '仁武區',
                        '6401600': '大社區',
                        '6401900': '岡山區',
                        '6402400': '路竹區',
                        '6402300': '阿蓮區',
                        '6402200': '田寮區',
                        '6402100': '燕巢區',
                        '6402000': '橋頭區',
                        '6402900': '梓官區',
                        '6402800': '彌陀區',
                        '6402700': '永安區',
                        '6402500': '湖內區',
                        '6401200': '鳳山區',
                        '6401400': '大寮區',
                        '6401300': '林園區',
                        '6401800': '鳥松區',
                        '6401500': '大樹區',
                        '6403000': '旗山區',
                        '6403100': '美濃區',
                        '6403200': '六龜區',
                        '6403500': '內門區',
                        '6403400': '杉林區',
                        '6403300': '甲仙區',
                        '6403700': '桃源區',
                        '6403800': '那瑪夏區',
                        '6403600': '茂林區',
                        '6402600': '茄萣區'
                    }],
                    '65': ['新北市', 'NewTaipei', {
                        '6502800': '萬里區',
                        '6502700': '金山區',
                        '6500100': '板橋區',
                        '6501100': '汐止區',
                        '6501800': '深坑區',
                        '6501900': '石碇區',
                        '6501200': '瑞芳區',
                        '6502400': '平溪區',
                        '6502500': '雙溪區',
                        '6502600': '貢寮區',
                        '6500600': '新店區',
                        '6502000': '坪林區',
                        '6502900': '烏來區',
                        '6500400': '永和區',
                        '6500300': '中和區',
                        '6501300': '土城區',
                        '6500900': '三峽區',
                        '6500700': '樹林區',
                        '6500800': '鶯歌區',
                        '6500200': '三重區',
                        '6500500': '新莊區',
                        '6501600': '泰山區',
                        '6501700': '林口區',
                        '6501400': '蘆洲區',
                        '6501500': '五股區',
                        '6502300': '八里區',
                        '6501000': '淡水區',
                        '6502100': '三芝區',
                        '6502200': '石門區'
                    }],
                    '66': ['臺中市', 'Taichung', {
                        '6600100': '中區',
                        '6600200': '東區',
                        '6600300': '南區',
                        '6600400': '西區',
                        '6600500': '北區',
                        '6600800': '北屯區',
                        '6600600': '西屯區',
                        '6600700': '南屯區',
                        '6602700': '太平區',
                        '6602800': '大里區',
                        '6602600': '霧峰區',
                        '6602300': '烏日區',
                        '6600900': '豐原區',
                        '6601500': '后里區',
                        '6602000': '石岡區',
                        '6601000': '東勢區',
                        '6602900': '和平區',
                        '6601900': '新社區',
                        '6601700': '潭子區',
                        '6601800': '大雅區',
                        '6601600': '神岡區',
                        '6602400': '大肚區',
                        '6601300': '沙鹿區',
                        '6602500': '龍井區',
                        '6601400': '梧棲區',
                        '6601200': '清水區',
                        '6601100': '大甲區',
                        '6602100': '外埔區',
                        '6602200': '大安區'
                    }],
                    '67': ['臺南市', 'Tainan', {
                        '6703700': '中西區',
                        '6703200': '東區',
                        '6703300': '南區',
                        '6703400': '北區',
                        '6703600': '安平區',
                        '6703500': '安南區',
                        '6703100': '永康區',
                        '6702800': '歸仁區',
                        '6701800': '新化區',
                        '6702600': '左鎮區',
                        '6702300': '玉井區',
                        '6702400': '楠西區',
                        '6702500': '南化區',
                        '6702700': '仁德區',
                        '6702900': '關廟區',
                        '6703000': '龍崎區',
                        '6701000': '官田區',
                        '6700700': '麻豆區',
                        '6701200': '佳里區',
                        '6701400': '西港區',
                        '6701500': '七股區',
                        '6701600': '將軍區',
                        '6701300': '學甲區',
                        '6701700': '北門區',
                        '6700100': '新營區',
                        '6700500': '後壁區',
                        '6700300': '白河區',
                        '6700600': '東山區',
                        '6700900': '六甲區',
                        '6700800': '下營區',
                        '6700400': '柳營區',
                        '6700200': '鹽水區',
                        '6701900': '善化區',
                        '6701100': '大內區',
                        '6702200': '山上區',
                        '6702000': '新市區',
                        '6702100': '安定區'
                    }],
                    '68': ['桃園市', 'Taoyuan', {
                        '6800200': '中壢區',
                        '6801000': '平鎮區',
                        '6800900': '龍潭區',
                        '6800400': '楊梅區',
                        '6801100': '新屋區',
                        '6801200': '觀音區',
                        '6800100': '桃園區',
                        '6800700': '龜山區',
                        '6800800': '八德區',
                        '6800300': '大溪區',
                        '6801300': '復興區',
                        '6800600': '大園區',
                        '6800500': '蘆竹區'
                    }],
                    '09007': ['連江縣', 'LienchiangCounty'],
                    '09020': ['金門縣', 'KinmenCounty'],
                    '10002': ['宜蘭縣', 'YilanCounty'],
                    '10004': ['新竹縣', 'HsinchuCounty', {
                        '1000401': '竹北市',
                        '1000405': '湖口鄉',
                        '1000406': '新豐鄉',
                        '1000405': '新埔鎮',
                        '1000404': '關西鎮',
                        '1000407': '芎林鄉',
                        '1000410': '寶山鄉',
                        '1000402': '竹東鎮',
                        '1000413': '五峰鄉',
                        '1000408': '橫山鄉',
                        '1000412': '尖石鄉',
                        '1000409': '北埔鄉',
                        '1000411': '峨眉鄉'
                    }],
                    '10005': ['苗栗縣', 'MiaoliCounty', {
                        '1000504': '竹南鎮',
                        '1000505': '頭份市',
                        '1000516': '三灣鄉',
                        '1000511': '南庄鄉',
                        '1000517': '獅潭鄉',
                        '1000506': '後龍鎮',
                        '1000503': '通霄鎮',
                        '1000502': '苑裡鎮',
                        '1000501': '苗栗市',
                        '1000515': '造橋鄉',
                        '1000512': '頭屋鄉',
                        '1000509': '公館鄉',
                        '1000508': '大湖鄉',
                        '1000518': '泰安鄉',
                        '1000510': '銅鑼鄉',
                        '1000513': '三義鄉',
                        '1000514': '西湖鄉',
                        '1000507': '卓蘭鎮'
                    }],
                    '10007': ['彰化縣', 'ChanghuaCounty', {
                        '1000701': '彰化市',
                        '1000709': '芬園鄉',
                        '1000708': '花壇鄉',
                        '1000707': '秀水鄉',
                        '1000702': '鹿港鎮',
                        '1000706': '福興鄉',
                        '1000704': '線西鄉',
                        '1000703': '和美鎮',
                        '1000705': '伸港鄉',
                        '1000710': '員林市',
                        '1000717': '社頭鄉',
                        '1000716': '永靖鄉',
                        '1000715': '埔心鄉',
                        '1000711': '溪湖鎮',
                        '1000713': '大村鄉',
                        '1000714': '埔鹽鄉',
                        '1000712': '田中鎮',
                        '1000719': '北斗鎮',
                        '1000721': '田尾鄉',
                        '1000722': '埤頭鄉',
                        '1000726': '溪州鄉',
                        '1000725': '竹塘鄉',
                        '1000720': '二林鎮',
                        '1000724': '大城鄉',
                        '1000723': '芳苑鄉',
                        '1000718': '二水鄉'
                    }],
                    '10008': ['南投縣', 'NantouCounty', {
                        '1000801': '南投市',
                        '1000808': '中寮鄉',
                        '1000803': '草屯鎮',
                        '1000810': '國姓鄉',
                        '1000802': '埔里鎮',
                        '1000813': '仁愛鄉',
                        '1000806': '名間鄉',
                        '1000805': '集集鎮',
                        '1000811': '水里鄉',
                        '1000809': '魚池鄉',
                        '1000812': '信義鄉',
                        '1000804': '竹山鎮',
                        '1000807': '鹿谷鄉'
                    }],
                    '10009': ['雲林縣', 'YunlinCounty', {
                        '1000902': '斗南鎮',
                        '1000908': '大埤鄉',
                        '1000903': '虎尾鎮',
                        '1000905': '土庫鎮',
                        '1000915': '褒忠鄉',
                        '1000914': '東勢鄉',
                        '1000916': '台西鄉',
                        '1000912': '崙背鄉',
                        '1000913': '麥寮鄉',
                        '1000901': '斗六市',
                        '1000910': '林內鄉',
                        '1000907': '古坑鄉',
                        '1000909': '莿桐鄉',
                        '1000904': '西螺鎮',
                        '1000911': '二崙鄉',
                        '1000906': '北港鎮',
                        '1000920': '水林鄉',
                        '1000919': '口湖鄉',
                        '1000918': '四湖鄉',
                        '1000917': '元長鄉'
                    }],
                    '10010': ['嘉義縣', 'ChiayiCounty', {
                        "1001016": "番路鄉",
                        "1001015": "梅山鄉",
                        "1001014": "竹崎鄉",
                        "1001018": "阿里山鄉",
                        "1001013": "中埔鄉",
                        "1001017": "大埔鄉",
                        "1001012": "水上鄉",
                        "1001011": "鹿草鄉",
                        "1001001": "太保市",
                        "1001002": "朴子市",
                        "1001009": "東石鄉",
                        "1001008": "六腳鄉",
                        "1001007": "新港鄉",
                        "1001005": "民雄鄉",
                        "1001004": "大林鎮",
                        "1001006": "溪口鄉",
                        "1001010": "義竹鄉",
                        "1001003": "布袋鎮"
                    }],
                    '10013': ['屏東縣', 'PingtungCounty', {
                            "1001301": "屏東市",
                            "1001326": "三地門鄉",
                            "1001327": "霧臺鄉",
                            "1001328": "瑪家鄉",
                            "1001308": "九如鄉",
                            "1001309": "里港鄉",
                            "1001311": "高樹鄉",
                            "1001310": "鹽埔鄉",
                            "1001306": "長治鄉",
                            "1001307": "麟洛鄉",
                            "1001314": "竹田鄉",
                            "1001313": "內埔鄉",
                            "1001305": "萬丹鄉",
                            "1001302": "潮州鎮",
                            "1001329": "泰武鄉",
                            "1001330": "來義鄉",
                            "1001312": "萬巒鄉",
                            "1001318": "崁頂鄉",
                            "1001315": "新埤鄉",
                            "1001320": "南州鄉",
                            "1001319": "林邊鄉",
                            "1001303": "東港鎮",
                            "1001322": "琉球鄉",
                            "1001321": "佳冬鄉",
                            "1001317": "新園鄉",
                            "1001316": "枋寮鄉",
                            "1001325": "枋山鄉",
                            "1001331": "春日鄉",
                            "1001332": "獅子鄉",
                            "1001323": "車城鄉",
                            "1001333": "牡丹鄉",
                            "1001304": "恆春鎮",
                            "1001324": "滿州鄉"

                        }],
                    '10014': ['臺東縣', 'TaitungCounty', {
                            '1001401': '台東市',
                            '1001411': '綠島鄉',
                            '1001416': '蘭嶼鄉',
                            '1001413': '延平鄉',
                            '1001404': '卑南鄉',
                            '1001405': '鹿野鄉',
                            '1001403': '關山鎮',
                            '1001412': '海端鄉',
                            '1001406': '池上鄉',
                            '1001407': '東河鄉',
                            '1001402': '成功鎮',
                            '1001408': '長濱鄉',
                            '1001409': '太麻里鄉',
                            '1001414': '金峰鄉',
                            '1001410': '大武鄉',
                            '1001415': '達仁鄉'
                        }],
                    '10015': ['花蓮縣', 'HualienCounty'],
                    '10016': ['澎湖縣', 'PenghuCounty', {
                            '1001016': '番路鄉',
                            '1001015': '梅山鄉',
                            '1001014': '竹崎鄉',
                            '1001018': '阿里山鄉',
                            '1001013': '中埔鄉',
                            '1001017': '大埔鄉',
                            '1001012': '水上鄉',
                            '1001011': '鹿草鄉',
                            '1001001': '太保市',
                            '1001002': '朴子市',
                            '1001009': '東石鄉',
                            '1001008': '六腳鄉',
                            '1001007': '新港鄉',
                            '1001005': '民雄鄉',
                            '1001004': '大林鎮',
                            '1001006': '溪口鄉',
                            '1001010': '義竹鄉',
                            '1001003': '布袋鎮'
                        }],
                    '10017': ['基隆市', 'Keelung', {
                            '1001704': '仁愛區',
                            '1001707': '信義區',
                            '1001701': '中正區',
                            '1001705': '中山區',
                            '1001706': '安樂區',
                            '1001703': '暖暖區',
                            '1001702': '七堵區'
                        }],
                    '10018': ['新竹市', 'Hsinchu', {'1001801': '東區', '1001802': '北區', '1001803': '香山區'}],
                    '10020': ['嘉義市', 'Chiayi', {'1002001': '東區', '1002002': '西區'}]
                };
                const reservoirStationData = fetchReservoirStationData();
                Object.keys(reservoirStationData).forEach((station) => {
                    station = reservoirStationData[station];
                    let {stationName, countyCode, basin, lng, lat,
                        importance, protectionFlood, affectedArea} = station;

                    let map = TGMap.getMap();
                    let marker = new TGOS.TGMarker(map,
                        new TGOS.TGPoint(Number(lng), Number(lat)),
                        districtCodeMap[countyCode][0] + '-' + stationName);
                    marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/reservoir-icon.png',
                        new TGOS.TGSize(40, 40)));
                    marker.hasInstantData = instReservoirSitnData[stationName] !== undefined;
                    TGMap.addListener(marker, 'click', (e) => {
                        let instData = instReservoirSitnData[stationName];
                        let $divsion = $('#reservoir-info-division');

                        if(!instData) {
                            $divsion.html(`
                                <h5 style="color: #7D92FF;">${stationName}(${districtCodeMap[countyCode][0]})</h5>
                                <h6 style="color: #86AFFF;">基本資料:</h6>
                                <h6>所屬流域: ${basin}</h6>
                                <h6>重要性: ${importance}</h6>
                                <h6>是否防洪: ${protectionFlood}</h6>
                            `);
                        }else {
                            let {updateAt, volumn, daliyNetflow,
                                baseAvailable, percentage} = instData;
                            percentage = parseFloat(percentage).toFixed(1);

                            if(isNaN(percentage)) {
                                $divsion.html('沒有資料');
                                return;
                            }

                            $divsion.html(`
                                <h5 style="color: #7D92FF;">${stationName}(${districtCodeMap[countyCode][0]})</h5>
                                <h6 style="color: #86AFFF;">基本資料:</h6>
                                <h6>所屬流域: ${basin}</h6>
                                <h6>重要性: ${importance}</h6>
                                <h6>是否防洪: ${protectionFlood}</h6>
                                <h6 style="color: #86AFFF; margin-top: 15px;">即時資料:</h6>
                                <h6>更新時間: ${updateAt}</h6>
                                <h6>有效蓄水量: ${volumn}萬立方公尺</h6>
                                <h6 id="state" style="display: none;"></h6>
                                <h6 id="due-day" style="display: none;"></h6>
                                <svg id="liquid-gauge" width="150" height="150" style="margin-top: 20px; margin-left: 52px;"></svg>
                            `);

                            let netFlow = -parseFloat(daliyNetflow).toFixed(1);

                            if(isNaN(netFlow)) {
                                $divsion.children('#state')
                                    .show().text('昨日水量狀態：待更新');
                            }else if(netFlow < 0) {
                                let netPercentageVar = ((-netFlow) /
                                    parseFloat(baseAvailable) * 100)
                                    .toFixed(2);

                                let usageDay = Math.round(percentage / netPercentageVar);
                                if (percentage > 80 && netPercentageVar > 2) {
                                    usageDay = 60;
                                }

                                if(usageDay >= 60) {
                                    usageDay = '預測剩餘天數：60天以上';
                                }else if (usageDay >= 30) {
                                    usageDay = '預測剩餘天數：30天-60天';
                                    $divsion.children('#due-day')
                                        .css('color', 'rgb(255, 119, 119)');
                                }else {
                                    usageDay = '預測剩餘天數：' + usageDay + '天';
                                    $divsion.children('#due-day')
                                        .css('color', 'rgb(255, 119, 119)');
                                }

                                $divsion.children('#due-day')
                                    .show().text(usageDay);

                                $divsion.children('#state')
                                    .show().css('color', 'rgb(255, 119, 119)')
                                    .text('昨日水量下降：' + netPercentageVar + '%');
                            }else {
                                let netPercentageVar = ((netFlow) /
                                    parseFloat(baseAvailable) * 100)
                                    .toFixed(2);

                                $divsion.children('#state')
                                    .show().css('color', 'rgb(23, 139, 202)')
                                    .text('昨日水量上升：' + netPercentageVar + '%');
                            }

                            let liquidGauge = new LiquidFillGauge();

                            liquidGauge.config.waveAnimate = true;
                            liquidGauge.config.waveOffset = 0.3;
                            liquidGauge.config.waveHeight = 0.05;
                            liquidGauge.setAnimateTime(percentage);
                            liquidGauge.setWaveCount(percentage);
                            liquidGauge.setColor(percentage);
                            liquidGauge.load('liquid-gauge', percentage);
                        }

                        fills.forEach((fill) => fill.setMap(null));
                        fills.length = 0;

                        affectedArea.forEach((area) => {
                            let city = districtCodeMap[area.cityCode][0],
                                town = districtCodeMap[area.cityCode][2][area.townCode];

                            new TGOS.TGLocateService().locateWGS84({
                                district: city + town
                            }, ([{geometry}], status) => {
                                let polygon = geometry.geometry;
                                fills.push(new TGOS.TGFill(map, polygon, {
                                    fillColor: '#6DCAFF',
                                    fillOpacity: .7,
                                    strokeColor: '#4285F4',
                                    strokeWeight: 2,
                                    strokeOpacity: 1
                                }));
                            });
                        });

                        map.fitBounds(e.target.position.Envelope);
                        map.setZoom(11);

                        $divsion.children().addClass('font-weight-bold');
                        $(`#info-div-body-${panelTitle}`).animate({
                            scrollTop: $divsion.offset().top
                        }, 800);
                    });

                    if(!marker.hasInstantData)
                        marker.setMap(null);

                    markers.push(marker);
                });

                $('span[role="checkbox"]').click(({target}) => {
                    if($(target).hasClass('glyphicon-check')) {
                        $(target).removeClass('glyphicon-check')
                            .addClass('glyphicon-unchecked');
                    }else {
                        $(target).removeClass('glyphicon-unchecked')
                            .addClass('glyphicon-check');
                    }
                    markers.forEach((marker) => {
                        if(!marker.hasInstantData)
                            marker.setMap($(target).hasClass('glyphicon-check') ?
                                null : TGMap.getMap());
                    });
                });
            });
        };

        this.empty = function () {
            fills.forEach((fill) => fill.setMap(null));
            fills.length = 0;

            markers.forEach((marker) => marker.setMap(null));
            markers.length = 0;
        };

        function fetchInstantReservoirSituation() {
            return $.ajax({
                url: 'https://www.taiwanstat.com/waters/latest/',
                dataType: 'JSON',
                async: false,
                success: ([json]) => json
            });
        }

        function fetchReservoirStationData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + 'Reservoir-station.xml',
                dataType: 'XML',
                async: false,
                success: function (xml) {
                    for(let reservoir of $(xml).find('ReservoirStation')) {
                        let station = $(reservoir).children('StationName').text();
                        let countyCode = $(reservoir).children('CityCode').text();
                        let basin = $(reservoir).children('BasinName').text();
                        let lat = $(reservoir).children('Latitude').text();
                        let lng = $(reservoir).children('Longitude').text();
                        let importance = $(reservoir).children('Importance')
                            .text() === '1' ? '主要' : '其他';
                        let protectionFlood = $(reservoir).children('ProtectionFlood')
                            .text() === '1' ? '是' : '否';

                        let affectedArea = [];
                        for(let area of $(reservoir).find('Area')) {
                            affectedArea.push({
                                cityCode: $(area).children('CityCode').text(),
                                townCode: $(area).children('TownCode').text()
                            });
                        }

                        JSON[station] = {
                            stationName: station,
                            countyCode: countyCode,
                            basin: basin,
                            lat: lat,
                            lng: lng,
                            importance: importance,
                            protectionFlood: protectionFlood,
                            affectedArea: affectedArea
                        };
                    }
                }
            });
            return JSON;
        }

        function LiquidFillGauge() {
            this.config = defaultSettings();

            this.load = function(elementId, value) {
                const config = this.config;

                let gauge = d3.select('#' + elementId);
                let radius = Math.min(parseInt(gauge.style('width')), parseInt(gauge.style('height'))) / 2;
                let locationX = parseInt(gauge.style('width')) / 2 - radius;
                let locationY = parseInt(gauge.style('height')) / 2 - radius;
                let fillPercent = Math.max(config.minValue, Math.min(config.maxValue, value)) / config.maxValue;

                let waveHeightScale;
                if(config.waveHeightScaling){
                    waveHeightScale = d3.scale.linear()
                        .range([0, config.waveHeight, 0])
                        .domain([0, 50, 100]);
                } else {
                    waveHeightScale = d3.scale.linear()
                        .range([config.waveHeight, config.waveHeight])
                        .domain([0, 100]);
                }

                let textPixels = (config.textSize * radius / 2);
                let textFinalValue = parseFloat(value).toFixed(2);
                let textStartValue = config.valueCountUp ? config.minValue : textFinalValue;
                let percentText = config.displayPercent ? '%' : '';
                let circleThickness = config.circleThickness * radius;
                let circleFillGap = config.circleFillGap * radius;
                let fillCircleMargin = circleThickness + circleFillGap;
                let fillCircleRadius = radius - fillCircleMargin;
                let waveHeight = fillCircleRadius * waveHeightScale(fillPercent * 100);
                let waveLength = fillCircleRadius * 2 / config.waveCount;
                let waveClipCount = 1 + config.waveCount;
                let waveClipWidth = waveLength * waveClipCount;

                // Rounding functions so that the correct number of decimal places is always displayed as the value counts up.
                let textRounder = (value) => Math.round(value);
                if(parseFloat(textFinalValue) !== parseFloat(textRounder(textFinalValue))){
                    textRounder = (value) => parseFloat(value).toFixed(1);
                }
                if(parseFloat(textFinalValue) !== parseFloat(textRounder(textFinalValue))){
                    textRounder = (value) => parseFloat(value).toFixed(2);
                }

                // Data for building the clip wave area.
                let data = [];
                for(let i = 0; i <= 40 * waveClipCount; i++) {
                    data.push({
                        x: (i / (40 * waveClipCount)),
                        y: (i / 40)
                    });
                }

                // Scales for drawing the outer circle.
                let gaugeCircleX = d3.scale.linear().range([0, 2 * Math.PI]).domain([0, 1]);
                let gaugeCircleY = d3.scale.linear().range([0, radius]).domain([0, radius]);

                // Scales for controlling the size of the clipping path.
                let waveScaleX = d3.scale.linear().range([0, waveClipWidth]).domain([0, 1]);
                let waveScaleY = d3.scale.linear().range([0, waveHeight]).domain([0, 1]);

                // Scales for controlling the position of the clipping path.
                let waveRiseScale = d3.scale.linear()
                // The clipping area size is the height of the fill circle + the wave height, so we position the clip wave
                // such that the it will won't overlap the fill circle at all when at 0%, and will totally cover the fill
                // circle at 100%.
                    .range([(fillCircleMargin + fillCircleRadius * 2 + waveHeight),
                        (fillCircleMargin - waveHeight)])
                    .domain([0, 1]);
                let waveAnimateScale = d3.scale.linear()
                    .range([0, waveClipWidth - fillCircleRadius * 2]) // Push the clip area one full wave then snap back.
                    .domain([0, 1]);

                // Scale for controlling the position of the text within the gauge.
                let textRiseScaleY = d3.scale.linear()
                    .range([fillCircleMargin + fillCircleRadius * 2,
                        (fillCircleMargin + textPixels * 0.7)])
                    .domain([0, 1]);

                // Center the gauge within the parent SVG.
                let gaugeGroup = gauge.append('g')
                    .attr('transform', 'translate(' + locationX + ',' + locationY + ')');

                // Draw the outer circle.
                let gaugeCircleArc = d3.svg.arc()
                    .startAngle(gaugeCircleX(0))
                    .endAngle(gaugeCircleX(1))
                    .outerRadius(gaugeCircleY(radius))
                    .innerRadius(gaugeCircleY(radius-circleThickness));
                gaugeGroup.append('path')
                    .attr('d', gaugeCircleArc)
                    .style('fill', config.circleColor)
                    .attr('transform', 'translate(' + radius + ',' + radius + ')');

                // Text where the wave does not overlap.
                let text1 = gaugeGroup.append('text')
                    .text(textRounder(textStartValue) + percentText)
                    .attr('class', 'liquidFillGaugeText')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', textPixels + 'px')
                    .style('fill', config.textColor)
                    .attr('transform', 'translate(' + radius + ',' +
                        textRiseScaleY(config.textVertPosition) + ')');

                // The clipping wave area.
                let clipArea = d3.svg.area()
                    .x((d) => waveScaleX(d.x))
                    .y0((d) => waveScaleY(Math.sin(Math.PI * 2 * config.waveOffset * (-1) +
                        Math.PI * 2 * (1 - config.waveCount) + d.y * 2 * Math.PI)))
                    .y1((d) => fillCircleRadius * 2 + waveHeight);
                let waveGroup = gaugeGroup.append('defs')
                    .append('clipPath')
                    .attr('id', 'clipWave' + elementId);
                let wave = waveGroup.append('path')
                    .datum(data)
                    .attr('d', clipArea);

                // The inner circle with the clipping wave attached.
                let fillCircleGroup = gaugeGroup.append('g')
                    .attr('clip-path', 'url(#clipWave' + elementId + ')');
                fillCircleGroup.append('circle')
                    .attr('cx', radius)
                    .attr('cy', radius)
                    .attr('r', fillCircleRadius)
                    .style('fill', config.waveColor);

                // Text where the wave does overlap.
                let text2 = fillCircleGroup.append('text')
                    .text(textRounder(textStartValue) + percentText)
                    .attr('class', 'liquidFillGaugeText')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', textPixels + 'px')
                    .style('fill', config.waveTextColor)
                    .attr('transform', 'translate(' + radius + ',' +
                        textRiseScaleY(config.textVertPosition) + ')');

                // Make the value count up.
                if(config.valueCountUp) {
                    let textTween = function() {
                        let i = d3.interpolate(this.textContent, textFinalValue);
                        return function(t) {
                            this.textContent = textRounder(i(t)) + percentText;
                        };
                    };
                    text1.transition()
                        .duration(config.waveRiseTime)
                        .tween('text', textTween);
                    text2.transition()
                        .duration(config.waveRiseTime)
                        .tween('text', textTween);
                }

                // Make the wave rise. wave and waveGroup are separate so that horizontal and vertical movement can be controlled independently.
                let waveGroupXPosition = fillCircleMargin + fillCircleRadius * 2 - waveClipWidth;
                if(config.waveRise) {
                    waveGroup.attr('transform', 'translate(' + waveGroupXPosition + ',' + waveRiseScale(0) + ')')
                        .transition()
                        .duration(config.waveRiseTime)
                        .attr('transform', 'translate(' + waveGroupXPosition + ',' +
                            waveRiseScale(fillPercent) + ')')
                        .each("start", () => wave.attr('transform', 'translate(1, 0)')); // This transform is necessary to get the clip wave positioned correctly when waveRise=true and waveAnimate=false. The wave will not position correctly without this, but it's not clear why this is actually necessary.
                }else {
                    waveGroup.attr('transform', 'translate(' + waveGroupXPosition + ',' +
                        waveRiseScale(fillPercent) + ')');
                }

                if(config.waveAnimate) animateWave();

                function animateWave() {
                    wave.transition()
                        .duration(config.waveAnimateTime)
                        .ease('linear')
                        .attr('transform', 'translate(' + waveAnimateScale(1) + ', 0)')
                        .each('end', () => {
                            wave.attr('transform', 'translate(' + waveAnimateScale(0) + ', 0)');
                            animateWave(config.waveAnimateTime);
                        });
                }
            };

            this.setColor = function(percentage) {
                if(percentage < 25) {
                    this.config.circleColor = '#FF7777';
                    this.config.textColor = '#FF4444';
                    this.config.waveTextColor = '#FFAAAA';
                    this.config.waveColor = '#FFDDDD';
                }else if (percentage < 50) {
                    this.config.circleColor = 'rgb(255, 160, 119)';
                    this.config.textColor = 'rgb(255, 160, 119)';
                    this.config.waveTextColor = 'rgb(255, 160, 119)';
                    this.config.waveColor = 'rgba(245, 151, 111, 0.48)';
                }
            };

            this.setWaveCount = function(percentage) {
                this.config.waveCount = (function() {
                    if(percentage > 75) return 3;
                    else if(percentage > 50) return 2;
                    return 1;
                })();
            };

            this.setAnimateTime = function(percentage) {
                this.config.waveAnimateTime = (function() {
                    if(percentage > 75) return 2000;
                    else if (percentage > 50) return 3000;
                    else if (percentage > 25) return 4000;
                    return 5000;
                })();
            };

            function defaultSettings() {
                return {
                    minValue: 0, // The gauge minimum value.
                    maxValue: 100, // The gauge maximum value.
                    circleThickness: 0.05, // The outer circle thickness as a percentage of it's radius.
                    circleFillGap: 0.05, // The size of the gap between the outer circle and wave circle as a percentage of the outer circles radius.
                    circleColor: '#178BCA', // The color of the outer circle.
                    waveHeight: 0.05, // The wave height as a percentage of the radius of the wave circle.
                    waveCount: 1, // The number of full waves per width of the wave circle.
                    waveRiseTime: 1000, // The amount of time in milliseconds for the wave to rise from 0 to it's final height.
                    waveAnimateTime: 18000, // The amount of time in milliseconds for a full wave to enter the wave circle.
                    waveRise: true, // Control if the wave should rise from 0 to it's full height, or start at it's full height.
                    waveHeightScaling: true, // Controls wave size scaling at low and high fill percentages. When true, wave height reaches it's maximum at 50% fill, and minimum at 0% and 100% fill. This helps to prevent the wave from making the wave circle from appear totally full or empty when near it's minimum or maximum fill.
                    waveAnimate: true, // Controls if the wave scrolls or is static.
                    waveColor: '#178BCA', // The color of the fill wave.
                    waveOffset: 0, // The amount to initially offset the wave. 0 = no offset. 1 = offset of one full wave.
                    textVertPosition: .5, // The height at which to display the percentage text withing the wave circle. 0 = bottom, 1 = top.
                    textSize: 1, // The relative height of the text to display in the wave circle. 1 = 50%
                    valueCountUp: true, // If true, the displayed value counts up from 0 to it's final value upon loading. If false, the final value is displayed.
                    displayPercent: true, // If true, a % symbol is displayed after the value.
                    textColor: '#045681', // The color of the value text when the wave does not overlap it.
                    waveTextColor: '#A4DBf8' // The color of the value text when the wave overlaps it.
                };
            }
        }
    };

    Renderer.HydroPowerGenerationRenderer = function(panelTitle) {
        this.rendererID = 'HydroPowerGenerationRenderer';

        this.rendering = function () {
            let html = `
              <canvas id="canvas-hydro-generation-bar" height="300" style="margin-left: -10px;"></canvas>
              <h6 id="hydro-generation-title" style="margin-left: 30px;">滑入可查看更詳細資訊</h6>
              <div style="width: 350px; margin-left: -40px;">
                <canvas id="canvas-hydro-generation-pie" width="150"></canvas>
              </div>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData(),
                    TP = [], POE = [];
                JSON.data.forEach((data) => {
                    TP.push(data.台電);
                    POE.push(data.民營);
                });

                let pieChart;
                let ctx = document.getElementById('canvas-hydro-generation-bar').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: JSON.years,
                        datasets: [{
                            label: '台電',
                            data: TP,
                            backgroundColor: '#4169E1',
                            fillOpacity: .5
                        }, {
                            label: '民營',
                            data: POE,
                            backgroundColor: '#67B7DC',
                            fillOpacity: .5
                        }]
                    },
                    options: {
                        title: {
                            display: true,
                            text: '水力歷年發電量(單位: 百萬度)'
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                            custom: function (tooltipModel) {
                                if(tooltipModel.body && tooltipModel.body.length > 1) {
                                    let data = [
                                        tooltipModel.body[0].lines[0].substring(3).trim(),
                                        tooltipModel.body[1].lines[0].substring(3).trim()
                                    ];
                                    $('#hydro-generation-title').text(tooltipModel.title[0] +
                                        `(合計: ${(Number(data[0]) + Number(data[1])).toFixed(2)})`);

                                    if(pieChart) {
                                        pieChart.data.datasets[0].data = data;
                                        pieChart.update();
                                    }else {
                                        let ctx = document.getElementById('canvas-hydro-generation-pie').getContext('2d');
                                        pieChart = new Chart(ctx, {
                                            type: 'doughnut',
                                            data: {
                                                labels: ['台電', '民營'],
                                                datasets: [{
                                                    data: data,
                                                    backgroundColor: ['#4169E1', '#67B7DC'],
                                                    fillOpacity: [.5, .5],
                                                    hoverBorderColor: '#FFFFFF'
                                                }]
                                            },
                                            options: {
                                                tooltips: {
                                                    callbacks: {
                                                        label: function (tooltipItem, data) {
                                                            let dataset = data.datasets[tooltipItem.datasetIndex];
                                                            let sum = dataset.data.reduce((accumulator, currentValue) => {
                                                                return Number(accumulator) + Number(currentValue);
                                                            });
                                                            let currentValue = dataset.data[tooltipItem.index];
                                                            let percent = Math.round(((currentValue / sum) * 100));
                                                            return ' ' + data.labels[tooltipItem.index] + ':' + percent + '%';
                                                        }
                                                    }
                                                },
                                                legend: {
                                                    display: true,
                                                    labels: {
                                                        generateLabels: function (chart) {
                                                            let data = chart.data;

                                                            return data.labels.map(function (label, index) {
                                                                let ds = data.datasets[0];
                                                                let arc = chart.getDatasetMeta(0).data[index];
                                                                let custom = arc && arc.custom || {};
                                                                let getValueAtIndexOrDefault = Chart.helpers.getValueAtIndexOrDefault;
                                                                let arcOpts = chart.options.elements.arc;

                                                                let fill = custom.backgroundColor ? custom.backgroundColor :
                                                                    getValueAtIndexOrDefault(ds.backgroundColor, index, arcOpts.backgroundColor);
                                                                let stroke = custom.borderColor ? custom.borderColor :
                                                                    getValueAtIndexOrDefault(ds.borderColor, index, arcOpts.borderColor);
                                                                let value = chart.config.data.datasets[chart.getDatasetMeta(0).data[index]._datasetIndex]
                                                                    .data[chart.getDatasetMeta(0).data[index]._index];

                                                                return {
                                                                    text: label + ' : ' + value,
                                                                    fillStyle: fill,
                                                                    strokeStyle: stroke,
                                                                    lineWidth: 2,
                                                                    hidden: false,
                                                                    index: index
                                                                };
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: [{
                                                beforeInit: function(chart, options) {
                                                    chart.legend.afterFit = function() {
                                                        this.height += 20;
                                                    };
                                                }
                                            }]
                                        });
                                    }
                                }
                            }
                        },
                        responsive: true,
                        scales: {
                            xAxes: [{
                                stacked: true,
                            }],
                            yAxes: [{
                                stacked: true
                            }]
                        }
                    },
                    plugins: [{
                        beforeInit: function(chart, options) {
                            chart.legend.afterFit = function() {
                                this.height += 10;
                            };
                        }
                    }]
                });
            });
        };

        this.empty = function () {

        };

        function fetchData() {
            const JSON = {
                years: [],
                data: []
            };
            $.ajax({
                url: basicDataURL + '台灣電力公司-歷年水力發電發電量(97-10806).csv',
                dataType: 'TEXT',
                async: false,
                success: function(csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',');

                    data.forEach((data) => {
                        let temp = {};
                        data.split(',').forEach((data, index) => {
                            let obj = {};
                            obj[title[index]] = data;
                            Object.assign(temp, obj);

                            if(index === 0) {
                                JSON.years.push(data);
                            }
                        });
                        JSON.data.push(temp);
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.ThermalPlantRenderer = function(panelTitle) {
        this.rendererID = 'ThermalPlantRenderer';
        let markers = [];

        this.rendering = function () {
            let html = `
                <div id="thermal-info-division">點擊地圖上標記可查看詳細資訊</div>
                <hr />
                <h5 class="font-weight-bold">依燃料種類搜尋:</h5>
                <select id="fuel-type"></select>
                <h6 class="font-weight-bold" style="display: inline-block; margin-left: 10px;"></h6>
                <div id="thermal-info-division-byFuelType" style="margin-top: 10px;"></div>
            `;

            execRendering(panelTitle, html, () => {
                let thermalData = powerPlantData.thermal,
                    map = TGMap.getMap(),
                    fuelTypes = new Set();

                thermalData.map((plant) => {
                    new TGOS.TGLocateService().locateWGS84({
                        address: plant.addr
                    }, (e, status) => {
                        let marker = new TGOS.TGMarker(map, new TGOS.TGPoint(0, 0),
                            `${plant.name}(${plant.fuelType})`);
                        marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/thermal-icon.png',
                            new TGOS.TGSize(40, 40)));
                        marker.setPosition(e[0].geometry.location);
                        TGMap.addListener(marker, 'click', (e) => {
                            $('#thermal-info-division').html(`
                                <h5 class="font-weight-bold" style="color: #A52A2A;">${plant.name}</h5>
                                <span class="font-weight-bold">
                                    機組名稱: ${plant.setName}<br />
                                    商轉日期: ${plant.cpDate}<br/>
                                    裝置容量: ${plant.capacity}瓩<br />
                                    燃料種類: ${plant.fuelType}<br />
                                    地址: ${plant.addr}<br />
                                    連絡電話: ${plant.tel}<br />
                                    傳真電話: ${plant.fax}
                                </span>
                            `);

                            map.fitBounds(e.target.position.Envelope);
                            map.setZoom(12);
                        });

                        markers.push(marker);
                    });

                    return plant.fuelType;
                }).forEach((type) => {
                    if(!fuelTypes.has(type))
                        fuelTypes.add(type);
                });

                let $fuel_type = $('select#fuel-type');
                [...fuelTypes].forEach((type) => {
                    $fuel_type.append(`<option value="${type}">${type}</option>`);
                });

                $fuel_type.change((e) => {
                    let type = $(e.target).children('option:selected').val(),
                        matchPlantData = thermalData.filter((plant) =>
                            plant.fuelType === type);

                    $('#thermal-info-division-byFuelType').html(
                        matchPlantData.map((plant) => {
                            return `
                                <h5 class="font-weight-bold" style="color: #A52A2A;">${plant.name}</h5>
                                <span class="font-weight-bold">
                                    機組名稱: ${plant.setName}<br />
                                    商轉日期: ${plant.cpDate}<br/>
                                    裝置容量: ${plant.capacity}瓩<br />
                                    燃料種類: ${plant.fuelType}<br />
                                    地址: ${plant.addr}<br />
                                    連絡電話: ${plant.tel}<br />
                                    傳真電話: ${plant.fax}
                                </span><br/><br/>
                            `;
                        }).join(''));

                    $fuel_type.next().text(`總筆數: ${matchPlantData.length}`);
                }).trigger('change');
            });
        };

        this.empty = function () {
            for (let marker of markers) {
                marker.setMap(null);
            }
            markers.length = 0;
        };
    };

    Renderer.FossilFuelConsumptionRenderer = function(panelTitle) {
        this.rendererID = 'FossilFuelConsumptionRenderer';
        let markers = [];

        this.rendering = function () {
            let html = `
                <span class="glyphicon glyphicon-info-sign font-weight-bold"></span>
                <span class="font-weight-bold">點擊圖例可查看使用該燃料種類的火力發電廠</span>
                <canvas id="canvas-fossil-fuel-coal" width="280" height="250" 
                    style="margin: 10px 0;"></canvas>
                <canvas id="canvas-fossil-fuel-fuelOil" width="280" height="250" 
                    style="margin-bottom: 10px;"></canvas>
                <canvas id="canvas-fossil-fuel-diesel" width="280" height="250" 
                    style="margin-bottom: 10px;"></canvas>
                <canvas id="canvas-fossil-fuel-naturalGas" width="280" height="250" ></canvas>
            `;

            execRendering(panelTitle, html, () => {
                const JSON = fetchData();
                const types = {
                    coal: {
                        name: '煤',
                        unit: '百萬公噸',
                        filterName: '煤',
                        color: '#FF4500'
                    },
                    fuelOil: {
                        name: '燃料油',
                        unit: '十萬公秉',
                        filterName: '重油',
                        color: '#990099'
                    },
                    diesel: {
                        name: '柴油',
                        unit: '萬公秉',
                        filterName: '輕柴油',
                        color: '#4B0082'
                    },
                    naturalGas: {
                        name: '天然氣',
                        unit: '十億立方公尺',
                        filterName: '天然氣',
                        color: '#CD5C5C'
                    }
                };

                Object.keys(types).forEach((type) => {
                    let _label = types[type].name,
                        _data = Object.values(JSON[types[type].name]),
                        _color = types[type].color;

                    let ctx = document.getElementById(`canvas-fossil-fuel-${type}`).getContext('2d');
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: Object.keys(JSON[types[type].name])
                                .map((year) => year + '年'),
                            datasets: [{
                                type: 'line',
                                label: _label,
                                data: _data,
                                backgroundColor: Chart.helpers.color(_color)
                                    .alpha(0.5).rgbString(),
                                borderColor: _color,
                                pointRadius: 0,
                                fill: true,
                                lineTension: 0,
                                borderWidth: 2
                            }]
                        },
                        options: {
                            hover: {
                                onHover: function(e) {
                                    e.target.style.cursor = 'auto';
                                }
                            },
                            scales: {
                                xAxes: [{
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true
                                    }
                                }]
                            },
                            title: {
                                display: true,
                                text: `${types[type].name}(單位: ${types[type].unit})`
                            },
                            tooltips: {
                                intersect: false,
                                mode: 'index'
                            },
                            legend: {
                                onHover: function(e) {
                                    e.target.style.cursor = 'pointer';
                                },
                                onClick: (e, legendItem) => {
                                    this.empty();
                                    let accordPlants = powerPlantData.thermal.filter((plant) =>
                                        plant.fuelType.includes(types[type].filterName));

                                    for(let plant of accordPlants) {
                                        new TGOS.TGLocateService().locateWGS84({
                                            address: plant.addr
                                        }, (e, status) => {
                                            let marker = new TGOS.TGMarker(TGMap.getMap(),
                                                new TGOS.TGPoint(0, 0), plant.name);
                                            marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/thermal-icon.png',
                                                new TGOS.TGSize(40, 40)));
                                            marker.setPosition(e[0].geometry.location);
                                            markers.push(marker);
                                        });
                                    }
                                }
                            }
                        },
                        plugins: [{
                            beforeInit: function(chart, options) {
                                chart.legend.afterFit = function() {
                                    this.height += 10;
                                };
                            }
                        }]
                    });
                });
            });
        };

        this.empty = function () {
            for (let marker of markers) {
                marker.setMap(null);
            }
            markers.length = 0;
        };

        function fetchData() {
            const JSON = {};
            $.ajax({
                url: basicDataURL + '台灣電力公司-火力發電化石燃料耗用量(101-107).csv',
                dataType: 'TEXT',
                async: false,
                success: function(csv) {
                    let [title, ...data] = csv.split(/\r?\n|\r/);
                    title = title.split(',')
                        .map((title) => title.split('(')[0]);

                    data.forEach((data) => {
                        let [year, ...d] = data.split(',');

                        d.forEach((d, index) => {
                            if(!JSON[title[index + 1]]) {
                                JSON[title[index + 1]] = {};
                            }
                            JSON[title[index + 1]][year] = d;
                        });
                    });
                }
            });
            return JSON;
        }
    };

    Renderer.NuclearPlantRenderer = function(panelTitle) {
        this.rendererID = 'NuclearPlantRenderer';
        let markers = [];

        this.rendering = function () {
            let html = '';

            execRendering(panelTitle, html, () => {
                powerPlantData.nuclear.forEach((plant) => {
                    new TGOS.TGLocateService().locateWGS84({
                        address: plant.地址
                    }, (e, status) => {
                        let marker = new TGOS.TGMarker(TGMap.getMap(), new TGOS.TGPoint(0, 0));
                        marker.setIcon(new TGOS.TGImage(basicAssetsURL + 'icon/orange-dot.png',
                            new TGOS.TGSize(30, 30)));
                        marker.setPosition(e[0].geometry.location);
                        markers.push(marker);
                    });
                });
            });
        };

        this.empty = function () {
            for (let marker of markers) {
                marker.setMap(null);
            }
            markers.length = 0;
        };
    };

})(window, jQuery);