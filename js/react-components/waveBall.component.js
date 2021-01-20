class WaveBall extends React.Component {
    render() {
        let config = this.props.config;
        return (
            <div className="wave-ball">
                <div className="wave-ball-content">
                    <h1 className="wave-ball-number">{config.num}</h1>
                    <p className="wave-ball-title">{config.title}</p>
                </div>
                <span className="wave wave-level-one" />
                <span className="wave wave-level-two" />
                <span className="wave" />
            </div>
        );
    }
}

function renderingWaveBall(id, config = {}) {
    ReactDOM.render(<WaveBall config={config} />,
        document.getElementById(id));
}