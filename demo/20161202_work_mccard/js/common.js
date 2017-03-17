/**
 * Created by cql on 2016/12/5.
 */


var c = (function () {

    var c = {};

    c.loadScript = function (params) {
        var src = params.src,
            callback = params.callback || function () {
                },
            charset = params.charset || 'utf-8',

            script = document.createElement('script');

        script.type = "text/javascript";
        script.charset = charset;
        script.src = src;
        script.onload = callback;

        document.head.appendChild(script);
    };



    // 天气图标
    c.weatherInfo = {
        icoUrl: 'http://mat1.gtimg.com/weather/2014gaiban/',
        data: {
            '00': {'bg': 'qing',        'ico': 'qing',           'name': '晴'},
            '01': {'bg': 'duoyun',      'ico': 'duoyun',         'name': '多云'},
            '02': {'bg': 'yin',         'ico': 'yin',            'name': '阴'},
            '03': {'bg': 'xiaoyu',      'ico': 'zhenyu',         'name': '阵雨'},
            '04': {'bg': 'leizhenyu',   'ico': 'leizhenyu',      'name': '雷阵雨'},
            '05': {'bg': 'leizhenyu',   'ico': 'leizhenyu',      'name': '雷阵雨并伴有冰雹'},
            '06': {'bg': 'xiaoyu',      'ico': 'yujiaxue',       'name': '雨夹雪'},
            '07': {'bg': 'xiaoyu',      'ico': 'xiaoyuzhongyu',  'name': '小雨'},
            '08': {'bg': 'xiaoyu',      'ico': 'xiaoyuzhongyu',  'name': '中雨'},
            '09': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '大雨'},
            '10': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '暴雨'},
            '11': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '大暴雨'},
            '12': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '特大暴雨'},
            '13': {'bg': 'xue',         'ico': 'zhenxue',        'name': '阵雪'},
            '14': {'bg': 'xue',         'ico': 'xiaoxuezhongxue','name': '小雪'},
            '15': {'bg': 'xue',         'ico': 'xiaoxuezhongxue','name': '中雪'},
            '16': {'bg': 'xue',         'ico': 'daxuebaoxue',    'name': '大雪'},
            '17': {'bg': 'xue',         'ico': 'daxuebaoxue',    'name': '暴雪'},
            '18': {'bg': 'wu',          'ico': 'wu',             'name': '雾'},
            '19': {'bg': 'xiaoyu',      'ico': 'dongyu',         'name': '冻雨'},
            '20': {'bg': 'shachenbao',  'ico': 'shachenbao',     'name': '沙尘暴'},
            '21': {'bg': 'xiaoyu',      'ico': 'xiaoyuzhongyu',  'name': '小雨-中雨'},
            '22': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '中雨-大雨'},
            '23': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '大雨-暴雨'},
            '24': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '暴雨-大暴雨'},
            '25': {'bg': 'dayubaoyu',   'ico': 'dayubaoyu',      'name': '大暴雨-特大暴雨'},
            '26': {'bg': 'xue',         'ico': 'xiaoxuezhongxue','name': '小雪-中雪'},
            '27': {'bg': 'xue',         'ico': 'daxuebaoxue',    'name': '中雪-大雪'},
            '28': {'bg': 'xue',         'ico': 'daxuebaoxue',    'name': '大雪-暴雪'},
            '29': {'bg': 'fuchen',      'ico': 'mai',            'name': '浮尘'},
            '30': {'bg': 'fuchen',      'ico': 'mai',            'name': '扬沙'},
            '31': {'bg': 'shachenbao',  'ico': 'shachenbao',     'name': '强沙尘暴'},
            '53': {'bg': 'mai',         'ico': 'mai',            'name': '霾'}
        }
    };


    return c;
}());