/**
 * Created by cql on 2017/3/14.
 */

export let isIOS = navigator.appVersion.indexOf('Mac OS') > -1;
export let isMobileIOS = /iPad|iPhone/.test(navigator.userAgent);
export let isAndroid = /Android/.test(navigator.userAgent);
export let isWX = /micromessenger/i.test(navigator.userAgent);


// js 调用执行 设备 接口
/*
 @example
 c.deviceCallback(['contact', 'jumppointsCallback'], 'jumppoints', data[curIndex].id);// 都带参
 c.deviceCallback(['contact', 'thisLevelCallback'], 'goBack:0');// 不带参
 c.deviceCallback(['answer', 'uploadPicture'], 'uploadPictureShort:' + iArr[0] + '_' + iArr[1]); // 只给ios带参
 */
export function deviceCallback() {
    if (isAndroid) {
        deviceCallback = function (aName, iName, str) {
            if (str === undefined) {
                window[aName[0]][aName[1]]();
            }
            else {
                window[aName[0]][aName[1]](str);
            }
        };
    }
    else if (isIOS) {
        deviceCallback = function (aName, iName, str) {
            if (iName === undefined) return;

            if (str === undefined) window.location.href = iName;
            else window.location.href = iName + ':' + encodeURIComponent(str);
        };
    }

    deviceCallback(...arguments);
}