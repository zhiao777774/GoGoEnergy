const FinanceUtils = {
    PP: function(cashFlow) {
        if(!Array.isArray(cashFlow)) {
             cashFlow = Array.from(arguments);
        }

        let paybackY = 0,
            i = paybackY,
            temp = 0;

        do {
            if((i + 1) >= cashFlow.length) {
                cashFlow.push(cashFlow[i]);
            }

            temp += cashFlow[i + 1];
            i = ++paybackY;
        } while (temp < Math.abs(cashFlow[0]));

        temp = Math.abs(cashFlow[0]);
        for(i = 1; i <= paybackY - 1; i++) {
            temp -= cashFlow[i];
        }

        const payback = (paybackY - 1) + temp / cashFlow[paybackY];

        return payback.toFixed(2);
    },
    NPV: function(discountRate, cashFlow) {
        if(!Array.isArray(cashFlow)) {
            [discountRate, ...cashFlow] = new Array(arguments.length)
                .map((e, i) => arguments[i]);
        }

        let NPV = 0;
        for(let i = 0; i < cashFlow.length; i++) {
            NPV += cashFlow[i] / Math.pow(1 + discountRate, i + 1);
        }

        return NPV;
    },
    IRR: function(cashFlow) {
        if(!Array.isArray(cashFlow)) {
            cashFlow = Array.from(arguments);
        }

        let min = 0.0, max = 1.0,
            guest = 0, NPV = 0;

        do {
            guest = (min + max) / 2;

            for (let i = 0; i < cashFlow.length; i++) {
                NPV += cashFlow[i] / Math.pow(1 + guest, i + 1);
            }

            (NPV > 0) ? min = guest : max = guest;
        } while(Math.abs(NPV) > 0.000001);

        return guest * 100;
    }
};