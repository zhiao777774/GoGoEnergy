$(function () {
    $('nav').on('click mouseover', () => {
        if($('nav').width() <= 20) {
            $('nav').width(300).css('cursor', 'default');
        }
    });

    $('nav .card-header img').click(() => {
        $('#btnCollapseAll').click();
        $('nav').width(isMobile() ? 0 : 20)
            .css('cursor', 'pointer');
    });

    $('#nav-collapse').click(() => {
        $('#info-div-header span img').click();
        $('nav').width('100vw').css('cursor', 'default');
    });

    $('#btnReset').click(() => {
        TGMap.reset();
    });

    $('#btnExpandAll').click(() => {
        $('#treeTable').fancytree('getTree').expandAll();
    });

    $('#btnCollapseAll').click(() => {
        $('#treeTable').fancytree('getTree').expandAll(false);
    });

    $('#btnDeselectAll').click(() => {
        $('#treeTable').fancytree('getTree').selectAll(false);
    });
});

function onFiltered(row) {
    row.style.display = row.style.display === 'table-row' ? '' : row.style.display;
}