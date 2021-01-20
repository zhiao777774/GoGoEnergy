(function (document) {
	'use strict';

	// 建立 LightTableFilter
	const LightTableFilter = (function(Arr) {

		let _input;

		// 資料輸入事件處理函數
		function _onInputEvent(e) {
			_input = e.target;
			let tables = document.getElementsByClassName(_input.getAttribute('data-table'));
			let onfiltered = Function('row', _input.getAttribute('onfiltered') || ((row) => {}));
			Arr.forEach.call(tables, (table) => {
				Arr.forEach.call(table.tBodies, (tbody) => {
					Arr.forEach.call(tbody.rows, _filter);
					Arr.forEach.call(tbody.rows, onfiltered);
				});
			});
		}

		// 資料篩選函數，顯示包含關鍵字的列，其餘隱藏
		function _filter(row) {
			let text = row.textContent.toLowerCase(), val = _input.value.toLowerCase();
			row.style.display = text.indexOf(val) === -1 ? 'none' : 'table-row';
		}

		return {
			// 初始化函數
			init: function() {
				let inputs = document.getElementsByClassName('light-table-filter');
				Arr.forEach.call(inputs, (input) => {
					input.oninput = _onInputEvent;
				});
			}
		};

	})(Array.prototype);

	// 網頁載入完成後，啟動 LightTableFilter
	document.addEventListener('readystatechange', () => {
		if (document.readyState === 'complete') {
			LightTableFilter.init();
		}
	});

})(document);