var expect = require('chai').expect
import dateParse from '../src/date-parse'


describe('时间解析测试', function () {

  it('测试', function() {
    let date = dateParse(new Date)

    // ('一二三四五六天'.indexOf(date.weekZh)).should.satisfy(function(num) {
    //   return num > -1;
    // });

    expect('一二三四五六天'.indexOf(date.weekZh)).to.satisfy(function(num) {
      return num > -1;
    });

  })
})
