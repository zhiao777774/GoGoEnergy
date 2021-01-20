let currentTab;
function addTab(title) {
    let $tabs = $('#tabs-container'),
        $tree = $('#treeTable');

    if($tabs.has('ul').length < 1) {
        $tabs.append('<ul></ul>');
    } else if($tabs.find('li').length >= 6) {
        let title = $tabs.find('li').first().text();
        $tabs.find('li').first().remove();
        $tree.trigger('fancytreeTabRemoved', [title]);
    }
    $tabs.children('ul').append(`<li class="tab">${title}</li>`);

    if(currentTab) {
        $(currentTab).css('background', '#ced4da');
    }
    currentTab = $tabs.find('li').last().css('background', '#ffc107');

    $(currentTab).click((e) => {
        if($('#info-div').width() <= 15) {
            $('#info-div').width(300);
        }

        if(!currentTab || $(e.target).text() !== $(currentTab).text()) {
            $(currentTab).css('background', '#ced4da');
            currentTab = $(e.target).css('background', '#ffc107');

            $tree.trigger('fancytreeTabClick', [title]);
        }
    }).hover((e) => {
        $tree.trigger('fancytreeTabHover', [e.handleObj.type, title]);
    });
}

function removeTab(title) {
    let $tabs = $('#tabs-container');

    for(let child of $tabs.find('li')) {
        if($(child).text() === title) {
            $(child).remove();
            break;
        }
    }
}

function destroyCurrentTab() {
    if(currentTab) {
        $(currentTab).css('background', '#ced4da');
        currentTab = undefined;
    }
}

function addPanel(title) {
    $('#info-div').append(`
        <div id="info-div-body-${title}" class="card-body scrollbar"></div>
    `);
    switchPanel(title);
}

function removePanel(title) {
    $(`#info-div-body-${title}`).remove();
}

function switchPanel(title) {
    title = title || '';
    for(let body of $('#info-div div.card-body')) {
        $(body).hide();
    }

    $(`#info-div-body${!title ? '' : '-' + title}`).show();
}

$(function () {
    $('#info-div-header span img').click(() => {
        $('#info-div').width(isMobile() ? 0 : 15);
    });
});