export default function (date) {

  // 此处处理的格式： Fri Sep 01 2017 11:03:21 GMT+0800 (中国标准时间)
  let dateInfo = date.toString().split(' ')

  let time = dateInfo[4]
  let timeInfo = time.split(':')

  let weekAbbData = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7
  }

  let monthAbbData = {
    jan: 1,
    feb: 2,
    mar: 3,
    Apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  }

  let weekAbb = dateInfo[0].toLowerCase()
  let week = weekAbbData[weekAbb]

  let monthAbb = dateInfo[1].toLowerCase()

  let weekZhData = '一二三四五六天'

  return {
    week,
    weekAbb,
    weekZh:weekZhData[week-1],
    year: dateInfo[3],
    month: monthAbbData[monthAbb],
    day:dateInfo[2],
    monthAbb,
    time,
    hours: timeInfo[0],
    minute: timeInfo[1]
  }
}
