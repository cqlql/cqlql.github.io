
var expect = require('chai').expect
import cityRankLoad from '../src/city-rank-load'


describe('天气质量信息', function () {

  it('测试', function(done) {

    cityRankLoad(function (d) {
      console.log(d)
      done()
    })
  })
})
