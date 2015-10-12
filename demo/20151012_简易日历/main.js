"use strict";




var eBox = document.getElementById('calendarTd'),
    eCon = eBox.children[1],
    eTemp = eBox.children[0].children[0].children[0].children,

    eYearSelect = eTemp[0],
    eMonthSelect = eTemp[1],
    eTodayBtn = eTemp[2],

    eYearChilds = eYearSelect.children,

    startYear,
        
    toDay = new Date();

buildYearSelect();

eTodayBtn.onclick = selectToDay;

eYearSelect.onchange = selectChange;
eMonthSelect.onchange = selectChange;

selectToDay();

// 构建年份选择框
function buildYearSelect() {
    var html = '',
        year = toDay.getFullYear();
    for (var i = 0, len = 30; i < len; i++) {
        html += '<option>' + (year -15+i)+ '</option>';
    }
    eYearSelect.innerHTML = html;
}

function selectToDay() {
    var month = toDay.getMonth();

    eYearSelect.options[15].selected = true;
    eMonthSelect.options[month].selected = true;

    update(toDay.getFullYear(), month + 1, toDay.getDate());
}

function selectChange() {

    update(eYearSelect.value, eMonthSelect.selectedIndex+1);
}

// 日历 年月改变 更新
function update(year, month,day) {

    eCon.innerHTML = buildHtml({
        year: year,
        month: month,
        day:day
    });

}

// ** 以下为核心部分，独立存在 **

// 日历内容html 构建
// 参数为真实 年月日
// 参数3可以不带，带的话可给指定天带上激活状态
function buildHtml(param) {
    var year = param.year,
        month = param.month,
        day = param.day,

        //记录1号星期几
        week,

        totalDays,

        tempHtml = '',
        targetHtml = '',

        curTime = 0;

    //当月 总天数
    totalDays = getTotalDays(year, month);
    
    //星期
    week = (new Date(year, month - 1, 1)).getDay();

    each(week, function (i) {

        tempHtml += '<td class="none"></td>';

        curTime++;

        tempHtml = buildTr(tempHtml);
    });

    each(totalDays, function (i) {
        tempHtml += '<td class="normal' + (day - 1 === i ? ' active' : '') + '">' + sub(i + 1) + '</td>';

        curTime++;

        tempHtml = buildTr(tempHtml);
    });

    while (curTime % 7 !== 0) {

        tempHtml += '<td class="none"></td>';

        curTime++;

        tempHtml = buildTr(tempHtml);

    }

    return targetHtml;

    //for 循环
    function each(count, fn) {

        for (var i = 0 ; i < count; i++) {

            if (fn(i) === false) break;
        }
    }

    //tr 创建
    function buildTr(html) {

        if (curTime % 7 === 0) {

            targetHtml += '<tr>' + html + '</tr>';

            return '';
        }

        return html;
    }

}

// 取当前年月 总天数
// 参数为真实 年月
function getTotalDays(year, month) {
    return (new Date(year, month, 0)).getDate();
}

// 补0。实现 01 02 03 这类数字
function sub(number) {
    return number.toString().length === 1 ? '0' + number : number;
}

