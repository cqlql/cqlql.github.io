/**
 * Created by cql on 2017/5/27.
 */

let d, d2;
d = [{                                      //听课评价记录表
    "content": "content111111111111", //记录内容
    "content_type": 0, //类型 0 :文本，1：手绘图片 , 2：音频 ，3：拍照图片
    "label": 0, //标签 0:优点，1：建议，2：普通
    "display_order": 2, //记录排序
    "time_length": "2" //语言时长
},{
        "content": "http://www.baidu.com",
        "content_type": 1,
        "label": 1,
        "display_order": 1
    },{
    "content": "content111111111111",
    "content_type": 0,
    "label": 2,
    "display_order": 1
}]


window.webjs = {

    draw(){

        window.js.addPicture();

    },
    camera(){
        window.js.addPicture();
    },
    voice(){
        window.js.addAudio(16);
    },
    saveData(){

    }
};

transmitData(d);