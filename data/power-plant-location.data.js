const powerPlantData = (function () {

    return (function (sources, props) {
        const _results = {};
        sources.forEach((source, index) => {
           $.ajax({
               url: `../GoGoEnergy/data/${source.fileName}.csv`,
               dataType: 'TEXT',
               success: function (csv) {
                   let [title, ...data] = csv.split(/\r?\n|\r/);
                   title = title.split(',');

                   if(typeof props[index] !== 'string') {
                       let _temp = source.callback(title, data);
                       props[index].forEach((item) => {
                           _results[item] = _temp[item];
                       });
                   }else {
                       _results[props[index]] = source.callback(title, data);
                   }
               }
           });
        });

        return _results;
    })([
        {fileName: '風力發電廠位置、機組設備及預估供電範圍', callback: (title, data) => {
                let wind = [];
                data.forEach((data) => {
                    let [name, region, region_code,
                        lat, lng, group_code,
                        vendor, brand, devices,
                        power_generation, avg_power_generation] = data.split(',');

                    wind.push({
                        name: name,
                        region: region,
                        region_code: region_code,
                        lat: lat,
                        lng: lng,
                        group_code: group_code,
                        vendor: vendor,
                        brand: brand,
                        devices: devices,
                        power_generation: power_generation,
                        avg_power_generation: avg_power_generation
                    });
                });
                //FirebaseDB.set('發電廠位置', '風力發電廠', {data: wind});
                return wind;
        }},
        {fileName: '台灣電力公司-水火力發電廠位置及機組設備', callback: (title, data) => {
                let hydro = [], thermal = [];
                data.forEach((data) => {
                    let [name, addr, tel, fax, setName,
                        cpDate, capacity, fuelType] = data.split(',');

                    (fuelType === '水' ? hydro : thermal).push({
                        name: name, addr: addr.trim().substring(5),
                        tel: tel, fax: fax, setName: setName,
                        cpDate: cpDate, capacity: capacity, fuelType: fuelType
                    });
                });
                //FirebaseDB.set('發電廠位置', '水力發電廠', {data: hydro});
                //FirebaseDB.set('發電廠位置', '火力發電廠', {data: thermal});
                return {
                    hydro: hydro,
                    thermal: thermal
                };
        }},
        {fileName: '台灣電力公司-核能發電廠位置及機組設備', callback: (title, data) => {
                let nuclear = [];
                data.forEach((data) => {
                    let temp = {};
                    data.split(',').forEach((data, index) => {
                        let obj = {};
                        obj[title[index]] = data;
                        Object.assign(temp, obj);
                    });
                    nuclear.push(temp);
                });
                //FirebaseDB.set('發電廠位置', '核能發電廠', {data: nuclear});
                return nuclear;
        }},
        {fileName: '台灣電力公司-太陽能發電廠位置及機組設備(10806)', callback: (title, data) => {
                let solar = [];
                data.forEach((data) => {
                    let [name, addr, lat, lng,
                        capacity, generation, avgUnitGerer] = data.split(',');

                    solar.push({
                        name: name,
                        addr: addr,
                        lat: lat,
                        lng: lng,
                        capacity: capacity,
                        generation: generation,
                        avgUnitGerer: avgUnitGerer
                    });
                });
                //FirebaseDB.set('發電廠位置', '太陽能發電廠', {data: solar});
                return solar;
        }}
    ], ['wind', ['hydro', 'thermal'], 'nuclear', 'solar']);

})();