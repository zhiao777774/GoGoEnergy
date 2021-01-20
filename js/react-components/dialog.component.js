class Dialog extends React.Component {
    constructor(props) {
        super(props);
    }

    removeDialog = () => {
        $('.dialog-wrapper').fadeOut(1000);
        setTimeout(() => {
            ReactDOM.unmountComponentAtNode(
                document.getElementById('dialog-container'));
        }, 2500);
    };

    render() {
        return (
            <div className="dialog-wrapper">
                <span className="glyphicon glyphicon-remove" onClick={this.removeDialog} />
                {this.props.subContainer}
            </div>
        );
    }
}

function renderingDialog(subContainer = '') {
    let dialog = document.getElementById('dialog-container');

    ReactDOM.unmountComponentAtNode(dialog);
    $(dialog).empty();

    ReactDOM.render(<Dialog subContainer={subContainer} />, dialog);
}