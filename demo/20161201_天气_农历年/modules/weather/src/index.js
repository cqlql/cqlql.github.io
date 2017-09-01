import weatherInfoLoad from '../src/weather-info-load'
import getCityRankById from './get-city-rank-by-id'
import getCityId from './get-city-id'

function getCityRank(cityName, cb) {
  // cityName = '深圳'
  let cityId = getCityId(cityName)
  getCityRankById(cityId, cb)

}

function getWeatherInfo(cityName, cb) {
  // cityName = '深圳'
  let cityId = getCityId(cityName)
  weatherInfoLoad(cityId, cb)
}

export {
  getCityRank,
  getWeatherInfo
}
