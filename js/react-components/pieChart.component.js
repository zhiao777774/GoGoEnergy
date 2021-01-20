class PieChart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            data: props.data,
            title: props.title,
            text: props.text
        };
        this.init = this.init.bind(this);
    }

    componentDidMount() {
        this.init();
    }

    init() {
        let width = parseInt(d3.select('#pieChart').style('width'), 10);
        let height = width;
        let radius = (Math.min(width, height) - 15) / 2;

        let total = 0;  // used to calculate %s
        this.state.data.forEach((d) => total += d.amount);

        let title = (obj) => {
            let titles = [];
            for (let o of obj) {
                titles.push(o.title);
            }
            return titles;
        };

        // grabs the responsive value in 'counter-reset' css value
        let innerRadius = $('.pie-container #pieChart').css('counter-reset').split(' ')[1];

        let arcOver = d3.arc()
            .outerRadius(radius + 10)
            .innerRadius(innerRadius);

        let color = d3.scaleOrdinal();
        color.domain(title(this.state.data))
            .range(["#2BDFBB", "#DF2B4F", "#EE6617", "#FFBF00", '#423E6E', '#a14358']);

        let arc = d3.arc()
            .outerRadius(radius - 10)
            .innerRadius(innerRadius);

        let pie = d3.pie()
            .sort(null)
            .value((d) => +d.amount);

        // direction of the slice angle (for responsiveness)
        let sliceDirection = 90;
        if(window.matchMedia("(max-width: 767px)").matches) {
            sliceDirection = 180;
        }

        let prevSegment = null;
        let change = (d, i) => {
            let angle = sliceDirection - ((d.startAngle * (180 / Math.PI)) +((d.endAngle - d.startAngle) * (180 / Math.PI) / 2));

            svg.transition()
                .duration(1000)
                .attr("transform", "translate(" + radius +
                    "," + height / 2 + ") rotate(" + angle + ")");
            d3.select(prevSegment)
                .transition()
                .attr("d", arc)
                .style('filter', '');
            prevSegment = i;

            d3.select(i)
                .transition()
                .duration(1000)
                .attr("d", arcOver)
                .style("filter", "url(#drop-shadow)");
        };


        let svg = d3.select("#pieChart").append("svg")
            .attr("width", '100%')
            .attr("height", '100%')
            .attr('viewBox', '0 0 ' + Math.min(width, height) + ' ' + Math.min(width, height))
            .attr('preserveAspectRatio', 'xMinYMin')
            .append("g")
            .attr("transform", "translate(" + radius + "," + height / 2 + ")")
            .style("filter", "url(#drop-shadow)");


        // Create Drop Shadow on Pie Chart
        let defs = svg.append("defs");
        let filter = defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("height", "130%");

        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 5.5)
            .attr("result", "blur");

        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 0)
            .attr("result", "offsetBlur");

        let feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");

        // toggle to allow animation to halfway finish before switching segment again
        let buttonToggle = true;
        let switchToggle = () => {
            setTimeout(() => {
                buttonToggle = true;
            }, 1500)
        };


        // Function to darken Hex colors
        let colorLuminance = (hex, lum) => {
            // validate hex string
            hex = String(hex).replace(/[^0-9a-f]/gi, '');
            if (hex.length < 6) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            lum = lum || 0;

            // convert to decimal and change luminosity
            let rgb = "#", c;
            for (let i = 0; i < 3; i++) {
                c = parseInt(hex.substr(i * 2,2), 16);
                c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
                rgb += ("00" + c).substr(c.length);
            }

            return rgb;
        };

        let timeline = new TimelineLite();

        let g = svg.selectAll("path")
            .data(pie(this.state.data))
            .enter().append("path")
            .style("fill", function(d) {
                return color(d.data.title);
            })
            .attr("d", arc)
            .style("fill", function(d) {
                return color(d.data.title);
            })
            .on("click", function(d) {

                if(buttonToggle) {
                    buttonToggle = false;
                    switchToggle();

                    change(d, this);

                    let timeline = new TimelineLite();

                    //TweenMax.set(".panel", {perspective:800});
                    //TweenMax.set(".content-wrapper", {transformStyle:"preserve-3d"});

                    timeline.to('.content-wrapper', .5, {
                        rotationX: '90deg',
                        opacity: 0,
                        ease: Linear.easeNone,
                        onComplete: () => $('.pie-container .content-wrapper').hide()
                    }).to('.panel', .5, {
                        width: '0%',
                        opacity: .05,
                        ease: Linear.easeNone,
                        onComplete: () => {
                            $('.pie-container #segmentTitle').replaceWith(`<h1 id="segmentTitle">${d.data.title} - ${Math.round((d.data.amount / total) * 1000) / 10}%</h1>`);
                            $('.pie-container #segmentText').replaceWith(`<p id="segmentText">${d.data.description}</p>`);
                            $('.pie-container .panel').css('background-color', `${colorLuminance(color(d.data.title), -0.3)}`);
                        }
                    });

                    timeline.to('.panel', .5, {
                        width: '100%',
                        opacity: 1,
                        ease: Linear.easeNone,
                        onComplete: () => $('.pie-container .content-wrapper').show()
                    }).to('.content-wrapper', .5, {
                        rotationX: '0deg',
                        opacity: 1,
                        ease: Linear.easeNone,
                    })
                }
            });

        timeline.from('#pieChart', .5, {
            rotation: '-120deg',
            scale: .1,
            opacity: 0,
            ease: Power3.easeOut,
        }).from('.panel', .75, {
            width: '0%',
            opacity: 0,
            ease: Linear.easeNone,
            onComplete: () => $('.pie-container .content-wrapper').show()
        }, '+=.55').from('.content-wrapper', .75, {
            rotationX: '-90deg',
            opacity: 0,
            ease: Linear.easeNone,
        });
    }

    render() {
        return (
            <div className="pie-container">
                <div className="row">
                    <div className="col-md-5" id="pieChart" />
                    <div id="pieText" className="col-md-7 text-container">
                        <div className="panel">
                            <div className="content-wrapper">
                                <h1 id="segmentTitle">{this.state.title}</h1>
                                <p id="segmentText">{this.state.text}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

function renderingPieChart(id, {data, title, text} = {}) {
    ReactDOM.render(<PieChart data={data} title={title} text={text} />,
        document.getElementById(id));
}

function getPieChart({data, title, text} = {}) {
    return <PieChart data={data} title={title} text={text} />;
}