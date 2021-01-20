class SolarPanelAssessedDivision extends React.Component {
    constructor(props) {
        super(props);
    }

    displayArea = () => {
        $('.calculateArea').show();
        $('.calculateArea + div').hide();
        $('#btnCalculateArea').css('background-color', '#fafbc2');
        $('#btnCalculateChart').css('background-color', '#ffc107');
    };

    displayChart = () => {
        $('.calculateArea').hide();
        $('.calculateArea + div').show();
        $('#btnCalculateArea').css('background-color', '#ffc107');
        $('#btnCalculateChart').css('background-color', '#fafbc2');
    };

    render() {
        return (
            <div>
                <button id="btnCalculateArea" className="btn btn-xs btn-warning" onClick={this.displayArea} style={{'background-color': '#fafbc2'}}>查看評估資訊</button>
                <button id="btnCalculateChart" className="btn btn-xs btn-warning" onClick={this.displayChart}>查看評估資訊圖表</button>
                <div className="calculateArea scrollbar">
                    <div>
                        <div className="calculateArea-item">
                            <h5 id="earn-cost"></h5>
                        </div>
                        <div className="calculateArea-item">
                            <h5 id="fitness"></h5>
                        </div>
                    </div>
                    <hr style={{width: '95%'}}/>
                    <div className="display-flex">
                        <div className="column">
                            <img src="https://www.plusrenewable.com/wp-content/uploads/2015/05/calcost.png"/>
                            <h2 className="title">預估安裝費用</h2>
                            <span className="desc-text">以太陽能光電模組平均市值計算</span>
                            <div id="cost">
                                <h3></h3>
                                <span>NTD</span>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">預估投資報酬率</span>
                                <div id="roi">
                                    <h3></h3>
                                    <span>%</span>
                                </div>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">每度收益</span>
                                <div id="income">
                                    <h3></h3>
                                    <span>元</span>
                                </div>
                            </div>
                        </div>
                        <div className="column">
                            <img src="https://www.plusrenewable.com/wp-content/uploads/2015/05/calbattery.png"/>
                            <h2 className="title">預估年度發電量</h2>
                            <span className="desc-text">以經濟部能源局的日發電量為基礎</span>
                            <div id="kwh">
                                <h3></h3>
                                <span>kwh</span>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">等同於減少使用了</span>
                                <div id="aircon">
                                    <h3></h3>
                                    <span>個小時的冷氣</span>
                                </div>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">每年相當於種植</span>
                                <div id="tree">
                                    <h3></h3>
                                    <span>棵樹</span>
                                </div>
                            </div>
                        </div>
                        <div className="column">
                            <img src="https://www.plusrenewable.com/wp-content/uploads/2015/05/calbattery.png"/>
                            <h2 className="title">預估每年售電收入</h2>
                            <span className="desc-text">以公告電價計算，租約保證最少20年</span>
                            <div id="twd">
                                <h3></h3>
                                <span>元/每年度</span>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">讓四口之家省下了</span>
                                <div id="msmeb">
                                    <h3></h3>
                                    <span>個月的電費</span>
                                </div>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">每年相當於種植</span>
                                <div id="tree_area">
                                    <h3></h3>
                                    <span>公頃的森林</span>
                                </div>
                            </div>
                        </div>
                        <div className="column">
                            <img src="https://www.plusrenewable.com/wp-content/uploads/2015/05/calbattery.png"/>
                            <h2 className="title">預估環境的貢獻度</h2>
                            <span className="desc-text">以能源局公告的CO2係數<br/>計算</span>
                            <div id="kgco2e">
                                <h3></h3>
                                <span>KG-CO2/YEAR</span>
                            </div>
                            <hr/>
                            <div className="item">
                                <span className="desc-text">等同於少開了</span>
                                <div id="kmcar">
                                    <h3></h3>
                                    <span>公里的汽車</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{display: 'none'}}>
                    <canvas id="canvas-access-results-irr" style={{height: '225px', width: '510px', padding: '0px 10px'}}></canvas>
                </div>
            </div>
        );
    }
}

function getSolarPanelAssessedDivision() {
    return <SolarPanelAssessedDivision />
}