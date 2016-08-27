/**
 * Created by SD01 on 2016/6/17.
 */

var dom = require('dom');

function flicker(params) {

    var
        elem = params.elem,
        toBc = params.toBc || '#ff9',

        bc = elem.data_bc,

        status = 0,
        time = 4;

    if (bc === undefined) {
        bc = elem.data_bc = dom.getCss(elem, 'background-color');
    }

    if (elem.data_flickerTimeId !== undefined) {
        clearTimeout(elem.data_flickerTimeId);
        elem.data_flickerTimeId = undefined;
    }

    function excu() {
        if (status) {
            dom.setCss(elem, 'background-color', bc);
            status = 0;
        }
        else {
            dom.setCss(elem, 'background-color', toBc);
            status = 1;
        }

        if (time > 1) {
            elem.data_flickerTimeId = setTimeout(excu, 300);
        }
        time--;
    }

    excu();
}

function isTransparent(str) {
    var vStr = 'rgba(0, 0, 0, 0)|transparent';

    return vStr.indexOf(str) > -1;

}

module.exports = flicker;
