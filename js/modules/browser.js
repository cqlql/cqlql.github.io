
export default function browser() {
    let info = {};

    // Android
    if (info.version = navigator.userAgent.match(/Android (\d.\d)/)) {
        info.name = 'Android';
        info.version = info.version[1];
    }

    console.log('第一次导入执行');

    // 重写模块
    browser = function () {
        console.log('以后再导入只执行这里');
        return info;
    };

    return info;
}

