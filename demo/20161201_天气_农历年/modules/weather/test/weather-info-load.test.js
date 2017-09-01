
import weatherInfoLoad from '../src/weather-info-load'


describe('天气信息获取', function () {

  it('天气信息获取', function(done) {
    weatherInfoLoad(function (d) {
      console.log(d)
      done()
    })
  })
})
