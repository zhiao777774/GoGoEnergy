$(function () {
    let $tree = $('#treeTable');
    $tree.html('<tbody><tr><td></td></tr></tbody>');

    let source = $.ajax({
        url: basicDataURL + 'Fancytree-source.json',
        async: false,
        success: (data) => data
    });

    let prevNode;
    $tree.fancytree({
        source: source.responseJSON,
        debugLevel: 0,
        extensions: ['table', 'glyph'],
        table: {
            indentation: 20,
            nodeColumnIdx: 0
        },
        glyph: {
            preset: 'bootstrap3',
            map: {}
        },
        init: function(event, data, flag) {
            $tree.addClass('list-group fancytree-fade-expander');
            $tree.fancytree('getTree').expandAll();
            $tree.fancytree('getTree').expandAll(false);
        },
        tooltip: function(event, data) {
            return data.node.title;
        },
        focus: function(event, data) {
            let node = data.node;

            if(!node.checkbox) {
                if(prevNode) {
                    prevNode.removeClass('active');
                    prevNode.parent.removeClass('active');
                }
                prevNode = node;
                FancytreeEventHandler.click(node.key);
            }
            node.addClass('list-group-item list-group-item-action');
        },
        click: function(event, data) {
            let node = data.node;

            if(!node.checkbox) {
                if(prevNode) {
                    prevNode.removeClass('active');
                    prevNode.parent.removeClass('active');
                }
                prevNode = node;
                FancytreeEventHandler.click(node.key);
            }
            node.addClass('list-group-item list-group-item-action');
        },
        select: function(event, data) {
            let node = data.node;
            node.addClass('list-group-item list-group-item-action');
            FancytreeEventHandler.select(node.key, node.isSelected());
        },
        renderNode: function () {
            //renderNode 事件會在 init、tooltip、collapse、expand 事件發生前調用
            $tree.find('tr').addClass('list-group-item list-group-item-action');
        }
    }).on('mouseover mouseout', 'tr.list-group-item', (event) => {
        let node = $.ui.fancytree.getNode(event);
        let children =  node.span.children;
        for(let i = 0; i <= children.length - 2; i++) {
            children[i].style.color =
                (event.type === 'mouseover') ? '#f5d016' : '#495057';
        }
    }).on('fancytreeTabHover', (event, type, title) => {
        let node = FancytreeEventHandler.getNodeByKey('_' + ACTIVITY[title]);
        $(node.tr).css('background-color',
            (type === 'mouseover') ? '#ffc107' : '#fff');
    }).on('fancytreeTabClick', (event, title) => {
        let node = FancytreeEventHandler.getNodeByKey('_' + ACTIVITY[title]);
        FancytreeEventHandler.select(node.key);
    }).on('fancytreeTabRemoved', (event, title) => {
        FancytreeEventHandler
            .getNodeByKey('_' + ACTIVITY[title])
            .setSelected(false);
        if(!isMobile()) {
            $('#info-div').width(300);
        }
    }).on('fancytreeDefaultLayerItemClick', (event, title) => {
        FancytreeEventHandler
            .getNodeByKey('_' + ACTIVITY[title])
            .setSelected(true);
    });

    let dict = $tree.fancytree('getTree').toDict(true);
    const ACTIVITY = (function parse(items) {
        let obj = {};
        for (let item of items) {
            let {title, key, children} = item;
            obj[title] = key.substring(1);

            if (children) {
                Object.assign(obj, parse(children));
            }
        }
        return obj;
    })(dict.children);

    const FancytreeEventHandler = {
        click: function (id) {
            id = (id || '_1').substring(1);

            executeNonRepeatable(() => {
                if(prevNode.data.features) {
                    this.empty();
                    destroyCurrentTab();
                    switchPanel();
                    $('#info-div-header span h5')
                        .text(Object.keys(ACTIVITY)[Number(id) - 1]);

                    if($('#info-div').width() <= 15) {
                        $('#info-div').width(300);
                    }
                }
            });
        },
        select: function (id, state) {
            id = (id || '_1').substring(1);
            let title = Object.keys(ACTIVITY)[Number(id) - 1];

            if(state || typeof state === 'undefined') {
                if(state) {
                    addTab(title);
                    addPanel(title);
                    if(!isMobile() && $('#info-div').width() <= 15) {
                        $('#info-div').width(300);
                    }
                }

                this.empty(title);
                switchPanel(title);
                $('#info-div-header span h5').text(title);
            }else {
                if($('#info-div-header span h5').text() === title) {
                    this.empty(title);
                    $('#info-div-header span img').click();
                }
                removeTab(title);
                removePanel(title);
            }

            let renderer;
            switch (id) {
                case ACTIVITY.建置太陽能發電站:
                    renderer = new Renderer.BuildSolarPanelAssessmentRenderer(title);
                    break;
                case ACTIVITY.建置風力發電站:
                    renderer = new Renderer.BuildWindPlantAssessmentRenderer(title);
                    break;
                case ACTIVITY.即時供電現況:
                    renderer = new Renderer.InstantPowerSupplyRenderer(title);
                    break;
                case ACTIVITY.未來預估電力資訊:
                    renderer = new Renderer.EstimateElectricityInformationRenderer(title);
                    break;
                case ACTIVITY.各縣市年度用電比例:
                    renderer = new Renderer.CountiesElecConsumptionRenderer(title);
                    break;
                case ACTIVITY.風力發電站:
                    renderer = new Renderer.WindPlantRenderer(title);
                    break;
                case ACTIVITY.歷年風力發電量:
                    renderer = new Renderer.WindPowerGenerationRenderer(title);
                    break;
                case ACTIVITY.太陽能發電站:
                    renderer = new Renderer.SolarPlantRenderer(title);
                    break;
                case ACTIVITY.各縣市太陽能發展狀況:
                    renderer = new Renderer.CountiesSolarPowerDevelopingRenderer(title);
                    break;
                case ACTIVITY.歷年太陽能發電量:
                    renderer = new Renderer.SolarPowerGenerationRenderer(title);
                    break;
                case ACTIVITY.近十年再生能源結構:
                    renderer = new Renderer.RenewableEnergyStructureInTenYearsRenderer(title);
                    break;
                case ACTIVITY.近十年再生能源裝置容量資訊:
                    renderer = new Renderer.RenewableEnergyInstalledCapacityInTenYearsRenderer(title);
                    break;
                case ACTIVITY.各縣市再生能源比例:
                    renderer = new Renderer.CountiesRenewableEnergyRatioRenderer(title);
                    break;
                case ACTIVITY.各縣市再生能源購入情形:
                    renderer = new Renderer.CountiesRenewableEnergyPurchaseRenderer(title);
                    break;
                case ACTIVITY.水力發電站:
                    renderer = new Renderer.HydroPlantRenderer(title);
                    break;
                case ACTIVITY.水庫即時水情:
                    renderer = new Renderer.InstantReservoirSituationRenderer(title);
                    break;
                case ACTIVITY.歷年水力發電量:
                    renderer = new Renderer.HydroPowerGenerationRenderer(title);
                    break;
                case ACTIVITY.火力發電站:
                    renderer = new Renderer.ThermalPlantRenderer(title);
                    break;
                case ACTIVITY.近年化石燃料耗用量:
                    renderer = new Renderer.FossilFuelConsumptionRenderer(title);
                    break;
                case ACTIVITY.核能發電站:
                    renderer = new Renderer.NuclearPlantRenderer(title);
                    break;
                default:
                    return;
            }

            if(state || typeof state === 'undefined') {
                if(!rendererList.hasOwnProperty(renderer.rendererID)
                    || !rendererList[renderer.rendererID]) {
                    renderer.rendering();
                    rendererList[renderer.rendererID] = renderer;
                }
            }else {
                rendererList[renderer.rendererID].empty();
                rendererList[renderer.rendererID] = undefined;
            }
            console.log(rendererList);
        },
        empty: function (title) {
            let panelID = `info-div-body${!title ? '' : '-' + title}`;
            ReactDOM.unmountComponentAtNode(
                document.getElementById(panelID));
            $(panelID).empty();
        },
        getNodeByKey: function (key) {
            return $tree.fancytree('getTree').getNodeByKey(key);
        }
    };

});